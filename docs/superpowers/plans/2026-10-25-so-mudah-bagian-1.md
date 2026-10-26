# SO Mudah — Bagian 1: Daftar dan Form SO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daftar SO dengan status tunggal dan kolom ala faktur, serta form SO faktur padat dengan isian wajib minimal, tanggal, termin, sales dan gudang — backend lebih dulu.

**Architecture:** Kolom kepala baru pada `SalesOrder` (tanggal, termin, sales, gudang) dan `SalesOrderLine` (gudang per barang) diisi oleh satu resolver kepala SO di backend yang menerapkan kebijakan Setting bertanggal efektif (OPS-FLX-10..13). Status tunggal diturunkan oleh fungsi murni + kueri SQL untuk filter/hitungan tab; tidak disimpan. Layar Office memakai kontrak baru tanpa logika bisnis sendiri.

**Tech Stack:** Prisma/PostgreSQL (`numeric`), NestJS-style backend (`packages/backend`), zod contracts (`@evflow/contracts`), Next.js Office, vitest dengan Postgres nyata.

**Spec:** [docs/superpowers/specs/2026-10-25-so-mudah-design.md](../specs/2026-10-25-so-mudah-design.md) (bagian Daftar SO, Form SO, Stok kurang — peringatan saja).

## Global Constraints

- Uang dan kuantitas memakai `Prisma.Decimal`/string decimal; dilarang JavaScript `number` untuk uang/kuantitas.
- Nilai bisnis dari kebijakan (`PolicyVersion` ACTIVE); tidak ada hardcode termin, gudang, atau kewajiban isian.
- Backend adalah otoritas: kewajiban No. SP/lampiran, termin, dan gudang ditegakkan di service, bukan hanya di layar.
- Tanggal SO boleh berada di periode akuntansi terkunci (SO tidak memposting); penguncian tetap ditegakkan oleh dokumen berjurnal saat diposting. Jangan menambah pengecekan periode pada create/revise SO.
- Izin tetap per submenu (`sales_order.create/read/submit`); tidak ada perluasan hak.
- Mutasi memakai `transactionCommand` dengan Idempotency-Key, audit, dan versi (pola yang sudah ada).
- Status tunggal: `DRAFT | WAITING_APPROVAL | OPEN | PARTIALLY_SHIPPED | IN_DELIVERY | COMPLETED | CANCELLED`, label layar: Draft, Menunggu Persetujuan, Open, Dikirim Sebagian, Dalam Pengiriman, Selesai, Dibatalkan.
- Copy layar memakai istilah faktur; dilarang di layar SO: "server", "snapshot", "dialokasikan", "alokasi", "backorder", "evaluasi", "materialRevision".
- Setelah mengubah `packages/contracts|database|backend`, jalankan `pnpm --filter @evflow/contracts --filter @evflow/database --filter @evflow/backend build` sebelum me-restart API (API memuat dari `dist`).
- Sebelum selesai: `./tools/validate-repository.ps1` (butuh `rg` di PATH).

**Di luar bagian ini (dicatat agar tidak dikerjakan):** redaksi harga "Lihat harga" dan matrix pohon (bagian 3), tombol pindah locator (bagian 4), detail SO (bagian 2), PIC sales pada master pelanggan, mesin persetujuan SO (OPS-FLX-07 belum dibaca kode).

## Review Focus

1. **SO lama tanpa kolom baru** (warehouseId/paymentTermCode null) harus tetap tampil, bisa diajukan, dan dialokasikan seperti sebelumnya (semua gudang, termin bawaan pelanggan). Test di Task 3 dan 4.
2. **Diterima lebih sedikit dari dikirim** (returnedQuantity > 0): baris belum Selesai; SO berstatus Dikirim Sebagian bila masih ada yang perlu dikirim ulang. Test di Task 5.
3. **Sisa ditutup sebagian** (closedQuantity > 0): status dihitung terhadap `ordered − closed`. Test di Task 5.
4. **Kebijakan dikosongkan/dinonaktifkan pengguna** (mis. gudang bawaan menunjuk gudang nonaktif): pesan dengan tautan Setting, bukan error teknis. Test di Task 3.
5. **Termin yang dihapus dari daftar OPS-FLX-03** setelah dipilih di SO draft: submit ditolak dengan kode jelas. Test di Task 4.

