import { ConflictException } from "@nestjs/common";
import type { Prisma } from "@evflow/database";
import { nextDocumentNumber } from "../common/document-number";

export async function requireEvidence(
  tx: Prisma.TransactionClient,
  companyId: string,
  id: string | undefined,
  purpose: string,
) {
  if (!id || !(await tx.transactionEvidence.findFirst({ where: { id, companyId, purpose } })))
    throw new ConflictException(`${purpose}_EVIDENCE_REQUIRED`);
}

export async function issueDocument(
  tx: Prisma.TransactionClient,
  companyId: string,
  actorId: string,
  batchId: string,
  kind: string,
  snapshot: unknown,
) {
  const existing = await tx.fulfillmentDocument.findUnique({
    where: { companyId_batchId_kind: { companyId, batchId, kind } },
  });
  if (existing) return existing;
  const sourceNumber = kind.startsWith("INVOICE")
    ? (snapshot as { number?: string })?.number
    : undefined;
  const number =
    sourceNumber ??
    (await nextDocumentNumber(
      tx,
      companyId,
      `document_${kind.split(":")[0]!.replace("_REVISION", "")}`,
    ));
  return tx.fulfillmentDocument.create({
    data: {
      companyId,
      batchId,
      kind,
      issuedById: actorId,
      number,
      snapshot: JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,
    },
  });
}
