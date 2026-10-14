# Dashboard HRIS — cakupan pembangunan

Status 7 Oktober 2026: acuan artefak desain pada catatan historis ini telah dicabut. Pemetaan frame dan perbandingan lama hanya bukti pekerjaan terdahulu, bukan perintah untuk implementasi berikutnya. Panduan aktif: [implementasi web](web-implementation-guide.md) dan [standar global](web-design-standard.md).

Pengguna menyetujui Dashboard HRIS dan backend sumber tersedia, memakai evflow-erp-builder. Frame `Mz5Ga` (1600×1060) diperiksa struktur/render 29 September 2026. Ukuran/spacing mengikuti Ringkasan Eksekutif; web Office saja.

| Permukaan | Requirement | Batas implementasi |
|---|---|---|
| Karyawan aktif, kontrak, koreksi absensi, onboarding | HR-01/02/08, DSH-01–03 | Sumber belum ada, null/unavailable; akun ERP bukan headcount |
| Tindak lanjut kontrak/absensi/onboarding/payroll | HR-01–03/08, APP-03/04 | Fixture hanya preview; tidak menampilkan nama/dokumen pribadi nyata |
| Status proses SDM | HR-02/03/08 | Rekap, cut-off, payroll, cuti, aset unavailable; tidak menganggap Draft/Belum dikunci tanpa sumber |
| Periode, filter, refresh, ekspor | DSH-02/03 | Query strict dan refresh; ekspor/detail belum tersedia |
| Privasi | HR-08, DSH-03, OPS-SYS-02 | hr.read hanya dashboard status; tanpa nominal, rekening, dokumen pribadi; suppression kelompok kecil wajib sebelum sumber agregat nyata diaktifkan |

Endpoint `/dashboard/hris` memeriksa hr.read company/privileged sesuai company sesi; scope sempit ditolak. Migration hanya mendaftarkan permission tanpa assignment. Tidak ada payroll/absensi/kontrak baru atau perubahan data karyawan. Preview “Berakhir dalam 30 hari” berasal mockup, bukan threshold bisnis backend. Pengujian: permission, input, tidak ada angka/status palsu atau field privat, HTTP, browser desktop/360px dan keyboard. Tujuan visual disetujui; sumber transaksi dan realtime tetap tahap berikutnya.

## Hasil dan validasi

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): - Route sesi `/?view=hris`, preview `/preview/dashboard?view=hris` dengan state loading/error/denied/unavailable/empty. Sidebar preview menuju HRIS. Empat KPI, tabel, status proses dan catatan privasi mengikuti mockup; class ukuran Executive dipakai bersama.
- Endpoint read-only dan kontrak strict tersedia. Semua sumber SDM masih unavailable; tidak membaca data karyawan dari database karena entitasnya belum ada. Privacy threshold OPS-SYS-02 serta field/scope authorization rinci belum diaktifkan pada data nyata; wajib sebelum integrasi sumber. Preview berlabel simulasi dan tidak menguji suppression nyata.
- Migration `20260929120000_hris_dashboard_permission` diterapkan lokal, hanya katalog izin. Tidak memberi akses otomatis ke admin/peran/pengguna; recovery memakai forward migration dan tidak menghapus permission yang dirujuk grant. Tidak ada perubahan saldo, payroll atau status pegawai.
- 29 pengujian unik: lima unit HRIS (scope/permission/query/null dan penolakan field privat), empat unit Finance, sembilan HTTP identity/setting/dashboard termasuk HRIS 401/403/400/200, sebelas integrasi regresi Dashboard/Sales/Warehouse. Satu ekspektasi kapitalisasi pesan test diperbaiki lalu seluruh lima test HRIS lulus; 24 test lain sudah lulus. Tidak mengklaim pengujian persistence atau kalkulasi payroll.
- Typecheck Office/backend, ESLint terarah, build contracts/backend/Office dan validator repository lulus. Build Office tetap memiliki peringatan lama plugin ESLint Next.js belum terdeteksi. API lokal direstart setelah build; endpoint baru terverifikasi 401 tanpa sesi, bukan 404.
- Browser 1600×1060: empat KPI 310×127,33px di y206, panel kanan320px. Filter Payroll dengan keyboard menyisakan satu baris preview; periode dapat dibuka. Lebar360px tanpa overflow halaman; tabel bergulir internal. Loading tidak menampilkan fixture, unavailable tidak mengklaim Draf, error dan empty benar. Sesi nyata tanpa hr.read ditolak; uji berizin dilakukan HTTP terpisah, bukan akun pengguna.
- Stack dipakai: shadcn Card/Button/Input/Select/Table/Alert/Skeleton; TanStack Query dengan AbortSignal dan key company/user/permission/filter; TanStack Table untuk fixture/state kosong; Sonner untuk aksi belum tersedia; Tailwind/token/Lucide dan scrollbar global. Tidak ada grafik. Server sort/pagination transaksi belum berlaku karena sumber antrean belum ada.
- Dokumentasi API, Design, Dashboard dan panduan implementasi tersinkronisasi. Bukti visual viewport: review/dashboard-hris-web.png.

Batas: master/kontrak karyawan, absensi/cuti, onboarding/offboarding, aset, payroll/cut-off/slip, agregat nyata dengan suppression, ekspor privat, drill-down sumber, dan realtime belum dibangun. HRIS tahap dashboard ini belum merupakan modul SDM/payroll operasional.
