import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  PreconditionFailedException,
} from "@nestjs/common";
import { z } from "zod";
import { prisma, type Prisma } from "@evflow/database";
import { AuditService } from "../common/audit.service";

export const proofTypes = ["BUKTI_POTONG", "SSP_NTPN", "NONE"] as const;

export const deductionTypeInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    settle_account_id: z.string().uuid(),
    proof_type: z.enum(proofTypes),
    proof_required: z.boolean(),
    active: z.boolean().default(true),
  })
  .strict()
  // A deduction with no proof type cannot require proof.
  .refine((v) => !(v.proof_required && v.proof_type === "NONE"), {
    message: "Jenis bukti wajib dipilih bila bukti diwajibkan.",
  });

export type DeductionTypeRow = Awaited<ReturnType<typeof prisma.deductionType.findFirstOrThrow>>;

function parse(input: unknown) {
  const result = deductionTypeInput.safeParse(input);
  if (!result.success) throw new BadRequestException(result.error.flatten());
  return result.data;
}

/** Active deduction types for Terima Pembayaran (stage 3). */
export async function listActiveDeductionTypes(
  tx: Pick<Prisma.TransactionClient, "deductionType">,
  companyId: string,
) {
  return tx.deductionType.findMany({
    where: { companyId, active: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function listDeductionTypes(companyId: string) {
  return prisma.deductionType.findMany({
    where: { companyId },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export async function deductionAccountOptions(companyId: string) {
  return prisma.financeAccount.findMany({
    where: { companyId, accountType: "DETAIL" },
    select: { id: true, code: true, name: true, category: true, active: true },
    orderBy: { code: "asc" },
  });
}

async function validate(
  tx: Prisma.TransactionClient,
  companyId: string,
  data: z.infer<typeof deductionTypeInput>,
  excludeId?: string,
) {
  const account = await tx.financeAccount.findFirst({
    where: { id: data.settle_account_id, companyId, accountType: "DETAIL", active: true },
  });
  if (!account)
    throw new ConflictException(
      "Akun penyelesaian harus akun rincian (detail) yang aktif pada perusahaan ini.",
    );
  const clash = await tx.deductionType.findFirst({
    where: {
      companyId,
      name: { equals: data.name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  if (clash) throw new ConflictException("Nama jenis potongan sudah dipakai.");
}

const snapshot = (row: DeductionTypeRow) => ({
  name: row.name,
  settle_account_id: row.settleAccountId,
  proof_type: row.proofType,
  proof_required: row.proofRequired,
  active: row.active,
  version: row.version,
});

export async function createDeductionType(companyId: string, actorId: string, input: unknown) {
  const data = parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id=${companyId}::uuid FOR UPDATE`;
    await validate(tx, companyId, data);
    const row = await tx.deductionType.create({
      data: {
        companyId,
        name: data.name,
        settleAccountId: data.settle_account_id,
        proofType: data.proof_type,
        proofRequired: data.proof_required,
        active: data.active,
      },
    });
    await new AuditService().recordWith(tx, {
      companyId,
      actorId,
      action: "deduction_type.created",
      resourceType: "deduction_type",
      resourceId: row.id,
      after: snapshot(row),
    });
    return row;
  });
}

export async function updateDeductionType(
  companyId: string,
  actorId: string,
  id: string,
  expectedVersion: number,
  input: unknown,
) {
  const data = parse(input);
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id=${companyId}::uuid FOR UPDATE`;
    const before = await tx.deductionType.findFirst({ where: { id, companyId } });
    if (!before) throw new NotFoundException("Jenis potongan tidak ditemukan.");
    if (before.version !== expectedVersion)
      throw new PreconditionFailedException("Jenis potongan diubah orang lain. Muat ulang.");
    await validate(tx, companyId, data, id);
    const row = await tx.deductionType.update({
      where: { id },
      data: {
        name: data.name,
        settleAccountId: data.settle_account_id,
        proofType: data.proof_type,
        proofRequired: data.proof_required,
        active: data.active,
        version: { increment: 1 },
        updatedAt: new Date(),
      },
    });
    await new AuditService().recordWith(tx, {
      companyId,
      actorId,
      action: "deduction_type.updated",
      resourceType: "deduction_type",
      resourceId: id,
      before: snapshot(before),
      after: snapshot(row),
    });
    return row;
  });
}
