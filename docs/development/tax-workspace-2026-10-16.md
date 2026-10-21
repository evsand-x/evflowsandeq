# Penyederhanaan Pajak — 16 Oktober 2026

## Keputusan pengguna
Pajak berisi Daftar & Aturan Pajak (nama, jenis PPN/PPh, akun, nilai persen; daftar/buat/edit/detail), Faktur Keluaran, Faktur Masukan. Master langsung berlaku tanpa approval. Jenis dan perlakuan tambah/potong disimpan terpisah. Faktur menampilkan sumber invoice penjualan/pembelian serta nomor/lampiran resmi; Coretax tidak termasuk cakupan.

## Cakupan dan penerimaan
FIN-08/11, PTP-03, IAM-04, APP-03: master perusahaan terversi dengan tanggal berlaku, decimal, audit/idempotency/version check; integrasi kalkulasi dan snapshot transaksi; daftar faktur dari sumber dan pencatatan metadata resmi tanpa membuat posting kedua; izin per submenu; UI operasional memakai Query/Table/komponen bersama. Riwayat posted dipertahankan. Referensi lama dipertahankan untuk kompatibilitas histori, tidak dianggap master utama baru. Tidak ada keputusan material terbuka. Acuan desain standar global web. Migrasi diperlukan untuk master/version/metadata faktur dan referensi transaksi. Pengujian mencakup scope, akun, nilai, versi, snapshot, sumber dan izin.


## Implementasi dan bukti
- Requirement FIN-08, FIN-11, PTP-03, IAM-04, APP-03. Schema/migrasi, controller/service, kalkulasi/posting SO dan supplier invoice, evidence, navigasi/matriks izin serta UI terintegrasi.
- Migrasi `20261017010000_operational_tax_master` sudah diterapkan pada database development lokal. Tujuh permission baru tidak memperluas grant peran lama secara otomatis; Admin Sistem tetap memiliki akses penuh.
- 31 pengujian lulus: master/revisi, historical snapshot, decimal PPh potong, scope akun, idempotency, posting penjualan/pembelian ke akun pilihan, input/output metadata tanpa posting kedua, HTTP permission independen, navigasi dan matriks. Posting test menggunakan database nyata dalam transaksi rollback, tanpa menonaktifkan proteksi immutable.
- Build backend, typecheck Office, ESLint file baru/tes dan validator repository lulus. Tidak mengklaim seluruh suite repository diuji.
- QA browser dengan sesi Admin Sistem nyata: tiga submenu, master kosong, form buat dan popup akun aktif, dua sumber invoice keluaran posted beserta form dokumen, input kosong. Konflik key kolom faktur diperbaiki dan reload tidak menghasilkan error baru. Kontrol form 44 px/radius 9 px, tombol simpan 42 px, popup 290 × 340 px/font 12 px; Escape menutup popup. Bukti: [faktur](tax-invoices-2026-10-16.png). Screenshot browser memiliki keterbatasan skala; pengukuran memakai DOM rendered.
- Stack: Next/React, shared UI/token, TanStack Query (key pengguna/perusahaan/izin/filter), TanStack Table dan Sonner digunakan; persistence, audit dan posting dibuktikan tes integrasi. Tidak ada penyimpanan tarif fiktif baru melalui sesi perusahaan pengguna.
- Sinkronisasi: README, 02–08, 12, 15. Aturan Coretax/PPh Badan historis ditandai sebagai cakupan ditunda sesuai keputusan terbaru.

## Batas yang tetap terlihat
- Master baru awalnya kosong; rule pajak lama tetap kompatibel dan tidak dikonversi tanpa akun eksplisit.
- Lampiran yang didukung saat ini JPEG/PNG maksimal 2 MB; PDF belum didukung.
- Pemilihan master tersedia pada form SO dan API supplier invoice; form supplier invoice tersendiri tidak ditambahkan dalam pekerjaan ini.
- Pengujian posting pertama pada suite OTC lama sempat gagal pada cleanup immutable setelah assertion lulus. Fixture terisolasi bernama OTC CONTROL TEST ONLY tersisa di database development; data perusahaan pengguna tidak disentuh. Pengujian baru memakai rollback sehingga tidak meninggalkan fixture tambahan. Proteksi jurnal tidak dilonggarkan.


## Penyempurnaan master dan permintaan PPN Penjualan
Pengguna menyetujui struktur satu master per penggunaan dan meminta satu master PPN Penjualan dengan tarif 11%. Arah: nama terpisah dari jenis PPN/PPh, perlakuan tambah/potong dipilih sendiri, penggunaan penjualan/pembelian eksplisit, akun dari COA perusahaan dengan kelompok akun terlihat, detail dan riwayat versi lebih informatif. Tarif 11% adalah konfigurasi yang diminta pengguna, bukan default kode atau kesimpulan tarif legal universal. Master baru akan memakai akun SALES_TAX aktif kelompok LIABILITY yang sudah tersedia di perusahaan sesi. Tidak membuat akun atau mengganti mapping jurnal lama. Penerimaan FIN-08/IAM-04/APP-03: master tersimpan/audit; pilihan dan validasi server mencegah penggunaan yang tidak sesuai; snapshot lama tidak berubah. Master lama tetap BOTH untuk kompatibilitas sampai diatur admin. Tidak ada keputusan material terbuka.


### Hasil penyempurnaan
- Migrasi usage diterapkan; master dan snapshot menyimpan penggunaan. Backend create/revise/submit SO dan supplier invoice memeriksa penggunaan. Opsi SO memfilter SALES/BOTH. PATCH klien lama mempertahankan penggunaan yang sudah dipilih.
- Kolom dan form diperjelas; nama dan jenis tidak tercampur, jenis tidak mengubah perlakuan otomatis, tarif menerima koma/titik, kelompok akun COA terlihat, akun nonaktif tetap dapat dibaca pada riwayat. Detail menampilkan label pembulatan, waktu lokal, tarif, penggunaan, akun dan status per versi.
- PPN Penjualan dibuat melalui sesi Admin Sistem pada perusahaan lokal PT Sandeq Sarana Medika — DATA UJI FIKTIF. ID `0e0f2d6d-b9e8-484f-aaf6-4dd71597469f`; jenis PPN, usage SALES, ADD, 11%, aktif, akun DEV-E2E-SALES_TAX (LIABILITY), presisi 2/HALF_UP. Database memverifikasi tepat satu master, satu revisi, satu audit create. Tidak ada transaksi lama yang diubah.
- 32 tes terkait lulus, backend build/Office typecheck/ESLint/validasi schema/validator repository lulus. Prisma generate memberi EPERM saat mengganti binary engine Windows yang sedang digunakan; berkas client/types sudah terbarui dan runtime serta tes berhasil memakai kolom baru. Tidak mengklaim command generate bersih.
- Browser nyata membuktikan form → simpan → detail, popup pencarian akun, pemilihan dengan Enter dan label kelompok Kewajiban. Detail font 13 px, tombol kembali 36 px. [Bukti PPN Penjualan 11%](ppn-penjualan-11-2026-10-16.png). Capture dipotong untuk membuang area kosong akibat skala screenshot browser, tanpa mengubah konten.
