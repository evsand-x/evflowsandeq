# Audit Konsistensi Blueprint ERP

## Status struktur terkini — 26 September 2026

Dokumen domain telah dikonsolidasikan menjadi tujuh sumber sesuai menu utama: [Dashboard](09-dashboard.md), [Sales & Marketing](10-sales-marketing.md), [Warehouse & Logistik](11-warehouse-logistik.md), [Finance](12-finance-administration.md), [HRIS](13-hris.md), [Master Data](14-master-data.md), dan [Setting](15-setting.md). Dokumen `00`–`08` tetap dokumen utama; 31/39–42 adalah dokumen pendukung lintas modul. ID requirement dan keputusan dipertahankan.

Bagian audit bertanggal 25 September di bawah adalah **catatan historis sebelum konsolidasi**. Nomor dokumen domain lama yang disebut di sana hanya menunjukkan asal aturan, bukan peta sumber terkini. Untuk implementasi baru, ikuti [Peta Dokumen](00-document-map.md).

---

Tanggal audit: 25 September 2026  
Ruang lingkup: dokumen utama `00`–`08`, tujuh dokumen domain `09`–`15`, serta dokumen pendukung baseline, policy, label dan audit.

## 1. Status

Pemeriksaan referensi teknis dan kelengkapan domain selesai. Blueprint masih merupakan spesifikasi rancangan; audit ini tidak menyatakan aplikasi sudah diimplementasikan.

### Cakupan tujuh dokumen domain

| Modul | Kondisi | Gap |
|---|---|---|
| Sales & Marketing | Ditutup | CRM memakai dokumen 09; order-to-cash, SO, kredit/unlock, fulfillment handoff, pembatalan dan hubungan invoice/retur memakai dokumen 32 |
| Warehouse & Logistik | Ditutup | Pengadaan, inbound, stok, picking, outbound, retur, konsinyasi, recall dan pemusnahan memakai dokumen 33 |
| Finance | Memadai | Dokumen 10 menjadi overview, 11–25 menjadi rincian Finance, 37 menjadi sumber domain pajak, dan 38 menjadi kontrak ekspor XML pajak keluaran Coretax |
| HRIS | Ditutup | Proses 26–29 dan master karyawan, struktur organisasi, kontrak memakai dokumen 34 |
| Master Data | Ditutup | Produk/UOM/NIE, pelanggan/kontak, supplier, vendor, gudang/locator dan referensi memakai dokumen 35 |
| Setting | Ditutup | Pengguna/peran, matriks izin, approval policy, template, penomoran, alasan, periode, audit dan policy versioning memakai dokumen 36; katalog parameter operasional editable memakai dokumen 40 |

Dokumen 30 bukan pengganti dokumen domain; ia hanya sumber lintas modul untuk ringkasan dan pelaporan. Gap domain yang ditemukan pada pemeriksaan awal sudah ditutup oleh dokumen domain 32–38; dokumen 39 kemudian mengindeks parameter lintas domain yang masih memerlukan keputusan.

## 2. Perbaikan yang dilakukan

