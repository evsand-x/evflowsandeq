# Konsolidasi Pengaturan — Tahap 2b (24 Oktober 2026)

Rencana: [2026-10-24-konsolidasi-pengaturan-2b.md](../superpowers/plans/2026-10-24-konsolidasi-pengaturan-2b.md). Desain: [konsolidasi](../superpowers/specs/2026-10-24-konsolidasi-pengaturan-design.md).

## Yang dibangun

- Izin independen per submenu Setting (tanpa grant induk); migrasi tidak memperluas hak lama.
- Penomoran `Prefix.YYYY|YY.MM.Urutan`, reset Bulanan/Tahunan; perubahan reset berlaku periode berikutnya.
- Kebijakan Umum (`/setting/general`, `GET|PATCH /settings/general`); `OPS-COMP-01..03` dan `OPS-FLX-05` dihentikan.
- Pajak bawaan (PPN 12% × DPP 11/12) menggantikan aturan pajak per pelanggan × produk; pajak per baris ditolak `LINE_TAX_NOT_ALLOWED`.
- Atribut kredit pelanggan di master pelanggan; halaman Termin & Kredit (`/setting/terms`).
- Jenis Potongan (4 bawaan), Pemetaan Akun (`/setting/account-mapping`) dengan izin per jenis pada `/finance-controls/configuration`.
- Batas diskon per peran/orang (Admin Sistem saja), produk (`discount_limit.manage`), bawaan `OPS-FLX-09`; `GET /settings/discount-limit/me`.
- `/operations/controls` dihapus; satu rumah per menu; galat menautkan halaman Setting.
- Migrasi `20261024110000` sampai `20261024180000`. Seed development memakai default provisioning dan atribut kredit pelanggan; tidak ada pembuatan aturan pajak atau kebijakan pembayaran lama.

## Keputusan yang berdampak ke pengguna

- Termin bawaan pelanggan memerlukan `customer_credit.update` (tempo panjang = pemberian kredit).
- Pelanggan tanpa termin bawaan: SO memakai COD sampai pemilih termin pada SO (tahap 3).
- Toleransi jatuh tempo kosong = 0 hari.
- Pembaca `account_mapping.read` melihat opsi akun detail minimal (id, kode, nama).
- Menu Aturan WAPU & PPh disembunyikan; baris `ReceiptTaxRule` lama tetap berlaku tetapi tidak dapat diedit sampai tahap 3 (potongan).
- Batas diskon per peran/orang hanya Admin Sistem (mencegah menaikkan batas sendiri).

## Pertanyaan bisnis terbuka

- Saat PPN dipungut pada pembayaran di muka (`ADVANCE`) belum dapat dikonfigurasi; bawaan tetap saat pengiriman (POD). Perlu keputusan pemilik bisnis.

## Belum dikerjakan

Pemeriksaan diskon/harga otomatis di SO, Harga Khusus, kode faktur pada invoice, Terima Pembayaran dengan potongan, retur (tahap 3); mesin persetujuan umum (tahap 4). QA browser dan reset database development menunggu persetujuan pengguna.
