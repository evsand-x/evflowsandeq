# Tahap 2b — Konsolidasi Pengaturan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Semua pengaturan berada di satu tempat (Setting) dan bersifat umum: setiap submenu punya izin sendiri, format nomor `Prefix.Tahun.Bulan.Urut`, pajak penjualan bawaan menggantikan aturan per pelanggan × produk, jenis potongan, pemetaan akun, atribut kredit pelanggan, batas diskon, dan halaman `/operations/controls` dihapus.

**Architecture:** Lanjutan tahap 2 di branch `docs/erp-fleksibel`. Pengaturan disimpan di tabel/kolom yang sudah ada bila memungkinkan (`document_number_rules`, `operational_taxes`, `customers`, `roles`, `company_memberships`, `products`, `system_policies`) dan satu tabel baru `deduction_types`. Izin per submenu Setting ditambahkan lewat migration seperti `20261005190000_o2c_release_controls` dan ditegakkan backend. UI baru memakai `SettingFrame`/`SettingSection` dari tahap 2.

**Tech Stack:** NestJS + Prisma (PostgreSQL), Next.js App Router + TanStack Query, Vitest + Supertest.

**Spec:** `docs/superpowers/specs/2026-10-24-konsolidasi-pengaturan-design.md` (bagian 5, 5.8, 6, 7 baris 2b). Requirement: CFG-11, IAM-06, IAM-14, FIN-08, FIN-17, FIN-18 (bagian pengaturan), MD-05, OTC-18 (bagian batas) di `docs/erp-blueprint/02-requirements.md`.

## Global Constraints

- Satu menu satu rumah (CFG-11): menu salah tempat dihapus, tidak digandakan; pengaturan hanya di Setting.
- Tidak ada aturan baru per pelanggan × produk atau per pelanggan × pajak.
- Setiap submenu Setting punya izin `*.read` dan `*.update`/`*.manage` sendiri; backend menegakkan per kelompok; Pengguna/Peran/Hak Akses tetap khusus Admin Sistem.
- Uang, persen dan tarif memakai `Decimal`/string decimal; tidak memakai JavaScript `number` untuk perhitungan.
- Dokumen yang sudah terbit memakai snapshot; perubahan pengaturan hanya berlaku ke depan.
- Nilai bawaan adalah data (`packages/database/src/data/*.json`) yang di-provision idempotent, bukan konstanta kode.
- Mutasi memakai sesi, CSRF, `If-Match` atau `Idempotency-Key`, dan audit.
- Label layar bahasa bisnis; tidak menampilkan kode teknis.
- Database development boleh di-reset ulang dengan seed (`docs/development/setting-hub-2026-10-24.md`) setelah persetujuan pengguna; production belum ada.

## Review Focus

