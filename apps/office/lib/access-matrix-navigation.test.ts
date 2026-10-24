import { describe, expect, it } from "vitest";
import {
  matrixPermissionChecked,
  matrixSubtreePermissions,
  matrixSelectionState,
  missingMatrixActionLabel,
  navigationMatrixRows,
  matrixTree,
  visibleMatrixTree,
  toggleMatrixBranch,
} from "./access-matrix-navigation";
import { isMenuAvailable, moduleNavigation } from "./navigation";
import type { Permission } from "./iam";

const permission = (resource: string, action: string): Permission => ({
  id: `${resource}.${action}`,
  code: `${resource}.${action}`,
  resource,
  action,
  description: null,
});

describe("permission matrix navigation", () => {
  it("places Peluang beside Prospek and removes the duplicate customer menu", () => {
    const rows = navigationMatrixRows([
      permission("crm_opportunity", "read"),
      permission("crm_customer", "create"),
    ]);
    expect(
      rows.find((row) => row.path === "Sales & Marketing › CRM › Peluang")?.items[0]?.code,
    ).toBe("crm_opportunity.read");
    expect(rows.some((row) => row.path === "Sales & Marketing › CRM › Pelanggan")).toBe(false);
    expect(rows.find((row) => row.resource === "crm_customer")?.path).toBe(
      "Sales & Marketing › CRM › Prospek › Institusi terkait",
    );
  });
  it("distinguishes inapplicable writes from missing permissions without inventing access", () => {
    const dashboard = { path: "Dashboard › Sales", resource: "dashboard_sales", items: [] };
    expect(missingMatrixActionLabel(dashboard, "post")).toBe("Tidak berlaku");
    expect(missingMatrixActionLabel(dashboard, "read")).toBe("Belum tersedia");
    expect(missingMatrixActionLabel({ ...dashboard, resource: "sales_order" }, "update")).toBe(
      "Belum tersedia",
    );
    expect(missingMatrixActionLabel({ ...dashboard, resource: "unknown" }, "post")).toBe(
      "Belum tersedia",
    );
  });
  it("creates nested parents and preserves catalog identities across shared rows", () => {
    const catalog = [
      permission("crm_prospect", "read"),
      permission("sales_order", "create"),
      permission("master_customer", "read"),
    ];
    const tree = matrixTree(navigationMatrixRows(catalog));
    const all = visibleMatrixTree(tree, {}, () => true);
    expect([...new Set(all.flatMap((row) => row.items).map((p) => p.id))].sort()).toEqual(
      catalog.map((p) => p.id).sort(),
    );
    expect(visibleMatrixTree(tree, {}).every((row) => row.depth === 0)).toBe(true);
    expect(
      all
        .find((row) => row.path === "Sales & Marketing › Pesanan Pelanggan")
        ?.children.some((row) => row.label === "Sales Order"),
    ).toBe(true);
    expect(tree.find((row) => row.label === "Master Data")?.items).toEqual([]);
  });
  it("keeps submenu grants independent and aggregates children only for selection", () => {
    const catalog = ["crm_prospect", "crm_contact", "crm_customer", "master_customer"].flatMap(
      (resource) => ["read", "create"].map((action) => permission(resource, action)),
    );
    const rows = navigationMatrixRows(catalog);
    const ids = rows.flatMap((row) => row.items.map((p) => p.id));
    expect(ids).toHaveLength(catalog.length);
    expect(new Set(ids).size).toBe(catalog.length);
    const tree = matrixTree(rows);
    const crm = tree
      .find((row) => row.label === "Sales & Marketing")!
      .children.find((row) => row.label === "CRM")!;
    expect(crm.items).toEqual([]);
    const childPermissions = matrixSubtreePermissions(crm);
    expect(childPermissions).toHaveLength(6);
    expect(matrixSelectionState(childPermissions, (p) => p.code === "crm_contact.read")).toBe(
      "indeterminate",
    );
    expect(matrixSelectionState(childPermissions, () => true)).toBe(true);
    expect(matrixSelectionState(childPermissions, () => false)).toBe(false);
    expect(
      matrixPermissionChecked(false, "crm_contact.read", [], { "crm_prospect.read": true }),
    ).toBe(false);
    expect(
      matrixPermissionChecked(false, "master_customer.read", [], { "crm_customer.read": true }),
    ).toBe(false);
  });
  it("closes sibling branches and descendants without touching permission drafts", () => {
    const state = { "Sales & Marketing": true, "Sales & Marketing › CRM": true, Finance: false };
    const opened = toggleMatrixBranch(state, "Sales & Marketing › Pesanan Pelanggan", false);
    expect(opened["Sales & Marketing › CRM"]).toBe(false);
    expect(opened["Sales & Marketing"]).toBe(true);
    const switched = toggleMatrixBranch(opened, "Finance", false);
    expect(switched["Sales & Marketing"]).toBe(false);
    expect(switched["Sales & Marketing › Pesanan Pelanggan"]).toBe(false);
    expect(switched.Finance).toBe(true);
    expect(state["Sales & Marketing › CRM"]).toBe(true);
  });
  it("reveals ancestors of filtered matches and permits collapsing search results", () => {
    const tree = matrixTree(navigationMatrixRows([permission("sales_order", "create")]));
    const match = (row: { items: Permission[] }) =>
      row.items.some((p) => p.code === "sales_order.create");
    expect(visibleMatrixTree(tree, {}, match).map((row) => row.label)).toEqual([
      "Sales & Marketing",
      "Pesanan Pelanggan",
      "Sales Order",
    ]);
    expect(
      visibleMatrixTree(tree, { "Sales & Marketing": false }, match).map((row) => row.label),
    ).toEqual(["Sales & Marketing"]);
  });
  it("follows every Office menu group and keeps catalog permissions on a single row", () => {
    const catalog = [
      permission("sales_order", "read"),
      permission("user", "delete"),
      permission("unmapped_feature", "read"),
    ];
    const rows = navigationMatrixRows(catalog);
    // CFG-10: every working menu has a row.
    const alias: Record<string, string> = {
      // Opens the customer master, whose credit attributes have their own row (customer_credit).
      "Finance › Kredit & TOP Pelanggan": "Master Data › Pelanggan › Kredit & Termin",
    };
    for (const module of moduleNavigation)
      for (const item of module.items.filter((i) => isMenuAvailable(module.label, i))) {
        const path = alias[`${module.label} › ${item}`] ?? `${module.label} › ${item}`;
        expect(rows.some((row) => row.path === path || row.path.startsWith(`${path} ›`))).toBe(
          true,
        );
      }
    expect(rows.every((row) => row.resource)).toBe(true);
    expect(rows.find((row) => row.path.endsWith("Pesanan Pelanggan › Sales Order"))?.items).toEqual(
      [catalog[0]],
    );
    expect(rows.find((row) => row.path === "Setting › Pengguna")?.items).toEqual([catalog[1]]);
    expect(rows.at(-1)?.path).toBe("Fitur lain › unmapped feature");
    expect(rows.flatMap((row) => row.items)).toHaveLength(catalog.length);
  });

  it("shows Admin Sistem capabilities as checked without stored grants", () => {
    expect(matrixPermissionChecked(true, "permission-id", [], {})).toBe(true);
    expect(matrixPermissionChecked(false, "permission-id", [], {})).toBe(false);
    expect(matrixPermissionChecked(false, "permission-id", [], { "permission-id": true })).toBe(
      true,
    );
  });
  it("maps every operational Dashboard view to a separate editable read capability", () => {
    const catalog = [
      permission("dashboard_sales", "read"),
      permission("dashboard_executive", "read"),
    ];
    const rows = navigationMatrixRows(catalog);
    expect(rows.find((row) => row.path === "Dashboard › Sales")?.items).toEqual([catalog[0]]);
    expect(rows.find((row) => row.path === "Dashboard › Ringkasan Eksekutif")?.items).toEqual([
      catalog[1],
    ]);
  });
});
