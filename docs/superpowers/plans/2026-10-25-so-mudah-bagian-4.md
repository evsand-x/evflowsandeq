# SO Mudah — Bagian 4: Pindah Locator dari Form SO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dari baris SO yang stoknya kurang, pengguna mengajukan pindah barang dari locator lain (mis. 02 Penerimaan) ke locator jual (00 Persediaan); petugas gudang mengonfirmasi sambil memutuskan mutu; stok bergerak dengan jejak audit; kekurangan SO dialokasikan ulang.

**Architecture:** Model `LocatorMoveRequest` + `LocatorMoveLine` menyimpan pengajuan dan lot yang dipindah. Konfirmasi memecah lot sumber ke baris `StockLot` tujuan (batch sama, `unitCost` sama, locator berbeda) dengan dua `InventoryMovement` (`LOCATOR_MOVE_OUT`/`LOCATOR_MOVE_IN`) dalam satu transaksi. Tanpa jurnal: nilai persediaan tidak berubah dalam satu gudang. Setelah transaksi selesai, SO terkait dialokasikan ulang lewat jalur `submitSalesOrder` yang sudah ada.

**Tech Stack:** Prisma/PostgreSQL, backend `packages/backend`, zod `@evflow/contracts`, Next.js Office, vitest dengan Postgres nyata.

**Spec:** [docs/superpowers/specs/2026-10-25-so-mudah-design.md](../specs/2026-10-25-so-mudah-design.md) (Stok kurang dan pindah locator). **Bergantung pada:** [bagian 1](2026-10-25-so-mudah-bagian-1.md) (`stock-availability`, peringatan baris form, gudang SO), [bagian 2](2026-10-25-so-mudah-bagian-2.md) (`/related`, `/actions`).

## Global Constraints

- Semua Global Constraints bagian 1 berlaku.
- Saldo stok tidak diedit langsung; perubahan hanya lewat `InventoryMovement` beridempotensi dan teraudit.
- Locator sumber yang boleh: `RECEIVING`, `STORAGE`, `DISPATCH`. Tujuan yang boleh: `STORAGE`, `DISPATCH`. `QUARANTINE`, `TRANSIT`, `CONSIGNMENT`, `RETURN` tidak boleh menjadi sumber. Sumber dan tujuan harus satu gudang dan berbeda. *(keputusan pembangun)*
- Hanya kuantitas bebas (`quantityOnHand − quantityReserved`) yang dapat dipindah.
- Lot berstatus mutu `PENDING` wajib diputuskan mutunya saat konfirmasi oleh pengguna yang juga memegang `inventory.quality.decide`. Lolos → pindah dan `AVAILABLE`. Tahan → tidak pindah, lot sumber `HOLD` dengan alasan, pengajuan `HELD`.
- Lot `HOLD`/`QUARANTINE`/`RECALL` tidak dapat dipindah.
- Pengajuan tidak memakai persetujuan (mesin persetujuan umum belum ada); kontrolnya adalah izin konfirmasi.
- Izin baru tidak diberikan otomatis kepada peran mana pun (fitur baru; Admin Sistem penuh).

## Review Focus

1. **Lot sebagian sudah direservasi**: yang dipindah tidak melebihi kuantitas bebas. Test di Task 2.
2. **Dua petugas mengonfirmasi pengajuan yang sama bersamaan**: stok berpindah sekali. Test di Task 2.
3. **SO berubah versi atau ditutup antara pengajuan dan konfirmasi**: pindah tetap sah, alokasi ulang dilewati dengan catatan, tanpa membatalkan pindah. Test di Task 3.
4. **Lot tujuan sudah ada dengan `unitCost` berbeda** (batch sama di locator tujuan): ditolak, tidak mencampur nilai. Test di Task 2.
5. **Petugas tanpa izin mutu** mencoba mengonfirmasi lot `PENDING`: ditolak dengan pesan jelas. Test di Task 2.

---

### Task 1: Skema, izin, penomoran, kontrak

**Files:**
- Modify: `packages/database/prisma/schema.prisma` (enum `InventoryMovementKind` :1205; model baru)
- Create: `packages/database/prisma/migrations/20261025500000_locator_move/migration.sql`
- Modify: `packages/database/prisma/seed.ts:74-196`, `packages/database/src/data/numbering-defaults.json` (jenis `locator_move`, prefix `MV`)
- Create: `packages/contracts/src/locator-move.ts` (diekspor dari `index.ts`); Modify: `packages/contracts/src/permission-tree.ts` (submenu Warehouse & Logistik › Persediaan › Pindah Locator)
- Test: `tests/unit/locator-move-contract.test.ts`

