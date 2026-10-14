import { describe, expect, it } from "vitest";
import { readDashboardActions } from "./dashboard-state";

describe("Dashboard API response transition", () => {
  it("does not treat a missing actions field as an empty task list", () => {
    expect(readDashboardActions({})).toBeNull();
  });

  it("preserves a confirmed empty task list", () => {
    expect(readDashboardActions({ actions: [] })).toEqual([]);
  });
});
