# Pengaturan terpusat dan nilai bawaan — 24 Oktober 2026

Rencana: [2026-10-24-pengaturan-terpusat](../superpowers/plans/2026-10-24-pengaturan-terpusat.md). Desain: [arah fleksibel](../superpowers/specs/2026-10-24-erp-fleksibel-design.md). Requirement: CFG-08, CFG-09, CFG-10, IAM-06, IAM-10.

## Yang dibangun

| Bagian | Isi |
|---|---|
| Data bawaan | `packages/database/src/data/operational-policies.json` (termasuk `OPS-FLX-01..08`), `numbering-defaults.json` (11 jenis dokumen yang benar-benar diterbitkan backend), `chart-of-accounts.json` (156 akun impor + 21 pemetaan akun posting). Diekspor dari `@evflow/database`. |
| Provisioning | `provisionCompanyDefaults` (`packages/backend/src/administration/company-defaults.ts`) dan `importChartOfAccounts` (`packages/backend/src/finance/chart-of-accounts-import.ts`): hanya membuat yang belum ada, tidak menimpa nilai yang sudah diubah, diaudit. |
| API | `GET /settings/preferences` (semua sesi; nama perusahaan, logo, format angka), `GET /settings/numbering` (`numbering_rule.read`), `PUT /settings/numbering/:kind` (`numbering_rule.manage`, `Idempotency-Key`). Perubahan format berlaku sejak hari ini (zona perusahaan); urutan nomor berlanjut. |
| Office | `/setting` (hub), `/setting/company`, `/setting/numbering`, `/setting/sales` (termin, ongkir, mode kredit, COD awal), `/setting/policies`. Formatter `formatMoney`/`formatQuantity` (`apps/office/lib/format.ts`) berbasis string decimal. Error penomoran diterjemahkan menjadi pesan dengan tautan Setting. |
| Navigasi | `menuRoutes` di `apps/office/lib/navigation.ts` menjadi satu sumber menu yang berfungsi; sidebar, daftar modul dan matriks izin menyembunyikan menu tanpa layar atau capability. Setting menampilkan satu entri "Termin, Ongkos Kirim & Kredit" untuk Kebijakan Pelanggan Baru dan Kredit & Exposure. |

## Database development

Database development lokal di-reset atas persetujuan pengguna dan diisi ulang:

```powershell
pnpm --filter @evflow/database build
$env:EVFLOW_ALLOW_DEV_SEED="LOCAL_FICTITIOUS_ONLY"; node tools/run-development-seed.cjs
node tools/run-full-development-seed.mjs
node tools/run-crm-development-seed.mjs
```

Perusahaan dummy **PT LIVIANA DWI BERKAT**, akun `demo.admin@evflow.local` (password dari `DEV_SEED_ADMIN_PASSWORD` di `.env`), 156 akun, nilai bawaan, SO dummy `SO-2026-00001..00010`. Tool development mengenali perusahaan dummy dari audit `development_seed.company_created`, bukan dari namanya.

Perbaikan yang diperlukan agar database baru dapat dibangun: migration `verify_win_lost` dipindah ke `20260930115000` (sebelumnya mengubah tabel yang dibuat migration sesudahnya) dan migration `20261024100000_restore_line_relation_columns` menambah kolom `uomId`/`prospectNeedId` yang sudah dideklarasikan schema.

Catatan runtime: API memuat `@evflow/backend`, `@evflow/database` dan `@evflow/contracts` dari `dist`. Setelah mengubah paket tersebut, jalankan `pnpm --filter @evflow/contracts --filter @evflow/database --filter @evflow/backend build` sebelum me-restart API.

## Bukti QA browser (route operasional, sesi Admin Sistem)

- Hub `/setting` menampilkan kelompok Perusahaan, Pengguna & Akses, Penjualan, Dokumen; topbar menampilkan PT LIVIANA DWI BERKAT.
- Penomoran: format SO diubah `SO-` → `PJ-`; nomor berikutnya `PJ-2026-00011` (urutan berlanjut), lalu dikembalikan ke `SO-2026-00011`.
- Penjualan: simpan basi (versi diubah dari "tab lain") menghasilkan pesan konflik 412, pilihan pengguna tetap di layar, tombol Coba lagi memuat versi terbaru.
- Profil dan Kebijakan Operasional termuat tanpa error; tautan kebijakan `OPS-FLX-01..04` mengarah ke halaman Penjualan.
- Sidebar tanpa item "Belum tersedia"; modul HRIS tidak tampil; satu item aktif per halaman.
- 390px: tanpa scroll horizontal. Label dialog/baris setting 12px/500, field 44px sesuai standar form.

Belum diuji di browser: sesi peran biasa yang hanya memegang `numbering_rule.read` (dicakup e2e 403 dan unit `navigation-visibility`).
