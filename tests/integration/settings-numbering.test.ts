import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";
import { provisionCompanyDefaults } from "../../packages/backend/src/administration/company-defaults";
import {
  nextDocumentNumber,
  reviseNumbering,
} from "../../packages/backend/src/common/document-number";

describe("numbering settings revision", () => {
  let companyId: string, actorId: string;
  const year = String(new Date().getFullYear());
  beforeEach(async () => {
    if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
      throw new Error("Local test database required");
    companyId = (await prisma.company.create({ data: { name: `Numbering ${randomUUID()}` } })).id;
    actorId = (
      await prisma.user.create({
        data: { email: `num-${randomUUID()}@evflow.local`, displayName: "N", passwordHash: "x" },
      })
    ).id;
    await prisma.$transaction((tx) => provisionCompanyDefaults(tx, companyId, actorId));
  });

  it("revision keeps the running counter", async () => {
    await prisma.$transaction((tx) => nextDocumentNumber(tx, companyId, "sales_order"));
    await prisma.$transaction((tx) => nextDocumentNumber(tx, companyId, "sales_order"));
    await reviseNumbering(
      companyId,
      actorId,
      "sales_order",
      { prefix: "PJ-", digits: 5, reset_yearly: true },
      randomUUID(),
    );
    expect(
      await prisma.$transaction((tx) => nextDocumentNumber(tx, companyId, "sales_order")),
    ).toBe(`PJ-${year}-00003`);
    const company = await prisma.company.findUniqueOrThrow({ where: { id: companyId } });
    const today = new Date(
      new Intl.DateTimeFormat("en-CA", { timeZone: company.timezone }).format(new Date()),
    );
    expect(
      await prisma.documentNumberRule.count({
        where: {
          companyId,
          documentKind: "sales_order",
          effectiveFrom: { lte: today },
          effectiveTo: { gt: today },
        },
      }),
    ).toBe(1);
  });

  it("replays the same idempotency key", async () => {
    const key = randomUUID();
    const input = { prefix: "PJ-", digits: 5, reset_yearly: true };
    const first = await reviseNumbering(companyId, actorId, "sales_order", input, key);
    const second = await reviseNumbering(companyId, actorId, "sales_order", input, key);
    expect(second.id).toBe(first.id);
    expect(
      await prisma.auditEvent.count({ where: { companyId, action: "numbering_rule.revised" } }),
    ).toBe(1);
  });
});
