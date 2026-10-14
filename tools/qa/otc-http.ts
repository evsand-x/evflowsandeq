import { readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const base = "http://localhost:3101/api/v1";
async function main() {
  const f = JSON.parse(await readFile("tmp/otc-uat/fixture.json", "utf8"));
  const cookies: Record<string, string> = {};
  let csrf = "";
  async function req(
    path: string,
    method = "GET",
    body?: unknown,
    key = randomUUID(),
    expected = method === "GET" ? 200 : 201,
  ) {
    const r = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        Cookie: Object.entries(cookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; "),
        "X-CSRF-Token": csrf,
        "Idempotency-Key": key,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    for (const cookie of r.headers.getSetCookie()) {
      const pair = cookie.split(";")[0]!;
      const eq = pair.indexOf("=");
      cookies[pair.slice(0, eq)] = pair.slice(eq + 1);
    }
    const data = await r.json();
    assert.equal(r.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
    return data.data;
  }
  await req("/operations/lists/orders", "GET", undefined, undefined, 401);
  csrf = (await req("/auth/csrf")).csrf_token;
  await req(
    "/auth/login",
    "POST",
    { email: f.email, password: f.password, client: "office" },
    undefined,
    200,
  );
  await req(`/operations/orders/${randomUUID()}`, "GET", undefined, undefined, 404);
  await req(`/purchase-requests/${randomUUID()}/approve`, "POST", {}, undefined, 403);
  await req(
    "/operations/evidence",
    "POST",
    { purpose: "POD", name: "bad.png", base64: "bm90LWFuLWltYWdl" },
    undefined,
    400,
  );
  const order = await req("/sales-orders", "POST", {
    customer_id: f.customer,
    customer_reference: "SP-HTTP-UAT",
    delivery_address: "Alamat fiktif HTTP UAT",
    evidence_id: f.evidence.SALES_ORDER,
    currency: "IDR",
    lines: [{ product_id: f.product, quantity: "2", unit_price: "10000" }],
  });
  await req(`/sales-orders/${order.id}/submit`, "POST", {});
  const detail = await req(`/operations/orders/${order.id}`),
    batch = detail.fulfillments[0];
  let b = await req(`/operations/warehouse/${batch.id}`);
  await req(`/fulfillment-batches/${b.id}/dispatch`, "POST", {}, undefined, 409);
  await req(`/pick-lists/${b.pickList.id}/confirm-pick`, "POST", {
    lines: b.pickList.lines.map((l: { id: string; assignedQuantity: string }) => ({
      pick_list_line_id: l.id,
      picked_quantity: l.assignedQuantity,
    })),
  });
  await req(`/pick-lists/${b.pickList.id}/confirm-check`, "POST", {});
  await req(`/operations/warehouse/${b.id}/shipment`, "POST", {
    driver: "Pengemudi fiktif",
    vehicle: "UAT-ONLY",
    planned_at: new Date().toISOString(),
  });
  await req(`/fulfillment-batches/${b.id}/dispatch`, "POST", {});
  const pod = await req(`/fulfillment-batches/${b.id}/pod`, "POST", {
    receiver_name: "Penerima UAT",
    evidence_id: f.evidence.POD,
    lines: b.allocations.map((l: { id: string; quantity: string }) => ({
      fulfillment_allocation_id: l.id,
      accepted_quantity: l.quantity,
    })),
  });
  const invoice = await req("/sales-invoices", "POST", { delivery_receipt_id: pod.id });
  assert.equal(invoice.total, "22000");
  const payment = {
      amount: "22000",
      currency: "IDR",
      evidence_id: f.evidence.PAYMENT,
      bank_reference: "UAT-MUTASI-ONLY",
      bank_account_id: f.bank,
    },
    key = randomUUID();
  const receipt = await req(`/customers/${f.customer}/receipts`, "POST", payment, key);
  assert.equal(
    (await req(`/customers/${f.customer}/receipts`, "POST", payment, key)).id,
    receipt.id,
  );
  await req(`/customers/${f.customer}/receipts`, "POST", { ...payment, amount: "22001" }, key, 409);
  await req(
    `/customer-receipts/${receipt.id}/allocate`,
    "POST",
    { invoice_id: invoice.id, amount: "22001" },
    undefined,
    409,
  );
  await req(`/customer-receipts/${receipt.id}/allocate`, "POST", {
    invoice_id: invoice.id,
    amount: "11000",
  });
  await req(`/customer-receipts/${receipt.id}/allocate`, "POST", {
    invoice_id: invoice.id,
    amount: "11000",
  });
  const final = await req(`/operations/invoices/${invoice.id}`);
  assert.equal(final.outstandingAmount, "0");
  assert.ok(final.document?.snapshot);
  b = await req(`/operations/warehouse/${batch.id}`);
  assert.equal(b.documents.length, 3);
  assert.ok((await req(`/operations/audit/${invoice.id}`)).length > 0);
  const taxEvidence = await req("/operations/evidence", "POST", {
    purpose: "TAX",
    name: "uat-tax.png",
    base64: (await readFile("tmp/otc-uat/bukti-uat.png")).toString("base64"),
  });
  const taxDocument = await req("/finance-controls/official-tax-documents", "POST", {
    source_type: "SALES_INVOICE",
    source_id: invoice.id,
    number: `SYNTHETIC-${randomUUID()}`,
    document_date: new Date().toISOString().slice(0, 10),
    evidence_id: taxEvidence.id,
  });
  await req(`/finance-controls/official-tax-documents/${taxDocument.id}/verify`, "POST", {
    decision: "VERIFIED",
    reason: "SYNTHETIC QA evidence",
  });
  await req(
    `/finance-controls/official-tax-documents/${taxDocument.id}/verify`,
    "POST",
    { decision: "VERIFIED", reason: "duplicate decision" },
    undefined,
    409,
  );
  assert.ok(
    (await req("/finance-controls/official-tax-documents")).some(
      (x: { id: string; state: string }) => x.id === taxDocument.id && x.state === "VERIFIED",
    ),
  );
  assert.ok(Array.isArray((await req("/operations/backorders")).rows));
  assert.ok((await req("/finance-controls/banks")).some((x: { id: string }) => x.id === f.bank));
  await req("/finance-controls/reconciliation", "GET", undefined, undefined, 403);
  await req(
    "/finance-controls/statements",
    "POST",
    {
      bank_account_id: f.bank,
      starts_on: "2026-10-06",
      ends_on: "2026-10-05",
      opening_balance: "0",
      closing_balance: "1",
      lines: [
        {
          external_id: randomUUID(),
          reference: "TEST",
          value_date: "2026-10-05",
          amount: "1",
          description: "QA invalid period",
        },
      ],
    },
    undefined,
    409,
  );
  assert.ok(
    (await req(`/operations/evidence/${f.evidence.POD}`)).image.startsWith(
      "data:image/png;base64,",
    ),
  );
  await writeFile(
    "tmp/otc-uat/http-result.json",
    JSON.stringify(
      {
        order: order.id,
        batch: batch.id,
        pod: pod.id,
        invoice: invoice.id,
        receipt: receipt.id,
        outstanding: final.outstandingAmount,
        passed: [
          "401 unauthenticated",
          "403 ungranted approval",
          "404 inaccessible ID",
          "400 invalid image",
          "409 dispatch without documents",
          "409 replay payload mismatch",
          "409 over-allocation",
          "two partial allocations",
          "full OTC paid",
          "private evidence",
          "immutable invoice snapshot",
          "audit",
          "official tax evidence verified",
          "409 repeated tax verification",
          "409 invalid statement period",
          "403 GL without inventory cost scope",
          "backorder and bank lookup",
        ],
      },
      null,
      2,
    ),
  );
  console.log(
    "HTTP UAT passed: SO → picking/check → dispatch → POD → invoice → 2 allocations, outstanding 0; tax evidence verification, protected GL scope and invalid statement period verified.",
  );
}
main();
