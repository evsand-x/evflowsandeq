# Navigasi lanjutan Sales Order — 7 Oktober 2026

Pengguna menyetujui panel Langkah berikutnya dan tab Ringkasan/Pemenuhan/Dokumen/Riwayat. Tombol Daftar Proforma dan Daftar Picking Slip membuka daftar terkait SO, bukan membuat ulang dokumen otomatis. Fokus web desktop.

Cakupan OTC-03/04/05/08/09/10/11/12 dan APP-03: detail SO, status terpisah, jumlah per produk, dokumen bertahap, navigasi gudang/POD/invoice serta histori. Gunakan endpoint existing orders, warehouse, documents, audit; query perusahaan/pengguna dan izin existing. Tidak mengubah command, posting, stok, approval, skema atau migration. Dokumen tanpa metadata harus dimuat dari sumber berizin, bukan diberi tanggal/status buatan. Semua aksi mutasi gudang tetap di layar gudang.

Penerimaan: tab keyboard, dokumen terfilter/dapat dicari, hitungan bukan nol saat loading/error/izin kurang, tiap tautan menuju dokumen/tahap yang tepat; tidak ada tombol Buat Proforma/Picking. Draft, backorder, alokasi, transit, diterima, terminal memiliki arahan berbeda; prepay tidak dinyatakan siap kirim tanpa verifikasi. Daftar produk tidak menggabung nama/kode. Print ringkasan tetap tersedia. Validasi Office typecheck/lint dan repository, serta browser dengan sesi nyata.

## Implementasi dan QA

- Detail SO kini memiliki panel Langkah Berikutnya dan tab Ringkasan, Pemenuhan, Dokumen, Riwayat.
- Daftar dokumen memuat Proforma, Picking Slip, Packing List, Surat Jalan, POD, dan Invoice dari endpoint nyata sesuai izin. Tidak ada tombol membuat ulang Proforma/Picking.
- Tombol jumlah Picking Slip dan Proforma membuka tab Dokumen dengan filter terkait; toolbar dapat mencari nomor/tahap serta jenis dokumen dengan mengetik.
- Tab Pemenuhan menampilkan kode/nama/satuan dan Dipesan, Dialokasikan, Backorder, Ditutup, Dikirim, Diterima.
- Heading langkah berikutnya berubah untuk draft, alokasi, backorder, perjalanan, penerimaan, invoice dan terminal. Prepay menampilkan peringatan dana terverifikasi.
- Browser dengan sesi nyata diuji pada DEV-SO-2026-000005: 6 dokumen tampil, invoice berstatus Diposting, jumlah pemenuhan 10/10, riwayat audit tampil, pencarian kosong jujur.
- Validasi Office typecheck, ESLint file berubah, dan validate-repository.ps1 lulus. Tidak ada migration atau command backend baru.
- Draft 000009: hitungan dokumen 0 dan alasan belum ada alokasi. Backorder 000008: 150 dipesan, 76 dialokasikan, 74 backorder; tautan Picking Slip membuka DEV-PICK-2026-000004 dengan quantity 76. Proforma membuka DEV-PRO-2026-000001 dan aksi Cetak tersedia.
- Batas: daftar invoice pada tahap ini mengikuti relasi POD yang disediakan endpoint gudang; invoice terbit sebelum POD belum tercakup daftar agregasi ini. Dokumen detail/cetak tetap memakai layar existing. Pengujian mutasi, akun tanpa izin dan simulasi gangguan server tidak dijalankan; tidak ada transaksi disimpan saat QA.
- Stack: React/Next/TypeScript, shared tokens, Radix tabs/Command dan TanStack Table/Query digunakan dan diuji. Sonner untuk mutasi existing dipertahankan, tidak diuji ulang karena navigasi bersifat read-only. Mobile tidak termasuk scope.
