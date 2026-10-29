# Task 2 report — Surat Jalan domain path

Status: DONE_WITH_CONCERNS — implementation and available static/HTTP/unit checks finished; migration and transactional database proof remain blocked by local PostgreSQL being stopped.

## Approved direction and coverage

Sources: task-2-brief.md, approved 2026-10-29 O2C Release 1 design, blueprint document map and README, repository AGENTS.md and ERP builder skill. Parent confirmed that new SO submission must stop reserving/allocating stock and must bypass legacy Block/PREPAY gates. No new visual or credit policy decisions were introduced.

Scope: submitted SO → editable SJ draft → issued SJ with handover evidence → one atomic stock/revenue/HPP event. Invoice and Office UI are Tasks 3/4. Legacy picking/POD endpoints/data remain available for historical flows.

Requirements served: OTC-01/04/05/08 (SO demand, partial fulfillment/handover), WH-01/02/03/08 (stock, FEFO/FIFO, quality and delivery evidence), FIN-01/02/04/08/12 (balanced journals, unbilled AR, moving average, tax/freight), IAM-01/04 (independent backend grants), NFR-02/09 (transactional consistency, audit/idempotency). Acceptance is the Release 1 override: issued SJ is handover; no separate POD or automatic reservation in the new path.

## Implementation

- Added Prisma DeliveryNote/DeliveryNoteLine, DeliveryNoteState and OutboxEvent with migration `20261029120000_delivery_note`.
- Draft create/update validate OPEN company SO, unique positive lines, cumulative issued quantity, active company warehouse/locator, and frozen source tax/price. Drafts do not affect stock or GL.
- Issue rechecks cumulative per-line quantities under customer/SO/SO-line/SJ locks. Company finance advisory locking and stable stock-row locks serialize valuation and competing issues. Eligibility uses active warehouse/product/locator, AVAILABLE quality, non-expired stock, FEFO/FIFO policy and quantity minus existing reservations. Future/scheduled stock policy versions do not override effective ACTIVE policy.
- Issue validates private SURAT_JALAN evidence, receiver/time, per-line accepted/rejected quantities and discrepancy reason. It snapshots TOP, product identity, delivery address, company identity, freight/tax and handover.
- Issue plans every stock take before writing; writes DISPATCH movements and stock decrements, product moving-average cost snapshots, one balanced source journal (COGS/inventory, unbilled AR/revenue, tax, optional freight), issued document, audit and transactional outbox in the same transactionCommand transaction. Unique source keys protect movement/journal/outbox replay. Same-key altered payload is rejected by existing transactionCommand.
- Issued notes/lines are immutable at service and PostgreSQL trigger levels. Triggers also reject cross-company/SO-line/warehouse/locator mismatches and require handover fields. Existing reviseOrder rejects an SO with issued SJ.
- SO submit now records demand and selected term snapshot only. It does not allocate/reserve, create fulfillment batches or call legacy credit/PREPAY gates. Historical helpers remain for historical endpoints.
- GET/POST `/delivery-notes`, GET/PATCH `/delivery-notes/:id`, POST `/delivery-notes/:id/issue` registered through OtcPtpModule. Read uses `outbound_shipping.read`; mutations use the existing `fulfillment.dispatch` grant. No `delivery_note.*` catalog entries are added.
- Generic private evidence upload/read supports purpose SURAT_JALAN with the same outbound grants; no legacy POD permission is needed.
- API outbound projection excludes costs, unit prices, full source rows and private credit/exposure snapshot data. Internal service aggregate retains full snapshots for Task 3.

## Interfaces for Tasks 3/4

Exports in `packages/backend/src/sales/delivery-note.ts`: createDeliveryNote, updateDeliveryNoteDraft, issueDeliveryNote, getDeliveryNote, listDeliveryNotes, deliveredOrderQuantities; deliveryNoteView is the safe outbound projection.

Snapshot keys: company, products keyed by SO line id, payment (SO term snapshot), freight (SO terms), freight_amount, freight_tax_amount, freight_tax_snapshot, currency, customer_id, sales_order_number, delivery_address. Lines retain quantity, deliveredQuantity, rejectedQuantity, unitPrice, taxSnapshot and costSnapshot. Invoice should use deliveredQuantity and snapshot values from an ISSUED SJ, with unique source enforcement.

Task 4 must adapt legacy SO orderDetail/orderStatusRows/orderActions/related-documents to the new cumulative quantities and notes. Existing legacy projections still derive progress from fulfillment allocations. This dependency was explicitly sent to the coordinator; this task does not claim UI readiness.

## Verification

