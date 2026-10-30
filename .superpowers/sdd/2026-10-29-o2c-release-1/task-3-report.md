# O2C Release 1 Task 3 report

## Status

Implementation is present and statically verified. Database-backed acceptance remains blocked because PostgreSQL is unavailable at `127.0.0.1:5432`.

## Implemented

- Added `OtcPtpService.createInvoiceFromDeliveryNote`, consuming only a company-scoped `ISSUED` Delivery Note (Surat Jalan).
- Locked the Surat Jalan, customer, and Finance advisory lock before invoice creation.
- Added `sales_invoices.delivery_note_id`, a foreign key, and a `(company_id, delivery_note_id)` unique index so one Surat Jalan can produce at most one invoice.
- Copied delivered quantities, unit prices, tax snapshots, payment/TOP snapshot, freight snapshot, customer, currency, handover timestamp, and due date into the immutable posted invoice snapshot.
- Calculated due date from the handover date in the company timezone plus the snapshotted TOP days.
- Used existing document numbering, `transactionCommand` idempotency, `issueDocument`, `postLedger`, Finance period validation, and audit recording.
- Posted AR against UNBILLED_AR exactly once for the invoice and settled eligible customer receipts through existing settlement ledger entries.
- Limited automatic/manual customer receipt allocation to one invoice per payment; a retry against the same invoice is replay-safe and a second invoice is rejected.
- Added `POST /sales-invoices/from-delivery-note` using the existing `sales_invoice.post` permission family.
- Disabled legacy Packing List/POD invoice commands and drafts for Release 1 with an explicit source error; historical records remain readable.
- Extended the immutable invoice snapshot with customer code/name/legal name, billing/shipping/primary addresses, tax identity, and the SO delivery address.
- Kept payment allocation explicit for Release 1 because customer receipts are currently linked by SO/fulfillment batch rather than Delivery Note; invoice outstanding remains unchanged until allocation to the invoice ID.
- Batch-bound receipts can now allocate to a Delivery Note invoice when the batch belongs to the same SO; cross-order batches remain rejected.
- Added focused contract tests rejecting direct SO and legacy POD source payloads.

## Verification

- `pnpm db:generate` passed.
- `pnpm --filter @evflow/database validate` passed.
- `pnpm --filter @evflow/backend typecheck` passed.
- Focused static tests passed: `tests/integration/o2c-invoice-from-delivery-note.test.ts` (4 tests), `packages/backend/src/sales/outbound-read.test.ts`, and `packages/backend/src/sales/delivery-note.test.ts`.
- Delivery Note integration tests could not run: Prisma reported `Can't reach database server at 127.0.0.1:5432` for all five database tests.
- `./tools/validate-repository.ps1` passed.

## Remaining operational evidence

The following require a running development PostgreSQL instance: posted invoice and AR journal assertions, closed-period rejection, cross-company authorization, duplicate command replay, partial receipt settlement, and migration application.
