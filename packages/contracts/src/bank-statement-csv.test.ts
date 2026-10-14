import { describe, expect, it } from "vitest";
import { parseBankStatementCsv } from "./bank-statement-csv";
const header = "external_id,reference,value_date,amount,description\r\n";
describe("bank statement CSV", () => {
  it("preserves large decimals and escaped multiline references", () => {
    expect(
      parseBankStatementCsv(
        "\uFEFF" + header + 'A,"Ref,""Q""",2026-10-05,99999999999999.12345678,"Line1\nLine2"',
      )[0],
    ).toEqual({
      external_id: "A",
      reference: 'Ref,"Q"',
      value_date: "2026-10-05",
      amount: "99999999999999.12345678",
      description: "Line1\nLine2",
    });
  });
  it("rejects ambiguous amounts, malformed quotes and unexpected columns", () => {
    for (const line of [
      'A,R,2026-10-05,"1,000.00",D',
      'A,R,2026-10-05,10,"broken',
      "A,R,2026-10-05,=1+1,D",
      "A,R,2026-10-05,10,D,extra",
    ])
      expect(() => parseBankStatementCsv(header + line)).toThrow();
  });
});
