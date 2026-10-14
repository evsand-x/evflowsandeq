# Alokasi manual backorder — 8 Oktober 2026

Keputusan: alokasi awal stok yang tersedia saat submit SO tetap otomatis. Sisa kebutuhan yang menjadi backorder tidak boleh dialokasikan ulang oleh worker atau event perubahan stok.

- Perubahan stok menjadi `AVAILABLE` tidak lagi membuat antrean alokasi backorder.
- Evaluasi backorder lama yang masih berada di antrean ditandai `BLOCKED` dengan alasan `MANUAL_REALLOCATION_REQUIRED`.
- Pengguna berizin menjalankan `POST /orders/:id/reallocate` dengan `sales_order.reallocate`, version SO, dan idempotency key.
- Command reallocate tetap memakai locking, reservation, inventory movement, pembuatan fulfillment/picking, audit, dan kontrol version yang sama dengan alokasi manual.
