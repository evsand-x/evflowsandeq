# Domain Finance

Dokumen ini adalah sumber domain kanonis untuk modul ini. Judul ‘Bagian asal’ mempertahankan keterlacakan isi sebelum konsolidasi; prioritas keputusan tetap mengikuti Peta Dokumen.


---

## Bagian asal: 12-finance-administration.md

# Finance, Akuntansi, dan Closing Bulanan

Status: rancangan untuk evaluasi. Dokumen ini menjabarkan fondasi finance PT Sandeq Sarana Medika. Nomor akun merupakan usulan awal dan dapat disesuaikan bersama penanggung jawab akuntansi sebelum transaksi nyata. Pengelolaan kewajiban dan dokumen pajak internal, termasuk worksheet PPh Badan, mengikuti [Pajak dan Kepatuhan](12-finance-administration.md); tarif, DPP, waktu terutang, eligibility pajak masukan, kompensasi kerugian, kredit pajak serta perlakuan withholding memakai aturan bertanggal efektif dan tidak ditanam permanen dalam kode. Ekspor XML pajak keluaran Coretax mengikuti [dokumen 38](12-finance-administration.md); direct API submission belum termasuk.

## 1. Prinsip dasar

1. Setiap transaksi posted menghasilkan jurnal debit dan kredit yang seimbang serta tertaut ke dokumen sumber.
2. Draft, persetujuan, SO, proforma, PR, PO, picking dan rencana pembayaran belum membentuk jurnal.
3. Saldo piutang, utang dan persediaan berasal dari subledger; akun kontrolnya tidak boleh diedit melalui jurnal manual biasa.
4. Koreksi transaksi posted dilakukan dengan reversal, credit note, debit note atau jurnal penyesuaian berizin. Riwayat lama tidak dihapus.
5. Tanggal dokumen, tanggal kejadian, tanggal posting dan periode akuntansi disimpan terpisah.
6. Jurnal otomatis memakai aturan bertanggal efektif agar perubahan akun tidak mengubah transaksi historis.
7. Satu perusahaan menggunakan Rupiah sebagai mata uang buku pada tahap awal. Transaksi mata uang asing dibahas jika benar-benar diperlukan.

## 2. Chart of Accounts — spesifikasi bisnis selesai

Struktur lengkap, template akun awal, atribut, lifecycle edit/nonaktif, akun kontrol, impor, hak akses dan kriteria penerimaan ditetapkan pada [Chart of Accounts PT Sandeq Sarana Medika](12-finance-administration.md). Daftar tersebut merupakan template yang fleksibel, bukan saldo atau akun yang tidak dapat diubah. Nama rekening, saldo awal dan mapping pajak aktual diisi pada penyiapan perusahaan.

Ringkasan kelompok:

| Rentang | Kelompok | Contoh akun utama |
|---|---|---|
| 1000–1099 | Kas dan bank | Kas Kecil; Bank per rekening; Dana Belum Teridentifikasi |
| 1100–1199 | Piutang | Piutang Usaha; Piutang Belum Ditagih; Penyisihan Piutang; Piutang Karyawan/Lainnya |
| 1200–1299 | Persediaan | Persediaan Barang Dagang; Persediaan Karantina; Persediaan Dalam Perjalanan; Persediaan Konsinyasi Keluar; Penurunan Nilai Persediaan |
| 1300–1399 | Pajak dan uang muka lancar | PPN Masukan; Pajak Dibayar di Muka; Uang Muka Supplier; Uang Muka Vendor; Biaya Dibayar di Muka |
| 1400–1499 | Aset tetap | Peralatan; Kendaraan; Inventaris Kantor; Akumulasi Penyusutan per kelompok |
| 1500–1599 | Aset lainnya | Jaminan; Aset Dalam Penyelesaian; akun lain yang disetujui |
| 2000–2099 | Utang usaha | Utang Supplier; Utang Vendor; Barang Diterima Belum Ditagih/GRNI |
| 2100–2199 | Utang pajak dan karyawan | PPN Keluaran; Utang PPh; Utang Gaji; Utang BPJS; Reimbursement Terutang |
| 2200–2299 | Kewajiban lancar lain | Uang Muka Pelanggan; Biaya Masih Harus Dibayar; Pendapatan Diterima di Muka |
| 2300–2399 | Kewajiban jangka panjang | Pinjaman dan kewajiban jangka panjang bila ada |
| 3000–3999 | Ekuitas | Modal; Tambahan Modal; Saldo Laba; Laba/Rugi Tahun Berjalan |
| 4000–4099 | Pendapatan penjualan | Penjualan Barang per kategori bila diperlukan; Pendapatan Ongkir yang Ditagihkan |
| 4100–4199 | Pengurang pendapatan | Retur Penjualan; Diskon Penjualan; Koreksi Penjualan |
| 5000–5099 | Harga pokok penjualan | HPP Barang Dagang; Penyesuaian HPP; Penurunan/Pemusnahan Persediaan |
| 6000–6099 | Beban penjualan | Ongkir ke Pelanggan; Komisi Sales; Sampel/Promosi; Perjalanan/Kunjungan |
| 6100–6199 | Beban gudang dan logistik | Bahan Kemasan; Bongkar Muat; Sewa Gudang; Pemeliharaan Gudang |
| 6200–6299 | Beban umum dan administrasi | ATK; Telekomunikasi; Jasa Profesional; Perizinan; Beban Bank |
| 6300–6399 | Beban karyawan | Gaji; Tunjangan; THR; BPJS Perusahaan; Lembur; Rekrutmen |
| 6400–6499 | Beban aset | Penyusutan; Pemeliharaan; Kerugian Pelepasan Aset |
| 7000–7999 | Pendapatan/beban lain | Pendapatan Jasa Giro; Selisih Pembulatan; Pendapatan/Beban Nonoperasional |
| 8000–8999 | Pajak penghasilan | Beban Pajak Penghasilan dan penyesuaian terkait sesuai kebijakan |

Dimensi pelanggan, supplier/vendor, produk, kategori, departemen, sales, rayon dan dokumen disimpan pada baris jurnal/subledger. Dimensi tersebut tidak perlu dibuat menjadi ribuan akun berbeda. Laporan per kategori atau pelanggan memakai dimensi transaksi, sehingga COA tetap ringkas. Spesifikasi rinci pada dokumen CoA menggantikan contoh awal apabila terdapat perbedaan kode atau klasifikasi.

## 3. Akun kontrol

Akun berikut dikendalikan subledger dan tidak boleh diposting manual tanpa prosedur khusus: Piutang Usaha, Piutang Belum Ditagih, Persediaan, Persediaan Dalam Perjalanan, Utang Supplier, Utang Vendor, GRNI, Uang Muka Pelanggan dan Uang Muka Supplier/Vendor.

Jurnal manual ke akun kontrol hanya melalui menu koreksi/opening dengan alasan, bukti, persetujuan dan referensi pihak atau dokumen. Sistem menolak jurnal yang membuat saldo subledger berbeda dari buku besar.

### Pengelolaan dan perubahan akun — disetujui pengguna

CoA menyediakan template awal, penambahan manual dan impor penyiapan dari Excel sesuai hak akses. Form akun minimal memuat kode, nama, kelompok/jenis akun, akun induk, tipe header/detail, saldo normal, izin jurnal manual, status aktif dan keterangan. Kode tidak boleh duplikat dan jurnal hanya boleh memakai akun detail aktif.

Akun yang belum pernah dipakai dapat diedit penuh atau dihapus sesuai izin. Setelah akun mempunyai jurnal, saldo awal, pemetaan posting atau referensi transaksi, akun tidak dapat dihapus. Nama dan keterangan tetap dapat diperbarui; kode dapat diubah secara terkontrol dengan pemeriksaan keunikan dan audit. Jurnal lama tetap menunjuk ID akun yang sama serta tidak dipindahkan atau dihitung ulang karena perubahan nama/kode.

Kelompok dasar, saldo normal, status akun kontrol dan perubahan akun induk yang mengubah klasifikasi laporan dibatasi setelah akun dipakai. Perubahan tersebut memakai tindakan reklasifikasi/migrasi berizin dengan pratinjau dampak, bukan edit biasa. Akun dapat dinonaktifkan agar tidak dipakai pada transaksi baru, tetapi tetap muncul pada histori dan laporan periode lama.

Akun baru atau akun yang diedit tidak otomatis mengganti jurnal transaksi. Pengguna berwenang harus mengatur **Pengaturan Jurnal Otomatis/posting profile** dengan tanggal berlaku. Perubahan mapping berlaku untuk transaksi baru sejak tanggal efektif dan tidak menulis ulang jurnal posted. Akun yang masih dipakai oleh mapping aktif tidak dapat dinonaktifkan sebelum mapping penggantinya valid.

## 4. Jurnal otomatis — spesifikasi bisnis selesai

Matriks lengkap kejadian, debit/kredit, POD, GRNI, retur, persediaan, ongkir, pembayaran, pajak, posting profile, exception, reversal, rekonsiliasi dan kriteria penerimaan ditetapkan pada [Jurnal Otomatis PT Sandeq Sarana Medika](12-finance-administration.md). Ringkasan di bawah tetap menjadi gambaran cepat; dokumen jurnal otomatis menjadi acuan rinci apabila terdapat perbedaan.

### Penjualan

| Kejadian | Debit | Kredit |
|---|---|---|
| Prospek, penawaran, SO, pemeriksaan kredit, alokasi, proforma, picking | Tidak ada jurnal | Tidak ada jurnal |
| Barang keluar gudang/dispatch | Persediaan Dalam Perjalanan | Persediaan Barang Dagang |
| POD: barang diterima pelanggan | HPP; Piutang Belum Ditagih | Persediaan Dalam Perjalanan; Pendapatan Penjualan |
| PPN keluaran telah terutang | Piutang Belum Ditagih atau akun pajak transisi | PPN Keluaran |
| Invoice resmi diposting | Piutang Usaha | Piutang Belum Ditagih; komponen pajak yang belum diakui bila berlaku |
| Pembayaran pelanggan dialokasikan | Bank; Pajak Dipotong Pelanggan bila ada bukti | Piutang Usaha |
| Uang muka pelanggan diterima | Bank | Uang Muka Pelanggan; pajak bila telah terutang |
| Uang muka dialokasikan ke invoice | Uang Muka Pelanggan | Piutang Usaha |

Kebijakan final Gelombang A adalah mengakui pendapatan dan HPP ketika jumlah diterima pelanggan dibuktikan melalui POD. Invoice yang diposting setelah POD memindahkan saldo dari Piutang Belum Ditagih ke Piutang Usaha dan tidak mengakui pendapatan kedua kali. Bila kontrak tertentu memindahkan kendali pada waktu berbeda, transaksi tersebut memerlukan profil posting tersendiri.

### Retur penjualan

Retur memiliki dua jalur yang tetap tertaut:

- Jalur fisik: penerimaan retur menambah persediaan karantina berdasarkan biaya sumber yang dapat ditelusuri. Barang belum boleh dijual sampai keputusan kualitas.
- Jalur finansial: credit note memotong Piutang Usaha atau membentuk kewajiban pengembalian dana sesuai alokasi yang disetujui.

Jika barang masih layak dan dimiliki perusahaan, jurnal nilai barang membalik HPP sesuai nilai sumber. Kerusakan atau penurunan nilai dicatat terpisah setelah pemeriksaan, bukan dengan mengubah harga pokok historis tanpa jejak.

### Pembelian barang dagang

| Kejadian | Debit | Kredit |
|---|---|---|
| PR, persetujuan dan PO Supplier | Tidak ada jurnal | Tidak ada jurnal |
| GR dan kepemilikan barang telah diterima | Persediaan Barang Dagang/Karantina | GRNI |
| Tagihan supplier diverifikasi dan diposting | GRNI; PPN Masukan yang memenuhi syarat; selisih/biaya sesuai kebijakan | Utang Supplier |
| Pembayaran supplier diposting | Utang Supplier | Bank; Utang Potongan Pajak bila berlaku |
| Pembayaran sebelum penerimaan/tagihan | Uang Muka Supplier | Bank |
| Ongkir pembelian yang memenuhi kapitalisasi | Persediaan atau penyesuaian landed cost | Utang Supplier/Vendor/Bank sesuai penagih |

GRNI memastikan stok dan nilai persediaan dapat diakui saat barang sudah menjadi milik perusahaan walaupun invoice supplier belum diterima. Invoice supplier kemudian memindahkan kewajiban GRNI ke Utang Supplier tanpa membentuk persediaan dua kali.

### Vendor, biaya dan aset

| Kejadian | Debit | Kredit |
|---|---|---|
| PO Vendor | Tidak ada jurnal | Tidak ada jurnal |
| Barang/jasa diterima dan tagihan diposting | Beban, Biaya Dibayar di Muka, Aset atau GRNI sesuai jenis; PPN Masukan bila memenuhi syarat | Utang Vendor |
| Pembayaran vendor | Utang Vendor | Bank; Utang Potongan Pajak bila berlaku |
| Aset mulai digunakan | Tidak ada jurnal tambahan bila perolehan sudah menjadi aset | Tidak ada jurnal |
| Penyusutan bulanan | Beban Penyusutan | Akumulasi Penyusutan |

Klasifikasi sebagai beban, prepaid atau aset tidak ditentukan hanya dari nama barang. Sistem menggunakan kategori item, masa manfaat, nilai kapitalisasi dan keputusan finance yang berlaku pada tanggal transaksi.

### Ongkos kirim

- Ongkir pembelian yang memenuhi kebijakan biaya perolehan dialokasikan ke nilai persediaan.
- Ongkir pengiriman ke pelanggan yang dibayar perusahaan dicatat sebagai Beban Ongkir Penjualan.
- Ongkir yang ditagihkan kepada pelanggan dicatat terpisah sebagai Pendapatan Ongkir atau komponen pendapatan sesuai kebijakan.
- Nilai estimasi belum membentuk jurnal. Satu biaya kiriman tidak boleh dicatat lagi pada tagihan supplier dan tagihan ekspedisi.

## 5. Jurnal manual dan penyesuaian

Menu Jurnal Umum digunakan untuk transaksi yang tidak memiliki modul sumber, akrual, prepaid, reklasifikasi dan koreksi. Form minimal: tanggal transaksi, periode, jenis jurnal, keterangan, akun, debit/kredit, dimensi, lampiran dan referensi. Draft dapat disunting; posted tidak dapat disunting.

Jurnal berulang dapat memakai template, tetapi setiap periode tetap menghasilkan draft untuk diperiksa. Pembalik otomatis untuk akrual harus memiliki tanggal reversal yang jelas. Impor jurnal memvalidasi keseimbangan, akun aktif, periode terbuka, duplikasi referensi dan hak akses sebelum posting.

## 5.1 Kas, bank, penerimaan dan pengeluaran — spesifikasi bisnis selesai

Master rekening/kas, penerimaan, pembayaran, transfer internal, kas kecil, bukti, status, approval, posting, reversal, staging mutasi dan kriteria penerimaan ditetapkan pada [Kas, Bank, Penerimaan, dan Pengeluaran](12-finance-administration.md). Rekonsiliasi bank secara rinci ditetapkan pada [Rekonsiliasi Bank](12-finance-administration.md).

## 5.2 Kartu piutang, kartu utang dan uang muka — spesifikasi bisnis selesai

Pemisahan AR, piutang belum ditagih, AP Supplier, AP Vendor, GRNI, uang muka, settlement, aging, follow-up, pemotongan tagihan dan saldo opening ditetapkan pada [Kartu Piutang dan Kartu Utang](12-finance-administration.md).

## 5.3 Biaya operasional dan reimbursement — spesifikasi bisnis selesai

Permintaan internal, pengeluaran stok operasional, tagihan Vendor, reimbursement, uang muka karyawan, prepaid, aset, approval, bukti, jurnal dan laporan ditetapkan pada [Biaya Operasional dan Reimbursement](12-finance-administration.md).

## 6. Hubungan subledger dan buku besar

Setiap saat sistem harus dapat membandingkan:

| Subledger | Akun buku besar pembanding |
|---|---|
| Total invoice pelanggan terbuka | Piutang Usaha |
| Barang diterima pelanggan belum diinvoicing | Piutang Belum Ditagih |
| Total invoice supplier terbuka | Utang Supplier |
| Total invoice vendor terbuka | Utang Vendor |
| Barang milik perusahaan diterima, belum ditagih | GRNI |
| Nilai stok gudang, karantina, transit dan konsinyasi | Akun persediaan masing-masing |
| Uang muka yang belum dialokasikan | Akun uang muka terkait |
| Mutasi rekening yang telah diposting | Akun bank terkait |

Selisih ditampilkan per dokumen dan tidak boleh disembunyikan dengan jurnal penyeimbang umum.

## 7. Hak akses finance

Hak akses dipisahkan per tindakan: melihat nilai biaya/HPP, membuat jurnal, posting jurnal, menerima pembayaran, mengeksekusi pembayaran, merekonsiliasi bank, menjalankan closing, menyetujui reopen dan melihat laporan. Satu pengguna boleh memegang beberapa hak melalui beberapa peran. Setiap tindakan tetap mengikuti aturan persetujuan dan audit yang berlaku.

## 8. Keputusan dan parameter lanjutan

Gelombang A menetapkan nilai awal POD sebagai waktu pengakuan normal, IDR, moving average, tolerance PO–GR–invoice 0, landed cost berdasarkan nilai pembelian net dan bucket aging awal. Parameter yang tercakup dokumen 40 dapat diubah melalui UI dengan validasi/snapshot; perubahan tidak menghitung ulang histori diam-diam. Parameter berikut tetap harus diisi sebelum fungsi terkait dipakai resmi:

1. struktur rekening bank/kas;
2. threshold dan masa manfaat aset per kelompok—sebelum itu seluruh kandidat aset direview Finance tanpa kapitalisasi otomatis;
3. perlakuan pajak dan dokumen potong sesuai arahan penanggung jawab pajak;
4. pengguna/peran yang berhak menyelesaikan exception dan batas kewenangannya.

Rincian operasional yang sudah disusun: [Kas dan Bank](12-finance-administration.md), [Kartu Piutang dan Kartu Utang](12-finance-administration.md), [Biaya Operasional dan Reimbursement](12-finance-administration.md), [Rekonsiliasi Bank](12-finance-administration.md), [HPP dan Penilaian Persediaan](12-finance-administration.md), [Closing Bulanan](12-finance-administration.md), [Laporan Keuangan](12-finance-administration.md), [Harga Jual dan Margin](10-sales-marketing.md), [Anggaran dan Budget vs Actual](12-finance-administration.md), serta [Aset Tetap dan Penyusutan](12-finance-administration.md). Mandatory configuration dan release gate mengikuti dokumen 39; nilai resmi tidak boleh ditebak.


---

## Bagian asal: 12-finance-administration.md

# Chart of Accounts PT Sandeq Sarana Medika

Status: spesifikasi bisnis poin Finance nomor 1 selesai. Daftar berikut menjadi template awal yang dapat ditambah, diedit dan dinonaktifkan sesuai hak akses. Nama rekening bank, saldo awal dan pemetaan pajak aktual diisi saat konfigurasi/cut-over; ketiganya bukan kekurangan pada rancangan CoA.

## 1. Struktur kode dan hierarki

Kode akun disimpan sebagai teks agar perusahaan dapat menambah pola sendiri. Template awal memakai enam digit:

| Digit awal | Kelompok laporan | Saldo normal |
|---|---|---|
| 1xxxxx | Aset | Debit |
| 2xxxxx | Liabilitas | Kredit |
| 3xxxxx | Ekuitas | Kredit |
| 4xxxxx | Pendapatan dan pengurang pendapatan | Kredit; akun kontra pendapatan Debit |
| 5xxxxx | Harga Pokok Penjualan | Debit |
| 6xxxxx | Beban operasional | Debit |
| 7xxxxx | Pendapatan/beban lain | Sesuai jenis akun |
| 8xxxxx | Pajak penghasilan | Debit atau sesuai klasifikasi |

Akun terdiri dari **Header** dan **Detail**. Header hanya mengelompokkan dan menjumlahkan; jurnal hanya dapat memakai akun Detail yang aktif. Kategori produk, produk, pelanggan, channel, rayon, sales, supplier/vendor dan departemen menggunakan dimensi transaksi, sehingga CoA tidak perlu digandakan untuk setiap pihak atau SKU.

## 2. Template akun awal

Kolom **Posting** memakai nilai: Tidak untuk header; Otomatis untuk akun kontrol/sistem; Terbatas untuk akun yang terutama berasal dari modul tetapi dapat dikoreksi melalui proses khusus; Manual untuk jurnal umum sesuai izin.

### Aset

| Kode | Nama akun | Tipe | Posting |
|---|---|---|---|
| 100000 | ASET | Header | Tidak |
| 110000 | ASET LANCAR | Header | Tidak |
| 111000 | Kas dan Bank | Header | Tidak |
| 111001 | Kas Kecil | Detail | Terbatas |
| 111100 | Rekening Bank | Header | Tidak |
| 111101 | Bank Operasional — Rekening 1 | Detail | Terbatas |
| 111102 | Bank Operasional — Rekening 2 | Detail | Terbatas |
| 112000 | Piutang | Header | Tidak |
| 112001 | Piutang Usaha | Detail | Otomatis — kontrol AR |
| 112002 | Piutang Belum Ditagih | Detail | Otomatis — kontrol unbilled |
| 112003 | Piutang Karyawan | Detail | Terbatas |
| 112004 | Piutang/Claim Supplier | Detail | Terbatas |
| 112009 | Penyisihan Kerugian Piutang | Detail kontra aset | Terbatas |
| 113000 | Persediaan | Header | Tidak |
| 113001 | Persediaan Barang Dagang — Gudang | Detail | Otomatis — kontrol stok |
| 113002 | Persediaan Barang Dagang — Karantina | Detail | Otomatis — kontrol stok |
| 113003 | Persediaan Dalam Perjalanan | Detail | Otomatis — kontrol stok |
| 113004 | Persediaan Konsinyasi Keluar | Detail | Otomatis — kontrol stok |
| 113005 | Persediaan Operasional/ATK | Detail | Otomatis — kontrol stok operasional |
| 113009 | Penyisihan Penurunan Nilai Persediaan | Detail kontra aset | Terbatas |
| 114000 | Uang Muka dan Biaya Dibayar di Muka | Header | Tidak |
| 114001 | Uang Muka Supplier | Detail | Otomatis — kontrol advance |
| 114002 | Uang Muka Vendor | Detail | Otomatis — kontrol advance |
| 114003 | Uang Muka Karyawan | Detail | Terbatas |
| 114004 | Biaya Dibayar di Muka | Detail | Terbatas |
| 114005 | Biaya Perolehan Persediaan Belum Dialokasikan | Detail | Terbatas — clearing landed cost |
| 115000 | Pajak Dibayar di Muka | Header | Tidak |
| 115001 | PPN Masukan | Detail | Terbatas — kontrol pajak |
| 115002 | PPh Pasal 22 Dibayar di Muka | Detail | Terbatas — kontrol pajak |
| 115003 | PPh Pasal 23 Dibayar di Muka | Detail | Terbatas — kontrol pajak |
| 115004 | PPh Pasal 25 Dibayar di Muka | Detail | Terbatas — kontrol pajak |
| 115009 | Pajak Dibayar di Muka Lainnya | Detail | Terbatas |
| 120000 | ASET TIDAK LANCAR | Header | Tidak |
| 121000 | Aset Tetap — Harga Perolehan | Header | Tidak |
| 121001 | Tanah | Detail | Terbatas |
| 121002 | Bangunan | Detail | Terbatas |
| 121003 | Kendaraan | Detail | Terbatas |
| 121004 | Peralatan Kantor | Detail | Terbatas |
| 121005 | Peralatan Gudang | Detail | Terbatas |
| 121006 | Peralatan Komputer dan TI | Detail | Terbatas |
| 121090 | Aset Dalam Penyelesaian | Detail | Terbatas |
| 122000 | Akumulasi Penyusutan | Header | Tidak |
| 122002 | Akumulasi Penyusutan Bangunan | Detail kontra aset | Otomatis |
| 122003 | Akumulasi Penyusutan Kendaraan | Detail kontra aset | Otomatis |
| 122004 | Akumulasi Penyusutan Peralatan Kantor | Detail kontra aset | Otomatis |
| 122005 | Akumulasi Penyusutan Peralatan Gudang | Detail kontra aset | Otomatis |
| 122006 | Akumulasi Penyusutan Peralatan Komputer dan TI | Detail kontra aset | Otomatis |
| 129000 | Aset Tidak Lancar Lainnya | Header | Tidak |
| 129001 | Uang Jaminan | Detail | Manual |
| 129009 | Aset Lainnya | Detail | Manual |

Nama dan jumlah rekening bank ditambahkan sesuai rekening perusahaan. Setiap rekening bank memiliki satu akun detail tersendiri dan satu master rekening bank yang tertaut; nomor rekening lengkap hanya terlihat bagi pengguna berizin.

### Liabilitas

| Kode | Nama akun | Tipe | Posting |
|---|---|---|---|
| 200000 | LIABILITAS | Header | Tidak |
| 210000 | LIABILITAS JANGKA PENDEK | Header | Tidak |
| 211000 | Utang Usaha dan Penerimaan Belum Ditagih | Header | Tidak |
| 211001 | Utang Supplier | Detail | Otomatis — kontrol AP Supplier |
| 211002 | Utang Vendor | Detail | Otomatis — kontrol AP Vendor |
| 211003 | Barang Diterima Belum Ditagih/GRNI | Detail | Otomatis — kontrol GRNI |
| 212000 | Utang Pajak | Header | Tidak |
| 212001 | PPN Keluaran | Detail | Terbatas — kontrol pajak |
| 212002 | Utang PPh Pasal 21 | Detail | Terbatas — kontrol pajak |
| 212003 | Utang PPh Pasal 23 | Detail | Terbatas — kontrol pajak |
| 212004 | Utang PPh Pasal 4 Ayat 2 | Detail | Terbatas — kontrol pajak |
| 212005 | Utang PPh Pasal 29 | Detail | Terbatas — kontrol pajak |
| 212009 | Utang Pajak Lainnya | Detail | Terbatas |
| 213000 | Utang Karyawan dan Iuran | Header | Tidak |
| 213001 | Utang Gaji | Detail | Otomatis |
| 213002 | Utang BPJS Kesehatan | Detail | Otomatis |
| 213003 | Utang BPJS Ketenagakerjaan | Detail | Otomatis |
| 213004 | Reimbursement Terutang | Detail | Otomatis |
| 214000 | Kewajiban Lancar Lainnya | Header | Tidak |
| 214001 | Uang Muka Pelanggan | Detail | Otomatis — kontrol advance |
| 214002 | Penerimaan Belum Teridentifikasi | Detail | Otomatis — kontrol penerimaan |
| 214003 | Biaya Masih Harus Dibayar | Detail | Terbatas |
| 214004 | Pendapatan Diterima di Muka | Detail | Terbatas |
| 214005 | Refund Pelanggan Terutang | Detail | Otomatis/Terbatas |
| 214009 | Kewajiban Lancar Lainnya | Detail | Manual |
| 220000 | LIABILITAS JANGKA PANJANG | Header | Tidak |
| 221001 | Pinjaman Jangka Panjang | Detail | Manual |
| 221009 | Kewajiban Jangka Panjang Lainnya | Detail | Manual |

