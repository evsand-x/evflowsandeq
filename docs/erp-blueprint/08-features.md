# Features — backlog dan tahap implementasi

## Keputusan 30 Oktober 2026 - penerimaan SJ terpisah

Cakupan tambahan: pemisahan penerbitan dan pencatatan penerimaan di detail SJ, tanpa menu POD terpisah. Penerimaan bertahap, reversal dan penyelesaian selisih otomatis tidak termasuk. Verifikasi dicatat pada docs/development/sj-penerimaan-terpisah-2026-10-30.md.

SJ terbit memposting seluruh jumlah draft, stok, pendapatan dan HPP serta langsung menjadi sumber Invoice. Penerimaan pelanggan dicatat terpisah setelah terbit dan tidak menjadi prasyarat posting atau Invoice. Catatan penerimaan tidak mengubah saldo, jumlah terbit, progres SO maupun jatuh tempo. Selisih ditindaklanjuti melalui koreksi/retur tersendiri. Bukti serah terima historis tetap dipertahankan.


## Detail SO dan uang muka — Bagian 2, 26 Oktober 2026

Implementasi Bagian 2 mencakup backend dan Office detail SO, uang muka/verifikasi, dana PREPAY, dokumen terkait, cetak/duplikat dan tindakan. Belum dinyatakan siap rilis: full suite dan QA browser operasional masih gate terpisah. Bagian 1 frontend serta Bagian 3–5 tidak ikut diklaim selesai.

## Cakupan backend SO mudah — 25 Oktober 2026

Bagian 1 backend mencakup kontrak/migration kepala SO, default dan validasi wajib, create/revisi, termin dan gudang saat submit, status tunggal, daftar/filter/hitungan server, opsi form dan stock availability. Acuan OTC-01/04/12/17, CFG-08, IAM-01/04, NFR-02/09. UI bagian 1, detail/DP langsung bagian 2, matriks/harga/scope bagian 3, pindah locator bagian 4 serta penomoran/pajak tetap terpisah. Hasil tes dan batas release gate dicatat pada catatan eksekusi; keberhasilan backend bukan klaim aplikasi siap produksi.


## Urutan kerja keputusan 24 Oktober 2026

Mengikuti [desain arah fleksibel](../superpowers/specs/2026-10-24-erp-fleksibel-design.md), urutan berikut didahulukan:

1. Revisi dokumen panduan (selesai 24 Oktober 2026).
2. Pengaturan terpusat dan nilai bawaan (CFG-08/09/10, IAM-10) — selesai 24 Oktober 2026, [rencana](../superpowers/plans/2026-10-24-pengaturan-terpusat.md), [bukti](../development/setting-hub-2026-10-24.md).
2b. Konsolidasi pengaturan per submenu (izin, penomoran, pajak bawaan, kredit pelanggan, jenis potongan, pemetaan akun, batas diskon) — selesai 24 Oktober 2026, [rencana](../superpowers/plans/2026-10-24-konsolidasi-pengaturan-2b.md), [catatan](../development/setting-consolidation-2026-10-24.md).
3. Alur SO → pengiriman → invoice → pembayaran/retur yang ringan (OTC-01/02/03/17, FIN-12).
4. Peran & Hak Akses yang lebih mudah (IAM-13), Struktur Organisasi (IAM-12) dan mesin persetujuan umum (IAM-02/07), dipasang ke SO lebih dulu.
5. Pengajuan karyawan: permintaan biaya, perjalanan dinas, entertain, call plan harian, cuti.
6. Rekonsiliasi dan jenis dokumen lain.

Setiap tahap 2–6 memerlukan rencana implementasi sendiri dan pengujian pada route operasional dengan sesi dan izin nyata.

## Submenu Akun dan migrasi master — 16 Oktober 2026

Tahap Akun (FIN-01/IAM-04/APP-03): daftar/buat/edit/detail, query/filter/pagination, akun Header/Detail, validasi hierarki, izin independen, audit dan impor master sekali tersedia. Saldo awal, UI impor/ekspor umum, hapus interaktif, reklasifikasi khusus, dimensi dan laporan saldo masih cakupan lanjutan; bukan klaim seluruh modul akuntansi selesai. Migrasi konfigurasi akun uji ke 156 akun impor menjaga jurnal lama.

### Penyempurnaan master pajak — 16 Oktober 2026

Penyempurnaan master mencakup filter penggunaan dan validasi backend, label kolom, kelompok akun, serta riwayat nilai konfigurasi. PPN Penjualan 11% dibuat sebagai data perusahaan berdasarkan permintaan pengguna, tidak menjadi seed/default universal.

## Pembaruan pajak operasional — 16 Oktober 2026

Cakupan aktif FIN-08 adalah master pajak operasional serta dua daftar faktur dari transaksi. Coretax, PPh Badan, bukti potong dan rekonsiliasi/masa pajak sebagai workspace terpisah ditunda sesuai keputusan terbaru. Backend pemilihan master terintegrasi SO dan supplier invoice; form SO menyediakan pilihan pajak. Penyediaan form supplier invoice tersendiri bukan bagian perubahan workspace ini. Lampiran resmi memakai evidence JPEG/PNG maksimal 2 MB yang tersedia; PDF belum didukung.


