# Pengguna dan matriks peran — 7 Oktober 2026

Arah disetujui pengguna: satu pengguna dapat memiliki beberapa peran yang ditetapkan administrator. Izin diatur pada Peran → Matriks Hak Akses. Hanya pengguna dengan peran aktif Admin Sistem (`ADMIN_SYSTEM`) pada perusahaan sesi dapat mengakses pengaturan Pengguna/Peran/Matriks dan mengubah checkbox. Menu tersebut disembunyikan untuk nonadministrator; URL langsung dan API juga ditolak. Permission aksi dan scope tetap diperiksa, bukan bypass seluruh izin oleh nama peran. Pengaturan bisnis lain tetap mengikuti izin domainnya.

Cakupan IAM-01/04/11 dan NFR-03: gate server, navigasi, halaman, penjelasan alur multi-peran, pengujian penolakan. Tidak mengganti peran yang telah dimiliki pengguna, tidak memberikan permission baru secara otomatis, tidak membuat preview, dan tidak mengubah saldo atau transaksi. Kriteria: nonadmin dengan permission IAM sekalipun tetap ditolak; administrator tetap memerlukan permission aksi; akses operasional tetap gabungan izin peran aktif. Perubahan matriks/penugasan tetap diaudit dan mencabut sesi terkait melalui mekanisme existing. Tidak diperlukan migration.

## Hasil verifikasi

Guard Admin Sistem terpasang setelah autentikasi dan sebelum permission guard di seluruh AccessController. Frontend menggunakan predicate yang sama pada pemeriksaan permission IAM, penyaringan submenu dan SettingShell; nonadministrator tidak me-mount view pengguna/peran/matriks. Penjelasan halaman membedakan penugasan peran kepada pengguna dengan pengaturan izin peran.

15 pengujian terarah lulus: 8 HTTP boundary pada controller Nest (autentikasi/service di-stub, guard administrator dan permission nyata), 6 navigasi dan 1 gabungan izin multi-peran. Mencakup nonadmin dengan permission IAM, mutasi nonadmin, nama tampilan Admin Sistem tanpa kode role, multi-role administrator, permission kosong dan scope perusahaan lain. Pengujian ini tidak memutasi database dan tidak membuktikan seluruh lifecycle IAM/concurrency. TypeScript backend/Office/API, ESLint file terkait dan validator repository lulus. Browser dev akun Novian mengakses Pengguna/Peran dengan teks penjelasan baru. Tidak mengubah grant/assignment akun dalam verifikasi.

Dokumen requirement, domain Setting, API, flow, design, features dan register keputusan diselaraskan. Tidak ada migration. Bentuk visual lama halaman Setting belum direkonstruksi pada pekerjaan aturan akses ini.