---

### Task 1: Skema, kebijakan bawaan, dan kontrak

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (`SalesOrder` 1262-1292, `SalesOrderLine` 1294-1316)
- Create: `packages/database/prisma/migrations/20261025100000_sales_order_header_fields/migration.sql`
- Modify: `packages/database/src/data/operational-policies.json` (tambah setelah OPS-FLX-09, baris ~968)
- Modify: `packages/contracts/src/otc-ptp.ts:29-56`
- Test: `tests/unit/sales-order-contract.test.ts`

**Interfaces:**
- Produces (Prisma): `SalesOrder.orderDate DateTime @db.Date`, `SalesOrder.paymentTermCode String?`, `SalesOrder.salespersonId String? @db.Uuid` (relasi `User`), `SalesOrder.warehouseId String? @db.Uuid` (relasi `Warehouse`), `SalesOrderLine.warehouseId String? @db.Uuid`; index `@@index([companyId, orderDate])`.
- Produces (kebijakan): `OPS-FLX-10` "Gudang bawaan penjualan" (kode gudang, default `null`), `OPS-FLX-11` "Gudang per barang di Sales Order" (boolean, default `false`), `OPS-FLX-12` "No. SP pelanggan wajib di Sales Order" (boolean, default `false`), `OPS-FLX-13` "Lampiran wajib di Sales Order" (boolean, default `false`). group `sales`, domain `administration`. Jangan memakai OPS-FLX-05.
- Produces (contracts): `createSalesOrderSchema` dengan `customer_reference`, `delivery_address`, `evidence_id` **opsional**; field baru opsional `order_date` (YYYY-MM-DD), `payment_term_code` (string 1-40), `salesperson_id` (uuid), `warehouse_id` (uuid); item baris `warehouse_id?` (uuid). `salesOrderDisplayStatusSchema = z.enum([...7 nilai Global Constraints])`, tipe `SalesOrderDisplayStatus`.

- [ ] **Step 1: Write the failing test** `tests/unit/sales-order-contract.test.ts`
  - `it("accepts minimal SO without reference, address and evidence")`: parse `{customer_id, lines:[{product_id, quantity:"1", unit_price:"1000"}]}` → success.
  - `it("accepts header fields")`: dengan `order_date:"2026-10-25"`, `payment_term_code:"TEMPO_30"`, `salesperson_id`, `warehouse_id`, baris `warehouse_id` → success.
  - `it("rejects invalid order_date")`: `"25/10/2026"` → error.
  - `it("lists seven display statuses")`: `salesOrderDisplayStatusSchema.options` sama dengan 7 nilai di Global Constraints, berurutan.
  - `it("catalog has OPS-FLX-10..13 with defaults")`: dari `operationalPolicyCatalog`, default 10=`null`, 11/12/13=`false`.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/sales-order-contract.test.ts` → FAIL.
- [ ] **Step 3: Implement** perubahan skema + migration. Migration mengisi data lama: `order_date = (created_at AT TIME ZONE companies.timezone)::date`, `salesperson_id = created_by_id`; `warehouse_id`, `payment_term_code` dibiarkan NULL (perilaku lama dipertahankan). Kolom `order_date` NOT NULL setelah backfill. Tambah entri kebijakan dengan bentuk entri OPS-FLX-07 (944-954); untuk OPS-FLX-10 `type` mengikuti entri berjenis teks yang sudah ada di katalog dan `schema` mengizinkan `null`. Ubah kontrak.
- [ ] **Step 4: Run** `pnpm --filter @evflow/database exec prisma migrate deploy` lalu test → PASS.
- [ ] **Step 5: Commit** `feat(sales): SO header fields, policies OPS-FLX-10..13, optional reference contract`

### Task 2: Helper bersama — nilai kebijakan dan periode terbuka

**Files:**
- Create: `packages/backend/src/common/policy-value.ts`
- Create: `packages/backend/src/finance/period-guard.ts`
- Modify: `packages/backend/src/administration/settings.controller.ts:31-37` (pakai helper), `packages/backend/src/finance/posting.ts:95-99` (pakai helper)
- Test: `tests/integration/policy-and-period-helpers.test.ts`

**Interfaces:**
- Produces: `activePolicyValue(db: Tx | PrismaClient, companyId: string, code: string): Promise<unknown | null>` — `PolicyVersion` ACTIVE dengan `versionNo` tertinggi, `valueSnapshot ?? null`.
- Produces: `assertFinancePeriodOpen(tx: Tx, companyId: string, date: Date): Promise<void>` — melempar `ConflictException("FINANCE_PERIOD_NOT_OPEN")` bila tidak tepat satu `FinancePeriod` OPEN yang memuat tanggal (logika posting.ts:95-99 dipindah apa adanya). Dipakai posting dan verifikasi uang muka (bagian 2), **tidak** dipakai SO.
- Produces: `isFinancePeriodClosed(db: Tx | PrismaClient, companyId: string, date: Date): Promise<boolean>` — untuk peringatan form SO.

- [ ] **Step 1: Write the failing test**
  - `activePolicyValue` mengembalikan nilai versi ACTIVE terbaru; `null` bila kebijakan tidak ada.
  - `assertFinancePeriodOpen` lolos untuk periode OPEN; melempar `FINANCE_PERIOD_NOT_OPEN` untuk periode CLOSED dan untuk tanggal tanpa periode.
  - `isFinancePeriodClosed` `true` untuk tanggal di periode CLOSED, `false` untuk periode OPEN.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/policy-and-period-helpers.test.ts` → FAIL.
