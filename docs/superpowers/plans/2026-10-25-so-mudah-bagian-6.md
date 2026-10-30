# SO Mudah — Bagian 6: Pajak seperti Kledo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setting › Pajak menjadi daftar sederhana seperti Kledo — Nama, Persen efektif, Akun penjualan, Akun pembelian, Pemotongan, Aktif — dengan satu pajak menyimpan dua akun, PPh ditandai Pemotongan beserta aturan bukti potong, dan validasi jenis akun di backend.

**Architecture:** `OperationalTax` mendapat `salesAccountId`, `purchaseAccountId`, `proofType`, `proofRequired`; `usage` diturunkan dari akun yang diisi. `operationalTaxSnapshot` tetap mengeluarkan `account_id` tunggal, dipilih sesuai pemakaian dokumen, sehingga posting dan snapshot lama tidak berubah. Migration menggabungkan pasangan PPN bawaan dan memindahkan jenis potongan berjenis pajak menjadi pajak bertanda Pemotongan.

**Tech Stack:** Prisma/PostgreSQL, backend `packages/backend`, zod `@evflow/contracts`, Next.js Office, vitest dengan Postgres nyata.

**Spec:** [docs/superpowers/specs/2026-10-25-so-mudah-design.md](../specs/2026-10-25-so-mudah-design.md) (Pajak).

## Global Constraints

- Semua Global Constraints bagian 1 berlaku.
- Tarif, faktor DPP, dan akun tidak di-hardcode; nilai awal berasal dari `packages/database/src/data/tax-defaults.json` dan dapat diedit.
- Semua produk kena PPN dengan pajak penjualan bawaan dan snapshot per dokumen (keputusan 24 Oktober); pajak bawaan tidak dapat dinonaktifkan; rincian tarif × DPP tetap disimpan per dokumen untuk Coretax.
- Satu pajak menyimpan akun penjualan dan akun pembelian; minimal satu diisi. Pemakaian: ada akun penjualan → dapat dipakai penjualan; ada akun pembelian → dapat dipakai pembelian.
- Validasi jenis akun (`FinanceAccount.category`): PPN (`effect ADD`) — penjualan `LIABILITY`, pembelian `ASSET`; Pemotongan (`effect DEDUCT`) — penjualan `ASSET`, pembelian `LIABILITY`. Akun harus `DETAIL` dan aktif.
- Pajak bertanda Pemotongan dengan `proofRequired` wajib `proofType ∈ {BUKTI_POTONG, SSP_NTPN}`.
- Jenis Potongan hanya untuk potongan non-pajak.
- Snapshot pajak dokumen yang sudah ada tidak diubah.
- Pajak grup dan pajak bawaan pembelian otomatis tidak dibuat.

## Review Focus

1. **Akun tertukar** (akun penjualan PPN = PPN Masukan, seperti temuan di akun Kledo pengguna): ditolak. Test di Task 2.
2. **Invoice penjualan dan tagihan pemasok setelah penggabungan PPN**: masing-masing memposting ke akun yang benar (Keluaran vs Masukan). Test di Task 2.
3. **Dokumen lama** yang snapshot-nya merujuk pajak "PPN Masukan" yang digabung: tetap terbaca dan terposting sama. Test di Task 1.
4. **Menonaktifkan pajak bawaan** lewat sakelar baris: ditolak. Test di Task 2.
5. **Jenis potongan yang dipindah** masih dirujuk data lama: tetap terbaca (dinonaktifkan, tidak dihapus). Test di Task 1.

---

### Task 1: Skema dan migration penggabungan

**Files:**
- Modify: `packages/database/prisma/schema.prisma:2054-2074` (`OperationalTax`: `salesAccountId String? @db.Uuid`, `purchaseAccountId String? @db.Uuid`, `proofType String @default("NONE")`, `proofRequired Boolean @default(false)`; `accountId` dipertahankan untuk kompatibilitas baca, tidak lagi dipakai service)
- Create: `packages/database/prisma/migrations/20261025700000_tax_dual_accounts/migration.sql`
- Modify: `packages/database/src/data/tax-defaults.json`, `packages/database/src/data/deduction-types.json`, `packages/backend/src/administration/company-defaults.ts:101-135`
- Test: `tests/integration/tax-dual-account-migration.test.ts`

**Interfaces:**
- Migration:
  1. `usage SALES` → `sales_account_id = account_id`; `PURCHASE` → `purchase_account_id = account_id`; `BOTH` → keduanya = `account_id`.
  2. Per perusahaan: bila pajak bawaan penjualan dan bawaan pembelian sama `kind`, `effect`, `percentage`, `dpp_factor`, `decimal_places`, `rounding` → baris penjualan diganti nama "PPN", diisi `purchase_account_id` dari baris pembelian, `is_default_purchase = true`, `usage = 'BOTH'`; baris pembelian `active = false`, `is_default_purchase = false` (tidak dihapus); tulis revisi dan audit `tax.merged`.
  3. Per perusahaan: jenis potongan bernama PPh 22, PPh 23, PPN dipungut → pajak `effect DEDUCT` (`kind` PPH/PPN), `percentage` dari nilai bawaan `tax-defaults.json`, `sales_account_id = settle_account_id`, `proof_type`/`proof_required` disalin; jenis potongan asal `active = false`; audit `deduction_type.moved_to_tax`.
  4. CHECK `proof_type IN ('BUKTI_POTONG','SSP_NTPN','NONE')`, `NOT proof_required OR proof_type <> 'NONE'`, `sales_account_id IS NOT NULL OR purchase_account_id IS NOT NULL`.
