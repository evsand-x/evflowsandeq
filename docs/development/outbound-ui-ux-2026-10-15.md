# UI/UX Barang Keluar (Outbound) — 15 Oktober 2026

## Arah pengguna

- Cakupan: shell lengkap Outbound pada aplikasi Office operasional.
- Tahap: Picking, Checking/Packing, Pengiriman, POD, dan Retur.
- Tampilan awal: daftar tugas outbound dengan ringkasan status dan antrean tindakan.
- Data harus berasal dari sesi, izin, dan endpoint operasional nyata. Tahap tanpa sumber endpoint menampilkan state belum tersedia.

## Sumber aturan

- `docs/erp-blueprint/07-design.md`: struktur menu Warehouse & Logistik serta layar fulfillment/pengiriman.
- `docs/erp-blueprint/11-warehouse-logistik.md`: picking dari reservation, checking sebelum packing/SJ, dispatch ke transit, POD sebagai konfirmasi penerimaan, dan retur ke karantina.
- APP-03/NFR-05: tabel TanStack, label selain warna, responsive dan aksesibilitas.

## Implementasi

- Sidebar Barang Keluar memuat empat dokumen outbound yang terpisah (Picking, Checking/Packing, Surat Jalan/Pengiriman, POD) dan Retur sebagai dokumen pengecualian. Semua memakai shell `OperationsWorkspace` yang sama dengan menu operasional lain, tetapi detail, tindakan, dan filter datanya berbeda.
- Shell menampilkan navigasi tahap horizontal yang konsisten dengan state aktif dan tetap dapat digeser pada viewport sempit.
- Daftar tahap menampilkan antrean tindakan kontekstual, loading/error/empty state, dan tautan detail yang mempertahankan tahap aktif.
- Picking memakai route `/operations/pick-slips`; Checking/Packing, Pengiriman dan POD memakai `/operations/warehouse?stage=...` dengan daftar fulfillment yang sudah tersedia.
- Endpoint daftar fulfillment menerima filter `stage=checking|shipping|pod`, sehingga tiga antrean memakai data backend yang berbeda: picking sudah `PICKED`, pengiriman sudah `CHECKED`, dan POD masih `DISPATCHED` atau `PARTIALLY_DELIVERED`.
- Retur memakai route `/operations/returns` pada shell yang sama dan menampilkan keterangan jujur bahwa endpoint penerimaan retur belum tersedia, tanpa data simulasi.
- Tindakan detail tetap membuka route fulfillment operasional yang sudah ada dan izin backend tetap berwenang.

## Batas verifikasi

TypeScript dan validator repository dijalankan. Pemeriksaan browser pada route operasional memerlukan sesi pengguna berizin; route tanpa sesi menampilkan penolakan akses sesuai kontrak.
