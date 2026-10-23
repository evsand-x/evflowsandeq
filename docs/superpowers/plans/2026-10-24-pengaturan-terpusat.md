# Pengaturan Terpusat dan Nilai Bawaan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setiap perusahaan langsung punya konfigurasi transaksi bawaan yang dapat diedit (penomoran, termin, mode kredit, ongkir, format angka), dikelola dari satu halaman Setting, dan menu yang belum berfungsi tidak lagi tampil.

**Architecture:** Nilai bawaan disimpan sebagai data: kebijakan `OPS-FLX-*` di katalog `operational-policies.json` (tabel `system_policies`/`policy_versions` yang sudah ada) dan aturan penomoran bawaan di file data baru. Satu fungsi provisioning idempotent membuat baris yang belum ada tanpa menimpa nilai yang sudah diedit pengguna; seed development memakainya. Database development di-reset dan diisi perusahaan dummy baru; 156 akun impor dipertahankan lewat file data. Office mendapat hub `/setting` dengan halaman Profil Perusahaan, Penomoran Dokumen, Penjualan (termin/ongkir/kredit) dan Kebijakan Operasional. Navigasi memakai satu peta route yang menentukan menu mana yang tampil.

**Tech Stack:** NestJS + Prisma (PostgreSQL), Next.js App Router + TanStack Query, Vitest + Supertest.

**Spec:** `docs/superpowers/specs/2026-10-24-erp-fleksibel-design.md` (bagian 7.1, 7.7, 8 langkah 2) dan requirement CFG-08, CFG-09, CFG-10, IAM-06, IAM-10 di `docs/erp-blueprint/02-requirements.md`, nilai `OPS-FLX-01..08` di `docs/erp-blueprint/40-kebijakan-operasional-konfigurasi.md`.

## Global Constraints

- Nilai bawaan adalah data konfigurasi, bukan konstanta kode (CFG-08, AGENTS.md). Kode boleh membaca file data `packages/database/src/data/*.json`, tidak boleh menyalin nilainya ke kode.
- Provisioning tidak pernah menimpa kebijakan atau aturan penomoran yang sudah ada; hanya membuat yang hilang.
- Perubahan pengaturan hanya berlaku untuk dokumen baru; dokumen terbit tetap memakai snapshot.
- Counter penomoran tidak di-reset saat format diubah; nomor terpakai tidak didaur ulang (IAM-06).
- Hanya Rupiah (`baseCurrency` tetap `IDR`); format angka dari `OPS-FLX-06` (CFG-09).
- Pengguna, Peran dan Hak Akses tetap khusus Admin Sistem; halaman Setting lain memakai izin per submenu: `company_profile.read/update`, `numbering_rule.read/manage`, `operational_policy.read/update`.
- Uang tidak memakai JavaScript `number` untuk perhitungan; formatter tampilan menerima string decimal.
- Setiap mutasi memakai sesi, CSRF, `If-Match` (kebijakan/profil) atau `Idempotency-Key` (penomoran), dan audit.
- Label layar berbahasa bisnis (dokumen 41); tidak menampilkan kode `OPS-*` sebagai label utama.
- Menu/submenu tanpa route tidak tampil di sidebar maupun matriks izin; grant tersimpan tidak dihapus (CFG-10).

## Review Focus

1. Bagan akun hilang atau berubah setelah reset — 156 akun impor (kode, nama, kategori, induk, Header/Detail, saldo normal, PSAK 118, status) dan pemetaan akun posting harus kembali persis sama. Test: Task 0 `restores the exported chart exactly`.
2. Mengubah format nomor di tengah tahun — nomor berikutnya memakai prefix baru tetapi melanjutkan urutan, bukan mulai dari 1. Test: Task 2 `revision keeps the running counter`.
3. Dua admin menyimpan kebijakan yang sama bersamaan — yang kedua mendapat 412, bukan menimpa diam-diam. Test: Task 4 `stale policy save shows conflict and keeps form values`.
4. Pengguna tanpa izin membuka `/setting/numbering` langsung lewat URL atau API — ditolak 403, dan menunya tidak tampil. Test: Task 2 `rejects manage without numbering_rule.manage` dan Task 5 `hides Setting items without permission`.
5. Transaksi gagal karena penomoran dinonaktifkan pengguna — pesan menjelaskan dan menautkan ke Setting, bukan kode mentah. Test: Task 2 `translates numbering conflict into a Setting link`.

