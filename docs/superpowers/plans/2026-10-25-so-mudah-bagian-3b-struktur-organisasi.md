# SO Mudah — Bagian 3b: Struktur Organisasi dan Data Milik Bawahan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Setting › Struktur Organisasi berisi Karyawan (dengan atasan langsung dipilih manual), Departemen, dan Jabatan sebagai daftar biasa, lalu mengaktifkan batasan **Data milik bawahan** pada dokumen penjualan.

**Architecture:** Model `Employee` terpisah dari `User` (karyawan boleh tanpa akun; akun opsional tertaut ke satu karyawan). Atasan disimpan sebagai `managerEmployeeId`; bawahan dihitung dengan CTE rekursif dan rantai melingkar ditolak saat simpan. Batasan `sales_data.subordinates` memperluas filter pemilik bagian 3 menjadi "milik sendiri + bawahan".

**Tech Stack:** Prisma/PostgreSQL, backend `packages/backend`, zod `@evflow/contracts`, Next.js Office, vitest dengan Postgres nyata.

**Spec:** [docs/superpowers/specs/2026-10-25-so-mudah-design.md](../specs/2026-10-25-so-mudah-design.md) (Matrix hak akses → Struktur Organisasi). Desain asal: [2026-10-24-erp-fleksibel-design.md §7.5](../specs/2026-10-24-erp-fleksibel-design.md). **Bergantung pada:** [bagian 3](2026-10-25-so-mudah-bagian-3.md) (registry pohon izin, `salesOwnerFilter`).

## Global Constraints

- Semua Global Constraints bagian 1 dan 3 berlaku.
- Atasan langsung **dipilih manual per karyawan**; tidak diturunkan dari jabatan.
- Jabatan dan Departemen adalah **daftar biasa** (tanpa hierarki).
- Data karyawan adalah data pribadi: hanya dikirim kepada pemegang izin baca submenu terkait.
- Izin per submenu: Karyawan, Departemen, Jabatan masing-masing punya izin sendiri; migration tidak memberikan izin baru ini kepada peran mana pun (fitur baru; Admin Sistem penuh).
- Tampilan bagan tidak dibuat.

## Review Focus

1. **Rantai atasan melingkar** (A atasan B, B atasan C, lalu C dijadikan atasan A): ditolak. Test di Task 2.
2. **Karyawan resign yang masih punya bawahan aktif**: bawahan tidak boleh tertinggal menunjuk karyawan nonaktif tanpa keputusan. Test di Task 2.
3. **Satu akun ditautkan ke dua karyawan**: ditolak. Test di Task 2.
4. **Pengguna tanpa data karyawan** memegang `sales_data.subordinates`: hanya melihat miliknya sendiri, tidak error. Test di Task 3.
5. **Rantai dalam** (5 tingkat): manajer puncak melihat SO semua tingkat di bawahnya. Test di Task 3.

---

