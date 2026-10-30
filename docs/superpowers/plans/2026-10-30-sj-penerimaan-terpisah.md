# Surat Jalan Receipt Separation Implementation Plan

> **For agentic workers:** Use executing-plans to implement task-by-task.

**Goal:** Terbitkan SJ langsung; catat penerimaan lewat detail tanpa posting ulang.
**Architecture:** Existing issue transaction posts stored draft quantities; separate immutable receipt aggregate with company scope, row lock, idempotency, audit and outbox.
**Tech Stack:** NestJS, Prisma/PostgreSQL, Zod, Next.js/React, TanStack Query.
**Spec:** ../specs/2026-10-30-sj-penerimaan-terpisah-design.md

## Constraints and review focus

Preserve issued sources, historical handovers, independent submenu permissions, invoice quantities/due dates and exact decimals. Reject duplicate or cross-company receipts, stale issue payloads and receipt quantities outside issued lines. No financial effects from receipt discrepancies.

## Tasks

- [x] Backend: add failing issue/receipt regression tests using local rollback fixtures; split Zod contracts; add receipt table/immutable trigger and relax only issue handover requirement; implement receipt command/projection/controller and test rejection/idempotency/no-posting.
- [x] Office: issue saved draft directly; move handover form to receipt dialog in issued detail; show receipt identity, proof and quantities; preserve permissions, pending/error behavior and invalidate list/detail; update conflicting copy.
- [x] Synchronize blueprint 00/README/02–08/10–12/15 and development evidence; migrate local DB, build, run targeted integration/auth tests and repository validation; inspect operational browser if available.

Work in existing workspace because this feature depends on uncommitted SJ/invoice implementation. Preserve unrelated work; no commits requested. Execute inline; user approved the material behavior in conversation.

## Verification outcome

51 tests passed; API build and Office typecheck passed. Browser draft controls measured; successful receipt dialog/narrow viewport QA pending because active demo company has no issued SJ and its draft has zero eligible stock. See docs/development/sj-penerimaan-terpisah-2026-10-30.md.
