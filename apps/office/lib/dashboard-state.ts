import type { DashboardSummary } from "@evflow/contracts";

type DashboardAction = NonNullable<DashboardSummary["sales"]>["actions"][number];

export function readDashboardActions(data: {
  actions?: DashboardAction[];
}): DashboardAction[] | null {
  return Array.isArray(data.actions) ? data.actions : null;
}