### Ekuitas

| Kode | Nama akun | Tipe | Posting |
|---|---|---|---|
| 300000 | EKUITAS | Header | Tidak |
| 311001 | Modal Disetor | Detail | Terbatas |
| 311002 | Tambahan Modal Disetor | Detail | Terbatas |
| 312001 | Saldo Laba Ditahan | Detail | Terbatas |
| 313001 | Laba/Rugi Tahun Berjalan | Detail sistem | Otomatis — hasil laporan |
| 319001 | Ekuitas Lainnya | Detail | Manual |
| 319002 | Akun Penyeimbang Saldo Awal | Detail sementara | Terbatas — wajib nol sebelum go-live |

Laba/Rugi Tahun Berjalan dihitung sistem dari akun pendapatan dan beban. Pengguna tidak membuat jurnal operasional langsung ke akun tersebut.

### Pendapatan dan pengurang pendapatan

| Kode | Nama akun | Tipe | Posting |
|---|---|---|---|
| 400000 | PENDAPATAN USAHA | Header | Tidak |
| 411001 | Penjualan Barang Dagang | Detail | Otomatis |
| 411002 | Pendapatan Ongkos Kirim Ditagihkan | Detail | Otomatis |
| 411009 | Pendapatan Usaha Lainnya | Detail | Terbatas |
| 420000 | PENGURANG PENDAPATAN | Header | Tidak |
| 421001 | Retur Penjualan | Detail kontra pendapatan | Otomatis |
| 421002 | Diskon Penjualan | Detail kontra pendapatan | Otomatis |
| 421003 | Koreksi Penjualan | Detail kontra pendapatan | Terbatas |

Empat kategori alat kesehatan dilaporkan melalui dimensi kategori produk pada baris transaksi. Jika kemudian dibutuhkan akun pendapatan terpisah per kategori, akun anak dapat ditambahkan tanpa mengubah data produk atau transaksi lama.

### Harga pokok penjualan

| Kode | Nama akun | Tipe | Posting |
|---|---|---|---|
| 500000 | HARGA POKOK PENJUALAN | Header | Tidak |
| 511001 | HPP Barang Dagang | Detail | Otomatis |
| 511002 | Penyesuaian HPP | Detail | Terbatas |
| 511003 | Penurunan Nilai Persediaan | Detail | Terbatas |
| 511004 | Pemusnahan/Write-off Persediaan | Detail | Otomatis setelah persetujuan |
| 511005 | Selisih Stok | Detail | Otomatis setelah opname disetujui |

### Beban operasional

| Kode | Nama akun | Tipe | Posting |
|---|---|---|---|
| 600000 | BEBAN OPERASIONAL | Header | Tidak |
| 610000 | Beban Penjualan dan Pemasaran | Header | Tidak |
| 611001 | Beban Ongkos Kirim Penjualan | Detail | Terbatas |
| 611002 | Beban Komisi Sales | Detail | Otomatis/Terbatas |
| 611003 | Beban Sampel dan Trial | Detail | Terbatas |
| 611004 | Beban Promosi | Detail | Manual |
| 611005 | Beban Perjalanan dan Kunjungan Sales | Detail | Terbatas |
| 620000 | Beban Gudang dan Logistik | Header | Tidak |
| 621001 | Beban Bahan Kemasan | Detail | Terbatas |
| 621002 | Beban Bongkar Muat | Detail | Terbatas |
| 621003 | Beban Sewa Gudang | Detail | Terbatas |
| 621004 | Beban Utilitas Gudang | Detail | Terbatas |
| 621005 | Beban Pemeliharaan Gudang | Detail | Terbatas |
| 621006 | Beban Penyimpanan/Suhu Khusus | Detail | Terbatas |
| 630000 | Beban Karyawan | Header | Tidak |
| 631001 | Beban Gaji | Detail | Otomatis |
| 631002 | Beban Tunjangan | Detail | Otomatis |
| 631003 | Beban Lembur | Detail | Otomatis |
| 631004 | Beban THR | Detail | Otomatis |
| 631005 | Beban BPJS Kesehatan Perusahaan | Detail | Otomatis |
| 631006 | Beban BPJS Ketenagakerjaan Perusahaan | Detail | Otomatis |
| 631007 | Beban Rekrutmen dan Pelatihan | Detail | Terbatas |
| 640000 | Beban Umum dan Administrasi | Header | Tidak |
| 641001 | Beban ATK | Detail | Terbatas |
| 641002 | Beban Sewa Kantor | Detail | Terbatas |
| 641003 | Beban Listrik dan Air | Detail | Terbatas |
| 641004 | Beban Telepon dan Internet | Detail | Terbatas |
| 641005 | Beban Jasa Profesional | Detail | Terbatas |
| 641006 | Beban Perizinan dan Legalitas | Detail | Terbatas |
| 641007 | Beban Asuransi | Detail | Terbatas |
| 641008 | Beban Perangkat Lunak dan Langganan | Detail | Terbatas |
| 641009 | Beban Administrasi Bank | Detail | Terbatas |
| 641010 | Beban Rumah Tangga Kantor | Detail | Terbatas |
| 641099 | Beban Administrasi Lainnya | Detail | Manual |
| 650000 | Beban Penyusutan dan Pemeliharaan Aset | Header | Tidak |
| 651002 | Beban Penyusutan Bangunan | Detail | Otomatis |
| 651003 | Beban Penyusutan Kendaraan | Detail | Otomatis |
| 651004 | Beban Penyusutan Peralatan Kantor | Detail | Otomatis |
| 651005 | Beban Penyusutan Peralatan Gudang | Detail | Otomatis |
| 651006 | Beban Penyusutan Peralatan Komputer dan TI | Detail | Otomatis |
| 652001 | Beban Pemeliharaan Kendaraan | Detail | Terbatas |
| 652002 | Beban Pemeliharaan Peralatan | Detail | Terbatas |

### Pendapatan/beban lain dan pajak penghasilan

| Kode | Nama akun | Tipe | Posting |
|---|---|---|---|
| 700000 | PENDAPATAN DAN BEBAN LAIN | Header | Tidak |
| 711001 | Pendapatan Jasa Giro/Bunga | Detail pendapatan | Terbatas |
| 711002 | Keuntungan Pelepasan Aset | Detail pendapatan | Terbatas |
| 711003 | Pendapatan Penyesuaian Persediaan | Detail pendapatan | Otomatis setelah opname disetujui |
| 711009 | Pendapatan Nonoperasional Lainnya | Detail pendapatan | Manual |
| 721001 | Beban Bunga dan Pembiayaan | Detail beban | Terbatas |
| 721002 | Kerugian Pelepasan Aset | Detail beban | Terbatas |
| 721003 | Selisih Pembulatan | Detail beban/pendapatan | Terbatas |
| 721009 | Beban Nonoperasional Lainnya | Detail beban | Manual |
| 800000 | PAJAK PENGHASILAN | Header | Tidak |
| 811001 | Beban Pajak Penghasilan Kini | Detail | Terbatas |
| 811002 | Beban/Manfaat Pajak Tangguhan | Detail | Terbatas bila digunakan |

## 3. Atribut master akun

| Field | Aturan |
|---|---|
| Kode Akun | Wajib, unik per perusahaan, disimpan sebagai teks, spasi awal/akhir dibersihkan |
| Nama Akun | Wajib; nama yang jelas dan tidak hanya mengulang kode |
| Akun Induk | Wajib kecuali akun akar; tidak boleh membentuk siklus |
| Tipe | Header atau Detail; hanya Detail dapat diposting |
| Klasifikasi | Aset, Liabilitas, Ekuitas, Pendapatan, Kontra Pendapatan, HPP, Beban, Pendapatan/Beban Lain, Pajak Penghasilan |
| Saldo Normal | Debit atau Kredit; default diturunkan dari klasifikasi dan perubahan dibatasi |
| Jenis Kontrol | Kosong atau AR, unbilled, inventory, transit, AP supplier, AP vendor, GRNI, advance, tax, bank, payroll, system result |
| Posting Manual | Tidak, Terbatas, atau Diizinkan |
| Rekonsiliasi | Apakah akun membutuhkan open item/bank reconciliation |
| Dimensi Wajib | Misalnya pelanggan, supplier/vendor, produk, departemen atau karyawan sesuai jenis akun |
| Arus Kas | Operasi, Investasi, Pendanaan atau Tidak Berlaku; dipakai untuk penyusunan arus kas |
| Tanggal Berlaku | Tanggal mulai dan, bila dinonaktifkan, tanggal akhir |
| Status | Draft, Aktif, Nonaktif |
| Keterangan | Opsional |

Saldo akun tidak disimpan atau diedit di form CoA. Saldo berasal dari jurnal posted. Saldo awal dimasukkan melalui proses opening yang menghasilkan jurnal dan rekonsiliasi, bukan melalui field saldo pada master akun.

## 4. Pembuatan, perubahan, dan penonaktifan

1. Pengguna berizin dapat membuat akun satu per satu, menyalin akun sejenis atau mengimpor template Excel.
2. Akun belum pernah dipakai dan belum direferensikan mapping dapat diedit penuh atau dihapus.
3. Akun yang sudah direferensikan jurnal, opening, budget, bank, pajak atau posting profile tidak dapat dihapus.
4. Nama, kode dan keterangan akun terpakai dapat diperbarui dengan alasan dan audit. ID internal tidak berubah; jurnal lama tetap menunjuk akun yang sama.
5. Perubahan klasifikasi, saldo normal, tipe Header/Detail, control type atau parent yang mengubah laporan pada akun terpakai memerlukan proses reklasifikasi/migrasi khusus dengan pratinjau dampak. Edit biasa ditolak.
6. Akun nonaktif tetap terlihat pada histori/laporan lama tetapi tidak dapat dipilih pada transaksi baru.
7. Akun yang masih dipakai mapping aktif, rekening aktif, pajak aktif atau template jurnal aktif tidak dapat dinonaktifkan sebelum penggantinya berlaku.
8. Perubahan CoA tidak mengubah jurnal posted. Perubahan mapping jurnal otomatis memakai versi dan tanggal efektif.

Perubahan nama/kode menampilkan nama/kode terbaru pada daftar dan laporan saat ini. Audit menyimpan nilai sebelum/sesudah; dokumen/jurnal yang telah diterbitkan tetap memiliki referensi dan snapshot yang diperlukan untuk penelusuran.

## 5. Pemetaan dan akun kontrol

Menu **Pengaturan Jurnal Otomatis** memetakan kejadian transaksi ke akun. Minimal mencakup:

| Sumber | Mapping akun utama |
|---|---|
| Penjualan | Pendapatan barang, diskon, retur, ongkir ditagihkan, AR, unbilled dan PPN keluaran |
| Produk/persediaan | Persediaan gudang, karantina, transit, konsinyasi, HPP, selisih dan write-off |
| Pembelian supplier | GRNI, AP Supplier, PPN masukan, uang muka dan landed cost |
| Pembelian vendor | AP Vendor, uang muka, default beban/prepaid/aset menurut kategori item |
| Kas/bank | Satu akun GL per kas/rekening, biaya bank dan penerimaan belum teridentifikasi |
| HR/payroll | Beban gaji/komponen, utang gaji, pajak, BPJS dan reimbursement |
| Aset | Harga perolehan, akumulasi penyusutan, beban penyusutan, keuntungan/kerugian pelepasan |
| Pajak | PPN/PPh masukan, keluaran, dipotong dan terutang berdasarkan tax profile |

Akun kontrol tidak dapat dipakai pada jurnal umum biasa. Opening atau koreksi khusus akun kontrol wajib membawa jenis pihak, ID pihak/dokumen, jatuh tempo atau rincian stok yang sesuai agar subledger tetap sama dengan GL.

## 6. Impor dan ekspor CoA

Template impor memuat kode, nama, kode induk, tipe, klasifikasi, saldo normal, control type, posting manual, rekonsiliasi, arus kas, tanggal berlaku, status dan keterangan.

Alur impor: **unggah → validasi → pratinjau create/update/error → perbaiki → commit**. Validasi mencakup duplikasi dalam file/database, parent tidak ada, siklus, klasifikasi tidak cocok, perubahan field terkunci dan mapping terdampak. Commit bersifat atomik untuk baris valid dalam batch yang disetujui; hasil mencatat siapa, waktu, hash file, jumlah berhasil/gagal dan alasan. Menghilangkan akun dari file tidak otomatis menghapus atau menonaktifkan akun di sistem.

Ekspor mengikuti filter dan hak akses, serta memuat struktur hierarki dan status. Nilai saldo hanya ikut bila pengguna memiliki izin laporan; ekspor master CoA sendiri tidak harus menampilkan saldo.

## 7. Layar dan hak akses

Menu: **Finance → Akuntansi → Chart of Accounts**.

Daftar utama memakai tampilan pohon/tabel dengan kolom Kode, Nama, Klasifikasi, Tipe, Akun Induk, Posting, Status dan Mapping. Filter: pencarian, klasifikasi, Header/Detail, status, akun kontrol dan belum dipetakan. Tindakan sesuai izin: **Tambah Akun, Edit, Aktifkan/Nonaktifkan, Impor, Ekspor, Lihat Buku Besar, Lihat Riwayat**.

Form dibuat ringkas dalam halaman/panel dengan kelompok **Identitas · Klasifikasi · Kontrol · Pelaporan**. Saat field terkunci, tampilkan penyebab dan tautan mapping/transaksi yang membuatnya terkunci.

Permission granular:

- `account.read`
- `account.create`
- `account.update_safe_fields`
- `account.reclassify`
- `account.activate`
- `account.deactivate`
- `account.import`
- `account.export`
- `account.mapping.manage`
- `account.history.read`
- `account.balance.read`

Satu pengguna dapat memperoleh gabungan izin dari beberapa peran. Hak mengelola CoA tidak otomatis memberi hak membuat/posting jurnal atau melihat seluruh saldo.

## 8. Validasi dan kriteria penerimaan

Poin CoA dianggap siap implementasi apabila skenario berikut lulus:

1. Template awal dapat dipasang tanpa kode ganda dan menghasilkan hierarki laporan yang benar.
2. Pengguna berizin dapat menambah akun detail dan header manual.
3. Sistem menolak jurnal ke header, akun nonaktif, atau akun kontrol dari jurnal umum biasa.
4. Akun terpakai tidak dapat dihapus; perubahan aman tercatat dalam audit.
5. Sistem menolak perubahan parent yang membuat siklus atau memindahkan klasifikasi akun terpakai tanpa workflow reklasifikasi.
6. Akun yang masih dipakai mapping aktif tidak dapat dinonaktifkan.
7. Impor menampilkan pratinjau dan kesalahan sebelum commit serta tidak mengubah saldo.
8. Saldo tidak dapat diketik pada form akun; opening saldo menghasilkan jurnal terpisah.
9. Perubahan nama/kode tidak memutus referensi jurnal lama.
10. Laporan dapat memakai dimensi kategori produk/pelanggan/departemen tanpa membuat akun baru per pihak.
11. Pengguna tanpa `account.balance.read` dapat mengelola struktur sesuai izin tanpa melihat saldo akun.
12. Semua create/edit/activate/deactivate/import/reclassify/mapping tercatat dalam audit.

## 9. Parameter konfigurasi saat penyiapan perusahaan

Hal berikut diisi kemudian tanpa mengubah spesifikasi CoA:

- nama dan jumlah rekening bank/kas aktual;
- akun yang benar-benar digunakan atau dinonaktifkan dari template;
- saldo awal per tanggal cut-over melalui proses opening;
- mapping pajak sesuai profil transaksi yang berlaku;
- mapping item operasional/aset ke akun beban, prepaid atau aset;
- bila dibutuhkan, akun anak pendapatan/HPP per kategori selain pelaporan berbasis dimensi.

Dengan parameter tersebut, struktur CoA dapat mulai dari template tetapi tetap fleksibel mengikuti kebijakan perusahaan.


---

## Bagian asal: 12-finance-administration.md

# Jurnal Otomatis PT Sandeq Sarana Medika

Status: spesifikasi bisnis poin Finance nomor 2 selesai. Dokumen ini menetapkan kejadian pembentuk jurnal, akun debit/kredit, waktu pengakuan, kontrol posting, reversal dan rekonsiliasi. Tarif serta perlakuan pajak mengikuti profil bertanggal efektif dan tetap perlu divalidasi penanggung jawab pajak sebelum transaksi resmi.

Akun merujuk template [Chart of Accounts](12-finance-administration.md). Jika kode akun diubah, posting profile tetap merujuk ID akun internal agar histori tidak putus.

## 1. Prinsip posting

1. Jurnal hanya terbentuk dari kejadian bisnis yang berhasil diposting, bukan dari sekadar pembuatan dokumen.
2. Setiap jurnal wajib seimbang, memiliki sumber, event unik, tanggal bisnis, periode, pembuat sistem/pengguna dan jejak aturan posting yang digunakan.
3. Satu event bisnis hanya menghasilkan satu hasil posting untuk versi/profil yang sama. Pengulangan request tidak boleh menggandakan jurnal.
4. Jurnal posted tidak diedit atau dihapus. Koreksi memakai reversal dan transaksi pengganti/adjustment yang tertaut jurnal asal.
5. Akun kontrol hanya diposting melalui modul sumber atau workflow koreksi/opening khusus yang mempertahankan subledger.
6. Jumlah, harga, pajak, biaya dan HPP dihitung ulang di backend dari dokumen sumber. Frontend tidak mengirim total jurnal sebagai kebenaran akhir.
7. Periode harus terbuka. Closing atau posting berjalan menggunakan penguncian periode agar transaksi tidak masuk setelah periode ditutup.
8. Nilai uang jurnal dibulatkan ke dua desimal. Harga/biaya unit tetap disimpan dengan presisi lebih tinggi; selisih pembulatan yang sah masuk akun 721003 dan dapat ditelusuri.

## 2. Status dan waktu jurnal

Status jurnal: **Draft Sistem → Siap Diposting → Posted**, atau **Gagal Posting** bila validasi gagal. Reversal menghasilkan jurnal baru berstatus Posted yang menunjuk jurnal asal; jurnal asal diberi indikator Reversed/Partially Reversed tanpa dihapus.

Tanggal yang disimpan:

- tanggal kejadian bisnis, misalnya POD atau penerimaan supplier;
- tanggal dokumen, misalnya tanggal invoice;
- tanggal posting sistem;
- periode akuntansi;
- waktu server dan pengguna/proses yang menjalankan posting.

Jika tanggal kejadian berada pada periode tertutup, sistem tidak memundurkan jurnal secara diam-diam. Pengguna menjalankan koreksi pada periode terbuka sesuai izin, dengan referensi tanggal kejadian asli dan alasan.

## 3. Kejadian yang tidak membuat jurnal

Dokumen berikut tidak membentuk jurnal hanya karena dibuat, diajukan atau disetujui:

- prospek, peluang, kunjungan, penawaran dan pengajuan harga;
- referensi SP/PO pelanggan, SO, pemeriksaan kredit dan unlock;
- proforma invoice, alokasi stok, picking slip, packing list sebelum dispatch;
- forecast, kebutuhan, PR dan PO Supplier/Vendor;
- estimasi penjualan/penagihan, target, approval dan rencana pembayaran;
- tracking pengiriman yang belum mengubah penguasaan/kepemilikan atau stok.

Komitmen dapat ditampilkan pada laporan operasional/anggaran, tetapi bukan jurnal buku besar.

## 4. Penjualan normal

Default kebijakan: pendapatan dan HPP diakui pada **POD yang mengonfirmasi jumlah diterima pelanggan**. Jatuh tempo tetap dihitung dari tanggal POD + TOP. Kontrak khusus dengan waktu perpindahan kendali berbeda membutuhkan posting profile tersendiri yang disetujui finance.

| Kejadian | Debit | Kredit | Sumber/dimensi wajib |
|---|---|---|---|
| Dispatch dari gudang | 113003 Persediaan Dalam Perjalanan | 113001 Persediaan Barang Dagang — Gudang | Shipment, SO, produk, batch, qty, gudang/locator, biaya yang dibawa |
| POD diterima pelanggan — HPP | 511001 HPP Barang Dagang | 113003 Persediaan Dalam Perjalanan | POD, shipment, pelanggan, produk/kategori, sales, biaya dispatch |
| POD diterima pelanggan — pendapatan | 112002 Piutang Belum Ditagih | 411001 Penjualan Barang Dagang | POD, SO, pelanggan, produk/kategori, sales, nilai net sebelum pajak/ongkir |
| Ongkir ditagihkan dan menjadi hak perusahaan | 112002 Piutang Belum Ditagih | 411002 Pendapatan Ongkos Kirim Ditagihkan | POD/invoice stage, pelanggan, shipment; hanya nilai yang belum diakui |
| PPN keluaran terutang pada POD | 112002 Piutang Belum Ditagih atau akun transisi pajak sesuai profil | 212001 PPN Keluaran | Tax profile, DPP, tarif, tanggal terutang |
| Invoice resmi diposting | 112001 Piutang Usaha | 112002 Piutang Belum Ditagih | Invoice, pelanggan, POD lines, jatuh tempo; hanya jumlah diterima yang belum ditagih |

Jika PPN telah diakui sebelum invoice komersial diposting, posting invoice tidak mengakui PPN kedua kali. Jika profil pajak menetapkan saat terutang berbeda, bagian pajak memakai event dan akun transisi yang sesuai tanpa mengubah waktu pengakuan pendapatan secara otomatis.

Invoice asli yang dibawa saat pengiriman dapat berstatus **Diterbitkan — Menunggu POD**. Nomor dan snapshot dokumen dipertahankan; jurnal invoice dilakukan setelah POD tervalidasi. Kekurangan/penolakan penerimaan menyesuaikan jumlah yang boleh diposting, bukan menghapus histori dokumen pengiriman.

### Contoh penjualan

Barang net Rp10.000.000, HPP Rp7.000.000, ongkir yang ditagihkan Rp200.000, pajak diabaikan dalam contoh:

1. Dispatch: Dr Persediaan Dalam Perjalanan Rp7.000.000; Cr Persediaan Gudang Rp7.000.000.
2. POD: Dr HPP Rp7.000.000; Cr Persediaan Dalam Perjalanan Rp7.000.000.
3. POD: Dr Piutang Belum Ditagih Rp10.200.000; Cr Penjualan Rp10.000.000; Cr Pendapatan Ongkir Rp200.000.
4. Invoice posted: Dr Piutang Usaha Rp10.200.000; Cr Piutang Belum Ditagih Rp10.200.000.

## 5. Diskon, retur, pembatalan dan koreksi penjualan

Diskon yang sudah menjadi bagian harga net pada invoice mengurangi nilai pendapatan melalui akun 421002 atau langsung pada basis net sesuai posting profile, tetapi laporan harus dapat menunjukkan harga bruto, diskon dan penjualan net tanpa pengurangan dua kali.

### Credit note/nota retur finansial

| Kejadian | Debit | Kredit |
|---|---|---|
| Credit note atas barang/discount setelah invoice | 421001 Retur Penjualan atau 421002 Diskon Penjualan; 212001 PPN Keluaran bila boleh dibalik | 112001 Piutang Usaha atau 214005 Refund Pelanggan Terutang |
| Koreksi nilai non-retur | 421003 Koreksi Penjualan atau akun pendapatan terkait sesuai arah | 112001 Piutang Usaha atau sebaliknya |

Credit note mengurangi open item invoice sesuai alokasi. Jika invoice sudah lunas, nilai dapat menjadi saldo kredit/uang muka pelanggan atau refund terutang; tidak otomatis dianggap kas keluar.

### Penerimaan fisik retur pelanggan

Semua barang retur masuk locator karantina. Jika biaya sumber dapat ditelusuri dan barang masih mempunyai nilai yang dapat dipulihkan:

- Dr 113002 Persediaan Barang Dagang — Karantina;
- Cr 511001 HPP Barang Dagang, sebesar biaya sumber yang diterima kembali.

Setelah inspeksi:

- layak dijual: Dr 113001 Persediaan Gudang; Cr 113002 Persediaan Karantina;
- nilai turun: Dr 511003 Penurunan Nilai Persediaan; Cr 113002 atau 113009 sesuai kebijakan;
- dimusnahkan: Dr 511004 Pemusnahan/Write-off; Cr 113002 Persediaan Karantina.

Retur finansial dan fisik merupakan dua event tertaut. Salah satunya tidak boleh diasumsikan sudah terjadi hanya karena event lainnya selesai.

Pembatalan SO sebelum dispatch tidak membuat jurnal. Pembatalan setelah dispatch harus menyelesaikan pengembalian barang transit ke gudang/karantina. Pembatalan setelah POD/invoice menggunakan retur/credit note/reversal yang sah, bukan penghapusan SO.

## 6. Pembelian barang dagang

| Kejadian | Debit | Kredit | Sumber/dimensi wajib |
|---|---|---|---|
| GR: kepemilikan barang layak diterima | 113001 Persediaan Barang Dagang — Gudang | 211003 GRNI | PO, GR, supplier, produk, batch, qty, estimasi biaya |
| GR: kepemilikan diterima tetapi karantina | 113002 Persediaan Barang Dagang — Karantina | 211003 GRNI | PO, GR, alasan/status kualitas, produk/batch |
| Pelepasan karantina | 113001 Persediaan Gudang | 113002 Persediaan Karantina | Inspeksi/quality release, qty dan biaya yang sama |
| Tagihan supplier cocok GR | 211003 GRNI; 115001 PPN Masukan eligible; akun selisih/landed cost bila sah | 211001 Utang Supplier | Invoice supplier, PO, GR, tax profile, jatuh tempo |
| Barang supplier belum diterima tetapi dibayar | 114001 Uang Muka Supplier | Kas/Bank | Payment, supplier, PO/kontrak |
| Uang muka dialokasikan ke tagihan | 211001 Utang Supplier | 114001 Uang Muka Supplier | Supplier dan invoice yang sama |

Penerimaan fisik tidak otomatis membentuk aset jika kepemilikan belum berpindah menurut ketentuan PO/MOU. Dalam kondisi tersebut, kuantitas dapat dicatat sebagai barang titipan/menunggu kepemilikan tanpa jurnal nilai sampai syarat terpenuhi.