**Interfaces:**
- Produces (Prisma): `InventoryMovementKind` + `LOCATOR_MOVE_OUT`, `LOCATOR_MOVE_IN`. `LocatorMoveRequest { id, companyId, number, warehouseId, productId, sourceLocatorId, targetLocatorId, quantity Decimal(24,10), salesOrderId?, salesOrderLineId?, note?, state LocatorMoveState(REQUESTED|COMPLETED|HELD|CANCELLED), requestedById, requestedAt, confirmedById?, confirmedAt?, holdReason?, cancelReason?, reallocationNote?, version, idempotencyKey }`; `LocatorMoveLine { id, requestId, sourceLotId, targetLotId?, quantity, qualityBefore, qualityAfter }`.
- Produces (izin): `locator_move.read`, `locator_move.create`, `locator_move.confirm`, `locator_move.cancel`.
- Produces (contracts): `createLocatorMoveSchema = { product_id, source_locator_id, target_locator_id, quantity, sales_order_id?, sales_order_line_id?, note? (≤500) }`; `confirmLocatorMoveSchema = { version, lines: [{ source_lot_id, quantity }] (1-50), quality?: { decision: "PASS" | "HOLD", reason? (1-500, wajib bila HOLD) } }`; `cancelLocatorMoveSchema = { version, reason (1-500) }`.

