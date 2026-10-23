import { describe, expect, it, vi } from "vitest";
import type { AuthPrincipal } from "@evflow/contracts";
vi.mock("@evflow/database", () => ({ Prisma: {}, prisma: {} }));
import {
  updateLocatorSchema,
  updateOperationalItemSchema,
  updateReferenceMasterSchema,
} from "@evflow/contracts";
import {
  duplicateCheckSchema,
  listResourceSchema,
  masterListSchema,
  masterWhere,
  workspaceResourceSchema,
} from "../../packages/backend/src/master/master-workspace";
import {
  hasResourcePermission,
  resourcePermissionCode,
} from "../../packages/backend/src/identity/resource-permissions";

const rule = { family: "master", action: "read", source: "params", key: "resource" } as const;

describe("master data workspace", () => {
  it("keeps company scope and whitelisted filters", () => {
    const q = masterListSchema.parse({ q: "Medika", state: "ACTIVE" });
    expect(masterWhere("company-a", "suppliers", q)).toEqual({
      companyId: "company-a",
      state: "ACTIVE",
      OR: [
        { code: { contains: "Medika", mode: "insensitive" } },
        { name: { contains: "Medika", mode: "insensitive" } },
      ],
    });
    expect(masterListSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(masterListSchema.safeParse({ sort: "name" }).success).toBe(false);
  });

  it("applies the warehouse filter only to locators", () => {
    const parent = "00000000-0000-4000-8000-000000000001";
    const q = masterListSchema.parse({ parent });
    expect(masterWhere("c", "locators", q)).toMatchObject({ warehouseId: parent });
    expect(masterWhere("c", "suppliers", q)).not.toHaveProperty("warehouseId");
  });

  it("serves only resources without their own workspace", () => {
    expect(workspaceResourceSchema.safeParse("suppliers").success).toBe(true);
    expect(workspaceResourceSchema.safeParse("customers").success).toBe(false);
    expect(duplicateCheckSchema.safeParse({ name: "PT" }).success).toBe(true);
    expect(duplicateCheckSchema.safeParse({ name: "PT", company_id: "x" }).success).toBe(false);
  });

  it("lists products by category and keeps reference codes immutable", () => {
    const parent = "00000000-0000-4000-8000-000000000002";
    expect(listResourceSchema.safeParse("products").success).toBe(true);
    expect(workspaceResourceSchema.safeParse("products").success).toBe(false);
    expect(masterWhere("c", "products", masterListSchema.parse({ parent }))).toMatchObject({
      categoryId: parent,
    });
    expect(updateReferenceMasterSchema.safeParse({ name: "Box", version: 1 }).success).toBe(true);
    expect(
      updateReferenceMasterSchema.safeParse({ code: "BX", name: "Box", version: 1 }).success,
    ).toBe(false);
    expect(
      updateLocatorSchema.safeParse({
        name: "Rak A",
        locator_type: "STORAGE",
        warehouse_id: parent,
        version: 1,
      }).success,
    ).toBe(false);
    expect(
      updateOperationalItemSchema.safeParse({
        name: "Kertas",
        kind: "SUPPLY",
        category: "ATK",
        base_uom_id: parent,
        version: 1,
      }).success,
    ).toBe(false);
  });

  it("keeps submenu permissions independent", () => {
    expect(resourcePermissionCode(rule, "uoms")).toBe("master_uom.read");
    expect(resourcePermissionCode(rule, "rayons")).toBe("master_rayon.read");
    expect(resourcePermissionCode(rule, "suppliers")).toBe("master_supplier.read");
    expect(resourcePermissionCode(rule, "vendors")).toBe("master_vendor.read");
    const auth = {
      company_id: "a",
      roles: [],
      permissions: [{ code: "master_vendor.read", scope_type: "company", scope_id: "a" }],
    } as AuthPrincipal;
    expect(hasResourcePermission(auth, "master_vendor.read")).toBe(true);
    expect(hasResourcePermission(auth, "master_supplier.read")).toBe(false);
    auth.permissions[0]!.scope_id = "b";
    expect(hasResourcePermission(auth, "master_vendor.read")).toBe(false);
  });
});
