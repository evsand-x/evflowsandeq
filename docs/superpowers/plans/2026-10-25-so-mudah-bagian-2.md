# SO Mudah — Bagian 2: Detail SO dan Uang Muka Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detail SO bergaya Kledo yang menjawab barang belum terpenuhi, dokumen terkait, dan langkah berikutnya sesuai izin, plus pencatatan uang muka dari SO yang wajib diverifikasi Finance — backend lebih dulu.

**Architecture:** Backend menyediakan tiga model baca untuk detail SO: nilai per baris, dokumen terkait yang difilter izin, dan daftar tindakan (tersedia/terhalang + alasan) yang dihitung dari prasyarat command yang sama. Uang muka dari SO disimpan sebagai `SalesOrderAdvance` berstatus menunggu verifikasi; verifikasi Finance membuat `CustomerReceipt` lewat jalur posting yang sudah ada, sehingga `CustomerReceipt` tetap hanya berisi penerimaan yang sudah diposting. Office hanya merender.

**Tech Stack:** Prisma/PostgreSQL, backend `packages/backend`, zod `@evflow/contracts`, Next.js Office, vitest dengan Postgres nyata.

**Spec:** [docs/superpowers/specs/2026-10-25-so-mudah-design.md](../specs/2026-10-25-so-mudah-design.md) (bagian Detail SO dan Uang muka dari halaman SO). **Bergantung pada:** [rencana bagian 1](2026-10-25-so-mudah-bagian-1.md) (kolom kepala SO, `orderDisplayStatus`, `activePolicyValue`, `assertFinancePeriodOpen`, `resolveOrderHeader`).

## Global Constraints

- Semua Global Constraints bagian 1 berlaku (decimal, kebijakan, otoritas backend, idempotency, copy tanpa istilah teknis, build paket sebelum restart API, validasi repository).
- Izin per submenu: tindakan dan dokumen yang tidak diizinkan **tidak dikirim** dalam respons (bukan hanya disembunyikan di layar).
- Pemisahan tugas: pencatat uang muka tidak boleh memverifikasi catatannya sendiri.
- Uang muka menunggu verifikasi tidak menambah DP, tidak dihitung dana terverifikasi, dan tidak diposting.
- Tidak membuat tombol Bagikan, Kirim WhatsApp, Pemesanan berulang, atau Pengingat jatuh tempo.
- Urutan pemenuhan tidak berubah; "Buat Surat Jalan" membuka Pick Slip yang siap, tidak melompati pengambilan/pemeriksaan.

## Review Focus

1. **Invoice dari Packing List** berstatus `ISSUED_WAITING_POD` (tanpa POD) harus tampil di Transaksi. Test di Task 3.
2. **Pengguna gudang tanpa izin invoice/penerimaan** membuka SO: tidak ada invoice, uang muka, atau tombol Finance di respons. Test di Task 3 dan 4.
3. **Uang muka diverifikasi dua kali bersamaan** (dua tab Finance): hanya satu penerimaan terposting. Test di Task 1.
4. **Uang muka melebihi total SO**: ditolak saat dicatat. Test di Task 1.
5. **Uang muka SO dipakai dua batch bayar-sebelum-kirim**: dana tidak terhitung dua kali. Test di Task 2.

---

### Task 1: Uang muka SO — catat, verifikasi, tolak

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (model baru `SalesOrderAdvance`; `CustomerReceipt` (1521) tambah `salesOrderId String? @db.Uuid`)
- Create: `packages/database/prisma/migrations/20261025200000_sales_order_advance/migration.sql` (termasuk izin baru)
- Modify: `packages/contracts/src/otc-ptp.ts` (skema baru)
- Create: `packages/backend/src/sales/order-advance.ts`
- Modify: `packages/backend/src/otc-ptp.service.ts:1875-1950` (ekstrak inti `createCustomerReceipt`), `packages/backend/src/otc-ptp.controller.ts` (endpoint)
- Modify: `packages/backend/src/sales/order-view.ts` (`downPayment`)
- Test: `tests/integration/sales-order-advance.test.ts` (fixture mengikuti otc-controls.test.ts:72-176)

