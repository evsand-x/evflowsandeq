import { ConflictException, NotFoundException } from "@nestjs/common";
import { type Prisma, prisma } from "@evflow/database";
import { z } from "zod";
import { parsed } from "./operational-tax";
import { lockFinance } from "./posting";
import { transactionCommand } from "../common/transaction-command";
import { AuditService } from "../common/audit.service";

export const accountInput = z
  .object({
    code: z.string().trim().min(1).max(30),
    name: z.string().trim().min(1).max(200),
    category: z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]),
    category_label: z.string().trim().max(100).nullable().default(null),
    description: z.string().trim().max(2000).nullable().default(null),
    parent_id: z.string().uuid().nullable().default(null),
    account_type: z.enum(["HEADER", "DETAIL"]).default("DETAIL"),
    normal_balance: z.enum(["DEBIT", "CREDIT"]),
    psak118_category: z.string().trim().max(150).nullable().default(null),
    active: z.boolean().default(true),
    reason: z.string().trim().max(1000).default(""),
  })
  .strict();
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
type Tx = Prisma.TransactionClient;

export async function accountReferences(tx: Tx, c: string, id: string) {
  const [journals, banks, taxes, profiles, children, taxRevisions] = await Promise.all([
    tx.financeJournalLine.count({ where: { companyId: c, accountId: id } }),
    tx.financeBankAccount.findMany({
      where: { companyId: c, accountId: id },
      select: { active: true },
    }),
    tx.operationalTax.findMany({
      where: { companyId: c, accountId: id },
      select: { active: true },
    }),
    tx.financePostingProfile.findMany({
      where: { companyId: c },
      select: { mappings: true, effectiveTo: true },
    }),
    tx.financeAccount.findMany({ where: { companyId: c, parentId: id }, select: { active: true } }),
    tx.operationalTaxRevision.count({
      where: { companyId: c, snapshot: { path: ["accountId"], equals: id } },
    }),
  ]);
  const mapped = profiles.filter((p) =>
    Object.values(p.mappings as Record<string, unknown>).includes(id),
  );
  return {
    used:
      journals > 0 || banks.length > 0 || taxes.length > 0 || mapped.length > 0 || taxRevisions > 0,
    activeReferences:
      banks.some((x) => x.active) ||
      taxes.some((x) => x.active) ||
      mapped.some((x) => x.effectiveTo > new Date()) ||
      children.some((x) => x.active),
    children: children.length,
    reasons: [
      journals > 0 && "Jurnal",
      banks.length > 0 && "Kas/Bank",
      (taxes.length > 0 || taxRevisions > 0) && "Pajak",
      mapped.length > 0 && "Pengaturan Jurnal",
      children.length > 0 && "Subakun",
    ].filter(Boolean),
  };
}

