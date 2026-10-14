"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import { useSession } from "../session-provider";
import { SelectionField } from "@/components/web/selection-field";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Choice, Notice } from "../crm/crm-common";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
type Options = {
  customers?: { id: string; name: string }[];
  products?: { id: string; name: string }[];
  users?: { user: { id: string; displayName: string } }[];
  lots?: { id: string; batchNo: string; qualityState: string; product: { name: string } }[];
};
const permissions = {
  credit: "customer.payment_policy.manage",
  tax: "sales_tax_rule.manage",
  approval: "transaction_approval.manage",
  quality: "inventory.quality.decide",
};
const labels = {
  credit: "Kredit & TOP",
  tax: "Aturan pajak",
  approval: "Pengaturan Persetujuan",
  quality: "Kelayakan stok",
};
export function Controls({
  can,
  command,
  pending,
}: {
  can: (p: string) => boolean;
  command: (path: string, body?: unknown) => Promise<unknown>;
  pending: boolean;
}) {
  const available = (Object.keys(permissions) as (keyof typeof permissions)[]).filter((k) =>
    can(permissions[k]),
  );
  return (
    <Tabs defaultValue={available[0] ?? "credit"}>
      <TabsList>
        {available.map((k) => (
          <TabsTrigger key={k} value={k}>
            {labels[k]}
          </TabsTrigger>
        ))}
      </TabsList>
      {available.map((k) => (
        <TabsContent key={k} value={k}>
          <ControlForm kind={k} command={command} pending={pending} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
function ControlForm({
  kind,
  command,
  pending,
}: {
  kind: keyof typeof permissions;
  command: (path: string, body?: unknown) => Promise<unknown>;
  pending: boolean;
}) {
  const { principal } = useSession();
  const query = useQuery({
    queryKey: ["operations", principal?.company_id, principal?.user_id, "control-options", kind],
    queryFn: () => apiRequest<{ data: Options }>(`/operations/control-options/${kind}`),
  });
  const [values, setValues] = useState<Record<string, string>>({}),
    [approvers, setApprovers] = useState<string[]>([]);
  const [steps, setSteps] = useState<{ mode: string; user_ids: string[] }[]>([]);
  const [reasons, setReasons] = useState<string[]>([]);
  const value = (k: string) => values[k] ?? "";
  const change = (k: string, v: string) => setValues((s) => ({ ...s, [k]: v }));
  const text = (key: string, label: string, type = "text") => (
    <Field key={key}>
      <FieldLabel htmlFor={`${kind}-${key}`}>{label}</FieldLabel>
      <Input
        id={`${kind}-${key}`}
        type={type}
        required
        value={value(key)}
        onChange={(e) => change(key, e.target.value)}
      />
    </Field>
  );
  const selection = (key: string, label: string, options: { id: string; name: string }[]) => (
    <SelectionField
      label={label}
      value={value(key) ? [value(key)] : []}
      options={options}
      onChange={(v) => change(key, v[0] ?? "")}
    />
  );
  return (
    <form
      className="web-form"
      onSubmit={(e) => {
        e.preventDefault();
        let path = "",
          body: unknown;
        if (kind === "credit") {
          path = `/customers/${value("customer")}/payment-policies`;
          body = {
            mode: value("mode"),
            top_days: Number(value("top")),
            credit_limit: value("limit"),
            past_due_grace_days: Number(value("grace")),
            frozen: value("frozen") === "true",
            ...(value("frozen") === "true" ? { freeze_reason: value("reason") } : {}),
            effective_from: new Date(value("from")).toISOString(),
          };
        }
        if (kind === "tax") {
          path = "/operations/tax-rules";
          body = {
            customer_id: value("customer"),
            product_id: value("product"),
            name: value("name"),
            legal_reference: value("legal"),
            taxable_event: value("taxable_event"),
            rate: value("rate"),
            dpp_factor: value("factor"),
            decimal_places: Number(value("precision")),
            rounding: value("rounding"),
            effective_from: new Date(value("from")).toISOString(),
            effective_to: new Date(value("to")).toISOString(),
          };
        }
        if (kind === "approval") {
          path = "/operations/approval-policies";
          body = {
            currency: "IDR",
            document_kind: value("document_kind"),
            ...(value("document_kind") !== "PURCHASE_REQUEST"
              ? { grant_hours: Number(value("grant_hours")), allowed_reasons: reasons }
              : {}),
            maximum_amount: value("limit"),
            steps: [...steps, { mode: value("mode"), user_ids: approvers }],
            effective_from: new Date(value("from")).toISOString(),
            effective_to: new Date(value("to")).toISOString(),
          };
        }
        if (kind === "quality") {
          path = `/operations/stock/${value("lot")}/quality`;
          body = { state: value("state"), reason: value("reason") };
        }
        void command(path, body).catch(() => undefined);
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>{labels[kind]}</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {query.error && <Notice>{String(query.error)}</Notice>}
            {["credit", "tax"].includes(kind) &&
              selection("customer", "Pelanggan", query.data?.data.customers ?? [])}
            {kind === "credit" && (
              <>
                <Field>
                  <FieldLabel>Cara bayar</FieldLabel>
                  <Choice
                    label="Cara bayar"
                    value={value("mode")}
                    onChange={(v) => change("mode", v)}
                    options={{ TEMPO: "Tempo", COD: "COD", PREPAY: "Prepay" }}
                  />
                </Field>
                {text("top", "TOP (hari)", "number")}
                {text("limit", "Limit kredit")}
                {text("grace", "Toleransi overdue (hari)", "number")}
                <Field>
                  <FieldLabel>Status kredit</FieldLabel>
                  <Choice
                    label="Status kredit"
                    value={value("frozen")}
                    onChange={(v) => change("frozen", v)}
                    options={{ false: "Aktif", true: "Freeze" }}
                  />
                </Field>
                {value("frozen") === "true" && text("reason", "Alasan freeze")}
              </>
            )}
            {kind === "tax" && (
              <>
                {selection("product", "Produk", query.data?.data.products ?? [])}
                {text("name", "Nama aturan")}
                {text("legal", "Dasar hukum / referensi resmi")}
                <SelectionField
                  label="Saat pajak terutang"
                  value={value("taxable_event") ? [value("taxable_event")] : []}
                  onChange={(v) => change("taxable_event", v[0] ?? "")}
                  options={[
                    { id: "POD", name: "Penerimaan barang (POD)" },
                    { id: "ADVANCE", name: "Uang muka, sisa pada POD" },
                  ]}
                />
                {text("rate", "Tarif sebagai pecahan (bukan persen)")}
                {text("factor", "Faktor DPP")}
                {text("precision", "Digit desimal", "number")}
                <Field>
                  <FieldLabel>Pembulatan</FieldLabel>
                  <Choice
                    label="Pembulatan"
                    value={value("rounding")}
                    onChange={(v) => change("rounding", v)}
                    options={{ HALF_UP: "Half up", HALF_EVEN: "Half even", DOWN: "Down" }}
                  />
                </Field>
              </>
            )}
            {kind === "approval" && (
              <>
                <SelectionField
                  label="Jenis pengajuan"
                  value={value("document_kind") ? [value("document_kind")] : []}
                  onChange={(v) => change("document_kind", v[0] ?? "")}
                  options={[
                    { id: "PURCHASE_REQUEST", name: "PR" },
                    { id: "SALES_ORDER_UNLOCK", name: "Unlock SO" },
                    { id: "SPECIAL_PRICE", name: "Harga khusus" },
                  ]}
                />
                {text("limit", "Batas nilai (IDR)")}
                {value("document_kind") !== "PURCHASE_REQUEST" &&
                  text("grant_hours", "Masa berlaku grant (jam)", "number")}
                {value("document_kind") === "SALES_ORDER_UNLOCK" && (
                  <SelectionField
                    label="Alasan yang dapat di-unlock"
                    multiple
                    value={reasons}
                    onChange={setReasons}
                    options={[
                      { id: "CREDIT_HOLD", name: "Limit kredit" },
                      { id: "CUSTOMER_PAST_DUE", name: "Lewat jatuh tempo" },
                      { id: "CUSTOMER_CREDIT_FROZEN", name: "Freeze" },
                    ]}
                  />
                )}
                {steps.map((s, n) => (
                  <p key={n}>
                    Tahap {n + 1}: {s.mode} · {s.user_ids.length} approver{" "}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSteps((old) => old.filter((_, i) => i !== n))}
                    >
                      Hapus tahap
                    </Button>
                  </p>
                ))}
                <SelectionField
                  label={`Approver tahap ${steps.length + 1}`}
                  multiple
                  options={(query.data?.data.users ?? []).map((u) => ({
                    id: u.user.id,
                    name: u.user.displayName,
                  }))}
                  value={approvers}
                  onChange={setApprovers}
                />
                <Field>
                  <FieldLabel>Keputusan tahap</FieldLabel>
                  <Choice
                    label="Keputusan tahap"
                    value={value("mode")}
                    onChange={(v) => change("mode", v)}
                    options={{ ANY: "Salah satu approver", ALL: "Semua approver" }}
                  />
                </Field>
                <Button
                  type="button"
                  variant="outline"
                  disabled={!approvers.length || !value("mode")}
                  onClick={() => {
                    setSteps((s) => [...s, { mode: value("mode"), user_ids: approvers }]);
                    setApprovers([]);
                  }}
                >
                  Tambah tahap berikutnya
                </Button>
                <p>Requester tidak dapat menyetujui permintaannya sendiri.</p>
              </>
            )}
            {kind === "quality" && (
              <>
                {selection(
                  "lot",
                  "Lot persediaan",
                  (query.data?.data.lots ?? []).map((l) => ({
                    id: l.id,
                    name: `${l.product.name} · ${l.batchNo} · ${l.qualityState}`,
                  })),
                )}
                <Field>
                  <FieldLabel>Keputusan mutu</FieldLabel>
                  <Choice
                    label="Keputusan mutu"
                    value={value("state")}
                    onChange={(v) => change("state", v)}
                    options={{
                      AVAILABLE: "Layak",
                      HOLD: "Hold",
                      RECALL: "Recall",
                      QUARANTINE: "Karantina",
                    }}
                  />
                </Field>
                {text("reason", "Referensi inspeksi dan alasan keputusan")}
              </>
            )}
            {kind !== "quality" && text("from", "Berlaku mulai", "datetime-local")}
            {["tax", "approval"].includes(kind) && text("to", "Berlaku sampai", "datetime-local")}
            <Button type="submit" disabled={pending || query.isPending}>
              Simpan keputusan
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </form>
  );
}
