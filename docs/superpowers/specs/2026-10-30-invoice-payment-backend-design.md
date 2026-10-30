# Backend Invoice dan Terima Pembayaran

## Arah yang disetujui pengguna

Pengguna meminta backend operasional mengikuti `docs/mockup/evflow-office-design.pen`, lalu memastikan: jatuh tempo dari tanggal Surat Jalan diterbitkan + termin snapshot SO; nomor Invoice boleh diubah seperti mockup selama unik; Terima Pembayaran ikut dibangun. Jawaban ini mengizinkan implementasi cakupan tersebut.

## Cakupan dan kontrak

- Daftar Invoice: pencarian nomor/SJ/pelanggan, filter pelanggan, tab dan hitungan Semua/Belum dibayar/Dibayar sebagian/Lewat jatuh tempo/Lunas; draft terlihat tanpa AR.
- Form dan detail: sumber hanya SJ ISSUED, satu invoice per SJ, nomor usulan Setting dapat diganti, tanggal invoice, catatan cetak, alamat penagihan snapshot. Barang, harga, pajak dan ongkir diwarisi snapshot SJ. Termin immutable dari SO melalui SJ; due date memakai issuedAt dalam zona perusahaan (bukan handoverAt, tanggal dokumen SJ, tanggal Invoice atau jam input).
- Simpan/edit draft memakai versi dan idempotency; Submit memposting invoice dan AR secara atomik pada tanggal invoice. Pendapatan/HPP sudah di SJ sehingga tidak diposting ulang. Invoice posted immutable.
- Terima Pembayaran memakai tanggal terima, bank aktif perusahaan, nominal, referensi bank, referensi pelanggan opsional dan bukti transfer. Penerimaan dan alokasi invoice dalam satu transaksi; retry atau konkurensi tidak menggandakan saldo. Kelebihan terhadap outstanding ditolak pada form invoice ini.
- Potongan nominal/persen DPP memakai master Pajak potong atau Jenis Potongan aktif, snapshot akun/rule; tanpa tarif hardcoded. Bukti wajib yang belum lengkap tetap piutang dan diberi status menunggu bukti. Penyelesaian bukti kemudian memposting pengurangan AR tepat sekali.
- Endpoint form menyediakan lookup yang diperlukan tanpa mewajibkan akses ke menu Setting. Izin sales_invoice dan customer_receipt tetap independen; tanpa hak pembayaran detail tidak mengirim riwayat/bukti pembayaran. Harga mengikuti kontrol akses yang berlaku.

## Pendekatan

Perluas agregat Invoice dan gunakan modul Finance khusus, tetap memakai transactionCommand, nomor dokumen, period guard dan posting kernel bersama. Bangun command penerimaan invoice atomik; memakai dua request penerimaan lalu alokasi akan meninggalkan transaksi separuh selesai. Pertahankan endpoint lama yang masih dipakai dengan adapter ke kontrak baru bila sesuai; sumber POD/Packing tetap ditolak.

## Penerimaan dan batas pekerjaan

Requirement OTC-02/05/06, FIN-01/02/03/08/11/18, IAM-01/04, CFG-08. Buktikan persistence, jurnal seimbang, isolasi perusahaan, izin, nomor unik, versi draft, periode tertutup, snapshot, pembayaran parsial/lunas/pending proof, retry dan batas outstanding. Scope backend/API, migrasi dan dokumentasi; pembangunan ulang frontend bukan cakupan permintaan ini. Mockup adalah referensi kontrak dan tidak diubah.

Tidak memindahkan checkout karena perubahan Surat Jalan yang belum di-commit menjadi dependensi pekerjaan ini. Pertahankan seluruh perubahan pengguna. Tidak melakukan commit/push otomatis.

## Klarifikasi implementasi

Basis persen potongan mengikuti subtotal net sebelum PPN sebagaimana contoh mockup (2% × Rp28.700.000 = Rp574.000), bukan faktor DPP nilai lain pajak PPN. Tanggal Invoice adalah tanggal bisnis, dikonversi ke instant lokal untuk posting. Hak nilai sales_invoice.view_price dimigrasikan secara teraudit dari akses finansial Invoice/pembayaran yang sudah ada.