| Temuan | Perbaikan |
|---|---|
| Dokumen 30 hanya berjudul Dashboard dan Laporan HRIS | Diubah menjadi [Dashboard dan Pelaporan ERP](09-dashboard.md) lintas Sales, Warehouse, Finance dan HRIS |
| Risiko munculnya modul “Definisi KPI” | Ditegaskan bahwa metadata definisi metrik bukan modul/menu; pengaturan editable tetap berada pada Setting/domain terkait |
| Laporan HRIS tercampur dengan kepemilikan Dashboard | HRIS memiliki laporan rinci; Dashboard hanya menampilkan tab/ringkasan sesuai izin |
| Label lama “Beranda per peran” | Dinormalisasi menjadi “Dashboard per peran” |
| PWA disebut sebagai kanal utama di beberapa bagian | Dinormalisasi: aplikasi mobile Nuxt/Vue dikemas untuk Android/iOS; PWA/browser hanya akses tambahan |
| Assignment aset dan final pay tersebar | Dokumen 24, 27 dan 29 sekarang saling merujuk; aset belum kembali tidak otomatis menahan final pay |
| Rekrutmen, kehadiran, payroll dan offboarding memiliki laporan lokal | Semua ringkasan lintas modul merujuk dokumen 30; transaksi tetap dikelola pada sumber domain |
| PPh Badan belum terurai dalam domain pajak | Dokumen 37 dan dokumen inti kini menghubungkan rekonsiliasi fiskal, kredit/angsuran, provision/true-up, jurnal, closing, laporan dan Dashboard |
| Coretax ditunda secara menyeluruh meski template pajak keluaran sudah tersedia | Ekspor XML pajak keluaran diaktifkan sebagai proses file pada dokumen 38; direct API submission dan parser hasil terstruktur tetap ditunda sampai kontraknya tersedia |
| Database hanya mencantumkan sebagian entitas domain | Dokumen 03 diperluas untuk Vendor, customer compliance, item operasional, warehouse/procurement, finance, tax, asset, budget, reporting dan HRIS; status kelengkapan membedakan model logis dari data dictionary/DDL fisik |
| User Flow belum memuat sejumlah proses domain | Dokumen 06 diperluas dengan Dashboard/reporting, retur supplier, stock opname, recall, pemusnahan, konsinyasi, bank reconciliation, reimbursement/advance, perjalanan dinas, reopen, CoA/jurnal, kontrak, Master Data/configuration dan arsip |
| Parameter terbuka tersebar tanpa urutan finalisasi | Dokumen 39 mengelompokkan rekomendasi menjadi enam gelombang, membedakan baseline pilot dari kebijakan resmi, menetapkan owner dan urutan keputusan |
| Gelombang A telah difinalkan tetapi masih berlabel usulan pada dokumen domain | README, Requirements, Finance, AR/AP, HPP, harga, aset, OTC, Warehouse dan Features disinkronkan; keputusan yang masih memerlukan angka perusahaan menjadi mandatory configuration, bukan default tebakan |
| Pengguna meminta finalisasi Gelombang B–F | Dokumen 39 menjadi register final; Warehouse/Master, Pajak/Coretax, HRIS, CRM/mobile, IAM/Architecture, Dashboard, Database, API, Design dan Features diselaraskan. Nilai resmi yang belum tersedia dinyatakan release gate/mandatory configuration |
| Nama aplikasi sebelumnya masih berupa label kerja | Nama final **evflow** dicatat pada README/D28, Document Map, PRD, Requirements APP-00, Architecture, User Flow, Design, Features, baseline, panduan agent, Skill dan konfigurasi infrastruktur |
| Perubahan nama perusahaan sempat dirancang terlalu ketat | D29/IAM-10 menetapkan edit langsung melalui Setting → Profil Perusahaan tanpa tanggal berlaku, alasan atau approval; snapshot hanya dipertahankan pada dokumen yang sudah diterbitkan |
| Parameter operasional masih tersebar sebagai angka tetap | D30/CFG-01–07 dan dokumen 40 mengubahnya menjadi nilai awal editable melalui UI, dengan save langsung dan versi otomatis; invariant tetap dipisahkan sebagai kontrol backend |
| Label teknis berisiko tampil sebagai bahasa pengguna | Dokumen 41 menetapkan label manusia untuk katalog policy, arti nilai nol/kosong, satuan, aturan Bahasa Indonesia, serta batas **Detail teknis** pada UI; dokumen 03, 04, 07, 36 dan 40 merujuk aturan tersebut |
| Pemetaan istilah belum konsisten antar domain | Dokumen 42 memetakan atribut audit, workflow, approval, Finance, pajak, gudang, CRM, HRIS, API dan kode respons; perubahan baru wajib menambah pasangan teknis dan label manusia sebelum rilis |

## 3. Struktur sumber kebenaran

| Topik | Sumber utama |
|---|---|
| Tujuan, scope, fase dan gerbang penggunaan | 01 PRD |
| Requirement dan acceptance | 02 Requirements |
| Entitas, relasi dan constraint | 03 Database |
| Endpoint dan command | 04 API |
| Stack, boundary, keamanan dan deployment | 05 Architecture |
| Urutan proses | 06 User Flow |
| Navigasi, layar dan interaksi | 07 Design |
| Fase dan backlog | 08 Features |
| Dashboard dan pelaporan lintas modul | 30 Dashboard & Pelaporan ERP |
| Aturan domain | 09–29 dan 32–38 sesuai domain masing-masing |
| Keputusan final parameter dan release gate | 39; aturan rinci tetap diperbarui kembali ke dokumen domain terkait |
| Katalog parameter operasional editable | 40; Setting 36 menyediakan UI dan dokumen domain memakai kode OPS terkait |
| Label dan istilah yang tampil kepada pengguna | 41; seluruh dokumen teknis tetap menjadi kontrak implementasi tetapi wajib memetakan field yang terlihat ke label manusia |
| Matriks istilah lintas domain dan API | 42; menjadi daftar wajib untuk Design, User Flow, Requirements, dokumen domain, laporan, ekspor dan pesan error |
| Hubungan dan kepemilikan dokumen | 00 Document Map |

