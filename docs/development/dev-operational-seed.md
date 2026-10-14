# Data dev pada aplikasi operasional — 7 Oktober 2026

Keputusan pengguna: data simulasi masuk database dev, tidak production; seluruh review memakai aplikasi operasional. Scope seed ini: perusahaan fiktif existing, akun Novian existing (password tidak diubah), role tambahan dev terbatas, pelanggan/produk contoh SO, harga, termin, pajak fiktif bertanggal efektif, penomoran dan empat draft SO beserta bukti privat/audit. Tidak mengisi saldo stok, AR/AP atau GL secara langsung dan tidak memalsukan status pemenuhan. Requirement APP-03/04, NFR-03/05, OTC-01 dan master data/Setting terkait. Tidak ada migration atau perubahan tarif production.

Seed harus idempoten, mempertahankan suntingan pengguna, memakai layanan backend untuk command SO, dan menolak production maupun database/storage nonlokal. Mockup adalah sumber contoh nama/produk; nomor/status transaksi ditetapkan backend. Data Warehouse/Finance yang membutuhkan posting tetap dibuat melalui alur domain, bukan salinan angka mockup.


## Menjalankan

Jalankan Docker Desktop, kemudian `pnpm infra:up`. Terapkan migration yang belum terpasang dengan `pnpm db:migrate`. Pada PowerShell lokal:

```powershell
$env:EVFLOW_ALLOW_DEV_SEED = "LOCAL_FICTITIOUS_ONLY"
pnpm db:seed:dev
pnpm dev
```

`.env` harus memakai `NODE_ENV=development`, PostgreSQL lokal bernama `evflow`, serta endpoint S3 lokal. Opt-in tidak mengalahkan larangan production. Script mengharuskan akun demo.admin@evflow.local dan membership aktif yang sudah dibuat; tidak membuat ulang atau mengubah passwordnya. Role existing dipertahankan. DEV_SALES_ORDER menambahkan read/create/update/submit SO dan audit pada perusahaan uji, tanpa memperluas role ADMIN_SYSTEM bersama. Perubahan role memakai AccessService dan mencabut sesi terdampak: login ulang setelah seed pertama.

Buka `http://localhost:3000/login`, lalu `/operations/orders`. Tidak ada mode preview. Empat SO awal adalah DRAFT; nomor dibuat backend. Pajak 11% merupakan konfigurasi fiktif untuk pengujian, bukan tarif resmi. Dataset belum menyediakan stok/pemenuhan/POD/invoice/pembayaran; lanjutkan melalui command domain jika memerlukan skenario tersebut. Tidak menyatakan seluruh alur O2C lulus hanya karena draft dapat dibaca.

## Bukti eksekusi

7 Oktober 2026: Docker dan dependensi lokal berhasil dinyalakan. Seed selesai dua kali; tetap empat SO dengan ID/nomor yang sama (DEV-SO-2026-000001 hingga 000004). Login HTTP dengan CSRF berhasil; endpoint daftar menghasilkan total 4, lookup menghasilkan 4 pelanggan dan 5 produk. Permintaan daftar tanpa sesi menghasilkan 401. Sesi verifikasi ditutup setelah pembacaan. Bukti SP disimpan melalui OperationsService.upload ke bucket privat, bukan metadata lampiran palsu. Command SO memakai idempotency key tetap dan menghasilkan audit backend. Tidak ada password/token dicatat dalam dokumentasi seed.

Delapan pengujian batas seed lulus; typecheck script dan lint TypeScript lulus. Verifikasi ini HTTP/data, bukan klaim audit visual baru. Tidak ada migration. Perubahan hanya script/dokumentasi serta data perusahaan development. Server `pnpm dev` berhasil dinyalakan.


## Koreksi bentrok localhost — 7 Oktober 2026

`pnpm dev` kini menjalankan Office/API/worker saja. Field dijalankan terpisah dengan `pnpm dev:field` pada port 3002. Pada pemeriksaan ditemukan proses node lain di IPv6 ::1:3000 menyajikan evflow Lapangan, sementara Office pada listener :: port 3000 dapat diakses melalui IPv4 127.0.0.1. URL localhost/login masuk ke /lapangan/login pada proses yang bentrok. Upaya menghentikan PID 21292 ditolak Windows dengan Access is denied; pengguna harus menghentikan proses tersebut dari terminal pemiliknya atau Task Manager berizin. PID bersifat sementara; periksa ulang sebelum penghentian. Jangan mematikan semua proses Node. Setelah konflik selesai, buka localhost:3000/login. Tidak ada perubahan UI/data/izin untuk mengatasi bentrok ini.
