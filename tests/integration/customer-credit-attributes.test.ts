import type * as Database from "@evflow/database";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma, type Prisma } from "@evflow/database";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { MasterController } from "../../packages/backend/src/master/master.controller";
import { MasterService } from "../../packages/backend/src/master/master.service";
import { customerDetail } from "../../packages/backend/src/master/customer-workspace";
import {
  customerCredit,
  setCustomerCredit,
} from "../../packages/backend/src/sales/customer-credit";
import { checkCredit } from "../../packages/backend/src/sales/transaction-controls";
import type { AuthenticatedRequest } from "../../packages/backend/src/identity/auth.types";
import { ensureTestTermList } from "../../tools/qa/payment-terms-fixture";

// Real database, all enclosed in a rollback-only transaction.
const context = vi.hoisted(() => ({ tx: null as Prisma.TransactionClient | null }));
vi.mock("@evflow/database", async (original) => {
  const module = await original<typeof Database>();
  return {
    ...module,
    prisma: new Proxy(module.prisma, {
      get(target, key) {
        if (context.tx && key === "$transaction")
          return async (action: unknown) =>
            typeof action === "function"
              ? action(context.tx)
              : Promise.all(action as Promise<unknown>[]);
        const client = context.tx ?? target;
        const value = Reflect.get(client, key);
        return typeof value === "function" ? value.bind(client) : value;
      },
    }),
  };
});

const rollback = new Error("ROLLBACK_CUSTOMER_CREDIT_TEST");
type Fixture = { c: string; actor: string; customerId: string };

