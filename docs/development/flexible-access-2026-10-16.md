# Arah hak akses fleksibel — 16 Oktober 2026

## Aturan terbaru: dilarang berbagi izin pada induk

Pengguna meminta aturan untuk seluruh modul: setiap submenu operasional memiliki izin sendiri per tindakan; induk hanya mengelompokkan dan Pilih Semua mengubah grant anak individual. Grant induk bersama maupun fallback ke grant induk dilarang. Admin Sistem tetap memiliki hak penuh. Aturan normatif dicatat pada AGENTS.md, register keputusan, IAM-01/04, Setting dan Design.

Cakupan perubahan ini adalah aturan dan kriteria penerimaan. Tidak ada perubahan kode aplikasi, data grant, API atau migration pada langkah pencatatan ini. Pemetaan bersama CRM/Master Data yang dijelaskan di bawah adalah riwayat implementasi sementara, telah digantikan oleh keputusan terbaru dan masih menjadi utang migrasi. Penyelesaian implementasi harus mencakup katalog/grant, backend, UI, audit migrasi dan pengujian bahwa perubahan izin satu submenu tidak memengaruhi submenu lain; tidak cukup mengganti tampilan checkbox. Tidak ada keputusan pengguna yang masih perlu ditanyakan untuk aturan ini.

## Riwayat pemetaan sementara — bukan aturan desain akhir

Koreksi pemetaan submenu CRM (IAM-04): Prospek dan Kontak menampilkan capability CRM baca/buat/ubah yang sudah ditegakkan controller, dengan ID grant yang sama seperti baris induk. Label **Izin bersama CRM** menjelaskan bahwa perubahan satu baris memengaruhi semua pemakai grant tersebut; ini belum pemisahan izin independen per submenu. Pada Prospek, Ubah berlaku untuk perubahan status. Pelanggan pada CRM dan Master Data menampilkan capability `master_data` yang digunakan endpoint pelanggan, dengan label **Izin bersama Master Data**. Tidak membuat capability hapus CRM yang belum memiliki endpoint. Header Ubah/Hapus berlaku lintas jenis resource, tidak selalu draf. Penyimpanan tetap dari katalog unik agar referensi beberapa baris tidak menggandakan grant. Tidak ada perubahan API, grant tersimpan, atau migration.

Koreksi label sel matriks yang disetujui pengguna: checkbox hanya untuk capability katalog yang dapat disimpan. Sel tanpa capability ditulis **Belum tersedia**, termasuk pemetaan izin yang belum lengkap. **Tidak berlaku** hanya dipakai untuk tindakan yang diketahui tidak relevan: mutasi pada Dashboard, audit read-only dan katalog izin. Tidak menyimpulkan seluruh CRUD tidak berlaku hanya karena katalog suatu resource belum lengkap. Tanda strip dihapus dari sel tindakan, cakupan kosong dan legenda. Cakupan perubahan ini UI IAM-04; tidak menambah grant, mengubah API atau memerlukan migration.

## Keputusan pengguna

- Admin Sistem memiliki hak penuh dalam perusahaan sesi untuk mengatur aplikasi dan menjalankan transaksi bisnis.
- Admin Sistem dapat memutus approval tanpa menjadi approver yang ditunjuk dan dapat memutus pengajuannya sendiri.
- Peran biasa bebas dibuat, diubah, dan dihapus. Satu pengguna dapat menerima beberapa peran.
- Layar pengaturan hak peran tidak memakai kelompok atau filter domain. Pengelompokan menurut fitur diperbolehkan.

## Cakupan implementasi

IAM-01/02/04/09/11: kewenangan Admin Sistem pada backend, navigasi Office, matriks hak peran, lifecycle peran, approval PR/exception Sales/permintaan Finance, audit dan pengujian. Kode domain dan kepemilikan aturan bisnis tetap dipakai secara internal untuk menjalankan transaksi; tidak menjadi batas pemberian hak pada peran. Sesi tetap terikat pada perusahaan aktif. Validasi status, versi, bukti, saldo, stok, pajak dan posting tetap berlaku.

Peran `ADMIN_SYSTEM` adalah penanda kewenangan bawaan dan dilindungi dari penghapusan/penonaktifan agar perusahaan tidak kehilangan administrator. Peran biasa yang dihapus dilepas dari anggota, sesi terdampak dicabut, dan perubahan dicatat dalam satu transaksi.

## Penerimaan

Admin Sistem tetap dapat membuka seluruh pengaturan dan tindakan bisnis meski grant perannya kosong; pengguna tanpa peran tersebut tetap mengikuti izin aksi/scope. Admin dapat memutus approval sendiri/tanpa penunjukan, dengan keputusan dan pelaku tercatat. Daftar hak peran tidak menampilkan kelompok domain. Peran biasa dapat dihapus setelah dampak pada anggotanya ditinjau; sesi mereka dicabut. Tidak ada migration yang diperlukan.

