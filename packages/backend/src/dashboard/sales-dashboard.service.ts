import type { AuthPrincipal, SalesDashboardData, SalesDashboardQuery } from "@evflow/contracts";
import { salesDashboardQuerySchema } from "@evflow/contracts";
import { prisma, type Prisma } from "@evflow/database";
import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { z } from "zod";

const cursorSchema = z
  .object({
    id: z.string().uuid(),
    due: z.string().datetime(),
    month: z.string(),
    status: z.string(),
    sort: z.string(),
  })
  .strict();

@Injectable()
export class SalesDashboardService {
  async read(principal: AuthPrincipal, rawQuery: SalesDashboardQuery): Promise<SalesDashboardData> {
    if (
      !principal.permissions.some(
        (p) =>
          p.code === "crm.read" &&
          ["company", "privileged"].includes(p.scope_type) &&
          (!p.scope_id || p.scope_id === principal.company_id),
      )
    ) {
      throw new ForbiddenException("Izin atau scope tidak mencukupi.");
    }
    const parsed = salesDashboardQuerySchema.safeParse(rawQuery);
    if (!parsed.success) throw new BadRequestException("Filter Dashboard Sales tidak valid.");
    const query = parsed.data;
    const [year, month] = query.month.split("-").map(Number);
    // Business timezone is Asia/Makassar (UTC+08), including both month boundaries.
    const start = new Date(Date.UTC(year!, month! - 1, 1, -8));
    const end = new Date(Date.UTC(year!, month!, 1, -8));
    const now = new Date();
    const timeFilter: Prisma.DateTimeNullableFilter = { gte: start, lt: end };
    if (query.status === "overdue") timeFilter.lt = now < end ? now : end;
    if (query.status === "upcoming") timeFilter.gte = now > start ? now : start;
    const base: Prisma.ProspectWhereInput = {
      companyId: principal.company_id,
      ownerId: principal.user_id,
      nextAction: { not: null },
      nextActionAt: timeFilter,
      approachStatus: { notIn: ["DEFERRED", "DROPPED"] },
    };
    let after: Prisma.ProspectWhereInput = {};
    if (query.cursor) {
      try {
        const c = cursorSchema.parse(
          JSON.parse(Buffer.from(query.cursor, "base64url").toString("utf8")),
        );
        if (c.month !== query.month || c.status !== query.status || c.sort !== query.sort)
          throw new Error("filter");
        const op = query.sort === "asc" ? "gt" : "lt";
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
    const [total, rows] = await prisma.$transaction(
      async (tx) => {
        const total = await tx.prospect.count({ where: base });
        const rows = await tx.prospect.findMany({
          where: { AND: [base, after] },
          select: {
            id: true,
            code: true,
            nextAction: true,
            nextActionAt: true,
            customer: { select: { name: true } },
          },
          orderBy: [{ nextActionAt: query.sort }, { id: query.sort }],
          take: query.limit + 1,
        });
        return [total, rows] as const;
      },
      { isolationLevel: "RepeatableRead" },
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const unavailable = (
      code: SalesDashboardData["metrics"][number]["code"],
      unit: SalesDashboardData["metrics"][number]["unit"],
      reason: string,
    ) => ({ code, unit, value: null, freshness: "unavailable", reason }) as const;
    return {
      company_id: principal.company_id,
      owner_id: principal.user_id,
      month: query.month,
      timezone: "Asia/Makassar",
      definition_version: "sales-dashboard-v1",
      data_as_of: now.toISOString(),
      updated_at: new Date().toISOString(),
      freshness: "fresh",
      source: "prospect_next_action",
      metrics: [
        unavailable("net_sales", "IDR", "Sumber invoice dan retur diposting belum tersedia."),
        unavailable(
          "sales_achievement",
          "percent",
          "Sumber target dan aktual penjualan belum tersedia.",
        ),
        unavailable("successful_visits", "sessions", "Sumber realisasi kunjungan belum tersedia."),
        unavailable(
          "new_customers",
          "customers",
          "Sumber invoice pertama diposting belum tersedia.",
        ),
        unavailable("target", "IDR", "Sumber target penjualan belum tersedia."),
        unavailable("estimate", "IDR", "Sumber estimasi penjualan belum tersedia."),
        unavailable(
          "estimate_achievement",
          "percent",
          "Sumber target dan estimasi belum tersedia.",
        ),
      ],
      actions: page.map((r) => ({
        id: r.id,
        reference: r.code,
        action: r.nextAction!,
        customer_name: r.customer.name,
        due_at: r.nextActionAt!.toISOString(),
        status: r.nextActionAt! < now ? "overdue" : "upcoming",
      })),
      total_actions: total,
      next_cursor:
        rows.length > query.limit && last
          ? Buffer.from(
              JSON.stringify({
                id: last.id,
                due: last.nextActionAt!.toISOString(),
                month: query.month,
                status: query.status,
                sort: query.sort,
              }),
            ).toString("base64url")
          : null,
    };
  }
}