- [ ] **Step 3: Implement** kedua helper; refaktor dua pemanggil lama tanpa mengubah perilaku.
- [ ] **Step 4: Run** test baru + test integrasi posting yang sudah ada → PASS.
- [ ] **Step 5: Commit** `refactor(backend): shared policy value and finance period guards`

### Task 3: Resolver kepala SO dan pembuatan/revisi SO

**Files:**
- Create: `packages/backend/src/sales/order-header.ts`
- Modify: `packages/backend/src/otc-ptp.service.ts:153-190` (`createSalesOrder`)
- Modify: `packages/backend/src/sales/o2c-lifecycle.ts:321-410` (`reviseOrder`: field kepala opsional yang sama; reason tetap wajib)
- Modify: `tests/integration/otc-controls.test.ts` (ekspektasi lama `ORDER_REFERENCE_ADDRESS_REQUIRED`/evidence wajib → hanya saat kebijakan aktif)
- Test: `tests/integration/so-header-fields.test.ts` (fixture mengikuti `beforeAll` otc-controls.test.ts:72-176, `ensureTestTermList`, `financeFixture`)

**Interfaces:**
- Consumes: `activePolicyValue` (Task 2); `paymentTerm()` (`sales/customer-credit.ts:73`).
- Produces: `resolveOrderHeader(tx: Tx, companyId: string, actorId: string, input: CreateSalesOrderInput, customer: Customer): Promise<OrderHeader>` dengan `OrderHeader = { orderDate: Date; paymentTermCode: string | null; salespersonId: string; warehouseId: string; lineWarehouseIds: (string | null)[]; deliveryAddress: string | null; customerReference: string | null; evidenceId: string | null }`.

Aturan resolver (urutan):
1. `orderDate` = input atau hari ini (zona perusahaan); tanpa pengecekan periode (keputusan pengguna).
2. `paymentTermCode` = input atau `customer.defaultTermCode`; bila diisi harus ada di OPS-FLX-03 → selain itu `ORDER_PAYMENT_TERM_UNKNOWN`.
3. `salespersonId` = input atau `actorId`; harus anggota aktif perusahaan → `ORDER_SALESPERSON_INVALID`.
4. `warehouseId` = input atau OPS-FLX-10 (kode → id); bila kosong dan tepat satu gudang ACTIVE → gudang itu; bila tetap kosong → `ORDER_WAREHOUSE_REQUIRED`; gudang nonaktif → `ORDER_WAREHOUSE_INACTIVE`.
5. Gudang per baris hanya diterima bila OPS-FLX-11 `true`, selain itu `ORDER_LINE_WAREHOUSE_DISABLED`.
6. `deliveryAddress` = input atau `customer.shippingAddress ?? customer.primaryAddress ?? null`.
7. OPS-FLX-12 `true` dan referensi kosong → `ORDER_REFERENCE_REQUIRED`; OPS-FLX-13 `true` dan tanpa lampiran → `SALES_ORDER_EVIDENCE_REQUIRED`; lampiran yang diisi tetap divalidasi `requireEvidence`.

