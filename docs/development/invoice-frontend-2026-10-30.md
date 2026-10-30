# Frontend Invoice dan Terima Pembayaran (Release 1)

Tanggal: 30 Oktober 2026

Halaman Office mengikuti canvas evflow Office Design (Invoice-list, Invoice-form, Invoice-detail, Payment-form) dan memakai backend pada `docs/development/invoice-payment-backend-2026-10-30.md`. Backend tetap sumber kebenaran: frontend hanya menampilkan pratinjau dan memvalidasi isian sebelum mengirim perintah.

## Rute

| Rute | Isi | API |
| --- | --- | --- |
| `/operations/invoices` | Daftar: tab Semua, Draft, Belum dibayar, Sebagian dibayar, Lewat jatuh tempo, Lunas; cari; filter pelanggan; banner SJ siap diinvoice | `GET /sales-invoices`, `/sales-invoices/candidates`, `/master-data/customers` |
| `/operations/invoices/new?surat_jalan_id=` | Form draft dari Surat Jalan terbit | `GET /sales-invoices/form`, `POST /sales-invoices/drafts` |
| `/operations/invoices/:id` (DRAFT) | Form draft: ubah nomor/tanggal/catatan, Simpan draft, Submit (dialog) | `PATCH /:id/draft`, `POST /:id/submit` |
| `/operations/invoices/:id` | Detail: ringkasan nilai, data invoice, barang, pembayaran dan pemotongan, Lengkapi bukti potong | `GET /sales-invoices/:id`, `POST /invoice-payment-deductions/:id/proof` |
| `/operations/invoices/:id/payment` | Terima Pembayaran satu invoice, pemotongan % atau Rp, bukti transfer | `GET /:id/payment-form`, `POST /:id/payment-evidence`, `POST /:id/payments` |

Surat Jalan: tombol **Buat Invoice** di detail SJ terbit dan di kolom Invoice tab "Terbit, belum diinvoice" membuka form draft (tidak lagi memposting langsung lewat `/sales-invoices/from-delivery-note`).

## Aturan tampilan

- Izin: daftar/detail `sales_invoice.read`; nilai uang hanya dengan `sales_invoice.view_price`; draft/submit `sales_invoice.post` + `view_price`; pembayaran `customer_receipt.post` + `view_price`; filter pelanggan `master_customer.read`.
- Nomor Invoice baru dikirim hanya bila diubah dari usulan Setting; jatuh tempo ditampilkan dari server (tanggal Surat Jalan + termin SO).
- Tanggal invoice tidak boleh sebelum tanggal Surat Jalan; tanggal terima tidak boleh sebelum tanggal invoice.
- Pemotongan: sumber dari pajak potong (Setting › Pajak) dan Jenis Potongan (Setting). Persen dihitung dari DPP (subtotal) invoice dengan pembulatan pajak; akun mengikuti sumber. Pemotongan yang wajib bukti tanpa file bukti tercatat "Menunggu bukti potong" dan belum mengurangi outstanding sampai dilengkapi di detail.
- Nominal diterima + seluruh pemotongan tidak boleh melebihi outstanding (server menolak `PAYMENT_EXCEEDS_OUTSTANDING`); kelebihan bayar belum didukung.
- Simpan Pembayaran adalah satu perintah atomik dengan Idempotency-Key.

## Belum dibangun

- Cetak invoice (tombol Cetak di canvas).
- Koreksi/reversal pembayaran.
