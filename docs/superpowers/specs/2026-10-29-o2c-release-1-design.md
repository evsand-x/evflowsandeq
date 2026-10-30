# Desain O2C Release 1

Tanggal: 29 Oktober 2026  
Status: Disetujui pengguna untuk perencanaan implementasi

## Maksud

Menyelesaikan alur Order-to-Cash Office yang sederhana dan dapat dipakai:

`Pelanggan → Sales Order → Surat Jalan → Invoice`

Pembayaran dicatat setelah invoice sebagai proses Finance terpisah. Blueprint ERP yang lebih luas tetap menjadi visi produk, tetapi tidak menjadi backlog aktif Release 1.

## Hasil yang diinginkan

Pengguna membuat SO untuk seluruh pesanan, memilih jumlah yang benar-benar dikirim pada Surat Jalan, menerbitkan Surat Jalan sebagai bukti barang telah diantar dan diserahkan, lalu membuat invoice dari Surat Jalan tersebut. Surat Jalan terbit menjadi event penyerahan dan memicu pengakuan pendapatan serta HPP.

## Sasaran

- Satu jalur O2C berjalan pada route Office operasional dengan sesi dan izin nyata.
- SO menyimpan seluruh permintaan pelanggan; jumlah kirim ditentukan kemudian pada Surat Jalan.
- Surat Jalan dapat mengirim sebagian jumlah SO tanpa membangun mesin backorder.
- Invoice hanya dapat dibuat dari Surat Jalan terbit dan tidak melebihi kuantitas Surat Jalan.
- Saat Surat Jalan diterbitkan, server memeriksa stok, membuat pergerakan stok, dan mem-posting pendapatan/HPP secara atomik.
- Harga, pajak, termin/TOP, ongkir, akun dan nomor dokumen memakai konfigurasi editable serta snapshot dokumen.
- Setiap tindakan memiliki audit, idempotency, rejection path dan pemeriksaan izin di server.

## Bukan sasaran Release 1

- Alokasi stok otomatis, reservation queue, picking, checking, packing dan Packing List.
- POD terpisah; Surat Jalan terbit adalah bukti penyerahan pada tahap ini.
- Mesin backorder otomatis dan rekonsiliasi sisa kompleks; pengiriman parsial kumulatif tetap didukung.
- CRM lanjutan, target, estimasi, kunjungan dan aplikasi mobile.
- Approval generik, unlock kredit, mode kredit Block dan prepay.
- Uang muka, potongan pajak, bukti potong, retur, credit note dan refund.
- Procurement/P2P, payroll, HRIS, aset, anggaran, Coretax dan rekonsiliasi bank penuh.
- Dashboard analitik; dashboard hanya menampilkan tugas, blocker dan tautan dokumen.

## Pendekatan yang dipilih

Pendekatan yang dipilih adalah jalur tipis penuh dari ujung ke ujung dengan tiga dokumen operasional. SO menjadi sumber permintaan, Surat Jalan menjadi sumber kuantitas dan event penyerahan, dan Invoice menjadi sumber AR. Refactor file besar hanya dilakukan bila menghambat alur ini; tidak ada proyek refactor terpisah.

## Alur Release 1

1. **Buat SO**: pilih pelanggan, tanggal, barang, jumlah, harga, termin/TOP dari daftar Setting, pajak dan ongkir. Nilai termin/TOP yang dipilih disimpan sebagai snapshot SO dan diwariskan ke Invoice.
2. **Buat Surat Jalan dari SO**: pilih SO yang masih memiliki sisa, isi jumlah kirim per baris, pilih gudang/locator bila diperlukan, lalu simpan sebagai draft.
3. **Terbitkan Surat Jalan**: pengguna mengisi waktu serah terima, penerima, jumlah diterima, selisih/penolakan dan bukti privat bila diwajibkan. Server memvalidasi izin, status, kuantitas kumulatif, stok layak, periode dan konfigurasi; kemudian membuat stock movement dan posting pendapatan/HPP secara atomik. Surat Jalan terbit tidak dapat diedit.
4. **Buat Invoice dari Surat Jalan**: pengguna berizin memilih Surat Jalan terbit; sistem menyalin kuantitas dan snapshot nilai yang relevan, lalu membuat dan mem-posting invoice. Satu Surat Jalan menghasilkan paling banyak satu Invoice pada Release 1.
5. **Catat pembayaran**: pengguna Finance dapat mencatat pembayaran penuh atau sebagian untuk satu invoice; outstanding berasal dari settlement posted.

