import { randomUUID } from "node:crypto";
import {
  localDayStart,
  orderFilterWhere,
  orderListFilterSchema,
} from "../../packages/backend/src/sales/order-list-filters";
import { OperationsService } from "../../packages/backend/src/sales/operations.service";
import { OperationsController } from "../../packages/backend/src/sales/operations.controller";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import type { AuthenticatedRequest } from "../../packages/backend/src/identity/auth.types";

describe("Sales Order list filters", () => {
  afterEach(() => vi.restoreAllMocks());
  it("converts a company-local day to the UTC instant", () => {
    expect(localDayStart("2026-10-07", "Asia/Makassar").toISOString()).toBe(
      "2026-10-06T16:00:00.000Z",
    );
    expect(localDayStart("2026-10-07", "UTC").toISOString()).toBe("2026-10-07T00:00:00.000Z");
  });
  it("builds an inclusive local date range and customer scope", () => {
    const customer = randomUUID();
    expect(
      orderFilterWhere(
        { customer_id: customer, from: "2026-10-01", to: "2026-10-07" },
        "Asia/Makassar",
      ),
    ).toEqual([
      { customerId: customer },
      {
        orderDate: {
          gte: new Date("2026-10-01T00:00:00.000Z"),
          lt: new Date("2026-10-08T00:00:00.000Z"),
        },
      },
    ]);
  });
  it("mirrors orderView remainder rules", () => {
    const where = (remainder: "BACKORDER" | "IN_PROGRESS" | "NOT_EVALUATED" | "CLOSED") =>
      orderFilterWhere({ remainder }, "UTC")[0];
    expect(where("CLOSED")).toEqual({ state: { in: ["CLOSED", "CANCELLED"] } });
    expect(where("BACKORDER")).toEqual({
      state: { notIn: ["CLOSED", "CANCELLED"] },
      lines: { some: { backorderQuantity: { gt: 0 } } },
    });
    expect(where("NOT_EVALUATED")).toEqual({
      state: "DRAFT",
      lines: { none: { backorderQuantity: { gt: 0 } } },
    });
    expect(where("IN_PROGRESS")).toEqual({
      state: { notIn: ["CLOSED", "CANCELLED", "DRAFT"] },
      lines: { none: { backorderQuantity: { gt: 0 } } },
    });
  });
  it("rejects reversed ranges and unknown values", () => {
    expect(orderListFilterSchema.safeParse({ from: "2026-10-08", to: "2026-10-01" }).success).toBe(
      false,
    );
    expect(orderListFilterSchema.safeParse({ fulfillment: "LATE" }).success).toBe(false);
    expect(orderListFilterSchema.safeParse({ customer_id: "not-a-uuid" }).success).toBe(false);
  });
  it("passes order filters only for the Sales Order list", async () => {
    const company = randomUUID(),
      customer = randomUUID();
    const service = new OperationsService(new AuditService());
    const controller = new OperationsController(service, new OtcPtpService(new AuditService()));
    const list = vi.spyOn(service, "list").mockResolvedValue({ rows: [], total: 0 } as never);
    const req = {
      auth: {
        company_id: company,
        roles: [],
        permissions: [
          { code: "sales_order.read", scope_type: "company", scope_id: company },
          { code: "proforma.read", scope_type: "company", scope_id: company },
        ],
      },
    } as AuthenticatedRequest;
    await controller.list(
      "orders",
      { customer_id: customer, from: "2026-10-01", fulfillment: "PARTIAL", remainder: "BACKORDER" },
      req,
    );
    expect(list).toHaveBeenLastCalledWith(
      company,
      "orders",
      1,
      "",
      undefined,
      undefined,
      undefined,
      { customer_id: customer, from: "2026-10-01", fulfillment: "PARTIAL", remainder: "BACKORDER" },
      false,
      false,
    );
    await controller.list("proformas", {}, req);
    expect(list.mock.lastCall).toEqual([
      company,
      "proformas",
      1,
      "",
      undefined,
      undefined,
      undefined,
    ]);
    await expect(controller.list("orders", { fulfillment: "LATE" }, req)).rejects.toThrow();
  });
});