Jika harga invoice berbeda dari estimasi GR, sistem menghitung variance. Selisih dalam toleransi diselesaikan melalui akun/pembaruan landed cost yang ditetapkan; selisih di luar toleransi menahan posting sampai ada keputusan. Nilai GRNI, persediaan tersisa dan HPP yang sudah keluar tidak boleh dihitung dua kali.

### Contoh pembelian

Barang diterima dengan estimasi nilai Rp8.000.000; invoice supplier net Rp8.100.000, pajak diabaikan:

1. GR: Dr Persediaan Rp8.000.000; Cr GRNI Rp8.000.000.
2. Invoice: Dr GRNI Rp8.000.000; Dr Penyesuaian biaya/landed cost Rp100.000; Cr Utang Supplier Rp8.100.000.

Penyesuaian Rp100.000 dialokasikan ke persediaan tersisa dan/atau HPP terkait berdasarkan lineage biaya, bukan selalu dibebankan seluruhnya tanpa pemeriksaan.

## 7. Retur pembelian dan selisih penerimaan

Barang kurang tidak membuat jurnal stok. Barang rusak/tidak sesuai yang belum diterima kepemilikannya juga tidak menambah persediaan atau GRNI.

Jika barang milik perusahaan dikembalikan ke supplier:

| Kondisi | Debit | Kredit |
|---|---|---|
| Sebelum invoice supplier diposting | 211003 GRNI | 113001/113002 Persediaan terkait |
| Setelah invoice supplier diposting dan debit note/credit supplier diterima | 211001 Utang Supplier atau piutang/refund supplier | 113001/113002 Persediaan; pembalikan PPN Masukan bila berlaku |
| Supplier mengganti barang tanpa perubahan tagihan | 112004 Piutang/Claim Supplier bila claim bernilai diperlukan | Persediaan yang dikirim kembali; penerimaan pengganti menutup akun claim |

Nilai retur memakai biaya yang dapat ditelusuri. Selisih harga atau nilai yang disengketakan tetap terlihat sebagai open exception sampai diselesaikan.

## 8. Pergerakan dan penyesuaian persediaan

| Kejadian | Perlakuan jurnal |
|---|---|
| Transfer antar-locator dengan akun kualitas/kepemilikan yang sama | Tidak ada jurnal GL; hanya stock ledger |
| Pindah gudang ↔ karantina | Reklasifikasi antara 113001 dan 113002 |
| Dispatch | Reklasifikasi 113001 ke 113003 |
| Batal kirim/kembali sebelum POD | Reklasifikasi 113003 ke 113001 atau 113002 sesuai kondisi |
| Konsinyasi keluar milik perusahaan | Dr 113004; Cr 113001. Penjualan/HPP saat pemakaian/settlement sesuai bukti |
| Barang milik supplier/konsinyasi masuk | Tidak masuk persediaan milik perusahaan; dicatat pada stock ledger ownership supplier |
| Opname kurang yang disetujui | Dr 511005 Selisih Stok; Cr akun persediaan terkait |
| Opname lebih yang disetujui | Dr akun persediaan terkait; Cr 711003 Pendapatan Penyesuaian Persediaan setelah direview finance |
| Pemusnahan yang disetujui | Dr 511004; Cr akun persediaan terkait |
| Recall tanpa perpindahan/nilai | Tidak ada jurnal; status/batch diblokir. Jurnal timbul saat retur, impairment, replacement atau pemusnahan |

Persediaan Operasional/ATK pada akun 113005 terpisah dari persediaan barang dagang alat kesehatan. Pengeluaran operasional memindahkan nilai dari 113005 ke akun beban kategori dan tidak memengaruhi HPP penjualan.

Setiap jurnal persediaan membawa produk, satuan dasar, batch bila relevan, ownership, lokasi/status sumber, qty dan biaya. Total nilai stock ledger per akun harus sama dengan GL.

## 9. Ongkos kirim dan landed cost

### Ongkir pembelian

Ongkir dan biaya masuk yang memenuhi kebijakan biaya perolehan dikapitalisasi ke persediaan. Tagihan dapat berasal dari supplier barang atau vendor/ekspedisi, tetapi biaya kiriman yang sama hanya dicatat sekali.

| Kejadian | Debit | Kredit |
|---|---|---|
| Tagihan ongkir masuk yang eligible sebelum barang keluar | Persediaan atau 114005 Biaya Perolehan Persediaan Belum Dialokasikan | Utang Supplier/Vendor atau Bank |
| Landed cost dialokasikan | Akun persediaan per produk/batch | 114005 bila memakai akun penampung |
| Landed cost terlambat setelah sebagian barang terjual | Persediaan tersisa dan 511002 Penyesuaian HPP secara proporsional | Utang/akun penampung |

Dasar alokasi dapat berupa nilai, jumlah, berat atau volume dan disimpan pada dokumen. Metode aktual dipilih sesuai jenis biaya; sistem menampilkan pratinjau alokasi dan sisa yang belum dialokasikan sebelum posting.

### Ongkir penjualan

- Biaya ekspedisi yang ditanggung perusahaan: Dr 611001 Beban Ongkos Kirim Penjualan; Cr Utang Vendor/Bank.
- Ongkir yang ditagihkan kepada pelanggan: Cr 411002 Pendapatan Ongkos Kirim Ditagihkan melalui jurnal penjualan.
- Pelanggan membayar langsung ekspedisi: tidak ada jurnal perusahaan, kecuali perusahaan menjadi pihak penagih/pembayar menurut bukti.
- Estimasi ongkir tidak membuat jurnal.

Pendapatan ongkir dan beban ekspedisi tidak dinetokan di jurnal. Laporan margin dapat mempertemukannya berdasarkan shipment.

## 10. Pembelian vendor, biaya operasional dan aset

| Jenis penerimaan/tagihan | Debit saat posting tagihan | Kredit |
|---|---|---|
| Barang/jasa langsung digunakan | Akun beban terkait; 115001 PPN Masukan bila eligible | 211002 Utang Vendor |
| Manfaat beberapa periode | 114004 Biaya Dibayar di Muka; PPN Masukan bila eligible | 211002 Utang Vendor |
| Memenuhi kebijakan aset | Akun aset tetap/aset dalam penyelesaian; PPN Masukan bila eligible | 211002 Utang Vendor atau GRNI sesuai penerimaan |
| Reimbursement disetujui | Akun beban/aset/prepaid terkait | 213004 Reimbursement Terutang |
| Pembayaran reimbursement | 213004 Reimbursement Terutang | Kas/Bank |

Kategori item memberi usulan akun, tetapi finance tetap dapat mereview klasifikasi sesuai hak. Nama barang tidak otomatis menentukan kapitalisasi. Jadwal amortisasi/prepaid dan penyusutan membentuk jurnal periode berikutnya melalui modul terkait.

## 11. Penerimaan dan pembayaran

### Payroll dan kewajiban karyawan

| Kejadian | Debit | Kredit |
|---|---|---|
| Payroll approved dan posted | Beban gaji, tunjangan, lembur, THR, komisi, BPJS perusahaan sesuai komponen | 213001 Utang Gaji; utang PPh; utang BPJS; kewajiban lain sesuai snapshot |
| Potongan karyawan yang menjadi kewajiban pihak ketiga | Utang Gaji atau akun transisi payroll | Utang PPh/BPJS/kewajiban terkait |
| Pembayaran net payroll | 213001 Utang Gaji | Kas/Bank |
| Pembayaran PPh/BPJS | Utang PPh/BPJS | Kas/Bank |

Posting payroll hanya berasal dari run Approved dan setiap event/run version hanya boleh menghasilkan satu jurnal. Adjustment payroll membuat jurnal tambahan yang merujuk run asal; jurnal payroll posted tidak diedit.

### Penerimaan pelanggan

| Kejadian | Debit | Kredit |
|---|---|---|
| Dana masuk dan langsung dialokasikan | Kas/Bank; akun PPN Dipungut WAPU/clearing sesuai rule; akun PPh Dibayar di Muka sesuai jenis bila bukti valid | 112001 Piutang Usaha sesuai total alokasi |
| Dana masuk sebelum invoice/alokasi sebagai uang muka | Kas/Bank | 214001 Uang Muka Pelanggan |

Untuk pelanggan WAPU, PPN Dipungut WAPU dan PPh Dipotong merupakan dua `receipt_tax_components` berbeda. Posting merekonsiliasi uang bank dan kedua komponen tersebut terhadap AR bruto. Akun PPN mengikuti tax posting profile; PPh memakai akun pajak dibayar di muka sesuai jenis. Komponen tanpa bukti tervalidasi mengikuti akun sementara atau menahan penyelesaian sesuai policy. Keduanya tidak diposting sebagai diskon penjualan.
| Dana masuk belum diketahui pengirim/tujuannya | Kas/Bank | 214002 Penerimaan Belum Teridentifikasi |
| Identifikasi dana ke uang muka pelanggan | 214002 Penerimaan Belum Teridentifikasi | 214001 Uang Muka Pelanggan |
| Alokasi uang muka ke invoice | 214001 Uang Muka Pelanggan | 112001 Piutang Usaha |
| Refund saldo kredit pelanggan | 214005 Refund Pelanggan Terutang atau 214001 Uang Muka Pelanggan sesuai sumber | Kas/Bank |

Satu penerimaan dapat dialokasikan ke beberapa invoice pelanggan yang sama. Pembayaran sebagian tetap menyisakan open item. Kelebihan bayar tidak diakui sebagai pendapatan.

### Pembayaran supplier/vendor

| Kejadian | Debit | Kredit |
|---|---|---|
| Bayar tagihan supplier | 211001 Utang Supplier | Kas/Bank; 212003 Utang PPh 23 atau akun withholding lain bila berlaku |
| Bayar tagihan vendor | 211002 Utang Vendor | Kas/Bank; akun withholding bila berlaku |
| Biaya administrasi bank | 641009 Beban Administrasi Bank | Kas/Bank |
| Transfer antar-rekening sendiri | Kas/Bank tujuan | Kas/Bank sumber |

Persetujuan atau status sudah ditransfer belum mengurangi utang sampai pembayaran diposting. Referensi bank, tanggal nilai, bukti dan alokasi disimpan. Reversal pembayaran membuka kembali settlement dan open item secara atomik.

## 12. Pajak

Tarif pajak tidak ditulis tetap di posting rule. Tax profile menyimpan jenis pajak, tarif, DPP, akun, pihak pemotong/dipotong, masa berlaku dan aturan pembulatan. Jurnal pajak menyimpan snapshot profil agar transaksi lama tidak berubah ketika tarif diperbarui.

Lifecycle profil, faktur pajak, bukti potong, WAPU, masa dan rekonsiliasi mengikuti [Pajak dan Kepatuhan Pajak](12-finance-administration.md).

PPh Badan diposting hanya dari run yang disetujui. Provision pajak kini mendebit Beban Pajak Penghasilan Kini dan mengkredit utang/provision pajak sesuai mapping. Kredit PPh dan angsuran tervalidasi direkonsiliasi terhadap akun Pajak Dibayar di Muka; pembayaran kurang bayar mendebit utang pajak dan mengkredit bank. True-up memakai adjustment yang tertaut run serta jurnal asal. Posisi lebih bayar tidak otomatis menjadi kas atau piutang yang dapat ditagih tanpa dasar dan keputusan Finance. Pajak tangguhan tidak dijurnal otomatis sampai kebijakan, temporary difference dan mapping akun disetujui.

Generate/download/upload XML Coretax tidak membentuk atau membalik jurnal. Pencatatan hasil hanya boleh memperbarui status/nomor/bukti dokumen pajak setelah verifikasi dan tidak mengubah nilai jurnal tanpa dokumen koreksi yang sah. Direct API submission atau parser hasil terstruktur yang kelak ditambahkan mengikuti kontrol yang sama.

## 13. Posting profile dan prioritas aturan

Setiap posting profile memiliki:

- kode dan nama event;
- versi, status Draft/Aktif/Nonaktif dan tanggal berlaku;
- kondisi perusahaan, ownership, jenis transaksi, produk/kategori, pajak dan skenario;
- baris debit/kredit serta sumber nominal;
- akun fallback yang diizinkan atau status tertahan bila mapping tidak tersedia;
- dimensi wajib;
- aturan grouping baris jurnal;
- aturan pembulatan;
- kebutuhan approval atau review exception;
- daftar field bisnis yang membuat preview lama tidak berlaku.

Prioritas mapping: aturan paling spesifik yang valid → aturan kategori → default perusahaan. Jika dua aturan memiliki prioritas sama atau akun wajib belum dipetakan, transaksi tertahan dengan penjelasan konfigurasi; sistem tidak menebak akun.

Perubahan profile berlaku pada event baru sejak tanggal efektif. Jurnal yang sudah posted tidak dihitung ulang. Dokumen draft yang diposting setelah perubahan menggunakan profile yang berlaku pada tanggal/event sesuai kebijakan dan menampilkan preview terbaru.

## 14. Posting preview dan exception

Sebelum posting transaksi material, layar dapat menampilkan **Preview Jurnal**: tanggal, akun, debit, kredit, dimensi, sumber nominal dan profile version. Preview bersifat informasi; backend menghitung ulang saat posting.

Exception yang menahan posting antara lain:

- periode tertutup;
- jurnal tidak seimbang;
- akun tidak aktif/header/belum dipetakan;
- dimensi wajib tidak tersedia;
- sumber sudah diposting;
- qty/nilai melebihi sumber;
- subledger dan akun kontrol tidak cocok;
- selisih PO–GR–invoice di luar toleransi;
- biaya persediaan tidak dapat ditentukan;
- pajak tidak memiliki profil valid;
- versi dokumen berubah setelah preview/approval.

Gagal posting tidak boleh meninggalkan sebagian jurnal, stock movement, open item atau settlement. Seluruh perubahan bisnis dan jurnal commit bersama atau rollback bersama.

## 15. Jurnal manual, reversal dan adjustment

Jurnal manual hanya untuk transaksi yang tidak memiliki modul sumber, akrual, reklasifikasi, prepaid dan penyesuaian yang sah. Sistem memperingatkan bila akun/transaksi seharusnya melalui modul sumber.

Reversal wajib mencatat jurnal asal, alasan, tanggal reversal, periode terbuka, lampiran bila diwajibkan dan pemberi persetujuan sesuai kebijakan. Jika jurnal berasal dari invoice, pembayaran atau stock movement, reversal dilakukan dari dokumen sumber agar open item dan subledger ikut dibalik. Jurnal umum tidak boleh dipakai untuk menyamarkan selisih AR/AP/stok.

Adjustment persediaan dan landed cost menyimpan lineage ke penerimaan, stok tersisa dan HPP terdampak. Backdate yang mengubah urutan moving average ditolak pada tahap awal; koreksi dilakukan melalui workflow recost/adjustment pada periode terbuka.

## 16. Hak akses dan audit

Permission minimum:

- `journal.read`
- `journal.preview`
- `journal.manual.create`
- `journal.manual.submit`
- `journal.post`
- `journal.reverse`
- `journal.control_account.adjust`
- `posting_profile.read`
- `posting_profile.manage`
- `posting_exception.resolve`
- `inventory.cost.read`

Hak memproses dokumen operasional tidak otomatis memberi hak membuat jurnal manual atau mengubah posting profile. Pengguna boleh memiliki beberapa peran; semua izin tetap dievaluasi per tindakan dan cakupan.

Audit menyimpan dokumen/event sumber, request/idempotency key, profile/rule version, akun/dimensi, nominal, waktu, aktor, approval/exception, reversal dan perubahan mapping. Informasi harga modal/HPP mengikuti izin sensitif.

## 17. Rekonsiliasi wajib

Setelah posting, kontrol berikut harus dapat dijalankan:

| Kontrol | Perbandingan |
|---|---|
| AR | Total open item pelanggan = 112001 Piutang Usaha |
| Unbilled | POD diterima belum diinvoicing = 112002 Piutang Belum Ditagih |
| AP Supplier | Open invoice supplier = 211001 Utang Supplier |
| AP Vendor | Open invoice vendor = 211002 Utang Vendor |
| GRNI | Penerimaan milik perusahaan belum ditagih = 211003 GRNI |
| Persediaan | Nilai stock ledger per ownership/status = akun 113001–113004 |
| Uang muka | Saldo advance belum dialokasikan = 114001/114002/214001 |
| Bank | Mutasi posted dan rekonsiliasi = akun bank terkait |
| Pajak | Tax subledger/dokumen = akun pajak terkait |

Selisih menampilkan dokumen penyebab. Sistem tidak membuat jurnal penyeimbang otomatis untuk menyembunyikan perbedaan.

## 18. Kriteria penerimaan

Poin jurnal otomatis dianggap siap implementasi apabila:

1. Setiap event menghasilkan jurnal seimbang tepat satu kali meskipun request diulang.
2. SO, proforma, PR, PO, approval dan estimasi tidak membuat jurnal.
3. Dispatch, POD dan invoice tidak menggandakan persediaan, HPP, pendapatan atau piutang.
4. POD parsial hanya mem-posting qty yang diterima; invoice hanya mengambil qty POD belum ditagih.
5. GR dan invoice supplier tidak menggandakan persediaan/utang; GRNI dapat direkonsiliasi.
6. Retur fisik selalu masuk karantina dan terpisah dari credit note finansial.
7. Pembayaran parsial, beberapa invoice, uang muka, kelebihan bayar dan withholding mempertahankan open item dengan benar.
8. Ongkir masuk, ongkir keluar dan ongkir ditagihkan tidak dihitung dua kali.
9. Transfer locator tanpa perubahan akun tidak membuat GL; perubahan status/kepemilikan yang memerlukan reklasifikasi membuat jurnal yang tepat.
10. Periode tertutup, mapping hilang, dimensi hilang dan variance di luar toleransi menahan posting tanpa perubahan parsial.
11. Reversal menambah jurnal lawan dan membalik subledger terkait tanpa menghapus histori.
12. Perubahan posting profile tidak mengubah jurnal posted dan memiliki tanggal efektif/audit.
13. AR, unbilled, AP, GRNI, persediaan, uang muka, bank dan pajak dapat direkonsiliasi ke GL.
14. Pengguna tanpa izin biaya tidak dapat melihat HPP melalui preview, API atau ekspor.
15. Semua jurnal dapat ditelusuri dari laporan ke dokumen sumber dan sebaliknya.

## 19. Parameter konfigurasi saat implementasi

Spesifikasi jurnal selesai; parameter berikut tetap diisi pada penyiapan perusahaan:

- akun bank/kas aktual;
- tax profile dan waktu pajak terutang yang divalidasi penanggung jawab pajak;
- batas toleransi PO–GR–invoice;
- dasar alokasi tiap jenis landed cost;
- kebijakan nilai kapitalisasi aset;
- profile pengecualian kontrak yang mengalihkan kendali selain pada POD;
- pihak yang berhak menyelesaikan exception dan melakukan reversal.

Parameter tersebut tidak mengubah alur inti atau kontrol jurnal di atas.


---

## Bagian asal: 12-finance-administration.md

# Kas, Bank, Penerimaan, dan Pengeluaran

Status: spesifikasi bisnis poin Finance nomor 3 selesai. Dokumen ini mengatur master kas/rekening, penerimaan dana, pembayaran, transfer internal, kas kecil, bukti transaksi, posting dan kontrol saldo. Rekonsiliasi bank secara rinci ditetapkan pada [Rekonsiliasi Bank](12-finance-administration.md).

Jurnal mengikuti [Jurnal Otomatis](12-finance-administration.md) dan akun mengikuti [Chart of Accounts](12-finance-administration.md).

## 1. Tujuan dan prinsip

1. Semua uang masuk dan keluar harus tercatat melalui kas/rekening perusahaan yang aktif serta memiliki dokumen sumber atau alasan yang dapat ditelusuri.
2. Persetujuan, eksekusi transfer, posting akuntansi dan rekonsiliasi merupakan status berbeda.
3. Draft atau pembayaran yang baru disetujui belum mengubah kas/bank, piutang atau utang.
4. Transaksi posted tidak diedit atau dihapus; koreksi memakai reversal dan transaksi pengganti.
5. Saldo kas/bank berasal dari jurnal posted. Pengguna tidak dapat mengetik saldo langsung pada master rekening.
6. Satu rekening bank atau kas tertaut tepat ke satu akun GL detail aktif. Satu akun GL bank tidak boleh dipakai oleh dua rekening aktif tanpa alasan konfigurasi yang tervalidasi.
7. Tahap awal tidak mengasumsikan koneksi bank otomatis. Mutasi dapat diimpor dari file atau dicatat berdasarkan bukti, dengan riwayat sumber.
8. Mata uang awal adalah IDR sesuai rancangan saat ini. Field currency tetap tersedia agar perluasan tidak mengubah struktur data; transaksi mata uang asing tidak diaktifkan sebelum kebijakannya disetujui.

## 2. Navigasi

Menu **Finance → Kas & Bank**:

- Ringkasan Kas & Bank
- Rekening & Kas
- Penerimaan Dana
- Pembayaran
- Transfer Antar-Rekening
- Kas Kecil
- Mutasi Bank
- Rekonsiliasi Bank
- Dana Belum Teridentifikasi

Menu dan tindakan mengikuti hak akses. Rekonsiliasi Bank tampil sebagai menu yang sama, tetapi aturan lengkapnya mengikuti poin nomor 7.

## 3. Master rekening dan kas

### Atribut

| Field | Aturan |
|---|---|
| Kode | Wajib dan unik per perusahaan |
| Nama | Nama yang mudah dikenali pengguna, misalnya Bank Operasional Utama atau Kas Kecil Kantor |
| Jenis | Bank, Kas Kecil, Kas Operasional, atau Clearing bila benar-benar diperlukan |
| Bank | Nama bank untuk jenis Bank |
| Cabang | Opsional |
| Nomor rekening | Disimpan terenkripsi; daftar umum hanya menampilkan beberapa digit terakhir |
| Atas nama | Nama pemilik rekening perusahaan |
| Mata uang | Default IDR |
| Akun GL | Akun detail Kas/Bank aktif, misalnya 111001 atau rekening anak 111101+ |
| Metode pembayaran | Transfer, tunai, cek/giro atau metode internal lain yang diaktifkan |
| Penanggung jawab/cakupan | Pengguna/peran yang boleh melihat, mencatat, mengeksekusi atau merekonsiliasi |
| Saldo minimum | Opsional untuk peringatan, tidak memblokir kecuali kebijakan menetapkan |
| Status | Draft, Aktif, Nonaktif |
| Tanggal berlaku | Mulai dan akhir penggunaan |
| Keterangan | Opsional |

Nomor rekening lengkap, dokumen bank dan saldo hanya terlihat sesuai izin. Pengguna yang boleh memilih rekening untuk transaksi belum tentu boleh melihat seluruh detail sensitif atau saldo.

### Aturan lifecycle

- Rekening belum dipakai dapat diedit penuh atau dihapus sesuai izin.
- Rekening yang sudah memiliki transaksi tidak dapat dihapus; nama nonkritis dapat diperbarui dan rekening dapat dinonaktifkan.
- Akun GL tidak dapat diganti lewat edit biasa setelah rekening dipakai. Perubahan memakai migrasi/reklasifikasi terkontrol.
- Rekening dengan pembayaran belum selesai, penerimaan belum diposting atau mutasi belum direkonsiliasi tidak dapat dinonaktifkan tanpa penyelesaian/transfer tanggung jawab.
- Saldo awal dimasukkan melalui opening balance dan harus cocok dengan rekening koran/kas fisik pada tanggal cut-over.

## 4. Ringkasan Kas & Bank

Ringkasan menampilkan per rekening/kas:

- saldo buku saat ini dan tanggal acuan;
- penerimaan/pengeluaran hari ini dan periode pilihan;
- transaksi menunggu verifikasi, persetujuan, eksekusi atau posting;
- dana belum teridentifikasi;
- mutasi bank belum dicocokkan;
- saldo minimum dan indikator kekurangan dana;
- tanggal mutasi/rekomendasi terakhir.

Total hanya menjumlahkan rekening dengan mata uang yang sama. Saldo buku dibedakan dari saldo rekening koran dan saldo tersedia bank; tanpa koneksi/import terbaru, sistem menampilkan waktu pembaruan dan tidak menyebutnya saldo real-time.

## 5. Penerimaan dana

Penerimaan dapat dibuat dari:

- tombol **Terima Pembayaran** pada detail invoice pelanggan;
- daftar piutang/kartu piutang;
- uang muka pelanggan sebelum invoice;
- mutasi bank yang diidentifikasi;
- setoran tunai atau penerimaan lain yang sah;
- dana belum teridentifikasi yang kemudian ditemukan pemiliknya.

### Form penerimaan

| Kelompok | Field utama |
|---|---|
| Identitas | Nomor internal otomatis, tanggal dana diterima, kas/rekening tujuan, metode, mata uang |
| Pihak | Pelanggan/pihak pembayar; boleh belum diketahui hanya untuk dana belum teridentifikasi |
| Bank | Nominal bruto, referensi bank, nama pengirim bila tersedia, tanggal nilai |
| Alokasi | Invoice, outstanding sebelum alokasi, nilai dialokasikan, sisa invoice |
| Komponen | Uang masuk bank; tabel pajak dengan baris terpisah PPN Dipungut WAPU dan PPh Dipotong; biaya bank yang valid, uang muka, nilai belum dialokasikan |
| Bukti | Bukti transfer/setoran, bukti potong, catatan |
| Kontrol | Pembuat, verifikator, status, versi dan riwayat |

Satu penerimaan boleh dialokasikan ke beberapa invoice milik pelanggan yang sama. Satu invoice boleh menerima beberapa pembayaran. Untuk WAPU, `PPN Dipungut WAPU` dan `PPh Dipotong` dicatat sebagai dua komponen pajak, masing-masing dengan jenis, DPP, tarif, nominal, nomor/tanggal/masa bukti, file dan status verifikasi. Total uang masuk bank, komponen pajak yang diakui, alokasi invoice dan sisa uang muka harus merekonsiliasi nilai penyelesaian AR. Komponen pajak bukan diskon penjualan.

### Status penerimaan

**Draft → Menunggu Verifikasi → Terverifikasi → Posted**. Status **Dibatalkan** berlaku sebelum posted; setelah posted gunakan **Reversed** melalui transaksi reversal.

Pengguna yang memiliki hak sesuai aturan dapat memverifikasi dan mem-posting pada alur yang ringkas, tetapi sistem tetap menyimpan kedua tindakan. Nilai besar atau kondisi tertentu dapat memakai approval configurable.

### Perlakuan kondisi khusus

