import { describe, expect, it } from "vitest";
import { effectivePermissionSummary, type Role } from "./iam";

describe("ringkasan hak akses efektif", () => {
  it("menggabungkan dua peran tanpa menggandakan hak yang sama", () => {
    const roles: Role[] = [
      {
        id: "sales",
        code: "SALES",
        name: "Sales",
        description: null,
        active: true,
        member_count: 1,
        permissions: [
          { permission_id: "a", code: "crm.read", scope_type: "company", scope_id: null },
          { permission_id: "b", code: "crm.create", scope_type: "company", scope_id: null },
        ],
      },
      {
        id: "manager",
        code: "MANAGER",
        name: "Manajer",
        description: null,
        active: true,
        member_count: 1,
        permissions: [
          { permission_id: "a", code: "crm.read", scope_type: "company", scope_id: null },
          { permission_id: "c", code: "user.read", scope_type: "company", scope_id: null },
        ],
      },
    ];
    const summary = effectivePermissionSummary(roles, ["sales", "manager"]);
    expect(summary.find((item) => item.module === "Sales & Marketing")?.labels).toEqual([
      "CRM: Buat (perusahaan)",
      "CRM: Lihat (perusahaan)",
    ]);
    expect(summary.find((item) => item.module === "Setting")?.labels).toEqual([
      "Pengguna: Lihat (perusahaan)",
    ]);
  });
});