1. Admin mengganti reset tahunan → bulanan di tengah bulan — perubahan baru berlaku awal bulan depan; bulan ini nomor tetap melanjutkan urutan lama tanpa ganda. Test: Task 2 `reset change waits for the next period`.
2. Panjang nomor urut diperkecil di bawah urutan berjalan — ditolak dengan pesan, bukan memblokir semua dokumen. Test: Task 2 `rejects digits below the running counter`.
3. Pemegang izin Kebijakan Umum mencoba mengubah mode kredit atau jenis potongan lewat API langsung — 403. Test: Task 1 `granting one Setting submenu does not open another`.
4. SO untuk pelanggan dan produk tanpa aturan pajak lama — tetap jalan memakai PPN bawaan (12% × 11/12) dengan snapshot. Test: Task 4 `uses the default sales tax without a per-pair rule`.
5. Dua admin mengedit Profil/Kebijakan Umum bersamaan — simpan kedua 412 dan isian tetap. Test: Task 3 `locks the version at edit start`.

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `packages/database/prisma/migrations/20261024110000_setting_consolidation/migration.sql` (create) | Kolom/tabel baru dan izin per submenu Setting |
| `packages/database/prisma/schema.prisma` (modify) | `DocumentNumberRule.yearFormat/resetPeriod`, `OperationalTax.dppFactor/isDefaultSales/isDefaultPurchase`, kolom kredit/termin/kode faktur di `Customer`, `Role.discountLimit`, `CompanyMembership.discountLimit`, `Product.discountLimit`; model `DeductionType` |
| `packages/database/src/data/*.json` (modify/create) | `operational-policies.json` (hapus `OPS-COMP-01..03`, `OPS-FLX-05`; tambah `OPS-FLX-09`), `numbering-defaults.json` (format baru), `tax-defaults.json`, `deduction-types.json` |
| `packages/backend/src/administration/setting-permissions.ts` (create) | Peta kelompok kebijakan → izin |
| `packages/backend/src/common/document-number.ts` (modify) | Format baru, reset bulanan/tahunan, validasi revisi |
| `packages/backend/src/administration/company-defaults.ts` (modify) | Provision pajak bawaan dan jenis potongan |
| `packages/backend/src/finance/operational-tax.ts` (modify) | Faktor DPP, pajak bawaan, `defaultSalesTaxSnapshot` |
| `packages/backend/src/sales/pricing-controls.ts`, `sales/proforma.ts`, `otc-ptp.service.ts`, `sales/operations.service.ts` (modify) | Pajak dari bawaan; berhenti membaca `SalesTaxRule` |
| `packages/backend/src/sales/transaction-controls.ts` (modify) | Kredit membaca atribut pelanggan |
| `packages/backend/src/finance/deduction-types.ts` + controller (create) | CRUD Jenis Potongan |
| `packages/backend/src/sales/discount-limit.ts` (create) | `effectiveDiscountLimit` (dipakai tahap 3) |
| `apps/office/app/setting/{general,tax,terms,deductions,account-mapping}/page.tsx` (create) | Halaman Setting baru |
| `apps/office/lib/navigation.ts`, `dashboard-sidebar.tsx`, `access-matrix-navigation.ts` (modify) | Peta menu baru, hapus menu salah tempat |
| `apps/office/app/operations/controls.tsx`, cabang `controls` di `workspace.tsx` (delete/modify) | Hapus halaman controls |

---

### Task 1: Izin per submenu Setting

**Files:** migration (izin), `packages/backend/src/administration/setting-permissions.ts` (create), `administration.controller.ts` (modify), `apps/office/lib/navigation.ts` (`settingPermissions`), `access-matrix-navigation.ts` (baris Setting). Test: `apps/api/test/setting-permissions.e2e.test.ts`, `tests/unit/setting-permissions.test.ts`.

**Interfaces:**
- Produces: kode izin baru `setting_general.read/update`, `tax_setting.read/update`, `terms_credit.read/update`, `deduction_type.read/manage`, `account_mapping.read/manage`, `customer_credit.update`, `discount_limit.manage`, `special_price.approve` (dipakai tahap 3).
- Produces: `policyPermission(group: string, action: "read" | "update"): string` — `company`/`system`/`finance`/`warehouse`/`crm`/`visit`/`hr` → `setting_general.*`; `sales` → `terms_credit.*`.
- Consumes: `GET/PATCH /operational-policies[/:code]` memeriksa `policyPermission(policy.group, …)` per kebijakan, menggantikan `operational_policy.*` tunggal.

- [ ] **Step 1: Write failing tests** — unit `maps every catalog group to a submenu permission`; e2e `granting one Setting submenu does not open another`: principal hanya `setting_general.update` → `PATCH /operational-policies/OPS-FLX-01` 403, `PATCH /operational-policies/OPS-SYS-05` melewati guard; principal hanya `terms_credit.update` → kebalikannya; `GET /operational-policies` hanya mengembalikan kebijakan yang kelompoknya dapat dibaca.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** migration (pola `INSERT … ON CONFLICT DO NOTHING`; grant baru diberikan ke peran yang sebelumnya memegang `operational_policy.*` dengan cakupan sama, tanpa memperluas hak lain), peta, pemeriksaan per kebijakan, `settingPermissions` dan baris matriks baru. **Step 4: Run** → PASS; `pnpm typecheck`.
- [ ] **Step 5: Commit** — `feat(setting): independent permission per Setting submenu`

