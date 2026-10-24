# evflow — Blueprint ERP

## Keputusan pengguna — 24 Oktober 2026: konsolidasi pengaturan

Acuan: [desain konsolidasi](../superpowers/specs/2026-10-24-konsolidasi-pengaturan-design.md). Melengkapi keputusan arah fleksibel di bawah:

- **Satu menu, satu rumah.** Setiap menu berada di tepat satu modul; menu yang salah tempat dihapus. Semua pengaturan di Setting (Profil Perusahaan, Pengguna, Peran, Kebijakan Umum, Penomoran Dokumen, Pajak, Termin & Kredit, Jenis Potongan, Pemetaan Akun, Persetujuan); modul lain hanya transaksi dan data kerja. Halaman `/operations/controls` dihapus.
- **Pengaturan umum, bukan per pasangan.** Pengaturan umum di Setting → atribut sederhana di master data bila memang berbeda → nilai di dokumen terisi otomatis dan dapat diganti pengguna berizin. Aturan per pelanggan × produk dihentikan.
- **Pajak:** semua produk kena PPN; dokumen memakai pajak penjualan bawaan (tarif × faktor DPP, bawaan 12% × 11/12) dengan snapshot. Invoice memuat kode transaksi faktur (bawaan 01, bawaan pelanggan mis. RS Pemerintah 03).
- **Potongan pembayaran:** Terima Pembayaran memuat baris potongan (jenis, nilai, akun, bukti). Jenis Potongan di Setting menentukan akun penyelesaian dan bukti (bukti potong atau SSP/NTPN). Nilai yang wajib bukti tetap piutang berstatus Menunggu bukti potong, dihitung dalam limit kredit, dan invoice baru lunas setelah bukti diunggah.
- **Harga dan diskon:** harga otomatis = harga khusus pelanggan yang disetujui bila ada, selain itu harga jual umum; dapat diganti di SO. Batas diskon per peran, per orang (menggantikan peran) dan per produk (plafon); berlaku yang terkecil; melebihi batas tidak dapat disimpan. Harga khusus diajukan dan disetujui di Sales & Marketing.
- **Persetujuan di tempat dokumen;** pengaturan umumnya di Setting. Dashboard hanya menautkan.
- **Format nomor:** `Prefix.FormatTahun.FormatBulan.NomorUrut` (contoh `SO-SSM.2026.10.0001`), toggle reset bulanan/tahunan; perubahan mode reset berlaku periode berikutnya.
- **Identitas perusahaan** (zona waktu, tahun buku, mata uang) hanya di data perusahaan; limit kredit, freeze dan toleransi menjadi atribut Master Data › Pelanggan.


## Keputusan pengguna — 24 Oktober 2026: aplikasi fleksibel dan mudah dipakai

Acuan: [desain arah fleksibel](../superpowers/specs/2026-10-24-erp-fleksibel-design.md). Aplikasi dipakai sendiri oleh seluruh tim perusahaan dan harus terasa seperti ERP SaaS pada umumnya: langsung dapat dipakai, sedikit isian wajib, pengaturan terpusat. Keputusan ini menggantikan ketentuan lama yang bertentangan di seluruh blueprint:

- **Pengaturan terpusat dan nilai bawaan:** profil perusahaan (nama, alamat, kontak, NPWP, logo), format angka, penomoran, pajak, termin, ongkir, kredit, struktur organisasi dan persetujuan diatur di Setting oleh pengguna berizin. Konfigurasi yang dibutuhkan transaksi dibuat otomatis dengan nilai bawaan yang dapat diedit; proses hanya tertahan bila pengguna sendiri mengosongkan atau menonaktifkan konfigurasi wajib, dengan pesan yang menautkan halaman Setting terkait. Nama perusahaan tidak ditulis tetap di kode atau panduan.
- **Mata uang:** saat ini hanya Rupiah; format angka dan pembulatan dapat diatur. Multi-mata uang belum dalam cakupan.
- **Sales Order:** isian wajib minimal (pelanggan, tanggal, barang, jumlah, harga). Termin dipilih pada SO (Tunai/COD, Bayar sebelum kirim, Tempo N hari); termin bawaan pelanggan hanya mengisi otomatis, diwarisi invoice dan dapat diubah sebelum invoice diposting. TOP/limit pada master pelanggan opsional. Kebijakan COD awal pelanggan baru menjadi opsi, default nonaktif. Limit kredit memakai mode perusahaan Nonaktif/Peringatan/Blokir, default Peringatan.
- **Ongkos kirim:** Ditanggung perusahaan (COGS/biaya kirim, tidak ditagih) atau Dibebankan ke pelanggan dengan pilihan Sebelum PPN (masuk DPP) atau Sesudah PPN (tidak dikenai pajak). Default dan akun diatur di Setting.
- **Persetujuan:** satu mesin persetujuan umum untuk jenis dokumen apa pun, termasuk SO, pengecualian kredit, permintaan biaya, perjalanan dinas, entertain, call plan harian, rekonsiliasi dan cuti. Persetujuan SO boleh dinyalakan dengan kondisi; tanpa aturan aktif SO berjalan otomatis. Urutan SO: validasi → persetujuan (bila cocok) → kredit → alokasi; stok tidak direservasi selama menunggu dan antrean alokasi dihitung sejak disetujui. Unlock kredit digabung ke mesin ini.
- **Struktur organisasi:** departemen, jabatan dan atasan langsung berbasis data karyawan, termasuk karyawan tanpa akun. Keputusan persetujuan memerlukan akun; atasan tanpa akun dilewati ke atasan berakun berikutnya, lalu Admin Sistem.
- **Peran:** tidak ada peran preset yang dipaksakan. Peran dibuat bebas; matriks menu × tindakan dengan cakupan data, Pilih Semua dan salin dari peran lain. Pengelolaan Pengguna, Peran dan Hak Akses tetap khusus Admin Sistem.
- **Navigasi:** menu dan submenu yang belum berfungsi disembunyikan.
- **Tetap berlaku:** invariant posting, stok, snapshot, nomor, idempotency, izin backend dan isolasi perusahaan. Perubahan pengaturan hanya berlaku untuk dokumen baru.

## Keputusan pengguna — 23 Oktober 2026: fondasi visual biru logo

