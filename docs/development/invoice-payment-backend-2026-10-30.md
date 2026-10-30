# Laporan Implementasi Backend Invoice dan Terima Pembayaran

Tanggal: 30 Oktober 2026

## Hasil

Backend Invoice mengikuti alur mockup Office: sumber Invoice adalah Surat Jalan yang sudah terbit, nomor dapat diedit selama masih draft dan harus unik dalam perusahaan, lalu Submit membuat posting piutang. Jatuh tempo dihitung dari `SuratJalan.issuedAt` pada zona waktu perusahaan ditambah snapshot termin pembayaran dari Sales Order. Setelah posting, nomor, sumber, harga, pajak, termin, dan nilai dokumen menjadi immutable.

Terima Pembayaran tersedia sebagai transaksi atomik. Sistem memvalidasi bank/perusahaan/periode, mencegah referensi bank ganda, mengalokasikan pembayaran ke Invoice, menangani pembayaran parsial/penuh, mencatat jurnal dan audit/outbox, serta memakai idempotency. Potongan dengan bukti wajib tetap menyisakan saldo AR sampai bukti potongan diselesaikan; bukti pembayaran dan bukti potongan memiliki lifecycle terpisah. Nilai uang, pajak, kuantitas, dan perhitungan potongan memakai Decimal/PostgreSQL numeric.

Read model Invoice menyediakan daftar, tab/count, pencarian, filter pelanggan, kandidat SJ, form, detail, dan data pembayaran. Akses harga dipisahkan melalui `sales_invoice.view_price`; tanpa grant tersebut response hanya memuat metadata identitas yang diizinkan. Payment read/write tetap memiliki grant sendiri dan tidak bergantung pada grant read Invoice. Endpoint lama dipertahankan melalui adapter dan response sensitif disamarkan.

## API utama

- `GET /sales-invoices`, `/sales-invoices/candidates`, `/sales-invoices/form`, `/sales-invoices/:id`
- `POST /sales-invoices/drafts`, `PATCH /sales-invoices/:id/draft`, `POST /sales-invoices/:id/submit`
- `GET /sales-invoices/:id/payment-form`
- `POST /sales-invoices/:id/payments`
- `POST /invoice-payment-deductions/:id/proof`
- `POST /sales-invoices/:id/payment-evidence`
- `GET /sales-invoices/:id/payment-evidence/:evidenceId`

## Database dan dokumen

Migration yang diterapkan lokal:

1. `20261030140000_invoice_form`
2. `20261030141000_invoice_payment`
3. `20261030142000_invoice_payment_ledger_kind`
4. `20261030143000_invoice_payment_numbering`
5. `20261030144000_invoice_price_permission`

Blueprint dan kontrak yang disinkronkan mencakup requirement OTC-02/05/06, FIN-01/02/03/08/11/18, IAM-01/04, dan CFG-08, serta dokumen API, database, arsitektur, user flow, desain, fitur, dan setting. Perubahan belum menyatakan UI frontend selesai. Koreksi/reversal khusus pembayaran langsung juga belum dibangun; legacy reversal sengaja diblokir dengan error yang mengarahkan ke alur koreksi khusus.

## Verifikasi

- Test Invoice lifecycle: lulus.
- Test read model/privacy: lulus.
- Test payment dan deduction: 14 lulus.
- Test concurrency dengan dua transaksi database nyata: lulus; satu SJ hanya menghasilkan satu Invoice dan kompetisi pembayaran tidak membuat outstanding negatif.
- API E2E dengan login AuthService, CSRF, session, dan role database nyata: 6 lulus.
- Backend/API typecheck: lulus.
- ESLint target: lulus.
- Prettier check target: lulus.
- `pnpm db:validate`: lulus.
- `./tools/validate-repository.ps1`: lulus, 22 dokumen blueprint diperiksa tanpa broken link/conflict.
- `pnpm db:generate`: runtime/TypeScript Prisma terbarui, tetapi command mengembalikan Windows EPERM karena query-engine sedang terkunci oleh proses yang sudah berjalan.

Suite penuh terakhir: **552 lulus, 38 gagal, 102 file (93 lulus, 9 gagal)**. 38 kegagalan berada pada fixture atau kontrak legacy yang tidak disentuh oleh perubahan Invoice: numbering rule legacy (SO/credit note/Proforma), ekspektasi `fulfillmentBatch` lama, fixture otorisasi Proforma, ekspektasi dashboard terhadap ADMIN_SYSTEM, dan grant milestone IAM/CRM. Rincian stack tersimpan pada `invoice-test-results-final.log`; kegagalan tersebut tidak terjadi pada test baru Invoice/payment.