- TDD initial integration suite failed because the command module was absent. After implementation, database checks stop at connection initialization, before assertions; no transactional success is claimed.
- Pure allocation test was observed RED for the absent planner and GREEN after implementation. It covers exact precision, reservations, warehouse/locator constraints, duplicate stock consumption and shortage before writes.
- Outbound projection test was observed RED for absent projection and GREEN after implementation. It proves no unit price/cost/credit-limit leakage.
- `pnpm test packages/backend/src/sales/delivery-note.test.ts apps/api/test/submenu-permissions.e2e.test.ts packages/backend/src/sales/outbound-read.test.ts`: 3 files, 25 tests passed. HTTP checks include SO-only and Invoice-only principals receiving 403 on all five SJ endpoints.
- `pnpm typecheck`: 11 packages successful, 11 total.
- Targeted ESLint for new service/controller/tests and changed backend/API files: passed.
- Prisma client generation: passed.
- `./tools/validate-repository.ps1`: passed, 22 blueprint documents; no broken links, duplicate IDs, conflicts, malformed tables, stale markers, typos or legacy names.
- `pnpm db:migrate`: attempted; failed because local PostgreSQL is unavailable. A first attempt also lacked worktree env, resolved by copying the existing ignored local workspace .env without displaying values; subsequent attempt reached the configured local target and remained unavailable.
- Latest focused database run: o2c-delivery-note, so-stock-availability, so-command-fields: 3 files / 16 tests failed at database connection initialization. Added integration coverage includes draft/update/issue replay, cumulative issue revalidation after another draft issues, handover, quality, period, isolation, no reservation/legacy credit gate, and rollback of stock/document/ledger/audit/outbox on posting configuration failure. The rollback fixture uses SQL savepoints for each actual domain transaction inside the outer rollback fixture.
- Full `pnpm test` was executed: 41 files passed / 46 failed; 306 tests passed / 105 failed / 116 skipped (527 total). Most failures are unavailable PostgreSQL. Non-DB baseline failures include dashboard-finance/dashboard-hris authorization assumptions, proforma-access metadata/principal assumptions, manual-proforma HTTP fixtures lacking roles, and settings HTTP expectations/dependencies. These areas were not changed to mask the failures. Exact failing names from that run are appended below; full output remains in the ignored task-2-full-test.log.

## Migration and remaining release concerns

1. PostgreSQL service is stopped. Coordinator attempted Docker and Windows service startup, but Docker returned an engine error and service control lacked permission. Migration SQL, triggers, DB persistence/rollback, real concurrent competing issues and browser flow remain unverified. Run migration and focused DB tests once PostgreSQL is available.
2. Existing legacy integration suites that require submit to reserve stock must be migrated to explicit historical fixtures or new Release 1 assertions. The affected expectations in so-command-fields were updated for the new behavior. Full DB-backed regression remains blocked, so additional legacy expectation failures may surface after startup.
3. Outbox events are durably written; no external notification/relay consumer was introduced because this task has no external side effect. Existing worker does not yet dispatch this new event.
4. No production seed or balance edit was introduced. Moving average normalization redistributes the existing product book value across physical lots before issue under the company finance and stock locks; dispatch movement records preserve source cost.
5. Migration is additive. Forward-fix is preferred if posted documents exist; do not drop posted sources/outbox/journal data. Before first use, rollback can remove the new unused tables/functions/type after confirming all are empty.
6. No blueprint product rule changed beyond the Task 1 approved contract; coordinator owns reconciliation of remaining active legacy prose. This report records implementation/API/evidence-purpose details.

## Exact failures from the full-suite run

