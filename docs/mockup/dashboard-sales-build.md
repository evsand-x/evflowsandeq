# Dashboard Sales — cakupan yang disetujui

Status 7 Oktober 2026: acuan artefak desain pada catatan historis ini telah dicabut. Pemetaan frame dan perbandingan lama hanya bukti pekerjaan terdahulu, bukan perintah untuk implementasi berikutnya. Panduan aktif: [implementasi web](web-implementation-guide.md) dan [standar global](web-design-standard.md).

Pengguna menyetujui Dashboard Sales berikut backend dengan sumber yang sudah tersedia; transaksi sumber yang belum dibangun tidak diperluas pada tahap ini. Acuan frame Pencil `aFJWP` dan standar desain global web. Mobile ditunda.

## Pemetaan cakupan

| Permukaan | Requirement | Sumber dan pelaksanaan |
|---|---|---|
| Shell, heading, periode, freshness | DSH-01–03, APP-03/04 | Komponen global; periode bulan WITA; query privat per user/company/izin/filter |
| Penjualan net, A/T, kunjungan berhasil, pelanggan baru | TGT-06/07/10/12 | Invoice, target dan kunjungan belum tersedia: API mengirim unavailable/null; preview terpisah memakai fixture mockup |
| Tindak lanjut | CRM-06/14, DSH-02 | Jadwal prospek aktif dari database, hanya company aktif dan owner pengguna login; bukan seluruh task Sales |
| Filter/sort/pagination/rincian | APP-03/04, DSH-03 | Backend memfilter bulan/status waktu; urutan jadwal stabil dan cursor; rincian read-only dari data yang diizinkan |
| Target, estimasi, aktual, E/T, A/T | EST-03, TGT-12 | Sumber belum tersedia; tidak dihitung dari prospek atau angka contoh |
| Ekspor, buka modul, A/T detail | DSH-02 | Layar/job belum tersedia: feedback eksplisit; tidak membuat tautan rusak atau ekspor tanpa izin |

Tidak ada mutasi bisnis, posting, migrasi atau audit transaksi baru. API baru `/dashboard/sales` bersifat read-only; `crm.read` dengan company/privileged scope yang valid mengikuti izin yang sudah diimplementasikan. Scope sempit lain ditolak, bukan diperluas. API lama `/dashboard/summary` tetap kompatibel.

Kriteria penerimaan: UI mengikuti frame (empat KPI, tabel kiri, panel target kanan, info estimasi); data nyata terpisah dari preview; tidak ada nol palsu; permission denied/empty/loading/error jelas; pengujian isolasi perusahaan/pemilik, batas bulan WITA, status, pagination dan validasi input. Backend tidak mengklaim tersedianya sumber transaksi yang belum ada. Realtime belum tersedia; refresh manual/focus memakai pembacaan live.

## Implementasi dan bukti

Status akhir: build produksi Office, typecheck Office/backend, ESLint file yang diubah, dan validator repository lulus. Build memberi peringatan konfigurasi plugin ESLint Next.js belum terdeteksi; build tetap sukses. Bukti visual `review/dashboard-sales-web.png` adalah cuplikan viewport responsif, bukan seluruh frame (capture full-page browser menghasilkan stitching yang tidak andal). Review lengkap melalui preview langsung.

