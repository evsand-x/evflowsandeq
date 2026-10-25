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

type Lot = { id: string; batchNo: string; qualityState: string; product: { name: string } };

/** Warehouse › Persediaan › Kelayakan stok (inventory.quality.decide). */
export function StockQuality({
  command,
  pending,
}: {
  command: (path: string, body?: unknown) => Promise<unknown>;
  pending: boolean;
}) {
  const { principal } = useSession();
  const query = useQuery({
    queryKey: [
      "operations",
      principal?.company_id,
      principal?.user_id,
      "control-options",
      "quality",
    ],
    queryFn: () => apiRequest<{ data: { lots?: Lot[] } }>("/operations/control-options/quality"),
  });
  const [lot, setLot] = useState(""),
    [state, setState] = useState(""),
    [reason, setReason] = useState("");
  return (
    <form
      className="web-form"
      onSubmit={(e) => {
        e.preventDefault();
        void command(`/operations/stock/${lot}/quality`, { state, reason }).catch(() => undefined);
      }}
    >
      <Card>
        <CardHeader>
          <CardTitle>Kelayakan stok</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            {query.error && <Notice>{String(query.error)}</Notice>}
            <SelectionField
              label="Lot persediaan"
              value={lot ? [lot] : []}
              options={(query.data?.data.lots ?? []).map((l) => ({
                id: l.id,
                name: `${l.product.name} · ${l.batchNo} · ${l.qualityState}`,
              }))}
              onChange={(v) => setLot(v[0] ?? "")}
            />
            <Field>
              <FieldLabel>Keputusan mutu</FieldLabel>
              <Choice
                label="Keputusan mutu"
                value={state}
                onChange={setState}
                options={{
                  AVAILABLE: "Layak",
                  HOLD: "Hold",
                  RECALL: "Recall",
                  QUARANTINE: "Karantina",
                }}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="quality-reason">
                Referensi inspeksi dan alasan keputusan
              </FieldLabel>
              <Input
                id="quality-reason"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Button type="submit" disabled={pending || query.isPending}>
              Simpan keputusan
            </Button>
          </FieldGroup>
        </CardContent>
      </Card>
    </form>
  );
}
