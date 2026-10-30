/** Editable seed data shipped with the schema; consumers copy it into company configuration. */
import chartFile from "./data/chart-of-accounts.json";
import numberingFile from "./data/numbering-defaults.json";
import policyFile from "./data/operational-policies.json";
import taxFile from "./data/tax-defaults.json";
import deductionFile from "./data/deduction-types.json";

export type ChartAccountData = {
  code: string;
  name: string;
  category: string;
  category_label: string | null;
  account_type: string;
  normal_balance: string;
  parent_code: string | null;
  psak118_category: string | null;
  description: string | null;
  control_kind: string | null;
  active: boolean;
};

export type PolicyCatalogEntry = {
  code: string;
  name: string;
  group: string;
  domain: string;
  type: string;
  unit?: string | null;
  default: unknown;
  schema: unknown;
};

export const chartOfAccounts = chartFile as {
  accounts: ChartAccountData[];
  posting_accounts: Record<string, string>;
};
export const operationalPolicyCatalog = policyFile as PolicyCatalogEntry[];

export type NumberingDefault = {
  document_kind: string;
  label: string;
  prefix: string;
  digits: number;
  year_format: "YYYY" | "YY";
  reset_period: "YEARLY" | "MONTHLY";
};

export const numberingDefaults = numberingFile as NumberingDefault[];

/** Default taxes; `default_for` marks the company default for that direction. */
export type TaxDefault = {
  name: string;
  kind: "PPN" | "PPH";
  usage: "SALES" | "PURCHASE" | "BOTH";
  effect: "ADD" | "DEDUCT";
  account_code: string;
  percentage: string;
  dpp_factor: string;
  decimal_places: number;
  rounding: "HALF_UP" | "HALF_EVEN" | "DOWN";
  default_for: "SALES" | "PURCHASE" | null;
};

export const taxDefaults = taxFile as TaxDefault[];

/** Default deduction types; the settlement account is resolved by code from the imported chart. */
export type DeductionTypeDefault = {
  name: string;
  account_code: string;
  proof_type: "BUKTI_POTONG" | "SSP_NTPN" | "NONE";
  proof_required: boolean;
};

export const deductionTypeDefaults = deductionFile as DeductionTypeDefault[];