Office memakai warna dari logo evflow menggantikan aksen emerald: navy untuk navigasi aktif dan pita judul, biru merek untuk aksi utama, biru terang untuk fokus. Menu akun dan notifikasi pindah ke topbar; notifikasi berasal dari Tugas & Persetujuan sesuai izin. Ketentuan normatif: [standar desain global web](../mockup/web-design-standard.md). Keputusan ini hanya presentasi; izin, data dan aturan bisnis tidak berubah.

## Keputusan pengguna — 23 Oktober 2026: struktur detail Sales Order

Detail Sales Order memakai tab Ringkasan, Pemenuhan, Dokumen dan Riwayat. Tabel barang (dipesan, teralokasi, dikirim, diterima POD, backorder, ditutup, harga, subtotal) menjadi bagian tab Ringkasan; tab Barang tersendiri dihapus. Tab Tagihan dihapus: invoice tampil sebagai baris dokumen bertautan langsung pada tab Dokumen bersama Proforma, Picking Slip, Packing List, Surat Jalan dan POD, sesuai izin masing-masing. Daftar, Detail dan Form SO memakai kerangka Office (`OfficePage`). Keputusan ini hanya presentasi; command, izin, approval exception dan invariant pemenuhan tidak berubah. Acuan: OTC-01/04/05/10/11, [Design](07-design.md), [catatan redesign Sales](../development/sales-redesign-2026-10-16.md).

## Keputusan pengguna — 23 Oktober 2026: tab Kontak di Master Data › Pelanggan

Halaman Master Data › Pelanggan memiliki tab Pelanggan, Channel, Rayon dan Kontak. Tab Kontak menampilkan data kontak CRM yang sama dengan Sales & Marketing › CRM › Kontak, tanpa salinan kedua, dan memakai izin `crm_contact.*` sendiri. Izin `master_customer.*` tidak membuka tab Kontak, dan izin `crm_contact.*` tidak membuka data Pelanggan; tab yang tidak diizinkan tidak tampil dan API tetap menolak. Tindakan tambah/ubah kontak dari tab ini memakai command dan izin kontak CRM yang sama. Menu CRM › Kontak tetap ada. Tab Channel dan Rayon memakai `master_customer_channel` dan `master_rayon`. Acuan: IAM-01/04, CRM-05, [Design](07-design.md), [Master Data](14-master-data.md).

## Submenu Akun dan migrasi master — 16 Oktober 2026

Keputusan pengguna: Finance → Akuntansi → Akun menyediakan daftar, buat, edit dan detail. Impor 156 master dari file pengguna tanpa saldo awal. Kode teks sumber dipertahankan; nama boleh sama. Lanjutan: konfigurasi jurnal/pajak/kas dipindahkan ke akun impor, transit/karantina digabung ke Persediaan Barang, WAPU ke PPN Masukan, kas/bank ke 1-10001 Kas Op Mandiri. Jurnal uji lama tidak diubah; akun uji bersejarah dinonaktifkan, yang tanpa rujukan dihapus. Cakupan dan hasil: [catatan implementasi](../development/accounts-workspace-2026-10-16.md).

### Penyempurnaan master pajak — 16 Oktober 2026

Penyempurnaan master: satu master mempunyai satu akun dan penggunaan SALES/PURCHASE/BOTH. Nama Pajak terpisah dari Jenis Pajak dan Perlakuan Transaksi; perubahan jenis tidak otomatis mengubah tambah/potong. Pengguna meminta master PPN Penjualan 11% untuk penjualan, ditambahkan, memakai akun pajak penjualan yang tersedia. Ini data konfigurasi pengguna, bukan tarif hardcoded.

## Pembaruan pajak operasional — 16 Oktober 2026

Keputusan 16 Oktober 2026 — Pajak operasional: Finance → Pajak hanya berisi Daftar & Aturan Pajak, Faktur Keluaran, Faktur Masukan. Master PPN/PPh, tambah/potong, akun dan persentase dapat dibuat/diubah pengguna berizin tanpa approval. Versi/tanggal efektif dan snapshot transaksi tetap wajib. Faktur berasal dari transaksi penjualan/pembelian, dengan nomor/tanggal/lampiran resmi. Coretax, worksheet PPh Badan, masa/rekonsiliasi pajak dan workflow kepatuhan lanjutan ditunda. Keputusan ini menggantikan cakupan aktif pajak/Coretax pada bagian historis dokumen. Tidak mengubah ledger posted atau aturan pajak payroll.


## Keputusan terbaru — 16 Oktober 2026: larangan izin bersama pada induk

Setiap submenu operasional memiliki izin independen per tindakan. Satu grant induk tidak boleh mengendalikan beberapa submenu atau menjadi fallback otorisasi. Induk hanya mengelompokkan navigasi; Pilih Semua mengubah grant setiap anak. Berlaku untuk seluruh modul, termasuk Prospek, Kontak dan Pelanggan. Hak bawaan Admin Sistem tetap penuh. Keputusan ini menggantikan ketentuan sebelumnya yang membolehkan pemetaan izin bersama CRM/Master Data. Kontrak dan penerimaan: IAM-01/04 serta [Setting](15-setting.md). Implementasi lama yang belum dipisahkan masih merupakan utang migrasi.

Keputusan terbaru 16 Oktober 2026: Admin Sistem dapat mengatur izin setiap menu yang sudah operasional. Menu yang belum operasional tetap tampil tanpa grant semu. Tujuh tampilan Dashboard memiliki izin baca masing-masing, disertai pemeriksaan izin/scope sumber data. Atas permintaan pengguna, grant peran biasa lama pada database development lokal dikosongkan dan diaudit; ini bukan migrasi global. Peran baru tetap menerima seluruh katalog izin saat dibuat.

## Keputusan pengguna — 16 Oktober 2026: hapus pengguna dan peran dari daftar

Admin Sistem dapat memakai tombol **Hapus** pada daftar Pengguna dan Peran. Akun pengguna yang belum pernah dipakai dihapus permanen; akun dengan riwayat pemakaian diarsipkan, keluar dari daftar aktif, dan tetap mempertahankan referensi audit/transaksi. Penghapusan mencabut sesi dan dicatat dalam audit. Akun sendiri dan Admin Sistem terakhir tidak dapat dihapus. Peran biasa yang dihapus melepas penugasan anggotanya. [Arah dan cakupan](../development/flexible-access-2026-10-16.md).

Peran biasa yang baru dibuat langsung mendapat seluruh capability yang saat itu tersedia dalam katalog pada cakupan perusahaan. Peran lama tetap memakai grant tersimpan; Admin Sistem dapat memilih semua izin dan menyimpan perubahan pada tiap peran secara terpisah. Peran `ADMIN_SYSTEM` tetap memiliki hak bawaan tanpa grant tersimpan. Capability baru di kemudian hari tidak otomatis memperluas peran biasa lama.

