# Desain Backend Persediaan — Vertical Slice Mockup

Tanggal: 30 Oktober 2026

## Tujuan

Menyediakan backend operasional untuk tiga layar Persediaan pada `evflow-office-design.pen`: daftar stok per produk, detail persediaan produk, dan Kartu Stok. Saldo selalu diturunkan dari `StockLot`, reservasi, mutu, dan `InventoryMovement`; UI tidak boleh menghitung atau mengubah saldo sendiri.

## Cakupan tahap ini

Masuk:

- Daftar Persediaan dengan pencarian, gudang, kategori, tab Semua/Stok Rendah, pagination dan agregasi total/tersedia/reservasi/ditahan/stok minimum.
- Detail produk dengan ringkasan saldo, lot/batch dan locator, FEFO, mutu, harga jual, harga beli terakhir, HPP rata-rata, serta mutasi terbaru.
- Kartu Stok dengan filter produk/gudang/lot/periode, saldo awal, masuk, keluar, saldo berjalan, dan nilai saldo HPP.
- Privasi: kolom biaya/HPP hanya untuk grant `inventory.cost.read`; metadata stok tanpa biaya tetap dapat dibaca dengan grant inventory read.
- Opname/adjustment minimum: buat draft scope gudang/locator, catat hitungan per lot, submit untuk approval, approve oleh aktor berbeda, lalu post movement delta secara atomik dengan idempotency, lock, audit, periode, dan jurnal nilai bila dibutuhkan.

Ditunda:

- PR/PO baru, monitoring shipment, GR baru, retur supplier, konsinyasi, recall lengkap, pemusnahan, dan approval policy generik baru.
- UI frontend Persediaan; tahap ini menyediakan kontrak backend untuk route operasional.

## Kontrak endpoint

- `GET /inventory` — daftar produk dan agregat stok.
- `GET /inventory/:productId` — detail persediaan produk.
- `GET /inventory/:productId/stock-card` — kartu stok terfilter.
- `POST /inventory/stock-counts` — buat draft opname.
- `PATCH /inventory/stock-counts/:id` — ubah hitungan draft dengan version.
- `POST /inventory/stock-counts/:id/submit` — ajukan opname.
- `POST /inventory/stock-counts/:id/approve` — setujui opname.
- `POST /inventory/stock-counts/:id/post` — posting adjustment dan movement.

Semua endpoint memakai `company_id` dari sesi, cursor/page dari server, dan response desimal sebagai string. Endpoint tidak menerima saldo akhir sebagai input; command hanya menerima hitungan atau delta yang dapat diaudit.

## Aturan bisnis

- `Total stok` adalah jumlah `quantityOnHand`; `Direservasi` jumlah `quantityReserved`; `Ditahan` adalah lot yang tidak eligible karena locator/quality/expiry/recall; `Tersedia = total - reserved - ditahan`, tidak boleh negatif.
- FEFO mengurutkan expiry terdekat yang masih valid; lot tanpa expiry mengikuti FIFO penerimaan. Lot expired, hold, recall, dan locator non-storage/dispatch tidak tersedia untuk pengiriman.
- HPP memakai moving average yang sudah menjadi kebijakan repository; harga keluar tidak memakai biaya per batch. Detail lot tetap menyimpan unit cost untuk audit.
- Kartu stok menghitung saldo awal sebelum tanggal mulai dan replay movement posted dalam urutan tanggal/id. Reservasi tidak menjadi movement keluar.
- Opname membekukan scope saat submit, memeriksa ulang lot dan saldo saat post, menolak selisih tanpa alasan, menolak stok negatif, dan tidak mengedit movement historis. Koreksi memakai movement adjustment baru.
- Approval opname/adjustment wajib; pembuat tidak boleh menyetujui dirinya sendiri. Jika mesin approval umum belum tersedia untuk jenis ini, command memakai status internal Draft → Submitted → Approved → Posted dan grant terpisah.

## Permission dan audit

Grant read inventory dan `inventory.cost.read` independen. Command opname memakai `inventory.stock_count.create`, `inventory.stock_count.edit`, `inventory.stock_count.submit`, `inventory.stock_count.approve`, dan `inventory.stock_count.post`; Admin Sistem tetap penuh. Setiap perubahan status, hitungan, movement, jurnal, alasan, actor, version, request dan idempotency dicatat di audit/outbox.

## Acceptance

1. Dua pembacaan bersamaan memberi agregat konsisten dan tidak membocorkan HPP tanpa grant.
2. Kartu stok merekonstruksi saldo dari movement dan menolak filter lintas perusahaan.
3. Dua posting opname bersamaan hanya menghasilkan satu adjustment karena lock/idempotency.
4. Approval pembuat sendiri, selisih tanpa alasan, periode tertutup, lot expired/hold/recall, dan saldo negatif ditolak.
5. Test integration, concurrency, API permission, typecheck dan validator repository lulus atau kegagalan legacy dilaporkan terpisah.