| Kondisi | Perlakuan |
|---|---|
| Pembayaran sebagian | Alokasikan nilai aktual; invoice tetap terbuka sebesar sisanya |
| Membayar beberapa invoice | Alokasi per invoice disimpan eksplisit |
| Kelebihan bayar | Sisa menjadi 214001 Uang Muka Pelanggan atau ditahan untuk klarifikasi; bukan pendapatan |
| Belum ada invoice | Catat sebagai Uang Muka Pelanggan |
| Pengirim belum diketahui | Kredit 214002 Penerimaan Belum Teridentifikasi sampai diidentifikasi |
| PPN dipungut pelanggan WAPU | Komponen terpisah dari PPh; akun mengikuti tax posting profile dan bukti pungut harus diverifikasi |
| Potongan PPh oleh pelanggan | Komponen terpisah per jenis PPh; diakui ke akun pajak dibayar di muka hanya setelah jenis/nilai dan bukti memenuhi syarat |
| Dana sudah dicatat dari mutasi | Gunakan alokasi/identifikasi penerimaan yang sama; jangan membuat penerimaan kedua |
| Salah alokasi | Reverse/reallocate sesuai izin dan periode; histori alokasi lama tetap ada |

Tombol Terima Pembayaran pada detail invoice mengisi pelanggan, invoice dan outstanding dari server. Pengguna memilih tanggal, rekening/kas, uang masuk, referensi dan bukti. Profil WAPU mengusulkan baris PPN Dipungut WAPU dan PPh Dipotong tanpa mengunci nilai; pengguna berizin memverifikasi rule dan bukti. Tombol tersebut tidak langsung menandai lunas sebelum posting berhasil.

## 6. Pengeluaran dan pembayaran

Pembayaran dapat bersumber dari:

- tagihan supplier;
- tagihan vendor;
- reimbursement karyawan;
- uang muka supplier/vendor/karyawan;
- pajak dan kewajiban lain;
- payroll pada fase modul terkait;
- biaya operasional tanpa utang sebelumnya melalui dokumen beban yang sah;
- refund pelanggan;
- transaksi lain yang memiliki akun, pihak dan bukti yang valid.

### Form pembayaran

| Kelompok | Field utama |
|---|---|
| Identitas | Nomor internal, tanggal rencana, tanggal eksekusi/nilai, rekening/kas sumber, metode |
| Penerima | Supplier, Vendor, Karyawan, Pelanggan, Pemerintah atau pihak lain yang tervalidasi |
| Tujuan pembayaran | Tagihan/open item, uang muka, reimbursement, refund, pajak atau biaya langsung |
| Rincian | Nominal bruto, alokasi per tagihan, potongan pajak, biaya bank, nilai transfer neto |
| Rekening tujuan | Bank, nomor rekening tersamarkan, atas nama, sumber master/snapshot |
| Bukti | Invoice/tagihan, approval, bukti transfer/cek/kuitansi dan catatan |
| Kontrol | Pemohon, approver, eksekutor, poster, status dan riwayat |

Rekening tujuan diambil dari master pihak dan disimpan sebagai snapshot pada pembayaran. Perubahan rekening tujuan setelah approval merupakan perubahan material dan memerlukan evaluasi/persetujuan ulang.

### Status pembayaran

**Draft → Menunggu Persetujuan → Disetujui → Dijadwalkan/Siap Ditransfer → Dieksekusi → Posted**.

Status tambahan:

- **Perlu Revisi** atau **Ditolak** pada proses approval;
- **Dibatalkan** sebelum eksekusi/posting;
- **Gagal Transfer** bila bank menolak atau dana tidak berpindah;
- **Reversed** setelah pembayaran posted dibatalkan melalui proses koreksi.

Approval tidak berarti dana sudah berpindah. Status Dieksekusi memerlukan referensi/bukti transfer atau konfirmasi tunai. Posting mengurangi kas/bank serta menyelesaikan utang/open item dalam transaksi atomik.

### Pembayaran gabungan dan parsial

- Satu pembayaran dapat melunasi beberapa tagihan milik pihak yang sama dan mata uang yang sama.
- Satu tagihan dapat dibayar bertahap.
- Batch pembayaran boleh memuat beberapa penerima, tetapi menghasilkan instruksi dan bukti pembayaran terpisah per penerima/rekening; kegagalan satu instruksi tidak boleh menandai semuanya berhasil.
- Pembayaran tidak boleh melebihi jumlah yang disetujui dan outstanding kecuali kelebihannya secara eksplisit menjadi uang muka.
- Tagihan yang sedang dialokasikan pembayaran lain dikunci atau dihitung ulang untuk mencegah pembayaran ganda.

## 7. Transfer antar-rekening dan kas

Transfer internal meliputi:

- bank ke bank milik perusahaan;
- bank ke kas untuk penarikan tunai;
- kas ke bank untuk setoran;
- pengisian atau pengembalian kas kecil.

Form memuat rekening sumber, rekening tujuan, tanggal keluar, tanggal diterima, nominal, biaya bank, referensi dan bukti. Sumber dan tujuan tidak boleh sama.

Jika perpindahan kedua sisi terjadi pada tanggal yang sama, jurnal dapat langsung Dr rekening tujuan dan Cr rekening sumber. Bila ada jeda material, sistem dapat memakai akun clearing transfer yang dikonfigurasi sehingga saldo perjalanan terlihat sampai penerimaan dikonfirmasi. Biaya bank dicatat terpisah ke 641009 dan tidak mengurangi nominal transfer tanpa penjelasan.

Transfer internal tidak menjadi pendapatan atau beban selain biaya bank. Transaksi sumber dan tujuan tertaut satu transfer_id agar tidak dicatat sebagai penerimaan/pengeluaran eksternal ganda.

## 8. Kas kecil

Kas kecil mendukung dua kebijakan yang dapat dipilih per kas:

- **Imprest**: saldo dana ditetapkan; pengisian kembali sebesar bukti pengeluaran yang telah disetujui.
- **Fluktuatif**: saldo dapat bertambah/berkurang sesuai transaksi yang diizinkan.

Perusahaan memilih kebijakan saat konfigurasi kas kecil. Sistem tidak mencampur metode dalam satu periode tanpa perubahan kebijakan bertanggal efektif.

Alur kas kecil:

**Permintaan/Pengeluaran → Bukti → Verifikasi kategori/akun → Persetujuan bila perlu → Posted → Pengisian Kembali/Settlement**.

Field minimal: tanggal, penerima, tujuan, kategori biaya, akun, departemen, nominal, bukti, pemohon dan penjaga kas. Batas maksimum transaksi dan kebutuhan approval dapat diatur. Pengeluaran tanpa bukti dapat disimpan sebagai belum lengkap tetapi tidak dianggap selesai/layak closing sebelum diselesaikan sesuai kebijakan.

Kas opname mencatat saldo sistem, uang fisik per pecahan bila diperlukan, selisih, alasan, pemeriksa dan persetujuan. Selisih tidak langsung dihapus; adjustment memakai jurnal dan approval yang dapat ditelusuri.

## 9. Penomoran dan bukti

Jenis nomor dokumen awal:

- BM — Bukti Penerimaan/Uang Masuk;
- BK — Bukti Pembayaran/Uang Keluar;
- TRF — Transfer Antar-Rekening;
- KKV — Voucher Kas Kecil.

Kode/pola final tetap diatur melalui Setting → Penomoran Dokumen. Nomor diberikan pada tahap yang dikonfigurasi dan tidak digunakan ulang setelah dokumen diterbitkan/diposting.

Bukti transaksi dapat dicetak atau disimpan PDF dengan nomor, tanggal, kas/rekening tersamarkan, pihak, tujuan, nominal angka/terbilang bila diperlukan, alokasi, referensi, pembuat/verifikator/approver/eksekutor dan QR/reference untuk penelusuran internal. Perubahan template tidak mengubah bukti historis.

## 10. Posting akuntansi

### Penerimaan

| Kondisi | Debit | Kredit |
|---|---|---|
| Pembayaran invoice | Kas/Bank; pajak dipotong pelanggan yang valid | 112001 Piutang Usaha |
| Uang muka pelanggan | Kas/Bank | 214001 Uang Muka Pelanggan |
| Dana belum teridentifikasi | Kas/Bank | 214002 Penerimaan Belum Teridentifikasi |
| Penerimaan lain | Kas/Bank | Akun sumber yang disetujui berdasarkan jenis transaksi |

### Pengeluaran

| Kondisi | Debit | Kredit |
|---|---|---|
| Bayar tagihan supplier | 211001 Utang Supplier | Kas/Bank dan utang withholding bila berlaku |
| Bayar tagihan vendor | 211002 Utang Vendor | Kas/Bank dan utang withholding bila berlaku |
| Uang muka supplier/vendor | 114001/114002 | Kas/Bank |
| Reimbursement | 213004 Reimbursement Terutang | Kas/Bank |
| Payroll neto | 213001 Utang Gaji | Kas/Bank |
| PPh 21/BPJS karyawan dan perusahaan | Utang PPh/BPJS sesuai jenis | Kas/Bank |
| Refund pelanggan | 214005 Refund Pelanggan Terutang atau 214001 Uang Muka Pelanggan | Kas/Bank |
| Biaya langsung yang sah | Akun beban/aset/prepaid terkait | Kas/Bank |

### Transfer

Dr kas/rekening tujuan; Cr kas/rekening sumber. Jika memakai clearing, sisi keluar dan masuk menutup akun clearing yang sama. Jurnal, settlement dan status pembayaran dibuat atomik sesuai event sumber.

## 11. Reversal, pembatalan, dan kegagalan

- Draft/menunggu approval dapat dibatalkan dengan alasan sesuai izin.
- Pembayaran gagal transfer kembali ke status yang dapat diperbaiki; tidak membuat jurnal kas keluar.
- Kesalahan setelah posted menggunakan reversal. Reversal membuka kembali invoice/tagihan atau uang muka terkait dan membuat jurnal lawan.
- Jika dana secara nyata sudah kembali/ditarik ulang pada tanggal berbeda, catat transaksi bank yang sebenarnya; jangan hanya mengubah status historis.
- Reversal pada periode tertutup dilakukan pada periode terbuka melalui prosedur koreksi, dengan tanggal kejadian asli sebagai referensi.
- Bukti transfer yang diganti, rekening tujuan berubah atau nominal berubah setelah approval memicu approval ulang sesuai pengaturan.

## 12. Mutasi bank dan keterkaitan rekonsiliasi

Mutasi bank dapat diimpor melalui CSV/XLSX atau format yang didukung saat implementasi. Field minimal: rekening, tanggal transaksi/nilai, deskripsi, debit/kredit, nominal, saldo bila tersedia dan ID/reference eksternal.

Impor menggunakan hash/file ID dan external line ID untuk mencegah duplikasi. Baris mutasi berada di staging dan tidak otomatis membuat penerimaan, pembayaran atau jurnal. Pengguna dapat:

- mencocokkan dengan transaksi ERP yang sudah ada;
- membuat draft penerimaan/pengeluaran berdasarkan baris mutasi;
- menandai transfer antar-rekening;
- menempatkan penerimaan yang belum diketahui ke Dana Belum Teridentifikasi;
- menandai baris duplikat/diabaikan dengan alasan.

Aturan auto-match, toleransi tanggal/nominal, rekonsiliasi saldo awal/akhir dan penutupan rekonsiliasi mengikuti [Rekonsiliasi Bank](12-finance-administration.md).

## 13. Hak akses dan persetujuan

Permission minimum:

- `cash_bank.read`
- `cash_bank.balance.read`
- `cash_bank.account.manage`
- `receipt.create`
- `receipt.verify`
- `receipt.post`
- `receipt.reverse`
- `payment.create`
- `payment.submit`
- `payment.approve`
- `payment.execute`
- `payment.post`
- `payment.reverse`
- `transfer.create`
- `transfer.approve`
- `petty_cash.manage`
- `bank_statement.import`
- `bank_reference.full.read`

Satu pengguna dapat memiliki beberapa izin dari beberapa peran. Self-approval default nonaktif untuk pembayaran; pengecualian harus eksplisit, beralasan dan diaudit. Hak posting tidak otomatis memberi hak mengeksekusi transfer, dan hak mengeksekusi tidak otomatis memberi hak mengubah master rekening.

Aturan persetujuan dapat memakai jenis pembayaran, nominal, kas/rekening sumber, departemen, penerima, kategori biaya dan kondisi perubahan. Tidak ada approver valid membuat transaksi tertahan, bukan otomatis disetujui.

## 14. Database konseptual

| Entitas | Isi utama |
|---|---|
| cash_bank_accounts | kode, jenis, bank/cabang, nomor terenkripsi/masked, atas nama, currency, gl_account_id, policy, status/effective date |
| cash_bank_account_scopes | account_id, user/role/scope, permission class |
| receipts | nomor, tanggal/value date, account, payer/customer, amount, method, bank ref, state, evidence, version |
| receipt_components / receipt_tax_components | cash amount, fee, advance, unidentified dan akun terkait; kind vat_collected_by_customer/income_tax_withheld/other, tax rule snapshot, DPP/rate/amount, certificate data/file/status dan mapped account |
| payments | nomor, planned/executed/value date, source account, payee type/id, purpose, gross/net, destination snapshot, state, version |
| payment_allocations | payment_id, open_item/advance/claim, amount, withholding component |
| internal_transfers | source/destination account, out/in dates, amount, clearing, fee, state, references |
| petty_cash_vouchers | cash account, requester/payee, purpose, expense account/dimensions, amount, evidence, state |
| cash_counts | account, counted_at, system/physical amount, denomination detail, difference, reviewer/resolution |
| bank_statement_imports/lines | file hash, account, period; external ID, dates, description, debit/credit, amount, balance, match state |

Semua mutasi posted menunjuk accounting_event, journal entry dan source document. Outstanding/alokasi diturunkan dari open item dan settlement, bukan field status lunas yang dapat diubah bebas.

## 15. API konseptual

- `/cash-bank-accounts`: create/read/update-safe/activate/deactivate dan balance sesuai izin.
- `/receipts`: create, submit/verify, post, reverse, allocate/reallocate.
- `/payments`: create, submit, approve/reject/revise, mark-executed/failed, post, reverse.
- `/internal-transfers`: create, approve, confirm-out, confirm-in, post/reverse.
- `/petty-cash-vouchers` dan `/cash-counts`: create, review, approve, post/resolve.
- `/bank-statement-imports`: upload, validate, preview, commit staging; tidak otomatis posting.
- `/unidentified-receipts`: identify, convert-to-advance, allocate atau refund sesuai izin.

Mutasi keuangan memerlukan idempotency key dan document version. Backend mengunci kas/rekening, open item dan period terkait; validasi ulang nominal/outstanding dilakukan saat posting. Respons terputus tidak boleh mendorong pengguna membuat transaksi baru sebelum status request lama diperiksa.

## 16. Kriteria penerimaan

Poin Kas & Bank dianggap siap implementasi apabila:

1. Setiap kas/rekening tertaut akun GL detail yang valid dan tidak memiliki saldo edit manual.
2. Nomor rekening lengkap serta saldo terlindungi oleh izin.
3. Tombol Terima Pembayaran membuat draft dengan invoice/outstanding benar dan posting tidak dapat menggandakan penerimaan.
4. Pembayaran sebagian, beberapa invoice/tagihan, uang muka, overpayment dan withholding menghasilkan alokasi yang dapat ditelusuri.
5. Dana tak dikenal tidak dipaksakan ke pelanggan/invoice dan tetap cocok dengan saldo bank.
6. Approval, eksekusi dan posting pembayaran terpisah; approval saja tidak mengurangi saldo/utang.
7. Perubahan rekening tujuan, penerima atau nominal setelah approval memerlukan evaluasi ulang.
8. Pembayaran gabungan tidak menandai instruksi gagal sebagai berhasil.
9. Transfer internal tidak membentuk pendapatan/beban dan tidak dicatat dua kali.
10. Kas kecil memiliki bukti, kategori, pemegang kas, limit dan cash count yang dapat diaudit.
11. Transaksi posted tidak dapat diedit/dihapus; reversal membalik jurnal dan settlement terkait.
12. Impor mutasi menolak duplikasi dan tidak otomatis membuat jurnal.
13. Saldo buku dapat ditelusuri ke jurnal dan transaksi sumber pada tanggal acuan.
14. Periode tertutup, saldo/limit tidak memadai bila menjadi blocker, mapping hilang atau dokumen berubah menahan posting tanpa perubahan parsial.
15. Semua pembuatan, approval, eksekusi, posting, reversal, impor dan perubahan master tercatat dalam audit.

## 17. Parameter saat konfigurasi perusahaan

Spesifikasi poin 3 selesai. Data berikut diisi saat penyiapan:

- daftar kas dan rekening bank aktual;
- pengguna/peran yang melihat saldo, menyetujui, mengeksekusi dan mem-posting;
- limit approval dan kebijakan self-approval;
- metode pembayaran yang digunakan;
- pilihan imprest atau fluktuatif untuk setiap kas kecil serta limitnya;
- pola nomor BM, BK, TRF dan KKV;
- format file mutasi dari masing-masing bank;
- apakah saldo minimum hanya peringatan atau blocker;
- akun clearing transfer bila diperlukan.

Data tersebut merupakan konfigurasi operasional dan tidak mengubah alur inti di atas.


---

## Bagian asal: 12-finance-administration.md

# Kartu Piutang dan Kartu Utang

Status: spesifikasi bisnis poin Finance nomor 4 selesai. Poin 5 mengenai uang muka pelanggan, supplier dan vendor diselesaikan di dalam dokumen ini karena uang muka adalah saldo terbuka yang harus dapat ditelusuri dan dialokasikan.

Kartu memakai jurnal dan open item dari [Jurnal Otomatis](12-finance-administration.md), sedangkan kas/pembayaran mengikuti [Kas, Bank, Penerimaan, dan Pengeluaran](12-finance-administration.md).

## 1. Prinsip dasar

1. Kartu piutang dan utang bukan saldo yang diedit manual; saldo berasal dari invoice/tagihan posted, credit/debit note, pembayaran, uang muka, settlement dan reversal.
2. Proforma, SO, PO, estimasi, janji bayar dan rencana pembayaran tidak mengubah saldo piutang/utang.
3. Piutang Belum Ditagih adalah akun terpisah dari Piutang Usaha. Ia muncul setelah POD tetapi sebelum invoice resmi diposting.
4. GRNI adalah akun terpisah dari Utang Supplier/Vendor. Ia muncul saat barang milik perusahaan diterima sebelum invoice supplier/vendor diposting.
5. Supplier dan Vendor memiliki master, kartu utang, nomor dan saldo terpisah walaupun badan usahanya mungkin sama.
6. Satu dokumen dapat memiliki beberapa pembayaran; satu pembayaran dapat dialokasikan ke beberapa open item yang sesuai.
7. Satu pengguna dapat melihat kartu sesuai cakupan; nilai modal, HPP, rekening dan data sensitif tetap mengikuti izin terpisah.
8. Periode dan tanggal acuan selalu ditampilkan. Laporan “saat ini” tidak boleh dipakai seolah-olah menggambarkan saldo pada tanggal lampau.

## 2. Jenis saldo terbuka

| Jenis | Pihak | Akun utama | Terbentuk dari | Jatuh tempo |
|---|---|---|---|---|
| Piutang Usaha | Pelanggan | 112001 | Invoice penjualan posted | POD + TOP pelanggan |
| Piutang Belum Ditagih | Pelanggan | 112002 | POD diterima sebelum invoice posted | Mengikuti tanggal jatuh tempo yang dihitung dari POD + TOP; bukan invoice kedua |
| Uang Muka Pelanggan | Pelanggan | 214001 | Pembayaran sebelum invoice/kelebihan bayar | Tidak aging sebagai piutang; menunggu alokasi/refund |
| Utang Supplier | Supplier | 211001 | Invoice supplier posted dan cocok/ditangani exception | Basis TOP yang tersimpan pada PO/invoice |
| Utang Vendor | Vendor | 211002 | Invoice vendor posted setelah penerimaan barang/jasa | Basis TOP yang tersimpan pada PO/kontrak |
| GRNI | Supplier/Vendor | 211003 | Penerimaan milik perusahaan sebelum invoice | Bukan invoice jatuh tempo; daftar tindak lanjut penerimaan tanpa tagihan |
| Uang Muka Supplier/Vendor | Supplier/Vendor | 114001/114002 | Pembayaran sebelum penerimaan/tagihan | Tidak aging sebagai utang; menunggu penerapan/refund |
| Refund/credit pelanggan | Pelanggan | 214005 atau 214001 | Credit note melebihi piutang atau refund disetujui | Mengikuti jadwal refund, bukan jatuh tempo invoice |

Nilai `outstanding` pada open item dibangun dari nilai asal dikurangi settlement posted dan koreksi posted yang sah. Cache boleh dipakai untuk kinerja tetapi harus dapat dibangun ulang.

## 3. Kartu Piutang Pelanggan

### Tampilan ringkasan

Filter wajib: pelanggan, channel, rayon, sales/collector, periode/tanggal acuan, status, umur piutang, invoice, dan cakupan pengguna.

Kartu menampilkan:

- saldo awal pada tanggal sebelum periode;
- invoice posted dan piutang belum ditagih secara terpisah;
- debit penjualan/nota debit;
- kredit pembayaran, credit note, potongan sah dan reversal;
- saldo berjalan setiap mutasi;
- saldo akhir dan total outstanding;
- invoice belum jatuh tempo, jatuh tempo, terlambat dan sengketa;
- umur piutang dan tanggal jatuh tempo;
- uang muka/unallocated terpisah;
- follow-up, janji bayar, collector dan hasil penagihan;
- tautan ke SO, POD, invoice, credit note, pembayaran dan bukti.

Tampilan default ringkas tetap menyediakan drill-down ke baris sumber. Saldo berjalan dihitung berdasarkan urutan tanggal posting dan urutan nomor/event pada tanggal yang sama; laporan menyimpan waktu pembuatan serta filter yang digunakan.

### Pengakuan dan jatuh tempo

Invoice hanya masuk kartu piutang setelah status **Posted**. Jatuh tempo disimpan pada invoice sebagai snapshot:

`tanggal POD aktual + TOP pelanggan`

Untuk pelanggan baru, mode pembayaran default adalah **COD saat barang diterima** selama tiga bulan berturut-turut atau **Bayar sebelum pengiriman** bila Finance menetapkan mode yang lebih ketat. COD berarti TOP 0 hari, sehingga jatuh tempo sama dengan tanggal POD. Fasilitas Tempo baru dapat ditetapkan setelah evaluasi Finance dan tidak muncul otomatis setelah pelanggan dibuat.

Jika invoice fisik dibawa saat pengiriman dengan status Menunggu POD, invoice belum masuk Piutang Usaha. Setelah POD diposting dan invoice resmi diposting, saldo masuk kartu dengan jatuh tempo yang sudah dihitung dari POD. Perubahan TOP pelanggan tidak mengubah invoice historis.

### Aging

Bucket awal:

- Belum jatuh tempo;
- 1–30 hari;
- 31–60 hari;
- 61–90 hari;
- lebih dari 90 hari.

Bucket dapat diubah melalui Setting → Kebijakan Operasional (OPS-FIN-08). Simpan langsung membuat versi otomatis; tanggal berlaku bersifat opsional. Past due berarti tanggal acuan melewati jatuh tempo dan outstanding masih positif. Invoice sengketa tetap terlihat di bucket aslinya dengan penanda sengketa; sistem tidak menyembunyikannya dari total tanpa kebijakan tertulis.

## 4. Kartu Utang Supplier dan Vendor

Kartu utang memakai layar dan logika serupa, tetapi sumber dokumennya berbeda:

### Supplier

Menampilkan invoice supplier, PO, GR, hasil three-way match, exception harga/qty/pajak, nomor invoice asli, tanggal invoice, tanggal diterima, TOP snapshot, jatuh tempo, pembayaran, potongan pajak, credit/debit note dan saldo.

### Vendor

Menampilkan invoice vendor, PO Vendor, penerimaan barang/aset atau service acceptance, kategori beban/prepaid/aset, bukti pekerjaan, TOP pada PO/kontrak, pajak, pembayaran dan saldo. Tagihan Vendor tidak memakai MOU/pricelist Supplier secara otomatis.

### GRNI dan tagihan belum diterima

Layar **Barang Diterima Belum Ditagih** menampilkan supplier/vendor, PO, GR/service acceptance, umur penerimaan, nilai estimasi, jumlah yang sudah ditagih dan sisa. GRNI tidak tampil sebagai invoice jatuh tempo dan tidak boleh dibayar langsung; petugas harus mencatat/mencocokkan invoice atau menyelesaikan selisih terlebih dahulu.

## 5. Status dokumen dan open item

### Invoice penjualan

**Draft → Posted → Partially Paid → Paid**, dengan **Credited/Voided** hanya melalui dokumen koreksi yang sah. `Paid` berarti outstanding nol melalui pembayaran/settlement posted, bukan karena credit note atau janji bayar saja; credit note ditampilkan sebagai komponen terpisah.

### Invoice supplier/vendor

**Draft → Matched/Exception → Posted → Partially Paid → Paid**, dengan **Credited/Voided** melalui koreksi yang tertaut. Exception dapat menahan posting atau diposting dengan keputusan berizin sesuai kebijakan toleransi.

### Open item

Open item memiliki jenis, pihak, dokumen sumber, tanggal asal, due date, original amount, settled amount, outstanding, currency, status dan versi. Status agregat seperti Lunas tidak menjadi sumber tunggal; sistem menghitungnya dari saldo.

## 6. Pembayaran dan settlement

### Alokasi piutang

Pada penerimaan:

1. Sistem mengambil invoice pelanggan dan outstanding terbaru dari server.
2. Pengguna memilih satu atau beberapa invoice yang sesuai.
3. Sistem memvalidasi pihak, mata uang, nominal, bukti dan tanggal.
4. Sisa pembayaran menjadi uang muka atau dana belum teridentifikasi sesuai pilihan eksplisit.
5. Posting membuat settlement dan jurnal dalam satu transaksi.

Alokasi otomatis “invoice tertua dahulu” hanya berupa usulan yang dapat ditinjau. Jika ada beberapa cabang/invoice atau referensi pelanggan tidak jelas, pengguna harus memilih secara eksplisit.

### Alokasi utang

Pada pembayaran supplier/vendor:

1. Sistem mengambil tagihan posted dan sisa uang muka pihak tersebut.
2. Pengguna memilih tagihan/uang muka dan nominal yang dibayar.
3. Sistem memeriksa approval, rekening tujuan snapshot, withholding, outstanding dan periode.
4. Posting mengurangi AP/advance sesuai alokasi.

Pembayaran yang sudah dieksekusi tetapi belum memiliki bukti cukup dapat berstatus pending/posting tertahan sesuai kebijakan; jangan menurunkan saldo hanya karena file pembayaran dibuat.