## Keputusan pengguna — 16 Oktober 2026: peran fleksibel dan Admin Sistem

Peran dapat dibuat, diubah, dan dihapus; satu pengguna dapat memegang beberapa peran. Matriks hak akses mengelompokkan menurut fitur bila perlu, tanpa kelompok atau filter domain. Admin Sistem (`ADMIN_SYSTEM`) memiliki kewenangan penuh dalam perusahaan sesi untuk pengaturan dan transaksi bisnis tanpa bergantung pada grant perannya. Admin Sistem juga dapat memutus approval sendiri dan tanpa penunjukan approver; keputusan tetap diaudit. Validasi bisnis dan isolasi perusahaan tetap berlaku. Keputusan ini menggantikan syarat permission aksi tambahan dan larangan bypass transaksi Admin Sistem pada keputusan 7 Oktober. [Arah dan cakupan](../development/flexible-access-2026-10-16.md).

## Keputusan pengguna — 7 Oktober 2026: proforma diterbitkan manual

Submit/evaluasi SO tetap memvalidasi dan mengalokasikan stok otomatis, tetapi tidak
menerbitkan proforma. Pengguna berizin `proforma.issue` meninjau tahap pemenuhan dan
memilih Terbitkan Proforma. Tidak ada approval SO tambahan. Perubahan jumlah/nilai
memerlukan penerbitan revisi manual; dokumen lama tetap menjadi histori. Proforma
tetap tanpa AR/jurnal dan PREPAY tetap memerlukan dana terverifikasi sebelum kirim.
Implementasi/bukti: [penerbitan manual](../development/manual-proforma-2026-10-07.md).

Versi dokumen: 0.14 • 25 September 2026 • Status: rancangan tersinkronisasi; nama aplikasi final **evflow**, parameter bisnis Gelombang A–F, dan kebijakan operasional editable telah difinalkan untuk blueprint/pilot. Konfigurasi resmi pajak, payroll, mutu produk dan Coretax tetap menjadi release gate berbasis dokumen berwenang.

Lihat [Peta Dokumen dan Sumber Kebenaran](00-document-map.md) untuk kepemilikan aturan, prioritas keputusan, dan hubungan antarfile.

Paket ini menjelaskan ERP distribusi alat kesehatan dari kebutuhan bisnis sampai rancangan teknis. Dokumen dan contoh tampilan merupakan spesifikasi awal, bukan aplikasi yang sudah berfungsi atau persetujuan kebijakan akuntansi/pajak.

Untuk implementasi dengan AI: mulai dari [Peta Dokumen](00-document-map.md), baca requirement pada 02, lalu dokumen domain modul yang dikerjakan. Gunakan [Audit Konsistensi dan Matriks Keterlacakan](00-document-map.md) untuk menemukan User Flow, Design, Database, API dan fase terkait. Jangan menggabungkan aturan dari beberapa file dengan menebak; ikuti sumber utama dan urutan prioritas yang tercatat.

## Dokumen inti

1. [PRD](01-prd.md): tujuan, pengguna, batas produk, tahap pelaksanaan, dan kesiapan penggunaan.
2. [Requirements](02-requirements.md): aturan bisnis, kebutuhan fungsional, kontrol, dan kriteria penerimaan.
3. [Database](03-database.md): ERD, tabel, tipe data, relasi, indeks, dan konsistensi transaksi.
4. [API](04-api.md): kontrak HTTP, sumber daya, perintah bisnis, hak akses, dan contoh payload.
5. [Architecture](05-architecture.md): stack yang dipilih, batas modul, keamanan, deployment, dan pengujian.
6. [User Flow](06-user-flow.md): alur lintas peran, pengecualian, dan penyiapan data awal.
7. [Design](07-design.md): navigasi, layar, perilaku interaksi, dan panduan visual.
8. [Features](08-features.md): daftar fitur per modul, fase, dependensi, dan urutan pengerjaan.

Tujuh dokumen domain mengikuti tujuh modul utama: [Dashboard](09-dashboard.md), [Sales & Marketing](10-sales-marketing.md), [Warehouse & Logistik](11-warehouse-logistik.md), [Finance](12-finance-administration.md), [HRIS](13-hris.md), [Master Data](14-master-data.md), dan [Setting](15-setting.md). Dokumen pendukung lintas modul tetap terpisah: [Audit Konsistensi](31-audit-konsistensi.md), [Baseline Parameter Bisnis](39-baseline-parameter-bisnis.md), [Kebijakan Operasional](40-kebijakan-operasional-konfigurasi.md), [Kamus Label](41-kamus-label-dan-bahasa.md), dan [Matriks Label](42-matriks-label-lintas-dokumen.md). Dokumen tersebut melengkapi dokumen inti; aplikasi belum diimplementasikan.

## Keputusan visual dan fokus kerja — 29 September 2026

Keputusan 7 Oktober 2026 mencabut kewajiban mengikuti file desain lama dan skill desain tambahan. Gunakan panduan implementasi web, standar global yang masih berlaku, serta blueprint untuk fungsi dan invariant. Fokus Office operasional; Field ditunda.

## Dasar yang dikonfirmasi pengguna

Keputusan 7 Oktober 2026 mencabut kewajiban mengikuti file desain lama dan skill desain tambahan. Gunakan panduan implementasi web, standar global yang masih berlaku, serta blueprint untuk fungsi dan invariant. Fokus Office operasional; Field ditunda.

Keputusan terbaru 26 September 2026: MFA belum wajib pada tahap implementasi saat ini. Kontrol sesi, CSRF, rate limit, RBAC/scope, audit dan bootstrap `/auth/me` tetap wajib. Penyebutan MFA wajib pada dokumen lama dibaca sebagai peningkatan keamanan tahap berikutnya.

