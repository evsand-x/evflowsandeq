# SO Mudah — Bagian 5: Penomoran Dokumen seperti Kledo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Penomoran dokumen diatur dengan format teks berkode (mis. `SO-SSM.[TAHUN].[BULAN_ROMAWI].[NOMOR]`), contoh hasil langsung, nomor saat ini yang hanya dapat dinaikkan, reset tidak pernah/harian/bulanan/tahunan dengan log, dan tampilan kartu berkelompok dengan pencarian.

**Architecture:** `DocumentNumberRule` mendapat kolom `template`; satu modul murni (`numbering-template.ts` di contracts) mem-parse, memvalidasi, memformat, dan menghitung kunci periode reset, dipakai backend dan layar (pratinjau sama persis). `nextDocumentNumber` tetap atomik di `MasterCodeSequence` dengan kunci `kind:periode`. Kolom lama (`prefix`, `yearFormat`) diubah menjadi template lewat migration dan tidak lagi dipakai untuk format.

**Tech Stack:** Prisma/PostgreSQL, backend `packages/backend`, zod `@evflow/contracts`, Next.js Office, vitest dengan Postgres nyata.

**Spec:** [docs/superpowers/specs/2026-10-25-so-mudah-design.md](../specs/2026-10-25-so-mudah-design.md) (Penomoran dokumen). **Berkaitan dengan:** [bagian 4](2026-10-25-so-mudah-bagian-4.md) (jenis `locator_move`).

## Global Constraints

- Semua Global Constraints bagian 1 berlaku.
- Nomor selalu dibuat sistem, atomik, unik; tidak pernah mundur atau terpakai ulang.
- Kode format (label layar → token): Nomor urut `[NOMOR]`, Nomor urut romawi `[NOMOR_ROMAWI]`, Tanggal 01–31 `[TANGGAL]`, Tanggal romawi `[TANGGAL_ROMAWI]`, Bulan 01–12 `[BULAN]`, Bulan JAN–DES `[BULAN_NAMA]`, Bulan romawi `[BULAN_ROMAWI]`, Tahun 4 digit `[TAHUN]`, Tahun 2 digit `[TAHUN2]`, Tahun romawi `[TAHUN_ROMAWI]`. Tidak ada kode berbasis data (keputusan pengguna).
- Template wajib memuat tepat satu kode nomor (`[NOMOR]` atau `[NOMOR_ROMAWI]`); teks bebas hanya huruf besar, angka, dan `-./_ `; panjang hasil ≤ 40.
- Reset: `NEVER | DAILY | MONTHLY | YEARLY`; tahunan selalu 1 Januari. Template harus aman terhadap reset: DAILY wajib kode tanggal + bulan + tahun; MONTHLY wajib kode bulan + tahun; YEARLY wajib kode tahun; NEVER bebas.
- Template tidak boleh sama persis dengan template aktif jenis dokumen lain.
- Perubahan format berlaku untuk dokumen baru sejak hari ini; perubahan reset berlaku periode berikutnya (aturan 24 Oktober tetap).
- Nomor saat ini hanya dapat dinaikkan untuk periode berjalan.

## Review Focus

1. **Pindah dari reset bulanan ke "tidak pernah"**: nomor berikutnya tidak bertabrakan dengan nomor yang sudah terbit di bulan-bulan sebelumnya. Test di Task 3.
2. **Nomor saat ini diturunkan** lewat API langsung (bukan layar): ditolak. Test di Task 4.
3. **Dua dokumen diterbitkan bersamaan** setelah template berubah: nomor berurutan tanpa ganda. Test di Task 3.
4. **Nomor urut romawi melewati 3999**: ditolak dengan pesan habis, bukan nomor rusak. Test di Task 2.
5. **Data lama**: aturan yang dibuat sebelum migration menghasilkan nomor identik sebelum dan sesudah migration. Test di Task 1.

---

### Task 1: Skema, migration template, dan kontrak