### Task 2: Format nomor `Prefix.Tahun.Bulan.Urut`

**Files:** migration (kolom `year_format` `YYYY|YY` default `YYYY`, `reset_period` `YEARLY|MONTHLY` default `YEARLY`; `reset_yearly` dipetakan lalu dibuang), `document-number.ts`, `numbering-defaults.json`, `apps/office/app/setting/numbering/page.tsx`, `settings-forms.ts`. Test: `tests/unit/document-number-format.test.ts`, `tests/integration/settings-numbering.test.ts`, `tests/unit/settings-forms.test.ts`.

**Interfaces:**
- Produces: `formatDocumentNumber(rule: { prefix: string; yearFormat: "YYYY" | "YY"; digits: number }, day: string /* YYYY-MM-DD zona perusahaan */, value: bigint): string` → `${prefix}.${YYYY|YY}.${MM}.${urut}`.
- Produces: `sequenceKey(kind: string, resetPeriod: "YEARLY" | "MONTHLY", day: string)` = `${kind}:${YYYY}` atau `${kind}:${YYYY}-${MM}`.
- Produces: `reviseNumbering(c, a, kind, { prefix, year_format, digits, reset_period }, key)`: perubahan selain `reset_period` berlaku hari ini; perubahan `reset_period` membuat aturan baru berlaku mulai awal periode berikutnya (1 bulan depan untuk ke-bulanan, 1 Januari untuk ke-tahunan); respons memuat `effective_from`.
- Produces: `GET /settings/numbering` menambah `year_format`, `reset_period`, `pending` (aturan terjadwal bila ada).
- `nextDocumentNumber(tx, c, kind, at?: Date)` menerima tanggal opsional untuk test.

Nilai bawaan baru `numbering-defaults.json`: prefix `SO`, `PRO`, `PCK`, `PL`, `SJ`, `FUL`, `INV`, `CN`, `PO`, `GR`, `SINV`; `year_format: "YYYY"`, `reset_period: "MONTHLY"`, `digits: 4` — contoh `SO.2026.10.0001`; pengguna dapat mengubah prefix menjadi `SO-SSM`.

- [ ] **Step 1: Write failing tests** — unit `formats monthly`: `formatDocumentNumber({prefix:"SO-SSM",yearFormat:"YYYY",digits:4},"2026-10-24",1n)` → `"SO-SSM.2026.10.0001"`; `formats short year` → `"SO-SSM.26.10.0001"`; integration `monthly reset restarts next month` (Oktober 0003 → November 0001), `yearly reset continues across months` (Oktober 0003 → November 0004), `reset change waits for the next period` (ganti ke bulanan pada 24 Oktober → nomor Oktober berikutnya melanjutkan; aturan baru `effective_from` 2026-11-01), `rejects digits below the running counter` (urutan 1234, digits 3 → 409 `NUMBERING_DIGITS_TOO_SHORT`), `prefix change keeps the counter`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**; dialog: prefix, format tahun, panjang urut, toggle Reset bulanan/tahunan, pratinjau, catatan "Perubahan reset berlaku mulai {tanggal}". `translateProblem` menerjemahkan `NUMBERING_DIGITS_TOO_SHORT` dan `DOCUMENT_NUMBER_EXHAUSTED` (tautan `/setting/numbering`). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** — `feat(setting): Prefix.Year.Month.Sequence numbering with monthly or yearly reset`

### Task 3: Kebijakan Umum dan versi edit terkunci

**Files:** `administration.service.ts`/`controller.ts`, `packages/contracts/src/index.ts` (`companyProfileUpdateSchema`), `operational-policies.json` (hapus `OPS-COMP-01..03`, `OPS-FLX-05`), `company-defaults.ts` (kebijakan yang tidak ada di katalog tidak ditampilkan), `apps/office/app/setting/general/page.tsx` (menggantikan `/setting/policies`), `company/page.tsx`, `settings-ui.tsx`. Test: `tests/unit/settings-forms.test.ts`, `apps/api/test/company-profile.e2e.test.ts`, provisioning integration.