| Topik | Keputusan / fakta |
|---|---|
| Nama aplikasi | **evflow**; digunakan pada web kantor, aplikasi Android/iOS, autentikasi, metadata dan komunikasi sistem |
| Perusahaan | Nama awal PT Sandeq Sarana Medika; hanya distribusi; 1 perusahaan pusat dan 1 gudang. Nama/profil perusahaan dapat diedit langsung melalui UI oleh pengguna berizin tanpa tanggal berlaku, alasan atau approval |
| Skala | Sekitar 700 SKU, 6–12 karyawan/pengguna; 5–10 SKU per pesanan |
| Volume | Jumlah pesanan per hari belum diberikan; 5–10 adalah jumlah SKU per pesanan |
| Kategori | Non Elektromedik Non Steril; Non Elektromedik Steril; Elektromedik Non Radiasi; Diagnostik In Vitro |
| Channel | RS Pemerintah; RS Swasta; Dinas Kesehatan; Apotek/Klinik; Laboratorium; Institusi Pemerintah; Lainnya; dapat ditambah |
| Kredit | SO diinput dahulu; verifikasi ketentuan pembayaran, cek past due/limit untuk tempo, kemudian pemeriksaan dan alokasi stok. Bayar sebelum kirim diperiksa lagi terhadap dana terverifikasi sebelum pengiriman |
| Pelanggan baru | Dapat ditambahkan dari layar SO oleh pengguna berizin; periksa kemungkinan duplikasi. Termin dipilih pada SO; TOP/limit di master opsional. Kebijakan COD awal pelanggan baru opsional, default nonaktif (keputusan 24 Oktober 2026) |
| Registrasi sebelum PO | Institusi dicatat sekali di Master Pelanggan dengan tahap hubungan Prospek melalui form ringkas; kontak dan kunjungan dapat dicatat tanpa PO/SO atau kelengkapan pelanggan transaksi. Perubahan tahap mempertahankan data dan riwayat. Registrasi/kunjungan tidak dihitung sebagai pelanggan bertransaksi |
| Database Kontak CRM | 11 atribut pengguna: kode, nama lengkap/panggilan, pelanggan tertaut master, jabatan, unit/bagian, fungsi PIC, HP/WA, email, tanggal lahir, status dan catatan. Kontak terpisah dari akun ERP; banyak kontak per institusi dan beberapa fungsi per PIC |
| Manajemen prospek dan peluang | Penanggung jawab, sumber, status pendekatan, tindak lanjut, catatan/lampiran serta riwayat kegiatan. Status awal Baru/Dalam Pendekatan/Potensial/Ditunda/Tidak Dilanjutkan dapat diatur di Setting; penundaan/penghentian beralasan. Satu institusi dapat mempunyai beberapa peluang |
| Kebutuhan produk CRM | Banyak baris produk per prospek/peluang: produk, estimasi jumlah, satuan, waktu kebutuhan dan catatan. Kategori/uraian boleh digunakan sebelum produk spesifik diketahui. Dapat diteruskan ke penawaran lalu SO sesuai pesanan; pencatatan kebutuhan tidak mereservasi stok atau membuat PR |
| Pipeline bulanan | Peluang boleh dibuka kapan saja dalam bulan. Sisa belum Win ditutup akhir bulan sebagai Lost beralasan tenggat; peluang yang masih layak diteruskan melalui Copy Remaining setelah review. Master pelanggan/kontak tetap sama. Stage dari lampiran: Lead 10%, Qualified 25%, Penawaran 40%, Negosiasi 60%, PO Expected 80%, Closed Won 100%, Closed Lost 0% |
| Win dan maintain | Win saat PO/SP pelanggan diterima dan diverifikasi; alasan serta strategi maintain pelanggan/kontak wajib. Win bukan realisasi invoice/NOO. Lost wajib beralasan; alasan timeout berbeda dari penolakan komersial |
| Penawaran dan harga | Masa berlaku, versi/revisi, pengajuan harga/diskon per produk/pelanggan, keputusan berizin, tanggapan per item/qty dan konversi parsial ke SO; detail alur pada addendum |
| Kunjungan dan tracking | Rencana/perubahan/di luar rencana memerlukan persetujuan atasan. Nilai awal: minimal satu foto, radius 200 meter, tracking 5/15 menit, raw point 90 hari dan ringkasan 1 tahun; seluruhnya editable melalui OPS-VIS. Aplikasi Android 10+/iOS 15+ memakai Nuxt/Vue + Capacitor |
| Follow-up dan sampel | Tugas/pengingat/eskalasi internal terkonfigurasi, maintain saat Win; pengajuan sampel → approval → issue gudang/serah terima → trial/hasil → follow-up/pengembalian. Tidak otomatis menjadi penjualan/AR/NOO |
| Pelanggan bertransaksi | Mulai dihitung saat invoice pertama diposting, sesuai pilihan pengguna. Status master aktif/nonaktif terpisah dari riwayat transaksi |
| Kartu piutang pelanggan | Saldo awal, mutasi invoice/pembayaran/koreksi, saldo berjalan/akhir, invoice terbuka, jatuh tempo/aging dan riwayat penagihan per pelanggan, dengan periode dan hak akses |
| Jatuh tempo dan pembayaran invoice | Dikonfirmasi: jatuh tempo berdasarkan tanggal aktual barang diterima di POD + termin; detail invoice menyediakan tombol Terima Pembayaran sesuai izin, dengan verifikasi dana dan alokasi ke invoice. Untuk WAPU, penyelesaian memisahkan komponen **PPN Dipungut WAPU** dan **PPh Dipotong** sebagai dua baris pajak, bukan satu potongan atau diskon |
| Informasi stok bagi sales | Pengguna berhak dapat melihat stok tersedia saat input, termasuk stok nol. Ini informasi kondisi saat dilihat; alokasi resmi diperiksa ulang setelah aturan transaksi/ketentuan pembayaran lolos |
| Pemrosesan SO | Tanpa aturan persetujuan aktif, SO lanjut otomatis setelah validasi data/aturan, kredit, lalu stok. Persetujuan SO dapat dinyalakan per kondisi (24 Oktober 2026): validasi → persetujuan → kredit → alokasi. Pengecualian kredit mode Blokir diajukan melalui mesin persetujuan umum |
| Isi SO dan dokumen pemenuhan | Seluruh item/jumlah pesanan masuk SO, termasuk yang belum tersedia. Proforma dan Picking Slip hanya memuat stok tersedia yang dialokasikan; Packing List mengikuti barang aktual yang diambil dan lolos checking |
| Sisa pesanan | Kekurangan per item/jumlah dapat menjadi backorder atau ditutup; satu SO dapat dipenuhi bertahap, tanpa menghapus jumlah pesanan asli |
| Label status SO | Pesanan: Draft, Open, Selesai, Closed, Cancelled. Pemenuhan: Belum Dikirim, Sebagian, Terkirim Semua. Sisa: Backorder, Proses Pemenuhan, Ditutup |
| Picking | Disetujui: sistem menyarankan batch dan locator berdasarkan FEFO/FIFO; petugas berizin mencatat batch/locator dan jumlah aktual yang diambil. Picking selesai belum berarti barang dikirim |
| Pengiriman dan pemantauan transit | Disetujui: Surat Jalan, tujuan/PIC/kurir, cek syarat kirim, konfirmasi keluar gudang, pemantauan dalam perjalanan, POD dan tindak lanjut selisih. Status kirim terpisah dari penerimaan pelanggan; invoice resmi berdasarkan jumlah diterima yang belum ditagih |
| Pembatalan SO | Dapat dilakukan setelah pelanggan mengonfirmasi pembatalan. Konfirmasi dan dampaknya dicatat; transaksi sudah dikirim/ditagih diselesaikan melalui proses terkait, tidak dihapus |
| Pengguna | Satu pengguna boleh memiliki beberapa peran sesuai hak akses; dikelola melalui Setting → Pengguna dan Setting → Peran → Matriks Hak Akses; pelaksana tahap tidak dikunci berdasarkan jabatan |
| Pengaturan Persetujuan | Jenis/cakupan/batas/tahap, pengguna/peran/atasan, delegasi dan approval ulang dikonfigurasi per dokumen. Self-approval default nonaktif. Policy tidak dapat Active sebelum assignee, scope, limit dan fallback lengkap. Reminder default 4 jam kerja dan escalation 1 hari kerja. SO normal tetap otomatis |
| Gudang | Batch, kedaluwarsa, satuan/konversi, NIE AKL/AKD, locator, karantina, FEFO/FIFO, suhu khusus, konsinyasi, retur, recall, pemusnahan |
| Pengadaan barang dagang | Logistik mengevaluasi backorder/kebutuhan stok dan PR/PO/kiriman berjalan → PR → persetujuan → konsolidasi → PO per pemasok. PR dan PO berada di Warehouse & Logistik → Pengadaan; tidak membuat modul utama baru. Pemasok mengikuti MOU pabrik/importir/sole agent/pemilik izin edar, tanpa perbandingan supplier. Beberapa PR dapat digabung atau satu PR dibagi untuk mengelola pemasok/ongkir. Finance menangani tagihan/utang/pembayaran; HR tetap mengelola permintaan/barang operasional |
| Supplier dan Vendor | Keputusan pengguna: master/menu terpisah. Supplier untuk barang dagang; Vendor untuk aset, barang operasional/nonpersediaan dan jasa. Seluruh 18 atribut Vendor disetujui, termasuk TOP pada PO/kontrak dan saldo awal utang dari rincian tagihan; pengadaan/tagihan merujuk jenis pihak yang sesuai |
| Kebutuhan internal | Disetujui: permintaan staf → pemeriksaan kebutuhan/stok → PR bila perlu dibeli → persetujuan → PO Vendor → penerimaan barang/aset atau pekerjaan jasa → tagihan → pembayaran. Stok/aset yang sudah tersedia dipenuhi melalui pengeluaran/penyerahan, tanpa pembelian baru |
| Pengelola barang operasional | Saat ini HR, sesuai informasi pengguna. Penugasan melalui peran/hak akses yang dapat diubah; tidak otomatis memberikan kewenangan persetujuan pembelian, posting akuntansi atau pembayaran |
| PO parsial dan kiriman supplier | Sisa PO dapat menunggu susulan atau ditutup beralasan, tetap tertaut kebutuhan PR/backorder. Monitoring kiriman supplier per PO/tahap mencatat resi, estimasi tiba, update terakhir, penerimaan dan kendala; tiba belum berarti stok layak tersedia |
| Tagihan Supplier | Disetujui: mencatat invoice terbitan supplier, nomor asli terpisah dari nomor internal, cocokkan PO–penerimaan–invoice lalu posting ke AP. Menu menyediakan Catat Invoice, Posting dan Bayar Tagihan sesuai izin; penerimaan tanpa invoice masuk daftar Barang Diterima Belum Ditagih |
| Penerimaan retur | Saat penerimaan fisik dikonfirmasi, barang otomatis masuk locator karantina dan belum tersedia untuk penjualan; pelepasan mengikuti pemeriksaan kualitas dan hak akses |
| Penerimaan supplier | Disetujui sesuai SOP Sheet5: persiapan inbound, periksa dokumen/fisik, catat hasil, tempatkan ke locator, perbarui stok dan arsip. Barang layak dan karantina dapat tercatat dalam satu penerimaan; jumlah kurang dicatat sebagai selisih, bukan stok |
| Finance | Akuntansi lengkap sebagai sasaran; pajak internal termasuk PPN, withholding/PPh, PPh 21 dan worksheet PPh Badan mengikuti [Pajak dan Kepatuhan Pajak](12-finance-administration.md). Ekspor XML faktur pajak keluaran Coretax mengikuti [dokumen 38](12-finance-administration.md); pengiriman API langsung dan parsing hasil terstruktur belum termasuk |
| HRIS | Dashboard/laporan, kebutuhan tenaga, rekrutmen, kandidat, offer, onboarding, karyawan, kontrak, kalender/shift, impor fingerprint, absensi/koreksi, cuti/izin, lembur, rekap/cut-off payroll, payroll, THR, BPJS, PPh 21, reimbursement, komisi, resign dan pengembalian aset |
| Akses | Next.js + React untuk kantor; aplikasi HP sales/gudang memakai Nuxt/Vue + Capacitor, minimum Android 10/iOS 15, dengan menu sesuai izin dan satu backend bersama. PWA/browser menjadi akses tambahan |
| Manajemen target | Katalog TGT-01–11 disetujui: sembilan skema penjualan, enam skema penagihan, serta kunjungan berhasil per sesi. Penerima pengguna fleksibel, beberapa skema per pengguna, periode bulanan/triwulan/semester/tahunan, A/T persen. Satuan dan agregasi mengikuti metrik; hindari hitungan ganda antar-KPI dan hitung ulang SKU/pelanggan unik. Fokus awal penagihan: total penerimaan, jatuh tempo periode ini dan pemulihan tunggakan. Rincian katalog pada Requirements |
| Dasar nilai target penjualan | Net: nilai barang − diskon − retur/koreksi diposting; tidak memasukkan pajak/ongkir. Retur mengurangi aktual pada periode credit note/retur finansial diposting, dengan dimensi periode invoice asal untuk analisis |
| Estimasi Penjualan dan Penagihan | Ditambahkan atas permintaan pengguna. Menu masing-masing di Sales & Marketing dan Finance; rancangan memuat sumber, rincian produk atau invoice/cicilan, tanggal perkiraan, pengguna, versi serta perbandingan Target–Estimasi–Aktual. Proyeksi akhir periode = aktual sampai tanggal acuan + estimasi tambahan yang belum terealisasi; E/T dan A/T persen terpisah. Aturan EST-01–05 mencegah penghitungan sumber/aktual ganda |
| Target penggunaan | Awal Oktober 2026: uji coba terbatas dahulu, operasional bertahap |
| Data awal | Belum tersedia; inventarisasi dan rekonsiliasi menjadi bagian implementasi |
| HPP/harga | HPP memakai rata-rata bergerak. Harga jual memakai biaya acuan dan target margin, pricelist bertanggal efektif, batas diskon dan pengajuan exception. Nilai margin/diskon/approver wajib diisi melalui policy sebelum publish dan tidak memakai angka global tebakan |

