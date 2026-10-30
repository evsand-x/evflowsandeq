"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectionField } from "@/components/web/selection-field";
import { DataTable, PageNotice } from "@/components/web/page-frame";
import { apiRequest } from "@/lib/api";
import { documentStatusLabel } from "@/lib/sales-order-copy";
import { useSession } from "../session-provider";
import { Upload, Evidence } from "./workspace";
import { amount, type OrderCommand } from "./sales-order-types";
import { Tone } from "./sales-order-journey";

export type OrderAdvance = {
  id: string;
  amount: string;
  receivedAt: string;
  state: string;
  version: number;
  recordedById: string;
  recordedBy?: { displayName: string };
  recordedByName?: string;
  bankAccount?: { name: string; lastFour?: string };
  bankAccountName?: string;
  evidenceId?: string;
  rejectionReason?: string | null;
};
export function SalesOrderAdvancePanel({
  orderId,
  advances,
  canRecord,
  verifyIds,
  command,
  pending,
  showForm,
  onClose,
}: {
  orderId: string;
  advances: OrderAdvance[];
  canRecord: boolean;
  verifyIds: string[];
  command: OrderCommand;
  pending: boolean;
  showForm: boolean;
  onClose: () => void;
}) {
  const { principal } = useSession();
  const [value, setValue] = useState(""),
    [bank, setBank] = useState("");
  const [date, setDate] = useState(""),
    [reference, setReference] = useState("");
  const [evidence, setEvidence] = useState(""),
    [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const banks = useQuery({
    queryKey: [
      "operations",
      principal?.company_id,
      principal?.user_id,
      principal?.permissions,
      "advance-banks",
    ],
    queryFn: ({ signal }) =>
      apiRequest<{ data: { id: string; name: string; lastFour: string }[] }>(
        "/finance-controls/banks",
        { signal },
      ),
    enabled: showForm && canRecord,
  });
  const columns: ColumnDef<OrderAdvance>[] = [
    {
      id: "date",
      header: "Tanggal",
      cell: ({ row }) => new Date(row.original.receivedAt).toLocaleDateString("id-ID"),
    },
    { id: "amount", header: "Jumlah", cell: ({ row }) => amount(row.original.amount, "IDR") },
    {
      id: "bank",
      header: "Akun",
      cell: ({ row }) =>
        row.original.bankAccount?.name ?? row.original.bankAccountName ?? "Belum tersedia",
    },
    {
      id: "state",
      header: "Status",
      cell: ({ row }) => (
        <>
          <Tone>{documentStatusLabel(row.original.state)}</Tone>
          {row.original.rejectionReason && <p>{row.original.rejectionReason}</p>}
        </>
      ),
    },
    {
      id: "recorder",
      header: "Pencatat",
      cell: ({ row }) =>
        row.original.recordedBy?.displayName ?? row.original.recordedByName ?? "Belum tersedia",
    },
    {
      id: "actions",
      header: "Tindakan",
      cell: ({ row: { original: a } }) => (
        <div className="so-detail-row-actions">
          <Evidence id={a.evidenceId} />
          {verifyIds.includes(a.id) && a.state === "PENDING_VERIFICATION" && (
            <>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  void command(`/sales-order-advances/${a.id}/verify`, {
                    version: a.version,
                  }).catch(() => undefined)
                }
              >
                Verifikasi
              </Button>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setRejectId(a.id);
                  setReason("");
                }}
              >
                Tolak
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];
  const reject = advances.find((a) => a.id === rejectId);
  return (
    <section id="so-advances" className="so-detail-section" aria-labelledby="advance-title">
      <h2 id="advance-title">Uang muka</h2>
      <p className="page-frame-subtitle">
        Uang muka menunggu verifikasi belum menambah DP. Finance memverifikasi catatan pengguna
        lain.
      </p>
      <DataTable
        data={advances}
        columns={columns}
        total={advances.length}
        label="uang muka"
        showColumns={false}
      />
      {reject && (
        <form
          className="web-form so-advance-form"
          onSubmit={(e) => {
            e.preventDefault();
            void command(`/sales-order-advances/${reject.id}/reject`, {
              version: reject.version,
              reason,
            })
              .then(() => setRejectId(null))
              .catch(() => undefined);
          }}
        >
          <label>
            Alasan penolakan *
            <Input
              required
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div>
            <Button disabled={pending || !reason.trim()}>Tolak uang muka</Button>
            <Button type="button" variant="outline" onClick={() => setRejectId(null)}>
              Batal
            </Button>
          </div>
        </form>
      )}
      {showForm && canRecord && (
        <form
          className="web-form so-advance-form"
          onSubmit={(e) => {
            e.preventDefault();
            void command(`/sales-orders/${orderId}/advances`, {
              amount: value,
              received_at: new Date(`${date}T00:00:00`).toISOString(),
              bank_account_id: bank,
              bank_reference: reference || undefined,
              evidence_id: evidence,
            })
              .then(() => {
                setValue("");
                setEvidence("");
                setReference("");
                onClose();
              })
              .catch(() => undefined);
          }}
        >
          <h3>Catat uang muka</h3>
          <label>
            Jumlah *
            <Input
              required
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </label>
          <label>
            Tanggal diterima *
            <Input required type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <SelectionField
            label="Kas/Bank tujuan *"
            value={bank ? [bank] : []}
            options={(banks.data?.data ?? []).map((b) => ({
              id: b.id,
              name: `${b.name} · ${b.lastFour}`,
            }))}
            onChange={(v) => setBank(v[0] ?? "")}
          />
          {banks.isFetching && <p role="status">Memuat akun…</p>}
          {banks.isError && (
            <PageNotice tone="error" onRetry={() => void banks.refetch()}>
              {banks.error.message}
            </PageNotice>
          )}
          <label>
            Referensi bank
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
          <label>
            Bukti pembayaran *
            <Upload purpose="PAYMENT" onChange={setEvidence} />
          </label>
          <div>
            <Button disabled={pending || !bank || !evidence}>
              {pending ? "Menyimpan…" : "Simpan untuk verifikasi"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Batal
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
