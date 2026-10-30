import { randomUUID } from "node:crypto";
import { prisma } from "@evflow/database";
import { provisionCompanyDefaults } from "../../packages/backend/src/administration/company-defaults";
import {
  listNumberingSettings,
  nextDocumentNumber,
  reviseNumbering,
} from "../../packages/backend/src/common/document-number";

describe("numbering settings revision", () => {
  let companyId: string, actorId: string;
  const companyToday = () =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Makassar" }).format(new Date());
  const next = (kind = "sales_order", at?: string) =>
    prisma.$transaction((tx) =>
      nextDocumentNumber(tx, companyId, kind, at ? new Date(`${at}T05:00:00Z`) : undefined),
    );
  const setRule = async (resetPeriod: "YEARLY" | "MONTHLY") => {
    await prisma.documentNumberRule.deleteMany({
      where: { companyId, documentKind: "sales_order" },
    });
    await prisma.documentNumberRule.create({
      data: {
        companyId,
        documentKind: "sales_order",
        prefix: "SO",
        yearFormat: "YYYY",
        digits: 4,
        resetPeriod,
        effectiveFrom: new Date("2020-01-01"),
        effectiveTo: new Date("2999-12-31"),
        createdById: actorId,
      },
    });
  };
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
    await next();
    await next();
    await reviseNumbering(
      companyId,
      actorId,
      "sales_order",
      { prefix: "PJ", year_format: "YYYY", digits: 5, reset_period: "MONTHLY" },
      randomUUID(),
    );
    const [y, m] = companyToday().split("-");
    expect(await next()).toBe(`PJ.${y}.${m}.00003`);
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
    const input = { prefix: "PJ", year_format: "YYYY", digits: 5, reset_period: "YEARLY" };
    const first = await reviseNumbering(companyId, actorId, "sales_order", input, key);
    const second = await reviseNumbering(companyId, actorId, "sales_order", input, key);
    expect(second.id).toBe(first.id);
    expect(
      await prisma.auditEvent.count({ where: { companyId, action: "numbering_rule.revised" } }),
    ).toBe(1);
  });

  it("default rule yields Prefix.Year.Month.Sequence", async () => {
    const [y, m] = companyToday().split("-");
    expect(await next()).toBe(`SO.${y}.${m}.0001`);
  });

  it("monthly reset restarts next month", async () => {
    await setRule("MONTHLY");
    await next("sales_order", "2026-10-10");
    await next("sales_order", "2026-10-11");
    expect(await next("sales_order", "2026-10-12")).toBe("SO.2026.10.0003");
    expect(await next("sales_order", "2026-11-01")).toBe("SO.2026.11.0001");
  });

  it("yearly reset continues across months", async () => {
    await setRule("YEARLY");
    await next("sales_order", "2026-10-10");
    await next("sales_order", "2026-10-11");
    expect(await next("sales_order", "2026-10-12")).toBe("SO.2026.10.0003");
    expect(await next("sales_order", "2026-11-01")).toBe("SO.2026.11.0004");
    expect(await next("sales_order", "2027-01-01")).toBe("SO.2027.01.0001");
  });

  it("reset change waits for the next period", async () => {
    await setRule("YEARLY");
    await next();
    const res = (await reviseNumbering(
      companyId,
      actorId,
      "sales_order",
      { prefix: "SO", year_format: "YYYY", digits: 4, reset_period: "MONTHLY" },
      randomUUID(),
    )) as { effective_from: string };
    const [y, m] = companyToday().split("-").map(Number) as [number, number];
    const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
    expect(res.effective_from).toBe(nextMonth);
    expect(await next()).toBe(`SO.${y}.${String(m).padStart(2, "0")}.0002`);
    const listed = (await listNumberingSettings(companyId)).find(
      (r) => r.document_kind === "sales_order",
    )!;
    expect(listed.reset_period).toBe("YEARLY");
    expect(listed.pending).toMatchObject({ reset_period: "MONTHLY", effective_from: nextMonth });
    // from the first day of the next period the counter restarts per month
    expect(await next("sales_order", nextMonth)).toBe(
      `SO.${nextMonth.slice(0, 4)}.${nextMonth.slice(5, 7)}.0001`,
    );
  });

  it("rejects digits below the running counter", async () => {
    await setRule("YEARLY");
    await prisma.masterCodeSequence.create({
      data: {
        companyId,
        entityType: `sales_order:${companyToday().slice(0, 4)}`,
        nextValue: 1235n,
      },
    });
    await expect(
      reviseNumbering(
        companyId,
        actorId,
        "sales_order",
        { prefix: "SO", year_format: "YYYY", digits: 3, reset_period: "YEARLY" },
        randomUUID(),
      ),
    ).rejects.toThrow("NUMBERING_DIGITS_TOO_SHORT");
  });

  it("prefix change keeps the counter", async () => {
    await next();
    await next();
    await reviseNumbering(
      companyId,
      actorId,
      "sales_order",
      { prefix: "SO-SSM", year_format: "YY", digits: 4, reset_period: "MONTHLY" },
      randomUUID(),
    );
    const [y, m] = companyToday().split("-");
    expect(await next()).toBe(`SO-SSM.${y!.slice(2)}.${m}.0003`);
  });

  it("prefix edit keeps the scheduled reset change", async () => {
    await setRule("YEARLY");
    const first = (await reviseNumbering(
      companyId,
      actorId,
      "sales_order",
      { prefix: "SO", year_format: "YYYY", digits: 4, reset_period: "MONTHLY" },
      randomUUID(),
    )) as { effective_from: string };
    await reviseNumbering(
      companyId,
      actorId,
      "sales_order",
      { prefix: "SO-SSM", year_format: "YY", digits: 5, reset_period: "MONTHLY" },
      randomUUID(),
    );
    const listed = (await listNumberingSettings(companyId)).find(
      (r) => r.document_kind === "sales_order",
    )!;
    expect(listed.prefix).toBe("SO-SSM");
    expect(listed.reset_period).toBe("YEARLY");
    expect(listed.pending).toMatchObject({
      prefix: "SO-SSM",
      year_format: "YY",
      digits: 5,
      reset_period: "MONTHLY",
      effective_from: first.effective_from,
    });
    // choosing the active period again cancels the schedule
    await reviseNumbering(
      companyId,
      actorId,
      "sales_order",
      { prefix: "SO-SSM", year_format: "YY", digits: 5, reset_period: "YEARLY" },
      randomUUID(),
    );
    const after = (await listNumberingSettings(companyId)).find(
      (r) => r.document_kind === "sales_order",
    )!;
    expect(after.pending).toBeNull();
  });
});