## Aturan domain utama

- SO draft dapat diedit; SO yang sudah memiliki Surat Jalan terbit tidak boleh mengubah baris yang sudah dikirim.
- Satu SO boleh memiliki beberapa Surat Jalan kumulatif; total jumlah terbit per baris tidak boleh melebihi jumlah SO. Sisa yang belum dikirim tetap terlihat tanpa workflow backorder otomatis.
- Surat Jalan draft tidak mengubah stok atau saldo.
- Jumlah Surat Jalan per baris harus positif dan tidak melebihi sisa SO.
- Dua penerbitan Surat Jalan yang bersaing tidak boleh mengambil stok yang sama; server mengunci dan memvalidasi ulang saat terbit.
- Stok karantina, kedaluwarsa atau tidak layak ditolak.
- Surat Jalan terbit dengan bukti serah terima menjadi sumber tunggal event penyerahan, stock movement, pendapatan dan HPP. Tidak ada POD terpisah pada Release 1.
- Invoice tidak boleh dibuat dua kali dari Surat Jalan yang sama dan tidak boleh melebihi jumlah Surat Jalan.
- Reversal atau koreksi menunjuk event asal; pengguna tidak mengedit saldo stok, AR atau GL secara langsung.
- Perubahan Setting hanya berlaku untuk dokumen baru; dokumen terbit mempertahankan snapshot.

## Izin minimum

Grant tiap tahap berdiri sendiri dan diuji melalui API:

- `sales_order.read`, `sales_order.create`, `sales_order.submit`
- grant outbound yang sudah ada untuk baca/buat/terbit Surat Jalan; tidak membuat katalog `delivery_note.*` baru tanpa migrasi eksplisit
- `sales_invoice.read`, `sales_invoice.post`
- `customer_receipt.read`, `customer_receipt.post`
- `journal.post` dan kontrol periode sesuai kebutuhan posting

Izin SO tidak menjadi fallback untuk Surat Jalan atau Invoice. Scope pelanggan, harga, biaya, stok dan saldo tetap diperiksa server.

## Kriteria selesai

- Alur tiga dokumen berhasil dijalankan pada route operasional dengan akun berizin.
- Jalur tanpa izin, stok kurang, kuantitas berlebih, periode tertutup, dokumen duplikat dan retry ditolak dengan aman.
- Penerbitan Surat Jalan menghasilkan tepat satu stock movement dan posting pendapatan/HPP.
- Invoice menghasilkan tepat satu AR dan dapat dibayar penuh atau sebagian tanpa mengubah saldo langsung.
- Dokumen terbit immutable, dapat diaudit dan mempertahankan snapshot konfigurasi, termasuk termin/TOP yang dipilih saat SO.
- Backend, integrasi dan browser test mencakup success serta rejection path.
- `./tools/validate-repository.ps1` lulus.
- Dokumen 00, 01, 02, 03, 04, 05, 06, 07, 08, 10, 11, 12, 14 dan 15 diselaraskan dengan aturan baru bahwa Surat Jalan adalah event penyerahan.

## Konfigurasi Release 1

- Termin/TOP dipilih pada SO dari daftar Setting. Nilai yang dipilih disnapshot dan menjadi dasar jatuh tempo Invoice; perubahan Setting hanya berlaku untuk SO baru.
- Termin Release 1 mengikuti daftar aktif perusahaan, termasuk Tunai/COD dan Tempo N hari bila dikonfigurasi. Prepay dan mode kredit Block tetap ditunda.
- Pajak penjualan bawaan dan ongkir opsional aktif sejak awal. Ongkir bawaan berasal dari Setting, dapat berupa tidak ada ongkir, ditanggung perusahaan, atau dibebankan kepada pelanggan sesuai konfigurasi dan izin.
- Pajak, ongkir, akun, format nomor dan TOP wajib memiliki default editable; sistem berhenti dengan pesan yang mengarah ke Setting bila konfigurasi yang diwajibkan sengaja dikosongkan atau dinonaktifkan.