---

## File Structure

| File | Tanggung jawab |
|---|---|
| `packages/database/src/data/operational-policies.json` (modify) | Tambah 8 kebijakan `OPS-FLX-01..08` |
| `packages/database/src/data/numbering-defaults.json` (create) | Daftar jenis dokumen + label + prefix + digit bawaan |
| `packages/backend/src/administration/company-defaults.ts` (create) | `provisionCompanyDefaults` idempotent |
| `packages/database/prisma/seed.ts` (modify) | Loop kebijakan diganti pemanggilan provisioning |
| `packages/database/src/data/chart-of-accounts.json` (create, Task 0) | Ekspor 156 akun impor + pemetaan akun posting |
| `tools/export-chart-of-accounts.ts` (create, Task 0) | Ekspor sekali sebelum reset |
| `packages/backend/src/finance/chart-of-accounts-import.ts` (create, Task 0) | `importChartOfAccounts` idempotent dari file data |
| `tools/seed-development.ts` (modify, Task 0) | Perusahaan dummy baru + akun dari file data + nilai bawaan |
| `packages/backend/src/common/document-number.ts` (modify) | `formatDocumentNumber`, `reviseNumbering`, `listNumberingSettings` |
| `packages/backend/src/administration/settings.controller.ts` (create) | `GET /settings/preferences`, `GET/PUT /settings/numbering[/:kind]` |
| `apps/office/lib/format.ts` (create) | `formatMoney`, `formatQuantity` berbasis `OPS-FLX-06` |
| `apps/office/lib/settings.ts` (create) | Hook `usePreferences`, `usePolicy`, `savePolicy` |
| `apps/office/app/setting/page.tsx` (create) | Hub Pengaturan |
| `apps/office/app/setting/company/page.tsx` (create) | Profil Perusahaan |
| `apps/office/app/setting/numbering/page.tsx` (create) | Penomoran Dokumen |
| `apps/office/app/setting/sales/page.tsx` (create) | Termin, Ongkos Kirim, Kredit |
| `apps/office/app/setting/policies/page.tsx` (create) | Kebijakan Operasional (nilai skalar) |
| `apps/office/lib/navigation.ts` (modify) | `menuRoutes`, `isMenuAvailable`, `visibleMenuItems` |
| `apps/office/app/dashboard-sidebar.tsx` (modify) | Pakai `visibleMenuItems`; hapus label "Belum tersedia" |
| `apps/office/lib/access-matrix-navigation.ts` (modify) | Sembunyikan baris menu tanpa route |
| `apps/office/lib/api.ts` (modify) | Terjemahkan `NUMBERING_RULE_REQUIRED_OR_CONFLICTING:*` |

---

### Task 0: Simpan bagan akun, reset database development, data dummy baru

Keputusan pengguna 24 Oktober 2026: seluruh transaksi dan nama perusahaan di database development tidak perlu disimpan; database di-reset dan diisi data dummy baru. **156 akun impor dipertahankan** sebagai fondasi Finance. Sumber akun hanya ada di database, jadi ekspor wajib selesai dan diverifikasi sebelum reset.

**Files:**
- Create: `tools/export-chart-of-accounts.ts`, `packages/database/src/data/chart-of-accounts.json`
- Create: `packages/backend/src/finance/chart-of-accounts-import.ts`
- Modify: `tools/seed-development.ts`, `tools/seed-full-development.ts` (hapus ketergantungan pada audit `account_migration.completed`; akun berasal dari file data), `tools/migrate-imported-accounts.ts` (dihapus setelah pemetaannya pindah ke file data)
- Test: `tests/integration/chart-of-accounts-import.test.ts`

**Interfaces:**
- Produces: `chart-of-accounts.json` = `{ accounts: Array<{ code; name; category; category_label; account_type: "HEADER"|"DETAIL"; normal_balance: "DEBIT"|"CREDIT"; parent_code: string|null; psak118_category: string|null; description: string|null; control_kind: string|null; active: boolean }>, posting_accounts: Record<string, string> }` — `posting_accounts` berisi pemetaan `targets` dari `tools/migrate-imported-accounts.ts` (AR → `1-10100`, SALES_TAX → `2-20500`, dst.)
- Produces: `importChartOfAccounts(tx: Prisma.TransactionClient, companyId: string, actorId: string): Promise<{ created: number }>` — membuat akun yang belum ada (induk dulu), lalu pemetaan akun posting; idempotent; audit `chart_of_accounts.imported`