- Defaults baru: `PPN` (12, faktor 0.9166666667, penjualan `2-20500`, pembelian `1-10500`, bawaan keduanya); `PPh 22` (1.5, DEDUCT, penjualan `1-10501`, BUKTI_POTONG wajib); `PPh 23` (2, DEDUCT, penjualan `1-10502`, BUKTI_POTONG wajib); `PPN dipungut` (11, DEDUCT, akun penjualan dari `deduction-types.json` saat ini, SSP_NTPN wajib). `deduction-types.json` tinggal `Biaya transfer`.

- [ ] **Step 1: Write the failing tests**
  - `merges default PPN pair into one tax with two accounts`.
  - `does not merge when rates differ`.
  - `moves tax deduction types to withholding taxes and deactivates originals` (Review Focus 5).
  - `old SO line snapshot referencing merged purchase tax still resolves and posts` (Review Focus 3).
  - `provisioning a new company creates PPN, PPh 22, PPh 23, PPN dipungut and Biaya transfer`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/tax-dual-account-migration.test.ts` → FAIL.
- [ ] **Step 3: Implement** skema, migration, defaults, provisioning.
- [ ] **Step 4: Run** → PASS; `tests/integration/company-defaults.test.ts`, `tests/integration/deduction-types.test.ts` (sesuaikan ekspektasi empat bawaan → satu) → PASS.
- [ ] **Step 5: Commit** `feat(tax): dual accounts per tax and withholding taxes migrated from deductions`

### Task 2: Layanan pajak, validasi akun, snapshot per pemakaian

**Files:**
- Create: `packages/contracts/src/tax.ts` (skema dipindah dari `packages/backend/src/finance/operational-tax.ts:8-30`; diekspor dari `index.ts`)
- Modify: `packages/backend/src/finance/operational-tax.ts` (`saveTax`, `operationalTaxSnapshot` 124-169, `defaultEligible` 202, `setDefaultTax` 225), `packages/backend/src/finance/operational-tax.controller.ts` (`GET options` 38, `GET master` 74, `PATCH master/:id` 128; endpoint aktif/nonaktif baru)
- Modify: `tests/integration/operational-tax.test.ts`, `tests/integration/default-sales-tax.test.ts`, `tests/integration/operational-tax-posting.test.ts`

**Interfaces:**
- Produces (contracts): `taxInputSchema = { name, kind: "PPN"|"PPH", withholding: boolean, percentage: string, dpp_factor: string, sales_account_id?: uuid, purchase_account_id?: uuid, proof_type?: "BUKTI_POTONG"|"SSP_NTPN"|"NONE", proof_required?: boolean, decimal_places?, rounding? }` (`withholding` ↔ `effect DEDUCT`).
- `saveTax`: validasi kategori akun per Global Constraints → `TAX_ACCOUNT_CATEGORY_INVALID` (dengan sisi `SALES`/`PURCHASE`); tanpa akun → `TAX_ACCOUNT_REQUIRED`; Pemotongan dengan `proof_required` tanpa jenis bukti → `TAX_PROOF_TYPE_REQUIRED`; `usage` diturunkan dari akun.
- `operationalTaxSnapshot(tx, c, taxId, usage: "SALES" | "PURCHASE", at)`: `account_id` = `salesAccountId` untuk SALES, `purchaseAccountId` untuk PURCHASE; akun sisi itu kosong → `TAX_USAGE_MISMATCH`. Bentuk snapshot lain tidak berubah.
- `GET /tax/master` per baris: `{ id, name, kind, withholding, effectivePercent: string, percentage, dppFactor, salesAccount: {id, code, name} | null, purchaseAccount: {id, code, name} | null, proofType, proofRequired, active, isDefaultSales, isDefaultPurchase, version }`; `effectivePercent = percentage × dppFactor` dibulatkan 4 desimal (string decimal).
- `POST /tax/master/:id/active` (`tax_setting.update`, If-Match) body `{ active: boolean }`; menonaktifkan pajak bawaan → `TAX_DEFAULT_REQUIRED_ACTIVE`.

- [ ] **Step 1: Write the failing tests**
  - `rejects PPN with purchase input account as sales account` → `TAX_ACCOUNT_CATEGORY_INVALID` sisi SALES (Review Focus 1).
  - `rejects withholding tax with liability sales account`.
  - `withholding requiring proof needs proof type` → `TAX_PROOF_TYPE_REQUIRED`.
  - `sales invoice posts SALES_TAX to sales account and supplier invoice posts PURCHASE_TAX to purchase account of the same merged PPN` (Review Focus 2).
  - `deactivating default tax via active toggle is rejected` (Review Focus 4).
  - `list returns effective percent 11.0000 for 12 × 0.9166666667`.
  - Test lama di tiga file tetap lulus setelah penyesuaian bentuk input.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/operational-tax.test.ts tests/integration/default-sales-tax.test.ts tests/integration/operational-tax-posting.test.ts` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS; `tests/unit/default-tax.test.ts` → PASS; build paket dan restart API.
