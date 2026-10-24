# Konsolidasi pengaturan dan alur SO sampai pembayaran — desain 24 Oktober 2026

Status: draf untuk persetujuan pengguna. Melanjutkan [desain arah fleksibel](2026-10-24-erp-fleksibel-design.md) dan hasil tahap 2 ([rencana](../plans/2026-10-24-pengaturan-terpusat.md), [bukti](../../development/setting-hub-2026-10-24.md)).

## 1. Maksud dan alasan

Setelah halaman Setting tahap 2 tampil, pengguna melihat dua masalah:

1. **Tumpang tindih.** Satu halaman lama (`/operations/controls`) dibuka dari beberapa menu di modul berbeda; kredit ada di tiga tempat, pajak di dua tempat, identitas perusahaan punya dua sumber.
2. **Pengaturan terlalu spesifik.** Aturan dibuat per pasangan, bukan umum. Contoh paling jelas: aturan pajak penjualan (`SalesTaxRule`) wajib dibuat per pelanggan × produk, dan aturan WAPU/PPh (`ReceiptTaxRule`) per pelanggan. SO tertahan bila satu pasangan belum punya aturan.

Pengguna menjual juga ke RS Pemerintah (pemungut pajak), menerima bukti potong, dan memakai format nomor `Nama Dokumen-SSM.Tahun.Bulan.Nomor urut`.

## 2. Tujuan

1. **Satu menu, satu rumah.** Setiap menu ada di tepat satu modul; menu yang salah tempat dihapus, bukan digandakan.
2. **Pengaturan umum, bukan per pasangan.** Tiga lapis: (a) pengaturan umum di Setting, (b) atribut sederhana di master data hanya bila memang berbeda, (c) nilai di dokumen terisi otomatis dan dapat diganti pengguna berizin.
3. Alur SO → invoice → pembayaran memakai pengaturan umum itu: harga otomatis dengan batas diskon, pajak dari bawaan, kode faktur, potongan dan bukti potong.
4. Memperbaiki enam temuan penting review tahap 2.

## 3. Bukan tujuan

- Modul persetujuan umum (mesin, struktur organisasi) — tetap tahap 4. Tahap ini hanya menyiapkan tempat persetujuan harga khusus di Sales.
- Multi-mata uang, aplikasi Field, laporan pajak/Coretax lengkap.

## 4. Anti-tujuan

- Menu atau pengaturan yang sama muncul di dua modul.
- Aturan baru per pelanggan × produk atau per pelanggan × jenis pajak.
- Invoice dianggap lunas padahal bukti potong yang wajib belum diterima.
- Diskon di atas batas lolos karena hanya dicegah di layar.
- Nomor dokumen ganda atau urutan mulai dari 1 karena format diubah.

## 5. Keputusan pengguna (24 Oktober 2026)

### 5.1 Penempatan menu

Semua yang bersifat **pengaturan** di Setting; modul lain hanya **transaksi dan data kerja**.

| Modul | Isi |
|---|---|
| Setting | Profil Perusahaan · Pengguna · Peran (termasuk batas diskon) · Kebijakan Umum · Penomoran Dokumen · Pajak · Termin & Kredit · Jenis Potongan · Pemetaan Akun · Persetujuan (tahap 4) |
| Master Data | Produk (harga jual umum, batas diskon produk) · Pelanggan (termin bawaan, kode faktur bawaan) · Supplier · Vendor · Gudang · Item Operasional |
| Sales & Marketing | CRM · Penawaran & Harga › Harga Khusus (pengajuan + persetujuan) · Pesanan Pelanggan (SO, Proforma, Backorder) |
| Warehouse & Logistik | Barang Keluar · Persediaan (stok, kelayakan stok) |
| Finance | Piutang (Invoice, Terima Pembayaran, bukti potong) · Kas & Bank · Akuntansi (Daftar Akun, Jurnal) · Faktur Pajak (Keluaran, Masukan) |

Dihapus/dipindah: halaman `/operations/controls` dihapus (kredit → Setting › Termin & Kredit, aturan pajak → Setting › Pajak, kelayakan stok → Warehouse › Persediaan, persetujuan menunggu tahap 4); Finance › Kredit & TOP Pelanggan dihapus; Finance › Pajak › Daftar & Aturan Pajak → Setting › Pajak; Finance › Akuntansi › Pengaturan Jurnal Otomatis → Setting › Pemetaan Akun; Kebijakan Operasional menjadi Kebijakan Umum dan tidak lagi memuat termin/ongkir/kredit.

### 5.2 Persetujuan di tempat dokumen

