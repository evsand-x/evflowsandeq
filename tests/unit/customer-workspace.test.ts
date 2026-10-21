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
  customerAllowed,
  customerListSchema,
  customerWhere,
} from "../../packages/backend/src/master/customer-workspace";
import type { AuditService } from "../../packages/backend/src/common/audit.service";
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
      permissions: [
        { code: "customer.payment_policy.manage", scope_type: "company", scope_id: "b" },
      ],
    } as AuthPrincipal;
    expect(customerAllowed(auth, "customer.payment_policy.manage")).toBe(false);
    auth.permissions[0]!.scope_id = "a";
    expect(customerAllowed(auth, "customer.payment_policy.manage")).toBe(true);
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