- [ ] **Step 1: Write the failing test**: skema menerima pengajuan minimal; `quality.reason` wajib bila `HOLD`; registry memuat submenu Pindah Locator dengan empat tindakan; `numberingDefaults` memuat `locator_move`.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/locator-move-contract.test.ts` → FAIL.
- [ ] **Step 3: Implement** skema, migration, seed, penomoran, kontrak, registry.
- [ ] **Step 4: Run** → PASS; `tests/integration/permission-tree.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(warehouse): locator move model, permissions and numbering`

### Task 2: Ajukan, konfirmasi dengan keputusan mutu, batalkan

**Files:**
- Create: `packages/backend/src/warehouse/locator-move.service.ts`, `packages/backend/src/warehouse/locator-move.controller.ts` (didaftarkan di modul backend)
- Test: `tests/integration/locator-move.test.ts` (fixture gudang/locator/lot mengikuti `tests/integration/so-stock-availability.test.ts`)

**Interfaces:**
- Produces (endpoint; mutasi memakai Idempotency-Key, audit, versi):
  - `POST /warehouse/locator-moves` (`locator_move.create`) → pengajuan `REQUESTED` bernomor `MV…`.
  - `GET /warehouse/locator-moves` (`locator_move.read`; filter `state`, `sales_order_id`) dan `GET /warehouse/locator-moves/:id` → termasuk `candidateLots[{ lotId, batchNo, expiryDate, free, qualityState }]` di locator sumber, urut FEFO.
  - `POST /warehouse/locator-moves/:id/confirm` (`locator_move.confirm`).
  - `POST /warehouse/locator-moves/:id/cancel` (`locator_move.cancel`, atau pengaju sendiri selama `REQUESTED`).
- Aturan ajukan: locator sesuai Global Constraints → `LOCATOR_MOVE_LOCATOR_INVALID`; jumlah ≤ Σ kuantitas bebas lot yang dapat dipindah di sumber → `LOCATOR_MOVE_QUANTITY_EXCEEDED`; pengajuan `REQUESTED` lain untuk produk+sumber yang sama dikembalikan sebagai `warnings: ["LOCATOR_MOVE_DUPLICATE_PENDING"]` (tidak memblokir); bila `sales_order_line_id` diisi, produk harus sama dan gudang = gudang baris/SO.
- Aturan konfirmasi (satu transaksi; kunci `FOR UPDATE` pada pengajuan lalu lot urut id):
  - State `REQUESTED` dan versi cocok → selain itu `LOCATOR_MOVE_STATE_OR_VERSION_CHANGED`.
  - Σ `lines.quantity` = `quantity` pengajuan → selain itu `LOCATOR_MOVE_LINES_MISMATCH`; tiap lot berada di locator sumber, tidak `HOLD|QUARANTINE|RECALL`, dan `quantity ≤ onHand − reserved` → selain itu `LOCATOR_MOVE_LOT_NOT_AVAILABLE`.
  - Ada lot `PENDING`: `quality` wajib → `LOCATOR_MOVE_QUALITY_DECISION_REQUIRED`; pengguna wajib memegang `inventory.quality.decide` → `LOCATOR_MOVE_QUALITY_PERMISSION_REQUIRED`.
  - `HOLD`: lot `PENDING` di baris → `qualityState = "HOLD"`, `qualityReason`; tanpa pergerakan; pengajuan `HELD` + `holdReason`.
  - `PASS` atau tanpa lot `PENDING`: per baris kurangi `quantityOnHand` lot sumber; upsert lot tujuan berkunci `[companyId, productId, warehouseId, targetLocatorId, batchNo]`, `expiryDate` dan `unitCost` disalin; lot tujuan yang sudah ada dengan `unitCost` atau `expiryDate` berbeda → `LOCATOR_MOVE_LOT_BASIS_CHANGED`; lot tujuan `qualityState = "AVAILABLE"`; tulis `InventoryMovement` `LOCATOR_MOVE_OUT` (lot sumber) dan `LOCATOR_MOVE_IN` (lot tujuan) dengan `sourceType "LOCATOR_MOVE"`, `sourceId` = pengajuan, `idempotencyKey` turunan per baris; pengajuan `COMPLETED`.
  - Tanpa `postLedger`.
- Audit: `locator_move.requested|completed|held|cancelled`; keputusan mutu juga diaudit seperti `quality()` (operations.service.ts:256).

- [ ] **Step 1: Write the failing tests**
  - `request from receiving to storage within free quantity`.
  - `rejects quarantine source and cross-warehouse target` → `LOCATOR_MOVE_LOCATOR_INVALID`.
  - `cannot move reserved quantity` → `LOCATOR_MOVE_LOT_NOT_AVAILABLE` (Review Focus 1).
  - `confirm pending lot with PASS moves stock and sets AVAILABLE`: saldo sumber turun, lot tujuan naik dengan batch/expiry/unitCost sama, dua pergerakan, tanpa jurnal.
  - `confirm pending lot with HOLD keeps stock at source as HOLD`.
  - `confirm pending lot without quality permission` → `LOCATOR_MOVE_QUALITY_PERMISSION_REQUIRED` (Review Focus 5).
  - `concurrent confirm moves stock once` (Review Focus 2).
  - `existing target lot with different unit cost` → `LOCATOR_MOVE_LOT_BASIS_CHANGED` (Review Focus 4).
  - `each endpoint requires its own permission`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/locator-move.test.ts` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(warehouse): locator move request and confirmation with quality decision`

### Task 3: Alokasi ulang SO setelah pindah

**Files:**
- Modify: `packages/backend/src/warehouse/locator-move.service.ts`, `packages/backend/src/otc-ptp.service.ts:217-250` (izinkan pemanggil internal reallocation bersumber `LOCATOR_MOVE`)
- Test: `tests/integration/locator-move-reallocation.test.ts`

**Interfaces:**
- Produces: `reallocateAfterMove(companyId: string, actorId: string, request: LocatorMoveRequest): Promise<"REALLOCATED" | "SKIPPED">` — dipanggil **setelah** transaksi konfirmasi selesai, hanya bila `COMPLETED` dan `salesOrderId` ada; memakai `submitSalesOrder(c, actorId, salesOrderId, key = "locator-move:" + request.id, version = versi SO saat ini)`. SO bukan `OPEN`, tanpa sisa, atau gagal karena versi berubah → tidak melempar; simpan `reallocationNote` ("SO sudah tidak menunggu stok" / "Cek ulang stok dari SO") dan audit `locator_move.reallocation_skipped`.
- Pengecualian atas aturan "backorder tidak dialokasikan ulang oleh event stok" (operations.service.ts:280) hanya untuk SO yang ditautkan pengajuan pindah; dicatat di komentar kode dan blueprint.

- [ ] **Step 1: Write the failing tests**
  - `completed move reallocates linked SO shortage`: sisa SO turun sebesar stok yang dipindah.
  - `held move does not reallocate`.
  - `closed SO after request: move completes, reallocation skipped with note` (Review Focus 3).
  - `reallocation retry uses same idempotency key`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/locator-move-reallocation.test.ts` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS; build paket dan restart API.
- [ ] **Step 5: Commit** `feat(sales): reallocate linked SO after locator move`

### Task 4: Tugas gudang, dokumen terkait SO, dan stok tersedia

**Files:**
- Modify: `packages/backend/src/dashboard/action-queue.service.ts:21` (cabang tugas pindah locator), `packages/backend/src/sales/order-related.ts` (bagian 2: jenis `LOCATOR_MOVE`), `packages/backend/src/sales/operations.service.ts` (`stock-availability` bagian 1: `pendingMoves`)
- Modify: `packages/contracts` (tipe `ActionQueueData`, `RelatedDocument.kind`)
- Test: `tests/integration/locator-move-tasks.test.ts`

**Interfaces:**
- Produces: tugas "Pindah barang {produk} {qty} dari {locator sumber} ke {locator tujuan}" untuk pemegang `locator_move.confirm`, bertautan ke detail pengajuan.
- Produces: `RelatedDocument` kind `LOCATOR_MOVE` (izin `locator_move.read`) dengan status Diajukan/Selesai/Ditahan mutu/Dibatalkan.
- Produces: `stock-availability` per produk menambah `pendingMoves: [{ id, number, quantity }]`.