### Task 1: Skema, izin, dan kontrak

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/20261025400000_organization_structure/migration.sql`
- Modify: `packages/database/prisma/seed.ts:74-196`
- Create: `packages/contracts/src/organization.ts` (diekspor dari `index.ts`)
- Modify: `packages/contracts/src/permission-tree.ts` (submenu Setting › Struktur Organisasi; node `sales_data.subordinates` tidak lagi `hidden`)
- Test: `tests/unit/organization-contract.test.ts`

**Interfaces:**
- Produces (Prisma): `Department { id, companyId, name, state ACTIVE|INACTIVE, version, createdAt }` unik `[companyId, name]`; `Position { id, companyId, name, state, version, createdAt }` unik `[companyId, name]`; `Employee { id, companyId, employeeNumber, name, departmentId?, positionId?, managerEmployeeId?, userId?, state EmployeeState(ACTIVE|RESIGNED), resignedAt?, version, createdAt, createdById }` unik `[companyId, employeeNumber]` dan `[companyId, userId]`; index `[companyId, managerEmployeeId]`.
- Produces (izin): `org_employee.read|create|update|resign`, `org_department.read|create|update`, `org_position.read|create|update`.
- Produces (contracts): `employeeInputSchema = { employee_number (1-40), name (1-200), department_id?, position_id?, manager_employee_id?, user_id? }`; `employeeUpdateSchema` (sama + `version`); `employeeResignSchema = { version, resigned_at (YYYY-MM-DD), reassign_subordinates_to?: uuid | null }`; `namedItemSchema = { name (1-100) }` untuk Departemen/Jabatan (+ `version`, `state` saat ubah).

- [ ] **Step 1: Write the failing test**: skema menerima karyawan minimal (nomor + nama); menolak `employee_number` kosong; `permissionTree` memuat submenu Karyawan/Departemen/Jabatan dengan tindakan di atas; node `sales_data.subordinates` tidak tersembunyi.
- [ ] **Step 2: Run** `pnpm vitest run tests/unit/organization-contract.test.ts` → FAIL.
- [ ] **Step 3: Implement** skema, migration (tanpa pemberian izin ke peran), seed, kontrak, registry.
- [ ] **Step 4: Run** → PASS; `tests/integration/permission-tree.test.ts` (bagian 3) → PASS.
- [ ] **Step 5: Commit** `feat(org): employee, department and position models with per-submenu permissions`

### Task 2: Layanan Struktur Organisasi

**Files:**
- Create: `packages/backend/src/administration/organization.service.ts`, `packages/backend/src/administration/organization.controller.ts` (didaftarkan di modul administrasi)
- Test: `tests/integration/organization-structure.test.ts`

**Interfaces:**
- Produces (endpoint; semua mutasi memakai Idempotency-Key, audit, dan versi):
  - `GET /organization/employees` (`org_employee.read`; filter `state`, `department_id`, `search`) → baris `{ id, employeeNumber, name, department, position, manager: {id, name} | null, user: {id, displayName} | null, state }`; `GET /organization/employees/:id`.
  - `POST /organization/employees` (`org_employee.create`), `PATCH /organization/employees/:id` (`org_employee.update`), `POST /organization/employees/:id/resign` (`org_employee.resign`).
  - `GET|POST /organization/departments`, `PATCH /organization/departments/:id` (`org_department.*`); `GET|POST /organization/positions`, `PATCH /organization/positions/:id` (`org_position.*`).
- Aturan:
  - Atasan harus karyawan ACTIVE perusahaan yang sama dan bukan diri sendiri → `EMPLOYEE_MANAGER_INVALID`; rantai melingkar (CTE rekursif dari calon atasan ke atas menemukan karyawan ini) → `EMPLOYEE_MANAGER_CYCLE`.
  - `user_id` harus anggota aktif perusahaan dan belum tertaut ke karyawan lain → `EMPLOYEE_USER_ALREADY_LINKED`.
  - Departemen/Jabatan harus ACTIVE saat dipilih → `ORGANIZATION_ITEM_INACTIVE`; nama unik → `ORGANIZATION_ITEM_DUPLICATE`.
  - Resign: bila punya bawahan ACTIVE, wajib `reassign_subordinates_to` (karyawan ACTIVE lain, valid terhadap rantai) atau `null` eksplisit untuk mengosongkan atasan mereka → selain itu `EMPLOYEE_HAS_SUBORDINATES`; tautan akun dilepas saat resign. *(keputusan pembangun)*
  - Versi tidak cocok → `ORGANIZATION_VERSION_CHANGED`.

- [ ] **Step 1: Write the failing tests**
  - `creates employee without account and with manager`.
  - `rejects manager cycle` (Review Focus 1); `rejects self as manager`.
  - `rejects linking one user to two employees` (Review Focus 3).
  - `resign with active subordinates requires reassignment` → `EMPLOYEE_HAS_SUBORDINATES`; `resign reassigns subordinates and unlinks user` (Review Focus 2).
  - `department and position names unique per company; inactive cannot be chosen`.
  - `each endpoint requires its own submenu permission`; `employee data not returned without org_employee.read`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/organization-structure.test.ts` → FAIL.
