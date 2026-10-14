# Dashboard Warehouse & Logistik

Status 7 Oktober 2026: acuan artefak desain pada catatan historis ini telah dicabut. Pemetaan frame dan perbandingan lama hanya bukti pekerjaan terdahulu, bukan perintah untuk implementasi berikutnya. Panduan aktif: [implementasi web](web-implementation-guide.md) dan [standar global](web-design-standard.md).

Pengguna menyetujui pembangunan web dan backend sumber tersedia. Acuan Pencil `q1OcsT` (1600×1060), diperiksa melalui struktur dan render pada 29 September 2026. Ukuran, spacing, kontrol tanggal/Ekspor dan scrollbar mengikuti standar global Ringkasan Eksekutif. Mobile ditunda.

## Cakupan dan penerimaan

| Permukaan | Requirement | Sumber / batas tahap ini |
|---|---|---|
| Empat KPI: penerimaan, picking, pengiriman, karantina | DSH-01–03, PTP-02, WH-01/03/08 | Sumber transaksi belum dibangun: null/unavailable, bukan nol |
| Antrean operasional dan rincian | DSH-02, WH-02/03/08 | Belum ada GR/picking/SJ/inspeksi; fixture hanya preview |
| Perhatian persediaan: minimum, backorder, expiry, karantina | WH-01–03, OTC-12 | Tidak menghitung stok dari master atau menetapkan threshold baru |
| Pilihan gudang | MD-01, DSH-01, APP-04 | Master gudang aktif dari database; izin warehouse.read company/privileged atau warehouse tertentu |
| Periode, filter tahap, refresh | DSH-03, APP-03/04 | Query whitelist; scope/periode/versi/as-of; data operasional tetap unavailable |
| Ekspor dan tautan modul | DSH-02 | Feedback belum tersedia; bukan transaksi/ekspor simulasi sukses |

Endpoint read-only `/dashboard/warehouse`. Pilihan gudang hanya id/kode/nama; tidak membuka alamat, harga atau HPP. Scope gudang harus milik company sesi dan aktif; gabungan beberapa scope didukung. Permintaan gudang di luar izin ditolak secara generik. Izin didaftarkan melalui migration tanpa memberikan hak ke role/user; penugasan memakai IAM yang telah tersedia. Tidak ada migrasi ledger atau mutasi bisnis.

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Kriteria: layout mockup dengan standar ukuran global; loading/error/denied/unavailable/empty jelas; tidak ada angka palsu di sesi nyata; pengujian database menguji isolasi company, gudang aktif, gabungan scope, input dan penolakan izin; pengujian HTTP autentikasi dan kontrak; browser desktop/360px dan keyboard. Sumber operasional penuh dan realtime tetap tahap berikutnya.

## Implementasi dan validasi

- Route nyata `/?view=warehouse`; preview `/preview/dashboard?view=warehouse` dengan state loading/error/denied/unavailable/empty. Navigasi preview terhubung; URL langsung dengan izin tidak cukup menampilkan penolakan.
- Backend dan kontrak Zod strict terhubung. Migration `20260929100000_warehouse_dashboard_permission` diterapkan lokal; hanya menambah katalog izin. Tidak mengubah role/user. Pemulihan menggunakan forward migration; jangan menghapus permission yang sudah dirujuk grant. Akun sesi lokal saat review belum memiliki izin Warehouse dan ditolak dengan benar; pemberian izin dilakukan melalui Setting → Peran oleh admin berwenang.
- Lima pengujian integrasi Warehouse lulus: data gudang aktif dari PostgreSQL, company isolation, union scope, pemilihan gudang, permission denial, input/injeksi scope, serta null/unavailable. Enam pengujian regresi Dashboard/Sales dan sembilan HTTP identity/setting/dashboard lulus (20 total); HTTP mencakup Warehouse 401/403/400/200.
- Typecheck Office/backend, ESLint terarah, build contracts/backend dan produksi Office lulus. Peringatan build yang sudah ada: plugin ESLint Next.js belum terdeteksi. Validator repository lulus. API lokal direstart setelah build dan endpoint baru terverifikasi 401 tanpa sesi, bukan 404.
- Browser desktop 1600px: KPI y206, tinggi127,33px, lebar310px, gap16px; panel utama y353,33 dan panel kanan320px. Kontrol tanggal177,64×38px, Ekspor97,05×38px. Sama dengan patokan Eksekutif; tinggi tabel mengikuti aturan baris Eksekutif dan isi, menggantikan tinggi frame Warehouse lama.
- Browser: filter Picking menyisakan satu baris; pilihan gudang dapat dipakai lewat keyboard; periode terbuka; 360px tidak overflow horizontal halaman. Loading tidak membocorkan fixture, error/unavailable/empty tampil benar; sesi nyata tanpa izin ditolak. Preview dan HTTP berizin diuji terpisah, tidak diklaim sebagai uji browser berizin pada akun pengguna.
- Stack: shadcn Card/Button/Input/Select/Table/Alert/Skeleton dipakai dan diperiksa; TanStack Query melakukan request dengan AbortSignal/cache privat/scope; TanStack Table merender antrean fixture dan state sumber kosong (belum ada transaksi untuk sort/pagination server); Sonner menjelaskan aksi belum tersedia. Tailwind/token bersama, Lucide dan scrollbar global dipakai. Tidak ada grafik pada frame.
- Dokumentasi API, Design, Dashboard dan panduan implementasi disinkronkan. Bukti visual viewport ada di `review/dashboard-warehouse-web.png`.

Batas operasional: belum ada GR/quality, reservasi/picking, pengiriman/POD, ledger/batch/expiry, backorder, kebutuhan minimum, PR/PO, retur/opname, ekspor privat, drill-down sumber, dan realtime. Dashboard tidak menghitung KPI dari jumlah gudang/locator. Periode/tahap dibawa dalam kontrak, tetapi belum menghasilkan angka/transaksi historis. Tidak ada posting stok/keuangan yang dibangun atau diklaim selesai pada tahap ini.
