import { orderActions } from "../../packages/backend/src/sales/order-actions";
import { detailFixture } from "./order-detail-fixture";

test("warehouse grants do not expose finance actions and blocked invoice explains checking", async () =>
  detailFixture(async (f) => {
    const warehouse = await orderActions(
      f.c,
      f.a,
      f.order.id,
      (p) => ["fulfillment.pick", "delivery_receipt.confirm"].includes(p),
      f.tx,
    );
    expect(warehouse.actions.map((a) => a.code)).toEqual([
      "create_picking",
      "open_picking",
      "confirm_pod",
    ]);
    const all = await orderActions(f.c, f.a, f.order.id, () => true, f.tx);
    expect(all.actions.find((a) => a.code === "issue_invoice")).toMatchObject({
      enabled: false,
      reason: expect.any(String),
    });
    expect(all.actions.find((a) => a.code === "close_remainder")?.enabled).toBe(false);
  }));
test("actions isolate company and retain explicit disabled state", async () =>
  detailFixture(async (f) => {
    await expect(
      orderActions("00000000-0000-0000-0000-000000000000", f.a, f.order.id, () => true, f.tx),
    ).rejects.toThrow();
    await f.tx.salesOrder.update({ where: { id: f.order.id }, data: { state: "DRAFT" } });
    const result = await orderActions(
      f.c,
      f.a,
      f.order.id,
      (p) => ["sales_order.submit", "sales_order.print"].includes(p),
      f.tx,
    );
    expect(result.primary?.code).toBe("submit");
    expect(result.actions.map((a) => a.code)).toEqual(["submit", "print"]);
  }));