- [ ] **Step 3: Implement**.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(org): organization structure service with manual managers`

### Task 3: Data milik bawahan pada dokumen penjualan

**Files:**
- Create: `packages/backend/src/administration/subordinates.ts`
- Modify: `packages/backend/src/sales/sales-ownership.ts` (bagian 3 Task 4)
- Test: `tests/integration/sales-subordinate-scope.test.ts`

**Interfaces:**
- Produces: `subordinateUserIds(db: Tx | PrismaClient, companyId: string, userId: string): Promise<string[]>` — cari karyawan dengan `userId`; CTE rekursif `managerEmployeeId` ke bawah (semua tingkat, hanya karyawan ACTIVE); kembalikan `userId` yang tidak null; pengguna tanpa karyawan → `[]`.
- Produces: `salesOwnerFilter(auth, db)` menjadi async → `null` bila `sales_data.others` atau Admin Sistem; `{ salespersonId: { in: [auth.user_id, ...subordinateUserIds] } }` bila `sales_data.subordinates`; selain itu `{ salespersonId: auth.user_id }`. `assertSalesOwnerAccess` memakai aturan yang sama.

- [ ] **Step 1: Write the failing tests**
  - `supervisor with subordinates permission sees own and subordinates SO`.
  - `five-level chain: top manager sees all levels` (Review Focus 5).
  - `user without employee record and subordinates permission sees only own` (Review Focus 4).
  - `resigned subordinate SO no longer visible through subordinates scope`.
  - `direct access to non-subordinate SO returns 404`.
- [ ] **Step 2: Run** `pnpm vitest run tests/integration/sales-subordinate-scope.test.ts` → FAIL.
- [ ] **Step 3: Implement**; ubah pemanggil `salesOwnerFilter` menjadi `await`.
- [ ] **Step 4: Run** test baru + `tests/integration/sales-ownership-scope.test.ts` → PASS; build paket dan restart API.
- [ ] **Step 5: Commit** `feat(sales): subordinate data scope from organization structure`

### Task 4: Layar Setting › Struktur Organisasi

**Files:**
- Create: `apps/office/app/setting/organization/page.tsx` (Karyawan), `apps/office/app/setting/organization/departments/page.tsx`, `apps/office/app/setting/organization/positions/page.tsx`, `apps/office/app/setting/organization/employee-form.tsx`
- Modify: `apps/office/lib/navigation.ts` (submenu Setting dan `settingPermissions`), hub `apps/office/app/setting/page.tsx`
- Test: `tests/unit/navigation-visibility.test.ts` (perluas), `apps/office/app/setting/organization/employee-form.test.ts`

**Interfaces:**
- Consumes: endpoint Task 2.
- Produces: `employeeFormPayload(state: EmployeeFormState): EmployeeInput` (fungsi murni).

Layar:
- **Karyawan**: tombol "Tambah Karyawan"; tab Aktif / Resign; kolom NIK, Nama, Departemen, Jabatan, Atasan langsung, Akun, Status; cari. Form: NIK*, Nama*, Departemen, Jabatan, **Atasan langsung** (pilih karyawan aktif), Akun pengguna (opsional; hanya akun yang belum tertaut). Aksi Resign membuka dialog tanggal resign dan, bila ada bawahan, pilihan "Pindahkan bawahan ke" (wajib dipilih atau "Kosongkan atasan").
- **Departemen** dan **Jabatan**: daftar Nama, Status; Tambah/Ubah/Nonaktifkan dalam dialog.
- Submenu tampil hanya dengan izin baca masing-masing.

- [ ] **Step 1: Write the failing tests**: `employeeFormPayload` menghilangkan field kosong; navigasi menampilkan setiap submenu hanya dengan izin `org_*.read` miliknya.
- [ ] **Step 2: Run** `pnpm vitest run apps/office/app/setting/organization/employee-form.test.ts tests/unit/navigation-visibility.test.ts` → FAIL.
- [ ] **Step 3: Implement** layar.
- [ ] **Step 4: Run** → PASS; `pnpm --filter @evflow/office build` → sukses.
- [ ] **Step 5: Commit** `feat(office): Setting organization structure screens`

### Task 5: Sinkronisasi blueprint dan QA browser

**Files:**
- Modify: `docs/erp-blueprint/02-requirements.md` (IAM-12), `13-hris.md` (struktur organisasi dasar), `15-setting.md`, `03-database.md`, `04-api.md`, `07-design.md`
- Create: `docs/development/so-mudah-bagian-3b-2026-10-25.md`

- [ ] **Step 1: Sinkronkan** dokumen; catat bahwa bagan dan pemakaian pada mesin persetujuan belum dibangun.
- [ ] **Step 2: QA browser** (viewport 1366 dan 390): buat Departemen "Sales", Jabatan "SMD Spv." dan "Sales Representative"; buat karyawan supervisor (dengan akun) dan dua sales (dengan akun) beratasan supervisor; coba jadikan sales atasan supervisor → ditolak; beri peran supervisor centang "Data milik bawahan" tanpa "Data milik sales lain"; login supervisor → daftar SO berisi miliknya dan milik dua sales saja. Resign satu karyawan yang punya bawahan → wajib pilih pemindahan. Catat bukti.
- [ ] **Step 3: Run** `pnpm vitest run` dan `./tools/validate-repository.ps1` → lulus.
- [ ] **Step 4: Commit** `docs(org): sync blueprint and QA evidence for organization structure`
