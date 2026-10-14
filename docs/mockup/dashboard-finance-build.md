# Dashboard Finance — cakupan pembangunan

Status 7 Oktober 2026: acuan artefak desain pada catatan historis ini telah dicabut. Pemetaan frame dan perbandingan lama hanya bukti pekerjaan terdahulu, bukan perintah untuk implementasi berikutnya. Panduan aktif: [implementasi web](web-implementation-guide.md) dan [standar global](web-design-standard.md).

Pengguna menyetujui Dashboard Finance beserta backend sumber tersedia dengan skill evflow-erp-builder. Acuan frame Pencil `m7RvC` (1600×1060), struktur dan render diperiksa 29 September 2026. Ukuran/spacing/kontrol/scrollbar mengikuti standar Ringkasan Eksekutif. Web Office saja; mobile ditunda.

| Permukaan | Requirement | Pelaksanaan dan batas |
|---|---|---|
| Piutang terbuka, utang terbuka | DSH-01–03, FIN-02 | AR/AP posted belum ada; null/unavailable |
| Penerimaan tagihan, pembayaran | FIN-03, DSH-02 | Tidak menyamakan penerimaan dialokasikan dengan uang muka atau nilai SO; sumber belum tersedia |
| Antrean finance dan filter proses | APP-03/04, FIN-02/03/07 | Fixture hanya preview; belum ada invoice/matching/alokasi/closing untuk daftar nyata |
| Kesiapan closing | FIN-07 | Periode dipilih ditampilkan; status periode, langkah, rekonsiliasi bank/persediaan unavailable, bukan otomatis Terbuka |
| Tanggal, refresh, ekspor, drill-down | DSH-03, FIN-06 | Periode dan refresh API; ekspor/detail sumber belum tersedia, feedback eksplisit |
| Akses backend | IAM, DSH-01 | finance.read company/privileged harus cocok company sesi; admin/jabatan tidak otomatis mendapat hak |

Backend read-only `/dashboard/finance`, kontrak strict, metadata scope/periode/versi/as-of. Tidak mengambil nilai finansial dari master/pricelist/prospek. Tidak membangun ledger/pembayaran/closing pada tahap ini. Migration hanya mendaftarkan permission tanpa assignment; tidak ada mutasi saldo atau posting. Kriteria: layout acuan, responsif, keyboard, loading/error/denied/unavailable/empty, pengujian izin/filter/HTTP dan tidak adanya angka palsu. Belum ada keputusan material yang perlu ditanyakan ulang.

## Hasil dan bukti

- Route sesi `/?view=finance`, preview `/preview/dashboard?view=finance`; navigasi Finance preview aktif. Fixture nominal berupa string, tanpa perhitungan floating point. Loading/error/unavailable/empty/denied tidak memakai angka fixture.
- Endpoint `/dashboard/finance` dan kontrak Zod berfungsi. Backend memvalidasi scope/company/query; tidak membaca saldo dari database karena entitas transaksinya belum ada. Metadata dan status sumber bukan laporan keuangan. Company/privileged saja; scope sempit ditolak sampai kontrak field/sumber tersedia.
- Migration `20260929110000_finance_dashboard_permission` diterapkan lokal, hanya mendaftarkan izin. Tidak ada perubahan role/user. Pemulihan memakai forward migration; jangan menghapus permission yang telah dirujuk. Sesi pengguna saat review belum memiliki finance.read dan UI nyata menolak akses dengan benar.
- 24 pengujian unik lulus: empat unit Finance (permission, scope, query, null/unavailable), sembilan HTTP identity/setting/dashboard termasuk Finance 401/403/400/200, serta sebelas integrasi regresi Dashboard/Sales/Warehouse. Finance tidak diklaim mempunyai uji persistence saldo; yang tersedia adalah auth persistence pada HTTP dan kontrak layanan.
- Typecheck Office/backend, ESLint terarah, build contracts/backend dan produksi Office lulus. Test Finance dipindah ke tests/unit agar tidak masuk kompilasi produksi. Validator repository lulus. Peringatan build lama: plugin ESLint Next.js belum terdeteksi. API lokal direstart setelah build, endpoint terverifikasi 401 tanpa sesi (bukan 404).
- Browser 1600×1060: empat KPI 310×127,33px pada y206; panel kanan320px; tombol periode177,64×38px dan Ekspor97,05×38px. Ukuran acuan Eksekutif terjaga. Pada360px satu kolom tanpa overflow halaman; tabel bergulir internal.
- Filter Closing melalui keyboard menyisakan satu baris preview; kontrol periode terbuka. Loading tanpa nominal, error dan empty jelas, unavailable tanpa status Terbuka. Sesi nyata tanpa izin ditolak. Uji berizin dilakukan HTTP; tidak mengklaim akun pengguna mempunyai akses yang belum diberikan.
- Stack: shadcn Card/Button/Input/Select/Table/Skeleton/Alert dipakai; TanStack Query dengan AbortSignal dan query key company/user/permissions/filter; TanStack Table merender preview/empty (daftar transaksi server belum tersedia); Sonner untuk feedback aksi belum tersedia. Tailwind/token bersama dan Lucide dipakai. Grafik tidak berlaku untuk frame ini. Bukti viewport: review/dashboard-finance-web.png.
- Dokumen API, Design, domain Dashboard dan panduan web disinkronkan.

Batas tahap: ledger/AR/AP, penerimaan dan alokasi, pembayaran, pencocokan tagihan, periode/checklist/rekonsiliasi closing, ekspor privat, drill-down sumber, dan realtime belum dibangun. Tidak ada mutasi atau posting finansial. Dashboard Finance ini belum merupakan modul akuntansi operasional atau laporan keuangan resmi.