**Interfaces:**
- Produces (Prisma): `SalesOrderAdvance { id, companyId, salesOrderId, amount Decimal(24,8), currency, receivedAt Date, bankAccountId, bankReference?, evidenceId, state SalesOrderAdvanceState @default(PENDING_VERIFICATION), recordedById, recordedAt, verifiedById?, verifiedAt?, rejectionReason?, customerReceiptId? @unique, version Int @default(1), idempotencyKey }`; enum `SalesOrderAdvanceState { PENDING_VERIFICATION VERIFIED REJECTED }`.
- Produces (izin, ditambahkan migration): `sales_order_advance.create` (submenu Sales Order) dan `sales_order_advance.verify` (Finance), keduanya diberikan hanya kepada peran yang memegang `customer_receipt.post` (hari ini hanya mereka yang dapat mencatat penerimaan); pemberian diaudit.
- Produces (endpoint): `POST /sales-orders/:id/advances` (`sales_order_advance.create`, Idempotency-Key), body `recordSalesOrderAdvanceSchema = { amount, received_at, bank_account_id, bank_reference?, evidence_id }`; `POST /sales-order-advances/:id/verify` (`sales_order_advance.verify`, body `{ version }`); `POST /sales-order-advances/:id/reject` (`sales_order_advance.verify`, body `{ version, reason }`, reason 1-500).
- Produces: `postCustomerReceiptTx(tx, companyId, actorId, input: { customerId, salesOrderId?, fulfillmentBatchId?, amount, receivedAt, bankAccountId, bankReference?, evidenceId, idempotencyKey }): Promise<CustomerReceipt>` — inti posting yang sama dengan `createCustomerReceipt` (debit `CASH_RECEIPT`, kredit `CUSTOMER_ADVANCE`, `postAdvanceTax`, audit `customer_receipt.posted`); `createCustomerReceipt` memanggilnya tanpa perubahan perilaku.
- Produces: `downPayment` = Σ `amount − refundedAmount` dari `CustomerReceipt` POSTED dengan `salesOrderId = SO` atau `fulfillmentBatch.salesOrderId = SO` (menggantikan derivasi bagian 1 Task 5).

Aturan:
- Catat: SO `DRAFT` atau `OPEN`; `amount > 0`; total SO harus ada → selain itu `ORDER_TOTAL_NOT_AVAILABLE`; `amount + Σ uang muka PENDING/VERIFIED SO ≤ total SO` → selain itu `ADVANCE_EXCEEDS_ORDER_TOTAL`; lampiran divalidasi `requireEvidence(tx, c, evidenceId, "PAYMENT")`.
- Verifikasi: kunci baris `FOR UPDATE`; state `PENDING_VERIFICATION` dan versi cocok → selain itu `ADVANCE_STATE_OR_VERSION_CHANGED`; `actor ≠ recordedById` → selain itu `ADVANCE_SELF_VERIFICATION_FORBIDDEN`; `assertFinancePeriodOpen(receivedAt)`; panggil `postCustomerReceiptTx` dengan `salesOrderId`; simpan `customerReceiptId`, `verifiedById`, `verifiedAt`, state `VERIFIED`.
- Tolak: syarat state/versi/bukan pencatat sama; state `REJECTED` + alasan; tanpa posting.
- Audit: `sales_order_advance.recorded|verified|rejected`.