## Tambahan keputusan pengguna — penghapusan dari daftar

Admin Sistem meminta tombol Hapus pada daftar Pengguna dan Peran. Pengguna yang belum pernah dipakai dapat dihapus permanen; akun dengan riwayat pemakaian diarsipkan dan disembunyikan dari daftar aktif agar bukti transaksi dan audit tetap utuh. Peran biasa tetap dapat dihapus setelah dampak pada anggota ditinjau. Cakupan Office operasional dan API; Field ditunda. Acuan UI adalah standar desain global web. Penerimaan: aksi tersedia di masing-masing baris, memerlukan konfirmasi, menolak akun sendiri dan Admin Sistem terakhir, mencabut sesi terdampak, mencatat audit, dan menyegarkan daftar setelah berhasil. Penanda arsip membutuhkan migration; keputusan teknis rinci mengikuti invariant identitas lintas perusahaan.

## Koreksi matriks peran

Pengguna meminta hak Admin Sistem tampak tercentang dan baris matriks mengikuti struktur navigasi Office. Checkbox yang mewakili capability backend tersedia untuk Admin Sistem ditampilkan tercentang sebagai hak otomatis, tidak sebagai grant peran tersimpan, dan tetap tidak dapat diedit. Baris diurutkan menurut jalur navigasi (modul, kelompok, layar/fitur) tanpa filter domain tersendiri. Item navigasi yang belum memiliki capability backend tetap terlihat dengan label **Belum dapat diatur** dan tanpa checkbox; izin katalog yang belum memiliki tempat pada navigasi muncul di akhir sebagai **Fitur lain**. Prioritas UI Office; tidak menambah izin backend fiktif atau mengubah hak transaksi. Penerimaan: cek Admin Sistem terlihat penuh untuk capability nyata, peran lain tetap berdasarkan grant tersimpan, dan urutan kelompok menu selaras dengan sidebar.

## Default peran baru — keputusan pengguna

Peran baru biasa dimulai dengan semua capability yang sudah ada dalam katalog izin, pada cakupan perusahaan. Grant tersimpan dibuat bersama peran dalam satu transaksi; Admin Sistem tetap memakai hak bawaan tanpa grant. Peran lama tidak diperluas otomatis. Admin Sistem dapat membuka peran lama satu per satu, memilih semua capability sebagai draf, meninjau dampak pada anggota, lalu menyimpan; sesi anggota dicabut dan perubahan diaudit. Capability yang belum tersedia di backend tidak diberi checkbox/grant. Capability yang ditambahkan ke katalog di kemudian hari tidak otomatis ditambahkan ke peran biasa yang sudah ada. Cakupan Office operasional dan backend IAM; Field ditunda. Penerimaan: peran baru langsung menampilkan checkbox katalog tercentang setelah dibuat, peran lama tetap sesuai grant sampai disimpan, dan penolakan/otorisasi tetap ditegakkan server.

## Koreksi izin per menu operasional — keputusan terbaru

Pengguna meminta Admin Sistem dapat mencentang seluruh menu yang sudah operasional. Semua menu tetap tampil dalam matriks; menu tanpa layar/API operasional diberi label **Belum dapat diatur** dan tidak mempunyai grant semu. Tujuh tampilan Dashboard yang sudah operasional kini masing-masing memiliki izin baca `dashboard_<view>.read`; backend memeriksa izin tampilan sebelum membaca data, lalu tetap menerapkan izin dan scope sumber. Admin Sistem memiliki akses bawaan penuh. Peran baru menerima izin tersebut melalui katalog saat dibuat. Peran lama dapat diatur oleh Admin Sistem.

Pengguna selanjutnya secara eksplisit meminta semua grant peran biasa lama pada perusahaan development yang sedang dipakai dikosongkan. Audit lokal menemukan Sales Rep sudah 0 grant; dua peran development (`DEV_SALES_ORDER` 6 grant dan `DEV_REVIEW_READ` 11 grant) dihapus grantnya secara atomik, dengan audit per peran dan pencabutan satu sesi anggota. Peran `ADMIN_SYSTEM` tidak diubah. Ini perubahan data lokal, bukan migrasi yang menghapus grant pada database lain. Menu operasional yang masih berbagi izin sumber memerlukan pemisahan izin per menu di tahap lanjutan; jangan mengklaim seluruh matriks telah independen.

Operasi lokal tersebut awalnya tercatat dengan `actor_id` pengguna aplikasi meski dijalankan agent. Atribusi dua event dikoreksi menjadi pelaksana sistem (`actor_id` kosong), dan koreksinya sendiri dicatat sebagai event `audit.attribution_corrected` agar jejak perubahan tetap dapat ditelusuri.

Koreksi sesi Admin Sistem: saat peran biasa dihapus, dinonaktifkan, atau grantnya diubah, sesi anggota biasa yang haknya berubah dicabut. Sesi anggota yang masih memegang `ADMIN_SYSTEM` aktif dipertahankan karena otorisasinya tetap penuh dan principal dibaca ulang dari database pada setiap request. Jejak audit tetap mencatat perubahan peran dan jumlah sesi yang dicabut.