Tombol Setujui/Tolak ada di halaman dokumen yang diajukan. Pengaturan umumnya (siapa, berapa tingkat, kondisi) di Setting. Notifikasi dan daftar Tugas & Persetujuan di Dashboard hanya berisi tautan ke dokumen. Tahap ini menerapkannya pada Harga Khusus; mesin umum di tahap 4.

### 5.3 Pajak

- Daftar pajak (master `OperationalTax` yang sudah ada) pindah ke Setting › Pajak. Satu pajak ditandai **pajak penjualan bawaan** (PPN 11%) dan satu **pajak pembelian bawaan**.
- Semua produk kena PPN dan setiap invoice memuat PPN (keputusan pengguna). Tidak ada tanda produk "tidak kena PPN" dan tidak ada pilihan pajak per baris; baris SO/proforma/invoice memakai pajak penjualan bawaan. Dokumen menyimpan snapshot tarif, faktor DPP dan akun, sehingga perubahan tarif di Setting hanya berlaku untuk dokumen baru.
- Aturan per pelanggan × produk (`SalesTaxRule`) dihentikan; data lama dimigrasikan/diarsipkan, tidak dipakai lagi oleh SO.
- **Kode transaksi faktur** di invoice: bawaan `01`; pelanggan boleh punya kode bawaan (mis. RS Pemerintah `03`) yang terisi otomatis dan dapat diganti.

### 5.4 Potongan dan bukti potong saat pembayaran

- Setting › Jenis Potongan: nama (PPN dipungut, PPh 22, PPh 23, biaya transfer, …), akun bawaan, dan centang **wajib bukti potong untuk pelunasan**.
- Terima Pembayaran: nilai uang masuk + baris potongan (jenis, nilai, akun dapat diganti, nomor/tanggal/file bukti).
- Potongan yang wajib bukti tetapi buktinya belum ada: nilai itu tetap terbuka sebagai piutang di invoice dengan status **Menunggu bukti potong** dan tampil di daftar tagihan. Nilai ini **dihitung dalam limit kredit (exposure) pelanggan** agar pelanggan dan tim internal disiplin mengejar bukti (keputusan pengguna). Tidak ada reklasifikasi otomatis berdasarkan umur. Saat bukti diunggah, nilai itu diselesaikan ke akun yang ditentukan jenis potongannya dan invoice menjadi Lunas.
- Aturan WAPU/PPh per pelanggan (`ReceiptTaxRule`) dihentikan.

### 5.5 Harga dan diskon

- Harga yang muncul saat memilih produk: **harga khusus pelanggan** bila ada yang disetujui dan berlaku, selain itu **harga jual umum** produk.
- Harga khusus diajukan dan disetujui di Sales & Marketing › Penawaran & Harga › Harga Khusus; setelah disetujui berlaku otomatis di SO.
- Harga dapat diganti langsung di SO (harga atau diskon).
- Batas diskon: per peran (diatur di Peran; bila beberapa peran, ambil tertinggi), per orang (opsional, menggantikan batas peran), per produk (opsional, plafon). **Batas berlaku = yang terkecil** antara batas orang dan batas produk. Tanpa batas yang diisi, diskon tidak diizinkan kecuali ada nilai bawaan perusahaan. Admin Sistem tanpa batas.
- Diskon dihitung dari harga yang muncul otomatis. Melebihi batas: tidak dapat disimpan/diajukan, dengan pesan jelas; diperiksa backend. Tidak ada jalur persetujuan untuk melewati batas.

### 5.6 Format nomor dokumen

`Prefix.FormatTahun.FormatBulan.NomorUrut`, contoh `SO-SSM.2026.10.0001`.

- Isian per jenis dokumen: prefix (bebas, termasuk kode perusahaan), format tahun (`YYYY` atau `YY`), format bulan (`MM`), panjang nomor urut, dan toggle reset **bulanan** atau **tahunan**.
- Perubahan prefix/format/panjang berlaku langsung dan urutan berlanjut. Panjang nomor urut tidak boleh lebih kecil dari urutan yang sedang berjalan (ditolak dengan pesan).
- **Perubahan mode reset berlaku mulai periode berikutnya** (awal bulan atau tahun depan) agar tidak ada nomor ganda.

### 5.7 Identitas perusahaan

Zona waktu, awal tahun buku dan mata uang disimpan hanya pada data perusahaan dan diedit di Setting › Kebijakan Umum; kebijakan duplikat (`OPS-COMP-01..03`) dihentikan.

### 5.8 Keputusan pembangun (usulan, mohon dicek pengguna)