**Files:**
- Modify: `packages/database/prisma/schema.prisma:2169-2182` (`DocumentNumberRule.template String`; `resetPeriod` menerima `NEVER`, `DAILY`)
- Create: `packages/database/prisma/migrations/20261025600000_numbering_template/migration.sql` (isi `template = prefix || '.' || CASE year_format WHEN 'YY' THEN '[TAHUN2]' ELSE '[TAHUN]' END || '.[BULAN].[NOMOR]'`; CHECK `reset_period IN ('NEVER','DAILY','MONTHLY','YEARLY')`; `template` NOT NULL)
- Modify: `packages/database/src/data/numbering-defaults.json` (field `template` `"{PREFIX}.[TAHUN].[BULAN].[NOMOR]"` per jenis, `reset_period` MONTHLY, `digits` 4; termasuk `locator_move` `MV` bila bagian 4 sudah ada), `packages/database/src/defaults.ts:44-48`
- Create: `packages/contracts/src/numbering.ts` (diekspor dari `index.ts`)
- Test: `tests/integration/numbering-template-migration.test.ts`

**Interfaces:**
- Produces (contracts): `numberingRevisionSchema = { template: string, digits: int 1-10, reset_period: "NEVER"|"DAILY"|"MONTHLY"|"YEARLY" }` (strict; menggantikan skema inline document-number.ts:119-129); `numberingAdvanceSchema = { next_value: string (bilangan bulat positif) }`; tipe `NumberingToken` (10 token Global Constraints).

