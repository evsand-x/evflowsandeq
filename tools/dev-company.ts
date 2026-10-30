import { prisma } from "../packages/database/src";

/** Dev tools act only on the dummy company created by the local seed, whatever its editable name. */
export async function assertFictitiousCompany(companyId: string) {
  const marker = await prisma.auditEvent.count({
    where: { companyId, action: "development_seed.company_created" },
  });
  if (!marker) throw new Error("FICTITIOUS_COMPANY_REQUIRED");
}