Pada penerimaan pelanggan WAPU, penyelesaian AR memisahkan **PPN Dipungut WAPU** dan **PPh Dipotong** menjadi dua komponen pajak. Kartu piutang menampilkan uang masuk dan kedua komponen secara terpisah pada mutasi, sementara saldo invoice berkurang sebesar total komponen yang telah memenuhi policy verifikasi. Komponen pajak tidak ditampilkan sebagai diskon atau retur.

## 7. Uang muka dan saldo kredit

### Uang muka pelanggan

Uang masuk tanpa invoice atau kelebihan pembayaran dicatat pada pelanggan sebagai Uang Muka Pelanggan. Pengguna berizin dapat:

- mengalokasikan sebagian/seluruhnya ke invoice pelanggan;
- mempertahankan sebagai saldo untuk pesanan berikutnya;
- mengembalikan dana melalui refund yang disetujui;
- memindahkan dana yang salah identifikasi ke pelanggan yang benar dengan audit.

Uang muka tidak menjadi omzet, penjualan, NOO atau pelunasan invoice sampai dialokasikan secara sah.

### Uang muka Supplier/Vendor

Pembayaran sebelum barang/jasa atau invoice dicatat sebagai Uang Muka Supplier/Vendor. Setelah tagihan posted, uang muka dapat dialokasikan ke tagihan. Sisa dapat direfund, dipakai pada PO berikutnya atau tetap outstanding sesuai kontrak.

### Uang muka karyawan

Uang muka karyawan terkait perjalanan/kegiatan dicatat terpisah. Penyelesaian memerlukan bukti biaya, pengembalian sisa atau klaim tambahan. Uang muka tidak menjadi beban sampai settlement disetujui.

## 8. Nota kredit, potongan dan pemotongan tagihan

Pengguna meminta agar sistem menyediakan pilihan pemotongan tagihan yang dapat diatur di Setting. Pilihan awal:

| Jenis pengurang | Perlakuan |
|---|---|
| Pembayaran kas/bank | Settlement pembayaran dan jurnal bank |
| Uang muka pelanggan | Settlement dari akun uang muka |
| Credit note/nota retur | Mengurangi piutang melalui dokumen credit note |
| Potongan pembayaran yang disetujui | Akun potongan dan approval; bukan mengubah invoice asli |
| Withholding/pajak dipotong | Komponen pembayaran dengan bukti pajak |
| Klaim/kekurangan/chargeback pelanggan | Ditahan sebagai sengketa/open deduction sampai disetujui; tidak otomatis mengurangi piutang |
| Offset pelanggan dan supplier | Hanya bila pihak legal, dasar dokumen dan approval memenuhi aturan; membuat dua settlement tertaut |
| Refund | Pembayaran keluar atas credit balance yang disetujui |
| Write-off | Opsi terbatas dengan alasan, batas nominal, approval dan akun kerugian |

Pemotongan tagihan tidak boleh dilakukan dengan mengubah nilai invoice posted. Sistem menyimpan nilai asal, nilai pengurang, alasan, bukti, approver dan saldo setelah koreksi. Daftar jenis, akun, batas dan kebutuhan bukti dikonfigurasi pada Setting.

## 9. Follow-up piutang dan penagihan

Dari kartu piutang, pengguna berizin dapat membuat follow-up:

- pelanggan dan invoice sasaran;
- collector/PIC;
- tanggal dan kanal komunikasi;
- hasil pembicaraan;
- janji bayar dan tanggal janji;
- nominal yang dijanjikan;
- sengketa/kendala;
- tugas berikutnya dan pengingat;
- lampiran/bukti.

Janji bayar tidak mengubah due date, outstanding, status lunas atau aktual penerimaan. Pembayaran yang masuk kemudian ditautkan ke follow-up untuk mengukur realisasi. Follow-up tetap ada walaupun periode target atau pipeline sudah ditutup.

## 10. Penagihan, hold dan kredit

Dashboard finance menampilkan:

- total AR/AP outstanding;
- past due dan aging per bucket;
- invoice terbesar/terlama;
- janji bayar jatuh tempo;
- pelanggan dengan limit terlampaui;
- GRNI lama dan tagihan supplier/vendor yang belum diterima;
- uang muka yang belum dialokasikan;
- pembayaran/reversal/exception yang menunggu tindakan.

Pelanggan dengan invoice outstanding **30 hari setelah jatuh tempo (H+30)** dapat dibekukan sesuai aturan kredit. Exposure kredit mengikuti [Kebijakan Kredit dan Exposure](10-sales-marketing.md): AR, unbilled POD, transit, stok teralokasi, dikurangi uang muka tertaut, tanpa hitung ganda. H-7, hari H, H+3, H+7 dan H+14 menjadi pengingat/follow-up. Kartu piutang menjadi sumber penjelasan; pengguna dapat mengajukan unlock sesuai workflow, bukan mengedit saldo atau status invoice. Past due sebelum H+30 tetap terlihat, memicu follow-up dan dapat menjadi dasar keputusan Finance sesuai policy, tetapi freeze default tidak terjadi sebelum H+30.

## 11. Saldo awal dan migrasi

Saldo awal piutang/utang tidak diisi sebagai angka ringkas pada master pelanggan/supplier/vendor. Proses opening menerima rincian per invoice/tagihan:

- pihak dan tipe kartu;
- nomor invoice/tagihan asli;
- tanggal invoice dan tanggal POD/penerimaan bila tersedia;
- tanggal jatuh tempo;
- nilai awal dan saldo belum dibayar;
- mata uang;
- dokumen/bukti;
- status verifikasi dan alasan data belum lengkap.

Saldo opening dipreview, direkonsiliasi ke akun kontrol, disetujui, lalu diposting satu kali. Impor ulang dengan source key yang sama tidak menggandakan open item. Data yang belum diketahui ditandai **Belum Diverifikasi**, bukan otomatis nol.

## 12. Laporan

Laporan P1:

- Kartu Piutang per pelanggan;
- Kartu Utang per Supplier dan Vendor;
- Aging AR/AP;
- daftar invoice jatuh tempo/terlambat;
- penerimaan dan pembayaran per periode;
- uang muka belum dialokasikan;
- GRNI dan unbilled;
- daftar sengketa/potongan tagihan;
- rekonsiliasi subledger ke GL.

Filter minimal: tanggal acuan, periode, pihak, channel/rayon, sales/collector, supplier/vendor, status, bucket umur, rekening, departemen dan mata uang. Setiap total memiliki tautan ke rincian sumber. Ekspor mengikuti hak akses dan menyimpan parameter laporan.

## 13. Hak akses

Permission minimum:

- `receivable.read`
- `receivable.card.read`
- `receivable.followup.create`
- `receivable.adjust.request`
- `receivable.writeoff.approve`
- `payable.read`
- `payable.card.read`
- `payable.exception.resolve`
- `advance.allocate`
- `credit_note.create`
- `credit_note.post`
- `settlement.create`
- `settlement.reverse`
- `subledger.reconcile`
- `opening.ar_ap.import`
- `opening.ar_ap.approve`
- `opening.ar_ap.post`

Hak melihat kartu tidak otomatis memberi hak menerima pembayaran, posting credit note, write-off, offset atau mengubah jatuh tempo. Akses pelanggan, supplier dan vendor dapat dibatasi oleh perusahaan, rayon, sales atau departemen.

## 14. Database konseptual

| Entitas | Isi utama |
|---|---|
| receivable_payable_documents | jenis AR/AP supplier/vendor, pihak, nomor eksternal/internal, tanggal, due date snapshot, nilai, currency, source document, state, dispute flag |
| open_items | jenis, control account, pihak, sumber, original amount, due date, outstanding derived, currency, state |
| settlements / settlement_allocations | tanggal, arah, payment/credit/debit note/advance, debit/credit open item, amount, source event, reversal |
| advances | pihak, jenis customer/supplier/vendor/employee, source receipt/payment, original amount, unallocated, due/expiry bila ada, state |
| credit_debit_notes | pihak, invoice asal, jenis/alasan, line/amount/tax, approval, posting state |
| ar_ap_disputes | pihak, source open item, claimed/deducted amount, reason, evidence, owner, state, resolution |
| collection_followups | customer/invoice, collector, event date, result, promise amount/date, next action, reminder, evidence |
| ar_ap_opening_batches/items | cutover, source key, party, invoice detail, amount/due/status, validation/reconciliation, approval/post event |

`outstanding` dapat dibuat ulang dari journal dan settlement. Perubahan saldo tidak boleh dilakukan langsung pada tabel kartu.

## 15. API konseptual

- `/receivables/cards` dan `/payables/cards`: filter kartu, aging, detail dan export job.
- `/open-items`: list/detail dengan scope; server menghitung outstanding.
- `/receivable-payable-documents`: detail invoice/tagihan posted dan status.
- `/settlements` dan `/settlement-allocations`: create, preview, post, reverse, reallocate.
- `/advances`: list, identify, allocate, refund-request, reverse.
- `/credit-notes`/`/debit-notes`: create, submit, approve/post, reverse.
- `/ar-ap-disputes`: create, resolve, approve deduction/write-off.
- `/collection-followups`: create, reschedule, complete, link payment.
- `/opening-batches/ar-ap`: validate, preview, approve, post; source key/idempotency wajib.

Semua mutasi mengunci open item dan memvalidasi ulang outstanding, pihak, currency, period dan versi dokumen. API tidak menerima nominal saldo baru sebagai pengganti settlement. Reversal selalu menunjuk event asal.

## 16. Kriteria penerimaan

Poin Kartu Piutang dan Kartu Utang dianggap siap implementasi apabila:

1. Proforma/SO/PO tidak muncul sebagai saldo AR/AP.
2. POD sebelum invoice tampil sebagai Piutang Belum Ditagih, bukan Piutang Usaha.
3. GR tanpa invoice tampil sebagai GRNI, bukan tagihan Supplier/Vendor yang dapat dibayar.
4. Kartu piutang dapat menampilkan saldo awal, semua mutasi, saldo berjalan dan saldo akhir dengan tautan sumber.
5. Kartu Supplier dan Vendor terpisah, termasuk saldo, pembayaran, aging dan laporan.
6. Jatuh tempo invoice pelanggan memakai POD + TOP snapshot dan tidak berubah karena master TOP diedit.
7. TOP supplier/vendor memakai basis snapshot PO/kontrak dan tidak otomatis menggunakan POD pelanggan.
8. Pembayaran parsial, beberapa invoice, credit note dan reversal menghitung outstanding dengan benar.
9. Uang muka tidak menjadi omzet atau pelunasan sebelum dialokasi; sisa overpayment tetap terlihat.
10. Potongan/klaim pelanggan tidak mengurangi saldo tanpa jenis, bukti dan approval yang sesuai.
11. Offset AR/AP hanya tersedia untuk pihak/dokumen yang memenuhi aturan dan menghasilkan settlement tertaut.
12. Follow-up/janji bayar tidak mengubah saldo, due date atau status lunas.
13. Aging memakai tanggal acuan dan bucket bertanggal efektif; invoice sengketa tidak tersembunyi dari total.
14. Saldo opening berasal dari rincian invoice/tagihan dan tidak dapat diimpor dua kali.
15. Total subledger AR/AP/advance/GRNI dapat direkonsiliasi dengan akun GL.
16. Pengguna tanpa izin tidak melihat nilai, rekening, HPP atau pihak di luar scope.
17. Reversal dan write-off tidak menghapus histori serta memerlukan alasan/bukti/approval sesuai aturan.

## 17. Parameter konfigurasi

Spesifikasi poin 4 dan uang muka poin 5 selesai. Parameter yang diisi saat konfigurasi:

- perubahan bucket aging dan tanggal efektif bila perusahaan memerlukan versi baru;
- TOP pelanggan, Supplier dan Vendor; due basis AP default adalah tanggal invoice lengkap diterima dan diverifikasi, dengan override eksplisit pada PO/MOU;
- prioritas usulan alokasi pembayaran;
- pilihan pengurang tagihan, akun, batas, bukti dan approval;
- kebijakan offset/write-off/refund;
- penanggung jawab collection dan cakupan data;
- format opening AR/AP dan tanggal cut-over;
- reviewer exception PO–GR–invoice; tolerance bisnis default 0 dan pembulatan sistem maksimal Rp1 per invoice.

Parameter tersebut tidak mengubah pemisahan AR, unbilled, AP, GRNI dan uang muka.


---

## Bagian asal: 12-finance-administration.md

# Biaya Operasional dan Reimbursement

Status: spesifikasi bisnis poin Finance nomor 6 selesai. Rancangan ini mencakup permintaan kebutuhan internal, pengeluaran barang operasional, tagihan Vendor, pembayaran langsung, reimbursement karyawan, uang muka karyawan dan klasifikasi biaya/prepaid/aset.

Aturan perjalanan dinas, cash advance dan siklus pembayaran klaim dirinci pada [Perjalanan Dinas](13-hris.md). Klaim perjalanan memakai bukti, batas plafon, settlement maksimal lima hari setelah kegiatan dan cut-off pembayaran tanggal 10/25. Advance/reimbursement yang masih terbuka saat resign mengikuti [Resign, Offboarding, Final Pay dan Pengembalian Aset](13-hris.md) dan tidak dihapus ketika karyawan dinonaktifkan.

Pengadaan barang operasional tetap berada di **Warehouse & Logistik → Pengadaan**. Finance mencatat klasifikasi, tagihan, kewajiban, pembayaran dan jurnal. HR saat ini menjadi pengelola barang operasional sesuai keputusan pengguna.

## 1. Prinsip dasar

1. Permintaan barang atau biaya tidak otomatis menjadi beban, utang, aset atau pembayaran.
2. Setiap biaya memiliki pemohon, tujuan bisnis, tanggal kejadian, kategori, dimensi, bukti dan sumber dana/pihak.
3. Barang operasional yang sudah tersedia dikeluarkan dari stok operasional; pembelian baru hanya dilakukan bila ketersediaan tidak mencukupi.
4. Barang yang memenuhi kriteria kapitalisasi masuk register aset; nama barang saja tidak menentukan perlakuannya.
5. Manfaat lebih dari satu periode dapat dicatat sebagai prepaid dan diamortisasi sesuai jadwal.
6. Reimbursement yang disetujui membentuk kewajiban kepada karyawan; pembayaran terpisah dari pengakuan biaya.
7. Uang muka karyawan harus diselesaikan dengan bukti biaya atau pengembalian sisa; uang muka bukan beban.
8. Bukti yang tidak lengkap dapat disimpan sebagai draft/exception, tetapi tidak dapat dianggap selesai untuk closing tanpa penyelesaian berizin.
9. Kategori, akun default, pajak, batas bukti, dimensi wajib dan approval dapat diatur di Setting dengan tanggal efektif.

## 2. Jenis transaksi

| Jenis | Contoh | Sumber utama | Hasil finance |
|---|---|---|---|
| Permintaan operasional | ATK, air minum, perlengkapan kantor | Permintaan staf | Antrean stok atau PR Vendor; belum ada jurnal |
| Pengeluaran stok operasional | ATK dari gudang | Pengeluaran gudang | Beban operasional dan pengurangan stok |
| Pembelian melalui Vendor | Jasa internet, sewa, perlengkapan | PO Vendor + penerimaan/tagihan | AP Vendor atau aset/prepaid |
| Pembayaran biaya langsung | Biaya bank/biaya kecil yang sah | Bukti kas/bank | Beban/aset/prepaid dan kas/bank |
| Reimbursement | Sales membayar parkir/perjalanan | Klaim karyawan | Beban dan reimbursement payable |
| Uang muka karyawan | Uang muka kunjungan/perjalanan | Payment/advance | Piutang/advance karyawan |
| Penyelesaian uang muka | Bukti biaya + pengembalian sisa | Expense settlement | Beban, pengurangan advance, selisih payable/receivable |
| Aset perusahaan | Laptop, rak, kendaraan | PO Vendor + penerimaan | Register aset dan utang/vendor |

## 3. Master kategori biaya

Menu **Finance → Biaya Operasional → Kategori Biaya** menyediakan:

| Field | Aturan |
|---|---|
| Kode/nama kategori | Unik, jelas dan dapat dinonaktifkan tanpa menghapus histori |
| Jenis | Beban, prepaid, aset, persediaan operasional, pajak, atau kategori khusus |
| Akun default | Akun biaya/aset/prepaid/persediaan dan akun lawan yang sesuai CoA |
| Tax profile | PPN masukan/withholding bila relevan; tidak ada tarif hard-code |
| Evidence policy | Wajib, opsional dengan alasan, atau tidak berlaku |
| Capitalization policy | Tidak, review finance, atau otomatis usulan; nilai dan masa manfaat tetap direview |
| Dimensi wajib | Departemen, pemohon, sales, customer, rayon, project atau asset class sesuai kebutuhan |
| Allow direct expense | Apakah boleh dibayar langsung tanpa PO/Tagihan Vendor |
| Allow employee claim | Apakah boleh diajukan sebagai reimbursement |
| Batas nominal | Batas per transaksi/periode dan approval terkait |
| Status/tanggal berlaku | Draft, aktif, nonaktif; effective from/to |

Kategori awal yang disediakan: ATK, perjalanan/kunjungan, parkir/tol, komunikasi, utilitas, sewa, jasa profesional, pemeliharaan, promosi/sampel, bank, konsumsi kegiatan, rekrutmen/pelatihan, pajak/izin, perlengkapan gudang, aset TI, aset kantor dan kategori lainnya. Pengguna dapat menambah kategori.

## 4. Permintaan kebutuhan internal

Alur:

**Permintaan staf → Review HR/pengelola barang → Cek stok/ketersediaan → Pengeluaran stok atau PR → Approval → PO Vendor → Penerimaan → Tagihan → Pembayaran**

Form permintaan:

- pemohon, departemen/lokasi dan tanggal kebutuhan;
- jenis: persediaan operasional, aset, biaya langsung atau jasa;
- master item atau spesifikasi/deskripsi bila item belum ada;
- qty, satuan, estimasi harga dan anggaran bila tersedia;
- tujuan/penggunaan dan urgensi;
- vendor yang disarankan bila relevan, tanpa mengikat penerbitan PO;
- lampiran dan catatan.

Jika stok operasional tersedia, HR/pengelola dapat menerbitkan pengeluaran stok. Jika tidak tersedia, permintaan diteruskan menjadi PR tanpa membuat permintaan kedua. Persetujuan kebutuhan dan persetujuan PO/pembayaran tetap mengikuti policy yang berbeda.

## 5. Pengeluaran stok operasional

Barang operasional yang disimpan memiliki master item, satuan, lokasi dan saldo. Pengeluaran mencatat:

- item, qty dan satuan konversi;
- locator dan lot/serial bila diwajibkan;
- penerima/departemen/lokasi;
- tujuan penggunaan;
- permintaan sumber;
- pemohon, pemeriksa, pemberi barang dan waktu;
- bukti serah terima.

Jurnal saat pengeluaran posted:

`Debit akun beban kategori / Kredit Persediaan Operasional`

Karena template CoA sebelumnya berfokus pada barang dagang, akun **Persediaan Operasional/ATK** ditambahkan sebagai akun kontrol tersendiri dalam konfigurasi CoA. Persediaan operasional tidak dicampur dengan persediaan alat kesehatan untuk penjualan.

Pengeluaran ke karyawan/departemen tidak menjadi reimbursement atau biaya baru ketika barang telah dikeluarkan. Jika barang diserahkan sebagai aset, gunakan serah terima aset dan bukan pengeluaran persediaan biasa.

## 6. Reimbursement karyawan

### Form klaim

| Kelompok | Field |
|---|---|
| Pemohon | Karyawan, departemen, jabatan/cakupan dan rekening pembayaran bila diperlukan |
| Kejadian | Tanggal biaya, lokasi, tujuan bisnis, customer/kunjungan/proyek terkait |
| Rincian | Kategori, deskripsi, vendor, qty, nominal, mata uang, pajak/biaya |
| Dana | Dibayar pribadi, terkait uang muka, atau kas kecil; advance reference |
| Bukti | Struk/invoice, foto, bukti pembayaran, daftar perjalanan, peserta kegiatan bila diperlukan |
| Akuntansi | Akun default, dimensi, tax profile dan nominal yang dapat diganti |
| Kontrol | Status, reviewer, approver, catatan revisi, payment reference |

Satu klaim dapat memiliki banyak baris biaya dan banyak bukti. Sistem menolak tanggal/nominal yang tidak valid, klaim duplikat berdasarkan kunci bukti yang sama, atau biaya yang melampaui batas policy tanpa exception.

### Status

**Draft → Diajukan → Review → Menunggu Persetujuan → Disetujui → Diposting/Utang Terbentuk → Dibayar → Selesai**.

Status lain: **Perlu Revisi, Ditolak, Dibatalkan, Exception**. Persetujuan tidak berarti karyawan sudah dibayar. Setelah disetujui, finance dapat mem-posting beban dan reimbursement payable; pembayaran dilakukan melalui modul Kas & Bank.

### Jurnal reimbursement

Saat klaim disetujui dan diposting:

`Debit akun beban/aset/prepaid terkait; Kredit 213004 Reimbursement Terutang`

Saat dibayar:

`Debit 213004 Reimbursement Terutang; Kredit Kas/Bank`

Jika klaim dibayar langsung dari kas kecil tanpa membentuk kewajiban terpisah:

`Debit akun beban/aset/prepaid terkait; Kredit Kas Kecil`

Perusahaan tidak boleh membentuk beban kedua saat membayar reimbursement yang sudah diposting.

## 7. Uang muka karyawan dan penyelesaian

Saat uang muka dibayar:

`Debit Uang Muka Karyawan; Kredit Kas/Bank`

Karyawan mengajukan settlement dengan rincian biaya dan bukti. Hasilnya:

| Hasil | Perlakuan |
|---|---|
| Biaya sama dengan advance | Debit beban/aset/prepaid; Kredit Uang Muka Karyawan |
| Biaya lebih kecil | Debit beban; Kredit Uang Muka; sisa dikembalikan karyawan ke Kas/Bank |
| Biaya lebih besar | Debit beban; Kredit Uang Muka sebesar saldo; selisih menjadi Reimbursement Terutang setelah disetujui |
| Tidak ada bukti/aktivitas | Advance tetap outstanding dan masuk daftar tindak lanjut |
| Sisa tidak dapat dikembalikan | Write-off/benefit sesuai policy payroll/pajak, dengan approval khusus; tidak otomatis dihapus |

Uang muka yang lama atau melewati tanggal settlement menimbulkan pengingat/escalation. Saldo advance tidak dimasukkan aging piutang pelanggan.

## 8. Tagihan Vendor dan pembayaran langsung

Vendor invoice mengikuti alur:

**PO Vendor/penerimaan → Catat Invoice → Match/Exception → Posting AP Vendor → Approval Pembayaran → Bayar → Settlement**

Biaya langsung tanpa PO hanya dapat digunakan untuk kategori yang mengizinkannya dan nominal dalam batas policy. Form wajib memuat vendor, tanggal, nomor invoice, nilai, pajak, akun/kategori, bukti dan alasan tidak memakai PO. Pengguna tidak dapat memilih biaya langsung untuk kategori yang diwajibkan melalui PO.

Jurnal standar:

`Debit beban/prepaid/aset; Debit PPN Masukan bila eligible; Kredit 211002 Utang Vendor`

Pembayaran dan withholding mengikuti dokumen Kas & Bank. Tagihan Vendor tidak boleh sekaligus dibuat sebagai reimbursement untuk orang yang sama.

## 9. Aset dan prepaid

Klasifikasi awal hanya merupakan usulan dari kategori. Finance melakukan review berdasarkan nilai kapitalisasi, masa manfaat, kepemilikan, lokasi dan kebijakan perusahaan.

- Aset: masuk register aset, diberi nomor aset, lokasi, pengguna/penanggung jawab, tanggal siap digunakan dan jadwal penyusutan.
- Prepaid: memiliki periode manfaat, jadwal amortisasi, saldo tersisa dan akun beban tujuan.
- Beban langsung: diakui pada saat penerimaan/penggunaan yang ditetapkan profile.

Pembelian aset belum otomatis berarti aset siap disusutkan. Penyusutan dimulai dari tanggal in service sesuai kebijakan yang dikonfigurasi. Register, assignment, penyusutan, maintenance, impairment dan disposal mengikuti [Aset Tetap dan Penyusutan](12-finance-administration.md).

## 10. Approval dan kontrol

Approval dapat didasarkan pada:

- kategori biaya;
- nominal per transaksi/periode;
- departemen/lokasi;
- pemohon atau hubungan atasan;
- sumber dana/kas kecil;
- apakah memakai advance, direct expense, aset atau vendor;
- perubahan rekening pembayaran;
- exception bukti/pajak/budget.

Self-approval reimbursement direkomendasikan nonaktif. Atasan/pemberi persetujuan tidak harus menjadi pemilik akun, tetapi harus memiliki scope dan hak yang valid. Revisi nominal, kategori, vendor, rekening tujuan, tanggal atau bukti material mengulang review/approval.

## 11. Laporan

Laporan awal:

- biaya per kategori, departemen, employee, vendor, sales, rayon dan periode;
- reimbursement diajukan/disetujui/belum dibayar;
- aging reimbursement payable;
- uang muka karyawan belum selesai;
- biaya direct expense dan transaksi tanpa PO;
- penggunaan stok operasional per item/departemen/penerima;
- aset dan prepaid yang berasal dari pengadaan operasional;
- biaya yang belum memiliki bukti/exception;
- jurnal biaya dan rekonsiliasi ke GL/AP.

Anggaran dan budget-vs-actual menggunakan modul Budget dan dilaporkan melalui [Laporan Keuangan](12-finance-administration.md). Pada tahap ini sistem dapat menyimpan budget reference dan committed amount; aturan budget check, exception dan Budget vs Actual mengikuti [Anggaran dan Budget vs Actual](12-finance-administration.md). Sistem tidak mengarang nilai anggaran.

## 12. Hak akses

Permission minimum:

- `expense_category.read/manage`
- `internal_request.create/review/approve`
- `operational_stock.issue/confirm`
- `expense_claim.create/read_own/read_scope`
- `expense_claim.review/approve/reject`
- `expense_claim.post`
- `expense_claim.pay`
- `employee_advance.create/settle/approve`
- `vendor_direct_expense.create/approve`
- `asset_classification.review`
- `expense_exception.resolve`

HR dapat mengelola barang operasional sesuai scope yang ditugaskan. Hak tersebut tidak otomatis memberikan hak mengubah CoA, mem-posting jurnal, menyetujui pembayaran atau melihat reimbursement seluruh karyawan.

## 13. Database konseptual