## 3.1 Matriks keterlacakan modul

| Modul | Requirement | Domain | User Flow | Design | Database/API | Features |
|---|---|---|---|---|---|---|
| Sales & Marketing | CRM, OTC, TGT, EST | 09, 22, 25, 32 | 06 bagian 1 dan 6 | 07 Sales | 03/04 Sales/OTC | 08 bagian 1 |
| Warehouse & Logistik | WH, PTP dan fulfillment OTC | 19, 24, 33 | 06 bagian 1–2 | 07 Warehouse | 03/04 inventory/procurement | 08 bagian 2 |
| Finance | FIN dan accounting events | 10–25, 37–38 | 06 bagian 3–5, 10–12 | 07 Finance | 03/04 finance/accounting/tax | 08 bagian 3 |
| HRIS | HR | 17, 24, 26–29, 34 | 06 bagian 7 | 07 HRIS | 03/04 HR/payroll | 08 bagian 4 |
| Master Data | MD | 35 serta field rinci 07 | alur create/validate pada domain terkait | 07 Master Data | 03/04 master | 08 bagian 5 |
| Setting | IAM, NFR policy terkait | 36 | 06 bagian 0 | 07 Setting | 03/04 identity/shared | 08 bagian 5 |
| Dashboard | DSH serta ringkasan TGT/EST/HR | 30 | tindakan kembali ke resource asal | 07 Dashboard | projection 03/04/05 | 08 lintas modul |

AI implementer wajib membaca baris modul yang dikerjakan dari kiri ke kanan. Bila ada perbedaan, gunakan urutan prioritas pada dokumen 00 dan jangan memilih aturan berdasarkan file yang paling baru dibaca.

## 4. Pemeriksaan otomatis final Gelombang A–F

Pemeriksaan terakhir dijalankan pada 25 September 2026 setelah sinkronisasi keputusan final Gelombang A–F dan koreksi konflik ringkasan pipeline pada README.

- Link Markdown relatif: **0 hilang**.
- ID requirement duplikat: **0**.
- ID keputusan README duplikat: **0**.
- Conflict marker (`<<<<<<<`, `=======`, `>>>>>>>`): **0**.
- Baris tabel Markdown dengan jumlah kolom tidak konsisten: **0**.
- Penanda keputusan lama yang masih terbuka/kandidat pada area yang sudah difinalkan: **0**.
- Typo dan istilah teknologi lama yang menjadi sasaran audit: **0**.
- Nama aplikasi final: **evflow**; referensi nama produk lama pada isi repository: **0**.
- Dokumen dashboard lintas ERP: **1**, yaitu dokumen 30.
- Gap domain utama yang belum memiliki sumber: **0**.
- Menu utama: **7**, yaitu Dashboard dan enam modul utama yang disepakati.
- Menu “Definisi KPI”: **tidak ada**.
- Status parameter bisnis Gelombang A–F: **Approved untuk blueprint/pilot**; konfigurasi dan bukti resmi pada bagian 6 tetap menjadi release gate operasional.

## 5. Aturan sinkronisasi setelah audit

Setiap perubahan baru harus memperbarui, bila relevan:

1. requirement pada 02;
2. dokumen domain sumber;
3. user flow pada 06 bila urutan berubah;
4. design pada 07 bila menu/form berubah;
5. database pada 03 bila kontrak data berubah;
6. API pada 04 bila command atau resource berubah;
7. features pada 08 bila fase berubah;
8. 00, README dan dokumen 30 bila kepemilikan, navigasi atau pelaporan berubah.

Dokumen domain tidak membuat menu utama baru tanpa perubahan eksplisit pada 01/02/07. Ringkasan Dashboard tidak membuat aturan bisnis baru; formula tetap merujuk sumber domain dan menyimpan versi definisi.

## 6. Release gate yang masih memerlukan data/evidence

- rule resmi payroll, BPJS, PPh 21, THR, cuti dan final pay;
- contoh file serta profil mesin fingerprint;
- tax profile, tarif/rule, XSD dan katalog Coretax resmi serta UAT Accepted;
- shelf-life/suhu dan mandatory-field matrix berdasarkan dokumen produk/pihak;
- assignee/limit approval, rekening, CoA mapping, template cetak dan penomoran published;
- proof-of-concept perangkat Android/iOS, backup/restore dan permission test;
- saldo awal operasional/keuangan yang direkonsiliasi.

Ini bukan keputusan blueprint terbuka. Sistem harus memperlakukannya sebagai konfigurasi/evidence wajib dan menahan penggunaan resmi domain terkait sampai lengkap.\n