## Keputusan final Gelombang A — 25 September 2026

IDR, tahun buku Januari–Desember dan timezone Asia/Makassar menjadi baseline perusahaan; timestamp sistem disimpan UTC. Pendapatan dan HPP normal diakui pada POD jumlah diterima. HPP memakai moving average per perusahaan dan produk dalam satuan dasar.

Nilai awal Finance: jatuh tempo AP dari tanggal invoice lengkap diterima/diverifikasi + TOP; matching qty/harga 0; pembulatan Rp1; landed cost berdasarkan nilai pembelian net. OPS-FIN pada dokumen 40 membuat default tersebut editable melalui UI, sementara PO/MOU/charge dapat memakai override yang didukung.

Penggabungan POD, masa reservasi prepay dan bucket aging mengikuti OPS-FIN-06–08, dengan nilai awal sebagaimana dokumen 39. Saldo awal tetap wajib per invoice/tagihan. Kandidat aset tidak dikapitalisasi otomatis sebelum Finance menetapkan klasifikasi dan policy kategori.

## Sumber dan perbedaan dengan SOP

Sumber S1: jawaban pengguna pada percakapan ini, 24 September 2026. Sumber S2: `C:/Users/LENOVO/Downloads/Kerangka Pembuatan SOP (2).xlsx`. Sumber S3: `C:/Users/LENOVO/Downloads/Sales_DA_18092026.xlsx`, SALES_PIPELINE!A9:P9, H10 dan K10; rincian temuan pada addendum. File sumber hanya dibaca, tidak diubah.