- **Limit kredit, freeze dan toleransi jatuh tempo** menjadi atribut pelanggan di Master Data › Pelanggan (lapis 2), dapat diedit hanya oleh pemegang izin kredit pelanggan. Setting › Termin & Kredit hanya memuat daftar termin dan mode kredit. `CustomerPaymentPolicy` digantikan atribut ini.
- **PPN dimodelkan sebagai tarif × faktor DPP** (`OperationalTax` mendapat faktor DPP). Bawaan PPN penjualan: 12% × DPP Nilai Lain 11/12 (efektif 11%) sesuai ketentuan yang berlaku untuk faktur Coretax; faktor dapat diedit. Mohon konfirmasi dengan konsultan pajak.
- **PPN dipungut (WAPU)** diselesaikan ke akun PPN Keluaran, bukan ke piutang biasa; buktinya SSP/NTPN, bukan bukti potong. Karena itu Jenis Potongan punya isian **jenis bukti** (bukti potong / SSP-NTPN) dan **diselesaikan ke** (akun pilihan). PPh 22/23 diselesaikan ke akun pajak dibayar di muka dengan bukti potong.
- **Persetujuan Harga Khusus sebelum mesin tahap 4:** izin sendiri `special_price.approve` di Sales & Marketing; pemohon tidak boleh menyetujui pengajuannya sendiri (Admin Sistem tercatat di audit bila memutus). Cakupan: pelanggan × produk × satuan, tanggal berlaku mulai/akhir; tanpa harga bertingkat per qty atau kelompok pelanggan.
- **Pajak dari bawaan masuk tahap 2b**, bukan tahap 3, agar SO tidak pernah tertahan aturan per pelanggan × produk di antara kedua tahap. `ReceiptTaxRule` tetap berjalan sampai Terima Pembayaran baru (tahap 3) menggantikannya; menunya sudah tidak tampil sejak 2b.
- **Rumus diskon:** batas dalam persen per baris. Mengganti harga satuan di bawah harga otomatis dihitung sebagai diskon terhadap harga otomatis. Batas orang (bila ada) menggantikan batas tertinggi dari perannya; nilai bawaan perusahaan dipakai hanya bila orang dan perannya tidak punya batas; lalu diambil yang terkecil dengan batas produk. Harga di proforma/invoice mengikuti SO dan tidak diedit di sana.

## 6. Temuan review tahap 2 yang ikut diselesaikan

1. Ubah reset tidak lagi memulai urutan dari 1 (5.6).
2. Panjang nomor urut di bawah urutan berjalan ditolak (5.6).
3. Halaman Profil dan Kebijakan mengunci versi saat mulai mengedit agar simpan basi mendapat 412.
4. Pesan error konfigurasi menampilkan tautan ke halaman Setting yang tepat; kode mentah lain (`DOCUMENT_NUMBER_EXHAUSTED`, `POSTING_PROFILE_REQUIRED_OR_CONFLICTING`, `IDEMPOTENCY_PAYLOAD_MISMATCH`) diterjemahkan.
5. Setiap submenu Setting punya izin sendiri dan ditegakkan backend per kelompok pengaturan (tidak lagi satu `operational_policy.update` untuk semua).
6. Format angka dapat diedit di Kebijakan Umum; `OPS-FLX-05` dipakai saat membuat aturan penomoran baru atau dihapus.

Temuan minor dicatat di ledger tahap 2 dan dikerjakan bila menyentuh bagian yang sama.

## 7. Pembagian tahap

| Tahap | Isi |
|---|---|
| Dokumen | Perbarui README, 02, 06, 07, 10, 12, 14, 15, 40, AGENTS.md sesuai bagian 5 |
| 2b — Konsolidasi Pengaturan | 5.1 (menu), 5.3 (Setting › Pajak, pajak bawaan dipakai SO/proforma/invoice), 5.4 bagian pengaturan (Jenis Potongan), Pemetaan Akun, Termin & Kredit, Kebijakan Umum, 5.5 batas diskon (peran/orang/produk), 5.6, 5.7, bagian 6 |
| 3 — Alur SO sampai pembayaran | Harga otomatis dan pemeriksaan diskon di SO, kode faktur, Harga Khusus (pengajuan + persetujuan di Sales), termin di SO, ongkir, mode kredit, potongan dan bukti potong di Terima Pembayaran, retur |

Setiap tahap mendapat rencana implementasi sendiri dan diuji di route operasional dengan sesi dan izin nyata.

## 8. Diserahkan kepada pembangun

- Bentuk tabel untuk jenis potongan, baris potongan, batas diskon, harga khusus, kode faktur, dan format nomor (pola policy bertanggal efektif, audit, idempotency yang sudah ada).
- Cara migrasi/arsip `SalesTaxRule`, `ReceiptTaxRule`, `CustomerPaymentPolicy` lama pada database development (production belum ada).
- Kode izin baru per submenu Setting dan pemetaannya ke matriks.
