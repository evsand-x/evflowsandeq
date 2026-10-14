# Modernisasi Dashboard — 7 Oktober 2026

## Arah disetujui

Pengguna meminta mulai dari Dashboard, membebaskan biru/Inter, dan menyetujui rekomendasi tema terang, netral-charcoal, emerald, Plus Jakarta Sans. Implementasi pada route operasional `/` dan shell Dashboard; modul transaksi lain belum didesain ulang.

## Cakupan dan penerimaan

DSH-01/02, APP-03, NFR-05, IAM-01/04: hierarki visual baru, ringkasan empat KPI terpisah, pekerjaan/tugas lebih dahulu, grafik dan transaksi sebagai pendukung. Sidebar accordion dan profil ringkas dipertahankan. Akses cepat hanya ke route nyata sesuai izin. `/dashboard/summary`, Query keys, loading/error dan freshness tidak berubah. Tidak ada schema/API/migrasi/perhitungan saldo baru. Nilai yang belum tersedia tidak diganti nol/grafik buatan. Tema berlaku juga untuk portal menu akun/drawer selama Dashboard aktif, terlepas saat pindah ke modul lain.

Verifikasi: typecheck, lint, repository validator, desktop/mobile, menu akun dan keyboard, tautan akses cepat serta isolasi tema ketika pindah route. Tidak ada keputusan material tertunda. Sumber KPI eksekutif, grafik dan riwayat belum terhubung di implementasi awal.


## Verifikasi

Typecheck Office, ESLint file terkait dan validator repository lulus. Runtime memakai Plus Jakarta Sans dan token emerald; popup akun juga mengikuti font baru. Buka tugas saya membuka `/?view=actions`. Akses cepat SO membuka `/operations/orders`; pada route transaksi font kembali Inter dan warna biru. Hanya tautan SO dan pelanggan terlihat untuk principal uji sesuai izin yang tersedia.

Pada viewport CSS 480px (batas alat pada zoom browser pengguna), KPI satu kolom, lebar dokumen 460px tanpa overflow halaman, drawer dapat dibuka/ditutup. Desktop menunjukkan empat KPI, profil ringkas, prioritas tugas dan analisis. Screenshot output dashboard-modern.jpg dipotong untuk menghapus area kosong tambahan alat. Backend dan formula tidak diubah; akun kedua/failure injection belum diuji. KPI, grafik dan riwayat eksekutif tetap belum memiliki sumber.

Stack: Next/React, token bersama, shadcn Card/Button/Alert/Sidebar/Select, TanStack Query/Table digunakan. Tanpa migrasi. Redesign komposisi difokuskan Ringkasan Eksekutif; tema berlaku di tujuh tampilan Dashboard, layout rinci dashboard domain tetap mengikuti implementasi sebelumnya.
