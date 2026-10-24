import {
  BadRequestException,
  NotFoundException,
  PreconditionFailedException,
} from "@nestjs/common";
import { Prisma, prisma } from "@evflow/database";
import { AuditService } from "../common/audit.service";

export const DISCOUNT_LIMIT_PERMISSION = "discount_limit.manage";
export const DISCOUNT_LIMIT_POLICY = "OPS-FLX-09";

/** Percent limits are decimal(7,4): 0-100 with at most four decimals, e.g. "5.0000" = 5%. */
export const maxDiscountLimit = new Prisma.Decimal(100);

type Percent = Prisma.Decimal;

/**
 * Discount ceiling for one salesperson on one product, in percent.
 * Admin Sistem is unlimited. Person limit overrides roles; otherwise the highest role limit,
 * then the company default, then zero. A product limit caps the result when it is smaller.
 */
export function effectiveDiscountLimit(input: {
  isAdmin: boolean;
  personLimit: Percent | null;
  roleLimits: Percent[];
  companyDefault: Percent | null;
  productLimit: Percent | null;
}): Percent | "UNLIMITED" {
  if (input.isAdmin) return "UNLIMITED";
  const highestRole = input.roleLimits.length ? Prisma.Decimal.max(...input.roleLimits) : null;
  const person = input.personLimit ?? highestRole ?? input.companyDefault ?? new Prisma.Decimal(0);
  return input.productLimit ? Prisma.Decimal.min(person, input.productLimit) : person;
}

/** Normalises user input ("5", "5.5", null, "") to a validated percent, or null for "no limit". */
export function parseDiscountLimit(value: string | null | undefined): Percent | null {
  if (value === null || value === undefined || value === "") return null;
  if (!/^\d{1,3}(\.\d{1,4})?$/.test(value))
    throw new BadRequestException(
      "Batas diskon harus berupa angka 0-100 dengan maksimal empat desimal.",
    );
  const parsed = new Prisma.Decimal(value);
  if (parsed.gt(maxDiscountLimit))
    throw new BadRequestException(
      "Batas diskon harus berupa angka 0-100 dengan maksimal empat desimal.",
    );
  return parsed;
}

/** API shape of a stored limit: fixed 4-decimal string or null (no limit set). */
export const discountLimitText = (value: Percent | null | undefined) =>
  value === null || value === undefined ? null : value.toFixed(4);

/** Active company default (OPS-FLX-09); null when unset or not a valid percent. */
export async function companyDiscountDefault(
  client: Pick<Prisma.TransactionClient, "policyVersion">,
  companyId: string,
) {
  const version = await client.policyVersion.findFirst({
    where: { policy: { companyId, code: DISCOUNT_LIMIT_POLICY }, state: "ACTIVE" },
    orderBy: { versionNo: "desc" },
  });
  const value = version?.valueSnapshot;
  if (typeof value !== "string") return null;
  try {
    return parseDiscountLimit(value);
  } catch {
    return null;
  }
}

/** Effective limit of the signed-in member, optionally capped by one product. Server-side authority for SO. */
export async function memberDiscountLimit(
  auth: { company_id: string; user_id: string },
  productId: string | undefined,
  isAdmin: boolean,
) {
  const [membership, companyDefault, product] = await Promise.all([
    prisma.companyMembership.findUnique({
      where: { companyId_userId: { companyId: auth.company_id, userId: auth.user_id } },
      select: {
        discountLimit: true,
        userRoles: { select: { role: { select: { active: true, discountLimit: true } } } },
      },
    }),
    companyDiscountDefault(prisma, auth.company_id),
    productId
      ? prisma.product.findFirst({
          where: { id: productId, companyId: auth.company_id },
          select: { discountLimit: true },
        })
      : Promise.resolve(undefined),
  ]);
  if (productId && !product) throw new NotFoundException("Produk tidak ditemukan.");
  const limit = effectiveDiscountLimit({
    isAdmin,
    personLimit: membership?.discountLimit ?? null,
    roleLimits: (membership?.userRoles ?? [])
      .filter((assignment) => assignment.role.active && assignment.role.discountLimit)
      .map((assignment) => assignment.role.discountLimit!),
    companyDefault,
    productLimit: product?.discountLimit ?? null,
  });
  return limit === "UNLIMITED" ? limit : limit.toFixed(4);
}

/** Row version for If-Match: the row's updatedAt in epoch milliseconds. */
export const rowVersion = (updatedAt: Date) => updatedAt.getTime();

function assertVersion(updatedAt: Date, expected: number) {
  if (rowVersion(updatedAt) !== expected)
    throw new PreconditionFailedException("Data berubah atau sudah diubah orang lain.");
}

/** Sets (or clears with null) the discount limit of a role. Audited. */
export async function setRoleDiscountLimit(
  companyId: string,
  actorId: string,
  roleId: string,
  value: string | null,
  expectedVersion: number,
) {
  const limit = parseDiscountLimit(value);
  return prisma.$transaction(async (tx) => {
    const role = await tx.role.findFirst({ where: { id: roleId, companyId } });
    if (!role) throw new NotFoundException("Peran tidak ditemukan.");
    assertVersion(role.updatedAt, expectedVersion);
    const updated = await tx.role.update({ where: { id: roleId }, data: { discountLimit: limit } });
    await new AuditService().recordWith(tx, {
      companyId,
      actorId,
      action: "role.discount_limit.updated",
      resourceType: "role",
      resourceId: roleId,
      before: { discount_limit: discountLimitText(role.discountLimit) },
      after: { discount_limit: discountLimitText(updated.discountLimit) },
    });
    return {
      id: roleId,
      discount_limit: discountLimitText(updated.discountLimit),
      version: updated.updatedAt.getTime(),
    };
  });
}

/** Sets (or clears with null) the personal discount limit of a company member. Audited. */
export async function setUserDiscountLimit(
  companyId: string,
  actorId: string,
  userId: string,
  value: string | null,
  expectedVersion: number,
) {
  const limit = parseDiscountLimit(value);
  return prisma.$transaction(async (tx) => {
    const membership = await tx.companyMembership.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    if (!membership || membership.deletedAt)
      throw new NotFoundException("Pengguna tidak ditemukan.");
    assertVersion(membership.updatedAt, expectedVersion);
    const updated = await tx.companyMembership.update({
      where: { id: membership.id },
      data: { discountLimit: limit },
    });
    await new AuditService().recordWith(tx, {
      companyId,
      actorId,
      action: "user.discount_limit.updated",
      resourceType: "user",
      resourceId: userId,
      before: { discount_limit: discountLimitText(membership.discountLimit) },
      after: { discount_limit: discountLimitText(updated.discountLimit) },
    });
    return {
      user_id: userId,
      discount_limit: discountLimitText(updated.discountLimit),
      version: updated.updatedAt.getTime(),
    };
  });
}