- [ ] **Step 1: Ekspor** — `tools/export-chart-of-accounts.ts` membaca akun aktif perusahaan `00000000-0000-4000-8000-000000000001` (akun template lama yang sudah dinonaktifkan tidak ikut) dan pemetaan posting yang sedang dipakai, lalu menulis JSON terurut kode. Jalankan; pastikan `accounts.length === 156` dan setiap `parent_code` ada di daftar. Commit file JSON **sebelum** langkah reset: `chore(finance): export imported chart of accounts`.
- [ ] **Step 2: Write the failing test** `tests/integration/chart-of-accounts-import.test.ts` (perusahaan uji baru dalam transaksi rollback): `restores the exported chart exactly` — setelah impor, 156 akun dengan field sama persis seperti JSON (bandingkan kode, nama, kategori, induk, tipe, saldo normal, PSAK 118, status); `is idempotent` — impor kedua `created === 0`; pemetaan posting `SALE_REVENUE` menunjuk akun `4-40000`.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** `importChartOfAccounts`. **Step 5: Run** → PASS.
- [ ] **Step 6: Ubah seed development** — `tools/seed-development.ts` membuat perusahaan dummy baru bernama `PT LIVIANA DWI BERKAT` (data uji; penanda fiktif disimpan di audit seed, bukan di nama) (dapat diganti di Profil Perusahaan), admin demo dengan password dari env `DEV_DEMO_RESET_PASSWORD`, menjalankan `importChartOfAccounts` dan `provisionCompanyDefaults` (Task 1). Data dummy transaksi (`db:seed:full`, `db:seed:crm`) tetap memakai command domain dan `assertDevelopmentSeed`.
- [ ] **Step 7: Reset** — hanya setelah Step 1 ter-commit dan Task 1 selesai: `pnpm --filter @evflow/database exec prisma migrate reset --force --skip-seed` terhadap DB lokal (pastikan `DATABASE_URL` host `localhost`), lalu `pnpm db:seed:dev`, `pnpm db:seed:full`, `pnpm db:seed:crm`. Verifikasi login admin demo, Finance › Akuntansi › Akun menampilkan 156 akun, dan SO baru mendapat nomor `SO-<tahun>-00001`.
- [ ] **Step 8: Commit** — `chore(dev): fresh dummy company seeded from chart file and defaults`

Catatan urutan: Step 1–5 dikerjakan pertama; Step 6–8 dikerjakan setelah Task 1 karena membutuhkan `provisionCompanyDefaults`.

---

### Task 1: Data nilai bawaan dan provisioning idempotent

**Files:**
- Modify: `packages/database/src/data/operational-policies.json`
- Create: `packages/database/src/data/numbering-defaults.json`
- Create: `packages/backend/src/administration/company-defaults.ts`
- Modify: `packages/database/prisma/seed.ts` (loop `for (const definition of policyCatalog)` ±baris 222–258)
- Test: `tests/integration/company-defaults.test.ts`

**Interfaces:**
- Produces: `provisionCompanyDefaults(tx: Prisma.TransactionClient, companyId: string, actorId: string, today?: Date): Promise<{ policies_created: string[]; numbering_created: string[] }>`
- Produces: `numberingDefaults: Array<{ document_kind: string; label: string; prefix: string; digits: number; reset_yearly: boolean }>` diekspor dari `company-defaults.ts` (dibaca dari JSON)

Isi `numbering-defaults.json` (prefix diakhiri `-`, `digits` 5, `reset_yearly` true): `sales_order` "Sales Order" `SO-`; `document_PROFORMA` "Proforma" `PRO-`; `document_PICKING` "Picking Slip" `PCK-`; `document_PACKING` "Packing" `PAK-`; `document_PACKING_LIST` "Packing List" `PL-`; `document_SURAT_JALAN` "Surat Jalan" `SJ-`; `document_INVOICE` "Invoice (dokumen kirim)" `DINV-`; `sales_invoice` "Invoice Penjualan" `INV-`; `credit_note` "Nota Kredit" `CN-`; `fulfillment` "Pemenuhan" `FUL-`; `purchase_order` "Purchase Order" `PO-`; `goods_receipt` "Penerimaan Barang" `GR-`; `supplier_invoice` "Tagihan Supplier" `SINV-`. Sebelum menulis, periksa setiap `kind` yang dipakai backend (`nextDocumentNumber(`, `this.num(tx, c, "…"`, dan `document_${kind}` di `packages/backend/src/sales/document-controls.ts`) ada di daftar; tambahkan yang kurang.

