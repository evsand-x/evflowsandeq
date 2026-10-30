import { ConflictException, NotFoundException } from "@nestjs/common";
import { Prisma } from "@evflow/database";
import { z } from "zod";
import { transactionCommand } from "../common/transaction-command";
import { AuditService } from "../common/audit.service";
import { requireEvidence } from "../sales/document-controls";
import { requestPolicy } from "./remediation";
import { lockFinance } from "./posting";
const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export async function requestTaxRuleAction(c: string, a: string, body: unknown, key: string) {
  const input = z
    .object({
      rule_id: z.string().uuid(),
      // Per customer x product sales tax rules are retired; only receipt (WAPU/PPh) rules remain.
      rule_kind: z.literal("RECEIPT"),
      action: z.enum(["ACTIVATE", "RETIRE"]),
      reason: z.string().trim().min(1).max(1000),
      evidence_id: z.string().uuid(),
    })
    .strict()
    .parse(body);
  return transactionCommand(c, a, "finance/tax-rule-actions", key, input, async (tx) => {
    await lockFinance(tx, c);
    await requireEvidence(tx, c, input.evidence_id, "TAX");
    const rule = await tx.receiptTaxRule.findFirst({ where: { companyId: c, id: input.rule_id } });
    if (!rule) throw new NotFoundException();
    if (rule.state !== (input.action === "ACTIVATE" ? "DRAFT" : "ACTIVE"))
      throw new ConflictException("TAX_RULE_STATE_INVALID");
    const company = await tx.company.findUniqueOrThrow({ where: { id: c } }),
      policy = await requestPolicy(
        tx,
        c,
        a,
        "TAX_RULE_CHANGE",
        company.baseCurrency,
        new Prisma.Decimal(0),
      );
    const row = await tx.o2cControlEvent.create({
      data: {
        companyId: c,
        actorId: a,
        sourceType: "TAX_RULE_CHANGE",
        sourceId: rule.id,
        kind: "REQUEST",
        snapshot: json({ input, policy, rule }),
      },
    });
    await new AuditService().recordWith(tx, {
      companyId: c,
      actorId: a,
      action: "tax_rule.action_requested",
      resourceType: "tax_rule",
      resourceId: rule.id,
      after: row,
    });
    return row;
  });
}
export async function postTaxRuleAction(c: string, a: string, id: string, key: string) {
  return transactionCommand(
    c,
    a,
    `finance/tax-rule-actions/${id}/post`,
    key,
    { id },
    async (tx) => {
      await lockFinance(tx, c);
      const request = await tx.o2cControlEvent.findFirst({
        where: { companyId: c, id, sourceType: "TAX_RULE_CHANGE", kind: "REQUEST" },
      });
      if (!request) throw new NotFoundException();
      if (
        !(await tx.o2cControlEvent.count({
          where: { companyId: c, sourceId: id, kind: "APPROVED" },
        }))
      )
        throw new ConflictException("APPROVAL_REQUIRED");
      const s = request.snapshot as {
          input: { rule_kind: string; action: string };
          rule: { state: string };
        },
        target = s.input.action === "ACTIVATE" ? "ACTIVE" : "RETIRED";
      // Requests recorded for a retired SALES rule can no longer change state.
      if (s.input.rule_kind !== "RECEIPT") throw new ConflictException("TAX_RULE_RETIRED");
      const updated = await tx.receiptTaxRule.updateMany({
        where: { id: request.sourceId, companyId: c, state: s.rule.state },
        data: { state: target },
      });
      if (updated.count !== 1) throw new ConflictException("TAX_RULE_STATE_CHANGED");
      const event = await tx.o2cControlEvent.create({
        data: {
          companyId: c,
          actorId: a,
          sourceType: "TAX_RULE_CHANGE",
          sourceId: id,
          kind: "POSTED",
          snapshot: { state: target },
        },
      });
      await new AuditService().recordWith(tx, {
        companyId: c,
        actorId: a,
        action: "tax_rule.state_changed",
        resourceType: "tax_rule",
        resourceId: request.sourceId,
        after: event,
      });
      return event;
    },
  );
}
