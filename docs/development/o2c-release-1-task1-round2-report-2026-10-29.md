# O2C Release 1 Task 1 — Round 2 reconciliation

Tanggal: 29 Oktober 2026

## Perubahan

- Menambahkan addendum normatif pada API, User Flow, Sales & Marketing, dan Finance yang menetapkan Surat Jalan terbit sebagai event penyerahan, stok, pendapatan dan HPP.
- Menetapkan Invoice hanya berasal dari Surat Jalan terbit dan TOP dipilih pada SO lalu disnapshot.
- Menandai alur Picking, Checking, Packing List, dispatch terpisah dan POD lama sebagai later/out of Release 1 ketika masih dirujuk.
- Menegaskan izin SO tidak menjadi fallback Surat Jalan; izin Invoice tetap independen; Surat Jalan memakai family outbound yang sudah ada tanpa `delivery_note.*`.
- Menambah uji alias schema publik dan isolasi permission pada `packages/backend/src/sales/outbound-read.test.ts`.

## Verifikasi

- `pnpm vitest run packages/backend/src/sales/outbound-read.test.ts` — 6 tests passed.
- `git diff --check` — lulus.
- `./tools/validate-repository.ps1` — dijalankan pada release gate oleh agent utama.

Runtime service tidak diubah pada putaran ini.
