# Backend O2Câ€“P2P Phase 1 Direction

Date: 2026-09-30

## User decision

- First slice: Sales Order â†’ stock allocation â†’ dispatch/POD â†’ invoice.
- Backorder is an input to a Purchase Request; it does not create a PO directly.
- Initial accounting is minimal, idempotent posting with an auditable ledger.

## In scope

- Test opening stock with batch/expiry/locator and decimal quantities/values.
- SO draft/submit with all requested quantities preserved.
- Atomic available-stock allocation and per-line backorder.
- Fulfillment dispatch and POD confirmation.
- Invoice posting from confirmed POD quantity not previously invoiced.
- Automatic PR creation for shortages, with later P2P handoff endpoints.
- Audit events, idempotency keys, optimistic version checks, and server-side authorization.

## Deferred

- Credit unlock workflow, prepayment funding, customer returns/credit notes, full GL/chart-of-accounts, payment settlement, tax/Coretax, FEFO policy editor, and production opening migration.

## Acceptance

- A complete test scenario can open stock, submit an SO, allocate only available stock, create a PR for shortage, dispatch/confirm POD, and post an invoice exactly once.
- Decimal quantities and money use PostgreSQL numeric/Prisma Decimal.
- Duplicate retries do not duplicate reservations, stock movements, invoices, or ledger entries.
- Posted invoice and ledger rows are immutable; corrections use later workflows.

## Phase 2 â€” O2C hardening

User selected scope:

- customer payment policy with COD, PREPAY, and TEMPO modes;
- TEMPO credit-limit hold before SO submission;
- row-level stock-lot locking and a locked re-read before reservation;
- explicit picking and checking confirmation before dispatch;
- POD lines carrying accepted quantity per fulfillment allocation;
- invoice subtotal calculated from accepted POD quantities.

New backend endpoints:

- `POST /api/v1/customers/:id/payment-policies`
- `POST /api/v1/pick-lists/:id/confirm-pick`
- `POST /api/v1/pick-lists/:id/confirm-check`

Additional hardening acceptance:

- SO submission is blocked when no effective customer payment policy exists.
- TEMPO submission is blocked when posted invoice exposure plus the current SO exceeds the configured credit limit.
- Concurrent submissions serialize on each selected stock lot and cannot reserve the same available quantity twice.
- Dispatch is blocked until every pick-list line has been picked and checked at its assigned quantity.
- POD requires one unique line for every allocation and accepts a quantity no greater than the allocation.
- Invoice posting remains idempotent and uses the accepted POD quantity.

## Phase 3 â€” transit and partial-delivery reconciliation

The fulfillment allocation now records `in_transit_quantity`, `accepted_quantity`, and `returned_quantity`. Dispatch moves the allocated quantity into transit. POD must reconcile every allocation so that accepted plus returned equals the dispatched quantity. Returned quantities are put back into the source stock lot and create an auditable `RETURN_FROM_TRANSIT` movement; only accepted quantity contributes to COGS and invoicing.

This closes the previous partial-POD limitation for a single delivery receipt. Multi-drop delivery, replacement shipments, and customer returns remain separate workflows.

## Phase 4 â€” P2P hardening

The backorder handoff now keeps PR coverage and fulfillment separate. PO lines must reference PR lines and cannot exceed the uncovered quantity. Each PO line is linked through `purchase_order_request_allocations`, so split and consolidated procurement can be audited without losing the originating backorder.

Goods Receipt posting now requires an idempotency key, locks the PO, rejects duplicate PO lines and over-receipt, preserves the PO remainder, and updates PO state to `PARTIALLY_RECEIVED` or `COMPLETED`. Received quantity also updates the originating PR fulfillment state. GR posting creates balanced inventory and GRNI ledger entries; retries return the original receipt without duplicating stock movement or ledger rows.

Supplier invoice capture, three-way matching, AP open items, payment approval and settlement remain the next Finance slice after this warehouse-side hardening.

## Phase 5 â€” supplier invoice and AP posting

Supplier invoices are captured against a PO with an external supplier number, invoice/due dates, decimal subtotal/tax/total, and line references to PO lines. The backend rejects duplicate supplier invoice numbers, duplicate idempotency keys, quantities beyond received-not-invoiced balance, and unit prices outside the PO snapshot.

Posting creates a payable open item, increments invoiced PO quantities, and writes balanced GRNI + input-tax + AP ledger entries in one transaction. A posted invoice is immutable and a retry returns the existing posted document. Payment approval, payment execution, settlement allocation, credit notes, and dispute workflows remain outside this slice.

## Phase 6 â€” O2C customer receipts and prepayment gate

Customer receipts now support idempotent posting, optional linkage to a fulfillment batch for PREPAY, and allocation to posted sales invoices. Dispatch checks verified posted receipts linked to the batch before allowing PREPAY fulfillment. Invoice posting initializes AR outstanding and automatically consumes linked prepayments; manual receipt allocation remains available for later settlement. Receipt posting and allocation create balanced cash/advance or advance/AR ledger entries.

Customer returns, quarantine inspection, credit notes, refunds, multi-drop POD, and full AR aging/payment reconciliation remain separate O2C correction and settlement workflows.

## Phase 7 â€” O2C corrections and multi-drop

Fulfillment batches now support multiple POD records. Each POD consumes only the remaining in-transit quantity, and the batch becomes `PARTIALLY_DELIVERED` until all quantities are settled. Sales invoices store a due date and the backend provides an AR aging query.

Customer return receipt requires a quarantine locator and creates a traceable return movement. Credit-note and refund models and commands are present for the finance correction path. Additional integration coverage and production controls remain required before treating this path as production-ready, especially aggregate return/refund limits, source-company validation, approval policy and posted-record concurrency.

## Phase 7 hardening notes â€” 2026-10-01

- Stock allocation explicitly excludes active lots whose locator is `QUARANTINE`.
- Credit-note posting locks the source invoice and rejects an amount above current outstanding AR, preventing a negative invoice balance. A customer-credit balance workflow for fully paid invoices is still outside this slice.
- Repository validation, Prisma schema validation, targeted typechecks, lint, and contract tests pass.
- Database migration deployment and live Prisma integration tests remain environment-blocked when PostgreSQL/Docker is unavailable; the normal binary Prisma engine also needs to be regenerated after the local Windows `EPERM` lock is cleared.

## Financial correction hardening — 2026-10-03

User authorized continuation of O2C completion with the project skill. Priority:
OTC-07 and FIN-01/02/03: split a credit note into AR relief and customer advance
liability (Finance section 5); refund only the liability created by that note.
Keep the minimal ledger architecture and existing API permissions. No visual change.
Acceptance: unpaid, partially paid and paid invoices; concurrent duplicate posting,
refund overrun, changed idempotency payload and tenant/source mismatch rejection.
Remaining coverage: configured approval workflow, payment reversal/reconciliation,
full O2C HTTP scenario and web verification. These remain release gates.

Implementation evidence: `tests/integration/otc-corrections.test.ts` exercises
real PostgreSQL transactions and normal Prisma binary engine, including concurrent
credit-note/refund attempts. Customer credit is derived from immutable
`CUSTOMER_ADVANCE` ledger rows with source `CREDIT_NOTE`; posted refunds consume
that liability. No migration or new API permission is introduced. Prior notes that
paid-invoice credit notes are unsupported are superseded by this correction.
Full O2C is still incomplete: approval policy execution, payment reversal and bank
reconciliation, configurable historical aging, full HTTP flow and web QA remain.
