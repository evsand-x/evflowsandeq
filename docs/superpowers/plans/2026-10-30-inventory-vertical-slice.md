# Inventory Vertical Slice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menyediakan backend operasional untuk daftar Persediaan, detail produk, Kartu Stok, dan opname/adjustment minimum sesuai mockup.

**Architecture:** Read model membaca `Product`, `StockLot`, reservation, warehouse/locator, dan `InventoryMovement` dengan agregasi Decimal server-side. Command opname memakai transaksi, lock lot/scope, optimistic version, idempotency, audit/outbox, serta membuat movement adjustment baru tanpa mengubah histori. Controller menjaga permission inventory read dan biaya secara independen.

**Tech Stack:** NestJS, TypeScript, Prisma/PostgreSQL, Zod, Decimal, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-30-inventory-vertical-slice-design.md`

## Global Constraints

- Backend adalah otoritas saldo, mutu, FEFO/FIFO, HPP, periode, permission, approval, audit, dan posting.
- Nilai uang/qty memakai PostgreSQL numeric dan Decimal; API mengirim string desimal.
- Saldo tidak diedit langsung; adjustment selalu membuat movement yang dapat direkonstruksi.
- Data selalu dibatasi company dan scope permission; HPP hanya dengan `inventory.cost.read`.
- Opname/adjustment memakai locking, idempotency, version, approval terpisah, dan audit/outbox.
- Tidak membangun UI frontend, PR/PO baru, GR baru, retur supplier, recall lengkap, pemusnahan, atau konsinyasi pada tahap ini.

## Review Focus

- Expired/hold/recall dan locator non-storage tidak boleh masuk Tersedia atau alokasi.
- Kartu stok harus menghitung saldo awal dan saldo berjalan dengan urutan movement deterministik.
- Tanpa `inventory.cost.read`, nilai HPP/unit cost tidak boleh bocor pada list/detail/card.
- Dua posting opname bersamaan harus menghasilkan satu adjustment dan tidak boleh membuat stok negatif.
- Approval pembuat sendiri, periode tertutup, version stale, dan retry payload berbeda harus ditolak.

### Task 1: Contract, permissions, and read models

**Files:**
- Create: `packages/contracts/src/inventory.ts`
- Create: `packages/backend/src/warehouse/inventory-read.ts`
- Create: `packages/backend/src/warehouse/inventory.controller.ts`
- Modify: `packages/contracts/src/index.ts`, `packages/backend/src/modules/warehouse.module.ts`, `packages/database/prisma/seed.ts`
- Test: `packages/backend/src/warehouse/inventory-read.test.ts`, `tests/integration/inventory-read.test.ts`

- [x] Write failing tests for list filters/counts, detail lot FEFO, stock-card running balance, company isolation, and cost redaction.
- [x] Run the focused tests and verify they fail for missing contracts/read model.
- [x] Implement Zod contracts and read functions `listInventory`, `inventoryDetail`, `stockCard` using Decimal aggregation and deterministic movement ordering.
- [x] Implement guarded routes `/inventory`, `/inventory/:productId`, `/inventory/:productId/stock-card`; keep `inventory.cost.read` independent from inventory read.
- [x] Run focused unit/integration tests and inventory/backend target typecheck; unrelated delivery-note type errors are recorded in the execution report.

### Task 2: Opname and adjustment schema and command

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_inventory_stock_count/`
- Create: `packages/backend/src/warehouse/inventory-stock-count.ts`
- Create: `packages/backend/src/warehouse/inventory-stock-count.controller.ts`
- Test: `packages/backend/src/warehouse/inventory-stock-count.test.ts`, `tests/integration/inventory-stock-count.test.ts`, `tests/integration/inventory-concurrency.test.ts`

- [x] Write failing tests for draft/version, submit/approve/post lifecycle, self-approval rejection, no-reason rejection, closed period, stale version, negative result, idempotent retry, and concurrency.
- [x] Run focused tests and verify RED.
- [x] Add minimal `StockCount`/`StockCountLine` persistence with status, scope snapshot, expected/count quantities, reason, approval/post metadata, version, and idempotency uniqueness.
- [x] Implement `createStockCount`, `updateStockCount`, `submitStockCount`, `approveStockCount`, `postStockCount`; post only delta movements and value journal where configured.
- [x] Register routes and permissions; run migration, generate/validate Prisma, and focused tests.

### Task 3: Cross-layer verification and documentation

**Files:**
- Modify: affected blueprint API/database/requirements/features/flow documents, `docs/superpowers/plans/2026-10-30-inventory-vertical-slice.md`
- Create: `docs/development/inventory-vertical-slice-2026-10-30.md`
- Test: repository validator and target suite

- [x] Synchronize contracts and requirement IDs WH-01/02/03/05, FIN-04, IAM-01/04, CFG-08 where the implementation changes the approved contract.
- [x] Run backend/API typecheck, focused tests, concurrency tests, lint/format checks, `pnpm db:validate`, and `./tools/validate-repository.ps1`.
- [x] Run the full suite once, classify unrelated baseline failures, and record exact totals and limitations.
- [x] Update this plan checkboxes and write the execution report without claiming frontend or deferred Warehouse features complete.

