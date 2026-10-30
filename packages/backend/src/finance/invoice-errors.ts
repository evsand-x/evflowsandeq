import { ConflictException } from "@nestjs/common";

/** Attach an actionable setting destination without changing domain error codes. */
export function configurationError(error: unknown): never {
  if (!(error instanceof ConflictException)) throw error;
  const code = error.message;
  let settings_href: string | undefined;
  if (
    code.startsWith("NUMBERING_RULE_REQUIRED_OR_CONFLICTING:") ||
    ["NUMBERING_DIGITS_TOO_SHORT", "DOCUMENT_NUMBER_EXHAUSTED"].includes(code)
  )
    settings_href = "/setting/numbering";
  else if (
    code.startsWith("POSTING_MAPPING_REQUIRED:") ||
    [
      "POSTING_PROFILE_REQUIRED_OR_CONFLICTING",
      "POSTING_ACCOUNT_INVALID",
      "BANK_ACCOUNT_REQUIRED",
      "BANK_CURRENCY_MISMATCH",
      "DEDUCTION_ACCOUNT_INVALID",
      "FINANCE_PERIOD_NOT_OPEN",
    ].includes(code)
  )
    settings_href = "/setting/account-mapping";
  else if (["DEFAULT_SALES_TAX_REQUIRED", "TAX_ROUNDING_REQUIRED"].includes(code))
    settings_href = "/setting/tax";
  if (!settings_href) throw error;
  throw new ConflictException({ message: code, settings_href });
}
