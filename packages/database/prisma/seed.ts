import { assertDevelopmentSeed } from "./dev-seed-guard";
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import policyCatalog from "./data/operational-policies.json";

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
      name: "PT Sandeq Sarana Medika â€” DATA UJI FIKTIF",
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
    ["role.permission.update", "role_permission", "update"],
    ["permission.read", "permission", "read"],
    ["operational_policy.read", "operational_policy", "read"],
    ["operational_policy.update", "operational_policy", "update"],
    ["audit_event.read", "audit_event", "read"],
    ["master_data.read", "master_data", "read"],
    ["master_data.create", "master_data", "create"],
    ["master_data.update", "master_data", "update"],
    ["master_data.activate", "master_data", "activate"],
    ["crm.read", "crm", "read"],
    ["crm.create", "crm", "create"],
    ["crm.update", "crm", "update"],
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
        name: `${roleCode} â€” DATA UJI FIKTIF`,
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
        defaultValueSnapshot: definition.default,
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
        defaultValueSnapshot: definition.default,
      },
    });

    const versionCount = await prisma.policyVersion.count({ where: { policyId: policy.id } });
    if (versionCount === 0) {
      await prisma.policyVersion.create({
        data: {
          policyId: policy.id,
          versionNo: 1,
          valueSnapshot: definition.default,
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
      name: "Gudang Utama â€” DATA UJI FIKTIF",
      normalizedName: "gudang utama â€” data uji fiktif",
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
      name: "Rak Penyimpanan A â€” DATA UJI FIKTIF",
      normalizedName: "rak penyimpanan a â€” data uji fiktif",
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
