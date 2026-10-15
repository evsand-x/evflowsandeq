import { describe, expect, it } from "vitest";
import { invoicePaymentStatus } from "./invoice-status";

describe("invoice payment status", () => {
  it.each([
    ["0", "100", "Lunas"],
    ["100", "100", "Belum Dibayar"],
    ["25", "100", "Dibayar Sebagian"],
    ["9999999999999999.99999999", "10000000000000000", "Dibayar Sebagian"],
    ["0", "0", "Lunas"],
    ["-1", "100", null],
    ["101", "100", null],
    ["NaN", "100", null],
    [undefined, "100", null],
    ["0", undefined, null],
  ])("maps remaining %s / total %s to %s", (outstandingAmount, total, expected) => {
    expect(invoicePaymentStatus({ state: "POSTED", outstandingAmount, total })).toBe(expected);
  });
  it.each(["DRAFT", "VOID", "ISSUED_WAITING_POD"])("never labels %s as paid", (state) => {
    expect(invoicePaymentStatus({ state, outstandingAmount: "0", total: "100" })).toBeNull();
  });
});
