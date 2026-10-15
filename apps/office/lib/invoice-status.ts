import Decimal from "decimal.js";

export function invoicePaymentStatus(invoice: {
  state: string;
  outstandingAmount?: string | null | undefined;
  total?: string | null | undefined;
}): "Lunas" | "Dibayar Sebagian" | "Belum Dibayar" | null {
  if (invoice.state !== "POSTED" || invoice.outstandingAmount == null || invoice.total == null)
    return null;
  try {
    const remaining = new Decimal(invoice.outstandingAmount);
    const total = new Decimal(invoice.total);
    if (!remaining.isFinite() || !total.isFinite() || total.lt(0) || remaining.lt(0) || remaining.gt(total))
      return null;
    if (remaining.isZero()) return "Lunas";
    return remaining.lt(total) ? "Dibayar Sebagian" : "Belum Dibayar";
  } catch {
    return null;
  }
}

export function invoiceDocumentNote(state: string): string | null {
  return ({
    DRAFT: "Draft — belum membentuk piutang",
    ISSUED_WAITING_POD: "Menunggu POD",
    VOID: "Dibatalkan",
  } as Record<string, string>)[state] ?? null;
}