| Sheet / sel S2 | Proses / catatan |
|---|---|
| Sheet1 C8:C15 | Penerimaan SP, validasi pricelist, serah terima ke admin |
| Sheet2 C8:C20 | Verifikasi dan SO; arahan pengguna mengganti approval SO rutin dengan validasi otomatis dan approval hanya untuk permintaan unlock. Dicabut 24 Oktober 2026: persetujuan SO dapat dikonfigurasi |
| Sheet3 C8:C16 | Proforma, POD/surat jalan kembali, invoice resmi, tukar faktur |
| Lembar1 C7:C16 | Validasi data pajak, Coretax, PDF faktur pajak |
| Sheet4 C8:C32 | Picking, packing, surat jalan, ekspedisi, bukti terima |
| Sheet5 C8:C24 | Penerimaan, batch, kedaluwarsa, karantina, locator, FEFO/FIFO |
| Sheet6 C8:C21 | Perencanaan stok dan PR |
| Sheet6 (2) C8:C18 | Anggaran, PO, konfirmasi supplier |
| Sheet6 (3) C8:C17 | Pencocokan invoice, persetujuan pembayaran; C16 menyebut AR untuk hutang: rancangan menggunakan AP sesuai konteks dan permintaan pengguna |
| Sheet6 (4) C8:C20 | Penomoran dan arsip dokumen |

Isi SOP diperlakukan sebagai sumber proses bisnis, bukan instruksi yang menggantikan arahan pengguna. Keputusan pengguna mengenai SO otomatis, unlock, pemenuhan parsial dan pembatalan menjadi acuan apabila berbeda dengan SOP. Penyebutan PPN 11% dalam SOP tidak menjadi tarif tetap dalam aplikasi; aturan pajak harus bertanggal efektif dan ditetapkan untuk transaksi yang berlaku.

## Keputusan stack D06 — dikonfirmasi

| Komponen | Teknologi / pembagian |
|---|---|
| Web kantor | Next.js + React + TypeScript |
| Mobile sales/gudang | Nuxt + Vue 3 + TypeScript dikemas dengan Capacitor; minimum Android 10 dan iOS 15. Pilot melalui distribusi internal Android dan TestFlight iOS; transaksi bisnis online pada tahap pertama |
| Lokasi native mobile | Tracking aktivitas kerja sales di latar belakang, plugin/perangkat dan versi minimum kedua OS perlu pembuktian; API yang sama, lihat Architecture |
| Styling kedua frontend | Tailwind CSS dengan token warna, tipografi dan spacing bersama |
| Data API di frontend | TanStack Query: `@tanstack/react-query` untuk kantor, `@tanstack/vue-query` untuk aplikasi mobile Vue |
| Tabel ERP | TanStack Table: `@tanstack/react-table` untuk kantor, `@tanstack/vue-table` untuk aplikasi mobile Vue |
| Backend bersama | Node.js + NestJS, modular monolith |
| Database dan ORM | PostgreSQL + Prisma; satu database transaksi |
| Queue/job | BullMQ + Redis; pekerjaan turunan setelah commit dan kalkulasi draft |
| Storage | MinIO untuk development lokal; private managed S3-compatible untuk pilot/production melalui adapter S3 yang sama |
| Autentikasi dan otorisasi | JWT + RBAC + scope data; cookie HttpOnly/Secure, refresh rotation dan pencabutan sesi |

Pembagian dua frontend mengikuti pilihan eksplisit pengguna. Aturan bisnis dan akses data tetap berada di NestJS. Detail versi package, hosting, URL dan masa berlaku token ditetapkan saat implementasi. Ini keputusan rancangan, belum pemasangan aplikasi. Dua frontend menambah pekerjaan UI dan deployment; lingkup pilot tetap terbatas.

TanStack pada rancangan ini mencakup Query dan Table. Query mengelola pengambilan/cache data API, sedangkan Table menyediakan logika tabel headless yang tampilannya dibangun dengan Tailwind. Routing memakai Next.js dan Nuxt. Library TanStack lainnya dapat dievaluasi jika ada kebutuhan khusus.