- [ ] **Step 1: Write the failing test**: aturan lama `prefix "SO"`, `YYYY`, `digits 4`, MONTHLY dengan urutan berjalan 11 pada 2026-10-25 → nomor berikutnya sebelum migration = sesudah migration = `"SO.2026.10.0011"` (Review Focus 5); defaults memuat `template` untuk setiap jenis.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/numbering-template-migration.test.ts` → FAIL.
- [ ] **Step 3: Implement** skema, migration, defaults, kontrak.
- [ ] **Step 4: Run** → PASS; `tests/integration/company-defaults.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(numbering): template column with lossless migration`

### Task 2: Mesin template murni

**Files:**
- Create: `packages/contracts/src/numbering-template.ts`
- Test: `tests/unit/numbering-template.test.ts`

**Interfaces:**
- Produces: `parseTemplate(template: string): { ok: true; parts: Part[] } | { ok: false; code: NumberingTemplateError }`.
- Produces: `validateTemplate(template: string, reset: ResetPeriod): NumberingTemplateError | null` — kode `NUMBERING_TEMPLATE_UNKNOWN_CODE`, `NUMBERING_TEMPLATE_SEQUENCE_REQUIRED`, `NUMBERING_TEMPLATE_INVALID_TEXT`, `NUMBERING_TEMPLATE_RESET_UNSAFE`, `NUMBERING_TEMPLATE_TOO_LONG`.
- Produces: `formatNumber(template: string, date: { year: number; month: number; day: number }, value: bigint, digits: number): string` — `[NOMOR]` dipad nol sesuai `digits`, lebih panjang → `DOCUMENT_NUMBER_EXHAUSTED`; `[NOMOR_ROMAWI]` > 3999 → `DOCUMENT_NUMBER_EXHAUSTED`; `[BULAN_NAMA]` JAN, FEB, MAR, APR, MEI, JUN, JUL, AGU, SEP, OKT, NOV, DES; romawi huruf besar.
- Produces: `periodKey(kind: string, reset: ResetPeriod, date): string` — NEVER `kind`; DAILY `kind:YYYY-MM-DD`; MONTHLY `kind:YYYY-MM` (sama dengan kunci lama); YEARLY `kind:YYYY` (sama dengan kunci lama).
- Produces: `toRoman(n: number): string`.

- [ ] **Step 1: Write the failing tests**
  - `formatNumber("SO-SSM.[TAHUN].[BULAN_ROMAWI].[NOMOR]", 2026-10-25, 183n, 4)` → `"SO-SSM.2026.X.0183"`.
  - `formatNumber("INV/[TAHUN2]/[BULAN_NAMA]/[NOMOR_ROMAWI]", 2026-10-25, 14n, 4)` → `"INV/26/OKT/XIV"`.
  - `[TANGGAL_ROMAWI]` 25 → `"XXV"`; `[TAHUN_ROMAWI]` 2026 → `"MMXXVI"`.
  - `validateTemplate("SO.[BULAN].[NOMOR]", "MONTHLY")` → `NUMBERING_TEMPLATE_RESET_UNSAFE`; `("SO.[NOMOR]", "NEVER")` → `null`; dua kode nomor → `NUMBERING_TEMPLATE_SEQUENCE_REQUIRED`; `"so.[NOMOR]"` → `NUMBERING_TEMPLATE_INVALID_TEXT`; `"[FOO]"` → `NUMBERING_TEMPLATE_UNKNOWN_CODE`.
  - `[NOMOR]` 10000 dengan digits 4 → `DOCUMENT_NUMBER_EXHAUSTED`; `[NOMOR_ROMAWI]` 4000 → `DOCUMENT_NUMBER_EXHAUSTED` (Review Focus 4).
  - `periodKey` untuk keempat reset.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/numbering-template.test.ts` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(numbering): template parser, validator and formatter`

### Task 3: Penerbitan dan revisi memakai template

**Files:**
- Modify: `packages/backend/src/common/document-number.ts:21-59` (`nextDocumentNumber`; hapus `formatDocumentNumber` lama), `:154-258` (`reviseNumbering`), `:261-321` (`listNumberingSettings`)
- Modify: `packages/backend/src/administration/settings.controller.ts:78-90` (pakai skema contracts)
- Modify: `tests/integration/settings-numbering.test.ts` (perluas)

**Interfaces:**
- Consumes: Task 2.
- `nextDocumentNumber(tx, c, kind)` bertanda tangan sama; memakai `periodKey` + `formatNumber`.
- `reviseNumbering` menerima `{ template, digits, reset_period }`: `validateTemplate` gagal → 400 dengan kode; template sama persis dengan template aktif jenis lain → `NUMBERING_TEMPLATE_DUPLICATE`; perubahan template/digits berlaku hari ini (perilaku lama); perubahan reset berlaku awal periode berikutnya (DAILY dan NEVER: besok; MONTHLY: tanggal 1 bulan berikutnya; YEARLY: 1 Januari berikutnya).
- **Pindah ke reset yang kuncinya lebih lebar** (mis. MONTHLY → NEVER/YEARLY): nilai awal kunci baru = maksimum nilai terbit pada semua kunci lama jenis itu + 1, sehingga nomor tidak kembar dengan nomor lama. *(keputusan pembangun)*

- [ ] **Step 1: Write the failing tests**
  - `template with roman month issues SO-SSM.2026.X.0001`.
  - `switch monthly to never continues above highest issued value` (Review Focus 1).
  - `daily reset restarts next day`.
  - `duplicate template across kinds rejected`.
  - `concurrent issue after template change yields consecutive unique numbers` (Review Focus 3).
  - Seluruh test lama `settings-numbering.test.ts` tetap lulus (kasus prefix dikonversi ke template).
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/settings-numbering.test.ts` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** test + `tests/integration/manual-proforma.test.ts` + `tests/integration/otc-controls.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(numbering): issue and revise numbers from templates`

### Task 4: Nomor saat ini, log reset, kelompok

**Files:**
- Modify: `packages/backend/src/common/document-number.ts`, `packages/backend/src/administration/settings.controller.ts`
- Modify: `packages/database/src/data/numbering-defaults.json` (field `group`: `sales` | `warehouse` | `purchasing`)
- Modify: `apps/api/test/settings.e2e.test.ts`, `tests/integration/settings-numbering.test.ts`

**Interfaces:**
- Produces: `PUT /settings/numbering/:kind/next-value` (`numbering_rule.manage`, Idempotency-Key), body `numberingAdvanceSchema` → menetapkan `nextValue` kunci periode berjalan; `next_value ≤ nilai berikutnya saat ini` → `NUMBERING_SEQUENCE_BACKWARD`; nilai yang melebihi kapasitas format → `DOCUMENT_NUMBER_EXHAUSTED`; audit `numbering_sequence.advanced` (sebelum/sesudah).
- Produces di `GET /settings/numbering` per jenis: `{ kind, label, group, template, digits, reset_period, effective_from, pending, current_value (nilai terakhir terbit atau null), next_preview, last_reset_at (awal periode berjalan; null untuk NEVER), history: [{ at, actor, action, before, after }] (audit `numbering_rule.*` dan `numbering_sequence.advanced`, 20 terbaru) }`.

