import { formatDocumentNumber } from "../../packages/backend/src/common/document-number";

describe("document number format", () => {
  it("formats yearly reset", () => {
    expect(formatDocumentNumber({ prefix: "SO-", digits: 5, resetYearly: true }, "2026", 7n)).toBe(
      "SO-2026-00007",
    );
  });
  it("formats without year", () => {
    expect(formatDocumentNumber({ prefix: "SO-", digits: 5, resetYearly: false }, "2026", 7n)).toBe(
      "SO-00007",
    );
  });
  it("rejects overflow", () => {
    expect(() =>
      formatDocumentNumber({ prefix: "SO-", digits: 5, resetYearly: true }, "2026", 100000n),
    ).toThrow("DOCUMENT_NUMBER_EXHAUSTED");
  });
});