- [ ] **Step 1: Write the failing tests**
  - `records advance pending verification without ledger entry`: tidak ada `LedgerEntry` baru; DP SO tetap `"0"`.
  - `rejects advance above order total` → `ADVANCE_EXCEEDS_ORDER_TOTAL` (Review Focus 4).
  - `verify posts receipt linked to SO and increases down payment`: `CustomerReceipt.salesOrderId` = SO, jurnal `CASH_RECEIPT`/`CUSTOMER_ADVANCE`, DP = jumlah.
  - `recorder cannot verify own advance` → `ADVANCE_SELF_VERIFICATION_FORBIDDEN`.
  - `concurrent verify posts once`: dua `verify` paralel versi sama → satu sukses, satu `ADVANCE_STATE_OR_VERSION_CHANGED` (Review Focus 3).
  - `reject stores reason and posts nothing`.
  - `create requires sales_order_advance.create; verify requires sales_order_advance.verify` → 403.
  - `migration grants new codes only to roles holding customer_receipt.post`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/sales-order-advance.test.ts` → FAIL.
- [ ] **Step 3: Implement** skema, migration, kontrak, `order-advance.ts`, ekstraksi `postCustomerReceiptTx`, endpoint, `downPayment`.
- [ ] **Step 4: Run** test baru + `pnpm vitest run tests/integration/otc-controls.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(sales): record SO advance with mandatory finance verification`

### Task 2: Dana bayar-sebelum-kirim memakai uang muka SO

**Files:**
- Modify: `packages/backend/src/otc-ptp.service.ts:471-489` (cek PREPAY saat dispatch), `packages/backend/src/sales/operations.service.ts:671-688` (`verifiedFunds`), `packages/backend/src/sales/proforma.ts` (cek dana saat reservasi kedaluwarsa)
- Create: `packages/backend/src/sales/prepay-funds.ts`
- Test: `tests/integration/sales-order-advance-prepay.test.ts`

**Interfaces:**
- Produces: `availablePrepayFunds(tx, companyId, batch: { id: string; salesOrderId: string; currency: string }): Promise<Decimal>` = Σ `unallocatedAmount` penerimaan POSTED terikat batch + Σ `unallocatedAmount` penerimaan POSTED dengan `salesOrderId = batch.salesOrderId` dan `fulfillmentBatchId = null`, mata uang sama.
- Produces: `bindOrderAdvancesToBatch(tx, companyId, batch, required: Decimal): Promise<void>` — saat dispatch PREPAY lolos, penerimaan tingkat SO yang dipakai diikat ke batch (`fulfillmentBatchId` diisi, urut `receivedAt`, `id`) dengan kunci `FOR UPDATE`, sehingga batch lain tidak memakainya.

- [ ] **Step 1: Write the failing tests**
  - `prepay dispatch accepts verified SO advance`.
  - `pending advance does not satisfy prepay` → `PREPAYMENT_REQUIRED`.
  - `SO advance bound to first batch is not reused by second batch` → batch kedua `PREPAYMENT_REQUIRED` bila dana habis (Review Focus 5).
  - `proforma verifiedFunds includes unbound SO advance`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/sales-order-advance-prepay.test.ts` → FAIL.
- [ ] **Step 3: Implement** kedua fungsi dan pemakaiannya di tiga tempat.
- [ ] **Step 4: Run** test baru + `manual-proforma.test.ts` + `otc-controls.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(sales): verified SO advances count toward prepay funds`

### Task 3: Dokumen terkait, nilai baris, sisa tagihan

**Files:**
- Create: `packages/backend/src/sales/order-related.ts`
- Modify: `packages/backend/src/sales/operations.service.ts:692-736` (`order()`), `packages/backend/src/sales/operations.controller.ts`
- Test: `tests/integration/order-related-documents.test.ts`

**Interfaces:**
- Produces: `GET /operations/orders/:id/related` (`sales_order.read`) → `RelatedDocument[]` = `{ kind: "PROFORMA"|"PICK_SLIP"|"PACKING_LIST"|"SURAT_JALAN"|"POD"|"INVOICE"|"CREDIT_NOTE"|"ADVANCE", id, number: string, date: string, status: string, amount: string | null, href: string }`, urut tanggal naik.
  - Sumber: Proforma = `FulfillmentDocument` kind `PROFORMA*` dengan status setara `proformaStatus` dihitung dalam satu kueri (bukan transaksi per dokumen); Pick Slip = `PickList` (nomor = dokumen `PICKING` bila ada, selain itu nomor batch; status OPEN/PICKED/CHECKED); Packing List/Surat Jalan = `FulfillmentDocument` `PACKING`/`SURAT_JALAN` (amount `snapshot.total` bila ada); POD = `DeliveryReceipt` (nomor = "POD " + nomor batch); Invoice = `SalesInvoice` dengan `salesOrderId = SO` **termasuk `ISSUED_WAITING_POD`**, amount `total`; Nota kredit = `CreditNote` dari invoice SO; Uang muka = `SalesOrderAdvance`.
  - Filter izin per jenis: Proforma `proforma.read`; Pick Slip `outbound_picking.read`; Packing List `outbound_checking.read`; Surat Jalan `outbound_shipping.read`; POD `delivery_receipt.read` (koreksi eksekusi 26 Oktober: izin independen per submenu sesuai AGENTS.md); Invoice/Nota kredit `sales_invoice.read`; Uang muka `sales_order_advance.create` atau `sales_order_advance.verify` atau `customer_receipt.read`. Jenis tanpa izin tidak dikirim.