async function inRollback(run: (fixture: Fixture) => Promise<void>) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local database required");
  const actual = await vi.importActual<typeof Database>("@evflow/database");
  let completed = false;
  try {
    await actual.prisma.$transaction(
      async (tx) => {
        context.tx = tx;
        await run(await setup());
        completed = true;
        throw rollback;
      },
      { timeout: 120_000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    context.tx = null;
  }
  expect(completed).toBe(true);
}

async function setup(): Promise<Fixture> {
  const c = randomUUID(),
    actor = randomUUID();
  await prisma.company.create({ data: { id: c, name: "CUSTOMER CREDIT TEST ONLY" } });
  await prisma.user.create({
    data: { id: actor, email: `${actor}@test.local`, displayName: "Test", passwordHash: "x" },
  });
  await prisma.companyMembership.create({ data: { companyId: c, userId: actor } });
  await ensureTestTermList(prisma, c, actor);
  const name = `Pelanggan uji ${randomUUID()}`;
  const customer = await prisma.customer.create({
    data: {
      companyId: c,
      code: randomUUID(),
      name,
      normalizedName: name.toLowerCase(),
      state: "ACTIVE",
      createdById: actor,
      updatedById: actor,
    },
  });
  return { c, actor, customerId: customer.id };
}

function request(c: string, actor: string, codes: string[]) {
  return {
    auth: {
      company_id: c,
      user_id: actor,
      roles: [],
      permissions: codes.map((code) => ({ code, scope_type: "company", scope_id: c })),
    },
  } as unknown as AuthenticatedRequest;
}

const controller = new MasterController(new MasterService(new AuditService()));

describe("customer credit attributes", () => {
  it("edits credit fields only with customer_credit.update", async () => {
    await inRollback(async ({ c, actor, customerId }) => {
      await prisma.$transaction((tx) =>
        setCustomerCredit(tx, new AuditService(), c, actor, customerId, {
          default_term_code: "NET30",
          credit_limit: "1000",
          past_due_grace_days: 0,
        }),
      );
      const masterOnly = request(c, actor, ["master_customer.update", "master_customer.read"]);
      const version = () =>
        prisma.customer.findUniqueOrThrow({ where: { id: customerId } }).then((x) => x.version);
      const body = async (extra: Record<string, unknown> = {}) => ({
        name: "Pelanggan diubah",
        primary_address: "Alamat uji",
        version: await version(),
        ...extra,
      });

      // Without the credit permission the credit fields are refused, nothing is written.
      await expect(
        controller.updateCustomer(
          customerId,
          `"${await version()}"`,
          await body({ credit_limit: "999999" }),
          masterOnly,
        ),
      ).rejects.toMatchObject({ status: 403 });
      // The other fields still save and the stored credit stays as it was.
      await controller.updateCustomer(
        customerId,
        `"${await version()}"`,
        await body({ default_tax_invoice_code: "07" }),
        masterOnly,
      );
      let row = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
      expect(row.name).toBe("Pelanggan diubah");
      expect(row.defaultTaxInvoiceCode).toBe("07");
      expect(row.creditLimit?.toString()).toBe("1000");
      expect(row.defaultTermCode).toBe("NET30");
      // Credit values are hidden from readers without the permission.
      const hidden = await customerDetail(
        request(c, actor, ["master_customer.read"]).auth,
        customerId,
      );
      expect(hidden).not.toHaveProperty("creditLimit");
      expect(hidden).toHaveProperty("defaultTermCode", "NET30");

      const creditEditor = request(c, actor, ["master_customer.update", "customer_credit.update"]);
      await expect(
        controller.updateCustomer(
          customerId,
          `"${await version()}"`,
          await body({ default_term_code: "NET999" }),
          creditEditor,
        ),
      ).rejects.toThrow("PAYMENT_TERM_INVALID");
      await expect(
        controller.updateCustomer(
          customerId,
          `"${await version()}"`,
          await body({ credit_frozen: true }),
          creditEditor,
        ),
      ).rejects.toThrow("FREEZE_REASON_REQUIRED");
      await expect(
        controller.updateCustomer(
          customerId,
          `"${await version()}"`,
          await body({ default_tax_invoice_code: "11" }),
          creditEditor,
        ),
      ).rejects.toMatchObject({ status: 400 });
      // A stale version is refused (If-Match).
      await expect(
        controller.updateCustomer(
          customerId,
          '"1"',
          await body({ credit_limit: "5" }),
          creditEditor,
        ),
      ).rejects.toMatchObject({ status: 412 });

      const saved = (await controller.updateCustomer(
        customerId,
        `"${await version()}"`,
        await body({
          default_term_code: "NET45",
          credit_limit: "2500.50",
          credit_frozen: true,
          freeze_reason: "Menunggu pelunasan",
          past_due_grace_days: 3,
        }),
        creditEditor,
      )) as { data: Record<string, unknown> };
      expect(saved.data).toMatchObject({ credit_limit: "2500.5", credit_frozen: true });
      row = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
      expect(row.defaultTermCode).toBe("NET45");
      expect(row.pastDueGraceDays).toBe(3);
      const audits = await prisma.auditEvent.findMany({
        where: { companyId: c, resourceId: customerId, action: "customer.credit.updated" },
        orderBy: { occurredAt: "asc" },
      });
      const last = audits.at(-1)!;
      expect(last.actorId).toBe(actor);
      expect(last.beforeHash).toBeTruthy();
      const change = last.metadata as Record<string, unknown>;
      expect(change.before).toMatchObject({ creditLimit: "1000", defaultTermCode: "NET30" });
      expect(change.after).toMatchObject({
        creditLimit: "2500.5",
        creditFrozen: true,
        freezeReason: "Menunggu pelunasan",
        pastDueGraceDays: 3,
        defaultTermCode: "NET45",
      });
    });
  });

  it("copies active payment policies", async () => {
    await inRollback(async ({ c, actor, customerId }) => {
      const name = `Pelanggan lain ${randomUUID()}`;
      const other = await prisma.customer.create({
        data: {
          companyId: c,
          code: randomUUID(),
          name,
          normalizedName: name.toLowerCase(),
          state: "ACTIVE",
          createdById: actor,
          updatedById: actor,
        },
      });
      const policy = (data: Partial<Prisma.CustomerPaymentPolicyUncheckedCreateInput>) =>
        prisma.customerPaymentPolicy.create({
          data: {
            companyId: c,
            customerId,
            mode: "TEMPO",
            effectiveFrom: new Date("2026-01-01"),
            createdById: actor,
            ...data,
          },
        });
      // Older and inactive/future rows must lose against the currently effective one.
      await policy({ topDays: 14, creditLimit: "10", pastDueGraceDays: 1 });
      await policy({ topDays: 60, creditLimit: "30", pastDueGraceDays: 9, active: false });
      await policy({
        topDays: 60,
        creditLimit: "40",
        pastDueGraceDays: 9,
        effectiveFrom: new Date("2099-01-01"),
      });
      await policy({
        topDays: 45,
        creditLimit: "20000.25",
        pastDueGraceDays: 2,
        frozen: true,
        freezeReason: "Sengketa tagihan",
        effectiveFrom: new Date("2026-03-01"),
      });
      await policy({ customerId: other.id, mode: "COD", topDays: 0 });

      const sql = readFileSync(
        "packages/database/prisma/migrations/20261024140000_customer_credit/migration.sql",
        "utf8",
      );
      const copy = sql.slice(sql.indexOf("-- @copy-begin"), sql.indexOf("-- @copy-end"));
      await prisma.$executeRawUnsafe(copy);

      const [first, second] = await Promise.all([
        prisma.customer.findUniqueOrThrow({ where: { id: customerId } }),
        prisma.customer.findUniqueOrThrow({ where: { id: other.id } }),
      ]);
      expect(first.defaultTermCode).toBe("NET45");
      expect(first.creditLimit?.toString()).toBe("20000.25");
      expect(first.creditFrozen).toBe(true);
      expect(first.freezeReason).toBe("Sengketa tagihan");
      expect(first.pastDueGraceDays).toBe(2);
      expect(first.defaultTaxInvoiceCode).toBe("01");
      expect(second.defaultTermCode).toBe("COD");
      expect(second.creditLimit).toBeNull();
    });
  });

  it("credit check reads customer attributes", async () => {
    await inRollback(async ({ c, actor, customerId }) => {
      const run = () => prisma.$transaction((tx) => checkCredit(tx, c, customerId, "IDR"));
      await expect(run()).rejects.toThrow("PAYMENT_POLICY_REQUIRED");
      // The archived table is no longer consulted.
      await prisma.customerPaymentPolicy.create({
        data: {
          companyId: c,
          customerId,
          mode: "TEMPO",
          topDays: 30,
          creditLimit: "1",
          pastDueGraceDays: 0,
          frozen: true,
          freezeReason: "Arsip",
          effectiveFrom: new Date("2026-01-01"),
          createdById: actor,
        },
      });
      const set = (input: Parameters<typeof setCustomerCredit>[5]) =>
        prisma.$transaction((tx) =>
          setCustomerCredit(tx, new AuditService(), c, actor, customerId, input),
        );
      await set({ default_term_code: "COD" });
      expect(await run()).toMatchObject({ mode: "COD", topDays: 0, termCode: "COD" });

      await set({ default_term_code: "NET30", credit_limit: "40", past_due_grace_days: 0 });
      expect(await prisma.$transaction((tx) => customerCredit(tx, c, customerId))).toMatchObject({
        frozen: false,
        graceDays: 0,
        defaultTerm: "NET30",
      });
      const order = await prisma.salesOrder.create({
        data: { companyId: c, customerId, number: `SO-${randomUUID()}`, createdById: actor },
      });
      const due = new Date();
      due.setUTCDate(due.getUTCDate() + 10);
      const invoice = await prisma.salesInvoice.create({
        data: {
          companyId: c,
          customerId,
          salesOrderId: order.id,
          number: `INV-${randomUUID()}`,
          state: "POSTED",
          subtotal: "50",
          total: "50",
          outstandingAmount: "50",
          dueDate: due,
          postedAt: new Date(),
        },
      });
      await expect(run()).rejects.toThrow("CREDIT_HOLD");
      await set({ credit_limit: "60" });
      expect(await run()).toMatchObject({ mode: "TEMPO", topDays: 30 });

      const overdue = new Date();
      overdue.setUTCDate(overdue.getUTCDate() - 3);
      await prisma.salesInvoice.update({ where: { id: invoice.id }, data: { dueDate: overdue } });
      await expect(run()).rejects.toThrow("CUSTOMER_PAST_DUE");
      await set({ past_due_grace_days: 5 });
      expect(await run()).toMatchObject({ pastDueGraceDays: 5 });

      await set({ credit_frozen: true, freeze_reason: "Uji beku" });
      await expect(run()).rejects.toThrow("CUSTOMER_CREDIT_FROZEN");

      // A term removed from the active OPS-FLX-03 list blocks instead of falling back.
      await prisma.customer.update({
        where: { id: customerId },
        data: { defaultTermCode: "GONE" },
      });
      await expect(run()).rejects.toThrow("PAYMENT_TERM_INVALID");
    });
  });
});