- [ ] **Step 1: Write the failing tests** (`so-header-fields.test.ts`)
  - `creates SO with only customer, date default and lines`: `orderDate` = hari ini, `salespersonId` = actor, `warehouseId` = satu-satunya gudang, `deliveryAddress` = `shippingAddress` pelanggan, `customerReference` null.
  - `requires reference when OPS-FLX-12 is on` → `ORDER_REFERENCE_REQUIRED`; `requires evidence when OPS-FLX-13 is on` → `SALES_ORDER_EVIDENCE_REQUIRED`.
  - `accepts order date in closed period without posting`: SO tersimpan dengan tanggal di periode CLOSED; tidak ada `LedgerEntry`.
  - `rejects unknown payment term` → `ORDER_PAYMENT_TERM_UNKNOWN`.
  - `requires warehouse when two active warehouses and no default` → `ORDER_WAREHOUSE_REQUIRED`; `uses OPS-FLX-10 default`; `default pointing to inactive warehouse` → `ORDER_WAREHOUSE_INACTIVE` (Review Focus 4).
  - `rejects line warehouse when OPS-FLX-11 off` → `ORDER_LINE_WAREHOUSE_DISABLED`.
  - `revise keeps header fields and applies same rules`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/so-header-fields.test.ts` → FAIL.
- [ ] **Step 3: Implement** `resolveOrderHeader` dan pakai di create/revise; hapus pemeriksaan wajib lama di otc-ptp.service.ts:163-165 (dipindah ke resolver). Kode error baru ditambahkan ke penerjemah pesan Office yang menautkan Setting (pola error penomoran 24 Oktober).
- [ ] **Step 4: Run** test baru + `pnpm vitest run tests/integration/otc-controls.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(sales): resolve SO header defaults and configurable required fields`

### Task 4: Pengajuan memakai termin SO dan gudang terpilih

**Files:**
- Modify: `packages/backend/src/sales/transaction-controls.ts:22-40` (`currentPaymentPolicy`), `:189-242` (`eligibleLots`)
- Modify: `packages/backend/src/otc-ptp.service.ts:219-340` (`submitSalesOrder`)
- Test: `tests/integration/so-submit-term-warehouse.test.ts`

**Interfaces:**
- Produces: `currentPaymentPolicy(tx, companyId, customerId, termCodeOverride?: string | null)` — override dipakai bila ada; termin tak dikenal → `ORDER_PAYMENT_TERM_UNKNOWN`.
- Produces: `eligibleLots(tx, companyId, productIds, warehouseIds?: string[])` — bila `warehouseIds` diisi, tambahkan `warehouseId: { in: warehouseIds }` ke `where`; tanpa argumen perilaku lama.

- [ ] **Step 1: Write the failing tests**
  - `submit snapshots the term chosen on SO`: pelanggan default COD, SO `TEMPO_30` → `paymentSnapshot.term_code === "TEMPO_30"`.
  - `legacy SO without term uses customer default` (Review Focus 1).
  - `term removed from OPS-FLX-03 after draft` → `ORDER_PAYMENT_TERM_UNKNOWN` (Review Focus 5).
  - `allocates only from SO warehouse`: stok gudang A 10, gudang B 50, SO gudang A qty 30 → teralokasi 10, sisa 20.
  - `line warehouse overrides header when OPS-FLX-11 on`.
  - `legacy SO without warehouse allocates across warehouses` (Review Focus 1).
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/so-submit-term-warehouse.test.ts` → FAIL.
- [ ] **Step 3: Implement**: submit meneruskan `o.paymentTermCode` dan gudang (`line.warehouseId ?? o.warehouseId`, null → semua) ke kedua fungsi. Pemeriksaan kredit tetap memakai termin hasil resolusi.
- [ ] **Step 4: Run** test baru + `otc-controls.test.ts` + `default-sales-tax.test.ts` + `manual-proforma.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(sales): submit uses SO term and selected warehouse`

### Task 5: Status tunggal, jatuh tempo perkiraan, DP

**Files:**
- Create: `packages/backend/src/sales/order-status.ts`
- Modify: `packages/backend/src/sales/order-view.ts:18-63`
- Test: `tests/unit/order-display-status.test.ts`, `tests/integration/order-status-query.test.ts`