Izin baca terpisah untuk tujuh tampilan Dashboard operasional berada dalam cakupan IAM-01/04 dan DSH-01; katalog, matriks, navigasi dan API harus selaras. Menu yang belum operasional tetap tampak tanpa grant semu. Pengosongan grant peran lama yang diminta pengguna telah diterapkan pada database development lokal, bukan melalui migration produksi.

## Perubahan 7 Oktober 2026 — proforma manual

OTC-05/15: submit/evaluasi SO tidak lagi menerbitkan proforma. Preview dan penerbitan
manual per tahap, izin khusus, idempotency, revisi serta akses Office mengikuti
[catatan implementasi dan validasi](../development/manual-proforma-2026-10-07.md).
Ini tidak menyatakan diskon/ongkir, PDF/template final atau seluruh O2C telah selesai.

Nama aplikasi final adalah **evflow**. Kode fase: P0 persiapan, P1 kandidat pilot dengan data uji fiktif, P2 penggunaan resmi lingkup inti, P3 perluasan. Urutan tidak menyatakan bahwa fitur penting boleh diabaikan saat transaksi nyata memerlukannya. Semua modul adalah sasaran produk; belum ada fitur yang diklaim sudah diimplementasikan.

Stack telah dipilih: Next.js/React untuk kantor, Nuxt/Vue untuk aplikasi mobile sales/gudang yang dikemas bagi Android/iOS, NestJS + PostgreSQL/Prisma sebagai backend bersama, BullMQ/Redis, private S3 dan JWT/RBAC/scope. PWA/browser hanya akses tambahan. P1 membangun shell kedua frontend dan satu kontrak API; layar mobile dibatasi pada tugas prioritas.

Keputusan final: aplikasi HP sales/gudang memakai **Nuxt/Vue + Capacitor**, minimum Android 10 dan iOS 15, dengan background location selama sesi kerja termasuk UI tertutup. Tracking 5 menit bergerak/15 menit diam; pilot melalui distribusi internal Android dan TestFlight iOS. PWA menjadi akses tambahan.

UI kedua frontend menggunakan Tailwind CSS, TanStack Query dan TanStack Table dengan adapter React/Vue. Toast memakai `sonner` pada React dan `vue-sonner` pada Vue; tidak ada paket resmi TanStack Toast. Routing mengikuti framework frontend masing-masing.

## Fokus pelaksanaan terbaru — 29 September 2026

Pekerjaan saat ini memprioritaskan web Office berdasarkan mockup pengguna; Field/native mobile ditunda. Sasaran produk dan release gate tetap berlaku. Urutan implementasi rinci mengikuti inventaris mockup dan dependensi alur web pada [panduan implementasi web](../mockup/web-implementation-guide.md). Keputusan ini belum menyatakan fitur selesai dan belum memulai coding aplikasi.

## 0. Dashboard

Urutan kerja web terbaru: selesaikan cakupan tampilan seluruh layar mockup terlebih dahulu, dengan review satu layar representatif lalu per kelompok layar/alur. Prioritas alur operasional ditentukan kemudian. Ini mengatur urutan pekerjaan visual dan tidak menurunkan acceptance atau release gate fitur pada tabel berikut.

Sumber domain: [Dashboard](09-dashboard.md). Dashboard adalah projection lintas modul dan pintasan tindakan; tidak menjadi ledger, tidak mem-posting, tidak menyetujui transaksi dan tidak menggantikan laporan domain.

| Fitur | Fase | Requirement / dependensi |
|---|---|---|
| Ringkasan Eksekutif dengan periode/as-of, freshness, KPI dan sumber angka | P1 | DSH-01/02, sumber posted dari modul pemilik |
| Tab Sales, Warehouse & Logistik, Finance, dan HRIS sesuai scope pengguna | P1 | DSH-01/03, field authorization dan scope |
| Tugas & Persetujuan: approval, exception, follow-up dan blocker dengan tautan resource asal | P1 | DSH-02, approval instance dan workflow modul pemilik |
| Laporan & Ekspor privat dengan filter, drill-down, versi definisi, audit download dan job ekspor | P2 | DSH-01/03, policy ekspor/retensi dan izin field |

## 1. Sales & Marketing

Sumber domain: [CRM Operasional](10-sales-marketing.md) dan [Sales Order-to-Cash](10-sales-marketing.md).

