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
// Customer credit moved to Master Data › Pelanggan (customer_credit.update, stage 2b).
const permissions = {
  approval: "transaction_approval.manage",
  quality: "inventory.quality.decide",
};
const labels = {
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
    <Tabs defaultValue={available[0] ?? "approval"}>
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
            {kind === "approval" && text("to", "Berlaku sampai", "datetime-local")}
            <Button type="submit" disabled={pending || query.isPending}>
              Simpan keputusan
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </form>
  );
}