| Entitas | Isi utama |
|---|---|
| expense_categories | kode, nama, kind, default accounts, tax/evidence/capitalization policy, direct/claim allowed, dimension requirements, limits/effective dates |
| internal_requests / internal_request_lines | requester, department, need date, kind, item/spec, qty, source stock/PR, state, approval |
| operational_issues / operational_issue_lines | item, locator, qty, recipient/department, source request, evidence, posted event |
| expense_claims / expense_claim_lines | employee, dates, purpose, category/vendor, amount/tax/account/dimensions, advance, state, evidence |
| expense_claim_reviews | claim, reviewer/approver, decision, reason, version |
| employee_advances / advance_settlements | employee, payment, original/unsettled amount, due/settlement date, state; claim lines, return/payment difference |
| expense_exceptions | source, type, expected/actual, owner, evidence, resolution, approval |
| prepaid_schedules | source, account, start/end, amount, amortized, schedule/state |

Semua transaksi posted menunjuk accounting event, jurnal, party/employee dan dokumen bukti. Klaim tidak boleh mengedit saldo advance langsung.

## 14. API konseptual

- `/expense-categories`: CRUD aman, activate/deactivate, mapping preview.
- `/internal-requests`: create, review-stock, issue-or-create-pr, submit/approve.
- `/operational-issues`: create, confirm, post/reverse.
- `/expense-claims`: create, submit, review, request-revision, approve/reject, post, cancel.
- `/employee-advances`: request, approve, pay, settle, return, write-off-request.
- `/vendor-direct-expenses`: create, match/exception, approve, post.
- `/prepaid-schedules`: create, calculate, post-period, reverse.
- `/expense-exceptions`: list, assign, resolve.

Mutasi memakai version/idempotency key, memeriksa bukti/duplikasi/period/account/dimension dan menulis jurnal serta open item secara atomik. Payment dari claim/advance tetap menggunakan endpoint Kas & Bank agar tidak ada jalur pembayaran kedua.

## 15. Kriteria penerimaan

Poin Biaya Operasional dan Reimbursement dianggap siap implementasi apabila:

1. Permintaan kebutuhan tidak membentuk beban, utang atau pembayaran sebelum transaksi sumber diposting.
2. Barang operasional yang tersedia dikeluarkan dari stok dan tidak membuat PR/PO baru.
3. Kekurangan stok dapat diteruskan menjadi PR tanpa menggandakan permintaan.
4. Kategori biaya memetakan akun, pajak, bukti, dimensi dan approval sesuai tanggal efektif.
5. Reimbursement yang disetujui membentuk reimbursement payable tepat satu kali.
6. Pembayaran reimbursement tidak membentuk beban kedua.
7. Uang muka karyawan tetap outstanding sampai settlement, pengembalian atau keputusan berizin.
8. Settlement dengan biaya lebih kecil/lebih besar menghasilkan pengembalian atau payable secara benar.
9. Direct expense tanpa PO hanya dapat dipakai kategori dan batas yang mengizinkannya.
10. Vendor invoice, reimbursement dan kas kecil tidak dapat membayar sumber biaya yang sama dua kali.
11. Klasifikasi aset/prepaid/beban dapat direview dan menghasilkan register/jadwal yang sesuai.
12. Bukti kurang, duplicate claim, akun/dimensi hilang dan approval tidak valid menahan posting tanpa perubahan parsial.
13. Semua klaim, approval, posting, pembayaran, advance settlement, issue stok dan reversal tertaut bukti/audit.
14. Laporan biaya, reimbursement, advance dan stok operasional dapat direkonsiliasi ke GL.

## 16. Parameter konfigurasi

Spesifikasi poin 6 selesai. Parameter yang diisi saat implementasi:

- daftar kategori dan akun default;
- batas bukti dan batas nominal;
- kebijakan kapitalisasi serta masa manfaat;
- pajak per kategori/vendor;
- pemilik proses HR/pengelola barang operasional;
- approval dan self-approval;
- metode kas kecil;
- batas waktu settlement advance;
- format reimbursement dan dokumen wajib.


---

## Bagian asal: 12-finance-administration.md

# Sinkronisasi Kebijakan PPT dan SOP

Status: diselaraskan dengan keputusan pengguna tanggal 25 September 2026. PPT dan SOP diperlakukan sebagai sumber kebijakan/proses internal. Jika sumber lama menyebut approval manual SO, penempatan PR/PO di Finance, atau pencatatan manual yang bertentangan dengan keputusan pengguna, rancangan ERP mengikuti keputusan pengguna terbaru dan mempertahankan tujuan kontrolnya.

Sumber yang dicocokkan:

- `C:/Users/LENOVO/Downloads/Administrasi Keuangan & Operasional.pptx`, slide 2, 4, 5, 6, 7, 8, 10, 11 dan 12.
- `C:/Users/LENOVO/Downloads/Kerangka Pembuatan SOP (2).xlsx`, Sheet1, Sheet2, Sheet3, Lembar1, Sheet4, Sheet5, Sheet6, Sheet6 (2), Sheet6 (3) dan Sheet6 (4).

## 1. Kebijakan yang menjadi aturan ERP

### Pelanggan dan kredit

1. Pelanggan baru menjalani **COD selama tiga bulan berturut-turut** sebagai kebijakan awal. COD pada ERP berarti pelanggan membayar saat barang diterima. Finance dapat menetapkan pilihan yang lebih ketat, yaitu bayar sebelum pengiriman.
2. Pelanggan baru tidak langsung mendapat fasilitas Tempo. Setelah periode COD selesai, Finance mengevaluasi riwayat pembayaran dan dapat menetapkan TOP serta limit kredit melalui hak berwenang. Penyelesaian tiga bulan tidak otomatis memberi kredit.
3. Sistem mencatat mode pembayaran pada pelanggan dan SO: **COD saat barang diterima** atau **Bayar sebelum pengiriman**. Mode bayar sebelum pengiriman menahan dispatch sampai dana terverifikasi.
4. Invoice COD diposting setelah POD dan jatuh tempo pada tanggal barang diterima karena TOP = 0 hari. Invoice bayar sebelum pengiriman tetap dapat diterbitkan sesuai alur dokumen, tetapi dispatch menunggu dana yang terverifikasi.
5. Pelanggan dengan invoice outstanding **H+30 dari tanggal jatuh tempo** dapat dibekukan. H-7, hari H, H+3, H+7 dan H+14 menjadi pengingat/follow-up; H+30 menjadi titik eskalasi/freeze sesuai policy. Freeze tidak menghapus invoice atau saldo dan dapat dikecualikan melalui unlock yang disetujui.
6. TOP yang digunakan adalah Net 15, Net 30, Net 45, Net 60, Net 90 dan COD. TOP pelanggan pemerintah harus dikoordinasikan/ditetapkan bersama Finance.

### Onboarding dan dokumen pelanggan

Master Pelanggan menyimpan jenis pelanggan, potensi, pola pembayaran, PIC pembelian/penagihan/pengiriman/gudang, jadwal tukar faktur, metode pembayaran, NPWP/NIK, status PKP/Non-PKP, TOP, limit, toleransi hari, dokumen legalitas dan berkas NOO. Dokumen dapat berupa NIB, KTP, akta perubahan, SDAK, SIPA/SIPTTK/surat penugasan, tanda daftar gudang, spesimen tanda tangan dan stempel sesuai kebutuhan channel. Kelengkapan dan verifikasi memiliki status terpisah dari tahap hubungan Prospek/Pelanggan.

### Alur penjualan dan penagihan

Alur lama tetap dipertahankan sebagai pembagian tugas yang dapat dikonfigurasi:

**GA/Admin menyiapkan dokumen → Accounting memverifikasi → Sales menerima dokumen → Sales melakukan tukar faktur/penagihan → Pelanggan membayar → Accounting mencatat → Piutang diperbarui/ditutup.**

ERP mengganti pengiriman foto di WhatsApp dan arsip fisik sebagai sumber kebenaran dengan dokumen digital, handoff, nomor, bukti penerimaan dan audit. WhatsApp dapat tetap menjadi kanal komunikasi eksternal tanpa mengubah status ERP sebelum bukti diterima.

Jadwal follow-up default:

| Waktu | Tindakan |
|---|---|
| H-7 | Ingatkan pelanggan dan cek kelengkapan/tukar faktur |
| H | Konfirmasi kesiapan pembayaran |
| H+3 | Reminder dan catat respons |
| H+7 | Follow-up intensif dan periksa kendala dokumen |
| H+14 | Rencanakan kunjungan atau eskalasi ke PIC/atasan |
| H+30 | Eskalasi dan freeze sesuai hak/policy |

Sales tidak boleh mengubah TOP, menahan dokumen, menjanjikan diskon pembayaran atau menjanjikan retur tanpa hak/approval. Sistem mengunci field tersebut dan menyediakan jalur pengajuan.

### Dokumen wajib dan tukar faktur

Jenis dokumen yang dikenal aplikasi: Penawaran, PO/SP pelanggan, SO, Proforma, Picking Slip, Packing List, Surat Jalan, Invoice, Faktur Pajak, Kwitansi, Berita Acara, Kontrak, SPK, BAST, Nota Retur, Credit Note dan Bukti Pembayaran. Checklist wajib dapat berbeda menurut channel/customer dan ditampilkan sebelum tukar faktur atau penutupan piutang.

### WAPU dan pajak pemerintah

Pelanggan/instansi dapat memiliki tax role **WAPU**. Tax profile menyimpan status tersebut, jenis dokumen, DPP, PPN, bukti pemungutan/SSP atau dokumen yang tersedia, serta referensi yang diperlukan untuk Coretax. Ekspor XML pajak keluaran aktif sesuai [dokumen 38](12-finance-administration.md); direct API submission dan parser hasil terstruktur belum aktif. Sistem memberi tugas Finance untuk memeriksa perlakuan pajak; Sales tidak mengubah perlakuan pajak secara bebas.

### Retur

Retur mengikuti SOP: verifikasi keluhan → dokumentasikan kondisi → koordinasi Gudang/Quality → periksa status invoice/faktur pajak → nota retur → dokumen koreksi. Semua retur fisik masuk karantina. Sales dapat mengajukan, tetapi persetujuan, quality release, credit note dan refund mengikuti hak/approval.

### Cash advance dan klaim

Aturan perjalanan dan klaim dirinci pada [Perjalanan Dinas](13-hris.md). Ringkasnya: cash advance diajukan dalam tujuh hari sebelum kegiatan, settlement maksimal lima hari setelah perjalanan, dan klaim dibayar melalui dua siklus cut-off bulanan setelah disetujui.

## 2. Perbedaan SOP lama yang diselesaikan oleh rancangan ERP

| Sumber lama | Penyesuaian ERP |
|---|---|
| Tanda tangan supervisor pada nota pesanan/SO | Diganti validasi sistem dan hak akses. SO normal tidak memakai approval manual; approval hanya untuk unlock atau kebijakan lain yang dikonfigurasi |
| PR dan PO diserahkan ke Finance | PR dan PO berada di Warehouse & Logistik → Pengadaan. Finance memverifikasi tagihan, AP dan pembayaran |
| Picking mengurangi kartu stok manual | Sistem mengalokasikan/reservasi, mencatat picking aktual, lalu dispatch memindahkan stok ke transit. Tidak boleh mengurangi stok dua kali |
| Invoice dibuat dari surat jalan bertanda tangan | Invoice mengikuti POD. Pilihan invoice asli dibawa saat pengiriman tetap tersedia dengan status Menunggu POD |
| Tagihan supplier dicatat pada AR dalam SOP | Dikoreksi menjadi AP Supplier/Vendor, sesuai konteks dan kartu utang |
| WhatsApp dan bantex sebagai arsip utama | Diganti dokumen digital, nomor, handoff, lampiran dan audit; kanal komunikasi dapat dicatat sebagai bukti |
| PPN 11% tertulis tetap di SOP | Sistem memakai tax profile bertanggal efektif dan tidak mengunci tarif dari SOP lama |

## 3. Status sinkronisasi

Keputusan pengguna terbaru pada bagian ini menjadi acuan lebih tinggi daripada nilai default lama:

- freeze: **H+30**, bukan H+60;
- pelanggan baru: **COD tiga bulan atau bayar sebelum pengiriman**, bukan otomatis Tempo;
- jatuh tempo COD: tanggal POD;
- Finance dan Accounting memegang verifikasi/penutupan piutang, sedangkan Sales melakukan tukar faktur/follow-up sesuai penugasan;
- aturan perjalanan dinas dan klaim memakai batas PPT sampai ada revisi tertulis.

Perubahan ini tidak menghapus histori pelanggan, invoice, pembayaran, retur, atau keputusan lama. Master dan policy memiliki tanggal efektif.


---

## Bagian asal: 12-finance-administration.md

# Rekonsiliasi Bank

Status: spesifikasi bisnis Finance poin 7 selesai. Rekonsiliasi membandingkan mutasi rekening koran dengan transaksi kas/bank yang sudah tercatat di ERP. Rekonsiliasi tidak mengubah saldo secara diam-diam dan tidak membuat jurnal dari baris bank tanpa identifikasi serta persetujuan.

## 1. Tujuan

- memastikan saldo buku dan saldo rekening koran dapat dijelaskan;
- menemukan penerimaan pelanggan, pembayaran supplier/vendor, transfer, biaya bank, pajak dan transaksi yang belum dicatat;
- mencegah penerimaan atau pembayaran tercatat dua kali;
- menyediakan dasar yang dapat diaudit sebelum closing bulanan.

## 2. Atribut impor mutasi

| Kelompok | Field |
|---|---|
| Rekening | Rekening bank, nama bank, mata uang |
| Identitas | ID transaksi bank, nomor referensi, nomor cek/giro bila ada |
| Waktu | Tanggal transaksi, tanggal efektif/value date, waktu bila tersedia |
| Nilai | Debit, kredit, nominal bersih, saldo setelah transaksi |
| Deskripsi | Uraian bank, nama pengirim/penerima, berita transfer |
| Sumber | Nama file, hash file, format, waktu impor |
| Kontrol | Status staging, duplikat, matched/unmatched, catatan dan pengguna |

CSV/XLSX menjadi sumber awal. File dan baris yang sama ditolak atau ditandai duplikat berdasarkan hash, rekening, periode dan external transaction ID.

## 3. Alur rekonsiliasi

**Pilih rekening dan periode → Impor mutasi → Validasi staging → Pencocokan otomatis → Review pengecualian → Buat/tautkan transaksi → Rekonsiliasi saldo → Review → Kunci periode**

Rekonsiliasi dapat dilakukan bertahap. Baris bank yang belum selesai tetap terlihat pada periode berikutnya dan tidak boleh hilang karena filter tanggal.

## 4. Pencocokan otomatis

Prioritas pencocokan:

1. external transaction ID atau nomor referensi unik;
2. nominal dan tanggal value date;
3. nomor invoice/tagihan pada uraian;
4. nama pihak dan rekening tujuan/sumber;
5. toleransi tanggal yang diatur, default tiga hari kalender;
6. toleransi nominal hanya untuk biaya bank yang dikonfigurasi, bukan untuk invoice tanpa dasar.

Hasil pencocokan: **Cocok Otomatis**, **Kandidat**, **Cocok Manual**, **Tidak Cocok**, **Duplikat**, atau **Diabaikan dengan alasan**. Sistem tidak menandai kandidat sebagai cocok tanpa konfirmasi pengguna berizin.

## 5. Jenis transaksi

| Mutasi bank | Perlakuan ERP |
|---|---|
| Penerimaan invoice pelanggan | Tautkan ke penerimaan dan alokasi invoice |
| Penerimaan tanpa identitas | Dana Belum Teridentifikasi; identifikasi kemudian |
| Uang muka pelanggan | Tautkan ke uang muka, bukan pendapatan |
| Pembayaran supplier/vendor | Tautkan ke payment dan open item AP |
| Transfer antar rekening perusahaan | Tautkan satu `transfer_id`; jangan membuat penerimaan/pengeluaran eksternal ganda |
| Biaya administrasi bank | Buat draft beban sesuai akun dan policy |
| Pajak/auto-debit bank | Tautkan kewajiban atau buat draft dengan bukti |
| Bunga bank | Tautkan akun pendapatan/beban yang dikonfigurasi |
| Transaksi belum ada di ERP | Buat draft penerimaan/pembayaran/jurnal sesuai hak; tidak langsung posted |

## 6. Form review baris bank

Field utama: baris bank, jenis transaksi, pihak, transaksi ERP yang dipilih, nominal yang dialokasikan, akun lawan, tanggal pembukuan, bukti, catatan, alasan selisih, dan tindakan **Cocokkan / Buat Draft / Pecah / Abaikan / Tandai Duplikat**.

Satu baris bank dapat dipecah ke beberapa invoice atau akun jika totalnya sama dengan nominal bank. Selisih harus dijelaskan sebagai biaya bank, withholding, kurs, pembulatan atau koreksi yang disetujui.

## 7. Saldo dan status rekonsiliasi

Form periode memuat saldo awal rekening koran, total kredit, total debit, saldo akhir rekening koran, saldo buku, mutasi belum cocok, transaksi ERP belum muncul di bank, selisih dan tanggal cut-off. Rumus kontrol:

`Saldo awal rekening koran + kredit − debit = saldo akhir rekening koran`

`Saldo buku +/− item rekonsiliasi yang sah = saldo rekening koran`

Status periode: **Draft → Dalam Review → Selisih Perlu Tindakan → Siap Ditutup → Ditutup**. Periode tidak boleh ditutup jika ada baris tanpa status, selisih tanpa alasan, atau draft yang seharusnya sudah diposting, kecuali ada exception berapproval.

## 8. Penyesuaian dan approval

Penyesuaian menghasilkan draft transaksi dengan sumber baris bank, akun, nominal, pajak, bukti dan alasan. Posting mengikuti periode terbuka dan jurnal otomatis. Penyesuaian material, transaksi ke akun kontrol, perubahan tanggal atau penghapusan kecocokan memerlukan approval sesuai policy. Tidak ada tombol “set saldo rekening” sebagai jalan pintas.

Jika transaksi ERP sudah posted tetapi tidak ada di rekening koran, statusnya **Belum Muncul di Bank**, bukan otomatis dibatalkan. Jika transaksi bank ada tetapi belum di ERP, statusnya **Belum Dicatat** sampai dibuat dan diposting melalui alur yang sah.

## 9. API dan hak akses

Endpoint konseptual:

- `POST /bank-statement-imports` — unggah dan staging file;
- `POST /bank-statement-imports/{id}/validate` — validasi struktur dan duplikat;
- `POST /bank-statement-lines/{id}/match` — cocokkan dengan transaksi ERP;
- `POST /bank-statement-lines/{id}/create-draft` — buat draft penerimaan/pembayaran/jurnal;
- `POST /bank-reconciliations` — buka periode rekening;
- `POST /bank-reconciliations/{id}/review` — review saldo dan pengecualian;
- `POST /bank-reconciliations/{id}/close` — tutup setelah seluruh blocker selesai.

Hak minimum: `bank_statement.import`, `bank_reconciliation.read`, `bank_reconciliation.match`, `bank_reconciliation.adjust`, `bank_reconciliation.review`, `bank_reconciliation.close`. Hak matching tidak otomatis memberi hak posting atau close.

## 10. Kriteria penerimaan

1. File dan baris duplikat terdeteksi.
2. Mutasi tidak otomatis menjadi penerimaan, pembayaran atau jurnal posted.
3. Pencocokan invoice, tagihan, transfer dan uang muka dapat ditelusuri.
4. Penerimaan tidak dikenal masuk ke Dana Belum Teridentifikasi.
5. Satu transaksi ERP tidak dapat dicocokkan ke dua baris bank tanpa pembagian yang sah.
6. Selisih dan penyesuaian memiliki alasan, bukti, approval bila perlu dan jurnal.
7. Saldo awal, mutasi, saldo akhir dan saldo buku dapat direkonsiliasi.
8. Periode tertutup menolak posting mundur tanpa proses reopen terkontrol.
9. Laporan menampilkan baris cocok, belum cocok, belum muncul di bank, duplikat dan penyesuaian.
10. Audit menyimpan file, baris, pengguna, waktu, before/after dan sumber transaksi.

## 11. Parameter konfigurasi

- format file bank dan pemetaan kolom;
- toleransi tanggal dan nominal;
- akun biaya bank, bunga dan transaksi belum teridentifikasi;
- batas materialitas dan approver penyesuaian;
- cut-off rekonsiliasi bulanan;
- rekening yang boleh diimpor dan direkonsiliasi;
- retensi file rekening koran dan bukti.


---

## Bagian asal: 12-finance-administration.md

# HPP dan Penilaian Persediaan

Status: spesifikasi bisnis Finance poin 8 selesai. **Moving average / rata-rata bergerak** difinalkan pada Gelombang A untuk penilaian persediaan barang dagang. Perubahan metode di masa depan memerlukan keputusan baru, tanggal efektif, cut-over dan tidak mengubah histori.

## 1. Tujuan dan ruang lingkup

Sistem harus menghitung nilai persediaan, HPP, margin dan landed cost secara konsisten untuk produk alat kesehatan yang memiliki satuan, batch/lot, expiry, locator, karantina, konsinyasi dan retur. Kuantitas gudang berasal dari stock ledger; nilai berasal dari valuation ledger yang dapat direkonsiliasi ke akun kontrol GL.

## 2. Metode awal: rata-rata bergerak

Untuk setiap produk, perusahaan, mata uang dan satuan dasar:

`Nilai rata-rata baru = (Nilai stok sebelum + Nilai penerimaan yang dapat dikapitalisasi) / (Qty stok sebelum + Qty penerimaan layak dinilai)`

HPP pengeluaran dihitung dengan rata-rata yang berlaku sebelum pergerakan. Setiap pergerakan menyimpan unit cost snapshot sehingga koreksi periode tidak mengubah transaksi historis secara diam-diam.

Barang yang belum layak dijual, seperti karantina atau ditolak, tidak masuk available stock. Perlakuan nilainya mengikuti status: tetap dalam persediaan karantina, direklasifikasi, dikembalikan ke supplier, atau di-write-off dengan approval.

## 3. Komponen biaya persediaan

| Komponen | Perlakuan awal |
|---|---|
| Harga beli barang | Masuk nilai persediaan sesuai PO/Invoice/GR yang sah |
| Diskon pembelian | Mengurangi biaya barang bila dapat ditelusuri ke penerimaan |
| PPN masukan yang dapat dikreditkan | Tidak masuk HPP/persediaan |
| Pajak/biaya yang tidak dapat dikreditkan | Masuk biaya perolehan bila policy mengharuskan |
| Ongkir pembelian | Landed cost; dialokasikan ke baris penerimaan dengan dasar yang dipilih |
| Bongkar muat/asuransi masuk | Landed cost jika terkait langsung dan disetujui |
| Biaya administrasi umum | Beban, bukan nilai persediaan, kecuali policy menetapkan lain secara sah |
| Selisih invoice/GR | Ditahan sebagai exception sampai diselesaikan |

Ongkir pembelian tidak boleh dibebankan dua kali. Nilai awal OPS-FIN-05 mengalokasikan landed cost berdasarkan nilai pembelian net. Pengguna berizin dapat mengubah default ke berat, volume, qty atau pembagian rata melalui Setting; basis yang dipilih hanya dipakai bila data dasarnya lengkap. Basis dan versi policy disimpan pada dokumen biaya.

## 4. Penerimaan dan pergerakan nilai

- GR mencatat qty, batch/lot, expiry, kualitas, locator dan nilai sementara bila invoice supplier belum diterima.
- GRNI menampung kewajiban/nilai sementara sesuai three-way match.
- Saat invoice supplier diposting, selisih harga dan landed cost dialokasikan sesuai policy; hasilnya membuat adjustment valuation yang terlacak.
- Transfer locator tidak mengubah total nilai persediaan.
- Pindah ke karantina, transit atau konsinyasi mengubah akun/status kepemilikan sesuai kebijakan, bukan menghapus nilai.
- Pengeluaran untuk SO yang sudah dispatch mengakui HPP dari unit cost snapshot yang berlaku.
- Sampel, barang rusak, pemusnahan dan kehilangan menggunakan tujuan pergerakan serta akun yang terkonfigurasi.

## 5. Batch, expiry, FEFO dan serial

FEFO menentukan batch yang dipilih berdasarkan expiry terdekat yang masih layak. FIFO digunakan bila expiry tidak tersedia. Override memerlukan alasan dan izin. HPP dihitung dari valuation layer/average cost, sedangkan batch tetap disimpan untuk penelusuran mutu dan recall. Batch expired, recalled, blocked atau karantina tidak dapat dialokasikan ke penjualan.

## 6. Retur dan koreksi

Retur pelanggan masuk locator karantina dan menunggu pemeriksaan kualitas. Nilai retur tidak otomatis sama dengan harga jual atau HPP awal. Setelah pemeriksaan:

- layak jual: masuk stok dengan nilai yang ditentukan dari transaksi asal atau nilai yang disetujui policy;
- perlu perbaikan: tetap karantina dan dicatat sebagai persediaan yang dibatasi;
- rusak/expired: write-off atau penurunan nilai dengan approval;
- credit note mengurangi piutang secara terpisah dari pergerakan fisik.

Retur pembelian mengurangi qty dan nilai supplier sesuai layer/biaya yang dapat ditelusuri; selisih harga dicatat sebagai adjustment yang beralasan.

Kebijakan pembentukan harga jual dari HPP/biaya acuan mengikuti [Harga Jual dan Margin](10-sales-marketing.md); perubahan HPP tidak otomatis mengubah harga kontrak atau pricelist aktif.

## 7. Laporan

- Kartu stok qty dan nilai per produk, batch, locator dan pemilik.
- Nilai persediaan available, reserved, transit, karantina dan konsinyasi.
- HPP per invoice/SO, produk, kategori, pelanggan, channel dan periode.
- Margin bruto: penjualan net dikurangi HPP; pajak dan ongkir penjualan ditampilkan terpisah.
- Rekonsiliasi subledger persediaan ke GL.
- Aging expiry dan daftar batch mendekati kedaluwarsa.
- Laporan landed cost dan selisih invoice/GR.
- Laporan write-off, retur dan penurunan nilai.

## 8. Posting utama

| Peristiwa | Debit | Kredit |
|---|---|---|
| Penerimaan layak | Persediaan/GRNI sesuai profil | Utang/GRNI sesuai status |
| Ongkir landed cost | Persediaan | Kas/Utang biaya |
| Dispatch/POD sesuai policy | HPP | Persediaan atau transit |
| Retur layak jual | Persediaan | HPP/akun koreksi |
| Write-off/pemusnahan | Beban penurunan nilai/write-off | Persediaan |
| Penurunan nilai | Beban penurunan nilai | Cadangan/penyesuaian persediaan |
| Koreksi nilai | Akun adjustment yang disetujui | Persediaan atau sebaliknya |

