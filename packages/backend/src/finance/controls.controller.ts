import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  Headers,
  UseGuards,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { z } from "zod";
import { isAccessAdministrator } from "@evflow/contracts";
import { prisma } from "@evflow/database";
import { AuthGuard } from "../identity/auth.guard";
import { PermissionGuard } from "../identity/permission.guard";
import { RequirePermissions } from "../identity/permissions.decorator";
import { hasResourcePermission } from "../identity/resource-permissions";
import type { AuthenticatedRequest } from "../identity/auth.types";
import {
  createTaxComponent,
  financeConfigure,
  importStatement,
  matchStatement,
  undoBankMatch,
  reopenStatement,
  reconcileGl,
  reviewStatement,
  statementReview,
  taxComponentCommand,
} from "./controls.service";
import { createOfficialTaxDocument, verifyOfficialTaxDocument } from "./controls.service";
import {
  requestBankTransaction,
  requestTaxCorrection,
  decideFinancialRequest,
  postFinancialRequest,
  requestRefund,
} from "./remediation";
import { requestReversal, postReversal } from "./source-reversal";
import { periodReadiness, requestPeriodAction, postPeriodAction } from "./period-close";
import { requestTaxRuleAction, postTaxRuleAction } from "./tax-rule-lifecycle";
import { requestAdvanceRefund, postAdvanceRefund } from "./advance-refund";
import { configureNumbering } from "../common/document-number";