- [ ] **Step 1: Write the failing tests**: tugas tampil hanya untuk pemegang `locator_move.confirm` dan hilang setelah selesai; detail SO menampilkan pengajuan tertaut; `pendingMoves` terisi.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/locator-move-tasks.test.ts` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(warehouse): locator move tasks and SO related documents`

### Task 5: Layar

**Files:**
- Modify: `apps/office/app/operations/sales-order-form.tsx` (peringatan baris dari bagian 1 Task 8)
- Create: `apps/office/app/operations/locator-moves.tsx` (daftar + detail + dialog konfirmasi), `apps/office/app/operations/locator-move-request-dialog.tsx`, `apps/office/app/operations/locator-move-plan.ts`
- Modify: `apps/office/app/operations/workspace.tsx:429,809` (kind `locator-moves`), `apps/office/lib/navigation.ts` (Persediaan › Pindah Locator), `apps/office/lib/sales-order-copy.ts`
- Test: `apps/office/app/operations/locator-move-plan.test.ts`

**Interfaces:**
- Produces: `suggestMoveLines(candidateLots, quantity: string): { source_lot_id: string; quantity: string }[]` — isi otomatis FEFO dari kuantitas bebas (string decimal).

Layar:
- **Form SO**: pada peringatan "Stok kurang {n} {satuan} · Masih ada {qty} di {locator}", tombol **"Minta pindah ke {locator jual}"** bila pengguna memegang `locator_move.create` dan stok ada di sumber yang diizinkan; dialog berisi produk, dari, ke (default locator STORAGE pertama), jumlah (default = kekurangan, maks. tersedia di sumber), catatan. Bila ada `pendingMoves`, tampilkan "Sudah diajukan: {nomor}" sebagai pengganti tombol. SO yang belum tersimpan disimpan sebagai draf dulu sebelum dialog dibuka.
- **Warehouse & Logistik › Persediaan › Pindah Locator**: tab Diajukan / Selesai / Ditahan / Dibatalkan; kolom Nomor, Tanggal, Produk, Dari, Ke, Jumlah, SO, Pengaju, Status.
- **Dialog konfirmasi**: daftar lot (batch, kedaluwarsa, bebas) terisi `suggestMoveLines` dan dapat diubah; bila ada lot belum diperiksa: pilihan wajib **Lolos** / **Tahan** (alasan wajib untuk Tahan) dengan teks "Barang diperiksa sebelum masuk {locator tujuan}"; tombol Konfirmasi pindah; Batalkan pengajuan dengan alasan.

- [ ] **Step 1: Write the failing tests**: `suggestMoveLines` mendahulukan lot kedaluwarsa terdekat, tidak melebihi kuantitas bebas, total sama dengan jumlah diminta.
- [ ] **Step 2: Run** `pnpm vitest run apps/office/app/operations/locator-move-plan.test.ts` → FAIL.
- [ ] **Step 3: Implement** layar.
- [ ] **Step 4: Run** → PASS; `pnpm --filter @evflow/office build` → sukses.
- [ ] **Step 5: Commit** `feat(office): request and confirm locator moves from SO`

### Task 6: Sinkronisasi blueprint dan QA browser

**Files:**
- Modify: `docs/erp-blueprint/02-requirements.md` (WMS), `11-warehouse-logistik.md` (pindah locator, keputusan mutu saat pindah, pengecualian alokasi ulang), `06-user-flow.md`, `03-database.md`, `04-api.md`, `07-design.md`, `15-setting.md` (izin, penomoran `MV`)
- Create: `docs/development/so-mudah-bagian-4-2026-10-25.md`

- [ ] **Step 1: Sinkronkan** dokumen; tidak menambah aturan di luar spec dan keputusan pembangun di atas.
- [ ] **Step 2: QA browser** (viewport 1366 dan 390): siapkan produk dengan 86 di 00 Persediaan dan 20 belum diperiksa di 02 Penerimaan; buat SO 100 → peringatan "Stok kurang 14 · Masih ada 20 di 02 Penerimaan" → Minta pindah 14; login petugas gudang dengan izin mutu → tugas muncul → konfirmasi Lolos → SO teralokasi penuh, detail SO menampilkan MV…; ulangi dengan Tahan → stok tetap di 02 berstatus Ditahan, SO tetap kurang; petugas tanpa izin mutu ditolak. Catat bukti.
- [ ] **Step 3: Run** `pnpm vitest run` dan `./tools/validate-repository.ps1` → lulus.
- [ ] **Step 4: Commit** `docs(warehouse): sync blueprint and QA evidence for locator moves`
