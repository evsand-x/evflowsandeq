import { createHash, randomUUID } from "node:crypto";
import { ConflictException } from "@nestjs/common";
import { prisma, type Prisma } from "@evflow/database";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  return value;
}

/** Replay snapshot and transaction effects commit together. No cache window permits a second posting. */
export function transactionCommand<T>(
  companyId: string,
  actorId: string,
  route: string,
  key: string | undefined,
  input: unknown,
  action: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const commandKey = key ?? randomUUID();
  const requestHash = createHash("sha256")
    .update(JSON.stringify(canonical(input)))
    .digest("hex");
  return prisma.$transaction(
    async (tx) => {
      const identity = { companyId, actorId, route, key: commandKey };
      const lock = JSON.stringify(identity);
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lock}, 0))::text`;
      const old = await tx.transactionCommand.findUnique({
        where: { companyId_actorId_route_key: identity },
      });
      if (old) {
        if (old.requestHash !== requestHash)
          throw new ConflictException("IDEMPOTENCY_PAYLOAD_MISMATCH");
        // HTTP contracts contain decimal strings and ISO timestamps. The replay returns that exact wire snapshot.
        return old.response as T;
      }
      const result = await action(tx);
      const response = JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue;
      await tx.transactionCommand.create({ data: { ...identity, requestHash, response } });
      return result;
    },
    { maxWait: 15000, timeout: 30000 },
  );
}
