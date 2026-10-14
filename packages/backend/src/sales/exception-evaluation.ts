import { HttpException } from "@nestjs/common";
import { prisma } from "@evflow/database";
import { OtcPtpService } from "../otc-ptp.service";
import { AuditService } from "../common/audit.service";

type Evaluation = {
  id: string;
  company_id: string;
  sales_order_id: string;
  actor_id: string;
  order_version: number;
  state: string;
  last_error: string | null;
};

/** Claim leases recover after process termination. The SO command replay and effects are atomic. */
export async function processExceptionEvaluations(companyId?: string, requestId?: string) {
  const claimed = await prisma.$queryRaw<Evaluation[]>`
    UPDATE sales_exception_evaluations SET state='PROCESSING', attempts=attempts+1,
      available_at=now()+interval '5 minutes'
    WHERE id IN (SELECT id FROM sales_exception_evaluations
      WHERE state IN ('PENDING','PROCESSING') AND available_at <= now()
        AND (${companyId ?? null}::uuid IS NULL OR company_id=${companyId ?? null}::uuid)
        AND (${requestId ?? null}::uuid IS NULL OR id=${requestId ?? null}::uuid)
      ORDER BY created_at LIMIT 10 FOR UPDATE SKIP LOCKED)
    RETURNING *`;
  const service = new OtcPtpService(new AuditService());
  for (const event of claimed) {
    try {
      const order = await prisma.salesOrder.findFirst({
        where: {
          id: event.sales_order_id,
          companyId: event.company_id,
          state: "OPEN",
          lines: { some: { backorderQuantity: { gt: 0 } } },
        },
        select: { id: true },
      });
      if (order) {
        await prisma.$executeRaw`UPDATE sales_exception_evaluations
          SET state='BLOCKED', last_error='MANUAL_REALLOCATION_REQUIRED', completed_at=NULL
          WHERE id=${event.id}::uuid`;
        continue;
      }
      const member = await prisma.companyMembership.findFirst({
        where: {
          companyId: event.company_id,
          userId: event.actor_id,
          active: true,
          user: { active: true },
        },
      });
      if (!member) throw new HttpException("EVALUATION_ACTOR_INACTIVE", 409);
      await service.submitSalesOrder(
        event.company_id,
        event.actor_id,
        event.sales_order_id,
        `exception-evaluate-${event.id}`,
        event.order_version,
      );
      await prisma.$executeRaw`UPDATE sales_exception_evaluations SET state='COMPLETED',
        completed_at=now(), last_error=NULL WHERE id=${event.id}::uuid`;
    } catch (error) {
      const business = error instanceof HttpException && error.getStatus() < 500;
      const message = business ? error.message : "Evaluasi sementara gagal; akan dicoba ulang.";
      await prisma.$executeRaw`UPDATE sales_exception_evaluations SET state=${business ? "BLOCKED" : "PENDING"},
        last_error=${message}, available_at=now()+interval '1 minute' WHERE id=${event.id}::uuid`;
    }
  }
  if (companyId && requestId) {
    const rows = await prisma.$queryRaw<Evaluation[]>`SELECT * FROM sales_exception_evaluations
      WHERE company_id=${companyId}::uuid AND id=${requestId}::uuid`;
    return rows[0];
  }
  return undefined;
}
