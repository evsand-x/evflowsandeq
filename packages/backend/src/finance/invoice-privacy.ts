/** Explicit allowlist: newly added financial fields stay private by default. */
export function invoiceWithoutPrices(value: Record<string, unknown>) {
  const keys = [
    "id",
    "number",
    "state",
    "status",
    "invoiceDate",
    "createdAt",
    "dueDate",
    "postedAt",
    "version",
    "customer",
    "deliveryNote",
    "salesOrder",
    "overdue",
  ];
  return Object.fromEntries(keys.filter((k) => k in value).map((k) => [k, value[k]]));
}
