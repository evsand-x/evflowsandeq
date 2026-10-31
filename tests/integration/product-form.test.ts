import type * as Database from "@evflow/database";
import { randomUUID } from "node:crypto";
import { prisma, type Prisma } from "@evflow/database";
import { createProductSchema, updateProductSchema } from "@evflow/contracts";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { MasterService } from "../../packages/backend/src/master/master.service";

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

const rollback = new Error("ROLLBACK_PRODUCT_FORM_TEST");
type Fixture = { c: string; actor: string; categoryId: string; box: string; pcs: string };

async function inRollback(run: (fixture: Fixture) => Promise<void>) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(process.env.DATABASE_URL!).hostname))
    throw new Error("Local database required");
  const actual = await vi.importActual<typeof Database>("@evflow/database");
  let completed = false;
  try {
    await actual.prisma.$transaction(
      async (tx) => {
        context.tx = tx;
        await run(await setup());
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

async function setup(): Promise<Fixture> {
  const c = randomUUID(),
    actor = randomUUID();
  await prisma.company.create({ data: { id: c, name: "PRODUCT FORM TEST ONLY" } });
  await prisma.user.create({
    data: { id: actor, email: `${actor}@test.local`, displayName: "Test", passwordHash: "x" },
  });
  await prisma.companyMembership.create({ data: { companyId: c, userId: actor } });
  const ref = { companyId: c, state: "ACTIVE" as const, createdById: actor, updatedById: actor };
  const category = await prisma.productCategory.create({
    data: { ...ref, code: "BMHP", name: "Bahan Medis Habis Pakai", normalizedName: "bmhp-uji" },
  });
  const box = await prisma.uom.create({
    data: { ...ref, code: "BOX", name: "Box", normalizedName: "box-uji" },
  });
  const pcs = await prisma.uom.create({
    data: { ...ref, code: "PCS", name: "Pcs", normalizedName: "pcs-uji" },
  });
  return { c, actor, categoryId: category.id, box: box.id, pcs: pcs.id };
}

const input = (f: Fixture, extra: Record<string, unknown> = {}) =>
  createProductSchema.parse({
    code: "SPU-003",
    name: "Spuit 3 ml Uji",
    category_id: f.categoryId,
    base_uom_id: f.box,
    storage_notes: "Simpan kering.",
    storage_profile: { min_temp: "2", max_temp: "30" },
    ...extra,
  });

describe("product form backend", () => {
  const service = new MasterService(new AuditService());

  it("creates with a manual code, conversions and an optional permit with evidence", async () =>
    inRollback(async (f) => {
      const evidence = await prisma.transactionEvidence.create({
        data: {
          companyId: f.c,
          actorId: f.actor,
          purpose: "PRODUCT_MASTER",
          originalName: "izin.png",
          objectKey: `transactions/${f.c}/izin.png`,
          sha256: "x",
          sizeBytes: 1,
        },
      });
      const product = await service.createProduct(
        f.c,
        f.actor,
        input(f, {
          uoms: [{ uom_id: f.pcs, factor_to_base: "0.01" }],
          permit_type: "AKD",
          permit_number: "AKD 20303123456",
          permit_holder: "PT Uji Pemegang Izin",
          permit_evidence_object_key: evidence.id,
          purchase_price: "125000",
          sale_price: "150000",
        }),
      );
      expect(product.code).toBe("SPU-003");
      const uoms = await prisma.productUom.findMany({ where: { productId: product.id } });
      expect(uoms.map((u) => [u.uomId, u.factorToBase.toString()]).sort()).toEqual(
        [
          [f.box, "1"],
          [f.pcs, "0.01"],
        ].sort(),
      );
      expect(product.registrations[0]).toMatchObject({
        permitType: "AKD",
        status: "PENDING",
        evidenceObjectKey: evidence.id,
      });
      expect(product.referencePrices).toHaveLength(2);
      // Kode yang sama ditolak.
      await expect(
        service.createProduct(f.c, f.actor, input(f, { name: "Spuit 5 ml Uji" })),
      ).rejects.toThrow("PRODUCT_CODE_TAKEN");
    }));

  it("rejects the base unit as a conversion and evidence without a permit", async () =>
    inRollback(async (f) => {
      await expect(
        service.createProduct(
          f.c,
          f.actor,
          input(f, { uoms: [{ uom_id: f.box, factor_to_base: "1" }] }),
        ),
      ).rejects.toThrow("PRODUCT_UOM_INVALID");
      await expect(
        service.createProduct(f.c, f.actor, input(f, { permit_evidence_object_key: randomUUID() })),
      ).rejects.toThrow("BUKTI_IZIN_EDAR_TIDAK_VALID");
    }));

  it("activates without a marketing permit once storage and shelf life are complete", async () =>
    inRollback(async (f) => {
      const product = await service.createProduct(f.c, f.actor, input(f));
      await expect(
        service.changeState(f.c, f.actor, "products", product.id, product.version, "ACTIVE"),
      ).rejects.toThrow("PRODUK_SHELF_LIFE_REQUIRED");
      const withShelf = await service.updateProduct(f.c, f.actor, product.id, {
        ...updateProductSchema.parse({ ...input(f), version: product.version }),
        shelf_life_days: 730,
      });
      const active = await service.changeState(
        f.c,
        f.actor,
        "products",
        product.id,
        withShelf.version,
        "ACTIVE",
      );
      expect(active).toMatchObject({ state: "ACTIVE" });
    }));

  it("lets a draft change its code but locks it once active", async () =>
    inRollback(async (f) => {
      const product = await service.createProduct(
        f.c,
        f.actor,
        input(f, { batch_required: false, expiry_required: false }),
      );
      const renamed = await service.updateProduct(
        f.c,
        f.actor,
        product.id,
        updateProductSchema.parse({
          ...input(f, { batch_required: false, expiry_required: false }),
          code: "SPU-003A",
          version: product.version,
        }),
      );
      expect(renamed.code).toBe("SPU-003A");
      const active = (await service.changeState(
        f.c,
        f.actor,
        "products",
        product.id,
        renamed.version,
        "ACTIVE",
      )) as { version: number };
      await expect(
        service.updateProduct(
          f.c,
          f.actor,
          product.id,
          updateProductSchema.parse({
            ...input(f, { batch_required: false, expiry_required: false }),
            code: "SPU-009",
            version: active.version,
          }),
        ),
      ).rejects.toThrow("PRODUCT_CODE_LOCKED");
    }));

  it("adds an optional permit from the edit form as pending", async () =>
    inRollback(async (f) => {
      const product = await service.createProduct(f.c, f.actor, input(f));
      const updated = await service.updateProduct(
        f.c,
        f.actor,
        product.id,
        updateProductSchema.parse({
          ...input(f),
          version: product.version,
          permit_type: "AKL",
          permit_number: "AKL 20901234567",
          permit_holder: "PT Uji Pemegang Izin",
          permit_status: "VALID",
        }),
      );
      expect(updated.registrations).toHaveLength(1);
      expect(updated.registrations[0]).toMatchObject({
        permitType: "AKL",
        status: "PENDING",
      });
      // Tanpa isian izin tidak ada registrasi baru.
      const again = await service.updateProduct(
        f.c,
        f.actor,
        product.id,
        updateProductSchema.parse({ ...input(f), version: updated.version }),
      );
      expect(again.registrations).toHaveLength(1);
    }));

  it("requires lot tracking before expiry can be required", () => {
    const base = {
      code: "X1",
      name: "Uji",
      category_id: randomUUID(),
      base_uom_id: randomUUID(),
    };
    expect(
      createProductSchema.safeParse({ ...base, batch_required: false, expiry_required: true })
        .success,
    ).toBe(false);
    expect(
      createProductSchema.safeParse({ ...base, batch_required: false, expiry_required: false })
        .success,
    ).toBe(true);
    expect(createProductSchema.safeParse({ ...base, code: "spu 3" }).success).toBe(false);
  });
});
