# SO Mudah — Bagian 3: Matrix Hak Akses Pohon, Lihat Harga, dan Data Milik Sales Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Matrix hak akses berbentuk pohon centang seperti Kledo yang dilayani katalog berlabel dari backend, ditambah izin **Lihat harga** (server tidak mengirim harga) dan **Data milik sales lain** (server memfilter dokumen penjualan menurut isian Sales).

**Architecture:** Pohon izin didefinisikan sekali sebagai registry di `@evflow/contracts` (modul → submenu → tindakan + batasan data, label Indonesia, urutan) dan disajikan `GET /permissions/tree`; test memastikan setiap kode katalog DB terpetakan. Batasan data memakai **kode izin** baru (`sales_price.read`, `sales_data.others`) — bukan `scope_type` — sehingga guard yang hanya menerima cakupan perusahaan tidak berubah. Redaksi harga dan filter pemilik diterapkan di server dengan helper bersama. Simpan matrix memakai perubahan delta berversi.

**Tech Stack:** Prisma/PostgreSQL, backend `packages/backend`, zod `@evflow/contracts`, Next.js Office, vitest dengan Postgres nyata.

**Spec:** [docs/superpowers/specs/2026-10-25-so-mudah-design.md](../specs/2026-10-25-so-mudah-design.md) (bagian Matrix hak akses). **Bergantung pada:** [bagian 1](2026-10-25-so-mudah-bagian-1.md) (`SalesOrder.salespersonId`), [bagian 2](2026-10-25-so-mudah-bagian-2.md) (endpoint `/related`, `/actions`, izin `sales_order.print`, `sales_order_advance.*`).

## Global Constraints

- Semua Global Constraints bagian 1 berlaku.
- Izin per submenu independen; centang induk/Pilih Semua mengubah anak satu per satu dan tidak pernah menyimpan grant induk.
- Admin Sistem tetap penuh; matrix Admin Sistem tidak dapat diubah.
- Semua pengaturan akses berada di peran; tidak ada override per pengguna. Pengguna dengan beberapa peran memperoleh gabungan izin.
- Tanpa `sales_price.read`, harga/nilai **tidak dikirim server** — bukan disembunyikan layar.
- Tanpa `sales_data.others`, dokumen penjualan milik sales lain tidak dikirim di daftar, detail, hitungan, dan dokumen terkait; akses langsung menghasilkan 404.
- Izin baru hanya diberikan migration kepada peran yang hari ini sudah dapat melakukan hal tersebut; setiap pemberian diaudit dan tampil di Riwayat peran.

**Keputusan pembangun dalam rencana ini (dicatat untuk pengguna):**
- "Akses data milik pengguna lain" dan "Data milik sales lain" digabung menjadi satu centang **Data milik sales lain**, karena pengguna menetapkan pemilik keduanya = isian Sales.
- Pilihan **bawahan** belum dibangun di bagian ini: evflow belum memiliki Struktur Organisasi (karyawan, jabatan, atasan). Registry menyiapkan node `sales_data.subordinates` tersembunyi; [bagian 3b](2026-10-25-so-mudah-bagian-3b-struktur-organisasi.md) membangun Struktur Organisasi dan mengaktifkannya.
- Laporan/ekspor penjualan belum ada di kode (`reports.service.ts` mengembalikan "unavailable"); aturan harga dan pemilik dicatat di blueprint untuk diterapkan saat laporan dibangun.

## Review Focus

1. **Pengguna dengan dua peran** (satu tanpa Lihat harga, satu dengan): harga terkirim (gabungan izin). Test di Task 3.
2. **Akses langsung SO milik sales lain** lewat URL detail, `/related`, `/actions`, dokumen, invoice: 404, bukan 403 yang membocorkan keberadaan. Test di Task 4.
3. **Snapshot dokumen** (proforma, packing list, surat jalan, invoice) yang menyimpan harga di JSON: harga juga dihapus dari snapshot. Test di Task 3.
4. **Dua admin menyimpan matrix peran yang sama bersamaan**: penyimpanan kedua ditolak konflik. Test di Task 5.
5. **Kode izin di DB yang tidak ada di registry**: test gagal, bukan tampil di "Fitur lain". Test di Task 1.

---

### Task 1: Registry pohon izin dan endpoint pohon

**Files:**
- Create: `packages/contracts/src/permission-tree.ts` (diekspor dari `packages/contracts/src/index.ts`)
- Modify: `packages/backend/src/identity/access.controller.ts:244`, `packages/backend/src/identity/access.service.ts:561-572`
- Test: `tests/integration/permission-tree.test.ts`

