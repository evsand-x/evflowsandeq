# Backend Form Surat Jalan — 29 Oktober 2026

Perubahan ini menyelaraskan backend Surat Jalan dengan form pada `docs/mockup/evflow-office-design.pen`.

## Implementasi

- Contract create/update menerima nomor, tanggal dokumen, tanggal kirim, gudang asal, ekspedisi, kendaraan, pengemudi, ongkir decimal, catatan, dan baris kuantitas.
- `DeliveryNote` memiliki kolom typed untuk field identitas dan operasional yang perlu divalidasi/query.
- Gudang divalidasi aktif dan satu perusahaan; kuantitas per baris tetap tunduk pada batas kumulatif SO.
- Snapshot SO tetap menjadi sumber alamat, TOP, produk, pajak, dan freight tax. Field form diteruskan ke `handover_snapshot` saat terbit.
- Penerbitan tetap mem-posting stok, pendapatan, dan HPP di transaksi existing serta menjaga idempotensi dan immutability.

## Verifikasi

- `packages/backend/src/sales/outbound-read.test.ts`
- `packages/backend/src/sales/delivery-note.test.ts`
- `tests/integration/o2c-delivery-note.test.ts` (8 test lulus, termasuk persistence dan snapshot metadata form)
- `pnpm --filter @evflow/backend typecheck`
- Migration development diterapkan dengan `pnpm --filter @evflow/database migrate:deploy`.

## Batasan

Belum ada master assignment ekspedisi, kendaraan, atau pengemudi. Nilainya disimpan sebagai metadata Surat Jalan sampai master resmi tersedia.
