import { invoiceWithoutPrices } from "./invoice-privacy";
import { it, expect } from "vitest";
it("keeps invoice identity and due date without exposing snapshot, money or receipts", () => {
  const value = invoiceWithoutPrices({
    id: "i",
    number: "INV",
    dueDate: "2026-10-30",
    state: "POSTED",
    total: "44",
    outstandingAmount: "22",
    subtotal: "40",
    issuedSnapshot: { lines: [{ unit_price: "10" }] },
    payments: [{ amount: "22" }],
    customer: { id: "c", name: "Name" },
  });
  expect(value).toEqual({
    id: "i",
    number: "INV",
    dueDate: "2026-10-30",
    state: "POSTED",
    customer: { id: "c", name: "Name" },
  });
});
