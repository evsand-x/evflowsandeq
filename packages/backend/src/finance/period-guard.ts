import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@evflow/database";

type Tx = Prisma.TransactionClient;

/** Caller supplies the business date after company-timezone normalization. */
export async function assertFinancePeriodOpen(tx: Tx, companyId: string, date: Date) {
  const periods = await tx.financePeriod.findMany({
    where: { companyId, startsOn: { lte: date }, endsOn: { gte: date } },
  });
  if (periods.length !== 1 || periods[0]!.state !== "OPEN")
    throw new ConflictException("FINANCE_PERIOD_NOT_OPEN");
  return periods[0]!;
}

/** Read-only warning for non-posting documents; absence is not a closed period. */
export async function isFinancePeriodClosed(
  db: Tx,
  companyId: string,
  date: Date,
): Promise<boolean> {
  return (
    (await db.financePeriod.count({
      where: { companyId, startsOn: { lte: date }, endsOn: { gte: date }, state: "CLOSED" },
    })) > 0
  );
}