- [ ] **Step 1: Write the failing tests**
  - `advance next value forward`.
  - `advance backward via API rejected` (Review Focus 2).
  - `advance requires numbering_rule.manage` (e2e).
  - `list exposes group, current value, last reset and history`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/settings-numbering.test.ts apps/api/test/settings.e2e.test.ts` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS; build paket dan restart API.
- [ ] **Step 5: Commit** `feat(numbering): forward-only current number, reset log, groups`

### Task 5: Layar Penomoran Dokumen

**Files:**
- Modify: `apps/office/app/setting/numbering/page.tsx` (ganti tabel dan `EditDialog`)
- Modify: `apps/office/app/setting/settings-forms.ts:42-59` (`previewDocumentNumber` memakai `formatNumber` dari contracts)
- Modify: `apps/office/lib/api.ts:104-121` (terjemahan `NUMBERING_TEMPLATE_*`, `NUMBERING_SEQUENCE_BACKWARD`)
- Test: `tests/unit/settings-forms.test.ts` (perluas), `tests/unit/api-errors.test.ts` (perluas)

**Interfaces:**
- Produces: `insertToken(template: string, cursor: number, token: NumberingToken): { template: string; cursor: number }`.

Layar (pola Kledo):
- Halaman: judul "Penomoran Dokumen", kalimat "Nomor otomatis bertambah setiap dokumen baru dibuat.", kolom **Cari**; kiri daftar kelompok (Penjualan, Gudang, Pembelian) dengan jumlah; kanan kartu per jenis dokumen berisi nama dan contoh nomor berikutnya.
- Dialog per jenis: **Format penomoran*** (teks) + dropdown **Tambah kode** (label awam di Global Constraints) yang menyisipkan kode di posisi kursor; **Contoh hasil** langsung (kesalahan format tampil di bawah isian dengan kalimat awam); **Jumlah digit**; **Nomor saat ini** (hanya dapat dinaikkan; disimpan terpisah); **Reset nomor setiap**: Tidak pernah / Setiap hari / Setiap bulan / Setiap tahun (1 Januari) dengan keterangan "Perubahan reset berlaku mulai {tanggal}"; "Terakhir reset {tanggal}" dan tautan **Lihat log**; Batal / Simpan.

- [ ] **Step 1: Write the failing tests**: `insertToken` menyisipkan di kursor; pratinjau layar sama dengan `formatNumber`; setiap kode error baru diterjemahkan dengan tautan `/setting/numbering`.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/settings-forms.test.ts tests/unit/api-errors.test.ts` → FAIL.
- [ ] **Step 3: Implement** layar.
- [ ] **Step 4: Run** → PASS; `pnpm --filter @evflow/office build` → sukses.
- [ ] **Step 5: Commit** `feat(office): Kledo-style document numbering settings`

### Task 6: Sinkronisasi blueprint dan QA browser

**Files:**
- Modify: `docs/erp-blueprint/15-setting.md` (penomoran), `02-requirements.md` (CFG terkait), `03-database.md`, `04-api.md`, `07-design.md`; perbarui register README bila contoh format berubah
- Create: `docs/development/so-mudah-bagian-5-2026-10-25.md`

- [ ] **Step 1: Sinkronkan** dokumen; tidak menambah aturan di luar spec dan keputusan pembangun.
- [ ] **Step 2: QA browser** (viewport 1366 dan 390): ubah format SO menjadi `SO-SSM.[TAHUN].[BULAN_ROMAWI].[NOMOR]` lewat dropdown → contoh `SO-SSM.2026.X.00xx`; buat SO → nomor sesuai; naikkan nomor saat ini → SO berikutnya memakai nilai itu; coba turunkan → ditolak; pilih reset harian tanpa kode tanggal → pesan format tidak aman; kembalikan ke format bawaan. Catat bukti.
- [ ] **Step 3: Run** `pnpm vitest run` dan `./tools/validate-repository.ps1` → lulus.
- [ ] **Step 4: Commit** `docs(numbering): sync blueprint and QA evidence for template numbering`
