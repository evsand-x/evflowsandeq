# Design — web kantor dan aplikasi mobile sales/gudang

## Keputusan 30 Oktober 2026 - penerimaan SJ terpisah

Tombol Terbitkan Surat Jalan menjalankan penerbitan langsung. Tidak ada modal bukti/checkbox penerimaan pada aksi itu. Detail ISSUED menampilkan tombol Penerimaan Barang bagi fulfillment.dispatch selama belum ada receipt/histori handover, serta ringkasan penerimaan. Dialog Penerimaan Barang memuat waktu, nama, jabatan opsional, jumlah diterima, alasan selisih dan bukti; tombol Simpan penerimaan. Tampilkan error/pending, fokus dan Escape sesuai komponen global; sesudah berhasil perbarui detail/list. Selisih tidak diklaim otomatis kembali ke stok.

SJ terbit memposting seluruh jumlah draft, stok, pendapatan dan HPP serta langsung menjadi sumber Invoice. Penerimaan pelanggan dicatat terpisah setelah terbit dan tidak menjadi prasyarat posting atau Invoice. Catatan penerimaan tidak mengubah saldo, jumlah terbit, progres SO maupun jatuh tempo. Selisih ditindaklanjuti melalui koreksi/retur tersendiri. Bukti serah terima historis tetap dipertahankan.


## Detail SO dan uang muka — Bagian 2, 26 Oktober 2026

Detail SO satu halaman: kepala nomor/status/navigasi/Cetak/tindakan utama/Aksi/menu lainnya; atribut faktur; tabel barang bersisa di atas; kuantitas, subtotal, PPN, total dan sisa tagihan; panel uang muka; Transaksi; jejak perubahan/cetak. Tidak ada tab detail lama atau Bagikan/WhatsApp. Tindakan tanpa izin tidak dikirim, hambatan alur beralasan. Cetak menggunakan Profil Perusahaan dan audit sebelum dialog cetak. QA visual operasional belum lulus; lihat laporan eksekusi.

## Kesiapan backend SO mudah — 25 Oktober 2026

Arah layar mengikuti desain SO mudah 25 Oktober. Backend telah menyediakan kolom daftar dan status tunggal, opsi kepala form dan informasi stok per gudang. Tahap backend ini mempertahankan field lama agar Office berjalan; tidak menyatakan form faktur baru, tab status, tombol atau kartu Setting khusus sudah diterapkan/diverifikasi visual. UI harus memakai data/status/hitungan dari backend, bukan menyimpulkan ulang status dari invoice atau pembayaran.


## Keputusan 24 Oktober 2026 — konsolidasi

Mengikuti [desain konsolidasi](../superpowers/specs/2026-10-24-konsolidasi-pengaturan-design.md). Navigasi: setiap menu di satu modul; Setting berisi Profil Perusahaan, Pengguna, Peran, Kebijakan Umum, Penomoran Dokumen, Pajak, Termin & Kredit, Jenis Potongan, Pemetaan Akun. Form SO menampilkan "Diskon maks. untuk Anda" per baris. Form Terima Pembayaran memuat tabel Potongan. Dialog penomoran memuat prefix, format tahun, format bulan, panjang urut dan toggle reset bulanan/tahunan dengan pratinjau. Tombol persetujuan tampil di halaman dokumen.


## Keputusan 24 Oktober 2026 — kemudahan pakai

Mengikuti register README dan [desain arah fleksibel](../superpowers/specs/2026-10-24-erp-fleksibel-design.md). Prinsip layar Office:

- isian wajib minimal dan bertanda jelas; isian lain terisi nilai bawaan;
- label bahasa bisnis, bukan kode atau istilah teknis;
- buat cepat pelanggan/produk dari dropdown bagi pengguna berizin;
- bantuan singkat pada isian yang jarang dipahami;
- draft tidak hilang saat berpindah halaman;
- pesan error menjelaskan cara memperbaiki dan menautkan ke halaman Setting terkait;
- menu dan submenu yang belum berfungsi tidak tampil.

Form SO: pelanggan, tanggal, barang, jumlah dan harga wajib; termin terisi dari pelanggan bila ada dan dapat diganti. Bagian total memuat Subtotal, Diskon, Ongkos kirim (Ditanggung perusahaan atau Dibebankan ke pelanggan dengan Sebelum PPN/Sesudah PPN), PPN dan Total. Mode kredit Peringatan tampil sebagai banner tanpa menahan simpan/ajukan; mode Blokir menampilkan tombol Ajukan Pengecualian.

Setting dibuka sebagai satu halaman Pengaturan terpusat dengan kelompok Perusahaan, Pengguna & Akses, Struktur Organisasi, Penjualan (termin, ongkir, kredit), Dokumen (penomoran, template) dan Persetujuan. Halaman Peran memakai matriks menu × tindakan dengan cakupan data, Pilih Semua per modul/kolom dan Salin dari peran lain.

## Submenu Akun dan migrasi master — 16 Oktober 2026

Label submenu operasional adalah **Akun**, route /operations/accounts, /new, /:id dan /:id/edit. Sidebar membuka Akuntansi pada seluruh route tersebut. Tabel: Kode Akun, Nama Akun, Kategori, Tipe, Saldo Normal, Status, Tindakan; pencarian, kelompok dan status, pagination 25. Form Identitas serta Klasifikasi dan struktur memakai standar desain global web. Field terkunci menampilkan alasan pemakaian. Detail memuat atribut, referensi dan audit; tidak ada saldo nominal pada master.

### Penyempurnaan master pajak — 16 Oktober 2026

Kolom master terbaru: Nama Pajak, Jenis Pajak, Penggunaan, Akun Pajak, Tarif (%), Perlakuan Transaksi, Status. Gunakan label PPh, Ditambahkan/Dipotong dan nama pembulatan yang mudah dibaca. Popup akun menampilkan kode, nama serta kelompok Aset/Kewajiban/Ekuitas/Pendapatan/Beban; akun nonaktif lama tetap terbaca.

## Pembaruan pajak operasional — 16 Oktober 2026

Navigasi aktif Finance → Pajak tepat tiga submenu: Daftar & Aturan Pajak (`/operations/tax-rules`), Faktur Keluaran (`/operations/tax-documents`), Faktur Masukan (`/operations/tax-input`). Daftar master memuat Nama Pajak, Jenis, Akun Pajak, Nilai %, Perhitungan, Status; tersedia Buat, Detail, Edit. Faktur menampilkan nomor transaksi, pihak, pajak, total, status dan metadata resmi. Masing-masing submenu mempunyai izin sendiri; tidak berbagi izin induk. Menggunakan shell dan standar global web, TanStack Query/Table, SelectionField dan Sonner. Navigasi pajak luas/Coretax pada bagian historis ditunda.


Keputusan terbaru 16 Oktober 2026 (IAM-01/04): setiap submenu operasional memiliki checkbox izin sendiri per tindakan, dengan grant anak yang independen. Dilarang menggandakan checkbox ber-ID grant sama sebagai pengaturan beberapa submenu. Induk hanya mengelompokkan navigasi; Pilih Semua mengubah masing-masing grant anak. Halaman operasional pada induk, jika ada, memiliki izin sendiri yang tidak memberi akses anak. Ketentuan ini menggantikan pemetaan bersama CRM/Master Data sebelumnya. Implementasi yang masih berlabel “Izin bersama” adalah utang migrasi dan belum memenuhi desain akhir; jangan mengklaimnya independen sebelum backend dipisahkan. Kolom Ubah dan Hapus tidak selalu berarti tindakan pada draf. Capability yang belum tersedia tetap memakai status eksplisit, bukan checkbox semu.

Koreksi label matriks 16 Oktober 2026: checkbox kosong berarti izin yang dapat diatur belum diberikan; checkbox tercentang berarti diizinkan. Sel tanpa capability memakai “Belum tersedia” jika izin belum tersedia/dipetakan, atau “Tidak berlaku” jika tindakan memang tidak relevan. Jangan menyamakan capability yang belum dibangun dengan tindakan yang tidak berlaku atau menampilkan tanda strip yang ambigu.

Matriks hak akses mengikuti seluruh hierarki menu Office. Setiap tampilan Dashboard yang operasional memiliki checkbox Lihat yang dapat diubah Admin Sistem pada peran biasa; Admin Sistem sendiri tercentang otomatis dan tidak dibatasi. Menu yang belum operasional tetap terlihat dengan label Belum dapat diatur. Peran biasa lama yang grantnya kosong tetap dapat diberi izin melalui matriks.

## Koreksi Office 7 Oktober 2026 — proforma manual

Detail SO, bagian Pemenuhan & dokumen terkait: tiap tahap ALLOCATED pada SO Open
menyediakan Tinjau & Terbitkan Proforma bagi pengguna berizin. Dialog menampilkan
produk/qty teralokasi, subtotal/pajak/total server, muat ulang, dan Terbitkan Proforma.
Dokumen yang sudah sesuai ditampilkan sebagai Buka nomor dokumen. Error tetap di
dialog; ketika loading/pending tindakan penerbitan dinonaktifkan. Sukses menuju detail
proforma. Dokumen lama/sumber berubah menampilkan status dan tidak menyediakan tombol
cetak sebagai dokumen aktif. Tabel detail tetap dapat dibaca untuk histori.

## Acuan visual yang berlaku — 29 September 2026

Hasil review Dashboard dan koreksi pengguna kini ditetapkan sebagai [standar desain global web](../mockup/web-design-standard.md). Standar tersebut mengatur pola bersama lintas halaman dan mengungguli detail visual lama/mockup pada bagian yang secara eksplisit direvisi pengguna. Komposisi layar dan aturan bisnis tetap mengikuti sumber masing-masing.

Keputusan 7 Oktober 2026 mencabut kewajiban mengikuti file desain lama dan skill desain tambahan. Gunakan panduan implementasi web, standar global yang masih berlaku, serta blueprint untuk fungsi dan invariant. Fokus Office operasional; Field ditunda.

## 1. Tujuan desain

Preferensi pengguna: halaman **bersih, tidak banyak deskripsi tambahan**. Utamakan judul singkat, label isian, data dan tombol tindakan. Hindari paragraf penjelasan, subtitle berulang, kartu panduan dan helper text permanen pada setiap field. Rincian aturan dalam blueprint merupakan acuan implementasi, bukan teks yang harus ditampilkan seluruhnya di halaman.

Gunakan kelompok field dengan heading pendek dan tata letak konsisten. Bantuan tambahan tersedia melalui ikon bantuan yang dapat diakses dengan sentuh/keyboard atau panel bantuan yang dibuka pengguna. Tampilkan validasi, alasan tindakan tertahan, status belum tersimpan serta konfirmasi dampak transaksi hanya pada konteks yang relevan. Label wajib, format yang diperlukan dan pesan kesalahan tetap jelas; placeholder tidak menggantikan label. Form pelanggan menerapkan prinsip ini pada seluruh 17 atribut.

Setiap layar membantu staf menjawab: apa yang perlu dikerjakan, mengapa tertahan, siapa penanggung jawabnya, dan dokumen apa yang mendukung angka ini. Istilah teknis seperti tabel database, event outbox dan API tidak masuk alur kerja staf.

Semua label field, status, pilihan, kolom dan pesan mengikuti [Kamus Label Manusia dan Bahasa Layar](07-design.md). Kunci teknis, kode `OPS-*`, enum, nama kolom, `Mode`, `Value`, `percent`, `null`, `true/false`, dan nama endpoint hanya boleh berada di **Detail teknis** untuk admin/audit. Setiap angka harus menampilkan satuan dan arti bisnisnya; contoh `0` harus ditulis sebagai **0% (tidak ada kelonggaran)** bila konteksnya toleransi.

Nama aplikasi final pada tampilan adalah **evflow**. Gunakan penulisan tersebut pada web kantor, aplikasi Android/iOS, halaman autentikasi, metadata aplikasi dan komunikasi sistem. Nama perusahaan awal **PT Sandeq Sarana Medika** berasal dari **Setting → Profil Perusahaan** dan dapat diubah langsung oleh pengguna berizin. Bahasa Indonesia; tanggal dan IDR sesuai locale, business timezone dikonfirmasi. Nomor dokumen mengikuti konfigurasi perusahaan, bukan ID teknis UUID.

## 2. Navigasi

Keputusan mobile final: aplikasi HP memakai Nuxt/Vue + Capacitor, minimum Android 10 dan iOS 15, dengan menu sales/gudang berdasarkan hak akses. PWA/browser menjadi kanal tambahan. Uji navigasi, kamera, check-in dengan OPS-VIS aktif (nilai awal radius 200 meter dan tracking 5/15 menit), tombol kembali Android dan perilaku iOS pada perangkat nyata.

Navigasi kantor menggunakan tujuh modul utama berikut. Setiap tingkat ditampilkan sebagai modul → kelompok submenu → layar/aksi. Layar yang tidak diizinkan tidak ditampilkan; tautan lintas modul membuka data sumber dalam mode sesuai izin.

### Dashboard

- Ringkasan Eksekutif
- Sales
- Warehouse & Logistik
- Finance
- HRIS
- Tugas & Persetujuan
- Laporan & Ekspor

Dashboard adalah projection dan entry point utama. Kartu, tab, filter, drill-down dan ekspor bersifat read-only; penyelesaian tugas selalu membuka command pada modul pemilik.

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Tugas & Persetujuan tersedia pada `/?view=actions`, Laporan & Ekspor pada `/?view=reports`, dengan preview padanan `/preview/dashboard?view=actions|reports`. Komposisi historis tercatat; ukuran bersama memakai Ringkasan Eksekutif (panel kanan 320px). Tugas memiliki tiga KPI sesuai frame dan kontrol bulan tambahan untuk periode read model; Laporan memakai parameter tanggal di panel, tanpa menambah KPI. Tab, cari, filter, pilihan baris/laporan dan feedback telah dibangun; aksi yang bergantung layanan belum tersedia tidak mengklaim berhasil. [Cakupan dan batas](../mockup/dashboard-actions-reports-build.md).

Dashboard Warehouse web tahap ini pada implementasi historis: empat KPI, Antrean operasional, dan Perhatian persediaan. Route `/?view=warehouse` serta preview `/preview/dashboard?view=warehouse`. Tombol periode membuka bulan dan pilihan gudang; filter tabel memilih tahap. Ukuran/spacing memakai Ringkasan Eksekutif. Sumber operasional belum tersedia ditandai jelas; rincian fixture hanya preview. Cakupan izin/backend dan batas fitur ada pada [catatan pembangunan](../mockup/dashboard-warehouse-build.md).

Arahan visual Dashboard web yang disetujui: sidebar tetap dengan mode ikon, topbar perusahaan/profil, sambutan ringkas, kartu ringkasan utama dan dua kartu samping terpisah, lalu tabel riwayat. Palet terang memakai primer `#064A9D`, halaman `#EEF5FC`, sidebar `#F4F8FD`, kartu `#FFFFFF`, border `#CAD9E8`, teks `#0A1628` dan teks sekunder `#53657A`. Kontrol bersudut sekitar 4 px, kartu 4–6 px, spacing basis 4 px, antarbagian 16 px, dan shadow minimal. Badge status memakai latar pastel dengan teks status. Contoh data harus ditandai simulasi; indikator tren hanya tampil bila periode pembanding nyata tersedia. Pada 360 px, navigasi masuk panel mobile dan tabel lebar melakukan scroll di areanya sendiri.

### Sales & Marketing

1. **CRM**
   - Prospek
     - Detail profil pendekatan, Kebutuhan produk, peluang dan pipeline bulanan, status serta riwayat
     - Buat/revisi peluang dan kebutuhan produk dari detail prospek sesuai izin
   - Kontak
   - Pelanggan sebagai tautan ke Master Pelanggan, dengan riwayat interaksi sales sesuai izin
