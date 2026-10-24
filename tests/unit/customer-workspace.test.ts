import { vi, describe, it, expect, beforeEach } from "vitest";
import type { AuthPrincipal } from "@evflow/contracts";
const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  many: vi.fn(),
  updated: vi.fn(),
  audit: vi.fn(),
}));
vi.mock("@evflow/database", () => ({
  Prisma: {},
  prisma: {
    $transaction: async (
      fn: (tx: {
        contact: {
          findFirst: typeof mocks.find;
          updateMany: typeof mocks.many;
          findFirstOrThrow: typeof mocks.updated;
        };
      }) => Promise<unknown>,
    ) =>
      fn({
        contact: { findFirst: mocks.find, updateMany: mocks.many, findFirstOrThrow: mocks.updated },
      }),
  },
}));
import { CrmService } from "../../packages/backend/src/crm/crm.service";
import {
  assertCustomerCreditEdit,
  customerAllowed,
  customerListSchema,
  customerWhere,
  redactCustomerCredit,
} from "../../packages/backend/src/master/customer-workspace";
import type { AuditService } from "../../packages/backend/src/common/audit.service";
import {
  hasResourcePermission,
  resourcePermissionCode,
} from "../../packages/backend/src/identity/resource-permissions";
describe("customer workspace boundaries", () => {
  beforeEach(() => vi.clearAllMocks());
  it("retains company scope with combined filters", () => {
    const query = customerListSchema.parse({
      q: "Arunika",
      onboarding: "DRAFT",
      relationship: "PROSPECT",
    });
    expect(customerWhere("company-a", query)).toMatchObject({
      companyId: "company-a",
      onboardingState: "DRAFT",
      relationshipStage: "PROSPECT",
      OR: [
        { code: { contains: "Arunika", mode: "insensitive" } },
        { name: { contains: "Arunika", mode: "insensitive" } },
      ],
    });
    expect(customerListSchema.safeParse({ page: 0 }).success).toBe(false);
  });
  it("does not expose finance across company scopes", () => {
    const auth = {
      company_id: "a",
      roles: [],
      permissions: [{ code: "customer_credit.update", scope_type: "company", scope_id: "b" }],
    } as unknown as AuthPrincipal;
    expect(customerAllowed(auth, "customer_credit.update")).toBe(false);
    auth.permissions[0]!.scope_id = "a";
    expect(customerAllowed(auth, "customer_credit.update")).toBe(true);
  });
  it("gates credit attributes on customer_credit.update, not on master_customer.update", () => {
    const masterOnly = {
      company_id: "a",
      roles: [],
      permissions: [
        { code: "master_customer.update", scope_type: "company", scope_id: "a" },
        // The legacy payment policy grant does not unlock the new attributes by itself.
        { code: "customer.payment_policy.manage", scope_type: "company", scope_id: "a" },
      ],
    } as unknown as AuthPrincipal;
    const creditEditor = {
      company_id: "a",
      roles: [],
      permissions: [{ code: "customer_credit.update", scope_type: "company", scope_id: "a" }],
    } as unknown as AuthPrincipal;
    for (const field of [
      "credit_limit",
      "credit_frozen",
      "freeze_reason",
      "past_due_grace_days",
      "default_term_code",
    ])
      expect(() => assertCustomerCreditEdit(masterOnly, { name: "X", [field]: null })).toThrow(
        "Izin kredit pelanggan",
      );
    expect(() =>
      assertCustomerCreditEdit(masterOnly, { name: "X", default_tax_invoice_code: "07" }),
    ).not.toThrow();
    expect(() => assertCustomerCreditEdit(creditEditor, { credit_limit: "10" })).not.toThrow();
    const row = {
      id: "c",
      creditLimit: "10",
      creditFrozen: true,
      freezeReason: "r",
      pastDueGraceDays: 1,
      defaultTermCode: "NET30",
    };
    expect(redactCustomerCredit(masterOnly, row)).toEqual({ id: "c", defaultTermCode: "NET30" });
    expect(redactCustomerCredit(creditEditor, row)).toEqual(row);
  });
  it("keeps the Kontak tab on crm_contact, separate from master_customer", () => {
    const contacts = resourcePermissionCode(
      { family: "crm", action: "read", source: "params", key: "resource" },
      "contacts",
    );
    const customers = resourcePermissionCode(
      { family: "master", action: "read", source: "params", key: "resource" },
      "customers",
    );
    expect(contacts).toBe("crm_contact.read");
    expect(customers).toBe("master_customer.read");
    const masterOnly = {
      company_id: "a",
      roles: [],
      permissions: [{ code: "master_customer.read", scope_type: "company", scope_id: "a" }],
    } as unknown as AuthPrincipal;
    const contactOnly = {
      company_id: "a",
      roles: [],
      permissions: [{ code: "crm_contact.read", scope_type: "company", scope_id: "a" }],
    } as unknown as AuthPrincipal;
    expect(hasResourcePermission(masterOnly, contacts)).toBe(false);
    expect(hasResourcePermission(contactOnly, customers)).toBe(false);
    expect(hasResourcePermission(contactOnly, contacts)).toBe(true);
  });
  const service = new CrmService({ recordWith: mocks.audit } as unknown as AuditService);
  it("rejects a contact outside current company", async () => {
    mocks.find.mockResolvedValue(null);
    await expect(service.updateContact("a", "actor", "contact", 1, {})).rejects.toThrow(
      "Kontak tidak ditemukan",
    );
    expect(mocks.find).toHaveBeenCalledWith({ where: { id: "contact", companyId: "a" } });
    expect(mocks.many).not.toHaveBeenCalled();
  });
  it("rejects stale edits and customer reassignment", async () => {
    mocks.find.mockResolvedValue({ version: 2, customerId: "customer" });
    await expect(
      service.updateContact("a", "actor", "contact", 1, { customer_id: "customer" }),
    ).rejects.toThrow("Kontak berubah");
    await expect(
      service.updateContact("a", "actor", "contact", 2, { customer_id: "other" }),
    ).rejects.toThrow("tidak dapat dipindahkan");
    expect(mocks.many).not.toHaveBeenCalled();
  });
  it("persists each phone with version guard and audit", async () => {
    mocks.find.mockResolvedValue({ version: 2, customerId: "customer" });
    mocks.many.mockResolvedValue({ count: 1 });
    mocks.updated.mockResolvedValue({ id: "contact", phone: "080000000501", version: 3 });
    const result = await service.updateContact("a", "actor", "contact", 2, {
      customer_id: "customer",
      full_name: "PIC Fiktif",
      phone: "080000000501",
      pic_functions: ["FINANCE"],
    });
    expect(result.phone).toBe("080000000501");
    expect(mocks.many).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "contact", companyId: "a", version: 2 },
        data: expect.objectContaining({ phone: "080000000501" }),
      }),
    );
    expect(mocks.audit).toHaveBeenCalledOnce();
  });
  it("rejects a concurrent contact update before audit", async () => {
    mocks.find.mockResolvedValue({ version: 2, customerId: "customer" });
    mocks.many.mockResolvedValue({ count: 0 });
    await expect(
      service.updateContact("a", "actor", "contact", 2, {
        customer_id: "customer",
        full_name: "PIC",
        pic_functions: ["FINANCE"],
      }),
    ).rejects.toThrow("Kontak berubah");
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});
