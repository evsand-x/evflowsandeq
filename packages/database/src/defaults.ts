/** Editable seed data shipped with the schema; consumers copy it into company configuration. */
import chartFile from "./data/chart-of-accounts.json";
import policyFile from "./data/operational-policies.json";

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
