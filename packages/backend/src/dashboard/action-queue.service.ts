import {
  actionQueueQuerySchema,
  type ActionQueueData,
  type AuthPrincipal,
} from "@evflow/contracts";
import { prisma, type Prisma } from "@evflow/database";
import { BadRequestException, Injectable } from "@nestjs/common";
import { z } from "zod";
import { hasDomainAccess } from "./workspace-access";

const cursorSchema = z
  .object({
    id: z.string().uuid(),
    due: z.string().datetime(),
    context: z.string(),
  })
  .strict();

@Injectable()
export class ActionQueueService {
  async read(principal: AuthPrincipal, raw: unknown): Promise<ActionQueueData> {
    const parsed = actionQueueQuerySchema.safeParse(raw);
    if (!parsed.success) throw new BadRequestException("Filter tugas tidak valid.");
    const q = parsed.data;
    const context = JSON.stringify([
      principal.company_id,
      principal.user_id,
      q.month,
      q.tab,
      q.module,
      q.search,
      q.sort,
    ]);
    let after: Prisma.ProspectWhereInput = {};
    if (q.cursor) {
      try {
        const c = cursorSchema.parse(
          JSON.parse(Buffer.from(q.cursor, "base64url").toString("utf8")),
        );
        if (c.context !== context) throw new Error("context");
        const op = q.sort === "asc" ? "gt" : "lt";
        after = {
          OR: [
            { nextActionAt: { [op]: new Date(c.due) } },
            { nextActionAt: new Date(c.due), id: { [op]: c.id } },
          ],
        };
      } catch {
        throw new BadRequestException("Cursor tidak valid untuk filter ini.");
      }
    }
    const now = new Date();
    const unavailable = (reason: string) =>
      ({ value: null, unit: "tasks", freshness: "unavailable", reason }) as const;
    const result: ActionQueueData = {
      company_id: principal.company_id,
      owner_id: principal.user_id,
      month: q.month,
      timezone: "Asia/Makassar",
      definition_version: "action-queue-v1",
      data_as_of: now.toISOString(),
      updated_at: now.toISOString(),
      freshness: "unavailable",
      coverage:
        "Tugas pribadi sesuai izin. Sumber persetujuan dan tugas lintas modul belum lengkap.",
      metrics: {
        approvals: unavailable("Sumber persetujuan belum tersedia."),
        followups: unavailable("Sumber tindak lanjut yang diizinkan belum tersedia."),
        overdue: unavailable("Sumber tenggat yang diizinkan belum tersedia."),
      },
      items: [],
      total: null,
      next_cursor: null,
      status: "unavailable",
      reason:
        q.tab === "completed"
          ? "Riwayat penyelesaian tugas belum tersedia."
          : "Sumber persetujuan belum tersedia.",
    };
    const canRead = hasDomainAccess(principal, "crm.read") && ["all", "sales"].includes(q.module);
    if (!canRead) {
      if (q.tab === "followups")
        result.reason = "Sumber tindak lanjut yang diizinkan belum tersedia.";
      return result;
    }
    const [year, month] = q.month.split("-").map(Number);
    const start = new Date(Date.UTC(year!, month! - 1, 1, -8));
    const end = new Date(Date.UTC(year!, month!, 1, -8));
    const base: Prisma.ProspectWhereInput = {
      companyId: principal.company_id,
      ownerId: principal.user_id,
      nextActionAt: { gte: start, lt: end },
      nextAction: { not: null },
      approachStatus: { notIn: ["DEFERRED", "DROPPED"] },
      ...(q.search
        ? {
            OR: [
              { code: { contains: q.search, mode: "insensitive" } },
              { customer: { name: { contains: q.search, mode: "insensitive" } } },
              { nextAction: { contains: q.search, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const [total, overdue, rows] = await prisma.$transaction(
      async (tx) => {
        const total = await tx.prospect.count({ where: base });
        const overdue = await tx.prospect.count({
          where: { AND: [base, { nextActionAt: { lt: now } }] },
        });
        const rows =
          q.tab === "followups"
            ? await tx.prospect.findMany({
                where: { AND: [base, after] },
                select: {
                  id: true,
                  code: true,
                  nextAction: true,
                  nextActionAt: true,
                  version: true,
                  customer: { select: { name: true } },
                },
                orderBy: [{ nextActionAt: q.sort }, { id: q.sort }],
                take: q.limit + 1,
              })
            : [];
        return [total, overdue, rows] as const;
      },
      { isolationLevel: "RepeatableRead" },
    );
    result.updated_at = new Date().toISOString();
    result.metrics.followups = {
      value: total,
      unit: "tasks",
      freshness: "fresh",
      reason: "Tindak lanjut prospek saya · sesuai periode dan filter",
    };
    result.metrics.overdue = {
      value: overdue,
      unit: "tasks",
      freshness: "fresh",
      reason: "Tindak lanjut prospek saya · tenggat terlewati",
    };
    if (q.tab !== "followups") return result;
    result.status = "available";
    result.freshness = "fresh";
    result.reason = "Tindak lanjut prospek saya. Tugas domain lain belum tersedia.";
    result.total = total;
    const page = rows.slice(0, q.limit),
      last = page.at(-1);
    result.items = page.map((r) => ({
      id: r.id,
      reference: r.code,
      title: r.nextAction!,
      module: "sales",
      party: r.customer.name,
      due_at: r.nextActionAt!.toISOString(),
      status: r.nextActionAt! < now ? "overdue" : "upcoming",
      source: "prospect_next_action",
      source_version: r.version,
      destination: `/crm/prospects/${r.id}`,
    }));
    result.next_cursor =
      rows.length > q.limit && last
        ? Buffer.from(
            JSON.stringify({ id: last.id, due: last.nextActionAt!.toISOString(), context }),
          ).toString("base64url")
        : null;
    return result;
  }
}