**Interfaces:**
- Produces: `PATCH /company-profile` menerima `timezone` (IANA, divalidasi `Intl.supportedValuesOf("timeZone")`), `fiscal_year_start_month` 1–12, `fiscal_year_start_day` 1–28; `base_currency` tetap `IDR` dan hanya ditampilkan.
- Produces: `useVersionedDraft<T>(source: { version: number; value: T } | undefined)` di `settings-ui.tsx` — mengunci versi saat edit pertama; dipakai Profil dan Kebijakan Umum.
- Produces: editor format angka (`OPS-FLX-06`): pemisah ribuan, pemisah desimal, desimal uang, desimal qty; setelah simpan memanggil `setFormatterDefaults` dan invalidasi preferensi.

- [ ] **Step 1: Write failing tests** — `locks the version at edit start`, e2e `rejects unknown timezone`, integration `hides policies removed from the catalog`.
- [ ] **Step 2–4:** Implement; `/setting/policies` dialihkan ke `/setting/general`; run → PASS.
- [ ] **Step 5: Commit** — `feat(setting): general settings page and version-locked edits`

### Task 4: Pajak di Setting dan pajak bawaan pada dokumen

**Files:** migration (`operational_taxes.dpp_factor` decimal(24,10) default 1, `is_default_sales`, `is_default_purchase`, partial unique index per perusahaan untuk masing-masing), `operational-tax.ts`, `tax-defaults.json` (PPN Penjualan 12% × 11/12 akun `2-20500` default sales; PPN Masukan 12% × 11/12 akun `1-10500` default purchase), `company-defaults.ts`, `pricing-controls.ts`, `proforma.ts`, `otc-ptp.service.ts` (ongkir), `operations.service.ts`, `apps/office/app/setting/tax/page.tsx` (master pajak dipindah dari bagian Daftar & Aturan Pajak `tax-workspace.tsx`; Faktur Keluaran/Masukan tetap di Finance). Test: `tests/integration/default-sales-tax.test.ts`, `tests/unit/default-tax.test.ts`.

**Interfaces:**
- Produces: `defaultSalesTaxSnapshot(tx, companyId, at: Date)` → bentuk sama dengan `operationalTaxSnapshot` ditambah `dpp_factor`; tanpa default → `ConflictException("DEFAULT_SALES_TAX_REQUIRED")` (diterjemahkan dengan tautan `/setting/tax`).
- Consumes: baris SO tanpa `operational_tax_id` dan ongkir `TAXABLE` memakai `defaultSalesTaxSnapshot`. `SalesTaxRule` tidak dibaca lagi oleh SO/proforma/ongkir; tabelnya dibiarkan sebagai arsip; endpoint pembuatannya dan UI-nya dihapus.
- `lineAmounts` tetap memakai `dpp_factor` dari snapshot; faktor 11/12 disimpan sebagai decimal dengan presisi kolom dan pembulatan baris mengikuti `decimal_places`/`rounding` pajak.

- [ ] **Step 1: Write failing tests** — `uses the default sales tax without a per-pair rule` (pelanggan/produk tanpa `SalesTaxRule`: submit SO sukses, snapshot rate `0.12`, PPN baris = 11% DPP harga setelah pembulatan), `only one default sales tax` (menandai pajak lain sebagai default mencabut yang lama dalam satu transaksi), `snapshot survives rate change`.
- [ ] **Step 2–4:** Implement, run → PASS; jalankan `tests/integration/otc-controls.test.ts`, sesuaikan fixture lama yang membuat `SalesTaxRule` agar memakai pajak bawaan, dan catat hasil terhadap baseline.
- [ ] **Step 5: Commit** — `feat(tax): default sales tax replaces per customer-product rules`

### Task 5: Termin & Kredit dan atribut kredit pelanggan