**Interfaces:**
- Produces: `orderDisplayStatus(input: { state: SalesOrderState; pendingException: boolean; lines: { ordered: Decimal; closed: Decimal; accepted: Decimal; inTransit: Decimal }[] }): SalesOrderDisplayStatus`.
- Produces: `orderIdsByDisplayStatus(companyId: string, status: SalesOrderDisplayStatus): Prisma.Sql` — fragmen `id IN (...)` untuk filter dan hitungan tab, memakai aturan yang sama.
- Produces: `estimatedDueDate(orderDate: Date, term: PaymentTerm | null): string | null` — TEMPO: `orderDate + days` (YYYY-MM-DD); COD/PREPAY/null: `null`.
- Produces di `orderView`: `displayStatus`, `dueDateEstimate`, `downPayment` (string decimal).

Aturan status (per baris `need = ordered − closed`, `sent = accepted + inTransit`; `returned` tidak dihitung terkirim):

| Kondisi (dicek berurutan) | Status |
|---|---|
| `state = CANCELLED` | CANCELLED |
| `state = DRAFT` dan `pendingException` | WAITING_APPROVAL |
| `state = DRAFT` | DRAFT |
| `state = COMPLETED` atau semua baris `accepted ≥ need` (termasuk kebutuhan yang sudah ditutup) | COMPLETED |
| semua baris `sent ≥ need` | IN_DELIVERY |
| ada baris `sent > 0` | PARTIALLY_SHIPPED |
| lainnya | OPEN |

`pendingException` = ada `SalesExceptionRequest` `state = "SUBMITTED"` dan `expiresAt > now()` untuk SO. `downPayment` = jumlah nilai `CustomerReceipt` berstatus `POSTED` pada `FulfillmentBatch` milik SO (nama kolom nilai mengikuti model `CustomerReceipt`, schema 1521). Rumus ini sementara; [bagian 2 Task 1](2026-10-25-so-mudah-bagian-2.md) menggantinya dengan uang muka terverifikasi yang terkait langsung ke SO.

- [ ] **Step 1: Write the failing tests**
  - Unit: satu kasus per baris tabel; `returned partially → PARTIALLY_SHIPPED` (Review Focus 2); `closed portion counts toward need` (Review Focus 3); `estimatedDueDate` TEMPO 30 dari 2026-10-25 → `"2026-11-24"`, COD → `null`.
  - Integration: untuk SO yang dibentuk lewat command nyata (draft, exception, open, sebagian kirim, POD penuh, batal), `orderIdsByDisplayStatus` mengembalikan id yang sama dengan `orderDisplayStatus`.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/order-display-status.test.ts tests/integration/order-status-query.test.ts` → FAIL.
- [ ] **Step 3: Implement** fungsi murni, fragmen SQL (CTE agregat per baris dari `fulfillment_allocations`), dan tambahan `orderView`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(sales): single SO display status, due date estimate, down payment`

### Task 6: Daftar SO, opsi form, dan ketersediaan stok

**Files:**
- Modify: `packages/backend/src/sales/order-list-filters.ts:5-16,64` (param `status`; filter tanggal pada `orderDate`)
- Modify: `packages/backend/src/sales/operations.service.ts:403-483` (daftar), `:874-915` (`lookups`)
- Modify: `packages/backend/src/sales/operations.controller.ts` (endpoint baru)
- Test: `tests/unit/order-list-filters.test.ts` (perluas), `tests/integration/so-stock-availability.test.ts`

**Interfaces:**
- Produces respons daftar per baris: `{ id, number, customer:{name}, customerReference, orderDate, dueDateEstimate, displayStatus, downPayment, total, currency }` (field lama dipertahankan sampai Task 7 selesai). `summary` menjadi hitungan per `SalesOrderDisplayStatus` + `all`.
- Produces `GET /operations/order-options` tambahan: `warehouses[{id,code,name}]`, `salespeople[{id,name}]`, `terms[PaymentTerm]`, `defaults{ warehouseId|null, lineWarehouseEnabled, referenceRequired, evidenceRequired }` dari OPS-FLX-10..13, dan `closedThrough: string | null` (tanggal akhir periode CLOSED terakhir) untuk peringatan tanggal.
- Produces `GET /operations/stock-availability?warehouse_id=&product_ids=` (izin `sales_order.create`): `[{ productId, available: string, elsewhere: [{ locatorType, locatorName, quantity: string }] }]`; `available` memakai syarat `eligibleLots` (STORAGE/DISPATCH, AVAILABLE, belum kedaluwarsa, gudang terpilih); `elsewhere` = stok gudang yang sama di locator lain, termasuk QUARANTINE.