- Produces di `order()` per baris: `{ ordered, sent, accepted, closed, remaining, lineStatus }` (string decimal); `remaining = max(0, ordered − closed − accepted)`; `lineStatus`: `closed ≥ ordered` → `CLOSED`; `accepted ≥ ordered − closed` → `DONE`; `sent > accepted` → `IN_DELIVERY`; `allocated > sent` → `READY`; lainnya `WAITING_STOCK`. Baris `remaining > 0` diurutkan di atas.
- Produces di `order()` kepala: `remainingBill` = total SO − Σ `unallocatedAmount` penerimaan POSTED SO − Σ (`total − outstandingAmount`) invoice POSTED SO; `neighbors { previousId, nextId }` menurut `orderDate`, lalu `number`, dalam perusahaan.

- [ ] **Step 1: Write the failing tests**
  - `lists invoice issued from packing list before POD` (Review Focus 1).
  - `omits invoices and advances for warehouse-only user` (Review Focus 2).
  - `computes proforma status without per-document transactions`.
  - `line values and status for partial, returned and closed lines`.
  - `remaining bill does not double count advance allocated to invoice`.
  - `neighbors follow order date then number`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/order-related-documents.test.ts` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(sales): SO related documents, line progress and remaining bill`

### Task 4: Izin cetak, jejak perubahan, dan duplikat

**Files:**
- Create: `packages/database/prisma/migrations/20261025210000_sales_order_print_permission/migration.sql`
- Modify: `packages/backend/src/otc-ptp.controller.ts`, `packages/backend/src/otc-ptp.service.ts` (duplikat), `packages/backend/src/sales/operations.service.ts` (`order()` jejak)
- Test: `tests/integration/sales-order-print-duplicate.test.ts`

**Interfaces:**
- Produces (izin): `sales_order.print`, diberikan migration hanya kepada peran yang memegang `sales_order.read` (hari ini mereka sudah dapat mencetak lewat browser); diaudit.
- Produces: `POST /sales-orders/:id/print-events` (`sales_order.print`) → audit `sales_order.printed`.
- Produces: `POST /sales-orders/:id/duplicate` (`sales_order.create`, Idempotency-Key) → SO DRAFT baru: pelanggan, baris (produk, qty, satuan, gudang baris), No. SP dan lampiran kosong, kepala diresolusi ulang lewat `resolveOrderHeader` (bagian 1), harga dihitung saat diajukan; audit `sales_order.duplicated` dengan id sumber.
- Produces di `order()`: `lastChanged { by: string; at: string } | null` (AuditEvent terbaru SO selain `sales_order.printed`) dan `lastPrinted { by: string; at: string } | null` (AuditEvent `sales_order.printed` terbaru); `by` = `User.displayName`.

- [ ] **Step 1: Write the failing tests**
  - `print event recorded and shown as lastPrinted`.
  - `lastChanged reflects latest SO mutation actor`.
  - `duplicate creates draft with same customer and lines, empty reference and evidence`.
  - `migration grants sales_order.print only to roles holding sales_order.read`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/sales-order-print-duplicate.test.ts` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(sales): SO print permission and tracking, change trail, duplicate`

