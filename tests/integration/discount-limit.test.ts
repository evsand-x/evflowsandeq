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
  rowVersion,
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
  it("lets only Admin Sistem set role and person limits, even for a discount_limit.manage holder", async () => {
    await inRollback(async ({ c, actor, roleId }) => {
      const guardsOf = (method: "role" | "user") =>
        Reflect.getMetadata("__guards__", DiscountLimitController.prototype[method]) as Array<
          new () => { canActivate(context: unknown): boolean }
        >;
      const passes = (method: "role" | "user", admin: boolean) =>
        guardsOf(method).every((Guard) =>
          new Guard().canActivate({
            switchToHttp: () => ({
              getRequest: () => request(c, actor, ["discount_limit.manage"], admin),
            }),
          }),
        );
      for (const method of ["role", "user"] as const) {
        expect(
          Reflect.getMetadata(REQUIRED_PERMISSIONS, DiscountLimitController.prototype[method]),
        ).toEqual(["discount_limit.manage"]);
        expect(() => passes(method, false)).toThrowError(expect.objectContaining({ status: 403 }));
        expect(passes(method, true)).toBe(true);
      }
      // /me stays open to every member
      expect(
        Reflect.getMetadata("__guards__", DiscountLimitController.prototype.mine),
      ).toBeUndefined();
      // admin path through the controller succeeds; stale or missing If-Match is rejected
      const controller = new DiscountLimitController();
      const admin = request(c, actor, [], true);
      const version = rowVersion(
        (await prisma.role.findUniqueOrThrow({ where: { id: roleId } })).updatedAt,
      );
      await expect(
        controller.role(roleId, String(version - 1), { discount_limit: "5" }, admin),
      ).rejects.toMatchObject({ status: 412 });
      await expect(
        controller.role(roleId, undefined, { discount_limit: "5" }, admin),
      ).rejects.toMatchObject({
        status: 400,
      });
      await expect(
        controller.role(roleId, `"${version}"`, { discount_limit: "101" }, admin),
      ).rejects.toMatchObject({
        status: 400,
      });
      const saved = await controller.role(roleId, `"${version}"`, { discount_limit: "5" }, admin);
      expect(saved.data.discount_limit).toBe("5.0000");
      expect(saved.data.version).not.toBe(version);
      const membership = await prisma.companyMembership.findFirstOrThrow({
        where: { companyId: c, userId: actor },
      });
      const own = await controller.user(
        actor,
        String(rowVersion(membership.updatedAt)),
        { discount_limit: "7" },
        admin,
      );
      expect(own.data.discount_limit).toBe("7.0000");
    });
  });

  it("resolves person, role, product cap and admin through /me", async () => {
    await inRollback(async ({ c, actor, roleId, productId }) => {
      const me = (admin = false, product?: string) =>
        memberDiscountLimit(request(c, actor, [], admin).auth, product, admin);
      expect(await me()).toBe("0.0000");
      const roleV = async () =>
        rowVersion((await prisma.role.findUniqueOrThrow({ where: { id: roleId } })).updatedAt);
      const userV = async () =>
        rowVersion(
          (
            await prisma.companyMembership.findFirstOrThrow({
              where: { companyId: c, userId: actor },
            })
          ).updatedAt,
        );
      await setRoleDiscountLimit(c, actor, roleId, "8.5", await roleV());
      expect(await me()).toBe("8.5000");
      await setUserDiscountLimit(c, actor, actor, "2", await userV());
      expect(await me()).toBe("2.0000");
      await prisma.product.update({ where: { id: productId }, data: { discountLimit: "1.5" } });
      expect(await me(false, productId)).toBe("1.5000");
      expect(await me(true, productId)).toBe("UNLIMITED");
      await setUserDiscountLimit(c, actor, actor, null, await userV());
      expect(await me()).toBe("8.5000");
      await expect(
        setRoleDiscountLimit(c, actor, roleId, "100.1", await roleV()),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        setRoleDiscountLimit(c, actor, roleId, "5", (await roleV()) - 1),
      ).rejects.toMatchObject({ status: 412 });
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