2. **Aktivitas Sales**
   - Rencana & Kunjungan
   - Follow-up & Pengingat
   - Riwayat Aktivitas
3. **Penawaran & Harga**
   - Penawaran
   - Pengajuan Harga/Diskon
   - Price List: Standar, Channel, Pelanggan, Kontrak/Tender
4. **Sampel & Trial**
   - Pengajuan Sampel
   - Pemantauan Sampel
   - Hasil Trial & Tindak Lanjut
5. **Pesanan Pelanggan**
   - Sales Order
   - Proforma
   - Backorder & Sisa Pesanan
   - Pengajuan Unlock pada detail SO yang tertahan

   Nomor, tanggal, file dan verifikasi SP/PO Pelanggan dicatat sebagai **referensi sumber** pada SO atau Penawaran; SP/PO Pelanggan bukan menu transaksi internal tersendiri.
6. **Target & Estimasi**
   - A/T Penjualan
   - Estimasi Penjualan
   - Target Kunjungan
   - Komisi

Kelompok di atas adalah struktur navigasi, bukan tahapan wajib yang harus dilalui berurutan. Kontak menggunakan data bersama dan Master Pelanggan tetap menjadi sumber identitas; tindakan pada pelanggan di CRM tidak membuat master kedua. Kebutuhan produk adalah baris pada prospek/peluang, sedangkan pengajuan unlock dan tutup sisa adalah tindakan berizin pada SO. Pengeluaran sampel, picking dan pengiriman tetap diproses Warehouse & Logistik; invoice, pembayaran dan posting tetap di Finance. Tampilan stok, kredit dan status penagihan pada layar sales mengikuti izin dan membuka rincian modul pemilik.

### Warehouse & Logistik

1. **Pengadaan**
   - Kebutuhan Persediaan
   - PR
   - Perencanaan Pembelian
   - PO Supplier
   - PO Vendor
   - Persetujuan PR/PO
2. **Barang Masuk (Inbound)**
   - Monitoring Pengiriman Supplier
   - Penerimaan/GR
   - Service Acceptance
   - Kualitas & Suhu
3. **Barang Keluar (Outbound)**
   - Picking
   - Checking/Packing
   - Pengiriman
   - POD
   - Retur
4. **Persediaan**
   - Stok & Locator
   - Opname
   - Batch/Expiry
   - Karantina
   - Konsinyasi
   - Recall
   - Pemusnahan

### Finance

Dashboard Finance web pada implementasi historis: empat KPI, Antrean finance dan Kesiapan closing; route `/?view=finance`, preview `/preview/dashboard?view=finance`. Kontrol periode dan filter proses mengikuti standar global. Nilai/state tanpa sumber ditandai belum tersedia; contoh nominal dan status hanya preview. Lihat [cakupan pembangunan Finance](../mockup/dashboard-finance-build.md).

1. **Piutang (AR)**
   - Invoice
   - Kartu Piutang, Aging, Tagihan
   - A/T Tagihan, Estimasi Penagihan
   - Saldo dan alokasi uang muka pelanggan pada detail pelanggan/invoice; tidak ada menu uang muka tersendiri
2. **Kredit & TOP Pelanggan** — dihapus 24 Oktober 2026 (konsolidasi); limit/freeze/toleransi pindah ke Master Data › Pelanggan, termin dan mode kredit ke Setting › Termin & Kredit
   - Daftar fasilitas per pelanggan
   - Penetapan atau perubahan mode COD/Prepay/Tempo, TOP, limit kredit, tanggal efektif dan toleransi
   - Evaluasi Finance, histori versi, bukti, approval, freeze dan unlock
3. **Utang (AP)**
   - Kartu Utang, Tagihan Supplier, Tagihan Vendor
   - GRNI, Tukar Faktur
   - Saldo dan alokasi uang muka supplier/vendor pada detail pihak/tagihan; tidak ada menu uang muka tersendiri
4. **Kas & Bank**
   - Rekening & Kas, Penerimaan, Pembayaran, Transfer
   - Kas Kecil, Mutasi, Rekonsiliasi, Dana Belum Teridentifikasi
5. **Akuntansi**
   - Chart of Accounts, Jurnal Otomatis, Jurnal Manual
   - HPP & Penilaian Persediaan, Landed Cost, Rekonsiliasi Persediaan
6. **Pajak**
   - Ringkasan, Profil/Aturan, Faktur Keluaran, Faktur Masukan, Bukti Potong
   - WAPU/Withholding, PPh Badan, Rekonsiliasi, Masa/Exception
   - Coretax: Pajak Keluaran, Validasi/Exception, Riwayat Batch XML, Upload Hasil
7. **Closing**
   - Checklist, Rekonsiliasi, Review, Sign-off, Reopen
8. **Aset**
   - Aset dalam Proses, Register, Kapitalisasi, Penyusutan
   - Mutasi/Serah Terima, Perawatan, Opname, Impairment/Pelepasan, Rekonsiliasi, Laporan
9. **Anggaran**
   - Penyusunan, Review, Budget Check, Komitmen, Transfer/Revisi, Budget vs Actual
10. **Biaya & Klaim**
   - Pengajuan: Biaya Operasional, Reimbursement/Klaim, Uang Muka Karyawan untuk biaya operasional lain
   - Kategori Biaya, Verifikasi Klaim, Settlement, Pembayaran, Exception, Jurnal
11. **Laporan**
   - Neraca Saldo, Buku Besar, Laba Rugi, Neraca, Arus Kas
   - Aging AR/AP, Persediaan, Margin
12. **Daftar Arsip**

Uang muka pelanggan dan supplier/vendor adalah saldo terkait penerimaan/pembayaran yang ditampilkan dan dialokasikan pada detail AR/AP. Pengajuannya tidak menjadi menu utama atau submenu khusus. Uang muka karyawan diajukan pada **Biaya & Klaim → Pengajuan** untuk biaya operasional lain, atau **HRIS → Perjalanan Dinas → Pengajuan** untuk perjalanan dinas. Kas masuk/keluar dan rekonsiliasi bank tetap melalui Kas & Bank; settlement mengikuti klaim/perjalanan asal. Alokasi tidak menggandakan penerimaan atau pembayaran dan sisa/refund tetap dapat ditelusuri.

### HRIS

Dashboard HRIS web pada implementasi historis: empat KPI, Perlu ditindaklanjuti HRIS, Status proses SDM dan catatan hak akses data pribadi. Route `/?view=hris`, preview `/preview/dashboard?view=hris`; ukuran/kontrol mengikuti standar global. Periode dan filter proses tersedia, sumber SDM belum tersedia ditandai jelas. Lihat [catatan pembangunan HRIS](../mockup/dashboard-hris-build.md).

1. **Karyawan & Kontrak**
   - Struktur Organisasi: Departemen, Jabatan, Lokasi, Jenis Hubungan Kerja dan Garis Pelaporan
   - Daftar Karyawan
   - Detail Karyawan: Profil, Pekerjaan & Kontrak, Absensi, Payroll, Dokumen dan Aset sesuai izin
   - Kontrak & Riwayat: versi kontrak, jabatan, penempatan dan kompensasi bertanggal efektif
2. **Rekrutmen**
   - Permintaan Tenaga
   - Lowongan
   - Kandidat & Lamaran
   - Pipeline Seleksi
   - Interview/Assessment
   - Offer
   - Talent Pool
   - Laporan Rekrutmen
3. **Onboarding**
   - Karyawan Akan Bergabung
   - Checklist
   - Dokumen/Kontrak
   - Akun & Hak Akses sebagai tugas onboarding; pemberian peran tetap melalui Setting
   - Absensi/Payroll Setup
   - Aset/Perlengkapan
   - Orientasi/Pelatihan
   - Onboarding Selesai/Exception
4. **Waktu & Kehadiran**
   - Kalender Kerja
   - Shift & Penugasan
   - Impor Fingerprint
   - Absensi Harian dan Koreksi Absensi
   - Cuti & Izin
   - Lembur
   - Rekap Bulanan dan Cut-off Payroll
5. **Payroll**
   - Kalender & Cut-off
   - Komponen/Aturan dan Input Variabel
   - Payroll Run
   - Review & Approval
   - THR, BPJS dan PPh 21
   - Slip Gaji
   - Status Pembayaran/Rekonsiliasi
   - Adjustment
6. **Perjalanan Dinas**
   - Pengajuan, termasuk permintaan Uang Muka Karyawan
   - Persetujuan
   - Perjalanan Berjalan
   - Settlement, termasuk sisa uang muka dan klaim tambahan
   - Riwayat
7. **Resign & Offboarding**
   - Pengajuan dan Persetujuan
   - Case Berjalan
   - Serah Terima Pekerjaan
   - Pengembalian Aset/Barang
   - Penonaktifan Akses
   - Final Pay/Settlement
   - Exit Interview
   - Arsip dan Riwayat
8. **Reimbursement Saya**
   - Pengajuan Klaim
   - Bukti dan Status Review
   - Riwayat Pembayaran
9. **Laporan HRIS**
   - Karyawan, Kontrak, Rekrutmen, Onboarding
   - Kehadiran/Cuti, Lembur, Payroll
   - Aset Karyawan dan Offboarding

Payroll, data pribadi, rekening, pajak, dan dokumen karyawan mengikuti field authorization dan scope. Pembayaran reimbursement/advance tetap diproses Finance; HRIS menyediakan pengajuan, konteks karyawan, dan settlement sesuai prosesnya.
Submenu Rekrutmen, Onboarding, Payroll dan Offboarding membuka daftar kerja sesuai izin; bagian pada Detail Karyawan tidak menjadi menu navigasi terpisah. Tautan Aset Karyawan membaca assignment yang sama dengan Finance → Aset, tanpa mencatat aset kedua.

### Master Data

1. **Produk**
   - Identitas, kategori dan status
   - UOM dasar dan konversi
   - NIE/AKL/AKD serta dokumen izin edar
   - Profil penyimpanan, batch/expiry/serial dan atribut mutu
   - Harga Beli Acuan dan Harga Jual Standar pada detail Produk
2. **Pelanggan**
   - **Identitas & Wilayah:** kode pelanggan, nama, alamat utama, alamat pengantaran, channel dan rayon
   - **Kontak PIC:** PIC pembelian, PIC penerimaan barang, dan PIC pembayaran/keuangan; pengelolaan kontak lengkap berada di **Sales & Marketing → CRM → Kontak** dan tab **Kontak** pada halaman Pelanggan, keduanya data yang sama dengan izin `crm_contact`
   - **Legalitas & Penanggung Jawab:** legalitas/izin operasional, NPWP, apoteker atau penanggung jawab teknis, dan izin penanggung jawab
   - **Pembayaran & Kredit:** termin pembayaran, mode COD/prepay/tempo sesuai policy, limit kredit, metode pembayaran, toleransi hari, dan status WAPU bila relevan
   - **Piutang Awal & Onboarding:** saldo awal per invoice hasil opening, upload berkas NOO, jenis/potensi pelanggan, jadwal tukar faktur, PIC penagihan/gudang, dan status verifikasi onboarding
   - **Status & Riwayat:** tahap hubungan, status aktif/nonaktif, versi data, masa berlaku dokumen, dan histori perubahan
   - Kelompok ini mencakup 17 atribut pelanggan yang disetujui; form prospek boleh memakai versi ringkas sampai data transaksi diperlukan.
3. **Supplier**
   - **Identitas:** kode supplier, nama badan usaha, satu atau beberapa kategori, alamat utama dan nomor telepon
   - **Kontak PIC:** PIC penjualan, PIC keuangan dan PIC pengiriman barang; satu orang dapat menjalankan beberapa fungsi
   - **Legalitas & PJT:** legalitas/izin operasional, NPWP dan nama penanggung jawab teknis
   - **Kontrak/MOU:** nomor, versi, masa berlaku, lampiran dan cakupan produk sebagai tautan ke agreement Pengadaan
   - **Status & Riwayat:** status aktif/nonaktif, hasil verifikasi dokumen dan histori perubahan
   - TOP ditetapkan pada PO atau MOU sesuai kewenangan Pengadaan, bukan field tetap pada master Supplier.
   - Kelompok ini mencakup 13 atribut Supplier yang disetujui.
4. **Vendor**
   - **Identitas:** kode vendor, nama, jenis badan usaha/perorangan, satu atau beberapa kategori, alamat, nomor telepon dan email
   - **Kontak PIC:** PIC penjualan/pemesanan, PIC keuangan dan PIC pelaksanaan/pengiriman; satu orang dapat menjalankan beberapa fungsi
   - **Legalitas & Pajak:** legalitas/izin usaha sesuai jenis vendor, NPWP dan status PKP beserta bukti/verifikasinya
   - **Pembayaran & Utang Awal:** ringkasan rekening pembayaran serta saldo awal utang hasil opening per tagihan; pengelolaan/verifikasi rekening dan opening berada di Finance
   - **Kontrak & Status:** nomor kontrak/SPK/perjanjian, cakupan dan masa berlaku, status aktif/nonaktif serta histori perubahan
   - TOP ditetapkan pada PO atau kontrak terkait, bukan field tetap pada master Vendor.
   - Kelompok ini mencakup 18 atribut Vendor yang disetujui.
5. **Gudang**
   - Identitas gudang, zona, locator dan profil penyimpanan
   - Status aktif dan riwayat perubahan; saldo dan movement berada di Warehouse & Logistik
6. **Item Operasional**
   - Barang operasional, model aset dan jasa berulang
   - Kategori, UOM dan Harga Beli Acuan bila relevan
   - Status peninjauan dan riwayat perubahan
Kategori, UOM, channel dan rayon tetap menjadi referensi kanonis yang digunakan pada form terkait. Stok, kredit, saldo dan pajak ditampilkan pada layar yang relevan sesuai izin dan kepemilikan domain; tidak ada submenu Ringkasan Lintas Domain tersendiri.

Keputusan 23 Oktober 2026: setiap submenu Master Data memakai kerangka Daftar/Detail/Form bersama dan URL yang mengikuti menu (`/master-data/<resource>`, `/new`, `/:id`, `/:id/edit`; tab detail pada `?tab=`). Lokator adalah sub-submenu Gudang di `/master-data/warehouses/locators`. Kategori Produk dan Satuan menjadi tab pada halaman Produk; Channel, Rayon dan Kontak menjadi tab pada halaman Pelanggan; masing-masing dengan izin sendiri. Tab Kontak (keputusan 23 Oktober 2026) menampilkan data kontak CRM yang sama dengan izin `crm_contact`, bukan izin Master Pelanggan. Acuan normatif: [standar desain global web](../mockup/web-design-standard.md).

Butir di bawah setiap nomor adalah kelompok isi layar/detail, bukan izin untuk mengubah semua datanya melalui update master. Pada Pelanggan, termin/mode pembayaran, limit kredit, status WAPU dan piutang awal hanya ditampilkan atau dibuka sebagai tindakan berizin ke pemilik aturan: Setting/Finance/Pajak atau proses opening Finance. Saldo awal berasal dari rincian invoice yang diverifikasi dan diposting, bukan angka bebas pada master.

UOM, NIE, dan Harga Beli/Jual Acuan adalah bagian detail **Produk**, bukan menu tingkat pertama. **Price List** dikelola melalui **Sales & Marketing → Penawaran & Harga → Price List**; harga jual standar dari Produk dapat menjadi sumber pricelist standar tanpa membuat dua sumber harga. Payment Terms dan Tax Profile dikelola Setting/Finance/Pajak sesuai aturan. Master Data tidak mengubah saldo, posting, transaksi, batch, quality state, kredit atau aturan milik domain lain.

### Setting

1. **Profil Perusahaan**
   - Identitas perusahaan, alamat, kontak, logo dan lokalisasi
2. **Pengguna**
   - Akun, status aktif, sesi, scope dan pratinjau izin efektif