async function writeAccount(
  tx: Tx,
  c: string,
  actor: string,
  data: z.output<typeof accountInput>,
  id?: string,
  version?: number,
) {
  const before = id ? await tx.financeAccount.findFirst({ where: { id, companyId: c } }) : null;
  if (id && !before) throw new NotFoundException("Akun tidak ditemukan.");
  if (before && version !== before.version)
    throw new ConflictException("Versi akun berubah. Muat ulang halaman.");
  if (
    await tx.financeAccount.findFirst({
      where: {
        companyId: c,
        code: { equals: data.code, mode: "insensitive" },
        ...(id ? { id: { not: id } } : {}),
      },
    })
  )
    throw new ConflictException("Kode akun sudah digunakan.");
  const refs = before ? await accountReferences(tx, c, before.id) : null;
  if (refs?.used) {
    if (!data.reason) throw new ConflictException("Alasan perubahan akun terpakai wajib diisi.");
    if (
      before!.category !== data.category ||
      before!.categoryLabel !== data.category_label ||
      before!.accountType !== data.account_type ||
      before!.normalBalance !== data.normal_balance ||
      before!.parentId !== data.parent_id ||
      before!.psak118Category !== data.psak118_category
    )
      throw new ConflictException(
        "Klasifikasi akun terpakai memerlukan proses reklasifikasi terpisah.",
      );
  }
  if (!data.active && refs?.activeReferences)
    throw new ConflictException("Akun masih dipakai referensi aktif. Ganti referensinya dahulu.");
  if (refs?.children && (data.account_type !== "HEADER" || before!.category !== data.category))
    throw new ConflictException(
      "Akun induk yang mempunyai subakun harus tetap Header dengan kelompok yang sama.",
    );
  let parentId = data.parent_id;
  const visited = new Set<string>(id ? [id] : []);
  while (parentId) {
    if (visited.has(parentId))
      throw new ConflictException("Hierarki akun tidak boleh membentuk siklus.");
    visited.add(parentId);
    const parent = await tx.financeAccount.findFirst({ where: { id: parentId, companyId: c } });
    if (
      !parent ||
      parent.accountType !== "HEADER" ||
      parent.category !== data.category ||
      (data.active && !parent.active)
    )
      throw new ConflictException(
        "Akun induk harus Header dalam perusahaan dan kelompok yang sama, serta aktif untuk subakun aktif.",
      );
    parentId = parent.parentId;
  }
  const values = {
    companyId: c,
    code: data.code,
    name: data.name,
    category: data.category,
    categoryLabel: data.category_label,
    description: data.description,
    parentId: data.parent_id,
    accountType: data.account_type,
    normalBalance: data.normal_balance,
    psak118Category: data.psak118_category,
    active: data.active,
    version: (before?.version ?? 0) + 1,
  };
  const row = before
    ? await tx.financeAccount.update({ where: { id: before.id }, data: values })
    : await tx.financeAccount.create({ data: values });
  await new AuditService().recordWith(tx, {
    companyId: c,
    actorId: actor,
    action: before ? "account.updated" : "account.created",
    resourceType: "account",
    resourceId: row.id,
    ...(before ? { before: json(before) } : {}),
    after: json(row),
    metadata: { reason: data.reason },
  });
  return row;
}

export async function saveAccount(
  c: string,
  actor: string,
  input: unknown,
  key: string,
  id?: string,
  version?: number,
) {
  const data = parsed(accountInput, input);
  return transactionCommand(
    c,
    actor,
    `accounts/${id ?? "new"}`,
    key,
    { data, version },
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM companies WHERE id=${c}::uuid FOR UPDATE`;
      await lockFinance(tx, c);
      return writeAccount(tx, c, actor, data, id, version);
    },
  );
}

export async function importAccounts(c: string, actor: string, input: unknown, key: string) {
  const data = parsed(
    z
      .object({
        file_name: z.string().max(200),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
        rows: z.array(accountInput).min(1).max(2000),
      })
      .strict(),
    input,
  );
  if (new Set(data.rows.map((r) => r.code.toLowerCase())).size !== data.rows.length)
    throw new ConflictException("Kode akun duplikat dalam file.");
  return transactionCommand(c, actor, "accounts/import", key, data, async (tx) => {
    await tx.$queryRaw`SELECT id FROM companies WHERE id=${c}::uuid FOR UPDATE`;
    await lockFinance(tx, c);
    const ids: string[] = [];
    for (const row of data.rows) ids.push((await writeAccount(tx, c, actor, row)).id);
    await new AuditService().recordWith(tx, {
      companyId: c,
      actorId: actor,
      action: "account.imported",
      resourceType: "account_import",
      resourceId: ids[0]!,
      after: { file_name: data.file_name, sha256: data.sha256, count: ids.length, ids },
    });
    return { count: ids.length, ids };
  });
}

export async function accountDetail(c: string, id: string) {
  const data = await prisma.financeAccount.findFirst({ where: { id, companyId: c } });
  if (!data) throw new NotFoundException("Akun tidak ditemukan.");
  const [references, history] = await Promise.all([
    accountReferences(prisma, c, id),
    prisma.auditEvent.findMany({
      where: { companyId: c, resourceType: "account", resourceId: id },
      orderBy: { occurredAt: "desc" },
      take: 30,
      select: { id: true, action: true, occurredAt: true, metadata: true },
    }),
  ]);
  return { data, references, history };
}
