import type * as Database from "@evflow/database";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { prisma, type Prisma } from "@evflow/database";
import { AuditService } from "../../packages/backend/src/common/audit.service";
import { MasterController } from "../../packages/backend/src/master/master.controller";
import { MasterService } from "../../packages/backend/src/master/master.service";
import { DiscountLimitController } from "../../packages/backend/src/sales/discount-limit.controller";
import { REQUIRED_PERMISSIONS } from "../../packages/backend/src/identity/permissions.decorator";
import {
  memberDiscountLimit,
  setRoleDiscountLimit,
  setUserDiscountLimit,
} from "../../packages/backend/src/sales/discount-limit";
import type { AuthenticatedRequest } from "../../packages/backend/src/identity/auth.types";

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

const rollback = new Error("ROLLBACK_DISCOUNT_LIMIT_TEST");
type Fixture = { c: string; actor: string; roleId: string; productId: string };

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
  await prisma.company.create({ data: { id: c, name: "DISCOUNT LIMIT TEST ONLY" } });
  await prisma.user.create({
    data: { id: actor, email: `${actor}@test.local`, displayName: "Test", passwordHash: "x" },
  });
  const membership = await prisma.companyMembership.create({
    data: { companyId: c, userId: actor },
  });
  const role = await prisma.role.create({
    data: { companyId: c, code: "SALES_TEST", name: "Sales" },
  });
  await prisma.userRole.create({
    data: { companyId: c, membershipId: membership.id, roleId: role.id, assignedById: actor },
  });
  const category = await prisma.productCategory.create({
    data: {
      companyId: c,
      code: "K",
      normalizedName: "k",
      name: "K",
      state: "ACTIVE",
      createdById: actor,
      updatedById: actor,
    },
  });
  const uom = await prisma.uom.create({
    data: {
      companyId: c,
      code: "PCS",
      normalizedName: "pcs",
      name: "Pcs",
      state: "ACTIVE",
      createdById: actor,
      updatedById: actor,
    },
  });
  const name = `Produk ${randomUUID()}`;
  const product = await prisma.product.create({
    data: {
      companyId: c,
      code: randomUUID(),
      name,
      normalizedName: name.toLowerCase(),
      categoryId: category.id,
      baseUomId: uom.id,
      state: "ACTIVE",
      createdById: actor,
      updatedById: actor,
    },
  });
  return { c, actor, roleId: role.id, productId: product.id };
}

function request(c: string, actor: string, codes: string[], admin = false) {
  return {
    auth: {
      company_id: c,
      user_id: actor,
      roles: admin ? [{ code: "ADMIN_SYSTEM" }] : [],
      permissions: codes.map((code) => ({ code, scope_type: "company", scope_id: c })),
    },
  } as unknown as AuthenticatedRequest;
}

describe("discount limit settings", () => {
  it("guards the setters with discount_limit.manage and leaves /me open to members", () => {
    const required = (method: keyof DiscountLimitController) =>
      Reflect.getMetadata(REQUIRED_PERMISSIONS, DiscountLimitController.prototype[method]);
    expect(required("role")).toEqual(["discount_limit.manage"]);
    expect(required("user")).toEqual(["discount_limit.manage"]);
    expect(required("mine")).toBeUndefined();
  });

  it("resolves person, role, product cap and admin through /me", async () => {
    await inRollback(async ({ c, actor, roleId, productId }) => {
      const me = (admin = false, product?: string) =>
        memberDiscountLimit(request(c, actor, [], admin).auth, product, admin);
      expect(await me()).toBe("0.0000");
      await setRoleDiscountLimit(c, actor, roleId, "8.5");
      expect(await me()).toBe("8.5000");
      await setUserDiscountLimit(c, actor, actor, "2");
      expect(await me()).toBe("2.0000");
      await prisma.product.update({ where: { id: productId }, data: { discountLimit: "1.5" } });
      expect(await me(false, productId)).toBe("1.5000");
      expect(await me(true, productId)).toBe("UNLIMITED");
      await setUserDiscountLimit(c, actor, actor, null);
      expect(await me()).toBe("8.5000");
      await expect(setRoleDiscountLimit(c, actor, roleId, "100.1")).rejects.toThrow();
      expect(
        await prisma.auditEvent.count({
          where: { companyId: c, action: "role.discount_limit.updated" },
        }),
      ).toBe(1);
    });
  });

  it("changes a product cap only with discount_limit.manage", async () => {
    await inRollback(async ({ c, actor, productId }) => {
      const controller = new MasterController(new MasterService(new AuditService()));
      const current = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
      const body = {
        name: current.name,
        category_id: current.categoryId,
        base_uom_id: current.baseUomId,
        version: current.version,
        discount_limit: "3",
      };
      await expect(
        controller.updateProduct(productId, body, request(c, actor, ["master_product.update"])),
      ).rejects.toThrow(/batas diskon/i);
      await controller.updateProduct(
        productId,
        body,
        request(c, actor, ["master_product.update", "discount_limit.manage"]),
      );
      expect(
        (
          await prisma.product.findUniqueOrThrow({ where: { id: productId } })
        ).discountLimit?.toFixed(4),
      ).toBe("3.0000");
    });
  });
});