**Interfaces:**
- Produces: `type PermissionTreeNode = { key: string; label: string; kind: "module" | "submenu" | "action" | "data_limit"; code?: string; hidden?: boolean; children?: PermissionTreeNode[] }`; `permissionTree: PermissionTreeNode[]`; `retiredPermissionCodes: readonly string[]`; `permissionTreeCodes(): string[]`.
- Isi awal registry = susunan `navigation` di `apps/office/lib/access-matrix-navigation.ts:12-99` dan label `apps/office/lib/iam.ts:49-157`, dipindah ke contracts; setiap submenu hanya memuat tindakan yang kodenya ada. Label tindakan: Lihat, Buat, Ubah, Hapus, Ajukan, Setujui, Posting, Batalkan, Cetak, Ekspor, dan label khusus per kode (mis. `sales_order.close_remainder` "Tutup sisa", `sales_order_advance.create` "Catat uang muka", `sales_order_advance.verify` "Verifikasi uang muka"). Node `data_limit` di modul Sales & Marketing: `sales_price.read` "Lihat harga", `sales_data.others` "Data milik sales lain", `sales_data.subordinates` "Data milik bawahan" (`hidden: true`).
- Produces: `GET /permissions/tree` (`permission.read`) → `{ tree: PermissionTreeNode[] }` tanpa node `hidden`, dengan `permissionId` DB pada setiap node yang punya `code`.

- [ ] **Step 1: Write the failing tests**
  - `every catalog permission code is in the tree or retired` (Review Focus 5).
  - `tree codes all exist in catalog`.
  - `submenus list only existing actions`.
  - `hidden nodes are not served`.
  - `tree endpoint requires permission.read`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/permission-tree.test.ts` → FAIL.
- [ ] **Step 3: Implement** registry dan endpoint.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(iam): labelled permission tree registry and endpoint`

### Task 2: Kode izin batasan data dan migrasi pemberian

**Files:**
- Create: `packages/database/prisma/migrations/20261025300000_sales_data_limits/migration.sql`
- Modify: `packages/database/prisma/seed.ts:74-196` (tuple baru)
- Test: `tests/integration/sales-data-limit-migration.test.ts` (pola `tests/integration/submenu-migration.test.ts`)

**Interfaces:**
- Produces (izin): `sales_price.read` (resource `sales_price`, action `read`), `sales_data.others` (resource `sales_data`, action `others`), `sales_data.subordinates` (resource `sales_data`, action `subordinates`, tidak diberikan ke siapa pun).
- Migration: beri `sales_price.read` dan `sales_data.others` (cakupan `company`) kepada setiap peran yang hari ini memegang salah satu dari `sales_order.read`, `sales_order.create`, `proforma.read`, `sales_invoice.read` (hari ini mereka melihat harga dan semua SO). Tulis `AuditEvent` `role.permissions_migrated` per peran dengan daftar kode dan alasan "Izin baru: mempertahankan akses yang sudah ada". Cabut sesi anggota peran terdampak (pola migrasi 16 Oktober). Admin Sistem tidak disentuh.

- [ ] **Step 1: Write the failing tests**
  - `grants both codes to roles holding sales read or create`.
  - `does not grant to roles without sales access`.
  - `writes one audit event per affected role`.
  - `leaves admin role untouched and grants no subordinates code`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/sales-data-limit-migration.test.ts` → FAIL.
- [ ] **Step 3: Implement** migration dan seed.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(iam): sales price and sales data permissions with preserving migration`

### Task 3: Redaksi harga di server

**Files:**
- Create: `packages/backend/src/sales/price-visibility.ts`
- Modify: `packages/backend/src/sales/operations.controller.ts` dan `operations.service.ts` (list orders ~403, order ~692, related & actions bagian 2, lists/proformas 307-401, proforma 656, proforma-preview 91/96, batch 738, lists/warehouse & pick-slips ~485-549, lists/invoices ~550-622, invoice 783, documents 714), `packages/backend/src/sales/outbound-read.ts:82-156`, `packages/backend/src/otc-ptp.controller.ts` (invoice-candidates 137; create/revise/duplicate SO), `packages/backend/src/master/customer-workspace.ts:131`
- Test: `tests/integration/sales-price-visibility.test.ts`

