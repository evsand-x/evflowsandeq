# Panduan Implementasi untuk AI Agent

Panduan ini menjaga implementasi **evflow** tetap konsisten dengan blueprint. Ia tidak menggantikan requirement atau dokumen domain.

Keputusan 7 Oktober 2026 mencabut kewajiban mengikuti file desain lama dan skill desain tambahan. Gunakan panduan implementasi web, standar global yang masih berlaku, serta blueprint untuk fungsi dan invariant. Fokus Office operasional; Field ditunda.

## 1. Urutan membaca sumber

Gunakan urutan berikut untuk setiap pekerjaan:

1. `AGENTS.md` untuk aturan repository.
2. `docs/erp-blueprint/00-document-map.md` untuk kepemilikan dan prioritas sumber.
3. `docs/erp-blueprint/README.md` untuk register keputusan pengguna.
4. `docs/erp-blueprint/02-requirements.md` untuk requirement dan acceptance rule bernomor.
5. Dokumen domain pemilik aturan: 09 Dashboard, 10 Sales & Marketing, 11 Warehouse & Logistik, 12 Finance, 13 HRIS, 14 Master Data, atau 15 Setting.
6. Dokumen lintas lapisan yang relevan: 06 User Flow, 07 Design, 03 Database, 04 API, 05 Architecture, dan 08 Features.
7. `00-document-map.md` untuk keputusan final/default/blocker, `15-setting.md` untuk parameter editable, dan `00-document-map.md` untuk keterlacakan.

Untuk pekerjaan frontend atau desain UI, baca bagian relevan `06-user-flow.md` dan `07-design.md`, lalu periksa `packages/design-tokens`, package UI framework terkait, dan komponen terdekat. Dokumen desain lokal dan blueprint tidak boleh diubah oleh metode visual eksternal.

Jika sumber berbeda, ikuti prioritas dalam dokumen 00. Jangan memilih aturan berdasarkan file yang paling baru dibaca. Bila keputusan pengguna mengubah blueprint, sinkronkan dokumen sebelum atau bersama perubahan kode.

## 2. Bentuk pekerjaan yang diharapkan

Kerjakan satu vertical slice yang dapat diuji, bukan layar tanpa alur backend. Sebelum menulis kode:

- tulis requirement ID yang dilayani;
- identifikasi actor, izin, state awal/akhir, exception, audit, dan posting event;
- tentukan perubahan schema, API, worker, web, mobile, dan laporan;
- tentukan data konfigurasi wajib serta perilaku ketika data itu belum tersedia;
- tentukan acceptance test yang membuktikan aturan bisnis, termasuk jalur gagal.

Setelah implementasi, periksa kembali dokumen domain dan lapisan teknis. Status selesai memerlukan persistence, otorisasi, invariant, audit, dan pengujian yang relevan, bukan hanya tampilan.

## 3. Batas monorepo

| Lokasi | Tanggung jawab | Larangan utama |
|---|---|---|
| `apps/office` | Next.js/React, layar kantor, SSR bila sesuai | Tidak menghitung saldo atau memutus approval |
| `apps/field` | Nuxt/Vue/Capacitor, kunjungan dan tugas gudang | Tidak menyimpan transaksi sebagai sukses tanpa konfirmasi server |
| `apps/api` | HTTP adapter, validation, auth context | Controller tidak memuat logika domain besar |
| `apps/worker` | BullMQ, scheduler, outbox relay, projection | Job harus idempotent dan tidak melewati service domain |
| `packages/backend` | Modul Identity, Sales, Warehouse, Procurement, Finance, HR, Master, Administration | Server-only; tidak masuk bundle frontend |
| `packages/database` | Prisma schema/client, migration SQL, seed terkontrol | Tidak menjadi tempat aturan bisnis tersembunyi |
| `packages/contracts` | OpenAPI, DTO publik, generated client types | Tidak mengekspor model database internal |
| `packages/design-tokens` | Warna, tipografi, spacing, status, Tailwind tokens | Tidak berisi aturan izin atau bisnis |
| `packages/ui-react` | Komponen React/Tailwind/TanStack | Tidak dipakai oleh Vue |
| `packages/ui-vue` | Komponen Vue/Tailwind/TanStack | Tidak dipakai oleh React |
| `packages/config` | TypeScript, lint, format, test config bersama | Tidak menyimpan secret runtime |

