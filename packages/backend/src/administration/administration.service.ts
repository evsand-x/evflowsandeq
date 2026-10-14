import { createHash } from "node:crypto";
import type { Prisma } from "@evflow/database";
import {
  activatePolicyVersionInTransaction,
  PolicyVersionConflictError,
  prisma,
} from "@evflow/database";
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PreconditionFailedException,
} from "@nestjs/common";
import { AuditService } from "../common/audit.service";
import { validatePolicyValue } from "./policy-validator";

@Injectable()
export class AdministrationService {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  async getCompanyProfile(companyId: string) {
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException("Perusahaan tidak ditemukan.");
    return this.serializeCompany(company);
  }

  async updateCompanyProfile(
    companyId: string,
    actorId: string,
    expectedVersion: number,
    input: {
      name: string;
      legal_name?: string | null | undefined;
      address?: string | null | undefined;
      phone?: string | null | undefined;
      email?: string | null | undefined;
      logo_object_key?: string | null | undefined;
      tax_identity?: string | null | undefined;
    },
  ) {
    const before = await prisma.company.findUnique({ where: { id: companyId } });
    if (!before) throw new NotFoundException("Perusahaan tidak ditemukan.");
    const updated = await prisma.$transaction(async (transaction) => {
      const result = await transaction.company.updateMany({
        where: { id: companyId, profileVersion: expectedVersion },
        data: {
          name: input.name,
          ...(input.legal_name !== undefined ? { legalName: input.legal_name } : {}),
          ...(input.address !== undefined ? { address: input.address } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.logo_object_key !== undefined ? { logoObjectKey: input.logo_object_key } : {}),
          ...(input.tax_identity !== undefined ? { taxIdentity: input.tax_identity } : {}),
          profileVersion: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new PreconditionFailedException("Profil telah berubah.");
      const company = await transaction.company.findUniqueOrThrow({ where: { id: companyId } });
      await transaction.auditEvent.create({
        data: {
          companyId,
          actorId,
          action: "company_profile.updated",
          resourceType: "company",
          resourceId: companyId,
          beforeHash: this.hash(this.serializeCompany(before)),
          afterHash: this.hash(this.serializeCompany(company)),
        },
      });
      return company;
    });
    return this.serializeCompany(updated);
  }

  async listPolicies(companyId: string, group?: string) {
    const policies = await prisma.systemPolicy.findMany({
      where: { companyId, ...(group ? { policyGroup: group } : {}) },
      orderBy: [{ policyGroup: "asc" }, { code: "asc" }],
      include: {
        versions: {
          where: { state: { in: ["ACTIVE", "SCHEDULED"] } },
          orderBy: { versionNo: "desc" },
          include: { savedBy: { select: { displayName: true } } },
        },
      },
    });
    return policies.map((policy) => this.serializePolicy(policy));
  }

  async getPolicy(companyId: string, code: string) {
    const policy = await prisma.systemPolicy.findUnique({
      where: { companyId_code: { companyId, code } },
      include: {
        versions: {
          where: { state: { in: ["ACTIVE", "SCHEDULED"] } },
          orderBy: { versionNo: "desc" },
          include: { savedBy: { select: { displayName: true } } },
        },
      },
    });
    if (!policy) throw new NotFoundException("Policy tidak ditemukan.");
    return this.serializePolicy(policy);
  }

  async validatePolicy(
    companyId: string,
    code: string,
    input: {
      value: unknown;
      effective_from?: string | undefined;
      reason?: string | undefined;
      approval_reference?: string | undefined;
    },
  ) {
    const policy = await prisma.systemPolicy.findUnique({
      where: { companyId_code: { companyId, code } },
    });
    if (!policy) throw new NotFoundException("Policy tidak ditemukan.");
    const errors = validatePolicyValue(
      input.value,
      policy.validationSchema as Record<string, unknown>,
    );
    if (policy.requiresReason && !input.reason) {
      errors.push({ field: "reason", message: "Alasan wajib untuk policy ini." });
    }
    if (policy.requiresApproval && !input.approval_reference) {
      errors.push({ field: "approval_reference", message: "Referensi approval wajib." });
    }
    if (input.effective_from && !policy.allowsFutureEffective) {
      errors.push({
        field: "effective_from",
        message: "Policy ini berlaku langsung saat disimpan.",
      });
    }
    return { valid: errors.length === 0, errors };
  }

  async updatePolicy(
    companyId: string,
    actorId: string,
    code: string,
    expectedVersion: number,
    input: {
      value: unknown;
      effective_from?: string | undefined;
      reason?: string | undefined;
      approval_reference?: string | undefined;
    },
  ) {
    const validation = await this.validatePolicy(companyId, code, input);
    if (!validation.valid) throw new BadRequestException(validation);
    const policy = await prisma.systemPolicy.findUnique({
      where: { companyId_code: { companyId, code } },
      include: { versions: { where: { state: "ACTIVE" }, take: 1 } },
    });
    if (!policy) throw new NotFoundException("Policy tidak ditemukan.");
    try {
      await prisma.$transaction(async (transaction) => {
        const created = await activatePolicyVersionInTransaction(transaction, {
          policyId: policy.id,
          valueSnapshot: input.value as Prisma.InputJsonValue,
          savedById: actorId,
          expectedVersion,
          ...(input.effective_from ? { effectiveFrom: new Date(input.effective_from) } : {}),
          ...(input.reason ? { reason: input.reason } : {}),
          ...(input.approval_reference ? { approvalReference: input.approval_reference } : {}),
        });
        await this.audit.recordWith(transaction, {
          companyId,
          actorId,
          action:
            created.state === "SCHEDULED"
              ? "operational_policy.version_scheduled"
              : "operational_policy.version_activated",
          resourceType: "system_policy",
          resourceId: policy.id,
          ...(policy.versions[0] ? { before: policy.versions[0].valueSnapshot } : {}),
          after: input.value,
          ...(input.reason ? { reason: input.reason } : {}),
          metadata: {
            code,
            version_no: created.versionNo,
            state: created.state,
            ...(created.effectiveFrom
              ? { effective_from: created.effectiveFrom.toISOString() }
              : {}),
          },
        });
        return created;
      });
      return this.getPolicy(companyId, code);
    } catch (error) {
      if (error instanceof PolicyVersionConflictError) {
        throw new PreconditionFailedException("Versi policy telah berubah.");
      }
      throw error;
    }
  }

  async requirePolicySnapshot(companyId: string, code: string) {
    const policy = await prisma.systemPolicy.findUnique({
      where: { companyId_code: { companyId, code } },
      include: {
        versions: { where: { state: "ACTIVE" }, orderBy: { versionNo: "desc" }, take: 1 },
      },
    });
    const version = policy?.versions[0];
    if (!policy || !version) {
      throw new ConflictException(`Policy wajib ${code} belum aktif. Hubungi pemilik konfigurasi.`);
    }
    const errors = validatePolicyValue(
      version.valueSnapshot,
      policy.validationSchema as Record<string, unknown>,
    );
    if (errors.length) {
      throw new ConflictException(
        `Policy wajib ${code} belum lengkap. Perbaiki melalui Setting → Kebijakan Operasional.`,
      );
    }
    return {
      policy_id: policy.id,
      code: policy.code,
      version_id: version.id,
      version_no: version.versionNo,
      value: version.valueSnapshot,
      saved_at: version.savedAt.toISOString(),
    };
  }

  private serializeCompany(company: {
    id: string;
    name: string;
    legalName: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    logoObjectKey: string | null;
    taxIdentity: string | null;
    profileVersion: number;
    updatedAt: Date;
  }) {
    return {
      id: company.id,
      name: company.name,
      legal_name: company.legalName,
      address: company.address,
      phone: company.phone,
      email: company.email,
      logo_object_key: company.logoObjectKey,
      tax_identity: company.taxIdentity,
      version: company.profileVersion,
      updated_at: company.updatedAt.toISOString(),
    };
  }

  private serializePolicy(policy: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    policyGroup: string;
    ownerDomain: string;
    valueType: string;
    unit: string | null;
    validationSchema: Prisma.JsonValue;
    defaultValueSnapshot: Prisma.JsonValue;
    requiresReason: boolean;
    requiresApproval: boolean;
    allowsFutureEffective: boolean;
    versions: Array<{
      id: string;
      versionNo: number;
      state: "ACTIVE" | "SCHEDULED" | "RETIRED";
      valueSnapshot: Prisma.JsonValue;
      effectiveFrom: Date | null;
      savedAt: Date;
      savedBy: { displayName: string };
    }>;
  }) {
    const active = policy.versions.find((version) => version.state === "ACTIVE");
    const scheduled = policy.versions.filter((version) => version.state === "SCHEDULED");
    const latestVersionNo = policy.versions.reduce(
      (latest, version) => Math.max(latest, version.versionNo),
      0,
    );
    return {
      id: policy.id,
      code: policy.code,
      name: policy.name,
      description: policy.description,
      group: policy.policyGroup,
      owner_domain: policy.ownerDomain,
      value_type: policy.valueType,
      unit: policy.unit,
      validation_schema: policy.validationSchema,
      default_value: policy.defaultValueSnapshot,
      requires_reason: policy.requiresReason,
      requires_approval: policy.requiresApproval,
      allows_future_effective: policy.allowsFutureEffective,
      latest_version_no: latestVersionNo,
      active_version: active
        ? {
            id: active.id,
            version_no: active.versionNo,
            value: active.valueSnapshot,
            saved_at: active.savedAt.toISOString(),
            saved_by: active.savedBy.displayName,
          }
        : null,
      scheduled_versions: scheduled.map((version) => ({
        id: version.id,
        version_no: version.versionNo,
        value: version.valueSnapshot,
        effective_from: version.effectiveFrom?.toISOString() ?? null,
        saved_at: version.savedAt.toISOString(),
        saved_by: version.savedBy.displayName,
      })),
    };
  }

  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
}
