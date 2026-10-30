import Decimal from "decimal.js";
import type { NumberFormat } from "@evflow/contracts";

const empty = "Belum tersedia";
let defaults: NumberFormat = {
  currency: "IDR",
  thousand_separator: ".",
  decimal_separator: ",",
  money_decimals: 0,
  quantity_decimals: 2,
};

/** Called once preferences load; screens then format with the company's Setting values. */
export function setFormatterDefaults(format: NumberFormat) {
  defaults = format;
}

function signed(value: string, places: number) {
  const rounded = new Decimal(value).toDecimalPlaces(places, Decimal.ROUND_HALF_UP);
  return rounded.isNegative() && !rounded.isZero() ? "-" : "";
}

function grouped(value: string, places: number, format: NumberFormat) {
  const fixed = new Decimal(value)
    .abs()
    .toDecimalPlaces(places, Decimal.ROUND_HALF_UP)
    .toFixed(places);
  const [whole = "0", fraction] = fixed.split(".");
  const body = whole.replace(/\B(?=(\d{3})+(?!\d))/g, format.thousand_separator);
  return fraction ? `${body}${format.decimal_separator}${fraction}` : body;
}

export function formatMoney(value: string | null | undefined, format: NumberFormat = defaults) {
  if (value == null || value === "") return empty;
  return `${signed(value, format.money_decimals)}Rp ${grouped(value, format.money_decimals, format)}`;
}

export function formatQuantity(value: string | null | undefined, format: NumberFormat = defaults) {
  if (value == null || value === "") return empty;
  return `${signed(value, format.quantity_decimals)}${grouped(value, format.quantity_decimals, format)}`;
}