### Task 5: Daftar tindakan SO berbasis izin dan prasyarat

**Files:**
- Create: `packages/backend/src/sales/order-actions.ts`
- Modify: `packages/backend/src/sales/operations.controller.ts`
- Test: `tests/integration/order-actions.test.ts`

**Interfaces:**
- Consumes: izin `sales_order_advance.*` (Task 1), `sales_order.print` (Task 4).
- Produces: `GET /operations/orders/:id/actions` (`sales_order.read`) → `{ primary: OrderAction | null; actions: OrderAction[] }`, `OrderAction = { code: string; label: string; enabled: boolean; reason: string | null; target: { batchId?: string; pickListId?: string; advanceId?: string } }`.

| code | label | izin | aktif bila |
|---|---|---|---|
| `submit` | Ajukan | `sales_order.submit` | SO DRAFT |
| `issue_proforma` | Buat Proforma | `proforma.issue` | SO OPEN, batch ALLOCATED tanpa proforma aktif atau proforma perlu revisi |
| `create_picking` | Buat Pick Slip | `fulfillment.pick` | batch ALLOCATED tanpa pick slip |
| `open_picking` | Proses Pick Slip / Buat Surat Jalan | `fulfillment.pick`, `fulfillment.check`, atau `fulfillment.dispatch` | pick slip OPEN/PICKED, atau CHECKED dan batch belum dikirim |
| `confirm_pod` | Catat Barang Diterima | `delivery_receipt.confirm` | batch DISPATCHED/PARTIALLY_DELIVERED |
| `issue_invoice` | Buat Invoice | `sales_invoice.issue` | batch dengan pick slip CHECKED tanpa invoice POSTED/ISSUED_WAITING_POD |
| `record_advance` | Catat Uang Muka | `sales_order_advance.create` | SO DRAFT/OPEN dan total tersedia |
| `verify_advance` | Verifikasi Uang Muka | `sales_order_advance.verify` | ada uang muka PENDING yang bukan catatan pengguna |
| `reallocate` | Cek ulang stok | `sales_order.reallocate` | SO OPEN dan sisa > 0 |
| `close_remainder` | Tutup sisa | `sales_order.close_remainder` | SO DRAFT/OPEN dan sisa > 0 |
| `revise` | Ubah | `sales_order.update` | DRAFT, atau OPEN tanpa batch aktif dan tanpa sisa ditutup |
| `duplicate` | Duplikat | `sales_order.create` | selalu |
| `print` | Cetak | `sales_order.print` | selalu |

- Tindakan tanpa izin tidak dimasukkan. Tindakan berizin tetapi terhalang alur: `enabled:false` + `reason` berbahasa awam (mis. "Belum ada barang yang selesai diperiksa untuk ditagih"). `primary` = tindakan aktif pertama menurut urutan tabel, kecuali `revise`, `duplicate`, `print`.