Isi `OPS-FLX-*` mengikuti tabel dokumen 40 (bagian "Nilai bawaan baru"); `group: "sales"` untuk 01–04 dan 07–08, `group: "company"` untuk 05–06; `domain: "administration"`:
- `OPS-FLX-01` `type: "string"`, `schema: {"type":"string","enum":["OFF","WARN","BLOCK"]}`, `default: "WARN"`
- `OPS-FLX-02` `type: "object"`, default `{"enabled":false,"months":3,"mode":"COD"}`, schema `required` ketiganya, `mode` enum `["COD","PREPAY"]`, `months` integer min 1
- `OPS-FLX-03` `type: "array"`, default tujuh termin: `{"code":"COD","label":"Tunai/COD","days":0,"kind":"COD"}`, `{"code":"PREPAY","label":"Bayar sebelum kirim","days":0,"kind":"PREPAY"}`, lalu `NET7`/`NET14`/`NET30`/`NET45`/`NET60` dengan label `Tempo N hari`, `days` N, `kind` `"TEMPO"`; schema `minItems: 1`, item `required: ["code","label","days","kind"]`
- `OPS-FLX-04` `type: "object"`, default `{"mode":"CHARGE_CUSTOMER","tax_position":"BEFORE_TAX"}`, `mode` enum `["COMPANY","CHARGE_CUSTOMER"]`, `tax_position` enum `["BEFORE_TAX","AFTER_TAX"]`
- `OPS-FLX-05` `type: "object"`, default `{"digits":5,"reset_yearly":true}` (acuan pola untuk jenis baru)
- `OPS-FLX-06` `type: "object"`, default `{"currency":"IDR","thousand_separator":".","decimal_separator":",","money_decimals":0,"quantity_decimals":2}`
- `OPS-FLX-07` `type: "boolean"`, default `false` (ada aturan persetujuan SO aktif; dipakai tahap 4)
- `OPS-FLX-08` `type: "boolean"`, default `false` (izinkan persetujuan dokumen sendiri)

- [ ] **Step 1: Write the failing test** — `tests/integration/company-defaults.test.ts`, dalam `prisma.$transaction` yang di-rollback (pola `tests/integration/submenu-migration.test.ts`), guard host lokal:
  - `creates every catalog policy and numbering kind for a new company`: buat company+user; panggil provisioning; `expect(policies_created).toContain("OPS-FLX-03")`; `await nextDocumentNumber(tx, company.id, "sales_order")` menghasilkan `SO-<tahun>-00001`.
  - `is idempotent`: panggilan kedua mengembalikan `{ policies_created: [], numbering_created: [] }`.
  - `skips kinds that already have an active rule`: buat aturan `sales_order` prefix `X-` sebelum provisioning; sesudahnya hanya satu aturan aktif `sales_order` dan prefix tetap `X-`.
  - `never overwrites an edited policy`: buat versi 2 aktif `OPS-FLX-01` = `"BLOCK"`; provisioning; versi aktif tetap `"BLOCK"`.
  - `audits what it created`: ada `auditEvent` `action: "company_defaults.provisioned"` dengan `afterHash` tidak null.

- [ ] **Step 2: Run test to verify it fails**
  Run: `pnpm vitest run tests/integration/company-defaults.test.ts`
  Expected: FAIL — `Cannot find module .../company-defaults`

- [ ] **Step 3: Implement `provisionCompanyDefaults`** di `company-defaults.ts`: baca kedua JSON, upsert `systemPolicy` (update metadata katalog seperti seed sekarang), buat `policyVersion` v1 `ACTIVE` hanya bila policy belum punya versi; untuk numbering, buat `documentNumberRule` (`effectiveFrom` = hari ini zona `company.timezone`, `effectiveTo` = `2999-12-31`) hanya bila tidak ada aturan dengan `effectiveFrom <= today < effectiveTo`. Kunci `SELECT … FROM companies … FOR UPDATE` di awal. Catat satu audit via `AuditService.recordWith`.

