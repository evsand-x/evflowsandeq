import type * as Database from "@evflow/database";
import { randomUUID } from "node:crypto";
import { operationalPolicyCatalog, prisma, type Prisma } from "@evflow/database";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { AdministrationService } from "../../packages/backend/src/administration/administration.service";
import { ensureTestTermList } from "../../tools/qa/payment-terms-fixture";

// Real database, all enclosed in a rollback-only transaction.
const context = vi.hoisted(() => ({ tx: null as Prisma.TransactionClient | null }));
vi.mock("@evflow/database", async (original) => {
  const module = await original<typeof Database>();
  return {
    ...module,
    prisma: new Proxy(module.prisma, {
      get(target, key) {
        if (context.tx && key === "$transaction")
          return async (action: unknown) =>
            typeof action === "function"
              ? action(context.tx)
              : Promise.all(action as Promise<unknown>[]);
        const client = context.tx ?? target;
        const value = Reflect.get(client, key);
        return typeof value === "function" ? value.bind(client) : value;
      },
    }),
  };
});

const rollback = new Error("ROLLBACK_TERM_IN_USE_TEST");

async function inRollback(run: (c: string, actor: string) => Promise<void>) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local database required");
  const actual = await vi.importActual<typeof Database>("@evflow/database");
  let completed = false;
  try {
    await actual.prisma.$transaction(
      async (tx) => {
        context.tx = tx;
        const c = randomUUID(),
          actor = randomUUID();
        await prisma.company.create({ data: { id: c, name: "TERM IN USE TEST ONLY" } });
        await prisma.user.create({
          data: { id: actor, email: `${actor}@test.local`, displayName: "T", passwordHash: "x" },
        });
        await ensureTestTermList(prisma, c, actor);
        await run(c, actor);
        completed = true;
        throw rollback;
      },
      { timeout: 120_000 },
    );
  } catch (error) {
    if (error !== rollback) throw error;
  } finally {
    context.tx = null;
  }
  expect(completed).toBe(true);
}

const service = new AdministrationService(new AuditService());
type Term = { code: string; label: string; days: number; kind: string };

describe("Termin & Kredit: terms used by customers", () => {
  it("refuses to remove or recode a term used by customers, and allows unused changes", async () => {
    await inRollback(async (c, actor) => {
      const terms = operationalPolicyCatalog.find((p) => p.code === "OPS-FLX-03")!
        .default as Term[];
      const tempo = terms.find((t) => t.kind === "TEMPO")!;
      for (const n of [1, 2])
        await prisma.customer.create({
          data: {
            companyId: c,
            code: randomUUID(),
            name: `P${n}`,
            normalizedName: `p${n}${randomUUID()}`,
            state: "ACTIVE",
            defaultTermCode: tempo.code,
            createdById: actor,
            updatedById: actor,
          },
        });
      const version = () =>
        prisma.policyVersion.count({ where: { policy: { companyId: c, code: "OPS-FLX-03" } } });
      const save = async (value: Term[]) =>
        service.updatePolicy(c, actor, "OPS-FLX-03", await version(), { value });

      await expect(save(terms.filter((t) => t.code !== tempo.code))).rejects.toMatchObject({
        status: 409,
        message: "PAYMENT_TERM_IN_USE:2",
      });
      await expect(
        save(terms.map((t) => (t.code === tempo.code ? { ...t, code: "BARU" } : t))),
      ).rejects.toMatchObject({ status: 409 });
      // Editing label/days of the same code and adding a term stay allowed.
      await save([
        ...terms.map((t) => (t.code === tempo.code ? { ...t, label: "Diganti" } : t)),
        { code: "BARU2", label: "Baru", days: 10, kind: "TEMPO" },
      ]);
      // A term no customer uses can be removed.
      await save(terms.filter((t) => t.code !== "BARU2").map((t) => ({ ...t, label: t.label })));
    });
  });
});
