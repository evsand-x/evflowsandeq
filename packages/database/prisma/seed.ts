import { assertDevelopmentSeed } from "./dev-seed-guard";
import { Prisma, PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import policyCatalog from "../src/data/operational-policies.json";

const prisma = new PrismaClient();
const scrypt = promisify(scryptCallback);

async function hashDevelopmentPassword(password: string) {
  const salt = randomBytes(16);
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString("base64url")}:${derivedKey.toString("base64url")}`;
}

async function main() {
  assertDevelopmentSeed();
  const company = await prisma.company.upsert({
    where: { id: "00000000-0000-4000-8000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-4000-8000-000000000001",
      name: "PT LIVIANA DWI BERKAT",
    },
  });

  const developmentPassword = process.env.DEV_SEED_ADMIN_PASSWORD;
  const passwordHash = developmentPassword
    ? await hashDevelopmentPassword(developmentPassword)
    : "TEST_ACCOUNT_DISABLED_PASSWORD_HASH";

  const user = await prisma.user.upsert({
    where: { id: "00000000-0000-4000-8000-000000000002" },
    update: {
      email: "admin.test@evflow.local",
      displayName: "Admin Uji Fiktif",
      ...(developmentPassword ? { passwordHash, passwordUpdatedAt: new Date() } : {}),
    },
    create: {
      id: "00000000-0000-4000-8000-000000000002",
      email: "admin.test@evflow.local",
      displayName: "Admin Uji Fiktif",
      passwordHash,
    },
  });

  // Fictitious marker: dev tools refuse companies without it, independent of the editable name.
  if (
    !(await prisma.auditEvent.count({
      where: { companyId: company.id, action: "development_seed.company_created" },
    }))
  )
    await prisma.auditEvent.create({
      data: {
        companyId: company.id,
        actorId: user.id,
        action: "development_seed.company_created",
        resourceType: "company",
        resourceId: company.id,
        reason: "DATA UJI FIKTIF — perusahaan dummy database development lokal",
      },
    });

  const membership = await prisma.companyMembership.upsert({
    where: { companyId_userId: { companyId: company.id, userId: user.id } },
    update: { active: true },
    create: {
      id: "00000000-0000-4000-8000-000000000003",
      companyId: company.id,
      userId: user.id,
    },
  });

  const permissions = [
    ["account.read", "account", "read"],
    ["account.create", "account", "create"],
    ["account.update", "account", "update"],
    ["account.import", "account", "import"],
    ["tax_master.read", "tax_master", "read"],
    ["tax_master.create", "tax_master", "create"],
    ["tax_master.update", "tax_master", "update"],
    ["tax_output.read", "tax_output", "read"],
    ["tax_output.update", "tax_output", "update"],
    ["tax_input.read", "tax_input", "read"],
    ["tax_input.update", "tax_input", "update"],
    ["sales_backorder.read", "sales_backorder", "read"],
    ["warehouse_allocation.read", "warehouse_allocation", "read"],
    ["proforma.read", "proforma", "read"],
    ["crm_prospect.read", "crm_prospect", "read"],
    ["crm_prospect.create", "crm_prospect", "create"],
    ["crm_prospect.update", "crm_prospect", "update"],
    ["crm_contact.read", "crm_contact", "read"],
    ["crm_contact.create", "crm_contact", "create"],
    ["crm_contact.update", "crm_contact", "update"],
    ["crm_opportunity.read", "crm_opportunity", "read"],
    ["crm_opportunity.create", "crm_opportunity", "create"],
    ["crm_opportunity.update", "crm_opportunity", "update"],
    ["crm_activity.read", "crm_activity", "read"],
    ["crm_activity.create", "crm_activity", "create"],
    ["crm_quote.read", "crm_quote", "read"],
    ["crm_quote.create", "crm_quote", "create"],
    ["crm_customer_order.create", "crm_customer_order", "create"],
    ["crm_customer_order.update", "crm_customer_order", "update"],
    ["master_product.read", "master_product", "read"],
    ["master_product.create", "master_product", "create"],
    ["master_product.update", "master_product", "update"],
    ["master_product.activate", "master_product", "activate"],
    ["master_customer.read", "master_customer", "read"],
    ["master_customer.create", "master_customer", "create"],
    ["master_customer.update", "master_customer", "update"],
    ["master_customer.activate", "master_customer", "activate"],
    ["master_supplier.read", "master_supplier", "read"],
    ["master_supplier.create", "master_supplier", "create"],
    ["master_supplier.update", "master_supplier", "update"],
    ["master_supplier.activate", "master_supplier", "activate"],
    ["master_vendor.read", "master_vendor", "read"],
    ["master_vendor.create", "master_vendor", "create"],
    ["master_vendor.update", "master_vendor", "update"],
    ["master_vendor.activate", "master_vendor", "activate"],
    ["master_warehouse.read", "master_warehouse", "read"],
    ["master_warehouse.create", "master_warehouse", "create"],
    ["master_warehouse.update", "master_warehouse", "update"],
    ["master_warehouse.activate", "master_warehouse", "activate"],
    ["master_locator.read", "master_locator", "read"],
    ["master_locator.create", "master_locator", "create"],
    ["master_locator.update", "master_locator", "update"],
    ["master_locator.activate", "master_locator", "activate"],
    ["master_operational_item.read", "master_operational_item", "read"],
    ["master_operational_item.create", "master_operational_item", "create"],
    ["master_operational_item.update", "master_operational_item", "update"],
    ["master_operational_item.activate", "master_operational_item", "activate"],
    ["master_product_category.read", "master_product_category", "read"],
    ["master_product_category.create", "master_product_category", "create"],
    ["master_product_category.update", "master_product_category", "update"],
    ["master_product_category.activate", "master_product_category", "activate"],
    ["master_uom.read", "master_uom", "read"],
    ["master_uom.create", "master_uom", "create"],
    ["master_uom.update", "master_uom", "update"],
    ["master_uom.activate", "master_uom", "activate"],
    ["master_customer_channel.read", "master_customer_channel", "read"],
    ["master_customer_channel.create", "master_customer_channel", "create"],
    ["master_customer_channel.update", "master_customer_channel", "update"],
    ["master_customer_channel.activate", "master_customer_channel", "activate"],
    ["master_rayon.read", "master_rayon", "read"],
    ["master_rayon.create", "master_rayon", "create"],
    ["master_rayon.update", "master_rayon", "update"],
    ["master_rayon.activate", "master_rayon", "activate"],
    ["crm_customer.read", "crm_customer", "read"],
    ["crm_customer.create", "crm_customer", "create"],
    ["outbound_picking.read", "outbound_picking", "read"],
    ["outbound_checking.read", "outbound_checking", "read"],
    ["outbound_shipping.read", "outbound_shipping", "read"],
    ["delivery_receipt.read", "delivery_receipt", "read"],
    ["dashboard_executive.read", "dashboard_executive", "read"],
    ["dashboard_sales.read", "dashboard_sales", "read"],
    ["dashboard_warehouse.read", "dashboard_warehouse", "read"],
    ["dashboard_finance.read", "dashboard_finance", "read"],
    ["dashboard_hris.read", "dashboard_hris", "read"],
    ["dashboard_actions.read", "dashboard_actions", "read"],
    ["dashboard_reports.read", "dashboard_reports", "read"],
    ["company_profile.read", "company_profile", "read"],
    ["company_profile.update", "company_profile", "update"],
    ["user.read", "user", "read"],
    ["user.create", "user", "create"],
    ["user.update", "user", "update"],
    ["user.role.assign", "user_role", "assign"],
    ["role.read", "role", "read"],
    ["role.create", "role", "create"],
    ["role.update", "role", "update"],
    ["role.delete", "role", "delete"],
    ["user.delete", "user", "delete"],
    ["role.permission.update", "role_permission", "update"],
    ["permission.read", "permission", "read"],
    ["operational_policy.read", "operational_policy", "read"],
    ["operational_policy.update", "operational_policy", "update"],
    ["audit_event.read", "audit_event", "read"],
    ["setting_general.read", "setting_general", "read"],
    ["setting_general.update", "setting_general", "update"],
    ["tax_setting.read", "tax_setting", "read"],
    ["tax_setting.update", "tax_setting", "update"],
    ["terms_credit.read", "terms_credit", "read"],
    ["terms_credit.update", "terms_credit", "update"],
    ["deduction_type.read", "deduction_type", "read"],
    ["deduction_type.manage", "deduction_type", "manage"],
    ["account_mapping.read", "account_mapping", "read"],
    ["account_mapping.manage", "account_mapping", "manage"],
    ["bank_account.manage", "bank_account", "manage"],
    ["customer_credit.update", "customer_credit", "update"],
    ["discount_limit.manage", "discount_limit", "manage"],
    ["special_price.approve", "special_price", "approve"],
  ] as const;

  for (const [code, resource, action] of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: { resource, action },
      create: { code, resource, action, description: "Milestone 1 permission" },
    });
  }

  const roleCodes = [
    "ADMIN_SYSTEM",
    "SALES",
    "SALES_SUPERVISOR",
    "WAREHOUSE",
    "PURCHASING_LOGISTICS",
    "FINANCE",
    "HR",
    "LEADERSHIP",
  ] as const;
  let adminRoleId = "";
  for (const roleCode of roleCodes) {
    const role = await prisma.role.upsert({
      where: { companyId_code: { companyId: company.id, code: roleCode } },
      update: {},
      create: {
        companyId: company.id,
        code: roleCode,
        name: `${roleCode} — DATA UJI FIKTIF`,
      },
    });

    if (roleCode === "ADMIN_SYSTEM") adminRoleId = role.id;

    if (roleCode === "ADMIN_SYSTEM" || roleCode === "FINANCE") {
      await prisma.userRole.upsert({
        where: { membershipId_roleId: { membershipId: membership.id, roleId: role.id } },
        update: {},
        create: { companyId: company.id, membershipId: membership.id, roleId: role.id },
      });
    }
  }

  const allPermissions = await prisma.permission.findMany({
    where: { code: { in: permissions.map(([code]) => code) } },
    select: { id: true },
  });
  const existingGrants = await prisma.rolePermission.findMany({
    where: { roleId: adminRoleId, scopeType: "company", scopeId: null },
  });
  await prisma.rolePermission.createMany({
    data: allPermissions
      .filter((p) => !existingGrants.some((g) => g.permissionId === p.id))
      .map((permission) => ({
        companyId: company.id,
        roleId: adminRoleId,
        permissionId: permission.id,
        scopeType: "company",
      })),
    skipDuplicates: true,
  });

  for (const definition of policyCatalog) {
    const policy = await prisma.systemPolicy.upsert({
      where: { companyId_code: { companyId: company.id, code: definition.code } },
      update: {
        name: definition.name,
        ownerDomain: definition.domain,
        policyGroup: definition.group,
        scope: "company",
        valueType: definition.type,
        unit: definition.unit,
        validationSchema: definition.schema,
        defaultValueSnapshot: definition.default ?? Prisma.JsonNull,
      },
      create: {
        companyId: company.id,
        code: definition.code,
        name: definition.name,
        ownerDomain: definition.domain,
        policyGroup: definition.group,
        scope: "company",
        valueType: definition.type,
        unit: definition.unit,
        validationSchema: definition.schema,
        defaultValueSnapshot: definition.default ?? Prisma.JsonNull,
      },
    });

    const versionCount = await prisma.policyVersion.count({ where: { policyId: policy.id } });
    if (versionCount === 0) {
      await prisma.policyVersion.create({
        data: {
          policyId: policy.id,
          versionNo: 1,
          valueSnapshot: definition.default ?? Prisma.JsonNull,
          state: "ACTIVE",
          savedById: user.id,
        },
      });
    }
  }

  const referenceSeeds = [
    ["productCategory", "NEM-STERILE", "Non Elektromedik Steril"],
    ["productCategory", "NEM-NONSTERILE", "Non Elektromedik Non Steril"],
    ["productCategory", "EM-NONRAD", "Elektromedik Non Radiasi"],
    ["productCategory", "IVD", "Diagnostik In Vitro"],
    ["uom", "PCS", "Pcs"],
    ["uom", "BOX", "Box"],
    ["customerChannel", "RS-PEMERINTAH", "RS Pemerintah"],
    ["customerChannel", "RS-SWASTA", "RS Swasta"],
    ["customerChannel", "APOTEK-KLINIK", "Apotek/Klinik"],
    ["customerChannel", "LABORATORIUM", "Laboratorium"],
    ["customerChannel", "DINAS", "Dinas Kesehatan"],
    ["rayon", "PUSAT", "Pusat"],
  ] as const;
  for (const [kind, code, name] of referenceSeeds) {
    const normalizedName = name.toLocaleLowerCase("id-ID").replace(/\s+/g, " ");
    if (kind === "productCategory") {
      await prisma.productCategory.upsert({
        where: { companyId_code: { companyId: company.id, code } },
        update: {},
        create: {
          companyId: company.id,
          code,
          name,
          normalizedName,
          createdById: user.id,
          updatedById: user.id,
        },
      });
    } else if (kind === "uom") {
      await prisma.uom.upsert({
        where: { companyId_code: { companyId: company.id, code } },
        update: {},
        create: {
          companyId: company.id,
          code,
          name,
          normalizedName,
          createdById: user.id,
          updatedById: user.id,
        },
      });
    } else if (kind === "customerChannel") {
      await prisma.customerChannel.upsert({
        where: { companyId_code: { companyId: company.id, code } },
        update: {},
        create: {
          companyId: company.id,
          code,
          name,
          normalizedName,
          createdById: user.id,
          updatedById: user.id,
        },
      });
    } else {
      await prisma.rayon.upsert({
        where: { companyId_code: { companyId: company.id, code } },
        update: {},
        create: {
          companyId: company.id,
          code,
          name,
          normalizedName,
          createdById: user.id,
          updatedById: user.id,
        },
      });
    }
  }
  const warehouse = await prisma.warehouse.upsert({
    where: { companyId_code: { companyId: company.id, code: "WH-UTAMA" } },
    update: {},
    create: {
      companyId: company.id,
      code: "WH-UTAMA",
      name: "Gudang Utama — DATA UJI FIKTIF",
      normalizedName: "gudang utama — data uji fiktif",
      timezone: company.timezone,
      state: "ACTIVE",
      createdById: user.id,
      updatedById: user.id,
    },
  });
  await prisma.locator.upsert({
    where: { warehouseId_code: { warehouseId: warehouse.id, code: "STORAGE-A" } },
    update: {},
    create: {
      companyId: company.id,
      warehouseId: warehouse.id,
      code: "STORAGE-A",
      name: "Rak Penyimpanan A — DATA UJI FIKTIF",
      normalizedName: "rak penyimpanan a — data uji fiktif",
      locatorType: "STORAGE",
      state: "ACTIVE",
      createdById: user.id,
      updatedById: user.id,
    },
  });

  await prisma.auditEvent.create({
    data: {
      companyId: company.id,
      actorId: user.id,
      action: "development.seed.applied",
      resourceType: "fictitious_test_data",
      metadata: { fictitious_test_data: true, safe_for_production: false },
    },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