const uuid = (v: string) => z.string().uuid().parse(v);
const key = (v?: string) => {
  if (!v || v.length < 8 || v.length > 200) throw new BadRequestException("Idempotency-Key wajib.");
  return v;
};
@Controller("finance-controls")
@UseGuards(AuthGuard, PermissionGuard)
export class FinanceControlsController {
  @Get("numbering-rules")
  @RequirePermissions("numbering_rule.read")
  async numbering(@Req() r: AuthenticatedRequest) {
    return {
      data: await prisma.documentNumberRule.findMany({
        where: { companyId: r.auth.company_id },
        orderBy: { effectiveFrom: "desc" },
      }),
    };
  }
  @Post("numbering-rules")
  @RequirePermissions("numbering_rule.manage")
  async numberingRule(
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await configureNumbering(r.auth.company_id, r.auth.user_id, body, key(k)) };
  }
  @Post("advance-refund-requests")
  @RequirePermissions("customer_refund.create")
  async advanceRequest(
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await requestAdvanceRefund(r.auth.company_id, r.auth.user_id, body, key(k)) };
  }
  @Post("advance-refund-requests/:id/decision")
  @RequirePermissions("customer_refund.approve", "tax_correction.verify")
  async advanceDecision(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await decideFinancialRequest(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        "ADVANCE_REFUND",
        body,
        key(k),
      ),
    };
  }
  @Post("advance-refund-requests/:id/post")
  @RequirePermissions("customer_refund.post")
  async advancePost(
    @Param("id") id: string,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await postAdvanceRefund(r.auth.company_id, r.auth.user_id, uuid(id), key(k)) };
  }
  @Post("tax-rule-actions")
  @RequirePermissions("sales_tax_rule.manage")
  async ruleRequest(
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await requestTaxRuleAction(r.auth.company_id, r.auth.user_id, body, key(k)) };
  }
  @Post("tax-rule-actions/:id/decision")
  @RequirePermissions("sales_tax_rule.approve")
  async ruleDecision(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await decideFinancialRequest(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        "TAX_RULE_CHANGE",
        body,
        key(k),
      ),
    };
  }
  @Post("tax-rule-actions/:id/post")
  @RequirePermissions("sales_tax_rule.activate")
  async rulePost(
    @Param("id") id: string,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await postTaxRuleAction(r.auth.company_id, r.auth.user_id, uuid(id), key(k)) };
  }
  @Get("periods/:id/readiness")
  @RequirePermissions("finance_period.close", "inventory.cost.read")
  async closeReadiness(@Param("id") id: string, @Req() r: AuthenticatedRequest) {
    return {
      data: await prisma.$transaction((tx) => periodReadiness(tx, r.auth.company_id, uuid(id))),
    };
  }
  @Post("periods/:id/action-requests")
  @RequirePermissions("finance_period.close", "finance_period.reopen", "inventory.cost.read")
  async closeRequest(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await requestPeriodAction(r.auth.company_id, r.auth.user_id, uuid(id), body, key(k)),
    };
  }
  @Post("period-actions/:id/decision")
  @RequirePermissions("finance_period.approve", "inventory.cost.read")
  async closeDecision(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await decideFinancialRequest(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        "FINANCE_CLOSE",
        body,
        key(k),
      ),
    };
  }
  @Post("period-actions/:id/post")
  @RequirePermissions("finance_period.close", "finance_period.reopen")
  async closePost(
    @Param("id") id: string,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await postPeriodAction(r.auth.company_id, r.auth.user_id, uuid(id), key(k)) };
  }
  @Post("reversal-requests")
  @RequirePermissions("journal.reverse")
  async reversalRequest(
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await requestReversal(r.auth.company_id, r.auth.user_id, body, key(k)) };
  }
  @Post("reversal-requests/:id/decision")
  @RequirePermissions("journal.reverse.approve")
  async reversalDecision(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await decideFinancialRequest(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        "SOURCE_REVERSAL",
        body,
        key(k),
      ),
    };
  }
  @Post("reversal-requests/:id/post")
  @RequirePermissions("journal.reverse")
  async reversalPost(
    @Param("id") id: string,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await postReversal(r.auth.company_id, r.auth.user_id, uuid(id), key(k)) };
  }
  @Get("requests/:kind")
  @RequirePermissions("journal.read")
  async requests(@Param("kind") kind: string, @Req() r: AuthenticatedRequest) {
    const sourceType = z
      .enum([
        "BANK_TRANSACTION",
        "CUSTOMER_REFUND",
        "TAX_CORRECTION",
        "SOURCE_REVERSAL",
        "ADVANCE_REFUND",
        "FINANCE_CLOSE",
        "TAX_RULE_CHANGE",
      ])
      .parse(kind);
    const required: Record<typeof sourceType, string[]> = {
      BANK_TRANSACTION: ["bank_reconciliation.read"],
      CUSTOMER_REFUND: ["customer_refund.create"],
      TAX_CORRECTION: ["tax_component.read"],
      SOURCE_REVERSAL: ["journal.reverse"],
      ADVANCE_REFUND: ["customer_receipt.read", "tax_component.read"],
      FINANCE_CLOSE: ["finance_period.close", "inventory.cost.read"],
      TAX_RULE_CHANGE: ["sales_tax_rule.manage"],
    };
    if (
      !isAccessAdministrator(r.auth) &&
      required[sourceType].some(
        (code) =>
          !r.auth.permissions.some(
            (p) =>
              p.code === code &&
              ["company", "privileged"].includes(p.scope_type) &&
              (!p.scope_id || p.scope_id === r.auth.company_id),
          ),
      )
    )
      throw new ForbiddenException();
    return {
      data: await prisma.o2cControlEvent.findMany({
        where: { companyId: r.auth.company_id, sourceType },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    };
  }
  @Post("refund-requests")
  @RequirePermissions("customer_refund.create")
  async refundRequest(
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await requestRefund(r.auth.company_id, r.auth.user_id, body, key(k)) };
  }
  @Post("refund-requests/:id/decision")
  @RequirePermissions("customer_refund.approve")
  async refundDecision(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await decideFinancialRequest(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        "CUSTOMER_REFUND",
        body,
        key(k),
      ),
    };
  }
  @Post("bank-transactions")
  @RequirePermissions("bank_transaction.create")
  async bankRequest(
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await requestBankTransaction(r.auth.company_id, r.auth.user_id, body, key(k)) };
  }
  @Post("bank-transactions/:id/decision")
  @RequirePermissions("bank_transaction.approve")
  async bankDecision(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await decideFinancialRequest(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        "BANK_TRANSACTION",
        body,
        key(k),
      ),
    };
  }
  @Post("bank-transactions/:id/post")
  @RequirePermissions("bank_transaction.post")
  async bankPost(
    @Param("id") id: string,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await postFinancialRequest(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        "BANK_TRANSACTION",
        key(k),
      ),
    };
  }
  @Post("tax-corrections")
  @RequirePermissions("tax_correction.create")
  async taxRequest(
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await requestTaxCorrection(r.auth.company_id, r.auth.user_id, body, key(k)) };
  }
  @Post("tax-corrections/:id/decision")
  @RequirePermissions("tax_correction.verify")
  async taxDecision(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await decideFinancialRequest(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        "TAX_CORRECTION",
        body,
        key(k),
      ),
    };
  }
  @Post("tax-corrections/:id/post")
  @RequirePermissions("tax_correction.post")
  async taxPost(
    @Param("id") id: string,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await postFinancialRequest(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        "TAX_CORRECTION",
        key(k),
      ),
    };
  }
  @Get("tax-sources")
  @RequirePermissions("tax_component.create")
  async taxSources(@Req() r: AuthenticatedRequest) {
    const companyId = r.auth.company_id;
    const [invoices, advances] = await Promise.all([
      prisma.salesInvoice.findMany({
        where: { companyId, state: "POSTED" },
        select: { id: true, number: true },
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
      prisma.advanceTax.findMany({
        where: { companyId },
        select: { id: true, amount: true, receiptId: true },
        take: 100,
        orderBy: { id: "desc" },
      }),
    ]);
    return { data: { invoices, advances } };
  }
  @Get("official-tax-documents")
  @RequirePermissions("tax_component.read")
  async documents(@Req() r: AuthenticatedRequest) {
    return {
      data: await prisma.officialTaxDocument.findMany({
        where: { companyId: r.auth.company_id },
        orderBy: { documentDate: "desc" },
        take: 100,
      }),
    };
  }
  @Post("official-tax-documents")
  @RequirePermissions("tax_component.create")
  async createDocument(
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await createOfficialTaxDocument(r.auth.company_id, r.auth.user_id, body, key(k)),
    };
  }
  @Post("official-tax-documents/:id/verify")
  @RequirePermissions("tax_component.verify")
  async verifyDocument(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await verifyOfficialTaxDocument(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        body,
        key(k),
      ),
    };
  }
  @Get("configuration")
  @RequirePermissions("account_mapping.read")
  async configuration(@Req() r: AuthenticatedRequest) {
    const companyId = r.auth.company_id;
    const [accounts, periods, profiles] = await Promise.all([
      prisma.financeAccount.findMany({
        where: { companyId },
        orderBy: { code: "asc" },
        select: {
          id: true,
          code: true,
          name: true,
          category: true,
          active: true,
          accountType: true,
          controlKind: true,
        },
      }),
      prisma.financePeriod.findMany({ where: { companyId }, orderBy: { startsOn: "desc" } }),
      prisma.financePostingProfile.findMany({
        where: { companyId },
        orderBy: { effectiveFrom: "desc" },
      }),
    ]);
    return { data: { accounts, periods, profiles } };
  }
  @Post("configuration/:kind")
  @RequirePermissions("account_mapping.manage")
  async configure(
    @Param("kind") kind: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    if (kind === "account" && !hasResourcePermission(r.auth, "account.create"))
      throw new ForbiddenException("Izin membuat akun diperlukan.");
    return {
      data: await financeConfigure(
        r.auth.company_id,
        r.auth.user_id,
        z.enum(["account", "period", "profile", "bank"]).parse(kind),
        body,
        key(k),
      ),
    };
  }
  @Get("banks")
  async banks(@Req() r: AuthenticatedRequest) {
    if (
      !isAccessAdministrator(r.auth) &&
      !r.auth.permissions.some(
        (p) =>
          ["customer_receipt.post", "bank_statement.import", "bank_reconciliation.read"].includes(
            p.code,
          ) &&
          ["company", "privileged"].includes(p.scope_type) &&
          (!p.scope_id || p.scope_id === r.auth.company_id),
      )
    )
      throw new ForbiddenException("Izin rekening tidak mencukupi.");
    return {
      data: await prisma.financeBankAccount.findMany({
        where: { companyId: r.auth.company_id, active: true },
        select: { id: true, code: true, name: true, lastFour: true, currency: true },
      }),
    };
  }
  @Get("tax-rules")
  @RequirePermissions("tax_rule.read")
  async taxRules(@Req() r: AuthenticatedRequest) {
    return {
      data: await prisma.receiptTaxRule.findMany({
        where: { companyId: r.auth.company_id },
        orderBy: { effectiveFrom: "desc" },
      }),
    };
  }
  @Post("tax-rules")
  @RequirePermissions("sales_tax_rule.manage")
  async taxRule(
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await financeConfigure(r.auth.company_id, r.auth.user_id, "taxRule", body, key(k)),
    };
  }
  @Get("invoices/:id/tax-components")
  @RequirePermissions("tax_component.read")
  async components(@Param("id") id: string, @Req() r: AuthenticatedRequest) {
    return {
      data: await prisma.receiptTaxComponent.findMany({
        where: { companyId: r.auth.company_id, invoiceId: uuid(id) },
      }),
    };
  }
  @Post("tax-components")
  @RequirePermissions("tax_component.create")
  async createTax(
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await createTaxComponent(r.auth.company_id, r.auth.user_id, body, key(k)) };
  }
  @Post("tax-components/:id/verify")
  @RequirePermissions("tax_component.verify")
  async verify(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    const i = z
      .object({
        reason: z.string().trim().min(1).max(1000),
        decision: z.enum(["verify", "reject"]),
      })
      .strict()
      .parse(body);
    return {
      data: await taxComponentCommand(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        i.decision,
        i.reason,
        key(k),
      ),
    };
  }
  @Post("tax-components/:id/post")
  @RequirePermissions("tax_component.post")
  async postTax(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    const i = z
      .object({ reason: z.string().trim().min(1).max(1000) })
      .strict()
      .parse(body);
    return {
      data: await taxComponentCommand(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        "post",
        i.reason,
        key(k),
      ),
    };
  }
  @Get("reconciliation")
  @RequirePermissions("journal.read", "inventory.cost.read")
  async gl(@Req() r: AuthenticatedRequest) {
    return { data: await reconcileGl(r.auth.company_id) };
  }
  @Get("journals/:id")
  @RequirePermissions("journal.read", "inventory.cost.read")
  async journal(@Param("id") id: string, @Req() r: AuthenticatedRequest) {
    const row = await prisma.financeJournal.findFirst({
      where: { companyId: r.auth.company_id, id: uuid(id) },
      include: { lines: true },
    });
    if (!row) throw new NotFoundException();
    return { data: row };
  }
  @Get("statements")
  @RequirePermissions("bank_reconciliation.read")
  async statements(@Req() r: AuthenticatedRequest) {
    return {
      data: await prisma.bankStatement.findMany({
        where: { companyId: r.auth.company_id },
        orderBy: { endsOn: "desc" },
        take: 100,
      }),
    };
  }
  @Get("statements/:id")
  @RequirePermissions("bank_reconciliation.read")
  async statement(@Param("id") id: string, @Req() r: AuthenticatedRequest) {
    return {
      data: await prisma.$transaction((tx) => statementReview(tx, r.auth.company_id, uuid(id))),
    };
  }
  @Post("statements")
  @RequirePermissions("bank_statement.import")
  async import(
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await importStatement(r.auth.company_id, r.auth.user_id, body, key(k)) };
  }
  @Post("statement-lines/:id/match")
  @RequirePermissions("bank_reconciliation.match")
  async match(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    const i = z
      .object({
        receipt_id: z.string().uuid().optional(),
        journal_line_id: z.string().uuid().optional(),
        amount: z
          .string()
          .regex(/^\d+(\.\d{1,8})?$/)
          .optional(),
      })
      .strict()
      .refine(
        (i) => Boolean(i.receipt_id) !== Boolean(i.journal_line_id),
        "Pilih tepat satu sumber pencocokan.",
      )
      .parse(body);
    return {
      data: await matchStatement(
        r.auth.company_id,
        r.auth.user_id,
        uuid(id),
        i.receipt_id,
        key(k),
        i.amount,
        i.journal_line_id,
      ),
    };
  }
  @Post("statements/:id/review")
  @RequirePermissions("bank_reconciliation.review")
  async review(
    @Param("id") id: string,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await reviewStatement(r.auth.company_id, r.auth.user_id, uuid(id), false, key(k)),
    };
  }
  @Post("matches/:id/unmatch")
  @RequirePermissions("bank_reconciliation.unmatch")
  async unmatch(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return { data: await undoBankMatch(r.auth.company_id, r.auth.user_id, uuid(id), body, key(k)) };
  }
  @Post("statements/:id/reopen")
  @RequirePermissions("bank_reconciliation.reopen")
  async reopen(
    @Param("id") id: string,
    @Body() body: unknown,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await reopenStatement(r.auth.company_id, r.auth.user_id, uuid(id), body, key(k)),
    };
  }
  @Get("banks/:id/unmatched-entries")
  @RequirePermissions("bank_reconciliation.read")
  async unmatchedEntries(@Param("id") id: string, @Req() r: AuthenticatedRequest) {
    const bank = await prisma.financeBankAccount.findFirst({
      where: { companyId: r.auth.company_id, id: uuid(id) },
    });
    if (!bank) throw new NotFoundException();
    const entries = await prisma.financeJournalLine.findMany({
      where: {
        companyId: r.auth.company_id,
        accountId: bank.accountId,
        journal: { currency: bank.currency },
      },
      include: { journal: true },
      orderBy: { id: "asc" },
      take: 500,
    });
    const matches = await prisma.bankStatementMatch.findMany({
      where: {
        companyId: r.auth.company_id,
        reversedAt: null,
        journalLineId: { in: entries.map((l) => l.id) },
      },
    });
    return {
      data: entries
        .map((l) => ({
          id: l.id,
          source_type: l.journal.sourceType,
          source_id: l.journal.sourceId,
          business_date: l.journal.businessDate,
          signed_amount: l.debit.sub(l.credit),
          remaining: l.debit
            .sub(l.credit)
            .abs()
            .sub(
              matches
                .filter((m) => m.journalLineId === l.id)
                .reduce((s, m) => s.add(m.amount), l.debit.mul(0)),
            ),
        }))
        .filter((l) => l.remaining.gt(0)),
    };
  }
  @Post("statements/:id/close")
  @RequirePermissions("bank_reconciliation.close")
  async close(
    @Param("id") id: string,
    @Req() r: AuthenticatedRequest,
    @Headers("idempotency-key") k?: string,
  ) {
    return {
      data: await reviewStatement(r.auth.company_id, r.auth.user_id, uuid(id), true, key(k)),
    };
  }
}
