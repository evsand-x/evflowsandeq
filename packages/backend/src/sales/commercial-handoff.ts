import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { prisma, type Prisma } from "@evflow/database";
import { z } from "zod";
import { AuditService } from "../common/audit.service";
import { transactionCommand } from "../common/transaction-command";
import { proformaStatus } from "./proforma";

export const handoffSchema = z
  .object({
    delivered_at: z.string().datetime(),
    delivered_by: z.string().trim().min(1).max(200),
    recipient: z.string().trim().min(1).max(200),
    medium: z.enum(["IN_PERSON", "COURIER", "EMAIL", "OTHER"]),
    evidence_id: z.string().uuid(),
    promise_date: z.string().date().nullable().optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();
export type CommercialKind = "proforma" | "invoice";
async function document(
  tx: Pick<Prisma.TransactionClient, "fulfillmentDocument" | "salesInvoice">,
  c: string,
  kind: CommercialKind,
  id: string,
) {
  const row =
    kind === "proforma"
      ? await tx.fulfillmentDocument.findFirst({
          where: { companyId: c, id, kind: { startsWith: "PROFORMA" } },
          select: { id: true },
        })
      : await tx.salesInvoice.findFirst({
          where: { companyId: c, id },
          select: { id: true, state: true },
        });
  if (!row) throw new NotFoundException();
  return row;
}
export async function listHandoffs(c: string, kind: CommercialKind, id: string) {
  await document(prisma, c, kind, id);
  return prisma.auditEvent.findMany({
    where: {
      companyId: c,
      resourceType: `commercial_${kind}`,
      resourceId: id,
      action: "commercial_document.handed_over",
    },
    orderBy: { occurredAt: "desc" },
    select: { id: true, occurredAt: true, metadata: true },
  });
}
export async function saveHandoff(
  c: string,
  actor: string,
  kind: CommercialKind,
  id: string,
  body: unknown,
  key: string,
) {
  const input = handoffSchema.parse(body);
  if (new Date(input.delivered_at).getTime() > Date.now())
    throw new BadRequestException("Tanggal penyerahan tidak boleh di masa depan.");
  return transactionCommand(
    c,
    actor,
    `commercial-handoffs/${kind}/${id}`,
    key,
    input,
    async (tx) => {
      if (kind === "invoice") {
        await tx.$queryRaw`SELECT id FROM sales_invoices WHERE id=${id}::uuid AND company_id=${c}::uuid FOR UPDATE`;
      } else {
        const source = await tx.fulfillmentDocument.findFirst({
          where: { companyId: c, id, kind: { startsWith: "PROFORMA" } },
        });
        if (!source) throw new NotFoundException();
        await tx.$queryRaw`SELECT id FROM fulfillment_batches WHERE id=${source.batchId}::uuid AND company_id=${c}::uuid FOR UPDATE`;
        if ((await proformaStatus(c, source)) !== "ISSUED")
          throw new ConflictException("Hanya Proforma aktif yang dapat diserahkan.");
      }
      const row = await document(tx, c, kind, id);
      if (
        kind === "invoice" &&
        "state" in row &&
        !["POSTED", "PARTIALLY_PAID", "PAID"].includes(String(row.state))
      )
        throw new ConflictException("Invoice harus diposting sebelum tukar faktur.");
      const evidence = await tx.transactionEvidence.findFirst({
        where: {
          id: input.evidence_id,
          companyId: c,
          purpose: kind === "invoice" ? "INVOICE_HANDOFF" : "PROFORMA_HANDOFF",
        },
      });
      if (!evidence) throw new ConflictException("Bukti terima dokumen wajib dilampirkan.");
      const event = await new AuditService().recordWith(tx, {
        companyId: c,
        actorId: actor,
        action: "commercial_document.handed_over",
        resourceType: `commercial_${kind}`,
        resourceId: id,
        metadata: input,
      });
      return { id: event.id };
    },
  );
}
