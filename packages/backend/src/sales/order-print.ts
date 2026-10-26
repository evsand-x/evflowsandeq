import { NotFoundException } from "@nestjs/common";
import { prisma, type Prisma } from "@evflow/database";
import { AuditService } from "../common/audit.service";
export async function recordOrderPrint(
  c: string,
  a: string,
  id: string,
  db: Prisma.TransactionClient = prisma,
) {
  if (!(await db.salesOrder.findFirst({ where: { companyId: c, id }, select: { id: true } })))
    throw new NotFoundException();
  await new AuditService().recordWith(db, {
    companyId: c,
    actorId: a,
    action: "sales_order.printed",
    resourceType: "sales_order",
    resourceId: id,
  });
  return { id };
}