| Fitur | Fase | Requirement / dependensi |
|---|---|---|
| Manajemen prospek pada satu Master Pelanggan, status pendekatan terkonfigurasi, penanggung jawab, sumber, tindak lanjut dan riwayat aktivitas | P2 | CRM-01/06, MD-04; kelengkapan awal ringkas, invoice pertama diposting sebagai pemicu pelanggan bertransaksi |
| Beberapa peluang per institusi dan beberapa kebutuhan produk per prospek/peluang; kategori/uraian bila belum spesifik; diteruskan ke penawaran/SO sesuai pesanan | P2 | CRM-06/07, CRM-04; tidak membuat PR/reservasi dari pencatatan kebutuhan |
| Database Kontak dengan 11 atribut pengguna, hubungan Master Pelanggan, fungsi PIC dan riwayat kunjungan/tindak lanjut | P2 | CRM-05, CRM-01/02; rincian form pada Design |
| Estimasi Penjualan net per pelanggan/produk/pengguna, sumber pipeline/pesanan atau manual, versi/tanggal acuan dan perbandingan Target–Estimasi–Aktual | P2 | EST-01/03–05, TGT-12; hindari penghitungan sumber/aktual ganda |
| Kunjungan: approval atasan, foto wajib, check-in/out per sesi, hasil per kontak, pengajuan perubahan/di luar rencana | P1 simulasi; P2 operasional tervalidasi | CRM-02/08/12; approval/bukti bukan fitur opsional saat dipakai nyata |
| Tracking sales sepanjang aktivitas kerja termasuk aplikasi tertutup; riwayat, last seen, gap dan izin | Tahap perangkat ditentukan setelah pembuktian native | CRM-13; aplikasi terpasang, OS/interval/retensi, tidak menjanjikan lokasi saat force-stop/perangkat mati |
| Pipeline bulanan, stage/confidence sumber, Win PO/SP terverifikasi, Lost tenggat/beralasan dan strategi maintain | P2 | CRM-09/10, addendum CRM; pelanggan tetap permanen |
| Follow-up, pengingat internal, eskalasi atasan dan tugas maintain | P2 | CRM-14; penjadwalan berizin/idempotent, tanpa integrasi pesan pelanggan otomatis |
| Pengajuan sampel, approval, issue/serah terima, hasil trial per produk, follow-up dan pengembalian | P2 setelah kontrol stok/biaya siap | CRM-15; batch/serial/ownership, biaya/pajak ditetapkan, return quarantine |
| Target penjualan sembilan skema, penagihan enam skema dan kunjungan berhasil; katalog disetujui, penerima fleksibel, A/T persen dengan satuan/basis/agregasi per skema | P1 definisi + contoh; P2 realisasi | CRM-03/08, TGT-01–11; katalog serta rincian kebijakan tersisa pada Requirements |
| Penawaran masa berlaku/versi/revisi, harga/diskon per produk/pelanggan, tanggapan per item dan konversi parsial ke SO | P2; harga dasar P1 | CRM-04/11, FIN-05; approval terikat versi, qty tidak digandakan |
| Referensi SP/PO pelanggan dan SO otomatis, ketentuan pembayaran/kredit sebelum alokasi, persetujuan hanya bila aturan aktif | P1 | OTC-01–03, credit policy, AR opening |
| Pelanggan baru dari SO: COD tiga bulan, prepay sesuai policy, lalu tempo setelah evaluasi Finance | P1 | MD-05, OTC-15; penerimaan uang muka, ikatan dana per tahap dan kontrol dispatch |
| Informasi stok saat input Draft/credit hold dan pemeriksaan ulang saat alokasi | P1 | OTC-13/14, izin availability dan stok atomik |
| Pengajuan unlock manual, routing pihak peninjau dan keputusan | P1 | OTC-08/09, IAM-02, rule/grant sesuai lingkup |
| Evaluasi credit exposure per komponen saat SO, backorder tanpa komitmen sampai alokasi, freeze H+30 dan laporan penggunaan limit | P1 | OTC-02, D04–D05, fasilitas aktif dari Finance |
| Seluruh item masuk SO; pemenuhan bertahap dan backorder per item/jumlah | P1 skenario utama | OTC-01/04/12, WH-01 |
| Tutup sisa pesanan dan pembatalan berdasarkan konfirmasi pelanggan | P1 skenario utama | OTC-10/11, pelepasan alokasi/komitmen dan penyelesaian picking |
| Tukar faktur dan tugas collector | P2 | OTC-06, invoice/AR |
| Komisi beserta koreksi retur | P3 | HR-05, kebijakan basis dan payout |

## 2. Warehouse & Logistik

Sumber domain: [Warehouse & Logistik](11-warehouse-logistik.md).

Pengadaan menjadi kelompok menu dalam modul ini: **Kebutuhan Persediaan, PR, Persetujuan sesuai izin, Perencanaan Pembelian, PO Supplier, PO Vendor dan Monitoring PO**. Logistik menentukan kebutuhan stok dagang setelah memperhitungkan stok/backorder/PR/PO/kiriman; HR tetap mengelola permintaan operasional. PR/PO menggunakan approval yang dikonfigurasi. Fase P1 inti/P2 anggaran dan toleransi mengikuti PTP-01–04. Tidak ada modul utama Procurement tambahan.

