import { createHash } from "node:crypto";
import { prisma } from "@evflow/database";
import { NotFoundException, PreconditionFailedException } from "@nestjs/common";

const select = {
  baseCurrency: true,
  timezone: true,
  fiscalYearStartMonth: true,
  fiscalYearStartDay: true,
  profileVersion: true,
} as const;
type Row = {
  baseCurrency: string;
  timezone: string;
  fiscalYearStartMonth: number;
  fiscalYearStartDay: number;
  profileVersion: number;
};

const serialize = (c: Row) => ({
  base_currency: c.baseCurrency,
  timezone: c.timezone,
  fiscal_year_start_month: c.fiscalYearStartMonth,
  fiscal_year_start_day: c.fiscalYearStartDay,
  version: c.profileVersion,
});
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export async function getGeneralSettings(companyId: string) {
  const company = await prisma.company.findUnique({ where: { id: companyId }, select });
  if (!company) throw new NotFoundException("Perusahaan tidak ditemukan.");
  return serialize(company);
}

/** Saves under the company profile version, so a stale form gets 412; base currency is never writable. */
export async function updateGeneralSettings(
  companyId: string,
  actorId: string,
  expectedVersion: number,
  input: { timezone: string; fiscal_year_start_month: number; fiscal_year_start_day: number },
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.company.findUnique({ where: { id: companyId }, select });
    if (!before) throw new NotFoundException("Perusahaan tidak ditemukan.");
    const result = await tx.company.updateMany({
      where: { id: companyId, profileVersion: expectedVersion },
      data: {
        timezone: input.timezone,
        fiscalYearStartMonth: input.fiscal_year_start_month,
        fiscalYearStartDay: input.fiscal_year_start_day,
        profileVersion: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new PreconditionFailedException("Pengaturan telah berubah.");
    const after = await tx.company.findUniqueOrThrow({ where: { id: companyId }, select });
    await tx.auditEvent.create({
      data: {
        companyId,
        actorId,
        action: "company_general.updated",
        resourceType: "company",
        resourceId: companyId,
        beforeHash: hash(serialize(before)),
        afterHash: hash(serialize(after)),
      },
    });
    return serialize(after);
  });
}
