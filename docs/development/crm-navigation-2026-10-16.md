# Navigasi CRM — 16 Oktober 2026

Keputusan pengguna: hapus submenu Pelanggan CRM karena Master Data Pelanggan menjadi layar utama; URL lama diarahkan ke Master Pelanggan. Peluang tampil sejajar dengan Prospek dan Kontak. Cakupan CRM-01/05, MD-01, IAM-04, APP-03: sidebar, daftar peluang operasional dengan pencarian/pagination server dan izin crm_opportunity.read, matriks, breadcrumb dan tautan ke master sesuai izin. Proses buat/hasil peluang yang ada tetap melalui prospek. Izin crm_customer tetap diperlukan untuk proyeksi/registrasi institusi dalam proses CRM; ditampilkan sebagai tindakan pendukung Prospek, tanpa menu Pelanggan kedua dan tanpa memperluas grant master. Tidak mengubah data, grant, schema maupun transaksi. Acuan desain standar global web; tidak ada keputusan terbuka.

## Hasil

Sidebar operasional kini CRM > Prospek, Peluang, Kontak; Pelanggan hanya di Master Data. Daftar Peluang memakai TanStack Query/Table, endpoint berizin terpisah, pencarian dan pagination server. Matriks menempatkan Peluang sejajar Prospek; capability pendukung institusi tetap dapat dikelola di bawah Prospek tanpa memperluas grant Master.

QA dengan sesi Admin Sistem: 5 peluang development termuat; pencarian DEV-OPP-000003 menghasilkan 1 baris. URL /crm/customers/16a42a39-e382-4a74-88f8-9737f7fab157 mengarah ke detail Master Pelanggan yang sama. Sidebar hanya menampilkan tiga submenu CRM. Input pencarian sekitar 36 px; tidak ada overflow halaman pada viewport saat pengukuran. Screenshot crm-opportunities-2026-10-16.png memakai browser yang skala tangkapannya tidak konsisten, sehingga bukan bukti presisi ukuran lintas viewport. Tidak mengubah data pelanggan/transaksi.

25 tes lulus (navigasi 7, matriks 9, HTTP permission 9), termasuk penolakan akses Peluang dengan izin Prospek atau scope perusahaan lain serta pagination/company filter. Build backend, typecheck Office dan ESLint terarah lulus. API development dimuat ulang dan route baru terbukti mengembalikan data. Tidak ada migrasi database. Alur create/hasil peluang tetap di sumber Prospek; tidak mengklaim seluruh fitur pipeline/stage selesai.