| Fitur | Fase | Requirement / dependensi |
|---|---|---|
| Gudang, locator, produk/batch/expiry, UOM | P1 | MD-01–03, WH-01 |
| GR, quality hold/karantina dasar, put-away | P1 | PTP-02, WH-03 |
| Kartu stok, on hand/reserved/available | P1 | WH-01, event ledger |
| FEFO/FIFO, Picking Slip dari alokasi; checking, Packing List/SJ aktual, POD | P1 | WH-02, OTC-04–05, tahap pemenuhan SO |
| Antrean tugas gudang pada aplikasi terpasang Android/iOS sesuai izin; akses browser tambahan bila disediakan | P1 tugas picking/checking terbatas; P2 penerimaan/bukti lengkap | APP-02, WH-01–03, API bersama |
| Stock count dan adjustment approval | P2, wajib untuk opening nyata | WH-05, FIN-01 |
| Suhu manual, excursion dan tindak lanjut | P2 sebelum produk suhu khusus | WH-04, storage profile |
| Retur pelanggan/supplier dan disposition | P2 | OTC-07, costing dan credit note |
| Recall, telusur batch dan blok | P2 sebelum penjualan nyata terkait; workflow lengkap P3 | WH-07, batch trace |
| Pemusnahan dengan bukti/write-off | P3 atau lebih awal bila dipakai | WH-07, approval/journal |
| Konsinyasi keluar/masuk dan settlement | P3 atau lebih awal bila dipakai | WH-06, ownership/cost layers |

## 3. Finance

Sumber domain pajak internal: [Pajak dan Kepatuhan Pajak](12-finance-administration.md). Ekspor XML faktur pajak keluaran Coretax mengikuti [dokumen 38](12-finance-administration.md).

Tambahan disepakati: **Estimasi Penagihan** per pelanggan/invoice/penanggung jawab, berdasarkan piutang terbuka, jatuh tempo dan janji bayar; mendukung cicilan, revisi/versi, hubungan realisasi pembayaran, serta perbandingan target/estimasi/aktual. Rancangan P2 mengikuti EST-02–05; estimasi tidak membuat pembayaran/AR baru.

| Fitur | Fase | Requirement / dependensi |
|---|---|---|
| CoA: template awal, tambah/edit/nonaktif, hierarki, akun kontrol, dimensi, impor dan audit; jurnal otomatis idempotent/atomik, posting profile, preview, exception, reversal, GL dan neraca saldo | P1 | FIN-01, dokumen domain Finance, fiscal period |
| Proforma dari alokasi tersedia per tahap; invoice, kartu AR/AP, aging, pembayaran parsial, uang muka, settlement, credit note dan follow-up | P1 inti | OTC-05, FIN-02, dokumen domain Finance |
| Verifikasi Tagihan Supplier/Vendor dengan PO/penerimaan, posting utang dan pembayaran | P1 inti; P2 budget/toleransi | PTP-03/04; PR/PO di Warehouse & Logistik → Pengadaan |
| (Dihapus 24 Oktober 2026; diganti atribut kredit Master Data › Pelanggan dan Setting › Termin & Kredit) Kredit & TOP Pelanggan: daftar fasilitas per pelanggan, mode COD/Prepay/Tempo, TOP, limit, tanggal efektif, toleransi, histori, approval, freeze dan unlock | P1 inti; revisi/approval lengkap bertahap | MD-05, OTC-02/03/08/09, FIN-02; Finance menjadi pemilik keputusan dan snapshot kebijakan |
| HPP rata-rata bergerak, landed cost default berdasarkan nilai pembelian net, kartu nilai stok dan rekonsiliasi persediaan | P1 simulasi; P2 validasi | FIN-04, D01/D16 final Gelombang A, spesifikasi 19-hpp-penilaian-persediaan |
| Landed cost terlambat dan cost adjustment | P2 sebelum transaksi relevan | FIN-04, cost lineage |
| Kalkulator margin/markup, pricelist bertanggal efektif, konflik harga, batas diskon dan approval harga khusus; publish ditahan sampai policy scope lengkap | P1 simulasi; P2 operasi | FIN-05, D02 final Gelombang A, dokumen domain Sales & Marketing |
| Kas/bank dan rekonsiliasi: master rekening, penerimaan, pembayaran, transfer, kas kecil, uang muka, statement staging, matching, penyesuaian dan close periode | P1 transaksi inti; P2 rekonsiliasi lengkap | FIN-02–03, dokumen domain Finance |
| Neraca saldo, buku besar, laba rugi, neraca, arus kas, aging, persediaan dan margin | P1 neraca saldo/basic statements; P2 laporan lengkap | FIN-06, cash-flow tagging, opening dan spesifikasi 21-laporan-keuangan |
| Checklist closing bulanan, rekonsiliasi, sign-off, lock/reopen dan versi laporan | P1 demonstrasi; P2 proses resmi | FIN-07, rekonsiliasi seluruh subledger, spesifikasi 20-closing-bulanan |
| Akrual, prepaid, penyusutan, koreksi dan closing tahunan | P2–P3 | FIN-07/09, schedule dan account mapping |
| PPh Badan: worksheet rekonsiliasi fiskal, koreksi berbukti, kompensasi kerugian, kredit/angsuran, estimasi pajak kini, provision/true-up, posisi kurang/lebih bayar dan approval | P2 simulasi; P3 sebelum pelaporan resmi | FIN-08, trial balance/laporan final, rule pajak tervalidasi dan dokumen 37 |
| Coretax pajak keluaran: mapping referensi/item/UOM, validasi, preview, batch XML, hash, download, bukti unggah, hasil manual dan arsip | P2 sebelum penggunaan pajak resmi | FIN-16, tax document posted, template XML dan spesifikasi 38; XSD aktual wajib untuk produksi |
| Direct API submission dan parsing hasil terstruktur Coretax | Ditunda | Kontrak API/kredensial serta contoh schema hasil belum tersedia |
| Aset tetap: kapitalisasi, register unit, penyusutan, assignment, maintenance, opname, impairment dan disposal | P2–P3 | FIN-09, HR-07, spesifikasi 24-aset-tetap-penyusutan |
| Permintaan ATK/aset/jasa dan reimbursement | P2 | PTP-01, HR-06 |
| Kategori biaya, permintaan internal, issue stok operasional, direct expense Vendor, reimbursement, employee advance dan prepaid | P2 | FIN-13, dokumen domain Finance |
| Anggaran berversi, budget check, komitmen, exception, transfer dan Budget vs Actual | P2–P3 | FIN-15, FIN-06, PTP-01, spesifikasi 23-anggaran-budget-vs-actual |
| Surat/kontrak/arsip + penomoran | P1 nomor transaksi; P2 arsip umum | ADM-01, IAM-03 |

