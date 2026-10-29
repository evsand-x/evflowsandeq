import { NotFoundException } from "@nestjs/common";
import { prisma, Prisma } from "@evflow/database";
import { orderView } from "./order-view";
import { proformaBatchInclude, proformaSource, matchesProformaSource } from "./proforma";
import type { OrderPermission } from "./order-related";
import { availablePrepayFunds } from "./prepay-funds";
import { assertPriceGrants } from "./pricing-controls";
import { assertDispatchLots } from "./transaction-controls";
import { ConflictException } from "@nestjs/common";
export type OrderAction = {
  code: string;
  label: string;
  enabled: boolean;
  reason: string | null;
  target: { batchId?: string; pickListId?: string; advanceId?: string };
};
export async function orderActions(
  c: string,
  a: string,
  id: string,
  can: OrderPermission,
  db: Prisma.TransactionClient = prisma,
) {
  const order = await db.salesOrder.findFirst({
    where: { companyId: c, id },
    include: {
      lines: { include: { allocations: true } },
      fulfillments: {
        orderBy: { number: "asc" },
        include: { ...proformaBatchInclude, pickList: true },
      },
    },
  });
  if (!order) throw new NotFoundException();
  const documents = await db.fulfillmentDocument.findMany({
    where: { companyId: c, batchId: { in: order.fulfillments.map((b) => b.id) } },
    orderBy: [{ issuedAt: "desc" }, { id: "desc" }],
  });
  const invoices = can("sales_invoice.issue")
    ? await db.salesInvoice.findMany({
        where: { companyId: c, salesOrderId: id, state: { in: ["POSTED", "ISSUED_WAITING_POD"] } },
        select: { fulfillmentBatchId: true },
      })
    : [];
  const actions: OrderAction[] = [];
  const add = (
    code: string,
    label: string,
    permission: string | string[],
    enabled: boolean,
    reason: string,
    target: OrderAction["target"] = {},
  ) => {
    if ((Array.isArray(permission) ? permission : [permission]).some(can))
      actions.push({ code, label, enabled, reason: enabled ? null : reason, target });
  };
  const open = order.state === "OPEN",
    draft = order.state === "DRAFT";
  const free = order.lines.some((l) =>
    l.orderedQuantity.sub(l.allocatedQuantity).sub(l.closedQuantity).gt(0),
  );
  add("submit", "Ajukan", "sales_order.submit", draft, "Hanya pesanan draf yang dapat diajukan.");
  let proforma = order.fulfillments.find(
    (b) =>
      b.state === "ALLOCATED" &&
      b.allocations.some((x) => x.quantity.gt(0)) &&
      !documents.some((d) => d.batchId === b.id && d.kind.startsWith("PROFORMA")),
  );
  // Existing matching documents are not a new issuance; revisions remain available.
  if (!proforma && can("proforma.issue"))
    for (const b of order.fulfillments.filter((b) => b.state === "ALLOCATED")) {
      const doc = documents.find((d) => d.batchId === b.id && d.kind.startsWith("PROFORMA"));
      if (doc && !matchesProformaSource(doc.snapshot, proformaSource(b))) {
        proforma = b;
        break;
      }
    }
  let proformaReason = "Belum ada alokasi baru atau proforma yang perlu diperbarui.";
  let proformaReady = open && !!proforma;
  if (proformaReady && proforma && can("proforma.issue")) {
    try {
      const source = proformaSource(proforma);
      if (
        proforma.reservationExpiresAt &&
        proforma.reservationExpiresAt <= new Date() &&
        (
          await availablePrepayFunds(db, c, {
            id: proforma.id,
            salesOrderId: id,
            currency: order.currency,
          })
        ).lt(source.snapshot.total)
      ) {
        proformaReady = false;
        proformaReason = "Reservasi barang sudah kedaluwarsa. Cek ulang stok terlebih dahulu.";
      }
      await assertPriceGrants(
        db,
        c,
        proforma.allocations.filter((x) => x.quantity.gt(0)).map((x) => x.salesOrderLine),
      );
      await assertDispatchLots(
        db,
        c,
        proforma.allocations.filter((x) => x.quantity.gt(0)).map((x) => x.stockLotId),
      );
    } catch (e) {
      if (!(e instanceof ConflictException)) throw e;
      proformaReady = false;
      proformaReason = "Harga atau kelayakan stok perlu diperiksa sebelum menerbitkan proforma.";
    }
  }
  add(
    "issue_proforma",
    "Buat Proforma",
    "proforma.issue",
    proformaReady,
    proformaReason,
    proforma ? { batchId: proforma.id } : {},
  );
  const picking = order.fulfillments.find(
    (b) => b.state === "ALLOCATED" && !b.pickList && b.allocations.some((x) => x.quantity.gt(0)),
  );
  add(
    "create_picking",
    "Buat Pick Slip",
    "fulfillment.pick",
    !!picking,
    "Belum ada alokasi barang yang siap diambil.",
    picking ? { batchId: picking.id } : {},
  );
  const pick = order.fulfillments.find(
    (b) =>
      b.state === "ALLOCATED" &&
      b.pickList &&
      ((b.pickList.state === "OPEN" && can("fulfillment.pick") && can("outbound_picking.read")) ||
        (b.pickList.state === "PICKED" &&
          can("fulfillment.check") &&
          can("outbound_checking.read")) ||
        (b.pickList.state === "CHECKED" &&
          can("fulfillment.dispatch") &&
          can("outbound_shipping.read"))),
  );
  add(
    "open_picking",
    pick?.pickList?.state === "CHECKED" ? "Buat Surat Jalan" : "Proses Pick Slip",
    ["fulfillment.pick", "fulfillment.check", "fulfillment.dispatch"],
    !!pick,
    "Belum ada Pick Slip yang dapat diproses dengan izin Anda.",
    pick ? { batchId: pick.id, pickListId: pick.pickList!.id } : {},
  );
  const pod = order.fulfillments.find((b) =>
    ["DISPATCHED", "PARTIALLY_DELIVERED"].includes(b.state),
  );
  add(
    "confirm_pod",
    "Catat Barang Diterima",
    "delivery_receipt.confirm",
    !!pod && can("delivery_receipt.read"),
    "Belum ada pengiriman yang menunggu penerimaan, atau akses halaman penerimaan belum diberikan.",
    pod ? { batchId: pod.id } : {},
  );
  const invoice = order.fulfillments.find(
    (b) =>
      b.state === "ALLOCATED" &&
      b.pickList?.state === "CHECKED" &&
      documents.some((d) => d.batchId === b.id && d.kind === "PACKING") &&
      !invoices.some((i) => i.fulfillmentBatchId === b.id),
  );
  add(
    "issue_invoice",
    "Buat Invoice",
    "sales_invoice.issue",
    !!invoice,
    "Belum ada barang yang selesai diperiksa dengan Packing List untuk ditagih.",
    invoice ? { batchId: invoice.id } : {},
  );
  if (can("sales_order_advance.create")) {
    const total = orderView(order).total;
    const recorded = await db.salesOrderAdvance.aggregate({
      where: {
        companyId: c,
        salesOrderId: id,
        state: { in: ["PENDING_VERIFICATION", "VERIFIED"] },
      },
      _sum: { amount: true },
    });
    add(
      "record_advance",
      "Catat Uang Muka",
      "sales_order_advance.create",
      (draft || open) && total !== null && new Prisma.Decimal(total).gt(recorded._sum.amount ?? 0),
      "Uang muka memerlukan pesanan aktif dengan total tersedia dan sisa yang belum dicatat sebagai uang muka.",
    );
  }
  if (can("sales_order_advance.verify")) {
    const advance = await db.salesOrderAdvance.findFirst({
      where: {
        companyId: c,
        salesOrderId: id,
        state: "PENDING_VERIFICATION",
        recordedById: { not: a },
      },
      orderBy: { recordedAt: "asc" },
    });
    add(
      "verify_advance",
      "Verifikasi Uang Muka",
      "sales_order_advance.verify",
      !!advance,
      "Belum ada uang muka dari pengguna lain yang menunggu verifikasi.",
      advance ? { advanceId: advance.id } : {},
    );
  }
  add(
    "reallocate",
    "Cek ulang stok",
    "sales_order.reallocate",
    open && free,
    "Tidak ada sisa pesanan terbuka yang belum dialokasikan.",
  );
  add(
    "close_remainder",
    "Tutup sisa",
    "sales_order.close_remainder",
    (draft || open) && free,
    "Tidak ada sisa yang dapat ditutup; lepaskan alokasi terlebih dahulu.",
  );
  // Release 1: an issued Surat Jalan commits quantities, so the order can no longer be revised.
  const issuedDeliveryNotes = await db.deliveryNote.count({
    where: { companyId: c, salesOrderId: id, state: "ISSUED" },
  });
  add(
    "revise",
    "Ubah",
    "sales_order.update",
    (draft || open) &&
      !issuedDeliveryNotes &&
      !order.fulfillments.some((b) => b.state !== "CANCELLED") &&
      !order.lines.some((l) => l.closedQuantity.gt(0)),
    "Pesanan yang sudah diproses atau ditutup tidak dapat diubah.",
  );
  add("duplicate", "Duplikat", "sales_order.create", true, "");
  add("print", "Cetak", "sales_order.print", true, "");
  return {
    primary:
      actions.find((x) => x.enabled && !["revise", "duplicate", "print"].includes(x.code)) ?? null,
    actions,
  };
}
