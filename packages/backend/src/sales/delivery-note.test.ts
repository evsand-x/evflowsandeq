import { describe, it, expect } from "vitest";
import { Prisma } from "@evflow/database";
import {
  allocateDeliveryStock,
  deliveryNoteView,
  eligibleMovingAverageCost,
} from "./delivery-note";
const d = (v: string) => new Prisma.Decimal(v);
describe("Surat Jalan stock allocation", () => {
  it("uses only unreserved quantity with exact decimals and rejects shortage before any writes", () => {
    const lots = [
      {
        id: "a",
        productId: "p",
        warehouseId: "w",
        locatorId: "l",
        quantityOnHand: d("2.0000000001"),
        quantityReserved: d("1"),
      },
      {
        id: "b",
        productId: "p",
        warehouseId: "other",
        locatorId: "l",
        quantityOnHand: d("99"),
        quantityReserved: d("0"),
      },
    ];
    expect(
      allocateDeliveryStock(lots, [
        {
          id: "line",
          productId: "p",
          warehouseId: "w",
          locatorId: null,
          quantity: d("1.0000000001"),
        },
      ])[0]?.parts[0]?.quantity.toString(),
    ).toBe("1.0000000001");
    expect(() =>
      allocateDeliveryStock(lots, [
        {
          id: "line",
          productId: "p",
          warehouseId: "w",
          locatorId: null,
          quantity: d("1.0000000002"),
        },
      ]),
    ).toThrow("STOCK_INSUFFICIENT");
    expect(lots[0]!.quantityOnHand.toString()).toBe("2.0000000001");
  });
  it("does not assign the same stock twice across SO lines and honors locator selection", () => {
    const lots = [
      {
        id: "a",
        productId: "p",
        warehouseId: "w",
        locatorId: "l",
        quantityOnHand: d("3"),
        quantityReserved: d("0"),
      },
    ];
    expect(() =>
      allocateDeliveryStock(lots, [
        { id: "1", productId: "p", warehouseId: "w", locatorId: null, quantity: d("2") },
        { id: "2", productId: "p", warehouseId: "w", locatorId: null, quantity: d("2") },
      ]),
    ).toThrow("STOCK_INSUFFICIENT");
    expect(() =>
      allocateDeliveryStock(lots, [
        { id: "1", productId: "p", warehouseId: "w", locatorId: "elsewhere", quantity: d("1") },
      ]),
    ).toThrow("STOCK_INSUFFICIENT");
  });
});

it("does not expose unit costs, prices, credit data or source row internals in the outbound view", async () => {
  const raw = {
    id: "note",
    number: "SJ",
    state: "ISSUED",
    salesOrderId: "so",
    notes: null,
    handoverAt: null,
    receiverName: "Receiver",
    evidenceId: "proof",
    issuedAt: null,
    createdAt: new Date(),
    snapshot: {
      payment: { term_code: "N30", top_days: 30, credit_limit: "999" },
      freight_amount: "100",
    },
    lines: [
      {
        id: "line",
        salesOrderLineId: "sol",
        quantity: d("2"),
        deliveredQuantity: d("2"),
        rejectedQuantity: d("0"),
        warehouseId: "w",
        locatorId: null,
        unitPrice: d("999"),
        costSnapshot: { unitCost: "666" },
        salesOrderLine: {
          productId: "p",
          unitPrice: "999",
          product: { code: "P", name: "Product" },
        },
      },
    ],
    salesOrder: {
      id: "so",
      number: "SO",
      customerId: "customer",
      salespersonId: "sales",
      customer: { name: "Customer" },
    },
  };
  const view = deliveryNoteView(raw as unknown as Parameters<typeof deliveryNoteView>[0]);
  expect(view.lines[0]).toMatchObject({
    quantity: "2",
    product: { id: "p", code: "P", name: "Product" },
  });
  expect(JSON.stringify(view)).not.toMatch(/unitPrice|unitCost|costSnapshot|credit_limit|999|666/);
});

describe("Surat Jalan valuation scope", () => {
  it("averages only eligible scoped lots and leaves quarantine/foreign lots out", () => {
    const lots = [
      {
        productId: "p",
        quantityOnHand: new Prisma.Decimal("2"),
        quantityReserved: new Prisma.Decimal("0"),
        unitCost: new Prisma.Decimal("3"),
      },
      {
        productId: "p",
        quantityOnHand: new Prisma.Decimal("8"),
        quantityReserved: new Prisma.Decimal("8"),
        unitCost: new Prisma.Decimal("999"),
      },
      {
        productId: "q",
        quantityOnHand: new Prisma.Decimal("100"),
        quantityReserved: new Prisma.Decimal("0"),
        unitCost: new Prisma.Decimal("999"),
      },
    ];
    expect(eligibleMovingAverageCost(lots, "p").toString()).toBe("3");
  });
});