- [ ] **Step 4: Ganti loop kebijakan di `seed.ts`** dengan `await prisma.$transaction((tx) => provisionCompanyDefaults(tx, company.id, user.id))`. Seed development (Task 0 Step 6) juga memanggilnya. Tidak ada skrip migrasi untuk perusahaan lama karena database development di-reset.

- [ ] **Step 5: Run tests** — `pnpm vitest run tests/integration/company-defaults.test.ts` PASS; `pnpm typecheck` PASS.


- [ ] **Step 6: Commit** — `feat(setting): seed editable company defaults idempotently`

---

### Task 2: API Pengaturan — preferensi dan penomoran

**Files:**
- Modify: `packages/backend/src/common/document-number.ts`
- Create: `packages/backend/src/administration/settings.controller.ts`; daftarkan di modul yang memuat `AdministrationController`
- Modify: `packages/contracts/src/index.ts`, `apps/office/lib/api.ts`
- Test: `tests/unit/document-number-format.test.ts`, `apps/api/test/settings.e2e.test.ts`, `tests/integration/settings-numbering.test.ts`, `tests/unit/api-errors.test.ts`

**Interfaces:**
- Consumes: `numberingDefaults` (Task 1)
- Produces: `formatDocumentNumber(rule: { prefix: string; digits: number; resetYearly: boolean }, year: string, value: bigint): string` — dipakai juga oleh `nextDocumentNumber` (refactor baris akhirnya)
- Produces: `reviseNumbering(companyId: string, actorId: string, kind: string, input: { prefix: string; digits: number; reset_yearly: boolean }, key: string)` → aturan baru
- Produces: `GET /api/v1/settings/preferences` → `{ data: { company_name: string; logo_object_key: string | null; number_format: NumberFormat } }` (semua sesi terautentikasi; tanpa data sensitif)
- Produces: `GET /api/v1/settings/numbering` → `{ data: Array<{ document_kind; label; prefix; digits; reset_yearly; effective_from; next_preview: string | null; active: boolean }> }` (`numbering_rule.read`)
- Produces: `PUT /api/v1/settings/numbering/:kind` (`numbering_rule.manage`, header `Idempotency-Key`)
- Produces: tipe `NumberFormat = { currency: "IDR"; thousand_separator: string; decimal_separator: string; money_decimals: number; quantity_decimals: number }` di `packages/contracts/src/index.ts`
- Produces: `translateProblem(problem: { detail?: string } | undefined): { message: string; settings_href?: string }` di `apps/office/lib/api.ts`

- [ ] **Step 1: Write the failing unit test** `tests/unit/document-number-format.test.ts`:
  - `formats yearly reset`: `formatDocumentNumber({prefix:"SO-",digits:5,resetYearly:true},"2026",7n)` → `"SO-2026-00007"`
  - `formats without year`: `resetYearly:false` → `"SO-00007"`
  - `rejects overflow`: value `100000n` dengan digits 5 → throw `DOCUMENT_NUMBER_EXHAUSTED`

- [ ] **Step 2: Write the failing e2e test** `apps/api/test/settings.e2e.test.ts` (pola guard `x-test-access` di `apps/api/test/manual-proforma.e2e.test.ts`; principal tiruan wajib berisi `roles: []`):
  - `rejects manage without numbering_rule.manage` → 403
  - `rejects unknown kind` → 404
  - `requires an idempotency key` → 400
  - `preferences returns number format for any session` → 200 dengan `number_format.money_decimals === 0`

  Dan integration test `tests/integration/settings-numbering.test.ts` (DB lokal, perusahaan uji baru + `provisionCompanyDefaults`):
  - `revision keeps the running counter`: ambil 2 nomor `sales_order`; `reviseNumbering(c, a, "sales_order", {prefix:"PJ-",digits:5,reset_yearly:true}, key)`; nomor berikutnya `PJ-<tahun>-00003`; aturan aktif hanya satu
  - `replays the same idempotency key` → hasil identik, hanya satu aturan baru

- [ ] **Step 3: Write the failing test** `tests/unit/api-errors.test.ts`: `translates numbering conflict into a Setting link` — `translateProblem({detail:"NUMBERING_RULE_REQUIRED_OR_CONFLICTING:sales_order"})` → `{ message: "Penomoran dokumen belum diatur. Buka Setting › Penomoran Dokumen untuk mengaktifkannya.", settings_href: "/setting/numbering" }`; detail lain dikembalikan apa adanya.

