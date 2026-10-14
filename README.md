# evflow

Repository implementasi **evflow**, aplikasi ERP PT Sandeq Sarana Medika. Fondasi Milestone 0 menyediakan monorepo, shell aplikasi, API/worker, PostgreSQL/Prisma, Redis/BullMQ, MinIO, kontrak publik, design token, dan pengujian awal. Spesifikasi produk yang telah difinalkan berada di [docs/erp-blueprint](docs/erp-blueprint/README.md).

## Mulai untuk pengembang dan AI agent

1. Baca [AGENTS.md](AGENTS.md).
2. Baca [Panduan Implementasi AI Agent](docs/development/ai-agent-guide.md).
3. Mulai dari [Peta Dokumen](docs/erp-blueprint/00-document-map.md), requirement bernomor, dan dokumen domain terkait.
4. Jalankan `./tools/validate-repository.ps1` sebelum menyerahkan perubahan.

## Struktur

```text
apps/
  office/          Next.js + React untuk web kantor
  field/           Nuxt + Vue + Capacitor untuk Android/iOS
  api/             NestJS HTTP API
  worker/          BullMQ consumer, scheduler, dan outbox relay
packages/
  backend/         domain dan application service server-only
  database/        Prisma, migration, SQL, dan database client server-only
  contracts/       OpenAPI, DTO publik, dan client types
  design-tokens/   token Tailwind lintas React/Vue
  ui-react/        komponen kantor
  ui-vue/          komponen mobile
  config/          konfigurasi bersama
docs/
  erp-blueprint/   sumber spesifikasi produk
  development/     panduan implementasi
infra/             MinIO lokal, konfigurasi infrastruktur, dan deployment
tests/             integration dan end-to-end lintas aplikasi
tools/             validator dan otomasi repository
```

Workspace memakai pnpm dengan satu lockfile. Prisma client dan package backend tidak boleh masuk bundle browser.

Object storage development menggunakan MinIO pada `infra/docker`. Aplikasi tetap memakai kontrak S3-compatible agar lingkungan pilot/production dapat menggunakan private managed object storage tanpa mengubah domain aplikasi.

## Menjalankan development lokal

Prasyarat: Node.js 22+, pnpm 10+, Docker Desktop/Engine, dan PowerShell 7 atau Windows PowerShell.

1. Salin `.env.example` menjadi `.env` dan `infra/docker/.env.example` menjadi `infra/docker/.env`. Nilai contoh hanya untuk development lokal; ganti secret pada lingkungan lain.
2. Instal dependency: `pnpm install`.
3. Jalankan PostgreSQL, Redis, MinIO, dan bootstrap bucket privat: `pnpm infra:up`.
4. Terapkan migration: `pnpm db:migrate`. Seed fiktif hanya pada dev lokal dengan opt-in; ikuti [panduan seed operasional dev](docs/development/dev-operational-seed.md).
5. Jalankan seluruh aplikasi: `pnpm dev`.

Port default: Office `3000`, API `3001`, Field `3002`, PostgreSQL `5432`, Redis `6379`, MinIO API `9000`, dan MinIO Console `9001`. Health API tersedia pada `GET http://localhost:3001/api/v1/health` dan memeriksa PostgreSQL, Redis, serta bucket object storage.

