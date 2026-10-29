import { Prisma } from "@evflow/database";
import { listSalesOrders } from "../../packages/backend/src/sales/order-list";
import { orderDetail } from "../../packages/backend/src/sales/order-detail";
import { lineAmounts } from "../../packages/backend/src/sales/pricing-controls";
import { assertLineDiscounts } from "../../packages/backend/src/sales/discount-limit";
import { o2cFixture } from "./o2c-release1-fixture";

const all = () => true;

describe("SO line discount (OTC-18, Release 1: SO only)", () => {
  it("applies the line discount before PPN in SO values only when asked", () => {
    const line = {
      unitPrice: new Prisma.Decimal("250000"),
      taxSnapshot: {
        rule_id: "r",
        rate: "0.12",
        dpp_factor: "0.9166666667",
        decimal_places: 2,
        rounding: "HALF_UP",
      },
    };
    const gross = lineAmounts(line, new Prisma.Decimal(20));
    expect(gross.net.toString()).toBe("5000000");
    const net = lineAmounts(line, new Prisma.Decimal(20), "5");
    expect(net.net.toString()).toBe("4750000");
    // PPN 12% x DPP 11/12 equals 11% of the discounted value.
    expect(net.tax.toString()).toBe("522500");
  });

  it("shows discounted subtotal and total in SO list and detail", async () =>
    o2cFixture(async (f) => {
      await f.tx.salesOrderLine.update({
        where: { id: f.order.lines[0]!.id },
        data: { discountRate: "10" },
      });
      const detail = await orderDetail(f.c, f.order.id, all, f.tx);
      expect(detail.lines[0]).toMatchObject({ subtotal: "90" });
      expect(String(detail.lines[0]!.discountRate)).toBe("10");
      expect(detail).toMatchObject({ subtotal: "90", taxAmount: "9", total: "99" });
      const list = (await listSalesOrders(
        f.c,
        1,
        "",
        undefined,
        {},
        f.tx,
        true,
        false,
      )) as unknown as {
        rows: { total: string | null }[];
      };
      expect(list.rows[0]!.total).toBe("99");
    }));

  it("refuses a discount above the actor's effective limit", async () =>
    o2cFixture(async (f) => {
      const line = (rate: string) => [{ productId: f.p.id, discountRate: rate }];
      // No discount needs no limit.
      await expect(assertLineDiscounts(f.tx, f.c, f.a, line("0"))).resolves.toBeUndefined();
      // No person, role or company limit: zero.
      await expect(assertLineDiscounts(f.tx, f.c, f.a, line("5"))).rejects.toMatchObject({
        response: { code: "DISCOUNT_LIMIT_EXCEEDED" },
      });
      await f.tx.companyMembership.update({
        where: { companyId_userId: { companyId: f.c, userId: f.a } },
        data: { discountLimit: "10" },
      });
      await expect(assertLineDiscounts(f.tx, f.c, f.a, line("10"))).resolves.toBeUndefined();
      // A smaller product cap wins.
      await f.tx.product.update({ where: { id: f.p.id }, data: { discountLimit: "3" } });
      await expect(assertLineDiscounts(f.tx, f.c, f.a, line("5"))).rejects.toMatchObject({
        response: { code: "DISCOUNT_LIMIT_EXCEEDED" },
      });
      // Admin Sistem is unlimited.
      const membership = await f.tx.companyMembership.findUniqueOrThrow({
        where: { companyId_userId: { companyId: f.c, userId: f.a } },
      });
      const role = await f.tx.role.create({
        data: { companyId: f.c, code: "ADMIN_SYSTEM", name: "Admin Sistem" },
      });
      await f.tx.userRole.create({
        data: { companyId: f.c, membershipId: membership.id, roleId: role.id },
      });
      await expect(assertLineDiscounts(f.tx, f.c, f.a, line("50"))).resolves.toBeUndefined();
    }));
});