## Pelaksanaan migrasi izin submenu

IAM-01/04: migrasikan grant induk CRM dan Master Data ke capability anak sesuai aksi lama dan scope yang sama, tanpa memberi tindakan baru. Grant kosong tetap kosong. Hapus capability induk yang diganti, simpan audit pemetaan dan cabut sesi anggota biasa terdampak; Admin Sistem aktif tetap memiliki sesi dan hak bawaan. Pisahkan akses Pelanggan CRM (proyeksi CRM) dari Master Pelanggan. Backend resource dinamis wajib memakai allowlist dan memeriksa data terkait. Matriks mengikuti navigasi, induk tanpa grant tersimpan, dengan pemilihan anak individual. Acuan visual tetap standar global web. Penerimaan: penolakan lintas submenu melalui API langsung, persistence/audit migrasi dan tampilan matriks operasional.

## Hasil migrasi dan verifikasi — 16 Oktober 2026

- Migration `20261016210000_independent_submenu_permissions` telah diterapkan pada database development lokal `127.0.0.1:5432`. Verifikasi read-only menemukan 0 capability induk CRM/Master Data/fulfillment.read tersisa, 68 capability anak CRM/Master/outbound, dan 11 event audit migrasi peran. Peran kosong tidak mendapat grant baru.
- Cakupan tambahan audit meliputi izin baca Proforma, Backorder Sales, Backorder Warehouse serta empat tahap barang keluar. Kode command yang sudah granular tetap dipertahankan dan diletakkan pada baris pemiliknya. Pelanggan CRM kini memakai route CRM tersendiri dengan proyeksi terbatas; Master Pelanggan tetap terpisah.
- 44 pengujian terarah lulus: navigasi 7, matriks 8, HTTP isolasi submenu 8, migrasi SQL 1, CRM dengan login nyata 1, Dashboard 2, Dashboard Sales 7, workspace IAM 10. Uji CRM membuktikan pencabutan baca Kontak menolak API Kontak dan menghilangkan kontak dari detail Prospek tanpa mencabut akses Prospek. Uji migrasi berjalan dalam transaksi rollback dan membuktikan scope, audit, peran kosong serta sesi Admin Sistem.
- Typecheck Office, API dan backend serta build backend lulus. API development telah dimuat ulang; endpoint outbound baru memberi 401 tanpa sesi, bukan 404. Pemeriksaan katalog dapat diulang dengan `tools/verify-submenu-migration.ts` melalui environment development.
- Tampilan matriks telah diubah pada route operasional, memakai TanStack Table dan Query serta komponen Checkbox bersama. QA visual/ukuran DOM dengan sesi nyata belum dapat dilakukan: browser masih berada pada login `session=ended`; permintaan login sudah dikirim ke pengguna. Tidak ada screenshot matriks atau klaim lulus QA visual pada tahap ini. Endpoint CRUD yang belum dibangun tetap ditandai belum tersedia.

## QA lanjutan dengan sesi nyata — 16 Oktober 2026

Pengguna telah login sebagai Admin Sistem. Route operasional matriks Sales Rep dan Admin System diperiksa dengan sesi tersebut; tidak ada grant uji yang disimpan.

- Checkbox Prospek Lihat menghasilkan tepat 1 perubahan; Kontak dan Master Pelanggan tetap tidak tercentang. Induk CRM menunjukkan mixed/indeterminate.
- Pilih semua CRM menghasilkan 11 perubahan izin anak; Master Pelanggan tetap tidak tercentang. Batalkan perubahan mengembalikan jumlah perubahan menjadi 0.
- Pencarian Kontak menampilkan 1 menu sesuai filter beserta induknya (3 baris). Expand/collapse berfungsi.
- Admin System: seluruh 284 checkbox yang dirender setelah Buka semua menu tercentang. Hak bawaan ditampilkan disabled dengan penjelasan eksplisit; pengaturan peran biasa tetap editable oleh Admin Sistem.
- Pengukuran DOM pada viewport CSS 967 × 1412: tombol Buka semua menu tinggi 35,98 px, font 12 px; pencarian tinggi 35,98 px. Tabel memiliki container overflow-x auto dengan lebar 617 px dan isi 1252 px. Warna teks kontrol rgb(28,38,35).
- Bukti: access-matrix-admin-2026-10-16.png. Browser menghasilkan skala screenshot yang tidak konsisten dengan ukuran viewport (devicePixelRatio 0,33); percobaan override viewport telah direset. Karena itu QA visual lintas viewport/presisi screenshot belum dinyatakan lulus penuh. Pemeriksaan interaksi dan DOM di atas telah terverifikasi.
- Ini menutup blocker login pada catatan sebelumnya. CRUD yang belum memiliki capability/backend tetap berlabel Belum tersedia.
