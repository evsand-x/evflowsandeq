# Backend Master Data Produk — 9 Oktober 2026

Implementasi mengikuti MD-01–03, MD-11, OTC-14, PTP-07, FIN-04/05 dan domain Master Data.

## Cakupan

- Product aggregate menyimpan kategori, UOM dasar/konversi, flag batch/expiry/serial, profil penyimpanan, shelf-life, status, versi dan audit.
- Registrasi AKL/AKD dibuat sebagai data `PENDING`; verifikasi terpisah dapat menetapkan `VALID`, `EXPIRED` atau `INVALID`. Produk aktif wajib memiliki izin valid, profil penyimpanan dan shelf-life bila expiry digunakan.
- Harga Beli Acuan dan Harga Jual Standar disimpan sebagai versi effective-dated pada `ProductReferencePrice`; overlap pada kombinasi produk/UOM/jenis/mata uang ditolak. Harga ini tidak mengubah stok, HPP atau histori dokumen.
- Endpoint detail produk menyajikan integrasi read-only dengan stok, reservasi, fulfillment, SO dan PO. Mutasi stok, harga khusus, tax rule, kredit, HPP, posting dan MOU tetap dimiliki modul masing-masing.
- Update memakai version check; duplicate-check, history dan idempotent transaction/audit tersedia melalui API Master Data.

Migration: `20261009100000_product_master_hardening`.
