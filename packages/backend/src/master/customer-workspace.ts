import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { hasCreditInput } from "../sales/customer-credit";
import { prisma, type Prisma } from "@evflow/database";
import { z } from "zod";
import { isAccessAdministrator, type AuthPrincipal } from "@evflow/contracts";

export const customerListSchema = z
  .object({
    q: z.string().trim().max(150).default(""),
    page: z.coerce.number().int().min(1).max(100000).default(1),
    onboarding: z.enum(["ALL", "DRAFT", "NEEDS_REVIEW", "VERIFIED"]).default("ALL"),
    relationship: z.enum(["ALL", "PROSPECT", "REGISTERED", "TRANSACTED"]).default("ALL"),
    channel: z.union([z.literal("ALL"), z.string().uuid()]).default("ALL"),
  })
  .strict();
export function customerAllowed(auth: AuthPrincipal, code: string) {
  return (
    isAccessAdministrator(auth) ||
    auth.permissions.some(
      (p) =>
        p.code === code &&
        ["company", "privileged"].includes(p.scope_type) &&
        (!p.scope_id || p.scope_id === auth.company_id),
    )
  );
}
/** Credit limit, freeze and grace are restricted to customer credit editors (IAM per submenu). */
export const CUSTOMER_CREDIT_PERMISSION = "customer_credit.update";
const creditSelect = {
  creditLimit: true,
  creditFrozen: true,
  freezeReason: true,
  pastDueGraceDays: true,
} as const;
export function canEditCustomerCredit(auth: AuthPrincipal) {
  return customerAllowed(auth, CUSTOMER_CREDIT_PERMISSION);
}
/** Backend authority: credit attributes in a customer update need customer_credit.update. */
export function assertCustomerCreditEdit(auth: AuthPrincipal, input: Record<string, unknown>) {
  if (hasCreditInput(input) && !canEditCustomerCredit(auth))
    throw new ForbiddenException(
      "Izin kredit pelanggan diperlukan untuk mengubah termin, limit, status beku atau toleransi jatuh tempo.",
    );
}
/** Removes restricted credit values from a customer row for readers without the permission. */
export function redactCustomerCredit<T extends Record<string, unknown>>(
  auth: AuthPrincipal,
  row: T,
) {
  if (canEditCustomerCredit(auth)) return row;
  const copy: Record<string, unknown> = { ...row };
  for (const key of Object.keys(creditSelect)) delete copy[key];
  return copy as Omit<T, keyof typeof creditSelect>;
}
export function customerWhere(
  companyId: string,
  q: z.infer<typeof customerListSchema>,
): Prisma.CustomerWhereInput {
  const contains = { contains: q.q, mode: "insensitive" as const };
  return {
    companyId,
    ...(q.q ? { OR: [{ code: contains }, { name: contains }] } : {}),
    ...(q.onboarding !== "ALL" ? { onboardingState: q.onboarding } : {}),
    ...(q.relationship !== "ALL" ? { relationshipStage: q.relationship } : {}),
    ...(q.channel !== "ALL" ? { channelId: q.channel } : {}),
  };
}
export async function customerPage(auth: AuthPrincipal, input: unknown) {
  const q = customerListSchema.parse(input),
    where = customerWhere(auth.company_id, q);
  const finance = canEditCustomerCredit(auth);
  const [data, total] = await prisma.$transaction(
    [
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          code: true,
          name: true,
          state: true,
          relationshipStage: true,
          onboardingState: true,
          channel: { select: { id: true, name: true } },
          rayon: { select: { id: true, name: true } },
          defaultTermCode: true,
          ...(finance ? creditSelect : {}),
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: 20,
        skip: (q.page - 1) * 20,
      }),
      prisma.customer.count({ where }),
    ],
    { isolationLevel: "RepeatableRead" },
  );
  return { data, total, page: q.page, pageSize: 20, financeVisible: finance };
}
export async function customerDetail(auth: AuthPrincipal, id: string) {
  const row = await prisma.customer.findFirst({
    where: { id, companyId: auth.company_id },
    include: {
      channel: true,
      rayon: true,
      ...(customerAllowed(auth, "crm_contact.read")
        ? { contacts: { orderBy: { fullName: "asc" as const } } }
        : {}),
    },
  });
  if (!row) throw new NotFoundException("Pelanggan tidak ditemukan.");
  return redactCustomerCredit(auth, row);
}
export async function customerHistory(auth: AuthPrincipal, id: string) {
  if (
    !(await prisma.customer.findFirst({
      where: { id, companyId: auth.company_id },
      select: { id: true },
    }))
  )
    throw new NotFoundException("Pelanggan tidak ditemukan.");
  return prisma.auditEvent.findMany({
    where: {
      companyId: auth.company_id,
      resourceId: id,
      resourceType: { in: ["customer", "customers"] },
    },
    select: { id: true, occurredAt: true, actorId: true, action: true, reason: true },
    orderBy: { occurredAt: "desc" },
    take: 100,
  });
}
export async function customerSales(auth: AuthPrincipal, id: string) {
  if (
    !(await prisma.customer.findFirst({
      where: { id, companyId: auth.company_id },
      select: { id: true },
    }))
  )
    throw new NotFoundException("Pelanggan tidak ditemukan.");
  const orders = customerAllowed(auth, "sales_order.read")
    ? await prisma.salesOrder.findMany({
        where: { companyId: auth.company_id, customerId: id },
        select: { id: true, number: true, createdAt: true, state: true, currency: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : null;
  const invoices = customerAllowed(auth, "sales_invoice.read")
    ? await prisma.salesInvoice.findMany({
        where: { companyId: auth.company_id, customerId: id },
        select: {
          id: true,
          number: true,
          createdAt: true,
          state: true,
          total: true,
          currency: true,
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      })
    : null;
  return { orders, invoices };
}
