import { it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { OtcPtpController } from "../otc-ptp.controller";
import type { OtcPtpService } from "../otc-ptp.service";
import type { AuthenticatedRequest } from "../identity/auth.types";
it("redacts invoice prices on both legacy allocation success and replay", async () => {
  const invoice = {
    id: randomUUID(),
    number: "INV",
    total: "100",
    issuedSnapshot: { lines: [{ unit_price: "100" }] },
  };
  const req = {
    auth: { company_id: randomUUID(), user_id: randomUUID(), roles: [], permissions: [] },
  } as unknown as AuthenticatedRequest;
  for (const result of [invoice, { invoice, allocation: { id: randomUUID(), amount: "50" } }]) {
    const service = { allocateCustomerReceipt: async () => result } as unknown as OtcPtpService;
    const controller = new OtcPtpController(service);
    const response = await controller.allocateCustomerReceipt(
      randomUUID(),
      { invoice_id: invoice.id, amount: "50" },
      randomUUID(),
      req,
    );
    expect(JSON.stringify(response)).not.toContain("unit_price");
    expect(JSON.stringify(response)).not.toContain('"total"');
    expect(JSON.stringify(response)).not.toContain('"amount"');
    expect(JSON.stringify(response)).toContain(invoice.number);
  }
});
