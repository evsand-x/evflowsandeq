import { describe, expect, it } from "vitest";
import { toggleSidebarBranch } from "./sidebar-state";

describe("sidebar accordion", () => {
  it("closes another module and its descendants", () => {
    expect(toggleSidebarBranch({ Sales: true, "Sales/CRM": true }, "Setting", true)).toEqual({
      Sales: false,
      "Sales/CRM": false,
      Setting: true,
    });
  });
  it("switches submenus without closing their parent", () => {
    expect(toggleSidebarBranch({ Sales: true, "Sales/CRM": true }, "Sales/Orders", true)).toEqual({
      Sales: true,
      "Sales/CRM": false,
      "Sales/Orders": true,
    });
  });
  it("clears descendants when collapsing and does not reopen them", () => {
    const closed = toggleSidebarBranch({ Sales: true, "Sales/CRM": true }, "Sales", false);
    expect(toggleSidebarBranch(closed, "Sales", true)).toEqual({ Sales: true, "Sales/CRM": false });
  });
});
