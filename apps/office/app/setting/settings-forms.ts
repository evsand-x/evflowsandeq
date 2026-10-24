// Pure helpers for the Setting pages; no React so they stay unit-testable.
export type PolicyLike = { code: string; active_version: { value: unknown } | null };

export type SettingPolicy = PolicyLike & {
  name: string;
  group: string;
  value_type: string;
  validation_schema: { enum?: unknown[] } | null;
  latest_version_no: number;
  active_version: { value: unknown; version_no: number; saved_at: string; saved_by: string } | null;
};

export type Term = { code: string; label: string; days: number; kind: "COD" | "PREPAY" | "TEMPO" };
export type Freight = {
  mode: "COMPANY" | "CHARGE_CUSTOMER";
  tax_position: "BEFORE_TAX" | "AFTER_TAX";
};
export type NewCustomerCod = { enabled: boolean; months: number; mode: "COD" | "PREPAY" };

export function policyFormValue(policy: PolicyLike): unknown {
  return structuredClone(policy.active_version?.value ?? null);
}

export function policyPayload(code: string, form: unknown): { value: unknown } {
  if (code === "OPS-FLX-04") {
    const freight = form as Freight;
    return {
      value: {
        mode: freight.mode,
        tax_position: freight.mode === "COMPANY" ? "BEFORE_TAX" : freight.tax_position,
      },
    };
  }
  return { value: form };
}

export function previewDocumentNumber(
  prefix: string,
  yearFormat: "YYYY" | "YY",
  digits: number,
  day: string,
  next: string,
) {
  const year = yearFormat === "YY" ? day.slice(2, 4) : day.slice(0, 4);
  return `${prefix}.${year}.${day.slice(5, 7)}.${next.padStart(digits, "0")}`;
}