**Files:** migration (`customers.credit_limit` decimal null, `credit_frozen` bool default false, `freeze_reason` text null, `past_due_grace_days` int null, `default_term_code` text null, `default_tax_invoice_code` char(2) default `'01'`; salin data dari `customer_payment_policies` yang berlaku), `master.service.ts` (izin `customer_credit.update` untuk kolom kredit), `transaction-controls.ts` (baca atribut pelanggan), `apps/office/app/master-data/customers/customer-form.tsx` (seksi Kredit & Termin), `apps/office/app/setting/terms/page.tsx` (pindahan `/setting/sales`). Test: `tests/integration/customer-credit-attributes.test.ts`, `tests/unit/customer-workspace.test.ts`.

**Interfaces:**
- Produces: `customerCredit(tx, companyId, customerId)` → `{ limit: Decimal | null; frozen: boolean; graceDays: number | null; defaultTerm: string | null }`.
- Validasi: `default_term_code` harus `code` aktif di `OPS-FLX-03`; `default_tax_invoice_code` ∈ `01`–`10`.

- [ ] **Step 1: Write failing tests** — `edits credit fields only with customer_credit.update` (tanpa izin kredit → field kredit 403, field lain tersimpan), `copies active payment policies`, `credit check reads customer attributes`.
- [ ] **Step 2–4:** Implement, run → PASS.
- [ ] **Step 5: Commit** — `feat(credit): credit attributes on the customer and Setting terms page`

### Task 6: Jenis Potongan

**Files:** migration (`deduction_types`: id, company_id, name unik per perusahaan, settle_account_id → finance_accounts, proof_type `BUKTI_POTONG|SSP_NTPN|NONE`, proof_required bool, active, version, created/updated), `deduction-types.json` (PPN dipungut → `2-20500`, SSP_NTPN, wajib; PPh 22 → `1-10502`, BUKTI_POTONG, wajib; PPh 23 → `1-10502`, BUKTI_POTONG, wajib; Biaya transfer → `8-80999`, NONE, tidak wajib), `company-defaults.ts`, `packages/backend/src/finance/deduction-types.ts` + `deduction-types.controller.ts`, `apps/office/app/setting/deductions/page.tsx`. Test: `tests/integration/deduction-types.test.ts`, `apps/api/test/deduction-types.e2e.test.ts`.

**Interfaces:**
- Produces: `GET/POST /settings/deduction-types`, `PATCH /settings/deduction-types/:id` (If-Match), izin `deduction_type.read/manage`; akun harus DETAIL dan aktif; perubahan diaudit.
- Produces: `listActiveDeductionTypes(tx, companyId)` (dipakai Terima Pembayaran tahap 3).

- [ ] **Step 1: Write failing tests** — `provisions four default deduction types`, `rejects header or inactive account`, `stale edit returns 412`, e2e `deduction_type.manage required`.
- [ ] **Step 2–4:** Implement, run → PASS.
- [ ] **Step 5: Commit** — `feat(setting): deduction types with settlement account and proof rules`

### Task 7: Pemetaan Akun di Setting

**Files:** komponen jurnal otomatis (path `accounting` di `OperationsWorkspace`) dipakai di `apps/office/app/setting/account-mapping/page.tsx`; endpoint profil posting memakai `account_mapping.read/manage`. Test: e2e izin, unit navigasi.

- [ ] **Steps:** tulis test gagal (`account_mapping.manage required`; menu Finance tidak memuat "Pengaturan Jurnal Otomatis") → implement → PASS → commit `feat(setting): account mapping lives in Setting`.

### Task 8: Batas diskon (pengaturan)

**Files:** migration (`roles.discount_limit`, `company_memberships.discount_limit`, `products.discount_limit` decimal(7,4) null), `operational-policies.json` (`OPS-FLX-09` bawaan perusahaan, string decimal atau null, default null, kelompok `sales`), `packages/backend/src/sales/discount-limit.ts`, detail Peran (isian batas), detail Pengguna (isian batas per orang), form Produk (isian batas produk), `GET /settings/discount-limit/me?product_id=` untuk UI tahap 3. Test: `tests/unit/discount-limit.test.ts`, e2e izin `discount_limit.manage`.

