# Delivery Note Form Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the Surat Jalan backend accept, validate, persist, and return the operational fields shown by the Office mockup while preserving Release 1 posting and immutability rules.

**Architecture:** Extend the existing DeliveryNote aggregate and command contracts. Store queryable draft identity/transport fields as typed columns; keep address, commercial terms, freight, and issued form data in versioned snapshots. Reuse the existing transaction command, permission guards, stock allocation, posting, audit, and idempotency paths.

**Tech Stack:** NestJS, Zod, Prisma, PostgreSQL numeric/date types, Jest integration tests.

**Spec:** `docs/superpowers/specs/2026-10-29-delivery-note-form-backend-design.md`

## Global Constraints

- Surat Jalan terbit tetap menjadi event serah terima, stok, pendapatan, dan HPP.
- Satu SO mendukung Surat Jalan kumulatif sampai jumlah pesanan; Invoice hanya dari Surat Jalan terbit.
- Tidak ada grant `delivery_note` baru; gunakan `outbound_shipping.*` dan `fulfillment.dispatch`.
- Nilai uang/kuantitas memakai decimal PostgreSQL dan validasi decimal; tidak memakai JavaScript `number` untuk nilai bisnis.
- Record terbit immutable dan semua command memakai transaksi, audit, serta idempotensi.
- Data lintas perusahaan ditolak oleh service dan constraint database.

## Review Focus

- Nomor Surat Jalan duplikat atau diubah setelah terbit — contract/service test.
- Tanggal dokumen/pengiriman invalid atau berada di periode finance tertutup — contract/issue test.
- Gudang form tidak cocok dengan baris atau perusahaan — service/integration test.
- Ongkir negatif atau snapshot komersial berubah setelah terbit — contract/posting test.
- Retry create/update/issue tidak menggandakan dokumen atau posting — idempotency integration test.

### Task 1: Extend contracts and database model

**Files:**
- Modify: `packages/contracts/src/otc-ptp.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_delivery_note_form/migration.sql`
- Test: `tests/integration/o2c-delivery-note.test.ts`

**Interfaces:**
- Produce `CreateSuratJalanInput` fields for document date, ship date, warehouse, transport metadata, and optional freight amount.
- Produce typed `DeliveryNote` fields consumed by service/view.

- [ ] Add strict Zod fields with ISO date validation, bounded text, UUID warehouse, non-negative decimal freight, and preserve the existing line uniqueness checks.
- [ ] Add nullable typed Prisma columns for document date, ship date, warehouse id, carrier, vehicle, driver, and decimal freight amount; add company-scoped warehouse foreign key/index.
- [ ] Write failing contract/integration assertions for accepted payloads and rejected invalid/duplicate values.
- [ ] Add a forward-only migration with backfill-safe nullable columns and database checks for non-negative freight.
- [ ] Run the focused delivery-note tests and confirm the new assertions fail before service changes.

### Task 2: Persist and validate draft form fields

**Files:**
- Modify: `packages/backend/src/sales/delivery-note.ts`
- Modify: `packages/backend/src/sales/delivery-note.controller.ts` only if request mapping needs explicit fields
- Test: `tests/integration/o2c-delivery-note.test.ts`

**Interfaces:**
- `createDeliveryNote` and `updateDeliveryNoteDraft` persist the new typed fields and refresh the draft snapshot.
- `deliveryNoteView` returns the new fields and snapshot-derived address/payment/freight data.

- [ ] Validate the root warehouse belongs to the active company and is active.
- [ ] Apply the root warehouse to lines when line warehouse is omitted; reject a line warehouse that conflicts with the form warehouse.
- [ ] Accept a caller-supplied document number only when unique within company and keep generated numbering as the default.
- [ ] Persist document/ship dates as dates, transport metadata as trimmed bounded strings, and freight as Decimal.
- [ ] Keep delivery address, TOP, product, and freight tax snapshots sourced from the SO/company/policy path; do not hardcode tax rates.
- [ ] Add success, cross-company, warehouse mismatch, number collision, and idempotent retry tests.

### Task 3: Preserve issued snapshot and posting behavior

**Files:**
- Modify: `packages/backend/src/sales/delivery-note.ts`
- Modify: `packages/database/prisma/migrations/<timestamp>_delivery_note_form/migration.sql` if trigger/check coverage is needed
- Test: `tests/integration/o2c-delivery-note.test.ts`

**Interfaces:**
- `issueDeliveryNote` snapshots the form fields and continues to post the existing ledger entries using Decimal values.

- [ ] Include document date, ship date, warehouse, transport metadata, and freight in the handover snapshot.
- [ ] Keep finance-period validation based on the actual handover event and preserve existing stock/HPP allocation.
- [ ] Ensure issued records reject update/delete and that retry returns the idempotent result without duplicate ledger/outbox rows.
- [ ] Add tests for issued response fields, snapshot immutability, closed-period rejection, and repeated issue.

### Task 4: Synchronize API documentation and verification evidence

**Files:**
- Modify: `docs/erp-blueprint/04-api.md`
- Modify: `docs/erp-blueprint/03-database.md`
- Modify: `docs/development/o2c-backend-remediation-2026-10-05.md` or a new dated implementation note if that file is unrelated
- Test: `tests/integration/o2c-invoice-from-delivery-note.test.ts`

- [ ] Document the create/update/get payload and response fields, ownership, permissions, idempotency, and snapshot rules.
- [ ] Document the migration and typed columns without inventing new business policy.
- [ ] Verify Invoice creation still accepts only an issued Surat Jalan and one invoice per delivery note.
- [ ] Run focused tests, repository validation, and report any pre-existing failures separately.