Akuntansi lengkap berarti mencakup GL, subledger, pengakuan transaksi, penyesuaian, rekonsiliasi, laporan dan penutupan. Multi-currency, konsolidasi multi-entitas, pembiayaan kompleks, dan pelaporan khusus lain belum menjadi kebutuhan yang dikonfirmasi; jangan mengklaim tercakup hanya karena menu “Finance” tersedia. Pinjaman sederhana, pajak dan kewajiban lain tetap bisa dicatat melalui COA/jurnal terkontrol; submodul khusus dibangun jika diperlukan.

## 4. HRIS

Sumber master karyawan/organisasi/kontrak: [dokumen 34](13-hris.md); proses khusus mengikuti dokumen 26–29.

| Fitur | Fase | Requirement / dependensi |
|---|---|---|
| Master Karyawan: profil/keluarga, penempatan dan riwayat jabatan/gaji, kontrak/pengingat, pengaturan absensi/payroll, rekening/pajak/BPJS, dokumen privat, tautan akun dan aset | P2 | HR-01; atribut dan tab telah disetujui pada Design; jabatan tidak otomatis memberi hak akses |
| Permintaan tenaga, budget/headcount approval, lowongan, kandidat/lamaran, pipeline, interview, offer, konversi karyawan dan onboarding lintas IAM/absensi/payroll/aset | P2–P3 | HR-02, dokumen 28, hiring/retention policy |
| Kalender, shift, impor fingerprint staging, absensi harian, exception dan koreksi | P2 setelah contoh file dan aturan dasar tersedia | HR-03, dokumen 26; belum koneksi langsung mesin |
| Cuti/izin berbasis ledger, lembur rencana–realisasi–verifikasi, rekap dan cut-off payroll | P2 untuk pencatatan/pilot; input payroll resmi setelah policy dan parallel check lulus | HR-03, dokumen 26 |
| Payroll run, input snapshot, simulasi, review, approval, posting, slip, pembayaran dan rekonsiliasi | P2 untuk pilot setelah parallel calculation; pembayaran resmi setelah verifikasi | HR-04, dokumen 27, FIN-01–03, jurnal 12, kas/bank 13 |
| THR, BPJS Kesehatan/TK, PPh 21 dengan rule version | P3 setelah parameter dan fixture diverifikasi | HR-04, dokumen 27 |
| Reimbursement dan advance | P2–P3 | HR-06, bukti/approval |
| Komisi dan koreksi payout | P3 | HR-05, sales attribution, dokumen 27 bila dibayar melalui payroll |
| Resign, offboarding, final pay, aset, advance/reimbursement dan penonaktifan akses | P2–P3 untuk proses administrasi; pembayaran final resmi setelah rule tervalidasi | HR-07, dokumen 29, dokumen 24, HR-06, IAM, payroll 27 |
| Dashboard dan pelaporan lintas ERP dengan metrik versioned, as-of/freshness, drill-down, antrean tindakan dan ekspor privat; laporan rinci tetap pada modul pemilik | P2 ringkasan operasional; P3 analitik lengkap | DSH-01–03, HR-08, dokumen 30 |

Kesulitan payroll tetap prioritas bisnis. Sebelum mesin payroll siap, P0/P2 menyiapkan daftar komponen, cut-off dan contoh perhitungan yang disepakati. Jangan menggunakan kalkulasi yang belum tervalidasi untuk membayar gaji hanya demi tanggal pilot.

## 5. Master Data

Sumber domain: [Master Data](14-master-data.md). Butir di bawah adalah entitas/kelompok isi layar; UOM, NIE dan harga acuan berada pada detail Produk, bukan menu utama tersendiri. Kontak dikerjakan di CRM dengan identitas bersama.

