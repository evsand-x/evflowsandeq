# Modernisasi seluruh Office dan data uji lengkap

## Keputusan pengguna

Terapkan arah Dashboard ke seluruh modul web. Prioritas desktop; pengalaman mobile ditunda. Data dummy dipilih berupa skenario transaksi lengkap sampai stok/keuangan, pada database development lokal fiktif yang sudah tersedia.

## Cakupan

APP-03/NFR-05: tema emerald/netral dan Plus Jakarta Sans untuk semua Office, shell/topbar/sidebar, form, tabel, kartu, popup dan Setting. Halaman tersedia: tujuh dashboard; CRM prospek/kontak; Master pelanggan; SO daftar/form/detail; pemenuhan/POD; invoice/pembayaran; backorder; kontrol transaksi; pajak; akuntansi; mutasi/reconciliation; Setting pengguna/peran/matriks. Login mengikuti brand. Tidak menambah layar untuk menu placeholder yang backend/UI-nya belum ada, termasuk HRIS operasional dan pengadaan lengkap.

IAM-01/04: permission, scope dan hierarki tetap. Persetujuan eksplisit pengguna berikutnya mengizinkan peran `DEV_REVIEW_READ` untuk Novian, hanya perusahaan DATA UJI FIKTIF: 11 izin baca Warehouse/Finance, tanpa create/update/approve/import. Role lama dipertahankan; AccessService mencatat audit dan mencabut sesi terdampak. OTC/PTP/FIN/WH: seed menggunakan perusahaan DATA UJI FIKTIF, produk/pelanggan DEV-E2E terpisah, service command untuk saldo awal, alokasi, picking/checking, dispatch, POD, invoice, receipt dan allocation. Decimal, ledger, jurnal, audit dan idempotency tetap milik backend. Tidak menyunting saldo langsung. Tidak menyentuh production, mereset password, menghapus data atau menyetujui transaksi asli.

## Verifikasi

Typecheck/lint/validator; browser desktop untuk tiap keluarga layar. Seed dijalankan dua kali untuk membuktikan tanpa duplikasi; cek ledger/jurnal seimbang dan hubungan transaksi. Batas data Dashboard yang belum memiliki projection tidak ditutup memakai angka palsu.

## Hasil dan batas verifikasi

- Office typecheck, typecheck seed, ESLint file TS/TSX berubah dan validator repository lulus. Format CSS bersama diperiksa.
- Browser operasional membuktikan daftar SO memuat sembilan order, detail transaksi seeded menampilkan total/pajak dan pemenuhan diterima; font Plus Jakarta Sans dan radius tabel 14 px diterapkan. Bukti Dashboard/sidebar tersedia pada review sebelumnya.
- Pemeriksaan seluruh keluarga layar belum selesai: perubahan role memutus sesi, dan login pada tab review masih menampilkan kredensial tidak sesuai. Tidak membuat sesi pengganti atau mengubah kata sandi untuk melewati batas ini.
- Lima SO baru (draft, alokasi/backorder, transit, pembayaran sebagian, lunas), dua invoice, dua receipt, dua mutasi bank matched, 12 jurnal. Rerun tidak menggandakan transaksi; rekonsiliasi GL/subledger/economic balanced dan selisih nol.
- Nilai uji IDR: penjualan 4.500.000; HPP 2.700.000; pajak 495.000; receipt 3.885.000; AR 1.110.000; inventory 11.400.000; in transit 900.000.
- Seed mengatur akun/posting profile, periode, numbering, pajak melalui approval terpisah, dan prefix prospek pada policy lokal. Skenario mencakup order-to-cash dan stok awal; procurement/payroll lengkap belum tercakup.
- `inventory.cost.read` dibutuhkan endpoint detail jurnal/rekonsiliasi tetapi belum tersedia dalam katalog permission lokal. Tidak membuat wildcard atau menghapus gate; halaman tersebut belum dapat diklaim terverifikasi lewat akun review.
- CRM modern: daftar Prospek/Kontak memakai hierarki identitas dua baris, avatar/inisial, badge status bertitik, tindak lanjut overdue, sort server, reset filter, compact table, column menu, dan navigasi konteks CRM. Detail kebutuhan memiliki pencarian; form Kontak tidak lagi menempel di bawah daftar. Data CRM additive menambah 8 prospek, 16 kontak dan 5 peluang draft dengan variasi status.
- React/Next/TypeScript, token Tailwind dan komponen bersama digunakan; TanStack Query/Table serta Sonner tetap digunakan di CRM/Setting/operasi. Pemeriksaan visual lintas semua layar, state dan keyboard belum selesai; perubahan tema tidak membuktikan seluruh blueprint fitur/stack telah selesai.

## Mengulang seed lokal

PowerShell: set `$env:EVFLOW_ALLOW_DEV_SEED='LOCAL_FICTITIOUS_ONLY'`, lalu `pnpm db:seed:full`. NODE_ENV harus development dan database/storage harus lokal. Tidak menjalankan base seed atau mereset password. Untuk mengulang grant yang telah disetujui: `node tools/run-development-review.mjs`; idempoten, tidak mencabut sesi kembali bila grant sudah sama.