- Route sesi nyata `/?view=sales`; preview `/preview/dashboard?view=sales`. Halaman memakai shell yang sama dengan Ringkasan Eksekutif. Menu Sales pada preview kini dapat dibuka.
- Komponen shadcn Card, Button, Input, Select, Table, Skeleton dan Alert dipakai; TanStack Query mengirim AbortSignal dan mengisolasi cache per user/company/izin/filter/cursor; TanStack Table memakai sort/filter/pagination server. Sonner menjelaskan aksi yang belum tersedia. Tidak ada grafik pada frame Sales ini.
- Backend `/dashboard/sales` membaca PostgreSQL dalam transaksi RepeatableRead. Bukan tabel statis atau fixture. Jadwal dan ID menjadi sort stabil; total seluruh filter tidak berubah antarhalaman. Metrik belum tersedia dikirim null dengan alasan dan satuan. Data uang contoh tetap string tanpa perhitungan float.
- Rincian baris dapat dibuka melalui keyboard. Rincian merupakan field read-only dari response yang diizinkan, bukan halaman transaksi sumber penuh. Tombol Ekspor, Buka Sales, dan A/T memberi feedback belum tersedia.
- Enam pengujian integrasi Dashboard/database lulus, termasuk empat pengujian Sales: batas bulan WITA, isolasi company/owner, status Ditunda/Tidak Dilanjutkan, jadwal kosong, sort, pagination timestamp sama, filter, periode kosong, izin dan input/cursor tidak valid.
- Sembilan pengujian HTTP identity/setting/dashboard lulus; ditambahkan bukti `/dashboard/sales` mengembalikan 401 tanpa sesi, 403 tanpa izin, 400 untuk filter tidak valid/injeksi company, dan 200 untuk akun berizin dengan metrik unavailable.
- Browser: sesi aplikasi yang tersedia berhasil memuat endpoint terbaru dan menampilkan jadwal kosong secara benar; pergantian periode dan filter status berhasil. Preview filter Terlambat menyisakan satu baris; rincian dapat dibuka. State loading tidak menampilkan angka fixture; error dan denied tampil jelas.
- Viewport 1600 px: konten 1288 px, tabel 948 px dan panel target 324 px sesuai sumber; KPI mulai y215 sesuai sumber. Border/padding browser masih memberi selisih beberapa piksel pada tinggi; tidak diklaim identik piksel. Viewport 360 px tidak overflow horizontal halaman; tabel lebar menggulir dalam area sendiri.
- Proses API lama sempat 404; setelah pengguna menghentikannya, API terbaru dan web dihidupkan kembali. Data uji tambahan yang dibuat untuk persiapan QA di perusahaan terisolasi sudah dibersihkan.

Keterbatasan: belum ada invoice/retur posted, target, estimasi, kunjungan, penawaran, SO, sampel, ekspor privat, halaman sumber penuh, dan realtime. Riwayat prospek bukan histori task immutable. Pengujian angka penjualan aktual belum dapat dilakukan karena sumbernya belum ada; UI/backend tahap ini tidak membuatnya seolah operasional.

## Koreksi ukuran mengikuti Ringkasan Eksekutif

Keputusan terbaru pengguna: ukuran dan spacing seluruh modul Dashboard memakai Ringkasan Eksekutif sebagai patokan, termasuk tanggal/Ekspor. Menggantikan ukuran Sales dari frame yang tercatat pada bukti awal di atas. Sales memakai kelas KPI dan grid panel bersama; angka, padding, gap, breakpoint dan ikon dropdown tanggal disamakan. Header/baris/footer tabel mengikuti ukuran tabel Eksekutif. Requirement DSH-01–03 dan APP-03/04; perubahan hanya presentasi web dan panduan, tanpa perubahan kontrak API, aturan bisnis atau migrasi.


Validasi koreksi: typecheck Office, ESLint dan validator repository lulus. Perbandingan browser desktop 1600px menunjukkan KPI kedua halaman mulai y206 dengan tinggi 127,33px; panel utama mulai y353,33; tombol tanggal 177,64x38px dan Ekspor 97,05x38px untuk label periode yang sama. Lebar area mengikuti ruang viewport yang tersedia (scrollbar vertikal dapat mengambil ruang). Pada 1100px KPI menjadi dua kolom dan panel satu kolom; pada 360px tombol sama dengan acuan dan tidak ada overflow horizontal halaman. Kontrol periode dapat dibuka/ditutup. Bukti viewport normal: review/dashboard-sales-spacing.png. Tinggi panel isi menyesuaikan konten masing-masing.

