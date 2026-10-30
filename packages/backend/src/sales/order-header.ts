import { ConflictException } from "@nestjs/common";
import type { CreateSalesOrderInput } from "@evflow/contracts";
import type { Prisma } from "@evflow/database";
import { activePolicyValue } from "../common/policy-value";
import { paymentTerms } from "./customer-credit";
import { requireEvidence } from "./document-controls";
import { nextDocumentNumber, previewDocumentNumber } from "../common/document-number";

type Tx = Prisma.TransactionClient;
type Customer = {
  shippingAddress: string | null;
  primaryAddress: string | null;
  defaultTermCode: string | null;
};

export async function orderSettings(tx: Tx, companyId: string) {
  const [warehouseCode, lineWarehouseEnabled, referenceRequired, evidenceRequired] =
    await Promise.all(
      ["OPS-FLX-10", "OPS-FLX-11", "OPS-FLX-12", "OPS-FLX-13"].map((code) =>
        activePolicyValue(tx, companyId, code),
      ),
    );
  return {
    warehouseCode: typeof warehouseCode === "string" ? warehouseCode : null,
    lineWarehouseEnabled: lineWarehouseEnabled === true,
    referenceRequired: referenceRequired === true,
    evidenceRequired: evidenceRequired === true,
  };
}

function settingError(code: string, message: string): never {
  const error = new ConflictException({ code, message, settings_href: "/setting/sales" });
  error.message = code;
  throw error;
}

export async function validateOrderEvidence(
  tx: Tx,
  companyId: string,
  reference: string | null | undefined,
  evidenceId: string | null | undefined,
) {
  const settings = await orderSettings(tx, companyId);
  if (settings.referenceRequired && !reference?.trim())
    settingError("ORDER_REFERENCE_REQUIRED", "Isi No. SP pelanggan sesuai pengaturan penjualan.");
  if (settings.evidenceRequired && !evidenceId)
    settingError(
      "SALES_ORDER_EVIDENCE_REQUIRED",
      "Tambahkan lampiran sesuai pengaturan penjualan.",
    );
  if (evidenceId) await requireEvidence(tx, companyId, evidenceId, "SALES_ORDER");
}

export async function resolveOrderHeader(
  tx: Tx,
  companyId: string,
  actorId: string,
  input: CreateSalesOrderInput,
  customer: Customer,
  options: { deferEvidence?: boolean } = {},
) {
  const company = await tx.company.findUniqueOrThrow({ where: { id: companyId } });
  const day =
    input.order_date ??
    new Intl.DateTimeFormat("en-CA", {
      timeZone: company.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const paymentTermCode = input.payment_term_code ?? customer.defaultTermCode;
  if (
    paymentTermCode &&
    !(await paymentTerms(tx, companyId)).some((t) => t.code === paymentTermCode)
  )
    settingError(
      "ORDER_PAYMENT_TERM_UNKNOWN",
      "Termin tidak tersedia. Periksa Setting Termin & Kredit.",
    );
  const salespersonId = input.salesperson_id ?? actorId;
  if (
    !(await tx.companyMembership.findFirst({
      where: {
        companyId,
        userId: salespersonId,
        active: true,
        deletedAt: null,
        user: { active: true },
      },
    }))
  )
    throw new ConflictException("ORDER_SALESPERSON_INVALID");
  const settings = await orderSettings(tx, companyId);
  const warehouses = await tx.warehouse.findMany({
    where: { companyId },
    select: { id: true, code: true, state: true },
  });
  const active = warehouses.filter((w) => w.state === "ACTIVE");
  const selected = input.warehouse_id
    ? warehouses.find((w) => w.id === input.warehouse_id)
    : settings.warehouseCode
      ? warehouses.find((w) => w.code === settings.warehouseCode)
      : active.length === 1
        ? active[0]
        : undefined;
  if (!selected && !input.warehouse_id && !settings.warehouseCode)
    settingError("ORDER_WAREHOUSE_REQUIRED", "Pilih gudang atau atur gudang bawaan penjualan.");
  if (!selected || selected.state !== "ACTIVE")
    settingError("ORDER_WAREHOUSE_INACTIVE", "Gudang pilihan tidak tersedia atau tidak aktif.");
  const lineWarehouseIds = input.lines.map((line) => {
    if (!line.warehouse_id) return null;
    if (!settings.lineWarehouseEnabled)
      settingError(
        "ORDER_LINE_WAREHOUSE_DISABLED",
        "Gudang per barang belum diaktifkan di Setting.",
      );
    if (!active.some((w) => w.id === line.warehouse_id))
      settingError("ORDER_WAREHOUSE_INACTIVE", "Gudang barang tidak tersedia atau tidak aktif.");
    return line.warehouse_id;
  });
  const customerReference = input.customer_reference?.trim() || null;
  const evidenceId = input.evidence_id ?? null;
  if (!options.deferEvidence)
    await validateOrderEvidence(tx, companyId, customerReference, evidenceId);
  return {
    orderDate: new Date(day),
    paymentTermCode,
    salespersonId,
    warehouseId: selected.id,
    lineWarehouseIds,
    deliveryAddress:
      input.delivery_address?.trim() || customer.shippingAddress || customer.primaryAddress || null,
    customerReference,
    evidenceId,
  };
}

/**
 * SO number: the Setting sequence by default. A number typed by the user must be unique in the
 * company; typing exactly the suggested number consumes the sequence so it is not offered again.
 */
export async function resolveOrderNumber(tx: Tx, companyId: string, requested?: string | null) {
  if (!requested) return nextDocumentNumber(tx, companyId, "sales_order");
  const suggested = await previewDocumentNumber(tx, companyId, "sales_order");
  const number =
    suggested === requested ? await nextDocumentNumber(tx, companyId, "sales_order") : requested;
  if (
    number !== requested ||
    (await tx.salesOrder.findFirst({ where: { companyId, number }, select: { id: true } }))
  )
    throw new ConflictException({
      code: "ORDER_NUMBER_TAKEN",
      message: `Nomor ${requested} sudah dipakai SO lain. Gunakan nomor lain.`,
    });
  return number;
}
