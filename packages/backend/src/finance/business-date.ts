import type { Prisma } from "@evflow/database";
type Tx = Prisma.TransactionClient;
// Date-only input represents the company business day. Convert local noon to an instant
// so posting's company-zone conversion retains that date even outside UTC+ offsets.
export async function businessInstant(tx: Tx, c: string, day: string) {
  const { timezone } = await tx.company.findUniqueOrThrow({ where: { id: c } });
  let result = new Date(`${day}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(result);
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
  const local = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
  result = new Date(result.getTime() - (local - result.getTime()));
  return result;
}
