# Domain Dashboard

Keputusan izin 16 Oktober 2026: tujuh tampilan Dashboard yang operasional masing-masing memiliki capability `dashboard_<view>.read` untuk peran biasa. Admin Sistem memiliki akses bawaan penuh. Izin tampilan hanya membuka layar/API terkait; setiap metrik, antrean, laporan dan ekspor tetap mengikuti izin serta scope sumber. Peran baru memperoleh capability katalog saat dibuat, sedangkan peran lama diatur Admin Sistem. Tidak ada grant otomatis untuk peran lama pada migrasi katalog.

Dokumen ini adalah sumber domain kanonis untuk modul ini. Judul ‘Bagian asal’ mempertahankan keterlacakan isi sebelum konsolidasi; prioritas keputusan tetap mengikuti Peta Dokumen.


---

## Bagian asal: 09-dashboard.md

# Dashboard dan Pelaporan ERP

Status: spesifikasi lintas modul. Dokumen ini mengatur penyajian ringkasan, antrean tindakan, laporan operasional dan ekspor untuk Dashboard, Sales & Marketing, Warehouse & Logistik, Finance, dan HRIS. Aturan transaksi serta formula domain tetap dimiliki dokumen sumber masing-masing. Dokumen ini tidak membuat modul **Definisi KPI** atau menu baru dengan nama tersebut.

## 1. Batas dan sumber kebenaran

Dashboard adalah tampilan hasil dan pintasan ke pekerjaan. Dashboard tidak menjadi ledger, tidak menyetujui transaksi, tidak mengubah saldo, dan tidak menggantikan laporan domain.

| Area | Sumber aturan dan data |
|---|---|
| Sales/CRM | Requirements CRM/TGT/EST dan [CRM Operasional](10-sales-marketing.md) |
| Warehouse/Logistik | Requirements WH/PTP/OTC, User Flow dan stock ledger |
| Finance | [Finance dan Akuntansi](12-finance-administration.md), [Kartu Piutang/Utang](12-finance-administration.md), [Closing](12-finance-administration.md), [Laporan Keuangan](12-finance-administration.md), [Pajak dan Kepatuhan](12-finance-administration.md), dan [Coretax XML Pajak Keluaran](12-finance-administration.md) |
| HRIS | [Waktu & Kehadiran](13-hris.md), [Payroll](13-hris.md), [Rekrutmen & Onboarding](13-hris.md), [Resign & Offboarding](13-hris.md) |
| Tugas/persetujuan | approval instance dan resource asal; Dashboard hanya menggabungkan antrean |

Definisi perhitungan disimpan sebagai metadata versi agar angka dapat dijelaskan. Metadata tersebut bukan modul navigasi. Pengaturan yang memang boleh diedit pengguna tetap berada pada menu terkait, misalnya **Setting → Skema Target**, kebijakan kredit, atau kebijakan HRIS.

## 2. Navigasi final

Urutan navigasi tingkat atas tetap:

1. Dashboard
2. Sales & Marketing
3. Warehouse & Logistik
4. Finance
5. HRIS
6. Master Data
7. Setting

**Dashboard** memiliki tampilan sesuai izin:

- Ringkasan Eksekutif
- Sales
- Warehouse & Logistik
- Finance
- HRIS
- Tugas & Persetujuan
- Laporan & Ekspor

Ini adalah tab/halaman dalam Dashboard, bukan tambahan modul utama. Laporan rinci tetap berada pada modul pemiliknya; halaman Laporan & Ekspor hanya menyediakan katalog dan riwayat file yang boleh diakses pengguna.

## 3. Aturan penyajian bersama

Setiap kartu, grafik dan laporan wajib membawa:

- periode atau `as_of_date`;
- scope perusahaan, departemen, rayon, gudang atau pengguna yang berlaku;
- satuan: nilai, qty, dokumen, pelanggan unik, karyawan unik atau kejadian;
- versi definisi/peraturan;
- `data_as_of` dan `updated_at`;
- status fresh, stale, calculating atau failed;
- tautan drill-down ke transaksi sumber bila pengguna berhak.

Data gagal atau belum dihitung ditampilkan sebagai **Belum tersedia/Gagal diperbarui**, bukan nol. Total server berasal dari seluruh dataset sesuai filter, bukan halaman tabel yang sedang terlihat.

## 4. Ringkasan Eksekutif

Ringkasan dipilih berdasarkan hak akses dan tidak harus menampilkan seluruh kartu kepada setiap pengguna:

- penjualan net, target, estimasi dan aktual;
- order terbuka, pemenuhan, backorder dan pengiriman berjalan;
- piutang, past due, penerimaan kas dan estimasi penagihan;
- utang, pembayaran mendatang dan GRNI;
- nilai/kondisi persediaan serta exception batch/expiry;
- status closing, jurnal gagal dan rekonsiliasi;
- headcount/status HRIS tanpa membuka data privat;
- tugas dan approval yang membutuhkan tindakan pengguna.

Nilai SO, invoice posted, pendapatan yang diakui dan pembayaran diterima ditampilkan terpisah. Komitmen pembelian, AP dan kas keluar juga tidak digabung menjadi satu angka.

## 5. Dashboard Sales & Marketing

Implementasi web bertahap yang disetujui 29 September 2026 pada implementasi historis dan standar global web. Backend tahap ini menyediakan jadwal tindak lanjut prospek milik pengguna yang berizin; sumber transaksi Sales lainnya belum tersedia dan ditandai unavailable, bukan diisi nol. Kebutuhan minimum di bawah tetap menjadi sasaran lanjutan. Lihat [cakupan dan validasi](../mockup/dashboard-sales-build.md) serta kontrak `/dashboard/sales` pada dokumen API.

Ringkasan minimum:

- prospek, pelanggan terdaftar belum bertransaksi dan pelanggan bertransaksi;
- peluang per stage/confidence, Win, Lost dan timeout bulanan;
- penawaran aktif, akan kedaluwarsa, revisi dan tanggapan item;
- rencana/realisasi kunjungan, kunjungan menunggu persetujuan dan bukti belum lengkap;
- follow-up jatuh tempo dan tugas maintain;
- sampel/trial berjalan dan pengembalian tertunda;
- SO Open, fulfillment parsial, backorder dan unlock menunggu keputusan;
- A/T Penjualan, estimasi penjualan dan aktual net;
- A/T Kunjungan dan komisi yang masih berstatus accrual/review.

Realisasi penjualan mengikuti basis net yang disetujui. Keberhasilan pipeline berdasarkan PO/SP terverifikasi tidak disamakan dengan invoice posted atau kas diterima.

## 6. Dashboard Warehouse & Logistik

Implementasi web bertahap 29 September 2026 pada implementasi historis, dengan ukuran dan spacing Ringkasan Eksekutif. Endpoint `/dashboard/warehouse` menyediakan pilihan gudang aktif sesuai izin company/gudang; metrik dan antrean operasional belum mempunyai sumber transaksi, sehingga unavailable/null. Tidak menghitung stok dari master gudang/locator. Kebutuhan minimum berikut tetap sasaran lanjutan; lihat [cakupan dan bukti Warehouse](../mockup/dashboard-warehouse-build.md).

Ringkasan minimum:

- stok tersedia, teralokasi, karantina, transit, konsinyasi dan backorder;
- produk/batch mendekati kedaluwarsa, expired, recall atau hold;
- picking, checking dan packing menunggu tindakan;
- pengiriman pelanggan dalam perjalanan, terlambat dan POD belum lengkap;
- kebutuhan persediaan, PR/PO menunggu approval dan PO supplier/vendor terbuka;
- pengiriman supplier berjalan, estimasi tiba dan keterlambatan;
- GR menunggu pemeriksaan, selisih penerimaan dan quality release;
- stock opname dan adjustment menunggu penyelesaian;
- retur di karantina serta pemusnahan menunggu keputusan.

Qty fisik, qty tersedia dan nilai persediaan dibedakan. Nilai/HPP hanya terlihat jika izin mengizinkan.

## 7. Dashboard Finance

Tahap web 29 September 2026 pada implementasi historis, dengan ukuran Ringkasan Eksekutif. Endpoint `/dashboard/finance` memeriksa izin perusahaan dan mengembalikan ketersediaan sumber secara eksplisit. AR/AP, penerimaan, pembayaran, antrean dan closing belum mempunyai transaksi sumber; nilainya null/unavailable. Tidak menyatakan periode Terbuka atau nol saldo. Kebutuhan minimum berikut tetap sasaran lanjutan; lihat [cakupan Finance](../mockup/dashboard-finance-build.md).

Ringkasan minimum:

- AR outstanding, current/past due dan aging bucket;
- jadwal follow-up H-7 sampai H+30, freeze dan unlock;
- penerimaan belum dialokasikan, uang muka dan pembayaran parsial;
- AP supplier/vendor, jatuh tempo, aging dan pembayaran mendatang;
- GRNI dan invoice supplier/vendor dengan exception matching;
- saldo kas/bank buku, mutasi belum cocok dan rekonsiliasi;
- biaya, reimbursement, advance dan prepaid terbuka;
- budget, komitmen, realisasi, sisa dan exception;
- aset, kapitalisasi/penyusutan dan rekonsiliasi;
- faktur pajak keluaran/masukan dan bukti potong yang belum lengkap atau bermasalah;
- status rekonsiliasi pajak terhadap subledger dan buku besar per masa pajak;
- status masa pajak, exception dan tindakan yang masih harus diselesaikan;
- jumlah/nilai faktur pajak keluaran siap ekspor, batch XML gagal validasi, sudah di-download/diunggah dan hasil yang belum diverifikasi;
- status run PPh Badan, estimasi pajak kini, kredit/angsuran tervalidasi, posisi kurang/lebih bayar dan kebutuhan review tahunan;
- jurnal gagal, suspense, close blocker dan status periode;
- A/T Tagihan, estimasi penagihan dan penerimaan aktual.

Laporan keuangan resmi tetap mengikuti [Laporan Keuangan](12-finance-administration.md). Dashboard hanya menyajikan ringkasan dan drill-down ke laporan tersebut.

## 8. Dashboard HRIS

Tahap web 29 September 2026 pada implementasi historis, ukuran Ringkasan Eksekutif dan catatan privasi. Endpoint `/dashboard/hris` memvalidasi hr.read company/privileged dan filter. Sumber SDM belum dibangun: KPI/status proses unavailable, tanpa nominal payroll atau data pribadi. Tidak menghitung headcount dari akun ERP. Lihat [cakupan dan bukti](../mockup/dashboard-hris-build.md); persyaratan suppression/privasi di bawah tetap wajib sebelum sumber nyata diaktifkan.

Ringkasan minimum:

- karyawan aktif, akan bergabung, karyawan baru dan keluar;
- kontrak akan berakhir/kedaluwarsa;
- kebutuhan tenaga, lowongan, kandidat per tahap, interview dan offer;
- onboarding task, blocker dan kesiapan hari pertama;
- kehadiran, keterlambatan, ketidakhadiran, cuti/izin, dinas luar dan exception fingerprint;
- lembur rencana, realisasi, verifikasi dan cut-off;
- status payroll run, exception, pembayaran dan rekonsiliasi;
- resign/offboarding, aset belum kembali, akses belum dicabut dan final pay;
- aset yang ditugaskan kepada karyawan.

Headcount tidak memasukkan kandidat atau pra-mulai. Jumlah karyawan unik dibedakan dari jumlah kejadian. Nominal payroll, rekening, alasan privat, interview notes dan exit interview hanya tersedia bagi scope khusus.

## 9. Tugas & Persetujuan

Tahap web 29 September 2026 pada implementasi historis. Tiga kartu, tab Persetujuan saya/Tindak lanjut/Selesai, pencarian, filter modul, serta panel rincian telah diimplementasikan. `/dashboard/actions` menyediakan next action prospek milik pengguna berizin; jumlah hanya untuk sumber tersebut dan periode/filter aktif. Approval instance dan histori penyelesaian belum tersedia: null/unavailable, tanpa approval/penyelesaian dari Dashboard. Lihat [cakupan](../mockup/dashboard-actions-reports-build.md).

Antrean menggabungkan item yang ditugaskan kepada pengguna, termasuk:

- approval kunjungan, harga/diskon, sampel dan unlock;
- PR/PO, pembayaran, budget exception dan closing;
- koreksi absensi, cuti, lembur dan payroll;
- hiring request, offer, onboarding dan offboarding;
- task operasional gudang, Finance atau HRIS yang mempunyai assignee.

Membaca atau menandai notifikasi tidak menyelesaikan task. Pengguna membuka resource asal dan menjalankan command resmi dengan version, scope dan policy yang sama.

## 10. Laporan & Ekspor

Tahap web 29 September 2026 pada implementasi historis: lima pilihan mockup, parameter tanggal/cakupan/format, dan Ekspor saya. Katalog backend disaring menurut izin domain; seluruh generator sumber laporan dan persistence ekspor masih unavailable. Preview simulasi tidak membuat file. Request ekspor aktual diblokir 409 setelah pemeriksaan akses/parameter. Tampilan tujuh submenu bukan bukti modul operasional penuh; [inventaris dependensi dan bukti](../mockup/dashboard-actions-reports-build.md) tetap berlaku.

Katalog lintas modul menampilkan laporan yang boleh diakses pengguna serta lokasi pemiliknya. Contoh:

| Kelompok | Laporan utama |
|---|---|
| Sales | pipeline, kunjungan, penawaran, target/estimasi/aktual, order dan margin sesuai izin |
| Warehouse | stok, batch/expiry, movement, alokasi, backorder, inbound/outbound, retur dan opname |
| Finance | AR/AP aging, kas/bank, rekonsiliasi, anggaran, aset, trial balance, GL, laba rugi, neraca, arus kas |
| HRIS | karyawan, kontrak, rekrutmen, onboarding, attendance/cuti/lembur, payroll, aset karyawan dan offboarding |

Ekspor besar berjalan melalui job privat. Nilai awal OPS-SYS-03 membuat file kedaluwarsa setelah 7 hari dan dapat diubah melalui Setting; laporan dapat dibuat ulang selama sumber masih dalam retensi. Riwayat menyimpan pembuat, waktu, laporan, filter, scope, definisi, status, checksum, expiry dan audit download. Ekspor tidak memperluas izin layar.

## 11. Definisi dan konsistensi metrik

Tidak ada menu **Definisi KPI**. Sistem menyimpan definisi versi untuk kebutuhan audit dan konsistensi. Definisi bisnis berada pada sumber domain:

- target/estimasi: TGT/EST dan CRM;
- aging/past due/collection: Finance dan kebijakan kredit;
- stok/HPP: Warehouse dan HPP;
- laporan keuangan: Finance/report version;
- headcount/turnover/attendance: HRIS policy.

Jika perusahaan mengubah formula yang configurable, perubahan dibuat pada Setting/domain terkait dengan tanggal efektif. Laporan menyebut versi formula; histori tidak berubah diam-diam.

## 12. Privasi dan hak akses

- API menerapkan field-level authorization sebelum data dikirim;
- scope dapat berupa self, subordinate, department/rayon/gudang, assigned portfolio, Finance, HR atau privileged;
- kartu tanpa hak tidak ditampilkan dan endpoint tidak mengirim field tersembunyi;
- metrik HR sensitif disembunyikan menurut OPS-SYS-02, dengan nilai awal kelompok kurang dari 5 orang; scope HR khusus tetap mengikuti field-level permission;
- attachment, slip, kontrak dan bukti sensitif tidak masuk ekspor umum;
- admin sistem tidak otomatis melihat gaji, biaya, harga modal atau laporan Finance.

## 13. Data, projection dan API

Transaksi domain tetap menjadi sumber otoritatif. Read model lintas modul:

- `dashboard_snapshots`;
- `metric_definitions` dan `metric_results`;
- `action_items`;
- `report_catalog`;
- `report_runs` dan `report_exports`;
- `projection_checkpoints`.

Endpoint konseptual:

- `/dashboard/summary`;
- `/dashboard/sales`, `/dashboard/warehouse`, `/dashboard/finance`, `/dashboard/hris`;
- `/dashboard/actions`;
- `/reports/catalog`, `/report-runs`, `/report-exports`;
- endpoint laporan rinci tetap pada modul asal.

Respons ringkasan memuat definition version, filter/scope, data_as_of, updated_at dan freshness. Projection diperbarui melalui event setelah transaksi sumber commit dan event realtime mendorong invalidasi ke klien; fallback refresh mengikuti OPS-SYS-01. Laporan berat tetap boleh asynchronous. Projection dapat dibangun ulang tanpa mengubah transaksi. Cache tidak menjadi sumber saldo atau status approval.

## 14. Kriteria penerimaan

1. Dashboard hanya memiliki tujuh kelompok tampilan pada bagian 2 dan tidak menambah modul utama.
2. Tidak ada menu Definisi KPI.
3. Setiap angka memiliki periode/as-of, satuan, scope, versi dan freshness.
4. Nilai SO, invoice, pendapatan dan penerimaan kas tidak digabung.
5. Qty stok tersedia, fisik, teralokasi dan nilai persediaan tidak disamakan.
6. Jumlah entitas unik dibedakan dari jumlah kejadian/dokumen.
7. Drill-down dan ekspor menggunakan hak akses yang sama.
8. Tugas hanya selesai melalui resource asal.
9. Dashboard stale/failed tidak menampilkan nol palsu.
10. Projection dapat direkonsiliasi dan dibangun ulang dari sumber.

## 15. Keputusan final

Kartu default mengikuti template peran dan dapat dipersonalisasi hanya pada layout/filter. Formula tidak dapat diubah per pengguna, tetapi pemilik kebijakan dapat mengubah template formula yang didukung melalui Setting. Refresh, suppression HR dan expiry ekspor mengikuti OPS-SYS-01–03. Formula HRIS hanya aktif bila policy sumbernya aktif; data yang belum siap tampil sebagai Belum tersedia, bukan nol.