- [ ] **Step 1: Write the failing tests**
  - `filters orders by display status` untuk tiap status; `summary counts per status`.
  - `list rows carry reference, order date, due date estimate, down payment`.
  - `order-options exposes defaults from OPS-FLX-10..13`.
  - `stock availability splits sellable vs other locators`: 86 di STORAGE, 20 di RECEIVING, 5 di QUARANTINE → `available "86"`, `elsewhere` RECEIVING 20 dan QUARANTINE 5.
  - `stock availability requires sales_order.create` → 403 tanpa izin.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/order-list-filters.test.ts tests/integration/so-stock-availability.test.ts` → FAIL.
- [ ] **Step 3: Implement**; urutan daftar `orderDate desc, number desc`.
- [ ] **Step 4: Run** → PASS; lalu build paket (Global Constraints) dan restart API.
- [ ] **Step 5: Commit** `feat(sales): SO list single status columns, form options, stock availability`

### Task 7: Halaman daftar SO

**Files:**
- Create: `apps/office/lib/sales-order-copy.ts` (label status, warna, istilah layar)
- Modify: `apps/office/app/operations/sales-order.tsx:166-470` (bagian daftar), `apps/office/app/operations/sales-order-modern.css`
- Test: `apps/office/lib/sales-order-copy.test.ts`

**Interfaces:**
- Consumes: respons daftar Task 6.
- Produces: `salesOrderStatusLabel: Record<SalesOrderDisplayStatus, string>` (label Global Constraints), `salesOrderStatusTone: Record<SalesOrderDisplayStatus, "neutral"|"info"|"warning"|"success"|"danger">`.

Layar: judul "Sales Order", tombol "Buat Sales Order"; tab Semua, Draft, Menunggu Persetujuan (hanya bila hitungannya > 0), Open, Dikirim Sebagian, Dalam Pengiriman, Selesai, Dibatalkan — masing-masing dengan hitungan; cari nomor/pelanggan/No. SP; rentang tanggal. Kolom: Nomor, Pelanggan, No. SP, Tanggal, Jatuh Tempo (perkiraan, "—" bila tidak berlaku), Status (satu label berwarna), DP, Total. Dropdown status/pemenuhan/sisa lama dihapus.

- [ ] **Step 1: Write the failing test**: tiap status memiliki label dan tone; tidak ada label yang memuat kata terlarang (Global Constraints).
- [ ] **Step 2: Run** `pnpm vitest run apps/office/lib/sales-order-copy.test.ts` → FAIL.
- [ ] **Step 3: Implement** layar sesuai paragraf di atas dengan token/komponen `docs/mockup/web-design-standard.md`.
- [ ] **Step 4: Run** test → PASS; `pnpm --filter @evflow/office build` → sukses.
- [ ] **Step 5: Commit** `feat(office): SO list with single status tabs and invoice columns`

### Task 8: Form SO faktur padat

**Files:**
- Modify: `apps/office/app/operations/sales-order-form.tsx` (struktur ulang; payload 400-426, simpan 431-437)
- Create: `apps/office/app/operations/sales-order-payload.ts` (fungsi murni yang diekstrak)
- Modify: `apps/office/app/operations/sales-order-modern.css`
- Modify: penerjemah pesan error Office yang dipakai form (kode baru Task 3 → kalimat awam + tautan Setting)
- Test: `apps/office/app/operations/sales-order-payload.test.ts`

**Interfaces:**
- Consumes: respons `order-options` dan `stock-availability` (Task 6), kontrak Task 1.
- Produces: `buildSalesOrderPayload(state: SalesOrderFormState, options: OrderOptions): CreateSalesOrderInput` — mengirim field kepala hanya bila diisi; `warehouse_id` selalu dikirim walau isian disembunyikan (satu gudang).

Layar mengikuti mockup A di spec: satu kartu "Sales Order baru".
- Baris 1: Pelanggan* (dengan "Tambah Pelanggan"), Nomor (otomatis, hanya baca).
- Baris 2: Tanggal*, Termin (terisi dari pelanggan), Jatuh tempo (perkiraan, hanya baca). Bila tanggal ≤ `closedThrough`, tampilkan peringatan (bukan blokir): "Tanggal ini berada di periode yang sudah ditutup buku".
- Baris 3: No. SP pelanggan (opsional; bertanda * bila OPS-FLX-12), Sales, Kirim ke (alamat pelanggan; dapat diubah).
- Gudang: tampil hanya bila `warehouses.length > 1`; kolom gudang per baris hanya bila `lineWarehouseEnabled`.
- Tabel barang: Produk, Qty, Satuan, Harga, Diskon, Pajak, Jumlah; di bawah nama produk "Stok tersedia: N {satuan}". Bila qty > tersedia: peringatan baris "Stok kurang {selisih} {satuan}" dan, bila ada, "Masih ada {qty} di {nama locator}" (tanpa tombol; bagian 4).
- Kiri bawah: tautan "+ Catatan", "+ Lampiran" (bertanda wajib bila OPS-FLX-13). Kanan bawah: Subtotal, "+ Diskon tambahan", PPN, "+ Ongkos kirim", Total.
- Tombol: Batal, Simpan ▾ (Simpan = simpan lalu ajukan; menu: Simpan sebagai draf).
- Teks penjelas teknis lama dihapus (panel "Diperiksa saat diajukan", kalimat "server memeriksa…", "Ketersediaan stok tidak dicadangkan…").

- [ ] **Step 1: Write the failing tests** untuk `buildSalesOrderPayload`: tanpa No. SP/lampiran → field tidak dikirim; satu gudang tersembunyi → `warehouse_id` tetap terkirim; gudang per baris nonaktif → item tanpa `warehouse_id`; termin diganti → `payment_term_code` terkirim.
- [ ] **Step 2: Run** `pnpm vitest run apps/office/app/operations/sales-order-payload.test.ts` → FAIL.
- [ ] **Step 3: Implement** fungsi payload dan form.
- [ ] **Step 4: Run** test → PASS; `pnpm --filter @evflow/office build` → sukses.
- [ ] **Step 5: Commit** `feat(office): invoice-style SO form with minimal required fields`

### Task 9: Sakelar Setting, sinkronisasi blueprint, dan QA browser

**Files:**
- Modify: `apps/office/app/setting/general/page.tsx` (kelompok "Sales Order": OPS-FLX-10 pilihan gudang, OPS-FLX-11/12/13 sakelar berbahasa awam) — pakai `usePolicyForm` (`settings-ui.tsx:23`)
- Modify blueprint: `docs/erp-blueprint/02-requirements.md`, `10-sales-marketing.md`, `11-warehouse-logistik.md`, `15-setting.md` + dokumen pendukung 40 (katalog OPS-FLX-10..13), `03-database.md`, `04-api.md`, `06-user-flow.md`, `07-design.md`
- Create: `docs/development/so-mudah-bagian-1-2026-10-25.md` (bukti QA)

- [ ] **Step 1: Implement** kartu Setting; label: "Gudang bawaan penjualan", "Izinkan gudang berbeda per barang", "No. SP pelanggan wajib diisi", "Lampiran SP wajib diisi".
- [ ] **Step 2: Sinkronkan** dokumen blueprint di atas dengan keputusan spec bagian Daftar/Form SO; tidak menambah aturan di luar spec.
- [ ] **Step 3: QA browser** (route operasional, sesi `demo.admin@evflow.local`, viewport 1366 dan 390): buat SO hanya dengan pelanggan + barang → tersimpan dan diajukan; nyalakan OPS-FLX-12 → simpan tanpa No. SP ditolak dengan pesan bertautan Setting; daftar menampilkan 8 kolom dan tab berhitungan; stok kurang menampilkan peringatan baris; ukur tombol/label/filter sesuai standar desain; tidak ada scroll horizontal di 390px. Catat bukti di dokumen development.
- [ ] **Step 4: Run** `pnpm vitest run` (seluruh suite) dan `./tools/validate-repository.ps1` → lulus.
- [ ] **Step 5: Commit** `docs(sales): sync blueprint and QA evidence for SO list and form`