Profil jurnal final mengikuti Chart of Accounts dan kondisi POD/dispatch yang telah ditetapkan. Posting harus idempotent, seimbang dan dapat direverse.

## 9. Cut-off dan koreksi

Posting periode tertutup ditolak. Invoice supplier yang datang terlambat masuk proses accrual/GRNI atau adjustment pada periode terbuka sesuai policy. Koreksi tidak mengedit unit cost snapshot lama; sistem membuat valuation adjustment dengan alasan, sumber, approver dan dampak laporan.

## 10. Hak akses dan konfigurasi

Finance mengelola metode valuasi, akun, landed cost, materialitas dan approval. Gudang mengelola qty, batch, expiry, kualitas dan locator. Purchasing mengelola harga PO dan biaya pengiriman. Pengguna yang hanya melihat stok tidak otomatis melihat harga modal.

Kebijakan final dan parameter yang perlu diisi:

- metode valuasi: moving average per perusahaan+produk dalam satuan dasar;
- dasar landed cost default: nilai pembelian net per charge;
- akun persediaan, HPP, GRNI, karantina, transit, konsinyasi dan write-off;
- perlakuan pajak/biaya yang tidak dapat dikreditkan;
- batas materialitas selisih;
- aturan retur layak jual dan penurunan nilai;
- waktu pengakuan HPP: POD sebagai default sesuai rancangan;
- frekuensi rekonsiliasi nilai persediaan dan closing.

## 11. Kriteria penerimaan

1. Nilai persediaan dapat dihitung ulang dari stock dan valuation ledger.
2. HPP memakai unit cost snapshot yang konsisten.
3. Batch expired/blocked/karantina tidak dialokasikan.
4. FEFO/FIFO dan override tercatat.
5. Ongkir pembelian dialokasikan sekali dan dapat ditelusuri.
6. GRNI, invoice supplier dan selisih three-way match terlihat.
7. Retur fisik, credit note dan write-off terpisah.
8. Kartu stok, nilai persediaan dan GL dapat direkonsiliasi.
9. Koreksi periode tertutup memakai adjustment/reversal terkontrol.
10. Perhitungan HPP dan margin tidak memasukkan pajak keluaran atau ongkir penjualan ke target penjualan net.


---

## Bagian asal: 12-finance-administration.md

# Closing Bulanan

Status: spesifikasi bisnis Finance poin 9 selesai. Closing adalah proses memastikan transaksi periode lengkap, subledger cocok dengan GL, penyesuaian disetujui, lalu periode dikunci. Closing tidak menghapus transaksi dan tidak menggantikan rekonsiliasi.

## 1. Tujuan

- memastikan penjualan, pembelian, persediaan, kas/bank, AR/AP, biaya, aset dan payroll periode telah diproses;
- memastikan saldo subledger sama dengan akun kontrol GL;
- mencegah transaksi mundur setelah laporan disetujui;
- menyediakan checklist dan bukti yang dapat ditinjau pimpinan/Finance.

## 2. Periode dan status

Periode memiliki status **Open → Closing in Progress → Pending Review → Closed**. Status tambahan **Blocked** digunakan bila ada blocker. Periode Closed menolak posting, koreksi, import, atau perubahan transaksi dengan tanggal periode tersebut kecuali proses Reopen.

Periode berikutnya dapat disiapkan sebagai Open, tetapi tidak boleh digunakan untuk menyembunyikan transaksi periode sebelumnya. Backdating ditolak oleh service dan database.

## 3. Urutan closing

1. Tetapkan cut-off dan hentikan transaksi periode sesuai jadwal.
2. Pastikan semua SO, POD, invoice, retur dan credit note yang relevan telah diproses.
3. Pastikan GR, invoice supplier/vendor, GRNI dan AP telah dicocokkan.
4. Tutup penerimaan/pembayaran dan rekonsiliasi kas/bank.
5. Rekonsiliasi kartu piutang, kartu utang, uang muka dan aging.
6. Rekonsiliasi stok qty dan nilai, HPP, landed cost, karantina, transit dan konsinyasi.
7. Catat biaya akrual, prepaid, penyusutan, payroll payable dan kewajiban pajak.
8. Jalankan validasi jurnal: debit = kredit, akun aktif, periode terbuka, sumber lengkap.
9. Review neraca saldo, laba rugi, neraca, arus kas dan laporan pengecualian.
10. Finance mengajukan review; approver menyetujui; sistem mengunci periode.

## 4. Checklist minimum

| Area | Pemeriksaan | Bukti/hasil |
|---|---|---|
| Penjualan | POD belum ditagih, invoice, retur, credit note, invoice asli menunggu POD | daftar unbilled dan exception |
| Piutang | aging, past due, pembayaran belum dialokasi, uang muka, dispute | rekonsiliasi AR ke GL |
| Pembelian | GR belum ditagih, invoice supplier/vendor, selisih three-way match | GRNI/AP reconciliation |
| Kas & bank | semua rekening diimpor, saldo koran, transaksi belum cocok, kas opname | laporan rekonsiliasi |
| Persediaan | stock opname/cut-off, batch/expiry, karantina, transit, konsinyasi, nilai dan HPP | kartu stok dan valuation report |
| Biaya, aset dan anggaran | reimbursement, cash advance, akrual, prepaid, kapitalisasi, penyusutan, aset belum in service, komitmen anggaran dan exception budget | daftar biaya/aset/komitmen terbuka |
| Payroll | periode absensi sudah cut-off, input variabel terkunci, snapshot input cocok dengan payroll, payroll posted, BPJS, PPh 21, gaji terutang, pembayaran dan adjustment | attendance/payroll reconciliation |
| Pajak | tax transaction, faktur keluaran/masukan, WAPU, bukti potong, pembayaran dan subledger=GL; batch XML Coretax keluaran direkonsiliasi dengan dokumen siap ekspor/diunggah/hasilnya; estimasi/provision PPh Badan bulanan bila diterapkan; pada closing tahunan tersedia rekonsiliasi fiskal, kompensasi kerugian, kredit/angsuran, posisi kurang/lebih bayar dan true-up | tax reconciliation, Coretax batch exception, corporate tax worksheet dan exception report |
| GL | jurnal gagal, suspense, akun kontrol, saldo tidak wajar | trial balance dan exception |

## 5. Blocker closing

Closing tidak dapat dilanjutkan bila terdapat:

- jurnal tidak seimbang atau gagal posting;
- saldo subledger berbeda dengan akun kontrol tanpa penjelasan/approval;
- transaksi draft/approval yang wajib diproses tetapi belum memiliki keputusan;
- mutasi bank tanpa status atau selisih tanpa alasan;
- stok negatif, batch expired teralokasi, atau selisih opname belum diselesaikan;
- GRNI/AR/AP yang melewati materialitas tanpa tindak lanjut;
- dokumen pajak wajib atau payroll yang belum lengkap;
- payroll payable, pembayaran gaji, BPJS/PPh 21, atau adjustment yang belum direkonsiliasi;
- periode atau akun yang salah pada jurnal;
- proses job/asynchronous posting yang masih berjalan atau gagal.

Exception dapat diberi status **Diterima Beralasan** hanya oleh pihak berwenang, dengan alasan, dampak, rencana penyelesaian dan tanggal target. Exception tidak boleh menyembunyikan saldo.

## 6. Review dan persetujuan

Finance menyiapkan checklist dan bukti. Reviewer memeriksa saldo, exception dan laporan. Approver mengunci periode sesuai policy. Pemisahan tugas dapat mewajibkan pembuat checklist berbeda dari reviewer/approver. Semua keputusan menyimpan pengguna, waktu, versi checklist, komentar dan lampiran.

## 7. Reopen periode

Periode Closed hanya dapat dibuka kembali oleh pengguna dengan izin khusus. Permintaan Reopen memuat periode, transaksi/akun terdampak, alasan, bukti, dampak laporan, periode pengganti dan rencana penutupan kembali. Setelah disetujui:

- sistem membuat revision closing baru;
- transaksi koreksi memakai periode terbuka yang diizinkan;
- laporan lama tetap disimpan sebagai versi historis;
- periode harus melalui checklist ulang sebelum ditutup kembali.

Reopen tidak mengedit jurnal posted; koreksi memakai reversal, adjustment atau transaksi pengganti.

## 8. Laporan closing

- Trial Balance sebelum dan sesudah adjustment.
- Laba rugi, neraca dan arus kas.
- Rekonsiliasi AR/AP, stok, kas/bank dan akun kontrol.
- Daftar transaksi belum diposting, exception dan blocker.
- Daftar jurnal manual, reversal dan adjustment.
- Daftar perubahan setelah review.
- Ringkasan sign-off dan status periode.

## 9. API dan database konseptual

Endpoint:

- `POST /close-runs` — membuat run closing;
- `POST /close-runs/{id}/validate` — menjalankan checklist dan blocker;
- `POST /close-runs/{id}/submit-review` — mengajukan review;
- `POST /close-runs/{id}/approve` — menyetujui;
- `POST /periods/{id}/close` — mengunci periode;
- `POST /periods/{id}/reopen-requests` — meminta buka kembali.

Entitas utama: `close_runs`, `close_tasks`, `close_exceptions`, `close_signoffs`, `period_reopen_requests`, dan `report_versions`. Setiap task memiliki owner, hasil, status, blocker, bukti, timestamp dan revision.

## 10. Kriteria penerimaan

1. Sistem memiliki checklist per periode dan area.
2. Blocker dihitung server dan tidak dapat dilewati dengan mengubah status dari frontend.
3. Rekonsiliasi subledger–GL menjadi bukti wajib.
4. Periode Closed menolak posting mundur.
5. Reopen memerlukan hak, alasan, approval dan audit.
6. Laporan sebelum dan sesudah closing tersimpan sebagai versi.
7. Exception memiliki pemilik, alasan, dampak dan target penyelesaian.
8. Closing tidak membuat jurnal ganda saat dijalankan ulang.
9. Status job async dan kegagalan posting terlihat.
10. Sign-off menyimpan pengguna, waktu, komentar dan bukti.


---

## Bagian asal: 12-finance-administration.md

# Laporan Keuangan dan Manajemen

Status: spesifikasi bisnis Finance poin 10 selesai. Laporan dihitung dari jurnal posted, subledger dan dimensi yang tervalidasi. Draft, proforma, janji bayar dan estimasi tidak mengubah laporan aktual sampai sumbernya diposting.

## 1. Prinsip laporan

- Setiap laporan memiliki tanggal/periode acuan, mata uang, basis posting dan timezone perusahaan.
- Saldo berasal dari jurnal posted serta subledger yang dapat ditelusuri ke dokumen sumber.
- Laporan tidak mengambil angka dari cache frontend atau hanya halaman yang sedang terlihat.
- Laporan historis yang sudah diterbitkan disimpan sebagai versi; koreksi setelah closing menghasilkan versi baru.
- Hak akses membatasi perusahaan, rekening, departemen, rayon, sales, channel, pelanggan, supplier, vendor dan akun.
- Total laporan harus dapat direkonsiliasi ke neraca saldo dan akun kontrol.

## 2. Daftar laporan utama

### 2.1 Neraca Saldo

Menampilkan kode akun, nama akun, saldo awal, mutasi debit, mutasi kredit dan saldo akhir. Filter periode, akun, dimensi dan status jurnal. Total debit dan kredit harus seimbang; akun tanpa transaksi dapat ditampilkan atau disembunyikan sesuai pilihan.

### 2.2 Buku Besar

Menampilkan setiap jurnal posted: tanggal, nomor jurnal, sumber dokumen, deskripsi, dimensi, debit, kredit dan saldo berjalan. Setiap baris dapat dibuka ke jurnal dan dokumen sumber. Laporan mendukung ekspor dengan audit filter dan timestamp.

### 2.3 Laba Rugi

Struktur awal:

- Pendapatan penjualan net;
- pengurang penjualan, retur dan credit note;
- HPP;
- laba kotor dan margin bruto;
- beban penjualan, ongkir penjualan, komisi dan perjalanan;
- beban gudang/logistik;
- beban umum dan administrasi;
- biaya bank, penyusutan dan biaya lain;
- laba sebelum pajak;
- beban pajak penghasilan kini dan pajak tangguhan bila kebijakannya diaktifkan;
- laba bersih sesuai akun yang dipetakan.

Pajak keluaran dan uang muka tidak diperlakukan sebagai pendapatan. Laba kena pajak pada worksheet PPh Badan tidak disamakan dengan laba sebelum pajak karena dapat memiliki koreksi fiskal. Laporan dapat dibandingkan dengan target, estimasi dan periode pembanding, tetapi angka aktual tetap berasal dari posting.

### 2.4 Neraca

Menampilkan aset lancar, persediaan, piutang, uang muka, aset tetap, kewajiban, utang, pajak, payroll payable, modal dan laba ditahan. Neraca harus memenuhi:

`Total Aset = Total Liabilitas + Ekuitas`

Saldo persediaan, AR, AP, kas/bank dan aset tetap dapat dibuka ke subledger. Rincian register, penyusutan, nilai buku dan disposal mengikuti [Aset Tetap dan Penyusutan](12-finance-administration.md).

### 2.5 Arus Kas

Menggunakan metode tidak langsung sebagai laporan utama, dengan rekonsiliasi laba bersih ke kas operasi. Sistem juga menyediakan rincian kas masuk/keluar berdasarkan aktivitas operasi, investasi dan pendanaan. Klasifikasi cash flow berasal dari mapping akun/event bertanggal efektif; transfer internal tidak dihitung sebagai arus kas eksternal ganda.

### 2.6 Piutang dan utang

- Kartu piutang per pelanggan.
- Aging piutang memakai bucket aktif OPS-FIN-08; contoh awal current, 1–30, 31–60, 61–90, 91–120, >120 hari. Freeze policy ditampilkan sebagai indikator terpisah.
- Kartu utang supplier dan vendor.
- Uang muka dan dana belum dialokasi.
- Forecast tagihan dan pembayaran dibandingkan aktual.
- Daftar invoice disputed, overdue, unbilled dan GRNI.

### 2.7 Persediaan dan margin

- Nilai stok per produk, batch, locator, status kualitas dan pemilik.
- HPP dan margin per invoice, SO, produk, kategori, pelanggan, channel dan sales; definisi harga/margin mengikuti [Harga Jual dan Margin](10-sales-marketing.md).
- Landed cost, stock adjustment, write-off, retur, expiry dan recall.
- Rekonsiliasi stock ledger dengan akun persediaan GL.

## 3. Filter dan dimensi

Filter umum: periode/tanggal acuan, perusahaan, akun, rekening, departemen, rayon, channel, pelanggan, supplier/vendor, sales, produk/kategori, gudang/locator, batch, status posting, mata uang dan versi laporan. Filter yang membatasi cakupan harus tercetak pada header dan tersimpan dalam parameter laporan.

## 4. Perbandingan dan analitik

Laporan dapat dibandingkan dengan:

- periode sebelumnya;
- periode sama tahun sebelumnya;
- anggaran;
- target penjualan atau penagihan;
- estimasi/forecast versi tertentu;
- data per channel, rayon, sales, pelanggan atau kategori produk.

Budget vs Actual memakai definisi anggaran, komitmen dan realisasi pada [Anggaran dan Budget vs Actual](12-finance-administration.md). Perbandingan tidak mencampur net sales dengan nilai termasuk PPN, ongkir atau retur yang belum diposting. Persentase A/T memakai dasar target yang sama dengan definisi target.

## 5. Versi, ekspor dan bukti

Setiap laporan menyimpan report ID, tanggal dibuat, as-of date, filter, pengguna, sumber data, versi COA/mapping dan status. PDF/XLSX/CSV dapat diekspor sesuai izin. Laporan besar dibuat sebagai job asynchronous; pengguna melihat status dan hash file. Ekspor tidak mengubah posting atau saldo.

Laporan closing diberi status Draft, Reviewed atau Final. Laporan Final setelah periode ditutup tidak diganti; koreksi menghasilkan versi koreksi yang merujuk versi sebelumnya.

## 6. Kontrol kualitas

- Debit dan kredit neraca saldo seimbang.
- Neraca seimbang.
- Arus kas akhir cocok dengan saldo kas/bank yang direkonsiliasi setelah item yang sah.
- AR/AP cocok dengan open items dan akun kontrol.
- Persediaan cocok dengan valuation ledger dan akun kontrol.
- Pendapatan dan HPP mengikuti profil waktu pengakuan yang berlaku.
- Periode tertutup menolak jurnal baru.
- Laporan menampilkan warning bila ada suspense, exception, job gagal atau saldo belum direkonsiliasi.

## 7. API dan database konseptual

Endpoint laporan:

- `GET /reports/trial-balance`
- `GET /reports/general-ledger`
- `GET /reports/profit-loss`
- `GET /reports/balance-sheet`
- `GET /reports/cash-flow`
- `GET /reports/receivables-aging`
- `GET /reports/payables-aging`
- `GET /reports/inventory-valuation`
- `GET /reports/margins`
- `POST /report-exports`
- `GET /report-exports/{id}`

Entitas `report_definitions`, `report_runs`, `report_versions`, `report_filters`, `report_exports` dan `report_access_scopes` menyimpan definisi, parameter, hasil, file, filter, versi dan akses.

## 8. Kriteria penerimaan

1. Lima laporan dasar tersedia: neraca saldo, buku besar, laba rugi, neraca dan arus kas.
2. AR/AP, aging, persediaan dan margin dapat ditelusuri ke dokumen sumber.
3. Laporan menggunakan jurnal posted dan tidak menghitung draft/proforma sebagai aktual.
4. Periode, filter dan dimensi tercetak serta tersimpan.
5. Neraca saldo seimbang dan neraca memenuhi persamaan akuntansi.
6. Arus kas tidak menggandakan transfer internal.
7. Versi laporan Final tidak berubah setelah closing.
8. Ekspor besar berjalan asynchronous dan dapat diunduh sesuai izin.
9. Warning rekonsiliasi dan suspense terlihat.
10. Semua pembuatan, ekspor, koreksi versi dan akses laporan diaudit.


---

## Bagian asal: 12-finance-administration.md

# Anggaran dan Budget vs Actual

Status: spesifikasi bisnis Finance poin anggaran selesai sebagai rancangan. Anggaran mengendalikan rencana biaya, komitmen dan realisasi; anggaran tidak menggantikan approval transaksi dan tidak membuat jurnal.

## 1. Cakupan

Anggaran dapat disusun per tahun, triwulan, bulan, departemen, akun, kategori biaya, produk, gudang, rayon, sales, proyek/kegiatan, supplier/vendor atau jenis kebutuhan. Cakupan awal yang relevan: permintaan tenaga dan biaya rekrutmen, pembelian persediaan, ATK/barang operasional, aset sesuai [Aset Tetap dan Penyusutan](12-finance-administration.md), perjalanan dinas, sales/marketing, gudang, payroll dan administrasi.

## 2. Siklus anggaran

**Draft → Diajukan → Ditinjau → Disetujui → Aktif → Direvisi/Disupersede → Ditutup**

Anggaran yang aktif memiliki versi, periode, pemilik, approver, mata uang, dasar perhitungan dan status. Versi lama tetap tersimpan; perubahan hanya memengaruhi periode/bagian yang belum terealisasi sesuai keputusan.

## 3. Struktur form

Header: tahun/periode, nama anggaran, departemen/pemilik, mata uang, versi, dasar penyusunan, catatan dan lampiran. Baris: akun/kategori, dimensi, periode, nilai anggaran, batas toleransi, pemilik, sumber usulan dan catatan.

Sistem menyediakan impor template, salin dari periode sebelumnya, distribusi tahunan ke bulan, dan usulan berdasarkan histori. Nilai yang belum disetujui tidak menjadi batas transaksi.

## 4. Komitmen dan realisasi

- **Anggaran:** nilai yang disetujui untuk periode dan cakupan.
- **Komitmen:** nilai PR/PO atau permintaan yang telah disetujui tetapi belum menjadi realisasi posted.
- **Realisasi:** nilai transaksi posted, seperti invoice, biaya, pembayaran bila basis policy menggunakannya, payroll atau penyusutan.
- **Sisa tersedia:** anggaran − komitmen yang masih berlaku − realisasi yang belum tercakup komitmen.

Sistem mencegah satu transaksi dihitung sebagai komitmen dan realisasi ganda. Ketika PO menjadi invoice posted, komitmen PO dilepas/ditransfer ke realisasi sesuai policy. Pembatalan PR/PO melepas komitmen; revisi menyimpan delta dan histori.

## 5. Budget checking

Budget check berjalan saat pengajuan/approval kebutuhan tenaga, offer yang berdampak pada budget, PR, PO Supplier/Vendor, permintaan internal, aset, perjalanan dinas, reimbursement, biaya langsung dan transaksi relevan. Hasil: **Lolos**, **Peringatan**, **Ditahan**, atau **Tidak Berlaku**.

Policy dapat memakai kontrol:

- hard stop bila sisa tidak cukup;
- soft warning dengan alasan;
- toleransi nominal/persentase;
- exception dengan approver dan masa berlaku;
- pengecualian untuk biaya wajib atau transaksi tanpa anggaran.

Budget check tidak menggantikan approval PR/PO, Finance, HR atau perjalanan dinas. Pengguna tidak dapat mengubah status budget dari frontend untuk melewati blocker.

## 6. Transfer dan revisi

Transfer anggaran memuat sumber, tujuan, nilai, periode, alasan, dampak, approver dan tanggal efektif. Transfer tidak boleh mengubah histori realisasi. Revisi anggaran membuat versi baru; sistem menampilkan perbedaan terhadap versi sebelumnya dan tidak mengubah dokumen posted.

## 7. Budget vs Actual

Laporan menampilkan per akun/dimensi/periode: anggaran, komitmen, realisasi, sisa, persentase serapan, forecast akhir periode dan varians nominal/persentase. Drill-down membuka PR, PO, invoice, reimbursement, cash advance, payroll, aset atau jurnal sumber.

Filter: periode, departemen, akun, kategori, gudang, rayon, sales, channel, supplier/vendor, proyek/kegiatan, status dan versi anggaran. Nilai dilaporkan dalam mata uang anggaran dan mencatat kurs jika kelak multi-currency diaktifkan.

## 8. Alur kepemilikan

- HR mengelola usulan anggaran SDM, rekrutmen, perjalanan dan barang operasional sesuai izin.
- Logistik menyusun kebutuhan persediaan dan komitmen PR/PO.
- Finance mengelola mapping akun, budget check, realisasi posted, laporan dan kontrol periode.
- Pimpinan menyetujui anggaran dan exception sesuai batas.

## 9. API dan database

Endpoint: `/budgets`, `/budgets/{id}/submit`, `/budgets/{id}/approve`, `/budgets/{id}/activate`, `/budgets/{id}/revise`, `/budget-checks`, `/budget-transfers`, `/reports/budget-vs-actual` dan `/budget-exports`.

Entitas: `budgets`, `budget_versions`, `budget_lines`, `budget_assignments`, `budget_commitments`, `budget_realizations`, `budget_checks`, `budget_exceptions`, `budget_transfers` dan `budget_report_runs`.

## 10. Kriteria penerimaan

1. Hanya anggaran Aktif yang dapat menjadi batas transaksi.
2. Komitmen dan realisasi tidak dihitung dua kali.
3. PR/PO, reimbursement, perjalanan dan biaya yang relevan dapat memicu budget check.
4. Hard stop, warning, toleransi dan exception mengikuti policy bertanggal efektif.
5. Revisi/transfer tidak mengubah histori posted.
6. Budget vs Actual dapat ditelusuri ke dokumen dan jurnal sumber.
7. Anggaran lintas dimensi tidak menggandakan nilai perusahaan.
8. Approval, exception dan perubahan versi diaudit.
9. Ekspor laporan menyimpan filter, versi, waktu dan pengguna.
10. Closing dapat menampilkan budget blocker dan komitmen terbuka.


---

## Bagian asal: 12-finance-administration.md

# Aset Tetap dan Penyusutan

Status: spesifikasi bisnis Finance/HRIS aset selesai sebagai rancangan. Gelombang A menetapkan bahwa kapitalisasi tidak boleh otomatis sebelum threshold, masa manfaat dan policy kategori disahkan. Seluruh kandidat aset wajib direview Finance. Metode garis lurus tetap usulan untuk buku komersial dan belum dijalankan resmi sebelum policy kategori aktif.

## 1. Prinsip

1. Nama barang tidak otomatis menentukan aset; Finance menilai kepemilikan, nilai, masa manfaat dan kebijakan kapitalisasi.
2. Master jenis/model berbeda dari register unit aset. Tiga laptop yang diterima menjadi tiga nomor aset.
3. Pembelian, penerimaan, tagihan, pembayaran, registrasi aset dan penyusutan merupakan tahap berbeda.
4. Penyusutan dimulai ketika aset siap dan mulai digunakan (`in service`), bukan otomatis dari tanggal PO atau pembayaran.
5. Aset dan akumulasi penyusutan direkonsiliasi ke GL; transaksi posted tidak diedit langsung.

## 2. Sumber aset

- PO Vendor dan penerimaan barang;
- pembangunan/pengerjaan melalui Aset Dalam Penyelesaian;
- reimbursement atau pembelian langsung yang memenuhi kebijakan;
- transfer aset antar lokasi/unit;
- saldo awal cut-over dengan harga perolehan dan akumulasi penyusutan terverifikasi.

Setiap aset tertaut dokumen perolehan, invoice, pembayaran, vendor, budget dan bukti penerimaan bila tersedia.

## 3. Atribut register aset

Kode/nomor aset, nama, jenis/model, kategori, nomor seri, merek, spesifikasi, vendor, dokumen perolehan, harga perolehan, biaya tambahan, tanggal perolehan, tanggal siap digunakan, nilai residu, masa manfaat, metode penyusutan, akun aset/akumulasi/beban, lokasi, departemen, kustodian/karyawan, kondisi, garansi, foto, dokumen, status dan riwayat.

Status: **Draft → Diterima → Menunggu Kapitalisasi → Aktif/In Service → Dipindahkan/Dipinjamkan → Dalam Perbaikan → Idle → Dilepas/Hilang/Dimusnahkan**. Status finansial dan kondisi fisik disimpan terpisah.

## 4. Kapitalisasi

Finance meninjau nilai minimum, masa manfaat, kepemilikan, kesiapan digunakan dan komponen biaya. Hasil: Beban, Prepaid, Persediaan Operasional, Aset Tetap atau Aset Dalam Penyelesaian. Review menyimpan alasan dan policy version.

Aset Dalam Penyelesaian menampung biaya sampai siap digunakan. Saat kapitalisasi, biaya direklasifikasi ke kategori aset dan jadwal penyusutan dibuat. Biaya pemeliharaan rutin dibebankan; penambahan yang memperpanjang manfaat atau kapasitas dapat dikapitalisasi setelah review.

