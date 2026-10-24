import { PrismaClient } from "@prisma/client";

const prismaGlobal = globalThis as unknown as { evflowPrisma?: PrismaClient };

export const prisma =
  prismaGlobal.evflowPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.evflowPrisma = prisma;
}

export * from "@prisma/client";
export {
  activatePolicyVersion,
  activatePolicyVersionInTransaction,
  activateDuePolicyVersions,
  PolicyVersionConflictError,
} from "./policy-version";

export {
  chartOfAccounts,
  numberingDefaults,
  operationalPolicyCatalog,
  taxDefaults,
  type NumberingDefault,
  type TaxDefault,
  type ChartAccountData,
  type PolicyCatalogEntry,
} from "./defaults";