3. **Peran**
   - Kelompok hak akses dan penugasan beberapa peran pada satu pengguna
   - Detail peran: **Matriks Hak Akses** untuk resource, tindakan, scope, field sensitif dan tindakan khusus
4. **Kebijakan Umum**
   - Perusahaan & Lokalisasi
   - Finance & Penagihan
   - Gudang & Pengadaan
   - CRM & Target
   - Kunjungan & Lokasi
   - HR & Perjalanan
   - Dashboard, Ekspor & Retensi
5. **Kebijakan Pelanggan Baru**
   - Mode awal COD atau Prepay
   - Durasi evaluasi dan syarat perpindahan fasilitas
6. **Kredit & Exposure**
   - Kebijakan global, exposure, past due, freeze dan unlock
   - Fasilitas per pelanggan dikelola sebagai atribut **Master Data › Pelanggan** (keputusan konsolidasi 24 Oktober 2026)
7. **Pengaturan Persetujuan**
   - Aturan, Tahapan, Delegasi dan Riwayat
8. **Template Cetak**
   - Jenis dokumen, versi, layout, default, publikasi dan preview
9. **Penomoran Dokumen**
    - Seri, prefix, periode, counter, preview dan histori nomor
10. **Daftar Referensi & Alasan**
    - Kode, nama, status, urutan dan catatan wajib
11. **Periode & Closing**
    - Fiscal year, status Open/Closing/Closed, checklist dan Reopen berizin
12. **Impor/Ekspor & Arsip**
    - Staging, Validate, Preview, Commit, Error Report, arsip dan retensi
13. **Audit**
    - Actor, action, resource, perubahan, request ID, waktu dan alasan sesuai izin

Pengadaan menjadi kelompok menu dalam **Warehouse & Logistik**, bukan modul utama baru. Logistik mengevaluasi kebutuhan stok dagang dan menyusun PR setelah memperhitungkan backorder, stok dan PO berjalan. HR tetap menangani permintaan/barang operasional; PR/PO pembeliannya dikelola melalui kelompok Pengadaan sesuai izin. Finance dapat membuka referensi PR/PO dari tagihan untuk pencocokan tanpa memindahkan kepemilikan menunya. Persetujuan PR/PO mengikuti pihak/limit terkonfigurasi, tidak otomatis diberikan karena pengguna mengakses modul Logistik.

Sumber domain navigasi: [Dashboard](09-dashboard.md), [Sales & Marketing](10-sales-marketing.md), [Warehouse & Logistik](11-warehouse-logistik.md), [Finance](12-finance-administration.md), [HRIS](13-hris.md), [Master Data](14-master-data.md), dan [Setting](15-setting.md). Master Data menyimpan identitas reusable; resource yang terlihat di form master tetap tunduk pada izin dan pemilik aturan domain asal.

Menu terlihat berdasarkan izin. Semua staf dapat memiliki akses aplikasi tanpa melihat semua modul atau data. Web kantor Next.js/React menggunakan sidebar, area utama dan panel rincian opsional. Aplikasi mobile Nuxt/Vue sales menggunakan navigasi ringkas: Hari ini, Kunjungan, Pelanggan, Tugas. Aplikasi mobile gudang menampilkan Tugas, Penerimaan, Picking/Checking dan Stok sesuai izin. Menu kantor lain dibuka melalui web kantor responsif bila berizin; seluruh menu ERP tidak diduplikasi ke aplikasi mobile. PWA/browser boleh tersedia sebagai akses tambahan.

Kedua frontend berbagi warna, typography, spacing, istilah status dan pola input melalui design tokens. Implementasi komponen React dan Vue terpisah. Perbedaan susunan layar mengikuti pekerjaan kantor/lapangan, sementara data, aturan bisnis dan otorisasi berasal dari API yang sama. Status jaringan, pengiriman data, izin kamera/lokasi dan update PWA harus terlihat; jangan memakai notifikasi berhasil untuk request yang belum dikonfirmasi server.

Keputusan visual terbaru pengguna: seluruh layar yang diimplementasikan menggunakan tema dan komponen resmi shadcn/ui pada web kantor serta shadcn-vue pada aplikasi lapangan. Token semantik bersama (surface/foreground, aksi, status, sidebar, radius) menjadi sumber tema kedua frontend; komponen runtime React dan Vue tetap terpisah. Pemasangan komponen tidak menggantikan cakupan layar, izin server, atau alur bisnis pada blueprint.

Tailwind CSS menerapkan token tersebut pada kedua frontend. TanStack Table menyediakan perilaku tabel dan TanStack Query mengelola status pengambilan data. Event realtime mendorong pembaruan setelah server commit; bila koneksi terputus, tampilkan status sinkronisasi dan ambil ulang saat tersambung. Toast memakai Sonner pada React dan Vue Sonner pada Vue untuk umpan balik singkat; pengguna melihat istilah operasional seperti “Memuat”, “Belum ada transaksi” dan “Data belum diperbarui”, tanpa istilah library atau cache teknis pada alur kerja.

Layar **Pengguna** memuat akun, status aktif, beberapa peran sekaligus, cakupan penugasan dan pratinjau izin efektif. Layar **Peran** memungkinkan admin berizin membuat/mengubah kelompok hak tanpa nama jabatan yang dikunci. **Matriks Hak Akses** menampilkan resource/modul pada baris dan tindakan pada kolom: lihat, buat, ubah draft, ajukan, setujui/tolak, posting, batalkan, cetak/ekspor, serta tindakan khusus yang relevan. Cakupan data dan izin sensitif seperti melihat harga modal/gaji ditampilkan eksplisit. Sel yang tidak relevan dinonaktifkan, bukan diberikan sebagai hak generik untuk semua resource.

Satu akun menampilkan gabungan izin per tindakan/cakupan dari peran yang diberikan. Pengguna tidak harus berpindah akun/peran untuk melanjutkan pekerjaan. Pengaturan persetujuan dokumen sendiri berada di aturan approval per jenis transaksi, terpisah dari matriks. Admin dapat meninjau dampak perubahan izin sebelum menyimpan, dengan riwayat perubahan sesudahnya.

## 3. Layar prioritas dan tindakan

| Layar | Informasi utama | Tindakan utama |
|---|---|---|
| Dashboard per peran | Antrean tugas dan blocker; ringkasan yang sesuai izin | Buka tugas |
| Finance ringkasan | AR outstanding, past due, invoice belum terbit, GRNI/unbilled, close state | Tindak lanjuti invoice / buka closing |
| Chart of Accounts | Pohon/tabel kode, nama, klasifikasi, header/detail, induk, kebijakan posting, akun kontrol, mapping dan status | Tambah/Edit, Aktifkan/Nonaktifkan, Impor/Ekspor, Lihat Buku Besar/Riwayat sesuai izin; saldo tidak diedit dari master |
| Pengaturan Jurnal Otomatis | Event, kondisi, prioritas, versi/tanggal berlaku, sumber nominal, akun debit/kredit, dimensi, status validasi dan konflik | Tambah/Edit Draft, Simulasikan, Validasi, Aktifkan/Nonaktifkan, Lihat Riwayat sesuai izin |
| Preview/Riwayat Jurnal | Dokumen sumber, tanggal/periode, profile version, akun/dimensi, debit/kredit, posting/reversal dan exception | Posting dari dokumen sumber, buka jurnal/sumber, Reverse sesuai izin; preview dihitung ulang saat posting |
| Ringkasan Kas & Bank | Saldo buku per rekening, penerimaan/pengeluaran, transaksi menunggu, dana tak dikenal dan mutasi belum cocok beserta tanggal pembaruan | Buka rekening/transaksi; buat penerimaan/pembayaran/transfer sesuai izin |
| Penerimaan Dana | Tanggal/rekening, pembayar, uang masuk, invoice/alokasi, tabel komponen pajak, uang muka/unidentified dan bukti. Untuk WAPU tampilkan baris terpisah **PPN Dipungut WAPU** dan **PPh Dipotong**, masing-masing dengan DPP, tarif, nominal dan status bukti | Tambah/Hapus baris sesuai rule, Verifikasi Bukti, Posting, Reverse/Realokasi sesuai status dan izin |
| Pembayaran | Sumber dana, penerima/rekening snapshot, tagihan/alokasi, bruto/neto/withholding, approval, eksekusi dan bukti | Ajukan, Setujui/Tolak, Tandai Transfer, Posting, Reverse sesuai izin |
| Transfer & Kas Kecil | Rekening sumber/tujuan atau voucher kas, tanggal, tujuan, akun/dimensi, nominal, biaya, bukti dan cash count | Ajukan/Setujui, Konfirmasi keluar/masuk, Posting, Hitung Kas dan tindak lanjuti selisih |
| Kartu Piutang | Pelanggan, saldo awal, invoice/unbilled, pembayaran, credit note, uang muka, saldo berjalan/akhir, due date, aging, sengketa dan follow-up | Filter/drill-down, Terima Pembayaran, Alokasi, Catat Follow-up, Ajukan Koreksi/Write-off sesuai izin, cetak/ekspor |
| Kartu Utang Supplier/Vendor | Pihak terpisah, invoice, PO/GR/service acceptance, GRNI, pembayaran, uang muka, TOP/due date, aging, exception dan bukti | Filter/drill-down, Alokasi Uang Muka, Ajukan Pembayaran, Selesaikan Exception, Catat Credit/Debit Note sesuai izin |
| Barang Diterima Belum Ditagih | Supplier/Vendor, PO, GR/service acceptance, umur penerimaan, estimasi, sudah ditagih dan sisa | Buka PO/GR, Catat Invoice, Selesaikan Exception, tindak lanjut |
| Biaya Operasional | Kategori, pemohon/departemen, sumber stok/vendor/reimbursement, nominal, akun, pajak, bukti, approval dan status | Buat Permintaan/Klaim, Review, Ajukan, Setujui, Posting, buka Pembayaran |
| Pengajuan Uang Muka Karyawan | Karyawan, tujuan, nominal, tanggal settlement, saldo advance, bukti dan hasil settlement | Ajukan/Bayar, Settlement, Catat Pengembalian, Ajukan Exception |
| Absensi Harian | Tanggal/karyawan/shift, scan masuk-pulang, status, menit terlambat/pulang cepat, jam kerja, sumber dinas/cuti dan exception | Filter, buka bukti, ajukan/kaji koreksi, hitung ulang sesuai izin |
| Impor Fingerprint | File/perangkat/timezone, total baris, valid, perlu mapping, duplikat, ambigu, ditolak dan status commit | Unggah, Validasi, Selesaikan Mapping, Commit/Reprocess sesuai izin |
| Cuti & Izin | Jenis, tanggal, saldo sebelum/sesudah, dokumen, approver dan status | Ajukan, Setujui/Tolak, Batalkan sesuai scope |
| Lembur | Rencana, approval, realisasi, bukti scan, durasi terverifikasi, klasifikasi hari dan status cut-off | Ajukan, Realisasikan, Verifikasi, buka exception |
| Rekap & Cut-off | Periode, rekap per karyawan, blocker, exception, status review, snapshot dan audit reopen | Validasi, Ajukan Review, Cut-off, Reopen sesuai izin |
| Payroll Run | Periode, status, total gross/net, kewajiban, exception, perubahan dari periode lalu, hash input dan rule version | Hitung Draft, Review, Approve, Post, Publikasikan Slip sesuai izin |
| Detail Payroll | Karyawan, komponen, input snapshot, formula/rule, bruto, potongan, kewajiban perusahaan dan net pay | Drill-down, tandai exception, ajukan adjustment sesuai izin |
| Slip Gaji | Periode, tanggal terbit, gross, potongan, net, komponen pajak/iuran dan file privat | Lihat/unduh slip sendiri; HR menerbitkan ulang tanpa mengubah nilai |
| Permintaan Tenaga | Posisi/departemen, jumlah, alasan, hubungan kerja, tanggal kebutuhan, rentang biaya, budget dan status approval | Buat, Ajukan, Review HR, Setujui/Tolak/Revisi, Buka Lowongan |
| Pipeline Rekrutmen | Lowongan, kandidat per tahap, owner, umur tahap, jadwal interview dan exception | Pindah tahap, jadwalkan interview, reject/withdraw dengan alasan |
| Offer | Kandidat, posisi, kompensasi terbatas, tanggal mulai, masa berlaku, versi, syarat dan status | Review, Approve, Kirim, Catat Diterima/Ditolak/Ditarik |
| Checklist Onboarding | Karyawan akan bergabung, tanggal mulai, task dokumen/akses/absensi/payroll/aset/pelatihan, owner, due date dan blocker | Mulai/Selesaikan/Block/Waive task, Aktivasi bila blocker kritis selesai |
| Resign & Offboarding | Karyawan, jenis, tanggal pengajuan/efektif, masa pemberitahuan, approval, handover, task, status dan exception | Ajukan, Setujui/Tolak/Revisi, buka case, atur task |
| Pengembalian Aset | Assignment, serial, aksesori, kondisi awal/akhir, foto, pemeriksa, status dan exception | Jadwalkan, Terima, Catat Rusak/Hilang, Mutasi, Tutup Assignment |
| Final Pay & Settlement | Snapshot absensi/cuti/lembur/komisi/advance/reimbursement, gross, potongan, net, approval, pembayaran dan status | Kunci Input, Hitung, Review, Approve, Post, Bayar, Adjustment |
| Dashboard HRIS | As-of/periode, headcount, kontrak, recruitment/onboarding, attendance, payroll status, offboarding, freshness dan Perlu Ditindaklanjuti sesuai izin | Filter, buka drill-down, buka task pada modul asal, ekspor sesuai izin |
| Tambah pelanggan dari SO | Nama/channel, kontak, alamat kirim/tagih, PIC sales, mode COD/prepay, data pajak, kandidat duplikat dan status onboarding | Cari pelanggan yang sudah ada / simpan pelanggan baru sesuai hak; tetapkan Tempo hanya setelah evaluasi Finance |
| SO detail | Seluruh item/jumlah pesanan, pelanggan/channel, harga/TOP; validasi/kredit; jumlah teralokasi, kirim, backorder, closed/cancelled dan tagihan | Simpan draft / ajukan / evaluasi ulang; lihat tahap pemenuhan; tutup sisa atau batalkan sesuai hak dan kondisi |
| Tahap pemenuhan SO | Item/jumlah alokasi tahap, batch/locator, aktual picking/checking, dokumen dan selisih | Terbitkan Proforma / Picking Slip dari alokasi; Packing List dari aktual lolos checking; buka dokumen terkait |
| Antrean Alokasi | Urutan prioritas, SO/pelanggan, waktu lolos pemeriksaan, item/jumlah, backorder dan stok tersedia | Ubah Prioritas dengan alasan sesuai izin; lihat riwayat; realokasi reservasi melalui tindakan terpisah berizin |
| Perencanaan Pembelian | Kelompok pemasok/MOU, produk, PR/SO asal, kebutuhan belum dipesan, waktu kebutuhan, harga kontrak, total, minimum pesan dan estimasi ongkir | Pilih kebutuhan / gabungkan atau bagi / jadwalkan / buat draft PO; tanpa tabel perbandingan supplier |
| Setting → Alasan Retur | Kode, nama alasan, aktif/nonaktif, catatan wajib dan urutan tampil | Tambah / ubah / nonaktifkan / atur urutan sesuai izin; alasan terpakai tetap tersimpan |
| Monitoring Pengiriman — Ke Pelanggan | Surat Jalan/SO, pelanggan/tujuan, kurir/resi, waktu kirim, estimasi tiba, update terakhir, qty belum terselesaikan dan status; indikator terlambat/kendala | Filter kiriman aktif / perbarui perjalanan / catat POD dan selisih / buka tindak lanjut |
| Monitoring Pengiriman — Dari Supplier | PO, supplier, referensi kirim/resi, kurir, waktu kirim, estimasi tiba, tujuan, qty per kiriman dan update terakhir; sisa belum dikirim serta indikator terlambat/kendala | Catat konfirmasi supplier / perbarui perjalanan / konfirmasi tiba / buka penerimaan GR dan selisih |
| Tagihan Supplier | Nomor invoice supplier dan nomor internal, supplier, PO/GR, nilai/pajak, lampiran, hasil pencocokan, jatuh tempo dan outstanding | Catat Invoice / selesaikan selisih / Posting / Bayar Tagihan sesuai izin; lihat penerimaan belum ditagih |
| Vendor / Tagihan Vendor | Data vendor operasional terpisah dari Supplier; PO aset/operasional/jasa, bukti penerimaan terkait, invoice dan outstanding | Kelola vendor dengan atribut yang disetujui / catat tagihan / cocokkan / Posting / Bayar sesuai kontrol finance |
| Sisa pesanan | Backorder per item/jumlah, perkiraan pemenuhan bila diketahui, alasan dan histori penutupan | Pertahankan backorder / tutup jumlah sisa dengan alasan |
| Pembatalan pesanan | Konfirmasi pelanggan, jumlah terdampak, reservasi, picking, pengiriman, invoice dan uang muka | Catat konfirmasi; batalkan SO belum dikirim atau batalkan sisa; selesaikan tugas pengembalian bila sudah picking |
| SO terkunci | Daftar alasan, nilai aktual/batas, syarat perbaikan dan alasan yang boleh diajukan unlock | Perbaiki data atau Ajukan Unlock sesuai hak |
| Pengajuan unlock | SO dan revisi, alasan kunci, alasan pemohon/bukti, lingkup pengecualian, pihak peninjau dan riwayat | Pemohon mengajukan; pihak terkonfigurasi menyetujui/menolak |
| Kredit | Limit, komponen exposure, daftar tunggakan, sisa limit dan alasan hold | Lihat invoice / Ajukan Unlock |
| Stock detail | Produk, NIE, batch, expiry, lokasi, pemilik, on hand/reserved/available, quality | Lihat pergerakan / inspeksi |
| Penerimaan | PO, qty, batch/expiry, kondisi, lokasi dan hasil pemeriksaan | Simpan pemeriksaan / posting |
| AR/AP aging | Pihak, invoice, jatuh tempo, umur, outstanding, collector | Catat follow-up / alokasikan pembayaran |
| Detail Invoice | Nomor, pelanggan, jumlah/nilai, waktu serah terima Surat Jalan, termin, jatuh tempo, dibayar dan sisa; riwayat penerimaan | Terima Pembayaran sesuai izin; form memisahkan uang masuk, PPN Dipungut WAPU, PPh Dipotong dan komponen lain; pilih penerimaan yang sudah ada bila dana telah dicatat |
| Kartu Piutang Pelanggan | Periode, saldo awal, mutasi bertanggal/nomor dokumen, tambah/kurang, saldo berjalan/akhir; invoice terbuka, jatuh tempo, aging dan riwayat penagihan | Telusuri sumber / catat follow-up dan janji bayar / cetak-ekspor sesuai izin |
| Closing | Langkah, selisih, bukti, pemilik, status validasi/review | Selesaikan langkah / review / tutup periode |
| Harga & HPP | Basis biaya, target margin, diskon, rekomendasi neto, margin efektif | Simulasi / ajukan pricelist |
| Rencana Kunjungan Harian / Kunjungan HP | Institusi/prospek, kontak/unit yang ditemui, sales, tanggal/jam, tujuan, status rencana/realisasi; waktu mulai/selesai per sesi kunjungan, hasil pembahasan dan tindak lanjut dapat per kontak; tanpa syarat PO | Tambah prospek/kontak / jadwalkan / check-in / catat hasil per kontak / check-out. Satu sesi memuat beberapa kontak; kunjungan kembali dicatat sebagai sesi baru |
| Payroll | Run, cut-off, data bermasalah, gross/deduction/net, variansi | Hitung draft / review / approve |
| Permintaan staf | Pilihan ATK/aset/jasa, kebutuhan, tanggal, bukti | Ajukan permintaan |