| Fitur | Fase | Requirement / dependensi |
|---|---|---|
| Produk: kategori, UOM/konversi, NIE dan bukti, profil mutu, Harga Beli Acuan dan Harga Jual Standar pada detail Produk | P1 dasar; P2 masa berlaku lengkap | MD-01/02; harga jual standar memakai mekanisme pricelist Sales |
| Pelanggan: identitas, wilayah, PIC, legalitas, onboarding dan tautan read-only ke fasilitas kredit/piutang | P1 dasar; P2 kelengkapan/verifikasi | MD-04/05; TOP/limit di Finance, opening AR di Finance |
| Supplier dan Vendor terpisah: identitas, PIC, legalitas, kontrak/tautan agreement dan status | P1 dasar; P2 verifikasi lengkap | MD-03; TOP per PO/kontrak Pengadaan, rekening dan AP di Finance |
| Gudang/locator, Item Operasional dan referensi kategori/UOM/channel/rayon pada form terkait | P1 dasar; P2 masa berlaku lengkap | MD-01–04, FIN-13; movement/stok di Warehouse; tanpa submenu referensi tersendiri |

## 6. Setting

Sumber domain: [Setting](15-setting.md). Setting mengelola policy global/default, IAM, approval dan konfigurasi; fasilitas TOP/limit per pelanggan berada di Finance.

**Setting → Pengaturan Persetujuan** mencakup form aturan/tahapan/delegasi, validasi/simulasi, versi/masa berlaku, batas kewenangan, persetujuan sendiri dan pemicu revisi. Antrean Persetujuan Saya tampil pada Dashboard; keputusan berjalan pada resource modul asal. Persetujuan SO hanya bila aturannya aktif (24 Oktober 2026).

| Fitur | Fase | Requirement / dependensi |
|---|---|---|
| Tiga belas submenu Setting sesuai navigasi: Profil Perusahaan, Pengguna, Peran (dengan Matriks Hak Akses pada detail peran), Kebijakan Operasional, Kebijakan Pelanggan Baru, Kredit & Exposure global, Pengaturan Persetujuan, Template Cetak, Penomoran Dokumen, Daftar Referensi & Alasan, Periode & Closing, Impor/Ekspor & Arsip, Audit | P1 dasar; approval/template/import lengkap bertahap | IAM-01–10, CFG-01–07, MIG-01 |
| Profil Perusahaan editable langsung dari UI; dokumen issued mempertahankan snapshot | P1 | APP-00, IAM-10 |
| Kebijakan Operasional lintas modul dengan versi, validasi dan snapshot | P1 dasar; P2 seluruh katalog | CFG-01–07, dokumen 40 |
| Pengguna multi-peran, Matriks Hak Akses, peran baru berizin penuh sesuai katalog saat dibuat, perluasan peran lama satu per satu, pratinjau izin efektif, hapus/arsip pengguna dan hapus peran dari daftar | P1 | IAM-01/04/11 |
| Aturan persetujuan untuk unlock SO dan exception domain lain, limit serta delegasi | P1 aturan inti; P2 konfigurasi lengkap | OTC-08/09, IAM-02 |
| Nomor dokumen, template, audit, periode, import staging dan deduplikasi | P1 inti; P2 editor/arsip lengkap | IAM-03, ADM-01, FIN-07, MIG-01 |

## 7. Platform dan penyiapan lintas modul

| Fitur | Fase | Requirement / dependensi |
|---|---|---|
| Opening balances, kontrol total dan posting | P0 persiapan; P2 aktivasi nyata | MIG-01; pemilik saldo tetap domain terkait |
| Backup/restore, pemantauan dan pengaturan notifikasi | P1 dasar; P2 operasi | NFR-03/04 |
| Shell web kantor React dan aplikasi mobile Vue, kontrak/token visual bersama | P1 | APP-01/02, NFR-08/10 |
| Tailwind CSS, token bersama dan DataTable TanStack React/Vue | P1 | APP-03, NFR-12 |
| TanStack Query, cache memori per sesi dan invalidasi setelah mutasi | P1 | APP-04, NFR-11/12 |
| Event realtime WebSocket/SSE fallback, cursor/replay, invalidasi TanStack Query dan reconnect terkontrol | P1 fondasi; P2 hardening skala | APP-05, NFR-13; payload tetap dibatasi izin dan GET menjadi sumber DTO |
| Toast Sonner pada React dan Vue Sonner pada Vue, aksesibel, dengan status transaksi berdasarkan respons server | P1 | APP-03/04; tidak menggantikan field error, blocker atau status belum terkonfirmasi |
| JWT/refresh/revocation lintas frontend; job BullMQ idempotent | P1 | NFR-03/09/10, durable outbox |
| Login (MFA bila diaktifkan) → bootstrap izin → stream; refresh/reconnect memvalidasi sesi, perubahan akses mereset cache dan navigasi, revoke menutup koneksi lintas tab/perangkat | P1 | IAM-11, NFR-03/10/13 |

## 8. Urutan irisan implementasi