**Interfaces:**
- Produces: `canSeeSalesPrice(auth: AuthPrincipal): boolean` (memakai `hasCompanyPermission(auth, "sales_price.read")` dari `administration/setting-permissions.ts:28`; Admin Sistem `true`).
- Produces: `redactSalesAmounts<T>(value: T, canSee: boolean): T` — bila `!canSee`, hapus secara rekursif kunci: `unitPrice`, `unit_price`, `priceSnapshot`, `price_snapshot`, `subtotal`, `taxAmount`, `tax`, `total`, `amounts`, `amount`, `freightAmount`, `freightTaxAmount`, `freightTaxSnapshot`, `freight`, `freightEstimate`, `value`, `outstandingAmount`, `remainingBill`, `downPayment`, `verifiedFunds`, termasuk di dalam `snapshot`. Kuantitas, nomor, tanggal, status tidak dihapus.
- Create/revise/duplicate SO mensyaratkan tambahan `sales_price.read`; tanpa itu 403.

- [ ] **Step 1: Write the failing tests**
  - Untuk pengguna tanpa `sales_price.read` (dengan izin baca masing-masing): daftar SO, detail SO, `/related`, daftar & detail proforma, preview proforma, batch gudang, daftar outbound, dokumen PACKING/SURAT_JALAN/INVOICE, daftar & detail invoice, invoice-candidates, penjualan pelanggan → tidak ada kunci terlarang di JSON (pencarian rekursif) (Review Focus 3).
  - `user with two roles where one grants price sees prices` (Review Focus 1).
  - `create SO without sales_price.read` → 403.
  - `admin sees prices`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/sales-price-visibility.test.ts` → FAIL.
- [ ] **Step 3: Implement** helper dan penerapannya di setiap endpoint di atas.
- [ ] **Step 4: Run** test baru + `tests/unit/proforma-access.test.ts` + `tests/integration/otc-controls.test.ts` → PASS.
- [ ] **Step 5: Commit** `feat(sales): server-side price redaction without sales_price.read`

### Task 4: Filter data milik sales

**Files:**
- Create: `packages/backend/src/sales/sales-ownership.ts`
- Modify: `packages/backend/src/sales/operations.service.ts` (list orders + summary 403-483, order 692, related/actions bagian 2, lists/proformas, proforma, lists/invoices, invoice, documents), `packages/backend/src/sales/order-status.ts` (hitungan tab bagian 1), `packages/backend/src/master/customer-workspace.ts:131`
- Test: `tests/integration/sales-ownership-scope.test.ts`

**Interfaces:**
- Produces: `salesOwnerFilter(auth: AuthPrincipal): { salespersonId: string } | null` — `null` bila memegang `sales_data.others` atau Admin Sistem; selain itu `{ salespersonId: auth.user_id }`.
- Produces: `assertSalesOwnerAccess(auth: AuthPrincipal, order: { salespersonId: string | null; createdById: string }): void` — `NotFoundException` bila filter aktif dan pemilik (`salespersonId ?? createdById`) berbeda.
- Penerapan: SO langsung; Proforma/Invoice/dokumen lewat SO induk; hitungan tab dan `summary` ikut terfilter; penjualan pelanggan terfilter.

- [ ] **Step 1: Write the failing tests**
  - `sales without others sees only own SO in list and tab counts`.
  - `direct access to other sales SO returns 404 on detail, related, actions, proforma, invoice, document` (Review Focus 2).
  - `user with sales_data.others sees all`.
  - `customer sales summary filtered by owner`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/sales-ownership-scope.test.ts` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS; build paket dan restart API.
- [ ] **Step 5: Commit** `feat(sales): restrict sales documents to own salesperson without sales_data.others`

### Task 5: Simpan matrix sebagai perubahan berversi

**Files:**
- Modify: `packages/contracts/src/index.ts:189-207` (skema baru), `packages/backend/src/identity/access.controller.ts:224`, `packages/backend/src/identity/access.service.ts:574+`
- Test: `tests/integration/access-workspace.test.ts` (perluas)

**Interfaces:**
- Produces: `POST /roles/:id/permission-changes` (`role.permission.update`, Idempotency-Key), body `{ version: number; grant: string[]; revoke: string[] }` (id permission; maks. 1000 masing-masing; tidak beririsan) → `{ version: number }`. Memakai `Role.version`: kunci `FOR UPDATE`; versi tidak cocok → 409 "Hak akses telah berubah, muat ulang"; Admin Sistem → 409; id di luar katalog → 400; grant cakupan `company`, grant cakupan lain dipertahankan; audit diff `{code, allowed}`; cabut sesi anggota; naikkan versi.
- `PATCH /roles/:id/permissions` lama dihapus setelah Task 6 memakai endpoint baru (pastikan tidak ada pemakai lain dengan pencarian sebelum menghapus).