### 3.1 Form data pelanggan baru — 17 atribut pengguna

Daftar atribut berikut berasal dari pengguna. Pengelompokan dan perilaku input merupakan rancangan penerapan; kewajiban dokumen per channel masih perlu ditentukan sesuai jenis pelanggan. Registrasi prospek untuk kunjungan tetap memakai form ringkas, tidak harus melengkapi seluruh atribut pelanggan transaksi.

| No. | Atribut | Isian / perilaku rancangan |
|---|---|---|
| 1 | Kode Pelanggan | Kode unik per perusahaan; usulan dihasilkan otomatis menurut penomoran, dengan validasi kode saat migrasi |
| 2 | Nama Pelanggan | Nama institusi/badan usaha; tampilkan kandidat duplikat sebelum membuat data baru |
| 3 | Alamat Utama | Alamat lengkap terstruktur; alamat penagihan dapat ditentukan terpisah bila berbeda |
| 4 | Alamat Pengantaran Barang | Pilihan sama dengan alamat utama atau alamat berbeda; dukung beberapa tujuan dan satu default, dipilih pada SO |
| 5 | Channel | Pilih master channel; Tambah Channel Baru tersedia sesuai izin pengelolaan master |
| 6 | Rayon | Pilih master rayon; Tambah Rayon Baru sesuai izin; rayon berbeda dari channel |
| 7 | Kontak PIC Pembelian | Nama, jabatan/unit, telepon/WhatsApp dan email bila ada; dapat memakai kontak institusi yang sudah terdaftar |
| 8 | Kontak PIC Penerimaan Barang | Rincian kontak dan kaitan alamat tujuan bila relevan; dapat memuat PIC gudang |
| 9 | Kontak PIC Pembayaran/Keuangan | Rincian kontak untuk penagihan/tukar faktur dan tindak lanjut pembayaran; dapat memuat PIC penagihan |
| 10 | Legalitas dan Izin Operasional | Daftar dokumen: NIB, KTP, akta perubahan, SDAK, SIPA/SIPTTK/surat penugasan, tanda daftar gudang, spesimen tanda tangan/stempel dan izin lain sesuai channel; simpan nomor, penerbit, masa berlaku, berkas, status verifikasi |
| 11 | NPWP | Teks untuk menjaga nol di depan, nama/alamat terdaftar dan berkas bila diperlukan; simpan NPWP/NIK, status PKP/Non-PKP dan alamat sesuai pajak |
| 12 | Apoteker Penanggung Jawab/Penanggung Jawab Teknis | Nama, jenis penanggung jawab, kontak dan masa penugasan bila tersedia; berlaku sesuai jenis pelanggan |
| 13 | Izin Penanggung Jawab | Tertaut ke penanggung jawab: jenis/nomor izin, penerbit, masa berlaku dan berkas; dukung riwayat penggantian |
| 14 | Termin Pembayaran | Opsional: termin bawaan pelanggan dari daftar termin Setting (Tunai/COD, Bayar sebelum kirim, Tempo N hari) yang hanya mengisi otomatis SO. COD memiliki TOP 0 dan jatuh tempo dari waktu serah terima Surat Jalan |
| 15 | Limit Kredit | Nilai uang dan tanggal efektif; hanya pengguna berwenang. Pelanggan baru tidak otomatis mendapat limit/Tempo; limit untuk prepay/COD dapat tetap kosong sesuai policy |
| 16 | Saldo Awal Piutang | Ringkasan hasil proses opening per invoice dan tanggal cut-over; tombol Isi/Impor Rincian Piutang Awal mengikuti hak finance. Bukan angka bebas yang langsung mengubah kartu piutang |
| 17 | Upload Berkas NOO | Unggah berkas dengan nama, tanggal, versi dan catatan; akses privat. Istilah NOO dipertahankan sesuai pengguna; template/kewajiban mengikuti channel |
| Tambahan | Kebijakan onboarding dan penagihan | Jenis pelanggan, potensi, pola pembayaran, jadwal tukar faktur, metode pembayaran, toleransi hari, PIC penagihan/gudang, status verifikasi onboarding dan status WAPU untuk instansi pemerintah |

Usulan kelompok form: **Identitas & Wilayah** (1–6), **Kontak PIC** (7–9), **Legalitas & Penanggung Jawab** (10–13), **Pembayaran & Piutang Awal** (14–16), **Berkas NOO** (17), dan **Onboarding & Penagihan** (tambahan). Satu kontak boleh menjalankan beberapa fungsi PIC, dan setiap fungsi dapat memiliki kontak cadangan. Gunakan data kontak yang sama agar pergantian nomor tidak menghasilkan salinan yang saling berbeda.

Simpan Draft tetap tersedia ketika kelengkapan belum selesai; tampilkan data belum tersedia/tidak berlaku dengan alasan sesuai kebijakan. Jangan mewajibkan apoteker atau jenis izin tertentu secara seragam untuk seluruh channel. Kewajiban upload NOO dan daftar izin mengikuti channel. Pengunggahan berkas saja tidak berarti telah diverifikasi. Status onboarding/approval pelanggan terpisah dari tahap hubungan Prospek dan dari approval SO normal.

Saldo awal pelanggan yang belum pernah bertransaksi dengan perusahaan memang nol. Pelanggan lama yang baru dimasukkan ke ERP harus melalui verifikasi opening; nilai belum diketahui ditandai **Belum diverifikasi**, bukan otomatis nol. Rincian minimal mencakup nomor/tanggal invoice asli, jatuh tempo, nilai invoice, sisa belum dibayar dan bukti bila tersedia. Ringkasan pelanggan berasal dari rincian yang direkonsiliasi dan diposting melalui prosedur opening, bukan disimpan dua kali pada master dan ledger. Upload dokumen historis/opening tidak dihitung sebagai transaksi penjualan baru periode migrasi.

### CRM — Form Kontak, 11 atribut pengguna

| No. | Atribut | Perilaku isian |
|---|---|---|
| 1 | Kode Kontak | Identitas unik kontak, mengikuti pengaturan penomoran |
| 2 | Nama Lengkap - Panggilan | Dua isian: Nama Lengkap dan Nama Panggilan |
| 3 | Nama Pelanggan | Pilih dari Master Pelanggan; simpan hubungan ke data pelanggan, bukan salinan nama bebas |
| 4 | Jabatan | Jabatan kontak pada institusi/pelanggan |
| 5 | Unit/Bagian | Unit atau bagian tempat kontak bekerja; terpisah dari jabatan |
| 6 | Fungsi PIC | Dapat memilih beberapa fungsi; misalnya pembelian, penerimaan, pembayaran/keuangan, atau pengguna produk |
| 7 | Nomor HP/WA | Nomor komunikasi kontak |
| 8 | Email | Alamat email kontak |
| 9 | Tanggal Lahir | Tanggal lahir kontak |
| 10 | Status | Aktif atau tidak aktif; riwayat tetap tersimpan |
| 11 | Catatan | Informasi tambahan mengenai kontak |

Daftar atribut berasal dari pengguna. Rancangan isian: Nama Panggilan, Email dan Tanggal Lahir dapat dikosongkan bila belum diketahui; jangan mengisi tanggal contoh atau nilai palsu. Persyaratan field lain dapat dilengkapi pada validasi form sesuai proses.

Kelompok ringkas: **Identitas** (kode, nama lengkap, panggilan, tanggal lahir); **Pelanggan & Peran PIC** (pelanggan, jabatan, unit/bagian, fungsi); **Komunikasi & Status** (HP/WA, email, status, catatan). Tidak perlu deskripsi panjang pada halaman.

Menu **Sales & Marketing → CRM → Kontak** menampilkan database kontak tersendiri. Database yang sama juga dibuka dari tab Kontak di Master Data › Pelanggan dengan izin `crm_contact` yang sama. Satu pelanggan dapat memiliki banyak kontak. PIC pada form pelanggan serta kontak tujuan kunjungan menggunakan data kontak yang sama; satu orang dengan beberapa fungsi PIC tidak perlu dibuat ulang. Data kontak bukan akun pengguna ERP dan tidak memberikan hak akses aplikasi.

Hubungan ke pelanggan tidak mensyaratkan PO atau invoice dan tidak berarti pelanggan sudah bertransaksi. Institusi/prospek sudah tercatat sekali di Master Pelanggan dengan tahap hubungan Prospek, sehingga pemilih Nama Pelanggan dapat digunakan sebelum transaksi. Saat data dilengkapi menjadi pelanggan terdaftar, pertahankan referensi pelanggan dan kontak yang sama. Status aktif kontak terpisah dari tahap hubungan pelanggan.

### CRM — Manajemen Prospek dan kebutuhan produk, disepakati

Menu **Sales & Marketing → CRM → Prospek** mengelola pendekatan atas institusi yang tercatat di Master Pelanggan dengan tahap hubungan **Prospek**. Registrasi awal menggunakan form ringkas; seluruh legalitas, pajak dan fasilitas kredit pelanggan transaksi tidak diwajibkan hanya untuk kunjungan. Kode Prospek mengidentifikasi profil penanganan prospek, tidak membuat identitas institusi kedua. Kebutuhan produk, peluang dan pipeline bulanan diakses dari detail Prospek, bukan menu CRM mandiri; satu prospek dapat memiliki beberapa peluang periode tanpa menggandakan institusi.

| Atribut | Perilaku |
|---|---|
| Kode Prospek | Identitas pencatatan prospek |
| Nama Institusi/Pelanggan | Referensi ke institusi yang sama di Master Pelanggan; cari data yang sudah ada sebelum menambah |
| Channel | Channel pelanggan, dapat dikelola sesuai izin |
| Rayon | Wilayah penanganan pelanggan |
| Alamat & Lokasi | Alamat dan titik lokasi jika tersedia |
| Kontak/PIC | Pilih satu atau beberapa dari database Kontak |
| Sumber Prospek | Misalnya kunjungan langsung, referensi, pameran atau WhatsApp masuk; mencatat sumber bukan integrasi WhatsApp otomatis |
| Penanggung Jawab | Pengguna yang ditugaskan menangani prospek |
| Kebutuhan Produk | Tabel beberapa produk/kategori/uraian kebutuhan |
| Status Pendekatan | Baru, Dalam Pendekatan, Potensial, Ditunda, Tidak Dilanjutkan; daftar dapat diatur di Setting |
| Tindak Lanjut Berikutnya | Kegiatan, tanggal dan pengguna yang bertanggung jawab |
| Catatan & Lampiran | Catatan pendekatan dan dokumen pendukung |

Status pendekatan terpisah dari tahap hubungan **Prospek → Pelanggan terdaftar — belum bertransaksi → Pelanggan bertransaksi** dan status aktif master. Ditunda/Tidak Dilanjutkan memerlukan alasan. Invoice pertama diposting tetap menjadi pemicu pelanggan bertransaksi.

Pada detail tersedia **Jadwalkan Kunjungan**, **Catat Follow-up**, **Buat Peluang Penjualan**, **Buat Penawaran**, dan **Lengkapi Data Pelanggan**, sesuai izin. Riwayat aktivitas menampilkan kunjungan, komunikasi yang dicatat, kebutuhan, penawaran dan tindak lanjut. Satu institusi dapat memiliki beberapa peluang yang dipantau terpisah, tanpa menggandakan institusi atau kontak. Pelanggan yang langsung memesan dapat langsung diproses ke SO setelah kelengkapan yang diperlukan, tanpa diwajibkan mengikuti seluruh tahapan CRM.

Tabel kebutuhan pada prospek maupun peluang:

| Produk / Kebutuhan | Estimasi Jumlah | Satuan | Perkiraan Waktu Kebutuhan | Catatan |
|---|---|---|---|---|
| Produk dari Master Produk, atau kategori/uraian jika belum spesifik | Estimasi; dapat belum diketahui | Satuan produk bila spesifik | Tanggal/periode yang diketahui | Catatan per item |

Tombol **Tambah Produk/Kebutuhan** menambah baris; jumlah item tidak dibatasi satu. Estimasi jumlah, waktu atau produk yang belum diketahui tidak diisi nilai palsu. Daftar kebutuhan dapat diteruskan ke penawaran dan kemudian SO sesuai pesanan pelanggan dengan referensi sumber. Pencatatan kebutuhan sendiri **tidak mereservasi stok dan tidak membuat PR**. Sebelum menjadi baris SO, kebutuhan deskriptif harus dipetakan ke produk, jumlah dan satuan yang valid. Pemindahan antar tahap mempertahankan riwayat; tidak menghitung kebutuhan sumber dan turunannya sebagai dua permintaan pembelian.

Layout tetap ringkas: ringkasan institusi/PIC, penanganan, tabel kebutuhan, serta riwayat aktivitas. Rancangan rinci terbaru berada pada [CRM operasional](10-sales-marketing.md): pipeline bulanan beserta stage/persentase sumber, Win atas PO/SP terverifikasi, alasan Win/Lost, strategi maintain, penawaran/revisi/pengajuan harga, kunjungan berizin/foto wajib/tracking, follow-up dan sampel/trial.

Layar Pipeline menyediakan periode, pemilik dan pelanggan, tampilan tabel/kolom stage; confidence terpisah dari A/T. Detail peluang memakai tabel produk agar hasil sebagian, stage, next action dan alasan per item terlihat. Dialog Win meminta referensi PO/SP terverifikasi, alasan dan strategi maintain; dialog Lost meminta alasan. Penutupan akhir bulan menampilkan alasan tenggat dan stage terakhir tanpa menghapus data pelanggan.

Penawaran memisahkan status dokumen, status pengajuan harga per baris dan tanggapan pelanggan. Tampilkan versi/masa berlaku, net per item, pajak/ongkir terpisah, qty diterima/terkonversi/sisa serta pilihan item ketika Buat SO. Form permintaan harga menunjukkan pelanggan, produk/satuan, nilai usulan, alasan dan masa berlaku.

Layar HP sales menampilkan rencana yang disetujui, pengajuan perubahan/di luar rencana, check-in/out per sesi, foto wajib, hasil per kontak dan status tracking. Tracking memerlukan aplikasi terpasang dengan kemampuan native; indikator izin, waktu lokasi terakhir dan gap harus jelas. Daftar tugas mengelompokkan hari ini/terlambat/mendatang; prioritas dan status memakai label singkat. Sampel & Trial menyediakan pengajuan beberapa produk, status approval/pengiriman/trial/pengembalian yang terpisah, hasil per kriteria dan tindak lanjut. Detail atribut dan kebijakan terbuka mengikuti addendum.

### Form Produk — Harga Beli dan Harga Jual

Keputusan pengguna: form **Buat Produk** memuat field **Harga Beli** dan **Harga Jual** yang dapat diisi saat registrasi produk. Tampilkan ringkas dalam kelompok Harga, dengan satuan harga yang eksplisit (default satuan dasar), mata uang dan tanggal berlaku. Rancangan awal nilai sebelum pajak ditandai pada label; harga per box/unit tidak boleh tertukar. Pengguna berhak dapat memperbarui harga dengan riwayat perubahan. Hak melihat/mengubah harga beli terpisah dari harga jual; field harga beli tidak dikirim ke pengguna tanpa izin.

Harga Beli menjadi acuan awal pembelian; harga MOU supplier yang berlaku tetap menjadi referensi utama PO dan perbedaan perlu diperiksa. Harga Jual menjadi harga standar awal produk; pricelist khusus pelanggan/channel yang berlaku dapat menggantikannya sesuai aturan harga. Simpan harga jual standar melalui mekanisme pricelist agar tidak ada dua sumber harga yang saling berbeda. Form produk tetap menyediakan kedua field, tanpa mengharuskan pengguna pindah halaman untuk mengisi harga awal.

Perubahan harga master berlaku untuk transaksi baru/repricing draft yang eksplisit, bukan mengubah histori PO/SO/invoice. Harga Beli master bukan HPP dan tidak menambah stok/nilai persediaan; HPP berasal dari penerimaan, biaya terkait dan valuasi. Data harga belum diisi dibedakan dari nol; jangan meneruskan harga nol diam-diam ke transaksi.

### Form data Supplier — atribut pengguna

Tampilan ringkas mengikuti preferensi halaman bersih. Atribut pengguna dikelompokkan sebagai berikut; tipe kontrol adalah rancangan penerapan.

| No. | Atribut | Isian / perilaku |
|---|---|---|
| 1 | Kode Supplier | Kode unik; usulan otomatis sesuai penomoran master |
| 2 | Nama Supplier | Nama badan usaha; periksa kandidat duplikat |
| 3 | Kategori | Pilihan kategori; contoh sesuai kegiatan: pabrik, importir, sole agent, pemilik izin edar; dukung lebih dari satu bila relevan |
| 4 | Alamat Utama | Alamat lengkap supplier |
| 5 | No. Telpon | Teks nomor telepon utama, menjaga nol di depan/kode negara |
| 6 | Kontak PIC Penjualan | Nama, jabatan, telepon/WhatsApp dan email bila ada |
| 7 | Kontak PIC Keuangan | Rincian kontak keuangan/penagihan supplier |
| 8 | Kontak PIC Pengiriman Barang | Rincian kontak untuk jadwal pengiriman dan tindak lanjut |
| 9 | Legalitas dan Izin Operasional | Daftar jenis/nomor dokumen, masa berlaku bila ada dan lampiran; kewajiban mengikuti kategori/kebijakan yang akan ditetapkan |
| 10 | NPWP | Teks nomor pajak; validasi format sesuai ketentuan berlaku |
| 11 | Nama Penanggung Jawab Teknis | Nama PJT supplier |
| 12 | TOP diatur pada PO | Bukan field TOP tetap di master supplier; isian TOP ada pada setiap PO |
| 13 | No. Dokumen Kontrak Kerjasama / MOU | Referensi ke dokumen kerja sama; dapat memiliki beberapa kontrak/versi dengan masa berlaku, lampiran dan cakupan produk |

Kelompok halaman: **Identitas** (1–5), **Kontak PIC** (6–8), **Legalitas & PJT** (9–11), **Kontrak/MOU** (13). Ketentuan nomor 12 diterapkan pada form PO sehingga tidak menambah field TOP yang membingungkan di halaman supplier. Satu kontak dapat mengisi beberapa fungsi PIC tanpa salinan data terpisah.

TOP pada PO mencatat jenis pembayaran, jumlah hari bila tempo, dasar perhitungan jatuh tempo dan ketentuan pembayaran yang relevan. MOU menjadi referensi untuk memeriksa kesesuaian ketentuan, bukan sumber yang diam-diam mengunci TOP master supplier. Snapshot TOP PO tersimpan untuk verifikasi tagihan/jatuh tempo AP. Default dasar jatuh tempo AP adalah tanggal invoice lengkap diterima dan diverifikasi + TOP; pilihan tanggal invoice supplier atau GR hanya muncul sebagai override eksplisit pada PO/MOU. Aturan pelanggan dari tanggal POD tidak berlaku untuk hutang supplier.

### Form data Vendor — atribut disetujui pengguna

Master/menu Vendor terpisah dari Supplier sesuai keputusan pengguna. Form ditujukan untuk penyedia aset, barang operasional/nonpersediaan dan jasa. Pengguna menyetujui 18 atribut berikut; kelengkapan dokumen menyesuaikan jenis/kategori vendor, bukan kewajiban legal seragam untuk semua vendor.

| No. | Atribut | Isian / perilaku |
|---|---|---|
| 1 | Kode Vendor | Kode unik; usulan otomatis sesuai penomoran master |
| 2 | Nama Vendor | Nama badan usaha atau perorangan; periksa kemungkinan duplikasi |
| 3 | Jenis Vendor | Badan usaha / perorangan |
| 4 | Kategori Vendor | Contoh ATK, IT, servis, sewa, ekspedisi, kendaraan; dapat beberapa kategori dan ditambah pengguna berwenang |
| 5 | Alamat Utama | Alamat vendor |
| 6 | No. Telepon | Nomor telepon utama, bertipe teks |
| 7 | Email | Email utama bila tersedia |
| 8 | Kontak PIC Penjualan/Pemesanan | Nama, jabatan, telepon/WhatsApp dan email bila ada |
| 9 | Kontak PIC Keuangan | Nama dan kontak untuk invoice/pembayaran |
| 10 | Kontak PIC Pelaksanaan/Pengiriman | Kontak pelaksana pekerjaan atau pengiriman barang |
| 11 | Legalitas dan Izin Usaha/Operasional | Jenis/nomor dokumen, masa berlaku bila ada dan lampiran sesuai jenis usaha; tidak mewajibkan izin distributor alkes pada vendor umum |
| 12 | NPWP | Identitas pajak sesuai data vendor dan kebutuhan transaksi; belum tersedia tidak diisi angka fiktif |
| 13 | Status PKP | PKP / Non-PKP / Belum diverifikasi, dengan bukti bila relevan; tarif/perlakuan pajak tetap mengikuti transaksi dan aturan berlaku |
| 14 | Rekening Pembayaran | Bank, nomor rekening, nama pemilik, mata uang jika relevan, status verifikasi dan rekening utama; mendukung beberapa rekening |
| 15 | No. Kontrak/SPK/Perjanjian | Nomor, masa berlaku, cakupan pekerjaan/pasokan serta berkas bila ada; vendor tidak wajib mempunyai MOU barang dagang |
| 16 | TOP | Ditetapkan pada PO atau kontrak terkait; tidak menjadi TOP tetap master. Dasar jatuh tempo vendor dinyatakan eksplisit pada transaksi |
| 17 | Saldo Awal Utang | Ringkasan read-only dari rincian tagihan opening yang disetujui; isi/impor melalui prosedur opening berizin |
| 18 | Status Vendor | Aktif / Nonaktif; penonaktifan tidak menghapus histori atau menghalangi penyelesaian kewajiban yang sudah ada sesuai izin |

Kelompok tampilan: **Identitas** (1–7), **Kontak PIC** (8–10), **Legalitas & Pajak** (11–13), **Pembayaran** (14 dan ringkasan 17), **Kontrak & Status** (15,18). TOP berada pada PO/kontrak sehingga tidak memerlukan field tetap pada form Vendor. Isian kondisional dibuka saat diperlukan, tanpa deskripsi panjang permanen.

Satu orang dapat dipilih untuk beberapa fungsi PIC, terutama vendor perorangan, tanpa membuat kontak duplikat. Dokumen/rekening dibatasi hak akses; perubahan rekening diaudit dan dipertimbangkan saat verifikasi pembayaran. Informasi rekening belum diverifikasi ditampilkan jelas dan tidak otomatis dianggap sah. Kebutuhan dokumen mengikuti kategori/jenis vendor. Pengaturan profil vendor tidak otomatis menentukan tarif/potongan pajak seluruh transaksinya.

Saldo awal utang vendor lama berasal dari nomor/tanggal tagihan, jatuh tempo, nilai dan sisa yang belum dibayar pada tanggal cut-over, direkonsiliasi melalui proses opening. Data belum lengkap ditandai Belum diverifikasi, bukan nol; vendor baru tanpa kewajiban awal memiliki saldo nol. Form tidak membuat kewajiban melalui angka master yang dapat diedit bebas. Tagihan vendor tetap terpisah dari tagihan supplier.

### Master Item Operasional dan pemilihan item

Keputusan pengguna: sediakan menu master untuk barang operasional, jenis/model aset dan jasa berulang, terpisah dari produk barang dagang. Pada baris permintaan internal, pencarian item menyediakan **Pilih Item** atau **Ajukan Item Baru**. Form item baru ringkas: nama, spesifikasi/ruang lingkup, jumlah dan satuan. Petugas berwenang meninjau kemungkinan duplikasi, klasifikasi dan kebutuhan master sebelum proses stok/aset; pemohon tidak harus mengisi akun biaya atau klasifikasi akuntansi.

Barang operasional disimpan memerlukan master, sedangkan barang sekali pakai/jasa khusus boleh tetap berupa baris deskriptif yang dapat ditelusuri. Jenis/model aset dan unit aset ditampilkan terpisah: kode item untuk permintaan/pembelian, nomor aset untuk identitas unit dan penanggung jawab. Form mengikuti susunan atribut yang dibahas: kode, nama, jenis, kategori, spesifikasi, satuan dasar/konversi, Harga Beli Acuan, stok minimum, locator default, foto/lampiran dan status. Stok minimum/locator hanya tampil untuk barang yang relevan. Tidak perlu deskripsi panjang permanen pada form; tampilkan status peninjauan dan bantuan kontekstual bila diperlukan.

**Harga Beli Acuan disetujui pengguna sebagai isian opsional.** Tampilkan satuan dan mata uang yang jelas; barang menggunakan harga per satuan, jasa dapat per pekerjaan/paket/periode. Nilai belum diisi disimpan sebagai belum tersedia dan ditampilkan **Belum tersedia**, bukan Rp0. Field ini membantu estimasi permintaan/PR dan anggaran; harga aktual PO mengikuti kesepakatan vendor. Tidak ada harga jual pada lingkup item internal ini. Perubahan harga acuan sesuai izin dan diaudit; tidak menulis ulang estimasi dokumen historis atau membentuk HPP, beban maupun nilai aset. Nilai perolehan aktual dan kebijakan kapitalisasi mengikuti transaksi finance.

### Master Karyawan — atribut disetujui pengguna

| Kelompok | Atribut |
|---|---|
| Identitas | Kode Karyawan/NIK Internal, Nama Lengkap, Foto, NIK KTP, Tempat dan Tanggal Lahir, Jenis Kelamin |
| Kontak & Alamat | Nomor HP, Email, Alamat KTP, Alamat Domisili |
| Data Keluarga | Status Perkawinan, Data Tanggungan, Kontak Darurat, Hubungan Kontak Darurat, Nomor HP Kontak Darurat |
| Penempatan Kerja | Departemen, Jabatan, Atasan Langsung, Lokasi Kerja |
| Hubungan Kerja | Tanggal Bergabung, Jenis Hubungan Kerja, Status Karyawan, Tanggal Berakhir Bekerja, Alasan Berakhir Bekerja |
| Kontrak | Nomor Kontrak, Jenis Kontrak, Tanggal Mulai, Tanggal Berakhir jika berlaku, Masa Percobaan jika berlaku, Pengingat Berakhir Kontrak, Upload Kontrak |
| Absensi | ID Karyawan pada Mesin Fingerprint, Jadwal/Shift Kerja, Kebijakan Cuti, Kebijakan Lembur |
| Penggajian | Kelompok Payroll, Gaji Pokok, Tunjangan, Potongan Rutin, Skema Komisi jika berlaku, Tanggal Efektif Pengaturan |
| Rekening Pembayaran | Nama Bank, Nomor Rekening, Nama Pemilik Rekening |
| Pajak & BPJS | Identitas Perpajakan NIK/NPWP, Status PTKP beserta periode berlakunya, Nomor dan Status Kepesertaan BPJS Kesehatan/BPJS TK, Tanggal Mulai/Berakhir Kepesertaan |
| Dokumen | KTP, KK, Dokumen Pajak, Ijazah/Sertifikasi, CV, dan dokumen pendukung sesuai kebutuhan |
| Akun Aplikasi | Tautan ke akun pengguna ERP jika karyawan memiliki akses |