| Irisan | Hasil yang dapat diuji | Syarat selesai |
|---|---|---|
| V0 Fondasi | Shell Next.js/Nuxt, Tailwind/tokens, TanStack Query/Table, NestJS/Prisma, login/role bersama, master, audit, period, queue/outbox dan event stream realtime | Izin kedua klien/API/export/event benar; cache terisolasi; tabel sesuai kontrak API; nomor tidak ganda; retry/replay tidak menduplikasi |
| V1 Stok masuk | PO–GR–stock/cost–supplier invoice–AP | Qty/nilai/GRNI/AP cocok dengan GL; duplikat ditolak |
| V2 Penjualan | SO lengkap–credit–alokasi bertahap–dispatch–POD–invoice–AR; unlock, backorder/tutup sisa dan pembatalan | Kredit sebelum alokasi, grant tepat lingkup, dokumen sesuai alokasi/aktual, original qty tetap, pembatalan berbukti tidak menghapus AR, COGS/revenue tidak ganda |
| V3 Uang dan closing | Payment, allocation, aging, bank, trial balance, close | Retry aman, saldo cocok, periode tertutup menolak posting |
| V4 Lapangan | Kunjungan sales, tugas gudang aplikasi mobile, target/review web kantor | Mobile usable; basis realisasi konsisten; offline tidak dianggap tersimpan |
| V5 Data nyata | Opening/staging/reconciliation | Checklist kesiapan produksi lulus |
| V6 SDM dan perluasan | Payroll, aset, konsinyasi, recall lengkap | Skenario serta aturan khusus tervalidasi |

Stack telah disepakati; estimasi irisan tetap bergantung kapasitas developer dan keputusan bisnis. Dua frontend menambah pekerjaan UI/deployment, sehingga pada awal Oktober demonstrasikan irisan yang benar-benar lulus. Fitur yang belum dibuat ditampilkan sebagai belum tersedia dalam catatan rilis, bukan tombol kosong yang memberi kesan bekerja.

## Pembaruan fitur yang disepakati — 24 September 2026

- **Dashboard** sebagai menu pertama: ringkasan lintas modul dan tugas sesuai hak akses, dengan tautan ke rincian dan pemisahan nilai SO, invoice diposting, serta pembayaran diterima.
- **A/T Penjualan** di Sales & Marketing dan **A/T Tagihan** di Finance: penyusunan target dan pemantauan aktual bulanan, triwulan, semester, tahunan.
- Penerima target dapat diatur dari pengguna aplikasi, tidak terikat jabatan/peran; satu pengguna dapat menerima kedua jenis target. Mendukung cakupan pelanggan/channel/rayon, pembagian pencapaian tanpa penghitungan ganda, revisi beralasan dengan riwayat, dan akses sesuai izin.
- Target bulanan terakumulasi secara konsisten; target awal dapat diisi manual dan usulan sistem ditetapkan pengguna berwenang. Aktual penjualan dari invoice diposting; aktual penagihan dari pembayaran terverifikasi, diposting dan dialokasikan ke invoice. Nota kredit tidak dihitung sebagai pembayaran.
- Acuan: TGT-01–11 dan DSH-01–02 dalam Requirements. Katalog skema penjualan/penagihan/kunjungan telah disetujui; nominal, qty dan hitungan unik memakai satuan serta agregasi masing-masing. Ini adalah fitur yang direncanakan; rincian kebijakan yang belum diputuskan tercantum di sana, bukan klaim fitur sudah diimplementasikan.

## 9. Definition of done

Requirement ID dan acceptance scenario terhubung ke kode/tes; role/scope diterapkan; input divalidasi; transaksi atomik/idempotent; perubahan audit tercatat; dokumen dan laporan dapat ditelusuri; UI menangani error/empty/loading; seed data uji fiktif tersedia; backup/migration terdokumentasi; reviewer proses menerima hasil. Klaim siap produksi hanya berlaku pada cakupan/data yang melewati gerbang PRD.


### Kebijakan pelanggan, penagihan dan perjalanan dinas

- Master pelanggan menyimpan mode COD/prepay/credit, status verifikasi onboarding, legalitas, PIC dan jadwal tukar faktur.
- Jadwal follow-up piutang H-7, H, H+3, H+7, H+14; freeze default H+30 setelah jatuh tempo.
- Termin dipilih pada SO; kebijakan COD awal pelanggan baru opsional, default nonaktif (24 Oktober 2026).
- Cash advance maksimal tujuh hari sebelum perjalanan, settlement maksimal lima hari setelah selesai, dan pembayaran klaim mengikuti cut-off tanggal 10/25.
- Plafon luar kota mengikuti dokumen 17; plafon dalam kota dan parameter yang masih kosong harus diisi melalui Setting.







## Status implementasi CRM tahap pertama — 29 September 2026

CRM-01/05/06/07 dan persiapan CRM-09 kini memiliki alur web Prospek → Kontak → Kebutuhan Produk → Peluang draft dengan API, persistence, audit, idempotency dan scope server. Draft belum merupakan pipeline aktif dan tidak memenuhi keseluruhan CRM-09/10. Penawaran, stage/confidence, Win/Lost, lampiran, aktivitas terpadu dan kelengkapan transaksi Master Pelanggan masih ditunda. Bukti pengujian serta prasyarat penomoran dicatat pada [pembangunan CRM](../mockup/crm-build.md).

## Status implementasi OTC 5 Oktober 2026

Kontrol kredit/lot/harga/pajak efektif, approval PR terarah, dokumen/bukti privat serta alur standar SO sampai alokasi penerimaan telah dihubungkan ke Office dan diuji pada data fiktif. Perluasan menambah approval unlock/harga per scope dan masa berlaku, durable reevaluation, reallocation backorder, WAPU/PPh terverifikasi, pajak uang muka, evidence faktur resmi, konfigurasi posting GL/rekening/periode dan bank matching parsial/gabungan dengan review/close. Belum seluruh OTC-08/09, QC, backorder lifecycle, pajak/correction/closing, PREPAY UI, rekonsiliasi seluruh sumber atau parity visual selesai. Matriks aktual dan release blocker: [catatan pembangunan OTC](../development/otc-operational-build.md). Status prioritas pada tabel fitur tidak otomatis selesai karena route tersedia.

