import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";
import { OperationsService } from "../../packages/backend/src/sales/operations.service";
import { OperationsController } from "../../packages/backend/src/sales/operations.controller";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import type { AuthenticatedRequest } from "../../packages/backend/src/identity/auth.types";
import { REQUIRED_PERMISSIONS } from "../../packages/backend/src/identity/permissions.decorator";

describe("Proforma access boundaries", () => {
  const company = randomUUID();
  const service = new OperationsService(new AuditService());
  const controller = new OperationsController(service, new OtcPtpService(new AuditService()));
  afterEach(() => vi.restoreAllMocks());
  it("rejects missing, narrow, and other-company permissions before listing", async () => {
    const list = vi.spyOn(service, "list");
    for (const permissions of [
      [],
      [{ code: "sales_order.read", scope_type: "self", scope_id: null }],
      [{ code: "sales_order.read", scope_type: "company", scope_id: randomUUID() }],
    ]) {
      await expect(
        controller.list("proformas", {}, {
          auth: { company_id: company, permissions },
        } as AuthenticatedRequest),
      ).rejects.toThrow();
    }
    expect(list).not.toHaveBeenCalled();
  });
  it("accepts sales read without warehouse read and passes validated search", async () => {
    const list = vi.spyOn(service, "list").mockResolvedValue({ rows: [], total: 0 });
    await controller.list("proformas", { page: 2, search: "DEV-PRO" }, {
      auth: {
        company_id: company,
        permissions: [{ code: "sales_order.read", scope_type: "company", scope_id: company }],
      },
    } as AuthenticatedRequest);
    expect(list).toHaveBeenCalledWith(company, "proformas", 2, "DEV-PRO", undefined);
  });
  it("requires sales read for detail", () => {
    expect(
      Reflect.getMetadata(REQUIRED_PERMISSIONS, OperationsController.prototype.proforma),
    ).toEqual(["sales_order.read"]);
  });
  it("requires proforma issuance permission for both preview methods", () => {
    for (const method of [
      OperationsController.prototype.previewProforma,
      OperationsController.prototype.previewProformaFreight,
    ]) {
      expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, method)).toEqual(["proforma.issue"]);
    }
  });
  it("does not return another company's document or a different document kind", async () => {
    const find = vi.spyOn(prisma.fulfillmentDocument, "findFirst").mockResolvedValue(null);
    const id = randomUUID();
    await expect(service.proforma(company, id)).rejects.toThrow("Proforma tidak ditemukan");
    expect(find).toHaveBeenCalledWith({
      where: { companyId: company, id, kind: { startsWith: "PROFORMA" } },
    });
  });
});