Tab detail: **Profil · Pekerjaan & Kontrak · Absensi · Payroll · Dokumen · Aset**. Profil memuat identitas, kontak dan keluarga; Payroll memuat pengaturan penggajian, rekening, pajak dan BPJS. Tautan akun dapat ditampilkan pada Pekerjaan & Kontrak sesuai izin; pengelolaan peran tetap melalui Setting → Pengguna & Peran.

Pada pembuatan data awal, wajibkan hanya **Kode Karyawan, Nama, Tanggal Bergabung, Jenis Hubungan Kerja, dan Status**. Data lainnya dilengkapi sesuai kebutuhan proses sebelum digunakan, terutama payroll. Jangan menjadikan seluruh unggahan wajib untuk setiap karyawan. Isian kondisional hanya muncul saat relevan; form tetap ringkas tanpa deskripsi panjang.

- Kode karyawan/NIK internal berbeda dari NIK KTP dan ID fingerprint.
- Kontrak, jabatan, penempatan dan gaji memiliki riwayat dan masa berlaku; perubahan tidak menimpa histori.
- Jabatan tidak otomatis menentukan peran/hak akses. Satu akun tetap dapat memiliki beberapa peran sesuai Setting.
- Gaji, rekening, identitas pribadi dan dokumen hanya terlihat oleh pengguna berwenang.
- Tab Aset mengambil transaksi serah terima/pengembalian aset yang sama; jangan membuat pencatatan aset kedua.
- Resign mengakhiri hubungan kerja tanpa menghapus riwayat karyawan.

Kesepakatan ini menetapkan atribut dan perilaku master. Rincian waktu, absensi, cuti dan lembur mengikuti dokumen 26; perhitungan payroll dan komisi dibahas pada tahap berikutnya.

### Setting — Profil Perusahaan

Halaman ringkas memuat **Nama Perusahaan, Nama Legal bila berbeda, Alamat, Telepon, Email, Logo, NPWP/identitas pajak dan informasi kontak** sesuai izin. Pengguna berizin memilih **Edit → Simpan**. Perubahan nama tidak menampilkan field tanggal berlaku, alasan perubahan atau approval. Setelah disimpan, nama baru langsung tampil pada aplikasi dan dokumen baru. Dokumen yang sudah diterbitkan tetap menampilkan snapshot identitas pada saat penerbitan.

### Setting — Kebijakan Operasional

Halaman memakai tab **Perusahaan & Lokalisasi · Finance & Penagihan · Gudang & Pengadaan · CRM & Target · Kunjungan & Lokasi · HR & Perjalanan · Dashboard, Ekspor & Retensi**. Setiap baris menampilkan parameter, nilai saat ini, unit, nilai awal, terakhir disimpan dan pengguna terakhir. Detail field mengikuti [dokumen 40](15-setting.md).

Pola utama adalah **Edit → Simpan → Batal**. Gunakan toggle, angka dengan unit, select, ordered list atau table editor sesuai tipe parameter. Jangan menampilkan alasan, approval atau tanggal berlaku secara default. Jika parameter memilih penjadwalan/approval opsional, field tambahan baru muncul setelah opsi tersebut diaktifkan. Tampilkan preview dampak dan validasi singkat; invariant sistem ditampilkan read-only pada panel **Kontrol yang Tidak Dapat Diubah**, bukan sebagai toggle palsu.

### Setting — Pengaturan Persetujuan

Rancangan ini menerapkan arahan pengguna untuk persetujuan yang fleksibel. Nama pengguna, batas nominal/persentase, jumlah tahap dan delegasi dapat diisi saat konfigurasi; tidak ada jabatan atau nominal contoh yang menjadi aturan wajib perusahaan. SO normal tetap otomatis; hanya pengajuan unlock SO memakai approval.

| Isian aturan | Fungsi |
|---|---|
| Kode & Nama Aturan | Identitas aturan, aktif/nonaktif, versi dan tanggal berlaku |
| Jenis Pengajuan | PR, PO Supplier, PO Vendor, pembayaran, rencana/perubahan/kunjungan di luar rencana, harga/diskon khusus, sampel, unlock SO |
| Cakupan & Kondisi | Perusahaan, jenis kebutuhan, departemen/pemohon, supplier/vendor, pelanggan/produk atau alasan unlock yang relevan; hanya field yang didukung jenis pengajuan |
| Dasar & Batas Kewenangan | Nominal atau persen diskon/jenis pengajuan; dasar nilai, mata uang, batas bawah/atas dan inklusivitas harus jelas. Net target penjualan tidak otomatis menjadi dasar limit persetujuan |
| Tahap Persetujuan | Satu atau beberapa tahap berurutan; nama tahap, pihak pemberi keputusan dan syarat penyelesaian |
| Pemberi Persetujuan | Pengguna tertentu, anggota peran berizin dalam cakupan, atau atasan pemohon dari penugasan aktif |
| Syarat dalam Satu Tahap | Cukup satu pihak yang memenuhi syarat, atau seluruh pihak yang ditunjuk. Pilihan eksplisit; satu orang dengan beberapa peran tetap dihitung satu orang |
| Delegasi/Pengganti | Pengguna pengganti, alasan, jenis pengajuan/cakupan, batas kewenangan dan tanggal mulai/berakhir |
| Persetujuan Sendiri | Default Tidak Diizinkan. Pengecualian eksplisit per jenis aturan memerlukan alasan, versi, scope dan audit; multi-peran tidak mengubah default |
| Pengingat & Eskalasi | Tenggat keputusan, pengingat, pihak pengganti/escalation yang memang berwenang; terlambat tidak berarti otomatis disetujui |
| Pemicu Persetujuan Ulang | Field bisnis yang membuat keputusan versi lama tidak berlaku; perubahan catatan administratif dapat dikecualikan |

Menu **Setting → Pengaturan Persetujuan** memakai tab **Aturan · Tahapan · Delegasi · Riwayat**. Daftar menunjukkan jenis, cakupan, batas, tahap, versi dan status. Tindakan **Tambah Aturan**, **Simpan Draft**, **Simulasikan Alur**, **Aktifkan**, **Nonaktifkan** mengikuti izin. Simulasi memilih contoh dokumen dan menampilkan aturan yang cocok, dasar nilai, tahapan, pihak yang memenuhi syarat dan konflik konfigurasi; tidak menghasilkan keputusan bisnis.

Validasi sebelum aktivasi: minimal satu jalur keputusan yang valid bagi pengajuan wajib; batas tidak ambigu; mata uang/dasar perhitungan jelas; aturan tumpang tindih mempunyai prioritas eksplisit; atasan/delegasi aktif; jumlah pihak memenuhi syarat tahap. Jika pencocokan belum lengkap atau tidak ada approver valid, dokumen tetap tertahan dengan pesan konfigurasi dan dapat diajukan ulang setelah diperbaiki. Simpan draft konfigurasi yang belum lengkap tetap diperbolehkan. Aturan kunjungan tetap mensyaratkan atasan sebagaimana keputusan pengguna, termasuk ketika memakai atasan pengganti resmi.

Daftar penerapan awal:

| Pengajuan | Dasar penilaian | Setelah disetujui |
|---|---|---|
| PR persediaan/operasional | Kebutuhan, nilai estimasi, jenis barang/aset/jasa dan cakupan | Masuk Perencanaan Pembelian; tidak otomatis membuat PO |
| PO Supplier | Supplier/MOU, produk, qty, harga, TOP dan ongkir | Dapat diterbitkan ke supplier sesuai izin |
| PO Vendor | Vendor, barang/aset/jasa, qty/nilai, kontrak dan TOP | Dapat diterbitkan ke vendor sesuai izin |
| Pembayaran | Tagihan/utang atau uang muka, nominal, penerima dan rekening | Layak diproses petugas pembayaran; approval tidak berarti transfer sudah terjadi |
| Kunjungan/perubahan/di luar rencana | Atasan pemohon, tanggal, pelanggan, lokasi, tujuan dan versi rencana | Pelaksanaan sesuai rencana yang disetujui; fakta tanpa approval tetap ditandai untuk review |
| Harga/diskon khusus | Pelanggan, produk/satuan, harga/diskon efektif, qty/syarat dan masa berlaku | Berlaku untuk baris/versi/cakupan yang disetujui; tidak mengubah pricelist global otomatis |
| Sampel | Produk/qty, biaya sesuai izin, pelanggan, tujuan trial dan sifat barang | Gudang dapat menyiapkan jumlah yang disetujui; stok berkurang saat issue aktual |
| Unlock SO | Alasan kunci, kondisi, lingkup pengecualian, limit dan masa berlaku | Grant terbatas lalu sistem mengevaluasi ulang SO; bukan pembebasan semua aturan |

PR/PO tetap berada di **Warehouse & Logistik → Pengadaan**, pembayaran di Finance, kunjungan/harga/sampel/unlock di modul asal. Antrean **Persetujuan Saya** pada Dashboard menampilkan tugas lintas modul menurut penunjukan dan hak akses. Pengguna boleh merangkap peran; akses konfigurasi aturan tidak otomatis memberi hak memutuskan semua transaksi.

Status pengajuan: **Draft → Menunggu Persetujuan → Disetujui / Perlu Revisi / Ditolak**, dengan Dibatalkan bila ditarik sesuai izin dan Kedaluwarsa hanya untuk jenis yang memiliki masa berlaku. Status transaksi, pemenuhan, posting dan pembayaran tetap terpisah. Pada detail, tampilkan ringkasan dokumen, versi, perubahan, dasar batas kewenangan, lampiran dan riwayat tahap; tombol **Setujui**, **Minta Revisi**, **Tolak**. Alasan wajib untuk revisi/penolakan; catatan persetujuan dapat diwajibkan oleh aturan.

Keputusan mengikat versi bisnis dan snapshot aturan. Perubahan material (pihak, produk/qty, nilai/harga/diskon, TOP, rekening tujuan, jadwal/lokasi kunjungan, lingkup unlock) memerlukan revisi dan evaluasi ulang jalur. Rancangan awal mengulang tahapan yang diwajibkan aturan atas versi baru; tidak menyalin persetujuan lama secara otomatis. Dokumen sudah terbit/posted diselesaikan melalui revisi/koreksi yang sah, bukan diedit tanpa jejak. Status teknis atau komentar biasa tidak membatalkan approval jika tidak mengubah dasar keputusan.

Delegasi tidak memperluas kewenangan: pengganti harus ditunjuk, masih berizin, dalam cakupan/limit delegasi, serta memenuhi aturan persetujuan sendiri. Simpan pihak asal dan pelaksana sebenarnya. Sistem mengecek hak terkini saat keputusan; hak dicabut, akun nonaktif atau delegasi berakhir tidak dapat dipakai walaupun sebelumnya tercantum di antrean. Perubahan aturan hanya berlaku pada pengajuan baru/revisi; perpindahan pengajuan berjalan ke aturan baru memerlukan tindakan berizin dan audit. Perangkapan peran tidak menggandakan suara dan tidak membenarkan memutuskan tahap yang belum aktif.

Sebelum implementasi, isi pihak, batas, prioritas aturan, tenggat serta delegasi yang sebenarnya. Fitur persetujuan parsial hanya diberikan untuk jenis transaksi yang mendukungnya (misalnya harga per baris), dengan qty/lingkup keputusan eksplisit; bukan tombol umum yang otomatis memotong PR/PO.

### 3.2 Setting — Template Cetak dan Penomoran Dokumen

Rancangan untuk pembahasan pengguna: dua menu terpisah, tampilan ringkas tanpa paragraf penjelasan permanen.

**Template Cetak:** daftar jenis dokumen, nama template, versi, default dan status. Editor menampilkan pengaturan di kiri dan pratinjau di kanan. Isian: nama, jenis dokumen, ukuran kertas/orientasi, margin, logo/header identitas perusahaan, kolom yang ditampilkan, footer/catatan serta area tanda tangan. Aksi: Preview, Simpan Draft, Publikasikan dan Jadikan Default sesuai izin. Pada HP, pengaturan dan preview dibuka bergantian. Format awal disediakan per jenis dokumen; pengaturan cetak bukan tempat mengubah jumlah/nilai transaksi. Blueprint ini menjadi kontrak final submenu **Setting → Template Cetak**.

Jenis dokumen mencakup SO, Proforma, Picking Slip, Packing List, Surat Jalan, Invoice, PO, bukti penerimaan/pembayaran dan kartu piutang. Kolom harga/pajak/tanda tangan mengikuti relevansi dokumen dan hak akses. Preview memakai data contoh berlabel atau dokumen yang pengguna berhak baca; preview draft diberi penanda Draft. Proforma/Picking Slip tetap mengikuti alokasi tahap terkait dan Packing List mengikuti aktual checking, meskipun template diganti. Template tidak dapat memasukkan stok backorder sebagai barang dipenuhi.

Publikasi menghasilkan versi template. Dokumen yang sudah diterbitkan menyimpan snapshot data, versi template dan file hasil; cetak ulang memakai nomor dan versi historis yang sama. Revisi cetak memakai aksi/revisi terlacak apabila diperlukan, bukan perubahan otomatis semua dokumen lama saat template default diubah. Dokumen bertanggal periode seperti kartu piutang menyimpan parameter periode/tanggal acuan serta waktu pembuatan saat diarsipkan. XML pajak keluaran Coretax memakai generator dan template schema terpisah sesuai dokumen 38, bukan editor template cetak umum. Berkas pajak resmi dari otoritas dapat diunggah dan diarsipkan dengan referensi dokumen internal.

**Penomoran Dokumen:** daftar jenis dokumen dan contoh nomor; editor ringkas memuat awalan, komponen tahun/bulan, pemisah, panjang urutan, reset Tidak Pernah/Tahunan/Bulanan dan preview. Contoh usulan: SO/2026/10/0001. Lingkup default per perusahaan + jenis dokumen + periode reset; seri tambahan hanya jika ditetapkan kebijakan. Hindari dua seri menghasilkan nomor final sama.

Draft memakai referensi sementara. Nomor resmi SO diberikan saat pengajuan berhasil dicatat, termasuk bila evaluasi berikutnya menghasilkan hold; untuk dokumen lain saat diterbitkan/diposting sesuai jenis. Preview/cetak ulang tidak mengambil nomor baru. Pengambilan nomor dan penerbitan harus atomik serta aman terhadap pengguna bersamaan/retry. Nomor dokumen batal tetap tersimpan dan tidak digunakan ulang; histori pembatalan terlihat. Nomor urut awal untuk migrasi ditetapkan admin berizin sebelum seri digunakan dengan pemeriksaan benturan; counter seri terpakai tidak bebas diturunkan.

Perubahan format berlaku untuk penerbitan berikutnya sesuai tanggal efektif dan tidak mengganti nomor historis. UI menampilkan nomor terakhir dan preview, dengan hak pengelolaan terpisah dari hak cetak. Semua perubahan template/penomoran diaudit. Nomor PO pelanggan, invoice supplier dan nomor faktur pajak resmi merupakan referensi eksternal terpisah dari nomor dokumen internal; nomor faktur pajak tidak dibuat oleh counter ERP.

## 4. Anatomi halaman dokumen

Ketentuan ongkir disetujui pengguna: Proforma, Invoice Penjualan dan Tagihan Supplier memiliki field **Ongkos Kirim** pada ringkasan nilai. Tampilan ringkas: Subtotal Barang, Diskon, Ongkos Kirim, Pajak, Total, dengan perhitungan sesuai sumber/aturan pajak agar diskon atau ongkir tidak dihitung dua kali. Sediakan pilihan **Termasuk harga** yang tidak menambah total. Detail penanggung/pembayar dan basis sekali per pesanan/per pengiriman dapat dibuka saat diperlukan. Untuk landed cost, pilihan basis default adalah **Nilai Pembelian Net**; berat, volume, qty atau rata hanya dapat dipilih bila data dasar tersedia. Nilai pelanggan diteruskan dari SO/Proforma; biaya ekspedisi aktual tetap berada pada detail pengiriman. Ongkir ditagih ekspedisi terpisah memakai tagihan ekspedisi tertaut, bukan field supplier barang yang digandakan. Dokumen posted menampilkan nilai read-only dengan tindakan koreksi sesuai izin.

