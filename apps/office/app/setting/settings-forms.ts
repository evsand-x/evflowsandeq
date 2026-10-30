// Pure helpers for the Setting pages; no React so they stay unit-testable.
import Decimal from "decimal.js";
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
  if (code === "OPS-FLX-09") {
    const text = typeof form === "string" ? form.trim().replace(/\.$/, "") : "";
    return { value: text === "" ? null : text };
  }
  return { value: form };
}

const romanMonths = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

/** Segments of `Prefix.Year.Month.Sequence`, same rules as the server formatter. */
export function documentNumberParts(
  prefix: string,
  yearFormat: "YYYY" | "YY",
  digits: number,
  day: string,
  next: string,
  monthFormat: "ARABIC" | "ROMAN" = "ARABIC",
) {
  return {
    prefix,
    year: yearFormat === "YY" ? day.slice(2, 4) : day.slice(0, 4),
    month: monthFormat === "ROMAN" ? romanMonths[Number(day.slice(5, 7)) - 1]! : day.slice(5, 7),
    sequence: next.padStart(digits, "0"),
  };
}

export function previewDocumentNumber(
  prefix: string,
  yearFormat: "YYYY" | "YY",
  digits: number,
  day: string,
  next: string,
  monthFormat: "ARABIC" | "ROMAN" = "ARABIC",
) {
  const p = documentNumberParts(prefix, yearFormat, digits, day, next, monthFormat);
  return `${p.prefix}.${p.year}.${p.month}.${p.sequence}`;
}

/** Format pattern shown in the list, e.g. `SO.TTTT.BB.0000` (RR = bulan Romawi). */
export function numberPattern(
  prefix: string,
  yearFormat: "YYYY" | "YY",
  monthFormat: "ARABIC" | "ROMAN",
  digits: number,
) {
  return `${prefix}.${yearFormat === "YY" ? "TT" : "TTTT"}.${monthFormat === "ROMAN" ? "RR" : "BB"}.${"0".repeat(digits)}`;
}

/**
 * "Nomor saat ini" check: digits only and never below the number already used.
 * Returns the next sequence number as a decimal string, or null when invalid.
 */
export function nextFromCurrent(current: string, used: string) {
  if (!/^\d{1,10}$/.test(current)) return null;
  const value = BigInt(current);
  return value < BigInt(used) ? null : (value + 1n).toString();
}

/** The dialog starts from the scheduled reset period when one exists, so saving does not cancel it. */
export function initialResetPeriod(row: {
  reset_period: "YEARLY" | "MONTHLY" | null;
  pending: { reset_period: "YEARLY" | "MONTHLY" } | null;
}) {
  return row.pending?.reset_period ?? row.reset_period ?? "MONTHLY";
}

export type VersionedSource<T> = { version: number; value: T };

/**
 * Next draft after an edit. The version is taken from the source on the first edit and kept after,
 * so a save sent later still carries the version the user started from (stale saves get 412).
 */
export function lockDraft<T>(
  draft: VersionedSource<T> | null,
  source: VersionedSource<T> | undefined,
  next: T,
): VersionedSource<T> | null {
  if (!source) return null;
  return { version: draft?.version ?? source.version, value: next };
}

export type TaxDraft = {
  name: string;
  kind: string;
  usage: string;
  effect: string;
  account_id: string;
  percentage: string;
  dpp_factor: string;
  decimal_places: string;
  rounding: string;
  active: boolean;
};

const decimalText = (value: string) => value.trim().replace(",", ".");

/** Effective tax share of the price, e.g. 12% x 11/12 = 11%; null while the input is incomplete. */
export function effectiveTaxPercent(percentage: string, factor: string): string | null {
  const rate = decimalText(percentage),
    dpp = decimalText(factor);
  if (!/^\d+(\.\d+)?$/.test(rate) || !/^\d+(\.\d+)?$/.test(dpp)) return null;
  return new Decimal(rate).mul(dpp).toDecimalPlaces(4).toString();
}

export function taxPayload(draft: TaxDraft, effectiveFrom: string) {
  return {
    name: draft.name.trim(),
    kind: draft.kind,
    usage: draft.usage,
    effect: draft.effect,
    account_id: draft.account_id,
    percentage: decimalText(draft.percentage),
    dpp_factor: decimalText(draft.dpp_factor),
    decimal_places: Number(draft.decimal_places),
    rounding: draft.rounding,
    active: draft.active,
    effective_from: effectiveFrom,
  };
}

/** Mirrors the server rule; the server still decides. */
export function canBeDefault(
  tax: { kind: string; usage: string; effect: string; active: boolean },
  usage: "SALES" | "PURCHASE",
) {
  return (
    tax.active &&
    tax.kind === "PPN" &&
    tax.effect === "ADD" &&
    (tax.usage === "BOTH" || tax.usage === usage)
  );
}