Development object storage berada di `infra/docker/compose.yml` menggunakan MinIO. Kode aplikasi harus bergantung pada adapter S3-compatible dan environment variables, bukan SDK atau endpoint khusus yang mengunci domain ke deployment MinIO.

Dependensi domain diarahkan ke abstraction yang jelas. Modul tidak membaca atau menulis tabel milik modul lain secara sembarang. Integrasi dalam modular monolith memakai application service, domain event, atau kontrak internal yang diuji.

## 4. Aturan teknis yang tidak boleh hilang

- Simpan timestamp teknis dalam UTC; tanggal bisnis dan cut-off memakai Asia/Makassar.
- Gunakan decimal untuk uang, pajak, HPP, kurs, persentase, dan kuantitas presisi.
- Posting finansial/stok memakai transaksi database dan urutan lock yang konsisten.
- Mutasi penting memakai idempotency key. Retry tidak boleh membuat dokumen, pembayaran, movement, jurnal, atau notifikasi ganda.
- Posted record tidak diedit diam-diam. Koreksi menggunakan reversal, adjustment, credit note, atau proses domain yang ditentukan.
- Saldo dan dashboard adalah projection dari ledger/sumber posted; sediakan rekonsiliasi dan rebuild bila dibutuhkan.
- Queue hanya menjalankan efek setelah commit melalui outbox atau mekanisme yang setara.
- Izin read/write/approve/post/export dan scope diperiksa pada server setiap request.
- Cache frontend dipisahkan per akun/company/scope dan dibersihkan saat logout atau perubahan sesi.
- Private attachment menggunakan akses bertenggat; log tidak memuat token, gaji, rekening penuh, NIK, atau data pribadi lengkap.
- Policy bertanggal efektif menyimpan versi dan transaksi menyimpan snapshot yang diperlukan.

## 5. Matriks sinkronisasi perubahan

| Jenis perubahan | Dokumen minimum yang diperiksa/diperbarui |
|---|---|
| Aturan bisnis/status/formula | README keputusan, 02 Requirements, dokumen domain, 39 bila mengubah parameter final |
| Urutan proses/actor/exception | 06 User Flow dan dokumen domain |
| Menu, form, field, tindakan | 07 Design dan dokumen domain |
| Entitas, field, constraint, ledger | 03 Database dan dokumen domain |
| Endpoint, command, event, error | 04 API dan dokumen domain |
| Boundary, runtime, deployment, security | 05 Architecture |
| Fase atau cakupan rilis | 01 PRD dan 08 Features |
| Dashboard, KPI, laporan | 30 Dashboard serta sumber formula domain |
| Kepemilikan dokumen/modul | 00 Document Map dan 31 Audit |

Perubahan implementasi murni yang tidak mengubah kontrak produk tidak perlu menulis ulang blueprint. Agent tetap harus memeriksa bahwa implementasi tidak menyimpang darinya.

## 6. Definition of Done

Sebuah perubahan dapat dinyatakan selesai bila:

1. requirement ID dan acceptance rule jelas;
2. hak akses dan scope diuji pada server;
3. state transition, concurrency, retry, dan jalur exception ditangani;
4. migration bersifat eksplisit dan memiliki strategi rollback/forward-fix yang layak;
5. audit/event/posting yang diwajibkan tersedia;
6. unit test hanya dipakai untuk logika bernilai, integration test membuktikan database/transaksi, dan E2E membuktikan alur kritis;
7. dua frontend memakai kontrak API yang sama tanpa menyalin aturan bisnis;
8. dokumen yang terdampak tersinkronisasi;
9. `tools/validate-repository.ps1` lulus;
10. batasan dan release gate yang belum dapat diuji dilaporkan secara spesifik.

Untuk perubahan UI, Definition of Done juga mencakup pemeriksaan visual pada viewport dan state yang relevan bila dapat dijalankan: loading, empty, error, permission denied, validation, blocked/action-required, success, serta offline/retry untuk alur field yang memerlukannya. Periksa keyboard, focus, contrast, reduced motion, layout responsif, dan ukuran target sentuh. Bukti UI tidak menggantikan pengujian otorisasi, persistence, audit, atau posting.

Release gate operasional bukan parameter blueprint yang belum diputuskan. Agent harus membangun tempat konfigurasi, validasi, dan blocker-nya tanpa menebak data perusahaan yang belum tersedia.
