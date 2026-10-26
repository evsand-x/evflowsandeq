import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { OtcPtpController } from "../../packages/backend/src/otc-ptp.controller";
import { REQUIRED_PERMISSIONS } from "../../packages/backend/src/identity/permissions.decorator";
import { OtcPtpService } from "../../packages/backend/src/otc-ptp.service";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { recordOrderPrint } from "../../packages/backend/src/sales/order-print";
import { detailFixture } from "./order-detail-fixture";
const svc = new OtcPtpService(new AuditService());
test("print and duplicate require independent action grants", () => {
  expect(Reflect.getMetadata(REQUIRED_PERMISSIONS, OtcPtpController.prototype.printOrder)).toEqual([
    "sales_order.print",
  ]);
  expect(
    Reflect.getMetadata(REQUIRED_PERMISSIONS, OtcPtpController.prototype.duplicateOrder),
  ).toEqual(["sales_order.create"]);
});
test("migration grants print only to existing readers and audits scope", async () =>
  detailFixture(async (f) => {
    const permission = await f.tx.permission.upsert({
      where: { code: "sales_order.read" },
      update: {},
      create: { code: "sales_order.read", resource: "sales_order", action: "read" },
    });
    const reader = await f.tx.role.create({
      data: { companyId: f.c, code: "reader", name: "Reader" },
    });
    const other = await f.tx.role.create({
      data: { companyId: f.c, code: "other", name: "Other" },
    });
    await f.tx.rolePermission.create({
      data: {
        companyId: f.c,
        roleId: reader.id,
        permissionId: permission.id,
        scopeType: "company",
        scopeId: f.c,
      },
    });
    const sql = readFileSync(
      "packages/database/prisma/migrations/20261025210000_sales_order_print_permission/migration.sql",
      "utf8",
    );
    for (const statement of sql.split(";").filter((s) => s.trim()))
      await f.tx.$executeRawUnsafe(statement);
    const grants = await f.tx.rolePermission.findMany({
      where: { companyId: f.c, permission: { code: "sales_order.print" } },
    });
    expect(grants.map((g) => g.roleId)).toEqual([reader.id]);
    expect(grants.some((g) => g.roleId === other.id)).toBe(false);
    expect(grants[0]?.scopeId).toBe(f.c);
    expect(
      await f.tx.auditEvent.count({
        where: { companyId: f.c, action: "permission.migrated", resourceId: reader.id },
      }),
    ).toBe(1);
  }));
test("print audit belongs to scoped SO and actor", async () =>
  detailFixture(async (f) => {
    await recordOrderPrint(f.c, f.a, f.order.id, f.tx);
    expect(
      await f.tx.auditEvent.findFirst({
        where: { companyId: f.c, resourceId: f.order.id, action: "sales_order.printed" },
      }),
    ).toMatchObject({ actorId: f.a });
    await expect(recordOrderPrint(randomUUID(), f.a, f.order.id, f.tx)).rejects.toThrow();
  }));
test("duplicate creates fresh draft without reference, evidence, prices or old allocations", async () =>
  detailFixture(async (f) => {
    await f.tx.documentNumberRule.create({
      data: {
        companyId: f.c,
        createdById: f.a,
        documentKind: "sales_order",
        prefix: "SO",
        digits: 6,
        yearFormat: "YYYY",
        resetPeriod: "YEARLY",
        effectiveFrom: new Date("2020-01-01"),
        effectiveTo: new Date("2099-01-01"),
      },
    });
    await f.tx.customer.update({
      where: { id: f.customer.id },
      data: { shippingAddress: "Current shipping address" },
    });
    const copy = await svc.duplicateSalesOrderTx(f.tx, f.c, f.a, f.order.id);
    expect(copy).toMatchObject({
      state: "DRAFT",
      customerId: f.customer.id,
      customerReference: null,
      evidenceId: null,
      deliveryAddress: "Current shipping address",
    });
    expect(copy.id).not.toBe(f.order.id);
    expect(copy.lines[0]).toMatchObject({ productId: f.product.id, uomId: f.uom.id });
    expect(copy.lines[0]!.unitPrice.toString()).toBe("0");
    expect(copy.lines[0]!.orderedQuantity.toString()).toBe("10");
    expect(copy.lines[0]!.allocatedQuantity.toString()).toBe("0");
    expect(
      await f.tx.auditEvent.findFirst({
        where: { resourceId: copy.id, action: "sales_order.duplicated" },
      }),
    ).not.toBeNull();
  }));