```text
 FAIL  tests/integration/access-workspace.test.ts > access workspace persistence and privacy
 FAIL  tests/integration/crm.test.ts > CRM contacts and prospects
 FAIL  tests/integration/dashboard.test.ts > Dashboard scope and CRM follow-up
 FAIL  tests/integration/foundation.database.test.ts > foundation database
 FAIL  tests/integration/master-data.test.ts > master data persistence
 FAIL  apps/api/test/login-selection.e2e.test.ts > Multi-company login selection
 FAIL  apps/api/test/milestone-one.e2e.test.ts > Milestone 1 identity and setting
 FAIL  tests/integration/accounts.test.ts > account workspace
 FAIL  tests/integration/dashboard-sales.test.ts > Sales dashboard live prospect schedule
 FAIL  tests/integration/dashboard-warehouse.test.ts > Warehouse dashboard scope and source availability
 FAIL  tests/integration/manual-proforma.test.ts [ tests/integration/manual-proforma.test.ts ]
 FAIL  tests/integration/operational-tax.test.ts > operational tax master
 FAIL  tests/integration/otc-controls.test.ts [ tests/integration/otc-controls.test.ts ]
 FAIL  tests/integration/otc-corrections.test.ts [ tests/integration/otc-corrections.test.ts ]
 FAIL  tests/integration/sales-order-advance.test.ts [ tests/integration/sales-order-advance.test.ts ]
 FAIL  apps/api/test/crm-flow.e2e.test.ts > CRM first operational flow HTTP
 FAIL  tests/integration/account-reversal.test.ts > inactive historical accounts permit only an exact reversal, never new or altered postings
 FAIL  tests/integration/chart-of-accounts-import.test.ts > chart of accounts import > restores the exported chart exactly
 FAIL  tests/integration/chart-of-accounts-import.test.ts > chart of accounts import > maps posting accounts to the imported codes
 FAIL  tests/integration/chart-of-accounts-import.test.ts > chart of accounts import > is idempotent
 FAIL  tests/integration/company-defaults.test.ts > company defaults provisioning > creates every catalog policy and numbering kind for a new company
 FAIL  tests/integration/company-defaults.test.ts > company defaults provisioning > is idempotent
 FAIL  tests/integration/company-defaults.test.ts > company defaults provisioning > skips kinds that already have an active rule
 FAIL  tests/integration/company-defaults.test.ts > company defaults provisioning > never overwrites an edited policy
 FAIL  tests/integration/company-defaults.test.ts > company defaults provisioning > audits what it created
 FAIL  tests/integration/customer-credit-attributes.test.ts > customer credit attributes > edits credit fields only with customer_credit.update
 FAIL  tests/integration/customer-credit-attributes.test.ts > customer credit attributes > copies active payment policies
 FAIL  tests/integration/customer-credit-attributes.test.ts > customer credit attributes > credit check reads customer attributes
 FAIL  tests/integration/customer-credit-attributes.test.ts > customer credit attributes > customer without default term submits as COD
 FAIL  tests/integration/customer-credit-attributes.test.ts > customer credit attributes > tempo default term without credit limit is allowed
 FAIL  tests/integration/customer-credit-attributes.test.ts > customer credit attributes > state change response hides credit fields without customer_credit.update
 FAIL  tests/integration/deduction-types.test.ts > deduction types > provisions four default deduction types
 FAIL  tests/integration/deduction-types.test.ts > deduction types > skips a default whose account is inactive
 FAIL  tests/integration/deduction-types.test.ts > deduction types > rejects header or inactive account
 FAIL  tests/integration/deduction-types.test.ts > deduction types > requires a proof type when proof is required, and a unique name
 FAIL  tests/integration/deduction-types.test.ts > deduction types > edits a type whose account became inactive without changing the account
 FAIL  tests/integration/deduction-types.test.ts > deduction types > deactivates a type whose account became inactive
 FAIL  tests/integration/deduction-types.test.ts > deduction types > stale edit returns 412 and edits are audited
 FAIL  tests/integration/default-sales-tax.test.ts > default sales tax > uses the default sales tax without a per-pair rule
 FAIL  tests/integration/default-sales-tax.test.ts > default sales tax > only one default sales tax
 FAIL  tests/integration/default-sales-tax.test.ts > default sales tax > refuses a default sales tax that cannot apply to sales and keeps the default active
 FAIL  tests/integration/default-sales-tax.test.ts > default sales tax > snapshot survives rate change
 FAIL  tests/integration/default-sales-tax.test.ts > default sales tax > provisions PPN Penjualan and PPN Masukan from the imported chart, idempotently
 FAIL  tests/integration/default-sales-tax.test.ts > default sales tax > rejects a per-line tax id on create
 FAIL  tests/integration/default-sales-tax.test.ts > default sales tax > rejects a non-PPN tax as default
 FAIL  tests/integration/default-sales-tax.test.ts > default sales tax > copies tax master grants to Setting > Pajak one to one
 FAIL  tests/integration/default-sales-tax.test.ts > default sales tax > serves the WAPU/PPh rule customer list to the old receipt-rule permission
 FAIL  tests/integration/discount-limit.test.ts > discount limit settings > lets only Admin Sistem set role and person limits, even for a discount_limit.manage holder
 FAIL  tests/integration/discount-limit.test.ts > discount limit settings > resolves person, role, product cap and admin through /me
 FAIL  tests/integration/discount-limit.test.ts > discount limit settings > changes a product cap only with discount_limit.manage
 FAIL  tests/integration/final-review-migration.test.ts > stage 2b final-review data migration > moves unedited PPh 22 to 1-10501, spares edited rows, and folds tolerance into grace
 FAIL  tests/integration/o2c-delivery-note.test.ts > Release 1 Surat Jalan > keeps drafts free of stock and ledger effects, updates, issues once and preserves snapshots
 FAIL  tests/integration/o2c-delivery-note.test.ts > Release 1 Surat Jalan > rejects cumulative excess, invalid handover and insufficient eligible stock without posting
 FAIL  tests/integration/o2c-delivery-note.test.ts > Release 1 Surat Jalan > rejects closed periods and cross company reads
 FAIL  tests/integration/operational-tax-posting.test.ts > posts frozen master tax to its selected account and records metadata without reposting
 FAIL  tests/integration/order-actions.test.ts > warehouse grants do not expose finance actions and blocked invoice explains checking
 FAIL  tests/integration/order-actions.test.ts > actions isolate company and retain explicit disabled state
 FAIL  tests/integration/order-related-documents.test.ts > omits DP from the SO list without receipt or advance permission
 FAIL  tests/integration/order-related-documents.test.ts > each warehouse document requires its own submenu read and links to its own page
 FAIL  tests/integration/order-related-documents.test.ts > detail omits financial facts and private snapshots for warehouse-only user
 FAIL  tests/integration/order-related-documents.test.ts > lists invoice issued from packing list before POD
 FAIL  tests/integration/order-related-documents.test.ts > omits invoices and advances for warehouse-only user
 FAIL  tests/integration/order-related-documents.test.ts > computes proforma status without per-document transactions
 FAIL  tests/integration/order-related-documents.test.ts > neighbors follow order date then number
 FAIL  tests/integration/sales-order-advance-migration.test.ts > advance migration copies only receipt-post grants with their scopes and audit
 FAIL  tests/integration/sales-order-advance-prepay.test.ts > SO advance funds for prepay > includes verified unbound SO funds and legacy batch receipts exactly once
 FAIL  tests/integration/sales-order-advance-prepay.test.ts > SO advance funds for prepay > binds required SO receipts and prevents reuse by another batch
 FAIL  tests/integration/sales-order-advance-prepay.test.ts > SO advance funds for prepay > does not bind extra receipts when batch funds already suffice
 FAIL  tests/integration/sales-order-advance-prepay.test.ts > SO advance funds for prepay > does not treat a pending advance as a posted receipt
 FAIL  tests/integration/sales-order-print-duplicate.test.ts > migration grants print only to existing readers and audits scope
 FAIL  tests/integration/sales-order-print-duplicate.test.ts > print audit belongs to scoped SO and actor
 FAIL  tests/integration/sales-order-print-duplicate.test.ts > duplicate creates fresh draft without reference, evidence, prices or old allocations
 FAIL  tests/integration/so-command-fields.test.ts > SO commands persist selected fields and isolate stock > submits demand without reservations or legacy credit gates
 FAIL  tests/integration/so-command-fields.test.ts > SO commands persist selected fields and isolate stock > does not complete undelivered allocations when the shortage is closed
 FAIL  tests/integration/so-command-fields.test.ts > SO commands persist selected fields and isolate stock > lists business dates and status tabs consistently with filtered totals and exact search
 FAIL  tests/integration/so-command-fields.test.ts > SO commands persist selected fields and isolate stock > creates minimally, replays once, revises fields, snapshots selected term and only allocates selected warehouse
 FAIL  tests/integration/so-command-fields.test.ts > SO commands persist selected fields and isolate stock > rejects a removed term at draft submission and rechecks mandatory reference
 FAIL  tests/integration/so-command-fields.test.ts > SO commands persist selected fields and isolate stock > supports line warehouse override and legacy unscoped orders
 FAIL  tests/integration/so-header-fields.test.ts > SO header defaults and isolation > defaults address, salesperson and sole active warehouse and allows an old business date
 FAIL  tests/integration/so-header-fields.test.ts > SO header defaults and isolation > requires reference and evidence only when configured
 FAIL  tests/integration/so-header-fields.test.ts > SO header defaults and isolation > rejects unknown terms and foreign salesperson or warehouse
 FAIL  tests/integration/so-header-fields.test.ts > SO header defaults and isolation > does not silently choose between warehouses and honors configured default
 FAIL  tests/integration/so-header-fields.test.ts > SO header defaults and isolation > only permits line warehouses when enabled
 FAIL  tests/integration/so-policy-migration.test.ts > seeds editable SO defaults once without replacing an existing choice
 FAIL  tests/integration/so-stock-availability.test.ts > SO stock availability and form options > splits sellable stock and other locators without modifying reservation
 FAIL  tests/integration/so-stock-availability.test.ts > SO stock availability and form options > retains precision and excludes expired, unavailable and foreign warehouse stock
 FAIL  tests/integration/so-stock-availability.test.ts > SO stock availability and form options > rejects unknown or foreign ids rather than returning cross-company data
 FAIL  tests/integration/so-stock-availability.test.ts > SO stock availability and form options > returns zero for products with no stock and deduplicates product ids
 FAIL  tests/integration/so-stock-availability.test.ts > SO stock availability and form options > reads defaults and exposes only active salesperson identity and closed period date
 FAIL  tests/integration/submenu-migration.test.ts > submenu permission migration > preserves scopes, audits mappings, leaves empty roles empty and retains admin sessions
 FAIL  tests/integration/term-in-use.test.ts > Termin & Kredit: terms used by customers > refuses to remove or recode a term used by customers, and allows unused changes
 FAIL  tests/integration/admin-approval.test.ts > allows Admin Sistem to approve their own unassigned purchase request
 FAIL  tests/integration/company-defaults.test.ts > retired catalog policies > hides policies removed from the catalog
 FAIL  tests/integration/order-status-query.test.ts > SO display-status SQL parity on PostgreSQL > partitions company orders with the same per-line rules and pending exception lifecycle
 FAIL  tests/integration/policy-and-period-helpers.test.ts > shared policy value > excludes an ACTIVE version before its effective date and accepts an undated one
 FAIL  tests/integration/policy-and-period-helpers.test.ts > shared policy value > reads the latest effective ACTIVE version and excludes retired/future values
 FAIL  tests/integration/policy-and-period-helpers.test.ts > shared policy value > returns null for missing or another company's policy
 FAIL  tests/integration/policy-and-period-helpers.test.ts > shared policy value > preserves false and JSON null rather than inventing a default
 FAIL  tests/integration/policy-and-period-helpers.test.ts > finance period guards > allows dates within exactly one OPEN period including both boundaries
 FAIL  tests/integration/policy-and-period-helpers.test.ts > finance period guards > rejects CLOSED periods and reports their warning state
 FAIL  tests/integration/policy-and-period-helpers.test.ts > finance period guards > rejects missing periods and ignores another company's period
 FAIL  tests/integration/policy-and-period-helpers.test.ts > finance period guards > rejects overlapping periods even when both are OPEN
 FAIL  tests/integration/settings-numbering.test.ts > numbering settings revision > revision keeps the running counter
 FAIL  tests/integration/settings-numbering.test.ts > numbering settings revision > replays the same idempotency key
 FAIL  tests/integration/settings-numbering.test.ts > numbering settings revision > default rule yields Prefix.Year.Month.Sequence
 FAIL  tests/integration/settings-numbering.test.ts > numbering settings revision > monthly reset restarts next month
 FAIL  tests/integration/settings-numbering.test.ts > numbering settings revision > yearly reset continues across months
 FAIL  tests/integration/settings-numbering.test.ts > numbering settings revision > reset change waits for the next period
 FAIL  tests/integration/settings-numbering.test.ts > numbering settings revision > rejects digits below the running counter
 FAIL  tests/integration/settings-numbering.test.ts > numbering settings revision > prefix change keeps the counter
 FAIL  tests/integration/settings-numbering.test.ts > numbering settings revision > prefix edit keeps the scheduled reset change
 FAIL  tests/unit/dashboard-finance.test.ts > Finance dashboard access and unavailable sources > rejects unrelated, narrow and cross-company grants, regardless of role name
 FAIL  tests/unit/dashboard-hris.test.ts > Hris dashboard access and unavailable sources > rejects unrelated, narrow and cross-company grants, regardless of role name
 FAIL  tests/unit/proforma-access.test.ts > Proforma access boundaries > accepts sales read without warehouse read and passes validated search
 FAIL  tests/unit/proforma-access.test.ts > Proforma access boundaries > requires sales read for detail
 FAIL  apps/api/test/manual-proforma.e2e.test.ts > manual proforma HTTP authorization > denies preview and issuance for submit-only
 FAIL  apps/api/test/manual-proforma.e2e.test.ts > manual proforma HTTP authorization > denies preview and issuance for self
 FAIL  apps/api/test/manual-proforma.e2e.test.ts > manual proforma HTTP authorization > denies preview and issuance for foreign
 FAIL  apps/api/test/manual-proforma.e2e.test.ts > manual proforma HTTP authorization > requires a session and an idempotency key; forwards scoped authorized issuance
 FAIL  apps/api/test/settings.e2e.test.ts > settings HTTP authorization > lists numbering for readers
 FAIL  apps/api/test/settings.e2e.test.ts > settings HTTP authorization > preferences returns number format for any session
```
