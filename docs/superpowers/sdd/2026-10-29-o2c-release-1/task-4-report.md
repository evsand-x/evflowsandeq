# Task 4 — Office navigation and Surat Jalan screen review

Date: 29 October 2026

## Scope

- Added the operational `/operations/delivery-notes` route with list, draft-from-Sales-Order, detail, issue and invoice handoff states.
- Kept server permissions authoritative: `outbound_shipping.read`, `fulfillment.dispatch`, and `sales_invoice.post` gate the corresponding actions.
- Simplified outbound navigation to expose Surat Jalan and Retur while hiding unfinished picking, checking, packing and POD actions.
- Added cumulative remaining-quantity display using Decimal arithmetic and focused Vitest coverage.
- Corrected root navigation links that still targeted the legacy warehouse shipping screen.

## Files

`apps/office/app/operations/[[...path]]/page.tsx`, `outbound.tsx`, `sales-experience.tsx`, `sales-order-detail.tsx`, `surat-jalan.tsx`, `surat-jalan-utils.ts`, `surat-jalan.test.ts`, `workspace.tsx`, and `apps/office/app/dashboard-sidebar.tsx`.

## Verification

- `pnpm exec vitest run apps/office/app/operations/surat-jalan.test.ts` — 2 passed.
- `pnpm --filter @evflow/office typecheck` — exit 0.
- `git diff --check` — clean.
- Repository validation was run before finalization; any validator output is reported with the parent task result.

## Deferred evidence

Browser/session verification of the full SO → Surat Jalan → Invoice path remains part of the release gate; this task only finalizes the Office route and its focused checks.
