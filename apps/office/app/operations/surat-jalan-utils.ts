import Decimal from "decimal.js";

export const releaseOneOutboundStages = [
  { key: "shipping", label: "Surat Jalan", href: "/operations/delivery-notes" },
] as const;

export function remainingQuantity(ordered: string, delivered: string): string {
  const value = new Decimal(ordered).sub(delivered);
  return (value.isNegative() ? new Decimal(0) : value).toString();
}
