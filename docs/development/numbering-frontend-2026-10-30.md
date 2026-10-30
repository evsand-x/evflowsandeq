# Setting › Penomoran Dokumen mengikuti mockup

Tanggal: 30 Oktober 2026

Halaman `/setting/numbering` dibangun ulang mengikuti board "Daftar · Penomoran Dokumen" dan "Modal · Ubah format penomoran" di `docs/mockup/evflow-office-design.pen`.

## Halaman daftar

- Tab di pita: Semua, Penjualan, Gudang, Keuangan, Pembelian dengan jumlah jenis dokumen. Pengelompokan modul ada di Office (`moduleOf`); server tidak menyimpan modul.
- Kartu "Susunan nomor" memecah contoh nomor Sales Order menjadi Prefix, Tahun, Bulan dan Urutan.
- Tabel: Jenis dokumen (modul), Format (`SO.TTTT.BB.0000`, `RR` untuk bulan Romawi), Reset urutan (+ perubahan terjadwal), Nomor berikutnya, Berlaku sejak, tombol Ubah (hanya `numbering_rule.manage`). Jenis tanpa aturan tampil "Belum diatur" dengan tombol Atur.

## Modal ubah format

Prefix, jumlah digit (stepper 3–10), format tahun (2026 | 26), format bulan (Angka | Romawi), reset urutan (Bulanan | Tahunan; perubahan berlaku awal periode berikutnya), Nomor saat ini, contoh nomor berikutnya dan nomor sebelumnya.

## Backend: Nomor saat ini

- `GET /settings/numbering` menambah `current_number`: nomor terakhir terpakai pada counter periode berjalan.
- `PUT /settings/numbering/:kind` menerima `current_number` opsional (`^\d{1,10}$`). Counter hanya maju: nilai di bawah nomor terpakai ditolak `NUMBERING_CURRENT_BELOW_USED`. Upsert bersyarat (`next_value <= nilai baru`) sehingga nomor yang terbit bersamaan tidak pernah didaur ulang. Nomor berikutnya yang tidak muat di jumlah digit ditolak `NUMBERING_DIGITS_TOO_SHORT`.
- Perubahan dicatat sebagai audit `numbering_counter.advanced` (sebelum/sesudah, jenis dokumen, kunci counter).

## Verifikasi

- `tests/integration/settings-numbering.test.ts`: counter maju, tidak mundur, nilai sama bukan perubahan, audit satu kali, digit tidak muat ditolak.
- `tests/unit/settings-forms.test.ts`: segmen nomor, pola format, validasi Nomor saat ini.
- Browser (Admin Demo): tab Penjualan menampilkan 2 jenis; Proforma diubah ke bulan Romawi, reset tahunan dan Nomor saat ini 12 → daftar menampilkan `PRO.TTTT.RR.0000`, "Reset tahunan mulai 1 Jan 2027" dan `PRO.2026.X.0013`; nilai 3 ditolak di form.
