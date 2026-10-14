# Arah kerja tindakan outbound — 8 Oktober 2026

## Tujuan

Menjadikan alokasi backorder dan pembuatan Picking Slip sebagai tindakan yang terlihat dan dapat dijalankan pengguna berizin pada web Office.

## Cakupan

- Backorder & Alokasi Stok tetap tersedia dari Sales Order dan ditampilkan sebagai menu operasional Warehouse & Logistik.
- Barang Keluar memiliki sublayar Backorder & Alokasi Stok, Pick Slip, dan Pemenuhan & POD.
- Detail fulfillment menampilkan tindakan Buat Picking Slip sebelum petugas melakukan picking.
- Daftar Pick Slip menampilkan tahap yang sudah memiliki slip dan status picking/checking.
- Mobile dan procurement belum diubah.

## Keputusan pengguna

Pengguna menyetujui susunan Backorder & Alokasi Stok, Pick Slip, lalu Pemenuhan & POD di dalam Barang Keluar. Backend alokasi backorder dan pembuatan Picking Slip menjadi otoritas transaksi; UI hanya memanggil command berizin dan menyegarkan data setelah konfirmasi server.

## Kriteria penerimaan

1. Tombol Evaluasi & alokasi ulang hanya tampil untuk backorder dan izin `sales_order.reallocate`.
2. Tombol Buat Picking Slip hanya tampil pada fulfillment `ALLOCATED` tanpa pick list dan izin `fulfillment.pick`.
3. Setelah berhasil, daftar/detail menampilkan nomor dan status Picking Slip.
4. Menu Pick Slip dapat dibuka dari sidebar dengan izin baca pemenuhan.
5. State loading, error, empty, dan permission tetap terlihat.