## Register keputusan dan parameter lanjutan

Status final, mandatory configuration dan release gate register di bawah dirinci pada [Keputusan Final Parameter Bisnis](00-document-map.md).

| ID | Usulan / pertanyaan terbuka | Pemilik keputusan | Dampak |
|---|---|---|---|
| D01 | **Final:** rata-rata bergerak per perusahaan + produk dalam satuan dasar untuk stok milik sendiri; transit/konsinyasi keluar membawa biaya snapshot | Pimpinan + penanggung jawab akuntansi | HPP, migrasi nilai awal, koreksi biaya |
| D02 | **Final sebagai kontrol:** harga = biaya acuan / (1 − margin target); policy margin, pembulatan, diskon dan approver wajib lengkap sebelum publish, tanpa angka global tebakan | Pimpinan sales/finance | Harga dan pengecualian terpisah dari SO normal |
| D03 | **Final:** perpindahan kendali penjualan normal saat POD dikonfirmasi; pengiriman memakai akun barang dalam perjalanan | Penanggung jawab akuntansi | Waktu pengakuan pendapatan/HPP; kontrak khusus memakai posting profile |
| D04 | **Final:** freeze H+30; follow-up H-7, H, H+3, H+7 dan H+14; pengecualian memakai unlock beralasan dan bertenggat | Pimpinan finance | Assignment/limit approver diisi pada Setting |
| D05 | **Final:** exposure mencakup AR, unbilled POD, transit dan stok teralokasi tanpa hitung ganda, dikurangi uang muka tertaut; backorder belum dialokasikan tidak memakai limit | Pimpinan finance | Detail pada dokumen 25 |
| D07 | **Final sebagai nilai awal OPS-COMP:** IDR, tahun buku Jan–Des dan timezone Asia/Makassar; editable melalui UI dengan validasi dampak, sedangkan timestamp sistem tetap UTC | Finance | Perubahan mata uang setelah transaksi memerlukan cut-over/company baru |
| D08 | **Direvisi 24 Oktober 2026:** persetujuan SO dan dokumen lain mengikuti aturan pada mesin persetujuan umum; tanpa aturan aktif SO berjalan otomatis | Pimpinan | Multi-peran tetap berlaku |
| D09 | **Final:** fingerprint melalui impor file ke staging; raw row immutable dan commit memerlukan mapping/deduplikasi/review. Profile file perangkat diisi saat implementasi; tidak ada koneksi langsung mesin pada versi awal | HR | Payroll resmi menunggu contoh file dan hasil parallel run |
| D10 | **Final:** invoice asli boleh dibawa saat pengiriman dengan status Diterbitkan — Menunggu POD; nomor tetap dan posting setelah POD. COD TOP 0; prepay menunggu dana terverifikasi sebelum dispatch | Finance | Proforma tetap tanpa AR/pendapatan |
| D11 | **Final:** retur target mengikuti periode credit note posted; atribusi default 100% owner invoice/SO dan split harus tepat 100%. Komisi memakai policy aktif dan payout setelah review | Pimpinan + HR/finance | Payroll/komisi resmi tetap menunggu rule perusahaan |
| D12 | **Final:** pilot/production terpisah; prioritas region Jakarta, fallback Singapore; pilot RPO 24 jam/RTO 8 jam, production RPO ≤1 jam/RTO 4 jam | Pimpinan / pengembang | Restore test triwulanan dan secret manager wajib |
| D13 | **Final:** ownership konsinyasi wajib agreement; suhu/shelf-life wajib policy dari izin/produsen/customer dan nilai hilang menghasilkan hold; mata uang asing nonaktif awal | Gudang + finance + PJT | Tidak ada asumsi mutu universal |
| D14 | **Final sebagai nilai awal OPS-FIN:** due basis AP invoice lengkap diverifikasi + TOP, tolerance qty/harga 0, pembulatan Rp1 dan bucket aging awal; editable melalui UI dengan validasi | Finance | Posting AP, pembayaran, aging, closing dan exception matching |
| D15 | **Final:** nilai awal over-receipt 0% editable melalui OPS-WH; POD tetap aktual, retur tanpa policy tetap karantina/financial hold, recall memblok fulfillment, pemusnahan membutuhkan kontrol bukti | Gudang + PJT + Finance | Nilai shelf-life/suhu berasal dari policy resmi |
| D16 | **Final sebagai nilai awal OPS-FIN-05:** landed cost berdasarkan nilai pembelian net; basis berat, volume, qty atau rata dapat dipilih melalui UI bila data lengkap | Finance + Logistik | HPP, nilai persediaan, margin dan invoice/tagihan ongkir |
| D17 | **Final:** awalan dan urutan nomor master ditetapkan; daftar data wajib menentukan kesiapan transaksi; NIE tidak berlaku/kedaluwarsa memblokir transaksi baru kecuali keputusan penanganan PJT | Admin master + PJT/Finance | Kode lama melalui pemetaan migrasi |
| D18 | **Final:** peluang boleh dibuat tengah bulan dan diteruskan manual; nilai awal kunjungan/lokasi adalah radius 200 m, satu foto, tracking 5/15 menit dan raw 90 hari serta editable melalui OPS-VIS; Android 10/iOS 15 + Capacitor | Sales + pimpinan + pengembang | Exception tetap dicatat dan direview |
| D19 | **Final:** retur mengurangi periode credit note posted dan atribusi total 100%; template formula A/T serta aktivasi KPI gabungan editable melalui OPS-CRM, dengan bobot wajib 100% | Pimpinan sales + Finance/HR | Formula memakai template tervalidasi, bukan kode bebas |
| D20 | **Final sebagai mandatory configuration:** kalender/shift, cuti dan formula lembur wajib policy aktif; raw scan tidak otomatis menjadi lembur/payroll | HR + pimpinan | Policy hilang memblok proses terkait |
| D21 | **Final sebagai mandatory configuration:** payroll memerlukan komponen, prorata, cut-off/pay date, rekening, approval, THR/BPJS/PPh 21 aktif dan dua parallel run lulus | HR + Finance + pajak | Tidak ada formula/tarif hardcoded |
| D22 | **Final:** hiring request/offer berapproval, konversi kandidat terkontrol, offboarding bersnapshot, retensi kandidat 2 tahun dan final pay tidak memotong aset otomatis | HR + pimpinan + Finance | Nilai kontraktual mengikuti policy aktif |
| D23 | **Final:** kategori biaya wajib mapping; nilai awal perjalanan dari dokumen 17 editable melalui OPS-HR, biaya aktual/bukti dan exception tetap mengikuti policy aktif; aset tidak auto-capitalize | HR + Finance + pimpinan | Asset-class policy tetap wajib sebelum penyusutan |
| D24 | **Final sebagai kontrol:** semua rule pajak bertanggal efektif dari sumber resmi; WAPU dua komponen; PPh Badan tahunan wajib, provision bulanan/pajak tangguhan nonaktif awal | Finance + penanggung jawab pajak | Data resmi tetap release gate |
| D25 | **Final:** Coretax file XML manual; production membutuhkan XSD, katalog, identitas dan satu UAT Accepted. Direct API/parser terstruktur di luar scope awal | Penanggung jawab pajak + pengembang | Evidence eksternal menjadi release gate |
| D26 | **Final:** role awal ditetapkan, self-approval default off dan policy approval wajib lengkap; SLA/retensi operasional menjadi nilai awal OPS-SYS, sedangkan hosting/backup mengikuti dokumen 39 | Pimpinan + admin sistem + pengembang | Assignment dan limit adalah data konfigurasi wajib |
| D27 | **Final:** dashboard per role dan personalisasi layout/filter; perubahan committed dikirim realtime dengan target awal ≤10 detik, fallback refresh ≤5 menit, suppression <5 orang dan expiry ekspor 7 hari editable melalui OPS-SYS | Pimpinan + pemilik modul | Formula memakai definition version, as-of/freshness dan katalog template yang diizinkan |
| D28 | **Final:** nama aplikasi adalah **evflow** pada seluruh kanal produk; nama perusahaan berasal dari Profil Perusahaan | Pimpinan | Branding, metadata aplikasi, dokumen keluaran dan komunikasi sistem |
| D29 | **Final:** nama/profil perusahaan dapat diedit langsung melalui UI oleh pengguna berizin tanpa tanggal berlaku, alasan atau approval. Perubahan berlaku segera untuk tampilan dan dokumen baru; dokumen issued mempertahankan snapshot | Pimpinan / admin berizin | Setting, database, API, template dan cetak ulang dokumen |
| D30 | **Final:** parameter operasional pada dokumen 40 menjadi nilai awal yang dapat diubah melalui Setting → Kebijakan Umum. Simpan langsung menjadi default; alasan, approval dan tanggal berlaku hanya muncul bila jenis policy mengaktifkannya. Invariant pada dokumen 40 bagian 9 tetap tidak dapat dilonggarkan | Pimpinan / pemilik modul | Seluruh modul, UI Setting, policy service, snapshot dan validasi |
| D31 | **Final:** Matriks Hak Akses bukan submenu mandiri. Matriks dibuka dari Setting → Peran → Atur Hak Akses dan tetap membawa konteks peran yang sedang dikonfigurasi | Pimpinan / admin sistem | Struktur sidebar, breadcrumb, deep link matriks dan dokumentasi navigasi |