## 5. Penyusutan

Usulan metode awal: **garis lurus**.

`Penyusutan per periode = (Harga perolehan − Nilai residu) / Masa manfaat`

Jadwal menyimpan periode, hari/bulan penggunaan, nilai awal, beban, akumulasi dan nilai buku akhir. Aturan bulan pertama/terakhir, prorata harian atau bulanan, nilai residu dan pembulatan dikonfigurasi per kategori.

Run penyusutan: **Draft → Dihitung → Direview → Diposting → Reversed**. Retry tidak boleh membuat jurnal ganda. Periode tertutup menolak posting mundur. Buku komersial dan pajak tidak dicampur jika metode/masa manfaat berbeda.

## 6. Penugasan dan HRIS

Serah terima aset mencatat karyawan, lokasi, tanggal, kondisi, aksesori, bukti dan tanggung jawab. Tab Aset pada karyawan membaca transaksi yang sama. Mutasi/pengembalian mencatat kondisi lama-baru dan tidak membuat aset kedua.

Offboarding menampilkan aset yang belum dikembalikan sebagai checklist. Pengembalian memakai [Resign, Offboarding, Final Pay dan Pengembalian Aset](13-hris.md); penyelesaian final pay tidak otomatis ditahan tanpa policy dan tinjauan hukum/HR yang berlaku.

## 7. Perawatan dan stock opname

Perawatan menyimpan jadwal, vendor, pekerjaan, biaya, downtime, garansi dan bukti. Stock opname aset membandingkan lokasi/kustodian/kondisi sistem dengan fisik. Selisih menghasilkan investigasi dan tindakan, bukan penghapusan otomatis.

## 8. Impairment, kehilangan dan pelepasan

Penurunan nilai, kehilangan, penjualan, hibah atau pemusnahan memerlukan tanggal, alasan, bukti, nilai buku, hasil penjualan/kompensasi, approval dan jurnal. Pelepasan menghentikan penyusutan pada tanggal policy, menghapus harga perolehan dan akumulasi, lalu mengakui laba/rugi pelepasan.

Aset yang hilang tetap tercatat dalam kasus investigasi sampai keputusan berwenang; status Hilang tidak langsung menghapus nilai buku.

## 9. Jurnal utama

| Peristiwa | Debit | Kredit |
|---|---|---|
| Perolehan aset | Aset/Aset Dalam Penyelesaian; PPN Masukan bila eligible | AP Vendor/GRNI/Bank |
| Kapitalisasi CIP | Aset Tetap | Aset Dalam Penyelesaian |
| Penyusutan | Beban Penyusutan | Akumulasi Penyusutan |
| Impairment | Beban Penurunan Nilai | Akumulasi impairment/akun kontra aset |
| Pelepasan | Kas/piutang dan Akumulasi Penyusutan; rugi bila ada | Harga Perolehan Aset; laba bila ada |

## 10. Navigasi dan akses

**Finance → Aset:** Aset dalam Proses, Register Aset, Kapitalisasi, Penyusutan, Mutasi & Serah Terima, Perawatan, Stock Opname, Impairment/Pelepasan, Rekonsiliasi dan Laporan.

**HRIS → Karyawan → Aset:** aset yang sedang digunakan, serah terima, pengembalian dan checklist offboarding. HR tidak otomatis dapat mengubah nilai, jadwal penyusutan atau jurnal.

## 11. API dan database

Endpoint: `/asset-classes`, `/assets`, `/assets/{id}/capitalize`, `/asset-assignments`, `/asset-transfers`, `/asset-maintenance`, `/asset-counts`, `/depreciation-runs`, `/asset-impairments`, `/asset-disposals`, dan `/reports/fixed-assets`.

Entitas: `asset_classes`, `asset_models`, `assets`, `asset_cost_components`, `asset_assignments`, `asset_transfers`, `asset_maintenance`, `asset_counts`, `asset_depreciation_schedules`, `asset_depreciation_runs`, `asset_impairments`, `asset_disposals` dan `asset_opening_items`.

## 12. Kriteria penerimaan

1. Setiap unit aset memiliki nomor unik dan sumber perolehan.
2. Kapitalisasi terpisah dari pembelian/pembayaran.
3. Penyusutan baru dimulai saat in service.
4. Run penyusutan idempotent dan direkonsiliasi ke GL.
5. Mutasi/serah terima tidak menggandakan aset.
6. Tab aset karyawan memakai data assignment yang sama.
7. Stock opname dan kehilangan tidak menghapus nilai otomatis.
8. Pelepasan menghitung nilai buku dan laba/rugi dengan bukti/approval.
9. Opening aset memuat perolehan dan akumulasi terverifikasi.
10. Riwayat nilai, lokasi, kustodian, kondisi, maintenance dan disposal diaudit.


---

## Bagian asal: 12-finance-administration.md

# Pajak dan Kepatuhan Pajak

Status: sumber domain pajak internal ERP; kontrol Gelombang C telah difinalkan. Tarif, identitas dan perlakuan transaksi tetap harus berasal dari dokumen resmi melalui rule bertanggal efektif. Ekspor XML faktur pajak keluaran Coretax aktif sebagai proses file sesuai [dokumen 38](12-finance-administration.md); pengiriman API langsung dan parser hasil terstruktur tidak termasuk versi awal.

## 1. Batas domain

Domain pajak mencakup profil pajak perusahaan/pihak/karyawan, PPN keluaran dan masukan, withholding/PPh, PPh 21 payroll, PPh Badan, WAPU, faktur pajak, bukti potong, masa pajak, pembayaran dan rekonsiliasi GL. BPJS bukan pajak dan tetap berada pada Payroll. Domain pajak tidak menentukan harga, HPP, pengakuan pendapatan atau approval pembayaran.

## 2. Profil dan rule pajak

`tax_profiles` dan `tax_rules` menyimpan kode/jenis, pihak, DPP, tarif, batas/pengecualian, pembulatan, waktu terutang, akun, dokumen, effective dates, version, approver dan status. Tarif tidak ditanam di kode. Transaksi menyimpan snapshot rule. Rule ambigu, kedaluwarsa atau tidak lengkap menjadi blocker/exception.

## 3. Pajak penjualan

SO/proforma hanya menampilkan estimasi. Pada event terutang sesuai rule, sistem membuat tax transaction dari POD, invoice, uang muka, credit note atau sumber lain. Faktur pajak keluaran menyimpan pelanggan, NPWP/NIK bila relevan, PKP/WAPU, sumber transaksi, DPP, tarif, nilai, tanggal, nomor, status dan file. Faktur pajak dan invoice komersial memiliki nomor/lifecycle terpisah. Retur/koreksi menautkan dokumen asal.

## 4. Pajak pembelian, biaya dan withholding

Invoice Supplier/Vendor menyimpan DPP, PPN masukan, withholding dan eligibility berdasarkan rule/bukti. PPN eligible dipisahkan dari biaya; nonrecoverable mengikuti keputusan Finance. Duplicate check memakai pihak, nomor pajak, jenis dan periode.

Pembayaran Supplier/Vendor dapat menghasilkan utang withholding dan transfer neto. Pada penerimaan pelanggan WAPU, sistem memisahkan **PPN Dipungut WAPU** (`vat_collected_by_customer`) dan **PPh Dipotong** (`income_tax_withheld`) sebagai dua komponen pajak; beberapa jenis PPh dapat menjadi beberapa baris. Masing-masing menyimpan pihak, jenis, periode, DPP, tarif, nilai, nomor/tanggal, file, status, akun dan alokasi. Hanya komponen yang memenuhi policy bukti/verifikasi yang menyelesaikan AR atau masuk akun pajak definitif; upload bukti tidak otomatis berarti valid. Komponen tersebut bukan diskon penjualan.

## 5. PPh 21 payroll

Payroll menghitung PPh 21 berdasarkan profil karyawan dan rule tervalidasi. Domain pajak menerima hasil per karyawan/periode untuk kewajiban, dokumen dan rekonsiliasi; tidak menghitung ulang net pay. Adjustment tertaut run asal. Ekspor Coretax PPh 21 belum termasuk lingkup dokumen 38 yang khusus pajak keluaran.

## 6. PPh Badan

PPh Badan memakai run tahunan wajib. Provision bulanan/triwulanan nonaktif pada awal dan hanya dapat diaktifkan melalui policy Finance/pajak. Sumber awal adalah laba sebelum pajak dari trial balance dan laporan laba rugi posted pada versi closing tertentu. Worksheet tidak mengubah transaksi sumber.

Worksheet sekurang-kurangnya memuat laba sebelum pajak, koreksi fiskal positif dan negatif per akun/dimensi, penghasilan final atau bukan objek bila relevan, kompensasi kerugian fiskal sesuai rule dan masa berlaku, penghasilan kena pajak, rule/tarif bertanggal efektif, estimasi pajak kini, kredit PPh tervalidasi, angsuran PPh, posisi kurang/lebih bayar, jurnal provision/true-up dan lampiran pendukung. Koreksi wajib mempunyai jenis, dasar, tanda, nominal, pembuat, reviewer dan bukti; perubahan menghasilkan versi baru.

Kredit pajak hanya dipakai setelah dokumen sumber dan bukti potong/pungut diverifikasi serta belum dialokasikan ke run lain. Sistem merekonsiliasi PPh dibayar di muka, utang pajak, beban pajak kini, pembayaran dan worksheet. Kerugian fiskal disimpan per tahun asal dengan nilai awal, pemakaian, sisa, masa berlaku dan rule snapshot; sistem tidak menerapkan masa kompensasi secara hardcoded.

Lifecycle run: **Draft → Calculated → Review → Approved → Posted → Finalized**, dengan **Reopened/Adjusted** melalui izin dan alasan. Calculated bukan angka resmi. Posting membentuk provision atau true-up setelah approval; Finalized mengunci snapshot dan lampiran. Pajak tangguhan menjadi fitur opsional setelah kebijakan temporary difference, materialitas dan akun disetujui. Sistem menyiapkan worksheet dan audit trail, tetapi keputusan pajak final tetap milik pihak berwenang.

## 7. Masa, rekonsiliasi dan Coretax

Masa pajak: **Open → Review → Ready → Filed/Closed**, dengan exception bila dokumen/saldo belum lengkap. Rekonsiliasi meliputi tax transaction, faktur keluaran/masukan, withholding, pembayaran dan akun GL. Status Filed hanya status administrasi berbukti; tanpa konfirmasi eksternal sistem tidak mengklaim diterima/disahkan.

Untuk pajak keluaran, proses aktif adalah pilih dokumen → validate → preview → generate XML → download → unggah manual → catat/unggah bukti hasil. Struktur dan mapping mengikuti [Coretax — Ekspor XML Pajak Keluaran](12-finance-administration.md). Status eksternal tidak dianggap Accepted tanpa bukti yang diverifikasi. Direct API submission serta parsing hasil terstruktur belum aktif dan tidak boleh mengubah jurnal posted tanpa koreksi resmi.

## 8. Navigasi

**Finance → Pajak**: Ringkasan Pajak; Profil & Aturan; Faktur Keluaran; Faktur Masukan; Bukti Potong; WAPU & Withholding; **PPh Badan**; Rekonsiliasi; Masa & Exception; **Coretax** (Pajak Keluaran, Validasi & Exception, Riwayat Batch XML, Upload Hasil).

## 9. Data, API dan akses

Entitas: `tax_profiles`, `tax_rules`, `party_tax_profiles`, `tax_transactions`, `tax_transaction_lines`, `tax_documents`, `tax_document_links`, `withholding_certificates`, `tax_periods`, `tax_reconciliations`, `tax_payments`, `tax_exceptions`, `corporate_tax_runs`, `fiscal_adjustments`, `corporate_tax_loss_carryforwards`, `corporate_tax_credit_allocations`, `corporate_tax_provisions`, `coretax_schema_versions`, `coretax_reference_codes`, `coretax_item_mappings`, `coretax_uom_mappings`, `tax_exchange_jobs`, `tax_exchange_job_documents`, `tax_exchange_errors` dan `tax_exchange_results`.

Endpoint: `/tax-profiles`, `/tax-rules`, `/party-tax-profiles`, `/tax-transactions`, `/tax-documents`, `/withholding-certificates`, `/tax-periods/{id}/validate|submit-review|close|reopen`, `/tax-reconciliations`, `/tax-payments`, `/tax-exceptions`, `/corporate-tax-runs`, `/fiscal-adjustments`, `/corporate-tax-loss-carryforwards`, `/corporate-tax-credit-allocations`, `/tax-exchange-jobs`, `/coretax-reference-codes`, `/coretax-item-mappings`, `/coretax-uom-mappings`. Command PPh Badan: `calculate`, `validate`, `submit-review`, `approve`, `post-provision`, `true-up`, `finalize`, `reopen`. Command Coretax: `validate`, `preview`, `generate`, `download`, `mark-uploaded`, `record-result`, `supersede`. Permission mengikuti dokumen 38; hak posting jurnal/pembayaran tetap terpisah.

## 10. Kriteria penerimaan

1. Rule pajak memiliki version dan effective date.
2. DPP, tarif, nilai dan snapshot rule dapat ditelusuri.
3. Faktur komersial dan faktur pajak lifecycle-nya terpisah.
4. PPN eligible/nonrecoverable dibedakan.
5. Withholding merekonsiliasi bruto, net transfer, AR/AP dan bukti.
6. Retur/koreksi menautkan dokumen pajak asal.
7. Subledger pajak cocok dengan GL sebelum masa ditutup.
8. Sistem tidak mengklaim approval eksternal tanpa bukti.
9. XML pajak keluaran mengikuti nama/urutan elemen template, mapping terversi, total kontrol dan audit file; direct API submission tidak diklaim aktif.
10. PPh Badan dapat ditelusuri dari laporan posted ke setiap koreksi fiskal, rule, kredit, provision dan jurnal.
11. Kredit pajak tidak dapat dialokasikan ganda dan hanya memakai bukti berstatus tervalidasi.
12. Perubahan trial balance atau koreksi fiskal setelah kalkulasi membuat run stale dan memerlukan kalkulasi serta review ulang.
13. Tarif, kompensasi kerugian dan pembulatan tidak di-hardcode; run menyimpan snapshot rule.
14. Finalisasi tahunan tidak mengubah jurnal sumber dan reopening memiliki izin, alasan serta audit.

## 11. Keputusan final dan release gate

Arsitektur rule, pemisahan WAPU, worksheet PPh Badan tahunan, status provision/pajak tangguhan awal serta alur Coretax sudah final. Status perpajakan, tarif/DPP, waktu terutang, eligibility, mapping akun, kalender pajak, XSD/katalog dan identitas perusahaan/pihak adalah konfigurasi resmi yang wajib diverifikasi sebelum Active. Direct API hanya dapat menjadi change request terpisah bila kontrak/kredensial tersedia.


---

## Bagian asal: 12-finance-administration.md

# Coretax — Ekspor XML Pajak Keluaran

Status: spesifikasi format file dan kontrol Gelombang C telah difinalkan berdasarkan `TaxInvoiceTemplate (2).xml` yang diberikan pengguna pada 25 September 2026. File sumber diperlakukan sebagai referensi struktur, bukan konfigurasi production. Nilai identitas dan contoh transaksi dari lampiran tidak disalin menjadi master perusahaan.

Referensi implementasi tanpa identitas/nilai contoh tersedia pada [template XML tersanitasi](references/coretax/tax-invoice-output-template.xml).

## 1. Lingkup

ERP menghasilkan file XML faktur pajak keluaran untuk diunggah pengguna ke Coretax. Lingkup aktif adalah pemilihan faktur, validasi data, preview, pembuatan file, hash/arsip, download dan pencatatan status unggah secara manual. Pengiriman langsung ke Coretax belum termasuk karena kredensial/API tidak tersedia. Impor hasil terstruktur belum diaktifkan sampai contoh file hasil diberikan; nomor/status resmi dapat dicatat atau dokumen resmi dapat diunggah melalui workflow verifikasi.

Template merujuk `TaxInvoice.xsd`, tetapi XSD belum tersedia. Generator wajib mengikuti urutan elemen pada template dan melakukan validasi struktur serta bisnis internal. XSD aktual, katalog resmi, identitas tervalidasi dan sedikitnya satu batch UAT berstatus Accepted merupakan release gate produksi.

## 2. Struktur XML

```text
TaxInvoiceBulk
├── TIN
└── ListOfTaxInvoice
    └── TaxInvoice [1..n]
        ├── TaxInvoiceDate
        ├── TaxInvoiceOpt
        ├── TrxCode
        ├── AddInfo
        ├── CustomDoc
        ├── RefDesc
        ├── FacilityStamp
        ├── SellerIDTKU
        ├── BuyerTin
        ├── BuyerDocument
        ├── BuyerCountry
        ├── BuyerDocumentNumber
        ├── BuyerName
        ├── BuyerAdress
        ├── BuyerEmail
        ├── BuyerIDTKU
        └── ListOfGoodService
            └── GoodService [1..n]
```

Nama `BuyerAdress` mengikuti ejaan dalam template dan tidak boleh dikoreksi menjadi `BuyerAddress` pada file ekspor tanpa perubahan schema resmi.

## 3. Mapping header dan pembeli

| Elemen XML | Sumber ERP | Aturan |
|---|---|---|
| `TIN` | profil pajak perusahaan | wajib; snapshot per export job |
| `TaxInvoiceDate` | tanggal faktur pajak | format `yyyy-MM-dd`; bukan otomatis tanggal download |
| `TaxInvoiceOpt` | jenis faktur pajak | default tidak di-hardcode; nilai harus berasal dari master/rule Coretax aktif, contoh template `Normal` |
| `TrxCode` | kode transaksi pajak | wajib dari rule transaksi bertanggal efektif, contoh template `01` |
| `AddInfo` | informasi tambahan | elemen tetap diterbitkan; kosong bila tidak berlaku |
| `CustomDoc` | dokumen pendukung khusus | elemen tetap diterbitkan; referensi sesuai rule |
| `RefDesc` | referensi/keterangan | dapat memuat nomor invoice komersial atau dokumen asal sesuai policy |
| `FacilityStamp` | fasilitas pajak | dari rule/fasilitas; kosong bila tidak berlaku |
| `SellerIDTKU` | ID TKU penjual | wajib dari profil perusahaan/lokasi usaha yang digunakan transaksi |
| `BuyerTin` | TIN/NPWP/NIK pembeli sesuai rule | tidak diambil bebas dari teks invoice; memakai profil pajak pelanggan tervalidasi |
| `BuyerDocument` | jenis identitas pembeli | kode referensi Coretax, contoh `TIN`; wajib konsisten dengan dokumen pembeli |
| `BuyerCountry` | negara pembeli | kode negara referensi, contoh `IND` |
| `BuyerDocumentNumber` | nomor dokumen alternatif | kondisional berdasarkan `BuyerDocument` |
| `BuyerName` | nama legal pembeli | snapshot dari profil pajak pelanggan |
| `BuyerAdress` | alamat pajak pembeli | snapshot alamat bertipe pajak/tagih sesuai rule |
| `BuyerEmail` | email pajak pembeli | validasi format bila diisi |
| `BuyerIDTKU` | ID TKU pembeli | kondisional sesuai profil dan rule transaksi |

## 4. Mapping barang/jasa

| Elemen XML | Sumber ERP | Aturan |
|---|---|---|
| `Opt` | opsi barang/jasa Coretax | dari mapping kategori/item bertanggal efektif; contoh template `A` |
| `Code` | kode barang/jasa Coretax | master terpisah dari SKU internal; ekspor ditahan bila belum dipetakan |
| `Name` | nama barang/jasa untuk pajak | snapshot baris invoice; tidak mengubah master produk |
| `Unit` | kode satuan Coretax | mapping UOM internal → kode Coretax, contoh `UM.0001` |
| `Price` | harga satuan sebelum pajak | desimal culture-invariant tanpa pemisah ribuan |
| `Qty` | jumlah pada satuan ekspor | harus konsisten dengan `Unit` dan snapshot konversi UOM |
| `TotalDiscount` | total diskon baris | tidak memasukkan retur/credit note yang sudah menjadi dokumen koreksi terpisah |
| `TaxBase` | DPP | dihitung backend dari rule dan sumber transaksi |
| `OtherTaxBase` | DPP nilai lain | mengikuti rule; tidak selalu sama dengan `TaxBase` |
| `VATRate` | tarif PPN | snapshot rule efektif; tidak di-hardcode |
| `VAT` | nilai PPN | dihitung dan direkonsiliasi terhadap tax transaction |
| `STLGRate` | tarif PPnBM | dari rule; nol bila memang tidak berlaku, bukan asumsi global |
| `STLG` | nilai PPnBM | dihitung dari basis sesuai rule |

Contoh template menunjukkan `Price × Qty − TotalDiscount = TaxBase`, tetapi hubungan tersebut tidak dijadikan rumus universal karena `OtherTaxBase`, fasilitas, pembulatan atau ketentuan lain dapat mengubah basis. Generator memakai tax transaction yang sudah dihitung dan menyimpan snapshot sumber.

## 5. Validasi sebelum file dibuat

1. Perusahaan mempunyai TIN dan Seller ID TKU aktif pada tanggal faktur.
2. Faktur berasal dari invoice/tax transaction posted, belum dibatalkan dan belum masuk export job aktif lain.
3. Profil pembeli, jenis/nomor dokumen, negara, nama dan alamat memenuhi rule transaksi.
4. Setiap item mempunyai mapping kode barang/jasa dan UOM Coretax yang berlaku.
5. Nilai qty, harga, diskon, DPP, tarif, PPN dan PPnBM memakai desimal nonnegatif sesuai rule dan total kontrol cocok dengan tax subledger.
6. Tanggal dan nilai ditulis culture-invariant; karakter XML di-escape; file UTF-8; urutan elemen sama dengan template.
7. Elemen kosong tetap diterbitkan bila struktur template memerlukannya.
8. Faktur pengganti/koreksi harus mempunyai referensi dokumen asal serta opsi/kode transaksi yang sesuai.
9. Satu export job hanya memakai satu profil perusahaan/schema version; campuran versi ditolak.
10. Setelah XSD tersedia, validasi XSD wajib lulus sebelum status `Ready`.

Error ditampilkan per faktur, baris dan field. Pengguna dapat mengeluarkan baris bermasalah dari batch atau memperbaiki master/sumber; generator tidak mengubah data transaksi secara diam-diam.

## 6. Lifecycle dan kontrol

Status export job: **Draft → Validating → Ready → Generated → Downloaded → Uploaded**, dengan hasil **Accepted / Partially Accepted / Rejected** setelah bukti/status eksternal diverifikasi. `Cancelled` hanya sebelum file diunggah; `Superseded` dipakai bila file pengganti dibuat. Status Uploaded/Accepted tidak ditetapkan hanya karena file sudah di-download.

Setiap job menyimpan pemilih, waktu, filter/periode, daftar tax document, schema/template version, profile/rule version, XML hash SHA-256, jumlah faktur/baris, total DPP/PPN/PPnBM, file privat, status, bukti unggah, hasil/verifikator dan audit. Generate ulang dengan input identik bersifat idempotent; perubahan input menghasilkan revision/job baru dan tidak menimpa file lama.

## 7. Navigasi dan layar

**Finance → Pajak → Coretax → Pajak Keluaran**

Halaman terdiri dari:

- Daftar Faktur Siap Ekspor;
- Validasi dan Exception;
- Riwayat Batch XML;
- Detail Batch dan Rekonsiliasi Total;
- Upload Bukti/Hasil;
- Arsip Dokumen Resmi.

Aksi: **Buat Batch**, **Validasi**, **Preview Mapping**, **Generate XML**, **Download**, **Tandai Sudah Diunggah**, **Catat/Upload Hasil**, **Buat Revisi**. Tombol mengikuti izin dan status.

## 8. Data, API dan izin

Entitas: `coretax_schema_versions`, `coretax_reference_codes`, `coretax_item_mappings`, `coretax_uom_mappings`, `tax_exchange_jobs`, `tax_exchange_job_documents`, `tax_exchange_errors`, `tax_exchange_results` dan attachment privat.

Endpoint:

- `POST /tax-exchange-jobs`;
- `POST /tax-exchange-jobs/{id}/validate`;
- `GET /tax-exchange-jobs/{id}/preview`;
- `POST /tax-exchange-jobs/{id}/generate`;
- `GET /tax-exchange-jobs/{id}/download`;
- `POST /tax-exchange-jobs/{id}/mark-uploaded`;
- `POST /tax-exchange-jobs/{id}/results`;
- `POST /tax-exchange-jobs/{id}/supersede`;
- CRUD bertanggal efektif untuk reference/item/UOM mapping.

Permission minimum: `tax.coretax.mapping.manage`, `tax.coretax.batch.create`, `tax.coretax.validate`, `tax.coretax.generate`, `tax.coretax.download`, `tax.coretax.result.verify`, `tax.coretax.read`. Mengelola mapping tidak otomatis memberi hak posting faktur atau verifikasi hasil.

## 9. Kriteria penerimaan

1. XML mengikuti root, hierarchy, nama dan urutan elemen template.
2. Satu batch dapat memuat beberapa `TaxInvoice` dan setiap faktur beberapa `GoodService`.
3. `BuyerAdress` dipertahankan sesuai schema template.
4. Tanggal, angka, encoding dan escaping XML konsisten lintas perangkat.
5. Semua identitas, mapping dan rule mempunyai tanggal efektif serta snapshot.
6. Total batch dapat direkonsiliasi ke tax documents dan GL tanpa mengubah jurnal.
7. Faktur yang sama tidak masuk dua batch aktif tanpa proses supersede/koreksi.
8. File, hash, pengguna, waktu download/upload dan hasil eksternal dapat diaudit.
9. Sistem tidak mengklaim Accepted tanpa bukti atau hasil yang diverifikasi.
10. Sebelum produksi resmi, XSD aktual dan minimal satu file uji yang diterima Coretax wajib menjadi evidence UAT.

## 10. Release gate dan evidence eksternal

- file `TaxInvoice.xsd` aktual;
- katalog kode resmi untuk `TaxInvoiceOpt`, `TrxCode`, `BuyerDocument`, negara, `Opt`, barang/jasa dan UOM;
- contoh hasil Accepted/Rejected dari Coretax;
- rule aktif untuk faktur pengganti, retur dan pembatalan yang menautkan dokumen asal;
- TIN/ID TKU perusahaan yang telah diverifikasi dan tidak berasal dari data contoh;
- batas jumlah faktur/ukuran file per upload bila diberlakukan Coretax.

Daftar ini bukan keputusan blueprint terbuka. Generate production ditahan sampai data/evidence yang relevan tersedia dan diverifikasi.