- [ ] **Step 1: Write the failing tests**
  - `admin after submit sees primary create_picking and full ordered list`.
  - `warehouse user sees only picking and POD actions` (Review Focus 2).
  - `recorder does not get verify_advance for own advance`.
  - `blocked issue_invoice carries reason before checking`.
  - Konsistensi: untuk setiap baris tabel, pada SO yang dibentuk lewat command nyata, bila `enabled` maka command terkait berhasil; bila `enabled:false` maka command terkait ditolak.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/order-actions.test.ts` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS; build paket dan restart API.
- [ ] **Step 5: Commit** `feat(sales): permission-aware SO actions with flow reasons`

### Task 6: Halaman detail SO

**Files:**
- Create: `apps/office/app/operations/sales-order-detail.tsx`, `apps/office/app/operations/sales-order-advance-panel.tsx`, `apps/office/app/operations/sales-order-print.tsx`
- Modify: `apps/office/app/operations/sales-order.tsx:471-977` (detail memakai komponen baru), `apps/office/app/operations/sales-order-journey.tsx` (hapus fan-out 122-157 dan kalkulasi langkah 160-378; sisakan komponen tampilan yang masih dipakai halaman lain), `apps/office/lib/sales-order-copy.ts` (label `lineStatus`, jenis dokumen), `apps/office/app/operations/sales-order-modern.css`
- Test: `apps/office/lib/sales-order-copy.test.ts` (perluas)

**Interfaces:**
- Consumes: `order()` (Task 3-4), `/related` (Task 3), `/actions` (Task 5), endpoint uang muka (Task 1), print event dan duplikat (Task 4).

Layar satu halaman (tab Ringkasan/Pemenuhan/Dokumen/Riwayat diganti, sesuai revisi spec atas keputusan 23 Oktober):
- Kepala: "Sales Order {nomor}", status tunggal berwarna, ‹ ›, **Cetak**, tombol utama = `primary`, **Aksi ▾** = tindakan lain (terhalang tampil abu-abu dengan alasan), **⋮** = Ubah, Duplikat, Riwayat.
- Data kepala: Pelanggan (tautan) + alamat kirim, Nomor, Tanggal, Jatuh tempo (perkiraan), Gudang, Sales, No. SP.
- Tabel barang: Produk, Dipesan, Diterima pelanggan, Sisa, Status baris, Satuan, Harga, Pajak, Jumlah; baris bersisa di atas dan berwarna; klik baris membuka rincian (dikirim, dalam perjalanan, ditutup). Total kuantitas, Subtotal, PPN, Total, **Sisa tagihan**.
- **Uang muka**: daftar (tanggal, jumlah, akun, status, pencatat); form "Catat uang muka" bila `record_advance`; Verifikasi/Tolak (dengan alasan) bila `verify_advance` untuk baris yang sesuai.
- **Transaksi**: tabel `/related` (tanggal, jenis, nomor tautan, status, jumlah).
- Jejak: "Terakhir diubah oleh … pada …", "Terakhir dicetak oleh … pada …".
- Cetak: tata letak faktur SO dengan identitas dari Profil Perusahaan; `window.print()` setelah `print-events` berhasil.

- [ ] **Step 1: Write the failing test**: label untuk setiap `lineStatus` dan `RelatedDocument.kind`; tidak ada kata terlarang.
- [ ] **Step 2: Run** `pnpm vitest run apps/office/lib/sales-order-copy.test.ts` → FAIL.
- [ ] **Step 3: Implement** layar.
- [ ] **Step 4: Run** test → PASS; `pnpm --filter @evflow/office build` → sukses.
- [ ] **Step 5: Commit** `feat(office): Kledo-style SO detail with advances and related documents`

### Task 7: Sinkronisasi blueprint dan QA browser

**Files:**
- Modify: `docs/erp-blueprint/02-requirements.md`, `10-sales-marketing.md` (detail SO, tindakan), `12-finance-administration.md` (uang muka dari SO + verifikasi), `15-setting.md` (izin baru), `03-database.md`, `04-api.md`, `06-user-flow.md`, `07-design.md`
- Create: `docs/development/so-mudah-bagian-2-2026-10-25.md`

- [ ] **Step 1: Sinkronkan** dokumen dengan keputusan spec bagian Detail SO dan Uang muka; tidak menambah aturan di luar spec.
- [ ] **Step 2: QA browser** (route operasional, viewport 1366 dan 390) dengan tiga sesi: Admin Sistem (semua tindakan), peran gudang (hanya pick slip/surat jalan/POD; tanpa invoice dan uang muka), peran Finance (verifikasi uang muka catatan orang lain; tidak dapat memverifikasi catatan sendiri). Alur: SO → Catat uang muka → Verifikasi oleh pengguna lain → DP bertambah → Buat Pick Slip → Surat Jalan → Catat Barang Diterima → Buat Invoice → Transaksi menampilkan semua dokumen, termasuk invoice dari Packing List. Cetak menghasilkan jejak "Terakhir dicetak". Catat bukti.
- [ ] **Step 3: Run** `pnpm vitest run` dan `./tools/validate-repository.ps1` → lulus.
- [ ] **Step 4: Commit** `docs(sales): sync blueprint and QA evidence for SO detail and advances`