**Interfaces:**
- Produces: `effectiveDiscountLimit(input: { isAdmin: boolean; personLimit: Decimal | null; roleLimits: Decimal[]; companyDefault: Decimal | null; productLimit: Decimal | null }): Decimal | "UNLIMITED"` — admin → `UNLIMITED`; orang = `personLimit ?? max(roleLimits) ?? companyDefault ?? 0`; hasil = `min(orang, productLimit)` bila `productLimit` ada.

- [ ] **Step 1: Write failing tests** — `person overrides role`, `highest role wins`, `company default only when person and roles are empty`, `product cap wins when smaller`, `no limits means zero`, `admin unlimited`.
- [ ] **Step 2–4:** Implement, run → PASS.
- [ ] **Step 5: Commit** — `feat(sales): discount limit settings per role, person and product`

### Task 9: Satu menu satu rumah dan pesan error bertautan

**Files:** hapus `apps/office/app/operations/controls.tsx` dan cabang `controls` di `workspace.tsx`; kelayakan stok (`inventory.quality.decide`) dipindah ke route Warehouse › Persediaan; `navigation.ts` (`moduleNavigation`, `menuRoutes`, `settingPermissions`) sesuai tabel desain 5.1 — Setting: Profil Perusahaan, Pengguna, Peran, Kebijakan Umum, Penomoran Dokumen, Pajak, Termin & Kredit, Jenis Potongan, Pemetaan Akun; hapus Finance › Kredit & TOP Pelanggan, Finance › Pajak › Daftar & Aturan Pajak, Finance › Akuntansi › Pengaturan Jurnal Otomatis, Setting › Pengaturan Persetujuan (kembali di tahap 4); `access-matrix-navigation.ts`; hub `/setting`; `PageNotice` merender tautan `problem.settings_href` ("Buka pengaturan"); `translateProblem` menerjemahkan `POSTING_PROFILE_REQUIRED_OR_CONFLICTING` (→ `/setting/account-mapping`), `DEFAULT_SALES_TAX_REQUIRED` (→ `/setting/tax`), `IDEMPOTENCY_PAYLOAD_MISMATCH`. Test: `tests/unit/navigation-visibility.test.ts`, `apps/office/lib/navigation.test.ts`, `apps/office/lib/access-matrix-navigation.test.ts`, `tests/unit/api-errors.test.ts`.

- [ ] **Step 1: Write failing tests** — `each menu has exactly one home` (tidak ada href sama di dua modul, tidak ada `/operations/controls`), `Setting lists the consolidated submenus in order`, `translates posting profile conflict with a link`, `page notice renders the settings link`.
- [ ] **Step 2–4:** Implement, run → PASS.
- [ ] **Step 5: Commit** — `feat(office): one home per menu and error links to Setting`

### Task 10: Seed ulang, QA browser, dokumen

- [ ] **Step 1:** Perbarui seed development (pajak bawaan, jenis potongan, kredit pelanggan). Minta persetujuan pengguna untuk `prisma migrate reset` database development, lalu `db:seed:dev`, `db:seed:full`, `db:seed:crm`; build `contracts`, `database`, `backend` sebelum restart API.
- [ ] **Step 2:** QA route operasional (Admin Sistem dan peran yang hanya punya `setting_general.read`): ubah prefix SO menjadi `SO-SSM` lalu buat SO; ganti reset dan lihat tanggal berlaku; Pajak menampilkan PPN bawaan; Jenis Potongan; kredit di pelanggan; sidebar sesuai tabel 5.1; lebar 1600px dan 390px.
- [ ] **Step 3:** Perbarui `15-setting.md`, `04-api.md`, `08-features.md` (2b selesai, tautan rencana), catatan `docs/development/setting-consolidation-2026-10-24.md`; jalankan `pnpm typecheck`, test baru + suite penuh (bandingkan baseline 40 kegagalan lama), `./tools/validate-repository.ps1`.
- [ ] **Step 4: Commit** — `docs(setting): record settings consolidation`

## Tidak termasuk tahap ini

Pemeriksaan diskon dan harga otomatis di SO, Harga Khusus (pengajuan/persetujuan), kode faktur pada invoice, Terima Pembayaran dengan potongan dan bukti potong, retur — tahap 3. Mesin persetujuan umum — tahap 4.