## Pemeriksaan

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm db:validate
pnpm infra:config
pnpm validate:repository
```

Test database mengharuskan container development aktif dan migration sudah diterapkan. Seed hanya membuat data berlabel **DATA UJI FIKTIF** dan tidak menyediakan kredensial login yang dapat digunakan.

## Status fondasi dan login (audit Langkah 1)

API menyediakan login, access token singkat dalam cookie HttpOnly, refresh-token rotation, reuse detection, logout/revoke, CSRF/origin check, multi-role RBAC dan scope perusahaan. Login dan refresh dibatasi per sumber melalui Redis; API menolak keduanya saat Redis tidak tersedia. Office UI saat ini menyediakan `/login` dan Dashboard awal dengan bootstrap `/auth/me`, cache privat in-memory serta logout lintas tab. Menu domain yang belum memiliki halaman tidak menjadi tautan aktif. Field saat ini hanya shell Nuxt, belum alur login mobile. Endpoint Setting dan Master/CRM sudah ada di backend, tetapi halaman UI lama tidak tersedia pada source saat audit ini; jangan anggap modul tersebut siap dipakai end-to-end.

Untuk mengaktifkan akun uji fiktif lokal, isi `DEV_SEED_ADMIN_PASSWORD` hanya pada environment lokal sebelum menjalankan `pnpm db:seed`. Tanpa nilai itu, akun seed tetap memakai hash nonaktif. Katalog `OPS-*` di-seed sebagai data versioned; runtime membaca versi aktif PostgreSQL dan transaksi domain dapat memakai `AdministrationService.requirePolicySnapshot()` untuk menyimpan bukti policy yang digunakan.

Policy yang mengizinkan tanggal berlaku mendatang disimpan sebagai versi `SCHEDULED`. Worker memeriksa versi yang jatuh tempo saat startup dan setiap 60 detik, lalu mengaktifkannya secara transaksional serta menulis audit tanpa menghentikan versi aktif lebih awal.

Renovasi login Office mencakup panel biru dari token yang ada, form ringkas, tampil/sembunyikan kata sandi, indikator Caps Lock, validasi aksesibel dan langkah pemilihan perusahaan untuk akun multi-company. Kredensial valid tanpa pilihan perusahaan menghasilkan `COMPANY_SELECTION_REQUIRED` bila beberapa membership aktif tersedia; backend hanya mengirim pilihan aktif yang diizinkan dan memeriksa ulang kredensial/membership saat pilihan dikirim. Sesi baru dibuat setelah pilihan valid. Kredensial tetap dalam memori dan dibersihkan setelah sukses, Kembali atau unmount; retry `/auth/me` tidak mengirim ulang login. Request autentikasi memiliki timeout 20 detik; kegagalan refresh 429/503 tetap dibedakan dari 401. Timeout transaksi bisnis tidak berubah dan tidak ada migration.

Verifikasi final 28 September 2026: satu eksekusi `pnpm test` lulus **52/52 tes pada 13 file**, pukul 13:49:50 waktu lokal. Typecheck 11 package, build production Office final, build contracts/backend/API, scoped ESLint dan pemeriksaan formatting lulus. Sepuluh kelompok skenario Edge/Playwright serta pemeriksaan tambahan kontras, teks 200% pada 360 px, indikator Caps Lock melalui event simulasi dan pilihan nama perusahaan ambigu lulus. Build Office masih memberi peringatan lama tentang plugin ESLint Next yang belum terpasang. Rincian bukti dan batas cakupan ada pada [audit renovasi login](docs/development/login-renovation-audit.md); TLS produksi, beban proxy, auth native perangkat nyata dan stream autentikasi lintas perangkat belum diuji. Hasil ini tidak menyatakan seluruh IAM atau ERP siap produksi.

Pilihan perusahaan dengan nama yang sama setelah normalisasi Unicode NFKC, huruf besar/kecil dan whitespace (termasuk merapatkan whitespace internal) dinonaktifkan; nama unik tetap dapat dipilih. Pemberitahuan inline meminta administrator membedakan nama Profil Perusahaan. Bila semua opsi ambigu, tombol melanjutkan nonaktif dengan alasan dan Kembali tetap aktif. Label biasa tidak menampilkan UUID dan kemampuan membership backend tetap sama.

Belum tersedia dalam irisan login ini: MFA (belum wajib menurut keputusan 26 September 2026), password recovery, login field native, sinkronisasi pencabutan sesi realtime lintas perangkat, upload logo, approval policy, template cetak, dan penomoran dokumen. Bantuan masuk mengarahkan pengguna menghubungi admin. Status layar Setting/Master/CRM mengikuti audit modul masing-masing; renovasi login tidak membuktikan modul tersebut siap end-to-end. Fitur transaksi ERP belum siap operasional.

## Dashboard — irisan pertama

Setelah login, Office membuka Dashboard pada `/` setelah bootstrap `/auth/me`. `GET /api/v1/dashboard/summary` menghitung jumlah institusi prospek per status dari tabel CRM perusahaan aktif dalam transaksi baca konsisten. Server hanya mengirim ringkasan Sales bila izin `crm.read` pada cakupan perusahaan berlaku. Respons menyertakan satuan, versi definisi, `data_as_of`, `updated_at`, dan freshness; halaman menyediakan loading, error/retry, dan pembaruan manual. Area yang belum memiliki sumber transaksi ditampilkan **Belum tersedia**, bukan nol. Tidak ada migration baru untuk irisan ini.

Irisan ini belum memenuhi seluruh DSH-01–03: belum ada projection/checkpoint tersimpan dan rebuild, event realtime/fallback otomatis dari OPS-SYS-01, drill-down CRM, tugas/persetujuan, laporan/ekspor, serta metrik posted Sales, Warehouse, Finance, dan HRIS. Jangan memakai angka CRM sebagai aktual penjualan atau jumlah pelanggan bertransaksi.


Data contoh aplikasi operasional dev (pelanggan, produk, draft SO dan izin Novian): [panduan seed dev](docs/development/dev-operational-seed.md). `pnpm db:seed` dan `pnpm db:seed:dev` menolak production, target nonlokal dan eksekusi tanpa opt-in eksplisit.
