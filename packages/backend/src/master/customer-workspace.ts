import { NotFoundException } from "@nestjs/common";
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
const policySelect = {
  mode: true,
  topDays: true,
  creditLimit: true,
  effectiveFrom: true,
} satisfies Prisma.CustomerPaymentPolicySelect;
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
  const finance = customerAllowed(auth, "customer.payment_policy.manage");
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
          ...(finance
            ? {
                paymentPolicies: {
                  where: { active: true, effectiveFrom: { lte: new Date() } },
                  orderBy: { effectiveFrom: "desc" as const },
                  take: 1,
                  select: policySelect,
                },
              }
            : {}),
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
      ...(customerAllowed(auth, "customer.payment_policy.manage")
        ? {
            paymentPolicies: {
              where: { active: true, effectiveFrom: { lte: new Date() } },
              orderBy: { effectiveFrom: "desc" as const },
              take: 1,
              select: policySelect,
            },
          }
        : {}),
    },
  });
  if (!row) throw new NotFoundException("Pelanggan tidak ditemukan.");
  return row;
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