Header: jenis + nomor + status + pelanggan/supplier + tanggal. Baris status memisahkan approval, kredit, stok dan pembayaran. Detail: baris produk/jumlah/satuan/harga, total/net/tax, alamat dan termin. Tab aktivitas berisi dokumen terkait, lampiran, komentar internal, approval dan audit. Footer menunjukkan aksi berikutnya yang diizinkan.

Khusus SO, tampilkan **Hasil validasi**, **Kredit**, **Stok**, dan bila ada **Pengajuan unlock**; tidak ada tombol Setujui SO atau Menunggu approval SO pada alur normal. Status unlock: Belum diajukan, Menunggu keputusan, Disetujui, Ditolak, Kedaluwarsa, Perlu pengajuan ulang, atau Tidak lagi diperlukan. Sesudah unlock disetujui, tampilkan alasan yang dikecualikan dan batasnya; jangan menampilkan Lolos semua jika stok atau syarat lain masih bermasalah.

Grid SO selalu menampilkan semua item pesanan, termasuk stok kosong. Kolom utama: Produk, Dipesan, Teralokasi, Terkirim, Backorder, Ditutup/Dibatalkan; panel baris menampilkan satuan/konversi, aktual picking, diterima, ditagih serta rincian alasan/riwayat. Nilai dipesan tidak berubah karena sisa ditutup. Angka teralokasi/picking dan terkirim/diterima mempunyai hubungan subset; jangan menjumlahkan semua kolom sebagai total. Pada HP, gunakan kartu ringkas per item dengan rincian yang dapat dibuka.

Saat memilih produk pada Draft, sales berizin melihat stok tersedia untuk pesanan baru, jumlah dipesan dan perkiraan kekurangan, disertai waktu pembaruan. Angka ini informatif dan belum dicadangkan. Credit hold membatasi alokasi, bukan menyembunyikan informasi stok yang berhak dibaca. Bedakan indikator pemeriksaan stok SO belum dilakukan dari informasi availability umum; stok kosong tetap bisa dimasukkan ke SO.

Form pelanggan menyediakan termin bawaan dan limit kredit sebagai isian opsional; pengguna tanpa izin kredit tidak mendapat field limit yang dapat disimpan. Kebijakan COD awal pelanggan baru hanya berlaku bila dinyalakan di Setting. Form pelanggan juga memuat status PKP/Non-PKP, metode pembayaran, jadwal tukar faktur, PIC penagihan/gudang, toleransi hari pembayaran dan status verifikasi onboarding. Pada tahap prepay, tampilkan nilai Proforma, dana diterima/terverifikasi yang ditautkan, dan kekurangan pembayaran; tombol Kirim tertahan sampai dana cukup dan syarat gudang selesai. Pada COD, invoice diposting setelah POD dengan due date tanggal POD. Unggah bukti tidak menghasilkan label pembayaran terverifikasi. Status Pesanan tetap memakai lima label pilihan pengguna; menunggu pembayaran adalah informasi pada dimensi pembayaran.

Tab **Pemenuhan** mengelompokkan dokumen per tahap. Pratinjau Proforma/Picking Slip hanya berisi alokasi tahap tersebut; Packing List memuat aktual lolos checking. Item backorder tetap terlihat pada tab SO/Sisa Pesanan, tidak masuk baris cetak dokumen pemenuhan. Jika tidak ada alokasi, tombol penerbitan menjelaskan “Belum ada stok yang dapat dipenuhi”. Selisih aktual menampilkan tindakan revisi dengan tautan versi dokumen sebelumnya.

Dialog **Tutup Sisa Pesanan** memilih baris/jumlah dan alasan, lalu menjelaskan sisa yang berhenti dipenuhi. Dialog **Batalkan SO/Sisa** meminta catatan konfirmasi pelanggan (pihak, waktu, media, isi/referensi; lampiran opsional) dan menampilkan dampak pada alokasi, picking, dokumen serta uang muka. Pengguna melihat **Pembatalan dalam penyelesaian** bila gudang masih perlu mengembalikan barang. Untuk transaksi sudah dikirim/ditagih, arahkan ke penyelesaian terkait dan pembatalan sisa; jangan memberi pesan seluruh transaksi berhasil dihapus.

Label pilihan pengguna: **Status Pesanan: Draft, Open, Selesai, Closed, Cancelled**; **Status Pemenuhan: Belum Dikirim, Sebagian, Terkirim Semua**; **Sisa: Backorder, Proses Pemenuhan, Ditutup**. Badge dapat bersamaan, misalnya **Open · Sebagian · Backorder**, dengan **Kredit lolos** dan **Dibayar sebagian** di dimensi terpisah. Sisa mengikuti jumlah per item, sehingga Backorder dan Proses Pemenuhan dapat sama-sama muncul. Setelah sisa ditutup dan pekerjaan kirim selesai, contoh statusnya **Closed · Sebagian · Ditutup**, sedangkan outstanding AR tetap terlihat. Sebelum cek stok, status Sisa kosong dengan keterangan pemeriksaan belum dilakukan; jika tidak ada sisa tampilkan “—”. Pembatalan dalam penyelesaian adalah indikator tugas, bukan tambahan enum Status Pesanan. Acuan perilaku mengikuti [User Flow](06-user-flow.md).

Dokumen posted menampilkan detail read-only dan tombol koreksi bila berwenang. Pada transaksi yang memakai approval, perubahan draft menunjukkan dampak pada approval. Pada SO, perubahan bisnis menunjukkan dampak pada validasi dan grant unlock; proses normal tidak membutuhkan konfirmasi persetujuan/release tambahan. Dialog konfirmasi dipakai untuk posting, close, reversal dan keputusan unlock dengan ringkasan akibat; simpan draft tidak memerlukan konfirmasi berulang.

## 5. Pola status dan error

Layar Login menampilkan identitas evflow, field akun dan kata sandi, langkah MFA bila diwajibkan, serta pesan kredensial/sesi yang jelas tanpa mengungkap keberadaan akun. Setelah login berhasil, tampilkan status menyiapkan akses sampai profil dan izin efektif termuat; jangan menampilkan menu atau data privat dari sesi sebelumnya. Jika izin berubah saat layar aktif, perbarui menu dan data sesudah validasi ulang; jika sesi dicabut, tutup tampilan privat dan kembali ke Login dengan pesan **Sesi berakhir. Silakan masuk kembali.** Formulir atau transaksi yang responsnya belum pasti tetap ditandai belum terkonfirmasi setelah masuk lagi.

Renovasi Login Office memakai panel identitas biru dari token semantik yang sudah ada dan form ringkas dengan komponen resmi shadcn/ui; ini bukan perubahan tema seluruh produk atau implementasi login Field. Form memuat **Email**, **Kata Sandi**, tombol **Masuk**, kontrol **Tampilkan/Sembunyikan Kata Sandi** dengan nama aksesibel serta indikator **Caps Lock aktif**. Label tetap terlihat; validasi inline terhubung ke field, dan ringkasan error dapat menerima fokus agar kesalahan mudah ditemukan dengan keyboard. Panel dan form mengikuti viewport 360 px hingga desktop tanpa overflow halaman. MFA tetap opsional sesuai keputusan 26 September 2026.

Kredensial valid dengan beberapa perusahaan aktif membuka langkah kedua **Pilih Perusahaan**, berupa dropdown nama perusahaan yang diberikan server, tindakan melanjutkan masuk dan **Kembali**. Jangan meminta UUID perusahaan sebagai input pengguna atau menampilkan perusahaan di luar daftar berizin. Kembali membersihkan email/kata sandi dan pilihan perusahaan; kredensial hanya disimpan sementara dalam memori, dibersihkan juga setelah sukses atau unmount. Backend tetap memeriksa ulang seluruh kredensial/membership saat pilihan dikirim.

Kontrak pilihan tetap hanya `id` dan `name`. Bila beberapa nama perusahaan sama setelah normalisasi Unicode NFKC, huruf besar/kecil dan whitespace (termasuk merapatkan whitespace internal), opsi yang ambigu dinonaktifkan pada picker. Opsi dengan nama unik tetap dapat dipilih. Tampilkan pemberitahuan inline yang jelas agar pengguna meminta administrator membedakan nama pada Profil Perusahaan; bila semua opsi ambigu, tombol melanjutkan nonaktif dengan alasan sampai nama diperbaiki, sementara **Kembali** tetap aktif. UUID mentah tidak ditambahkan pada label pengguna. Ini pengaman UX, bukan perubahan kemampuan membership atau otorisasi backend.

Pisahkan keadaan **Sedang masuk**, **Menyiapkan akses**, pemilihan perusahaan, validasi, batas percobaan, layanan tidak tersedia dan jaringan bermasalah. Setelah login sukses, kegagalan `/auth/me` menyediakan **Coba Lagi** untuk memuat akses tanpa mengulangi login. Pesan kredensial tidak mengungkap keberadaan akun; error penting tetap terlihat di halaman, bukan hanya toast. Disclosure **Bantuan masuk** mengarahkan pengguna menghubungi admin dan menjelaskan bahwa pemulihan kata sandi belum tersedia; tidak menyediakan tautan recovery yang memberi kesan sudah berfungsi. Keberhasilan UI tidak menyatakan seluruh IAM siap produksi.

- Status selalu memakai teks selain warna: Draft, Menunggu persetujuan, Kredit ditahan, Stok sebagian, Diposting, Lunas sebagian.
- Alasan hold menjelaskan fakta dan tindakan, misalnya “Invoice INV-004 lewat jatuh tempo 12 hari. Buka piutang atau ajukan pengecualian.”
- Tombol disabled disertai alasan. Status tidak diperbaiki dengan tombol “Selesai” bebas jika prasyarat belum terpenuhi.
- Loading tidak menampilkan saldo nol; empty state “Belum ada transaksi”; gagal memuat “Data belum dapat dimuat”.
- Data contoh selalu berlabel **Data simulasi**. Angka, nama pelanggan dan tanggal contoh tidak diklaim sebagai data perusahaan.
- Saldo/metric mempunyai tanggal acuan dan tautan ke rincian. Selisih rekonsiliasi tidak disamarkan oleh pembulatan tampilan.

## 6. Komponen dan perilaku UI

Komponen: AppShell, PageHeader, WorkQueue, DataTable, StatusBadge, Toast, MoneyInput, QuantityWithUom, ApprovalTimeline, DocumentLinks, AuditTrail, ImportPreview, ReconciliationPanel, CloseChecklist. Semua form memiliki label, fokus keyboard, field error dan ringkasan error saat submit. Toast memiliki `aria-live` sesuai tingkat urgensi, dapat ditutup dengan keyboard, tidak menutupi aksi utama, dan tidak menjadi satu-satunya tempat menampilkan error penting atau blocker transaksi.

`DataTable` memakai TanStack Table dan styling Tailwind: header sort yang dapat digunakan dengan keyboard, filter berlabel, pilihan kolom, angka rata kanan, pagination server dan state loading/empty/error. Tabel React dan Vue mengikuti perilaku yang sama. Kolom harga modal/gaji hanya tersedia bila API mengizinkan data tersebut. Grand total ditampilkan dari hasil agregasi server, terpisah dari subtotal baris yang terlihat. Saat filter berubah, kembali ke halaman awal. Pagination mengikuti cursor sebelumnya/berikutnya, tanpa angka jumlah halaman yang belum diketahui.

TanStack Query mempertahankan data memori untuk navigasi yang nyaman, dengan indikator pembaruan bila diperlukan. Posting, pembayaran dan perubahan stok menampilkan status menunggu selama request; toast sukses tampil setelah konfirmasi server. Jika hasil belum pasti akibat koneksi terputus, toast tidak menyatakan sukses atau gagal final; halaman menampilkan status belum terkonfirmasi dan tindakan periksa status, bukan tombol yang diam-diam mengulangi pembayaran. Drawer, dialog dan tabel tetap memakai semantic markup/fokus yang diuji; Tailwind, TanStack Table dan paket toast tidak otomatis menyelesaikan aksesibilitas seluruh alur.

Responsive: layar desktop sekitar 1024–1440 px; tablet menumpuk panel; HP 360 px memperlihatkan tindakan utama dan mengubah daftar kunjungan menjadi kartu. Tabel akuntansi lebar boleh scroll dalam area tabel, tanpa membuat seluruh halaman melebar. Kontrol sentuh minimal sekitar 44 px. Modal tidak menyembunyikan error di luar viewport.

## 7. Contoh tampilan interaktif

Contoh dalam percakapan memperlihatkan lima area: ringkasan finance, SO/kredit, closing, kalkulator harga, dan kunjungan. Semua interaksi bersifat simulasi lokal. Contoh memperagakan hold kredit sebelum cek stok, close yang diblokir prasyarat, dan perbedaan margin/markup. Itu bukan sistem approval atau mesin akuntansi produksi. Setelah keputusan stack, layar kantor ditujukan untuk React dan layar kunjungan/tugas gudang untuk Vue; contoh sebelumnya tetap referensi interaksi, belum implementasi kedua framework atau PWA.

Contoh tampilan awal dibuat sebelum keputusan SO otomatis pada rancangan v0.4 dan pemenuhan parsial pada v0.5. Label persetujuan komersial dalam contoh lama sudah tidak berlaku untuk SO normal; acuan perilaku terbaru adalah dokumen ini serta User Flow. Contoh awal belum memperagakan layar unlock, tahap pemenuhan, penutupan sisa dan pembatalan yang terbaru.

Pilihan desain yang dapat dievaluasi: kerapatan baris dan bentuk sudut panel. Penyesuaian ini tidak mengubah aturan bisnis. Navigasi modul lengkap dirinci dalam dokumen; contoh hanya membuat layar prioritas yang bisa ditinjau.

## 8.1. Pembaruan navigasi dan target — 24 September 2026

Urutan navigasi utama yang disepakati: **Dashboard**, Sales & Marketing, Warehouse & Logistik, Finance, HRIS, Master Data, Setting. Dashboard menggantikan label Beranda.

- **Sales & Marketing → A/T Penjualan**: penyusunan dan pemantauan target penjualan.
- Pada kartu A/T arah meningkat, gunakan **Aktual ÷ Target × 100%**. Untuk arah menurun, gunakan **max(0%, min(200%, 200% − Aktual ÷ Target × 100%))**. Nilai aktual, target, satuan dan arah tetap terlihat. Target nol/belum ditetapkan tampil “—”.
- **Finance → A/T Tagihan**: penyusunan dan pemantauan target penagihan.
- Kedua halaman menyediakan periode bulanan, triwulan, semester, tahunan; pilihan penerima target dari pengguna aplikasi; cakupan pelanggan/channel/rayon; target, aktual, persentase, selisih, rincian transaksi dan riwayat revisi. Satu pengguna dapat menerima kedua jenis target tanpa terikat jabatan/peran.
- Hak menetapkan/merevisi target serta melihat rekap mengikuti matriks hak akses. Pembagian pencapaian tidak boleh menggandakan angka perusahaan.
- Dashboard menampilkan kartu ringkasan, grafik seperlunya, serta Perlu Ditindaklanjuti sesuai izin pengguna. Nilai SO, invoice diposting dan pembayaran diterima dipisahkan. Detail aturan mengikuti TGT-01–11 dan DSH-01–02 pada Requirements.

