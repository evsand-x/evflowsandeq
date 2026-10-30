# O2C Release 1 DB integration report

## Findings and fixes

- Surat Jalan integration fixtures now create the company membership required by `evidence_company_actor_fk` and finance journal scope triggers.
- The SO close remainder test now asserts `OPEN` after closing 20 of 30 units. Release 1 does not auto allocate stock, so the undelivered remainder keeps the order open.
- Added a PostgreSQL acceptance path that issues a Surat Jalan, creates one posted invoice from it, checks totals/outstanding AR and ledger creation, and verifies idempotent replay.
- Invoice creation no longer calls `issueDocument` with a delivery-note ID. `fulfillment_documents.batch_id` references fulfillment batches, while a Release 1 delivery note has no batch ID; the invalid call caused `document_batch_fk` failures.
- Added migrations `20261029190000_fix_finance_line_append_guard` and `20261029200000_restore_finance_line_append_guard`. The finance line scope trigger now accepts nested journal-line inserts from the creating transaction while rejecting appends to committed journals using `pg_xact_status`.
- Follow-up migrations `20261029220000_epoch_aware_finance_line_guard` and `20261029230000_fix_xid8_status_cast` resolve `xmin` against the current XID epoch and support nested savepoints without losing wraparound context.
- Invoice detail now reads immutable DeliveryNote invoice lines from `salesInvoice.issuedSnapshot`; the acceptance test asserts detail allocations and unchanged journal/ledger counts after replay.

## Verification

- `pnpm --filter @evflow/database migrate:deploy` — passed; migrations 69 and 70 applied locally.
- Focused integration command — passed: 3 files, 16 tests.
- `pnpm --filter @evflow/database typecheck` — passed.
- `pnpm --filter @evflow/backend typecheck` — passed.
- Backend typecheck was started; parent release validation should rerun the complete command and repository validator.