- [ ] **Step 5: Commit** `feat(tax): dual-account tax service with account category validation`

### Task 3: Layar Pajak dan Jenis Potongan

**Files:**
- Modify: `apps/office/app/setting/tax/page.tsx` (ganti kartu "Pajak bawaan", tabel, dan `TaxDialog`), `apps/office/app/setting/settings-forms.ts:76-128` (`TaxDraft`, `taxPayload`, `effectiveTaxPercent`)
- Modify: `apps/office/app/setting/deductions/page.tsx` (keterangan "Potongan selain pajak, mis. biaya transfer" dan tautan "Potongan pajak (PPh) diatur di Pajak")
- Modify: `apps/office/lib/api.ts` (terjemahan `TAX_ACCOUNT_CATEGORY_INVALID`, `TAX_ACCOUNT_REQUIRED`, `TAX_PROOF_TYPE_REQUIRED`)
- Test: `tests/unit/settings-forms.test.ts`, `tests/unit/api-errors.test.ts` (perluas)

**Interfaces:**
- Consumes: Task 2.
- Produces: `taxPayload(draft: TaxDraft): TaxInput`; `effectiveTaxPercent(percentage: string, dppFactor: string): string`.

Layar (pola Kledo):
- Halaman: judul "Pajak", tombol **Tambah Pajak**, kolom Cari; tabel **Nama · Persen efektif · Akun penjualan · Akun pembelian · Pemotongan (Ya/Tidak) · Aktif (sakelar)**; label kecil "Bawaan penjualan"/"Bawaan pembelian" di bawah nama; sakelar pajak bawaan terkunci dengan keterangan.
- Dialog: **Nama***; **Persen efektif** tampil besar; tautan "Rincian" membuka **Tarif** dan **Bagian harga dikenai pajak** (Penuh / 11/12 dari harga) yang membentuk persen efektif; **Pemotongan** (sakelar) — bila aktif tampil **Jenis bukti** (Bukti potong / SSP-NTPN) dan **Bukti wajib**; **Akun penjualan** dan **Akun pembelian** (pilihan akun dengan keterangan jenis akun yang diharapkan, mis. "Akun kewajiban, mis. PPN Keluaran"); Batal / Simpan.
- Kartu "Pajak bawaan" lama dihapus; pengaturan bawaan lewat menu baris "Jadikan bawaan penjualan/pembelian".

- [ ] **Step 1: Write the failing tests**: `effectiveTaxPercent("12", "0.9166666667")` → `"11.0000"`; `taxPayload` mengirim `withholding` dan aturan bukti hanya bila Pemotongan aktif; kode error baru diterjemahkan dengan tautan `/setting/tax`.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/settings-forms.test.ts tests/unit/api-errors.test.ts` → FAIL.
- [ ] **Step 3: Implement** layar.
- [ ] **Step 4: Run** → PASS; `pnpm --filter @evflow/office build` → sukses.
- [ ] **Step 5: Commit** `feat(office): Kledo-style tax list with withholding flag`

### Task 4: Sinkronisasi blueprint dan QA browser

**Files:**
- Modify: `docs/erp-blueprint/12-finance-administration.md` (pajak dua akun, Pemotongan, Jenis Potongan non-pajak), `15-setting.md`, `02-requirements.md`, `03-database.md`, `04-api.md`, `07-design.md`; catat bahwa baris potongan pada Terima Pembayaran (tahap 3) memakai pajak bertanda Pemotongan untuk PPh dan Jenis Potongan untuk non-pajak
- Create: `docs/development/so-mudah-bagian-6-2026-10-25.md`

- [ ] **Step 1: Sinkronkan** dokumen; tidak menambah aturan di luar spec dan keputusan pembangun.
- [ ] **Step 2: QA browser** (viewport 1366 dan 390): daftar menampilkan PPN 11% dengan dua akun, PPh 22/23 dan PPN dipungut bertanda Pemotongan; coba simpan PPN dengan akun penjualan "PPN Masukan" → ditolak dengan pesan jenis akun; coba nonaktifkan PPN bawaan → ditolak; buat SO sampai invoice → PPN terposting ke PPN Keluaran; Jenis Potongan hanya berisi Biaya transfer. Catat bukti.
- [ ] **Step 3: Run** `pnpm vitest run` dan `./tools/validate-repository.ps1` → lulus.
- [ ] **Step 4: Commit** `docs(tax): sync blueprint and QA evidence for Kledo-style tax settings`
