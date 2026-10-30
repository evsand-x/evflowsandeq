# Invoice and Payment Backend Implementation Plan

> **For agentic workers:** Use subagent-driven-development for the independent payment command and a final review. Steps use checkbox tracking.

**Goal:** Backend Invoice/draft/posting dan penerimaan pembayaran sesuai mockup dan keputusan pengguna.

**Architecture:** Finance services use the existing Prisma transaction, posting and idempotency kernels. Invoice and payment contracts expose form/list/detail and atomic commands; legacy callers retain compatible adapters.

**Tech Stack:** TypeScript, NestJS, Zod, Prisma/PostgreSQL numeric, Vitest.

**Spec:** ../specs/2026-10-30-invoice-payment-backend-design.md

## Global Constraints

Backend only; no preview/mock principals. Preserve working-tree changes. SJ issuedAt + SO TOP for due date. Invoice number editable only before posting. One invoice per SJ. Payment proof and deduction proof are distinct; pending mandatory deduction proof remains AR. No hardcoded tax rates. No commit/push.

## Review Focus

- SJ issued date differs from handover/document/invoice date and company midnight.
- Simultaneous invoice creation or payments and retry with a changed payload.
- Cross-company identifiers and independent invoice/payment permission grants.
- Draft version conflict, posted immutability, closed posting periods.
- Missing mandatory deduction evidence and stale master changes after posting.

## Task 1: Invoice lifecycle and read models

Files: new finance/invoice.ts, invoice-read.ts, invoice.controller.ts, contracts/invoice.ts, integration/invoice-backend.test.ts; modify Prisma schema, otc module/service adapters.

- [x] Write tests for issuedAt due date, editable unique number, create/edit draft version, snapshot, submit AR and one invoice per SJ; run RED.
- [x] Implement saveInvoiceDraft(company, actor, input, key, id?), submitInvoice(company, actor, id, version, key), create-and-post compatibility adapter.
- [x] Implement invoiceList, invoiceDetail, invoiceForm, source candidates and guarded routes; prove filters/permissions/privacy.
- [x] Add additive migration; run targeted tests and typecheck.

## Task 2: Atomic receipt and deduction settlement

Files: new finance/invoice-payment.ts, invoice-payment.controller.ts, contracts/invoice-payment.ts, integration/invoice-payment.test.ts, own additive migration; schema additions scoped to receipt deductions.

- [x] Write failing transaction tests for partial/full payment, duplicate bank ref/retry, overpayment, invalid company/bank/evidence/period and deductions pending proof.
- [x] Implement payment form lookups, receiveInvoicePayment(company, actor, invoiceId, input, key), complete deduction proof command; snapshot decimal calculations and accounts, atomic receipt/allocation/posting/audit.
- [x] Register controller and test grants independently from invoice read access; run targeted tests.

## Task 3: Cross-layer verification and documentation

- [x] Synchronize affected blueprint decision/API/database/flow/design/features sections.
- [x] Review source/reversal compatibility and fix regressions with tests.
- [x] Run backend typecheck, meaningful integration/API checks, full test suite and tools/validate-repository.ps1; report actual results and limitations.

## Progress

2026-10-30: User resolved all material questions. Read mockup invoice list/form/detail/payment. Existing create-from-SJ posts immediately; legacy draft disabled, candidates still Packing List. Payment kernel exists but separate allocation is not atomic with create, and no modern deduction lifecycle exists. Implementation proceeding with existing working-tree dependencies.
2026-10-30: Implemented Invoice draft/submit, SJ-issuedAt + SO TOP due date, editable pre-post number, guarded read models, atomic payment and deduction proof lifecycle, independent price permission, migrations, compatibility adapters, concurrency and real-session API tests. Targeted checks pass. Full suite: 552 passed, 38 unrelated legacy failures across 9 files; see execution report.
