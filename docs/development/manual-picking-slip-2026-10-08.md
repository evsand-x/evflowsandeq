# Picking Slip manual — 8 Oktober 2026

Submit SO tetap membuat fulfillment dari alokasi stok yang berhasil, tetapi tidak lagi membuat Pick List atau dokumen Picking Slip.

Pengguna dengan izin `fulfillment.pick` harus menjalankan:

`POST /fulfillment-batches/:id/create-picking`

Command ini membuat Pick List dan dokumen Picking Slip secara atomik, memakai locking, idempotency, state guard, dan audit. Picking/dispatch berikutnya diblokir sampai tindakan ini dilakukan.
