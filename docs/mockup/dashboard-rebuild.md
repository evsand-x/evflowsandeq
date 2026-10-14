# Pembangunan ulang Dashboard web

Status 7 Oktober 2026: acuan artefak desain pada catatan historis ini telah dicabut. Pemetaan frame dan perbandingan lama hanya bukti pekerjaan terdahulu, bukan perintah untuk implementasi berikutnya. Panduan aktif: [implementasi web](web-implementation-guide.md) dan [standar global](web-design-standard.md).

29 September 2026: pengguna meminta mulai pembangunan ulang Dashboard dan menunda mobile. Izin coding berlaku untuk tahap ini, menggantikan penundaan coding sebelumnya. Arah tetap visual dahulu, satu layar representatif untuk review sebelum perluasan.

## Cakupan tahap pertama

Frame `glsR9` — Ringkasan Eksekutif, 1600 × 1320: shell/sidebar/topbar, judul/periode/freshness, empat KPI, grafik aktual-target, dua kartu perhatian, tindak lanjut, riwayat transaksi. Route `/` mempertahankan sesi dan Query; `/preview/dashboard` memakai data simulasi untuk review. Requirement: DSH-01–03, APP-03/04, NFR-05/11; domain 09; flow 06 bagian 0.2; kontrak data tetap di backend.

Prioritas: cocokkan geometri sumber pada desktop, hilangkan lebar paksa preview, gunakan token semantik, pertahankan TanStack Table, berikan interaksi filter dan feedback eksplisit untuk sumber/aksi yang belum tersedia. Jangan mengubah uang atau data bisnis melalui simulasi. Tidak ada migrasi, perubahan API, atau pekerjaan Field yang direncanakan.

## Batas cakupan dan kriteria review

- Selesai tahap ini berarti layar Ringkasan Eksekutif siap review visual, bukan seluruh modul Dashboard operasional.
- Frame `aFJWP`, `q1OcsT`, `m7RvC`, `Mz5Ga`, `ilzbU`, `kSyPd` (Sales, Warehouse, Finance, HRIS, Tugas, Laporan) masih tahap berikut setelah review layar awal. Menu tidak boleh diklaim sebagai layar selesai.
- Bandingkan geometri desktop dengan sumber; uji 360 px dan desktop, collapse/menu, filter riwayat, keyboard, feedback aksi, loading/error dan sesi tanpa izin bila lingkungan memungkinkan.
- Data live yang belum tersedia tidak diganti angka simulasi. Export dan drill-down tanpa endpoint tetap menjelaskan keterbatasan. Tidak ada klaim posting/persistence/audit bisnis baru.

## Hasil implementasi dan validasi

Ringkasan Eksekutif siap untuk review visual pertama. Shell, sidebar, topbar, KPI, grafik, kartu perhatian, tindak lanjut, dan riwayat mengikuti frame sumber. Filter modul riwayat bekerja pada fixture; sidebar dapat diciutkan, dan navigasi web pada layar sempit memakai drawer. Ditambahkan focus ring, skip navigation, rincian grafik yang dapat dibaca, skeleton loading, dan alert error dengan retry.

Stack: komponen shadcn Sidebar/Select/Skeleton dipakai; TanStack Table merender dan memfilter riwayat; Sonner memberi feedback keterbatasan aksi. TanStack Query dan sesi pada route utama dipertahankan, tetapi integrasi dengan akun berizin/ditolak belum diverifikasi pada tahap ini. Token semantik lokal digunakan; tidak ada perubahan API, database, migrasi, atau aplikasi mobile.

Validasi 29 September 2026:

- Typecheck Office dan ESLint pada file TSX yang diubah lulus.
- Validator repository lulus.
- Browser pada 1600 × 1320 tidak memiliki overflow halaman. Lebar konten 1288 px; posisi KPI y206 sesuai sumber. Pembulatan border/layout menghasilkan selisih sekitar 1–3 px pada bagian berikutnya; belum dinyatakan identik piksel.
- Web pada 360 × 800 tidak memiliki overflow horizontal halaman. Drawer dapat dibuka dengan keyboard dan ditutup dengan Escape; collapse/expand sidebar desktop berhasil.
- Filter Finance menampilkan dua transaksi dan pilihan Semua modul mengembalikan empat transaksi.
- `?state=loading` menampilkan empat skeleton tanpa nilai KPI simulasi; `?state=error` menampilkan alert dan retry kembali ke preview; `?state=unavailable` menampilkan status belum tersedia.
- Tidak ada console error teramati selama pemeriksaan. Production build dan pengujian otorisasi/backend belum dilakukan.

Preview: `http://localhost:3000/preview/dashboard`. Bukti `review/dashboard-executive-web.png` adalah cuplikan bagian layar yang terlihat, bukan screenshot seluruh frame: browser menangkap area lebih kecil daripada viewport emulasi, sedangkan mode full-page menghasilkan stitching yang tidak andal. Gunakan preview langsung untuk meninjau seluruh layar. Persetujuan visual pengguna masih menunggu.

## Pekerjaan yang masih ditunda

## Menu akun dan Keluar — persetujuan lanjutan pengguna

Pengguna menyetujui penempatan Keluar di menu profil kiri bawah, termasuk akses melalui avatar ketika sidebar diciutkan. Menu memakai DropdownMenu shadcn dengan pemisah; item normal mengikuti teks menu dan focus/hover memakai warna destructive berlatar lembut. Tidak ada konfirmasi rutin. Dashboard tidak memiliki formulir belum tersimpan; integrasi peringatan perubahan belum tersimpan wajib ditambahkan bersama layar formulir, belum diuji pada tahap ini.

Implementasi menghubungkan menu ke SessionProvider yang sudah ada: POST `/auth/logout`, pembatalan query dan penghapusan cache privat, broadcast logout, lalu navigasi login. Tombol mencegah pengiriman ganda selama request dan menampilkan status Keluar; kegagalan ditampilkan sebagai alert. Preview hanya menjelaskan simulasi, tidak mencabut sesi nyata. Requirement APP-04/NFR-10; kontrak API tetap, tanpa migrasi.

Typecheck lulus. Browser membuktikan menu terbuka pada sidebar normal dan diciutkan melalui keyboard, serta aksi preview menampilkan keterangan simulasi. Logout server dengan akun nyata dan kondisi gagal jaringan belum diuji end-to-end; tidak diklaim sebagai bukti revoke sesi.

## Cakupan lanjutan

Revisi kontrol sidebar atas permintaan pengguna: chevron kiri untuk collapse, chevron kanan untuk expand, label aksesibilitas tetap. Scrollbar navigasi memakai lebar tipis, track transparan, dan thumb dengan warna muted lembut yang menguat saat hover/focus. Perubahan hanya pada web sidebar, tanpa perubahan kontrak bisnis.

Revisi menu akun yang disetujui pengguna: bagian atas popup hanya avatar berinisial tanpa nama; label aksesibilitas dan tooltip “Buka profil saya”. Menu Keluar tetap di bawah separator. Halaman Profil Saya belum tersedia; sementara klik avatar menampilkan keterangan tersebut, bukan navigasi ke route yang belum ada. Nama pada pemicu profil sidebar tetap ditampilkan ketika sidebar diperluas.

Enam layar Dashboard lainnya belum dibangun ulang. Data preview tetap berlabel simulasi. Perubahan periode, ekspor, drill-down, dan operasi bisnis belum dihubungkan sebagai fungsi operasional; feedback menyatakan keterbatasannya. Rincian numerik grafik hanya memuat September karena nilai bulan lainnya tidak tersedia sebagai angka pada sumber. Pengujian backend, izin, persistence, dan audit wajib dilakukan pada tahap integrasi.
