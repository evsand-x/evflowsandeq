# Laporan Backend Persediaan — Vertical Slice

Tanggal: 30 Oktober 2026

## Implementasi

Backend Persediaan tahap pertama mengikuti tiga layar pada mockup `evflow-office-design.pen`:

- `GET /inventory` untuk daftar produk, pencarian, filter gudang/kategori, tab stok rendah, pagination, total, tersedia, reservasi, ditahan, minimum stock, status, dan nilai persediaan.
- `GET /inventory/:productId` untuk ringkasan produk, lot/batch dan locator, FEFO, mutu, harga jual, harga beli terakhir, moving-average HPP, serta nilai persediaan.
- `GET /inventory/:productId/stock-card` untuk filter gudang/lot/periode, saldo awal, masuk, keluar, saldo berjalan dan nilai saldo.

Saldo diturunkan dari `StockLot`, reservasi, kualitas, expiry, locator dan `InventoryMovement`. Movement reservasi/release tidak dihitung sebagai stok fisik; dispatch dibaca sebagai keluar walaupun quantity ledger yang ada positif. Expired, hold, recall dan locator non-storage/dispatch masuk ditahan. HPP hanya dikirim dengan `inventory.cost.read`; Admin Sistem tetap memiliki akses penuh.

Opname minimum memakai `StockCount`/`StockCountLine` dan lifecycle Draft → Submitted → Approved → Posted. Posting mengunci opname dan lot, memeriksa version, periode finance terbuka, mapping akun, hasil stok non-negatif, idempotency, membuat movement `ADJUSTMENT`, jurnal nilai, audit dan outbox. Pembuat opname tidak dapat menyetujui dokumennya sendiri.

## Database dan permission

Migration baru:

- `20261030150000_inventory_product_minimum_stock`
- `20261030151000_inventory_stock_count`

Capability baru: `inventory.read`, `inventory.cost.read`, `inventory.stock_count.create`, `inventory.stock_count.edit`, `inventory.stock_count.submit`, `inventory.stock_count.approve`, `inventory.stock_count.post`.

Requirement yang disentuh: WH-01/02/03/05, FIN-04, IAM-01/04, CFG-08. PTP baru, GR baru, retur supplier, recall lengkap, pemusnahan, konsinyasi, dan UI frontend tetap ditunda.

## Verifikasi

- Unit projection dan adjustment: **3 lulus**.
- Backend inventory files lint/typecheck: lulus. Monorepo backend typecheck masih gagal pada `sales/delivery-note.ts` karena `issueSuratJalanSchema` yang sudah dirty/empty di pekerjaan Surat Jalan sebelumnya; error tersebut tidak menyentuh file Persediaan.
- API typecheck: lulus.
- `pnpm db:validate`: lulus.
- `./tools/validate-repository.ps1`: lulus, 22 dokumen blueprint, 0 broken link/conflict.
- Migration deploy lokal: lulus.
- `pnpm db:generate`: tetap mengembalikan Windows EPERM saat rename `query-engine-windows.exe` karena proses lain mengunci file; generated client yang tersedia tetap dipakai untuk typecheck.
- Suite penuh terakhir: **556 lulus, 38 gagal**, 105 file (96 lulus, 9 gagal). Kegagalan berada pada fixture/kontrak legacy yang sudah dikenal: numbering legacy, ekspektasi fulfillment batch lama, fixture Proforma, dashboard ADMIN_SYSTEM, milestone IAM/CRM, dan satu manual Proforma 500. Tidak ada test baru Persediaan yang gagal.