- [ ] **Step 1: Write the failing tests**
  - `applies grant and revoke and bumps version`.
  - `concurrent save with stale version is rejected` (Review Focus 4).
  - `rejects overlapping grant and revoke`.
  - `accepts more than 200 grants`.
  - `keeps non-company grants and admin role locked`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/access-workspace.test.ts` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(iam): versioned delta save for role permissions`

### Task 6: Layar matrix pohon

**Files:**
- Modify: `apps/office/app/setting/permission-matrix.tsx` (render 362+, tabs 367, save 300-334; hapus 12 kolom tindakan, tab "Cakupan & Data Sensitif", paragraf legenda), `apps/office/app/setting/access-ui.tsx` (hapus `actions` kolom dan `scopes` yang tidak lagi dipakai)
- Modify: `apps/office/lib/access-matrix-navigation.ts` (ganti `navigation`/`navigationMatrixRows`/`matrixTree` dengan fungsi atas data `/permissions/tree`), `apps/office/lib/iam.ts` (label dipindah ke registry)
- Test: `apps/office/lib/access-matrix-navigation.test.ts` (tulis ulang untuk pohon)

**Interfaces:**
- Consumes: `GET /permissions/tree` (Task 1), `POST /roles/:id/permission-changes` (Task 5).
- Produces: `treeCheckState(node: PermissionTreeNode, granted: Set<string>): "checked" | "partial" | "unchecked"`; `toggleTreeNode(node: PermissionTreeNode, granted: Set<string>): Set<string>` (mengubah semua `code` turunan satu per satu); `diffGrants(before: Set<string>, after: Set<string>): { grant: string[]; revoke: string[] }`.

Layar: nama peran, **Pilih Semua** / **Hapus Semua**, kolom cari; pohon Modul ▸ Submenu ▸ tindakan dengan panah buka/tutup dan centang tiga keadaan; node batasan data tampil sebagai centang berlabel awam di modulnya; "Pengguna dengan peran ini: …" dengan tautan atur pengguna; Batal/Simpan; Admin Sistem tercentang semua dan terkunci. Tab Anggota dan Riwayat dipertahankan; Riwayat menampilkan `role.permissions_migrated`.

- [ ] **Step 1: Write the failing tests**: `treeCheckState` partial untuk sebagian anak; `toggleTreeNode` pada modul mengubah semua kode turunan dan tidak menghasilkan kode induk; `diffGrants` benar; pencarian mempertahankan leluhur.
- [ ] **Step 2: Run** `pnpm vitest run apps/office/lib/access-matrix-navigation.test.ts` → FAIL.
- [ ] **Step 3: Implement** layar.
- [ ] **Step 4: Run** test + `tests/unit/navigation-visibility.test.ts` → PASS; `pnpm --filter @evflow/office build` → sukses.
- [ ] **Step 5: Commit** `feat(office): Kledo-style permission tree matrix`

### Task 7: Sinkronisasi blueprint dan QA browser

**Files:**
- Modify: `docs/erp-blueprint/02-requirements.md` (IAM-01/04: pohon, batasan data berupa kode izin), `15-setting.md` (izin independen per submenu, Lihat harga, Data milik sales lain, bawahan menunggu Struktur Organisasi), `10-sales-marketing.md`, `03-database.md`, `04-api.md`, `07-design.md`; catat aturan harga/pemilik untuk laporan penjualan yang belum dibangun
- Create: `docs/development/so-mudah-bagian-3-2026-10-25.md`

- [ ] **Step 1: Sinkronkan** dokumen; tidak menambah aturan di luar spec dan keputusan pembangun di atas.
- [ ] **Step 2: QA browser** (viewport 1366 dan 390): buat peran "Sales lapangan" tanpa Lihat harga dan tanpa Data milik sales lain; login sebagai anggotanya → daftar SO hanya miliknya, tanpa angka DP/Total, tombol Buat SO tidak tampil, URL SO milik sales lain menampilkan "tidak ditemukan"; periksa respons jaringan tanpa harga. Ubah peran lewat pohon (centang modul → semua anak tercentang; simpan; muat ulang tetap). Simpan dari dua tab → tab kedua mendapat pesan "Hak akses telah berubah". Catat bukti.
- [ ] **Step 3: Run** `pnpm vitest run` dan `./tools/validate-repository.ps1` → lulus.
- [ ] **Step 4: Commit** `docs(iam): sync blueprint and QA evidence for permission tree and sales data limits`