Form target mendukung urutan **Jenis → Skema → Cakupan → Penerima → Periode → Nilai & Satuan Target**. Satu pengguna dapat menerima beberapa skema. Katalog yang disetujui ada pada Requirements: sembilan skema penjualan, enam skema penagihan dan jumlah kunjungan berhasil. Gunakan isian kondisional agar target nilai tidak meminta satuan barang, sedangkan target qty menampilkan produk/satuan yang relevan. Nilai per SKU dan jumlah SKU unik menjadi pilihan berbeda.

Tabel pencapaian memuat penerima/cakupan, skema, target, aktual, satuan, **A/T (%)**, selisih dan akses rincian sumber. Tampilkan subtotal hanya untuk metrik/satuan yang sebanding; jangan menjumlahkan KPI kategori dengan total penjualan, mencampur rupiah dengan qty, atau menjumlahkan SKU/pelanggan unik lintas bulan. Detail penagihan dapat menampilkan invoice sasaran, sisa piutang, jatuh tempo dan penanggung jawab. Nota kredit disajikan terpisah dari pembayaran. Fokus awal penagihan yang disepakati: total penerimaan, jatuh tempo periode ini dan pemulihan tunggakan.

### Estimasi Penjualan dan Estimasi Penagihan

Menu **Sales & Marketing → Estimasi Penjualan** dan **Finance → Estimasi Penagihan**. Keduanya menyediakan periode, tanggal acuan, penerima/penanggung jawab, cakupan pelanggan/channel/rayon sesuai izin, versi estimasi, tabel rincian dan histori perubahan. Tindakan utama: **Susun Estimasi**, **Ambil Usulan**, **Simpan Versi**, **Lihat Realisasi**. Usulan tidak otomatis menetapkan nilai.

- Penjualan: pelanggan, produk, qty/satuan, harga net/nilai net, tanggal perkiraan invoice diposting, sumber peluang/penawaran/PO-SP/SO, confidence dan catatan. Dapat beberapa produk per pelanggan. Pilihan skenario nominal/berbobot diberi label jelas; tidak dijumlahkan.
- Penagihan: pelanggan, nomor invoice, jatuh tempo, sisa piutang, estimasi pembayaran/tanggal, janji bayar atau hasil follow-up, penanggung jawab dan catatan. Cicilan dapat beberapa baris tanggal; tunjukkan bagian terealisasi dan sisa rencana. Estimasi pembayaran tidak melampaui piutang yang masih dapat ditagih.
- Ringkasan: **Target · Estimasi Akhir Periode · Aktual · E/T (%) · A/T (%) · Selisih**. Tampilkan tanggal acuan dan satuan; nol/belum ada target tidak menghasilkan pembagian nol. E/T berarti estimasi akhir periode ÷ target, tidak mengganti A/T.
- Estimasi akhir periode menggabungkan aktual sampai tanggal acuan dan tambahan yang masih diperkirakan; penjualan net dan penerimaan tagihan memakai dasar masing-masing. Pembayaran/invoice yang sudah nyata tidak dijumlahkan lagi sebagai estimasi tersisa. Periode dan minggu diturunkan dari tanggal yang benar.
- Halaman Dashboard dapat menampilkan perbandingan target/estimasi/aktual dengan tautan ke rincian. Tetap gunakan label singkat dan tampilkan detail sumber saat dibuka.

## 8. Kriteria review desain

Staf finance dapat menemukan invoice tertunggak dan sumber saldo; gudang memahami batch yang boleh dipilih; sales dapat mengisi hasil kunjungan melalui HP; pengguna memahami mengapa close belum tersedia; pengguna yang tidak berhak tidak melihat harga modal/payroll. Uji layar kosong/loading/error, keyboard, 360 px dan desktop, serta tabel/nominal panjang. Uji pengguna sebenarnya dilakukan pada pilot, bukan dinyatakan selesai dari mockup.

### Status master pelanggan yang diperbarui

Master pelanggan memisahkan tiga hal: **tahap hubungan** (Prospek, Terdaftar, Bertransaksi), **status onboarding** (Draft, Menunggu Verifikasi, Terverifikasi, Perlu Perbaikan, Ditangguhkan), dan **kebijakan pembayaran** (COD 3 bulan, Prepay, atau Credit setelah evaluasi Finance). Field tambahan yang tersimpan adalah jenis pelanggan/potensi, jadwal tukar faktur, metode pembayaran, toleransi hari, status WAPU, PIC penagihan/gudang, serta riwayat legalitas dan dokumen. Freeze H+30 disimpan sebagai hasil policy piutang, bukan status yang menghapus atau menonaktifkan master pelanggan.












### Navigasi Anggaran

**Finance → Anggaran** memiliki submenu Penyusunan Anggaran, Review & Persetujuan, Budget Check, Komitmen, Transfer/Revisi, Budget vs Actual, Forecast, dan Riwayat Versi. Form ringkas menampilkan periode, akun/kategori, dimensi, anggaran, komitmen, realisasi, sisa, persentase serapan dan varians. Drill-down membuka dokumen sumber sesuai izin.


### Navigasi Aset Tetap

**Finance → Aset** berisi Aset dalam Proses, Register Aset, Kapitalisasi, Penyusutan, Mutasi & Serah Terima, Perawatan, Stock Opname, Impairment/Pelepasan, Rekonsiliasi dan Laporan. **HRIS → Karyawan & Kontrak → Detail Karyawan → Aset** menampilkan aset yang digunakan, serah terima, pengembalian dan checklist offboarding dari transaksi assignment yang sama.

---

## Implementasi CRM web — 29 September 2026

Sales & Marketing → CRM → Prospek / Kontak / Pelanggan (tautan Master Pelanggan dengan izin terpisah). Route, frame, state, dan gap implementasi ada pada [catatan CRM](../mockup/crm-build.md). Ini tidak menyatakan seluruh alur CRM telah operasional.


## Pengelolaan akses — keputusan 7 Oktober 2026

IAM-01/04/11: pengguna dapat memiliki beberapa peran; izin efektif adalah gabungan izin peran aktif sesuai scope. Pengelolaan akun dan peran hanya untuk pemegang peran aktif Admin Sistem (`ADMIN_SYSTEM`) dalam perusahaan sesi, dengan permission aksi yang sesuai. Nama jabatan atau nama tampilan peran bukan bukti administrator. Pengguna → pilih akun → tetapkan beberapa peran; Peran → Atur Hak Akses → ubah checkbox matriks peran → simpan. Menu Pengguna/Peran/Matriks disembunyikan bagi nonadministrator; deep link dan seluruh endpoint `/users`, `/roles`, `/permissions` beserta mutasinya ditolak 403 walaupun permission IAM terlanjur diberikan. Pengaturan bisnis lain tetap mengikuti permission domain. Tidak ada bypass izin transaksi untuk Admin Sistem. Perubahan akses diaudit dan sesi terdampak dicabut. Tidak ada perubahan model database atau migration; implementasi dan batas validasi dicatat pada [catatan pengelolaan akses](../development/iam-admin-only-2026-10-07.md).


### Penyempurnaan interaksi sidebar Office — 7 Oktober 2026

APP-03/NFR-05: cabang aktif terbuka saat awal, pilihan kelompok dan scroll bertahan saat navigasi per pengguna/perusahaan, mode ciut bertahan melalui preferensi browser. Mode ciut desktop menyediakan flyout submenu yang sama dengan Escape/fokus kembali; mobile memakai drawer. Hierarki dan IAM-01/04 tidak berubah. Presentasi visual mengikuti [standar global web](../mockup/web-design-standard.md).


Koreksi review sidebar 7 Oktober 2026: gunakan accordion satu modul dan satu submenu per tingkat. Membuka saudara menutup cabang sebelumnya beserta turunannya; menutup induk mereset turunan. Profil footer tetap ringkas: nama dan peran satu baris dengan elipsis, peran lengkap pada title.


### Arah visual Dashboard terbaru — 7 Oktober 2026

Keputusan 23 Oktober 2026: aksen emerald diganti biru dari logo evflow untuk seluruh Office (navy `#071A4A`, primer `#0B4DA2`, fokus `#1F7FE0`), dengan pita judul bergradien, ikon satu warna bergaris tegas, menu akun dan notifikasi di topbar, tab garis bawah dan popup filter; rincian normatif di [standar global](../mockup/web-design-standard.md). Sebelumnya: pengguna menyetujui tema terang netral-charcoal, emerald dan Plus Jakarta Sans untuk Dashboard, menggantikan ketentuan biru/Inter sebelumnya pada permukaan tersebut. Ringkasan Eksekutif memprioritaskan akses tugas, KPI terpisah, tindak lanjut, analisis dan akses cepat berizin. Hierarki tujuh tampilan, izin, formula dan sumber data tidak berubah. Lihat [standar global](../mockup/web-design-standard.md) dan [cakupan modernisasi](../mockup/dashboard-modern-2026-10-07.md).

### Akses Proforma operasional — 7 Oktober 2026

Sales & Marketing → Pesanan Pelanggan → Proforma membuka /operations/proformas. Daftar lintas SO memisahkan nomor Proforma, SO, pelanggan, tahap pemenuhan, tanggal terbit dan status dokumen. Cari nomor/SO/pelanggan, pagination, lihat/cetak; detail /operations/proformas/{id} menyediakan Daftar Proforma dan Buka Sales Order. Tidak ada tombol Buat Proforma: dokumen berasal dari alokasi otomatis. Proforma memakai izin sales_order.read tanpa mensyaratkan fulfillment.read. Tautan dari detail SO membuka konteks Proforma yang sama.

## Redesign Sales Office - 16 Oktober 2026

Acuan pengguna Redesign-UI-Sales.pdf mengganti komposisi Sales: navigasi SO/Proforma/Invoice sesuai izin, KPI dan filter status, form SO lima kelompok bernomor, enam tab detail SO, dokumen dan penyerahan di kiri dengan ringkasan di kanan. Tombol primer hijau, outline hijau dan badge bertitik semantik. Penerbitan Proforma merupakan tindakan pengguna pada alokasi yang tersedia; bukan otomatis saat membuka daftar. Cakupan implementasi dan selisih PDF: [Redesign Sales](../development/sales-redesign-2026-10-16.md).
# Keputusan desain IAM terbaru — 16 Oktober 2026

Peran adalah kelompok hak fleksibel yang dapat dibuat, diubah dan dihapus. Layar Matriks Hak Akses menampilkan fitur/tindakan tanpa heading maupun filter domain; kelompok fitur diperbolehkan. Admin Sistem dapat memakai semua menu dan tindakan dalam perusahaan sesi tanpa bergantung pada grant peran, termasuk approval sendiri/tanpa penunjukan. Penghapusan peran menampilkan jumlah anggota terdampak sebelum konfirmasi. Ketentuan IAM 7 Oktober tentang permission tambahan dan larangan bypass transaksi digantikan keputusan ini.

Koreksi pengguna: baris matriks mengikuti urutan dan jalur navigasi Office (modul › kelompok › layar/fitur), tanpa filter domain tersendiri. Item yang belum memiliki capability backend ditampilkan **Belum dapat diatur** tanpa checkbox. Capability nyata milik Admin Sistem terlihat tercentang otomatis dan tidak dapat diedit; tanda tersebut bukan grant tersimpan.

Form peran baru menjelaskan bahwa semua izin katalog yang tersedia akan langsung diberikan saat disimpan. Matriks peran lama mempertahankan checkbox sesuai grant tersimpan; tombol **Pilih semua izin** mengisi izin katalog sebagai draf, lalu memakai dialog tinjau dan Simpan yang sudah ada. Tombol tersebut tidak tersedia untuk `ADMIN_SYSTEM` karena haknya otomatis.

Kolom Aksi pada daftar Pengguna dan Peran memuat tombol **Hapus** untuk Admin Sistem. Dialog pengguna menjelaskan kemungkinan hapus permanen atau arsip dan pencabutan sesi; dialog peran menyebut jumlah anggota terdampak. Tombol akun sendiri dan peran `ADMIN_SYSTEM` tidak ditampilkan. Kesalahan server tetap terlihat di dialog; daftar diperbarui hanya setelah respons berhasil.


## Redesign Pengguna dan Peran — 16 Oktober 2026

Acuan visual terbaru: Redesign UI Setting Pengguna & Peran.pdf. Daftar pengguna/peran memakai pencarian, filter, pengaturan kolom dan pagination; form buat/edit menjadi halaman penuh dengan kartu akun/peran/pratinjau izin. Detail pengguna memakai ringkasan dan tab Peran & Cakupan, Izin Efektif, Sesi, Riwayat. Detail peran memakai kartu ringkasan dan tab Matriks Hak Akses, Cakupan & Data Sensitif, Anggota, Riwayat. Matriks menyatukan tindakan per resource, memisahkan modul, menyorot perubahan, dan menyediakan tinjauan sebelum penerapan. Badge hijau untuk aktif, netral untuk nonaktif; tombol primer hijau. Cakupan khusus dan kategori data sensitif yang belum mempunyai enforcement/katalog khusus ditampilkan sebagai informasi terbatas, bukan toggle aktif. Bukti dan batas implementasi: [catatan redesign akses](../development/access-ui-2026-10-16.md).

## Matriks submenu independen — implementasi 16 Oktober 2026

Baris mengikuti hierarki navigasi. Induk murni memiliki checkbox agregat per tindakan dan kolom Semua yang mengubah grant anak, dengan status sebagian dan hitungan izin dipilih. Baris fitur operasional mempunyai grant sendiri; kolom pertama tetap terlihat saat tabel digulir horizontal. Buka semua menu/Tutup semua menu tersedia; menu tanpa capability tetap memakai status eksplisit. Pilihan satu submenu tidak mengubah submenu saudara. Label Izin bersama telah dihapus dari matriks hasil migrasi.

## Keputusan navigasi CRM — 16 Oktober 2026

CRM-01/05, MD-01, APP-03, IAM-04: Pelanggan dikelola melalui Master Data > Pelanggan. Submenu Pelanggan CRM dihapus; URL web lama /crm/customers dan turunannya dialihkan ke Master Pelanggan, dengan pemeriksaan izin tujuan. CRM menampilkan Prospek, Peluang, Kontak. Peluang memiliki daftar tersendiri dengan izin crm_opportunity.read; proses buat/hasil yang tersedia tetap melalui detail prospek. Matriks menempatkan Peluang sejajar Prospek; capability crm_customer tetap untuk proyeksi/registrasi institusi pendukung proses Prospek, pada baris Prospek > Institusi terkait, bukan submenu pelanggan kedua. Tidak menyalin grant menjadi master_customer maupun mengubah data. Bukti: docs/development/crm-navigation-2026-10-16.md.

## O2C Release 1 (29 Oktober 2026)

Label dan tindakan Release 1 memakai Surat Jalan. Tombol Invoice hanya tersedia dari Surat Jalan terbit sesuai izin efektif; status dan sisa kuantitas menampilkan akumulasi seluruh Surat Jalan.


## O2C Release 1 (29 October 2026)

Issued Surat Jalan is the stock, revenue and HPP event; customer receipt is recorded separately (decision 30 October 2026). One SO supports cumulative Surat Jalan quantities up to ordered quantity; Invoice is created only from an issued Surat Jalan. Termin/TOP is selected on SO and snapshotted. Surat Jalan uses existing outbound permission grants; no delivery_note grants are introduced.



## Backend Invoice dan Pembayaran — 30 Oktober 2026

Kontrak backend mengikuti daftar, form, detail Invoice dan Terima Pembayaran pada evflow-office-design.pen. Teks jatuh tempo pada mockup yang menyebut tanggal Invoice digantikan keputusan pengguna: tanggal SJ diterbitkan + termin. Nomor editable saat draft; Simpan draft belum memposting, Submit membentuk AR. Tab hitungan dan pencarian diproses server. Menunggu bukti potong mengungguli contoh Lunas pada mockup bila bukti wajib belum ada. Label Lihat harga tersedia pada capability Invoice. Belum ada klaim implementasi ulang frontend/visual QA tahap ini.
