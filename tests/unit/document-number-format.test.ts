import {
  formatDocumentNumber,
  sequenceKey,
} from "../../packages/backend/src/common/document-number";

describe("document number format", () => {
  it("formats monthly", () => {
    expect(
      formatDocumentNumber({ prefix: "SO-SSM", yearFormat: "YYYY", digits: 4 }, "2026-10-24", 1n),
    ).toBe("SO-SSM.2026.10.0001");
  });
  it("formats short year", () => {
    expect(
      formatDocumentNumber({ prefix: "SO-SSM", yearFormat: "YY", digits: 4 }, "2026-10-24", 1n),
    ).toBe("SO-SSM.26.10.0001");
  });
  it("formats the month as Roman numerals when configured", () => {
    expect(
      formatDocumentNumber(
        { prefix: "SO", yearFormat: "YYYY", monthFormat: "ROMAN", digits: 4 },
        "2026-10-24",
        1n,
      ),
    ).toBe("SO.2026.X.0001");
  });
  it("rejects overflow", () => {
    expect(() =>
      formatDocumentNumber({ prefix: "SO", yearFormat: "YYYY", digits: 5 }, "2026-10-24", 100000n),
    ).toThrow("DOCUMENT_NUMBER_EXHAUSTED");
  });
  it("builds sequence keys per reset period", () => {
    expect(sequenceKey("sales_order", "YEARLY", "2026-10-24")).toBe("sales_order:2026");
    expect(sequenceKey("sales_order", "MONTHLY", "2026-10-24")).toBe("sales_order:2026-10");
  });
});