## Pembaruan backend O2C — 5 Oktober 2026

Perbaikan backend audit F01–F07 dan dukungan data F08 telah ditambahkan, bersama kontrol pemulihan order, reservasi, approval, refund, bank dan periode. Statusnya implementasi dengan validasi statis; belum lulus pengujian runtime. F08 UI dan kesetaraan mockup ditunda atas arahan pengguna. Daftar kekurangan backend lanjutan dan kebutuhan rollout ada pada laporan remediasi; ini bukan deklarasi seluruh O2C selesai.

Rujukan implementasi dan batas verifikasi: [laporan remediasi backend O2C](../development/o2c-backend-remediation-2026-10-05.md).


## Pengelolaan akses — keputusan 7 Oktober 2026

IAM-01/04/11: pengguna dapat memiliki beberapa peran; izin efektif adalah gabungan izin peran aktif sesuai scope. Pengelolaan akun dan peran hanya untuk pemegang peran aktif Admin Sistem (`ADMIN_SYSTEM`) dalam perusahaan sesi, dengan permission aksi yang sesuai. Nama jabatan atau nama tampilan peran bukan bukti administrator. Pengguna → pilih akun → tetapkan beberapa peran; Peran → Atur Hak Akses → ubah checkbox matriks peran → simpan. Menu Pengguna/Peran/Matriks disembunyikan bagi nonadministrator; deep link dan seluruh endpoint `/users`, `/roles`, `/permissions` beserta mutasinya ditolak 403 walaupun permission IAM terlanjur diberikan. Pengaturan bisnis lain tetap mengikuti permission domain. Tidak ada bypass izin transaksi untuk Admin Sistem. Perubahan akses diaudit dan sesi terdampak dicabut. Tidak ada perubahan model database atau migration; implementasi dan batas validasi dicatat pada [catatan pengelolaan akses](../development/iam-admin-only-2026-10-07.md).
# Keputusan cakupan IAM terbaru — 16 Oktober 2026

P1 IAM mencakup peran fleksibel buat/ubah/hapus, penugasan beberapa peran, matriks fitur/tindakan tanpa kelompok domain, dan Admin Sistem dengan kewenangan penuh termasuk approval sendiri/tanpa penunjukan. Penghapusan peran mencabut sesi anggota dan diaudit. Ini menggantikan batas Admin Sistem pada catatan IAM 7 Oktober.

## Migrasi capability submenu — 16 Oktober 2026

IAM-01/04 mencakup pemisahan CRM, Master Data, referensi, tahapan barang keluar, Proforma dan dua menu Backorder melalui katalog, migrasi grant, enforcement API serta matriks Office. Tidak menambahkan endpoint hapus yang belum ada atau mengubah menu belum operasional menjadi fitur selesai. Gate meliputi isolasi API antar submenu, data kontak terkait, audit/scope migrasi, sesi administrator dan QA visual pada sesi nyata. Bukti dan batas validasi pada catatan hak akses fleksibel.

CRM-01/05, APP-03 (16 Oktober 2026): daftar Peluang tersedia sebagai submenu CRM tersendiri, dengan pencarian dan pagination server serta crm_opportunity.read. Submenu Pelanggan CRM dihapus untuk menghindari duplikasi Master Data; URL lama dialihkan. Tidak mengklaim seluruh pipeline/stage telah dibangun.

## O2C Release 1 (29 Oktober 2026)

Release 1 mencakup SO → Surat Jalan → Invoice. Picking, checking, packing, POD terpisah dan backorder otomatis ditunda.


## O2C Release 1 (29 October 2026)

Issued Surat Jalan is the stock, revenue and HPP event; customer receipt is recorded separately (decision 30 October 2026). One SO supports cumulative Surat Jalan quantities up to ordered quantity; Invoice is created only from an issued Surat Jalan. Termin/TOP is selected on SO and snapshotted. Surat Jalan uses existing outbound permission grants; no delivery_note grants are introduced.



## Backend Invoice dan Pembayaran — 30 Oktober 2026

Tahap backend Invoice & Terima Pembayaran mencakup API daftar/form/detail/draft/Submit, penerimaan atomik, bukti dan potongan, izin nilai, snapshot dan migrasi. Sumber tetap Release 1 SJ terbit. UI mockup, koreksi/reversal khusus pembayaran langsung dan release gate produksi belum dinyatakan selesai. Laporan verifikasi berada pada docs/development/invoice-payment-backend-2026-10-30.md.
# Persediaan vertical slice — 30 Oktober 2026

Backend tahap pertama mencakup daftar Persediaan, detail produk, Kartu Stok dan opname/adjustment minimum sesuai mockup. PTP, retur supplier, recall, pemusnahan dan konsinyasi tetap ditunda; UI tidak dinyatakan selesai hanya karena kontrak API tersedia.