- [ ] **Step 4: Run tests to verify they fail** — `pnpm vitest run tests/unit/document-number-format.test.ts tests/unit/api-errors.test.ts apps/api/test/settings.e2e.test.ts tests/integration/settings-numbering.test.ts` → FAIL

- [ ] **Step 5: Implement** `formatDocumentNumber`; `reviseNumbering` dalam `transactionCommand` scope `"settings/numbering"` (tutup aturan aktif di hari ini lalu buat aturan dari hari ini s.d. `2999-12-31`; bila aturan aktif dibuat hari ini juga, ubah aturan itu saja agar tidak ada rentang kosong; audit `numbering_rule.revised` before/after); `listNumberingSettings` (label dari `numberingDefaults`; `next_preview` dibaca dari `masterCodeSequence` tanpa mengambil nomor); controller. Validasi `prefix` `^[A-Z0-9/._-]{1,20}$`, `digits` 3–10; `:kind` harus ada di `numberingDefaults`. `parseResponse` di `api.ts` memakai `translateProblem` untuk `ApiError.message` dan menyimpan `settings_href` di `ApiError.problem`.

- [ ] **Step 6: Run tests** → PASS; `pnpm typecheck` PASS.

- [ ] **Step 7: Commit** — `feat(setting): numbering and preferences settings API`

---

### Task 3: Formatter angka bersama

**Files:**
- Create: `apps/office/lib/format.ts`, `apps/office/lib/settings.ts`
- Modify: setiap `function money(` lokal di `apps/office/app` (8 lokasi saat ini, termasuk `apps/office/app/master-data/customers/customer-types.ts` dan `apps/office/app/operations/workspace.tsx`), `apps/office/app/session-provider.tsx`
- Test: `tests/unit/format.test.ts`

**Interfaces:**
- Consumes: `GET /settings/preferences`, tipe `NumberFormat` (Task 2)
- Produces: `formatMoney(value: string | null | undefined, format?: NumberFormat): string` — `null`/`undefined` → `"Belum tersedia"`; tanpa `format` memakai format yang diset `setFormatterDefaults`
- Produces: `formatQuantity(value: string | null | undefined, format?: NumberFormat): string`
- Produces: `usePreferences(): { data?: Preferences; isLoading: boolean }` (query key `["settings","preferences"]`, `staleTime` 5 menit) dan `setFormatterDefaults(format: NumberFormat): void`, dipanggil di `session-provider.tsx` setelah preferensi termuat

- [ ] **Step 1: Write the failing test** `tests/unit/format.test.ts` dengan `fmt` = nilai bawaan `OPS-FLX-06`:
  - `formats rupiah from decimal string without float drift`: `formatMoney("1234567.5", fmt)` → `"Rp 1.234.568"` (half-up, `money_decimals` 0)
  - `keeps large values exact`: `formatMoney("12345678901234.49", fmt)` → `"Rp 12.345.678.901.234"`
  - `negative`: `formatMoney("-2500", fmt)` → `"-Rp 2.500"`
  - `empty`: `formatMoney(null, fmt)` → `"Belum tersedia"`
  - `quantity`: `formatQuantity("10.5", fmt)` → `"10,50"`

- [ ] **Step 2: Run** — `pnpm vitest run tests/unit/format.test.ts` → FAIL

- [ ] **Step 3: Implement** pemformatan berbasis string (pisah bagian bulat/desimal, pembulatan half-up pada string, sisipkan pemisah); tidak memakai `Number()`.

- [ ] **Step 4: Ganti setiap `money()` lokal** dengan impor `formatMoney`; tampilan nilai kosong yang sudah benar dipertahankan.

- [ ] **Step 5: Run** — test PASS, `pnpm typecheck` PASS, `pnpm lint` tanpa error baru di file yang disentuh.

- [ ] **Step 6: Commit** — `feat(office): shared Rupiah formatter driven by settings`

---

### Task 4: Halaman Pengaturan (hub, Profil, Penomoran, Penjualan, Kebijakan)

**Files:**
- Create: `apps/office/app/setting/page.tsx`, `apps/office/app/setting/company/page.tsx`, `apps/office/app/setting/numbering/page.tsx`, `apps/office/app/setting/sales/page.tsx`, `apps/office/app/setting/policies/page.tsx`
- Create: `apps/office/app/setting/settings-forms.tsx` (komponen dan logika form bersama)
- Test: `tests/unit/settings-forms.test.ts`, QA browser

