# Backend ongkir penjualan — 7 Oktober 2026

Implementasi backend untuk keputusan ongkir pada `docs/mockup/proforma-access-2026-10-07.md`.

- Sales Order menerima dan menyimpan snapshot ketentuan ongkir: payer, basis `PER_SHIPMENT`, estimasi, mode pajak, dan referensi tax rule.
- Setiap `FulfillmentBatch` menyimpan satu nilai ongkir dan pajaknya. Command shipment mengganti nilai sebelumnya secara atomik sebelum dispatch; tidak mengakumulasi charge lama.
- Mode `TAXABLE` wajib memakai `SalesTaxRule` aktif yang sesuai company/customer dan menyimpan snapshot rule serta hasil pajaknya. Tidak ada tarif pajak hardcode.
- Preview/issue Proforma dan issue/post Invoice membawa ongkir dari shipment terkait, menghitung total sekali, dan menyimpan snapshot ongkir terpisah dari nilai barang.
- Saat menerbitkan Proforma, caller berizin dapat mengirim override ongkir dan mode pajaknya. Backend memvalidasi tax rule, memperbarui snapshot shipment secara atomik, lalu menerbitkan Proforma dengan version baru. Override ditolak secara tidak langsung setelah shipment tidak lagi `ALLOCATED`.
- Kolom uang memakai PostgreSQL `numeric`; command shipment memakai idempotency, locking, state guard, dan audit yang sudah digunakan oleh alur fulfillment.

Migration: `20261007210000_sales_freight_backend`.