## Cara menggunakan paket ini

Konfirmasi keputusan yang memengaruhi uang dan stok sebelum implementasi modul tersebut. Gunakan ID requirement sebagai acuan pekerjaan dan pengujian. Mulai pilot dengan data uji fiktif, lalu lakukan migrasi data nyata ke lingkungan terpisah setelah data awal direkonsiliasi. Keberhasilan pilot tidak otomatis berarti semua modul siap digunakan resmi.

















## Keputusan pengguna — 7 Oktober 2026: hanya aplikasi operasional

Seluruh pekerjaan berikutnya langsung pada route aplikasi operasional, menggunakan sesi pengguna, izin backend dan data database. Tidak membangun atau menyerahkan layar preview/simulasi sebagai pengganti implementasi. Data yang belum tersedia memakai state kosong/unavailable yang jujur; tidak memakai fixture sebagai data runtime. Verifikasi dilakukan pada aplikasi operasional. Keputusan ini menggantikan arahan preview pada catatan sebelumnya; bukti audit lama hanya riwayat.

Cakupan koreksi saat ini: menutup empat pintu masuk preview Dashboard, CRM, Sales Order dan Setting dengan redirect server ke route operasional. URL lama hanya kompatibilitas bookmark. Tidak mengubah role, saldo, transaksi atau konfigurasi bisnis. Requirement APP-03/04, NFR-03/05. Kriteria: URL lama tidak lagi merender principal/data simulasi dan tujuan tetap memeriksa sesi/izin. Penghapusan cabang internal fixture yang tidak lagi terjangkau dicatat sebagai pembersihan lanjutan; kesiapan fungsi operasional tidak disimpulkan dari redirect.

## Pengelolaan akses — keputusan 7 Oktober 2026

IAM-01/04/11: pengguna dapat memiliki beberapa peran; izin efektif adalah gabungan izin peran aktif sesuai scope. Pengelolaan akun dan peran hanya untuk pemegang peran aktif Admin Sistem (`ADMIN_SYSTEM`) dalam perusahaan sesi, dengan permission aksi yang sesuai. Nama jabatan atau nama tampilan peran bukan bukti administrator. Pengguna → pilih akun → tetapkan beberapa peran; Peran → Atur Hak Akses → ubah checkbox matriks peran → simpan. Menu Pengguna/Peran/Matriks disembunyikan bagi nonadministrator; deep link dan seluruh endpoint `/users`, `/roles`, `/permissions` beserta mutasinya ditolak 403 walaupun permission IAM terlanjur diberikan. Pengaturan bisnis lain tetap mengikuti permission domain. Tidak ada bypass izin transaksi untuk Admin Sistem. Perubahan akses diaudit dan sesi terdampak dicabut. Tidak ada perubahan model database atau migration; implementasi dan batas validasi dicatat pada [catatan pengelolaan akses](../development/iam-admin-only-2026-10-07.md).

## Keputusan pengguna — 21 Oktober 2026: Invoice dari Packing List

Menu Finance → Piutang (AR) → Invoice menampilkan antrean Packing List yang telah disiapkan, dicek dan diterbitkan, tanpa menunggu Surat Jalan atau POD. Pengguna membuat Invoice secara manual dari antrean; penerbitan langsung membentuk AR dan dapat dicetak. Kuantitas mengikuti hasil checking. Pengiriman tidak membuat Invoice otomatis. Jatuh tempo dihitung dari tanggal penerbitan Invoice + TOP sesuai keputusan pengguna terbaru.