**Interfaces:**
- Consumes: `GET/PATCH /company-profile` (If-Match `profile_version`), `GET /operational-policies[?group=]`, `GET /operational-policies/:code`, `POST /operational-policies/:code/validate`, `PATCH /operational-policies/:code` (If-Match versi), endpoint Task 2, `formatMoney` (Task 3)
- Produces: `policyFormValue(policy): FormValue`, `policyPayload(form: FormValue): { value: unknown }`, `previewDocumentNumber(prefix: string, digits: number, resetYearly: boolean, year: string, next: string): string` di `settings-forms.tsx` (diekspor untuk test)

Semua halaman memakai `SettingShell`, kerangka `OfficePage`/`FormFrame` dari `apps/office/components/web/page-frame.tsx`, dan bagian "Kemudahan pakai" di `docs/mockup/web-design-standard.md`.

- **Hub `/setting`**: kartu per kelompok — Perusahaan (Profil Perusahaan, Kebijakan Operasional), Pengguna & Akses (Pengguna, Peran; hanya Admin Sistem), Penjualan (Termin, Ongkos Kirim & Kredit), Dokumen (Penomoran Dokumen). Kartu hanya tampil bila izinnya ada. Pajak tampil sebagai tautan ke Finance › Pajak bila `sales_tax_rule.manage`.
- **Profil `/setting/company`**: nama (wajib), nama legal, alamat, telepon, email, NPWP, logo; simpan langsung; setelah sukses invalidasi `["settings","preferences"]` dan sesi agar nama di topbar berubah.
- **Penomoran `/setting/numbering`**: tabel Jenis Dokumen | Format | Contoh nomor berikutnya | Berlaku sejak; aksi Ubah membuka dialog prefix, jumlah digit, reset tahunan dengan pratinjau langsung. Catatan dialog: "Urutan nomor tetap berlanjut; nomor yang sudah terpakai tidak berubah." Tanpa `numbering_rule.manage` tombol Ubah tidak tampil.
- **Penjualan `/setting/sales`**: tiga seksi — *Termin pembayaran* (`OPS-FLX-03`: tambah/ubah/nonaktifkan baris label + hari + jenis), *Ongkos kirim* (`OPS-FLX-04`: Ditanggung perusahaan / Dibebankan ke pelanggan; bila dibebankan, Sebelum PPN / Sesudah PPN; catatan bahwa akun jurnal diatur di Finance › Akuntansi), *Kredit pelanggan* (`OPS-FLX-01`: Nonaktif / Peringatan saja / Blokir dengan penjelasan satu baris per pilihan; `OPS-FLX-02`: saklar COD awal pelanggan baru + durasi bulan + mode). Satu tombol Simpan per seksi.
- **Kebijakan `/setting/policies`**: daftar per kelompok (label dokumen 41, nilai terformat, terakhir diubah oleh); Ubah inline untuk tipe `string`/`integer`/`decimal`/`boolean`/enum; tipe objek/array menautkan ke halaman khususnya (Penjualan) atau bertuliskan "Diubah melalui halaman terkait".

- [ ] **Step 1: Write the failing test** `tests/unit/settings-forms.test.ts`:
  - `round-trips term list`: `policyPayload(policyFormValue(termsPolicy)).value` sama dengan nilai bawaan `OPS-FLX-03`
  - `freight borne by company ignores tax position`: form `{mode:"COMPANY", tax_position:"AFTER_TAX"}` → payload `{mode:"COMPANY", tax_position:"BEFORE_TAX"}`
  - `client preview matches server format`: `previewDocumentNumber("PJ-",5,true,"2026","3")` → `"PJ-2026-00003"`

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** halaman dan `settings-forms.tsx`. **Step 4: Run** → PASS, `pnpm typecheck` PASS.

- [ ] **Step 5: QA browser pada route operasional** (sesi Admin Sistem dan sesi peran biasa yang hanya memegang `numbering_rule.read`), lebar 1600px dan 390px:
  - ubah prefix SO lalu buat SO baru → nomor memakai prefix baru;
  - `stale policy save shows conflict and keeps form values`: buka `/setting/sales` di dua tab, simpan di tab 1, lalu di tab 2 → pesan konflik tampil, isian tab 2 tidak hilang, tombol Muat ulang tersedia;
  - peran baca-saja melihat tabel penomoran tanpa tombol Ubah, dan `PUT` langsung ditolak 403;
  - ukur tombol/label/popup di browser sesuai standar desain. Simpan bukti di `docs/development/setting-hub-2026-10-24.md`.

- [ ] **Step 6: Commit** — `feat(setting): central settings hub and pages`

---

### Task 5: Navigasi hanya menu yang berfungsi

**Files:**
- Modify: `apps/office/lib/navigation.ts`, `apps/office/app/dashboard-sidebar.tsx`, `apps/office/lib/access-matrix-navigation.ts`
- Test: `tests/unit/navigation-visibility.test.ts`

**Interfaces:**
- Produces: `menuRoutes: Record<string, Record<string, string>>` (modul → submenu → href), menggantikan `masterDataRoutes` dan objek `settingHref` ad-hoc di sidebar. Setting: `Profil Perusahaan → /setting/company`, `Pengguna → /setting/users`, `Peran → /setting/roles`, `Kebijakan Operasional → /setting/policies`, `Penomoran Dokumen → /setting/numbering`, `Kredit & Exposure → /setting/sales`, `Kebijakan Pelanggan Baru → /setting/sales`; `Pengaturan Persetujuan` tetap ke `/operations/controls` sampai tahap 4. Route modul lain disalin dari kasus khusus sidebar yang ada saat ini.
- Produces: `isMenuAvailable(module: string, item: string): boolean` dan `visibleMenuItems(principal: AuthPrincipal, module: string): Array<{ label: string; href: string }>` (ketersediaan route + izin yang sudah dipakai sidebar)

- [ ] **Step 1: Write the failing test** `tests/unit/navigation-visibility.test.ts`:
  - `hides menu items without a route`: `visibleMenuItems(admin, "Setting")` tidak memuat `"Template Cetak"`, `"Audit"`, `"Periode & Closing"`
  - `hides Setting items without permission`: principal hanya `numbering_rule.read` → hanya `Penomoran Dokumen`
  - `hides a module with no visible item`: `visibleModules(principal)` tidak memuat `HRIS` bila tidak ada submenu HRIS yang berfungsi
  - `matrix omits rows of unavailable menus`: `navigationMatrixRows(permissions)` tidak memuat baris berawalan `Setting › Template Cetak`

- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**: sidebar merender dari `visibleMenuItems`; hapus cabang `<span title="Layar belum tersedia">` dan daftar "· Belum tersedia" (Kartu Piutang, Aging, A/T Tagihan, Estimasi Penagihan); kasus khusus yang sudah berfungsi (Dashboard, Invoice, Pesanan Pelanggan) tetap. **Step 4: Run** → PASS.

- [ ] **Step 5: QA browser** — sidebar Admin Sistem dan peran biasa: tidak ada item "Belum tersedia"; status aktif dan accordion tetap sesuai standar sidebar 7 Oktober.

- [ ] **Step 6: Commit** — `feat(office): show only working menus`

---

### Task 6: Sinkronisasi dokumen dan gerbang akhir

**Files:**
- Modify: `docs/erp-blueprint/15-setting.md` (bagian baru "Pengaturan terpusat — implementasi"), `docs/erp-blueprint/04-api.md` (endpoint `/settings/*` final), `docs/erp-blueprint/08-features.md` (tahap 2 selesai, tautan ke rencana ini), `docs/development/setting-hub-2026-10-24.md`

- [ ] **Step 1:** Tulis endpoint final, route, izin, file data (`numbering-defaults.json`, `chart-of-accounts.json`) dan urutan reset + seed development di dokumen di atas.
- [ ] **Step 2:** Jalankan `pnpm typecheck`, `pnpm vitest run tests/unit tests/integration/company-defaults.test.ts tests/integration/settings-numbering.test.ts apps/api/test/settings.e2e.test.ts`, `./tools/validate-repository.ps1`; semua lulus. Test lama yang masih gagal karena sebab di luar tahap ini dicatat apa adanya.
- [ ] **Step 3: Commit** — `docs(setting): record central settings implementation`

---

## Tidak termasuk tahap ini

Pemakaian `OPS-FLX-01..04` di alur SO/invoice (termin di SO, mode kredit, ongkir) adalah tahap 3. Struktur Organisasi, mesin persetujuan dan `OPS-FLX-07/08` dipakai di tahap 4. Akun jurnal per pilihan ongkir diatur di profil posting Finance yang sudah ada dan dipakai di tahap 3.
