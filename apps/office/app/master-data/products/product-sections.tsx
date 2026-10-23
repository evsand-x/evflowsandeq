"use client";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageNotice } from "@/components/web/page-frame";
import { SelectionField } from "@/components/web/selection-field";
import { apiRequest } from "@/lib/api";
import { Evidence, Upload } from "../../operations/workspace";
import { formatDecimal, useCan, useMasterKey, type MasterState } from "../master-shared";
import { registrationLabel, type Product, type Registration } from "./product-workspace";

const decimal = /^\d+(\.\d+)?$/;
const toDecimal = (value: string) => value.trim().replace(/\./g, "").replace(",", ".");
const date = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "—";

function useUomOptions() {
  const can = useCan(),
    key = useMasterKey();
  return useQuery({
    queryKey: key("uoms", "options"),
    queryFn: () =>
      apiRequest<{ data: { id: string; code: string; name: string; state: MasterState }[] }>(
        "/master-data/uoms",
      ).then((r) => r.data.filter((u) => u.state === "ACTIVE")),
    enabled: can("master_uom.read"),
  });
}

// Panel tindakan kecil di dalam tab detail; setiap simpan memanggil command backend tersendiri.
function ActionPanel({
  title,
  open,
  onOpen,
  onCancel,
  onSubmit,
  busy,
  error,
  children,
}: {
  title: string;
  open: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onSubmit: () => void;
  busy: boolean;
  error: string;
  children: ReactNode;
}) {
  if (!open)
    return (
      <div className="page-frame-actions" style={{ marginBottom: 12 }}>
        <Button variant="outline" onClick={onOpen}>
          <Plus aria-hidden="true" />
          {title}
        </Button>
      </div>
    );
  return (
    <form
      className="web-form page-frame-panel"
      style={{ marginBottom: 16 }}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="page-frame-fields">{children}</div>
      {error && <PageNotice tone="error">{error}</PageNotice>}
      <div className="page-frame-actions" style={{ justifyContent: "flex-end" }}>
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Menyimpan…" : "Simpan"}
        </Button>
      </div>
    </form>
  );
}

function useCommand(onChanged: () => void) {
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const run = async (path: string, body: unknown, success: string) => {
    setBusy(true);
    setError("");
    try {
      await apiRequest(path, { method: "POST", body: JSON.stringify(body) });
      await cache.invalidateQueries({ queryKey: ["master-workspace"] });
      toast.success(success);
      onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (!rows.length) return <p className="page-frame-subtitle">Belum tersedia.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="text-muted-foreground px-3 py-2 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-t">
              {cells.map((cell, j) => (
                <td key={j} className="px-3 py-3 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function UomSection({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const can = useCan(),
    uoms = useUomOptions(),
    command = useCommand(onChanged);
  const [open, setOpen] = useState(false),
    [uom, setUom] = useState(""),
    [factor, setFactor] = useState("");
  const submit = async () => {
    const value = toDecimal(factor);
    if (!uom || !decimal.test(value)) return command.setError("Pilih satuan dan isi faktor desimal positif.");
    if (await command.run(`/master-data/products/${product.id}/uoms`, { uom_id: uom, factor_to_base: value }, "Konversi satuan ditambahkan")) {
      setOpen(false);
      setUom("");
      setFactor("");
    }
  };
  return (
    <>
      {can("master_product.update") && (
        <ActionPanel
          title="Tambah konversi"
          open={open}
          onOpen={() => setOpen(true)}
          onCancel={() => setOpen(false)}
          onSubmit={() => void submit()}
          busy={command.busy}
          error={command.error}
        >
          {uoms.data ? (
            <SelectionField
              label="Satuan *"
              value={uom ? [uom] : []}
              options={uoms.data.map((u) => ({ id: u.id, name: u.name, code: u.code }))}
              placeholder="Pilih satuan"
              onChange={(v) => setUom(v[0] ?? "")}
            />
          ) : (
            <PageNotice>Memerlukan izin melihat Satuan.</PageNotice>
          )}
          <label>
            Isi per satuan ini (dalam {product.base_uom?.name}) *
            <Input inputMode="decimal" value={factor} onChange={(e) => setFactor(e.target.value)} />
          </label>
        </ActionPanel>
      )}
      <Table
        head={["Satuan", "Faktor ke satuan dasar", "Berlaku sejak", "Status"]}
        rows={(product.uoms ?? []).map((u) => [
          u.uom.name,
          formatDecimal(u.factor_to_base),
          date(u.effective_from),
          u.active ? (u.uom.id === product.base_uom.id ? "Satuan dasar" : "Aktif") : "Tidak berlaku",
        ])}
      />
      <p className="page-frame-subtitle" style={{ marginTop: 12 }}>
        Konversi baru hanya berlaku untuk dokumen baru.
      </p>
    </>
  );
}

function VerifyActions({ registration, onChanged }: { registration: Registration; onChanged: () => void }) {
  const command = useCommand(onChanged);
  const [status, setStatus] = useState(""),
    [reason, setReason] = useState("");
  if (!status)
    return (
      <div className="flex flex-wrap gap-2">
        {(["VALID", "EXPIRED", "INVALID"] as const).map((s) => (
          <Button key={s} size="sm" variant="outline" onClick={() => setStatus(s)}>
            Tandai {registrationLabel[s]!.toLowerCase()}
          </Button>
        ))}
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs">
        Alasan {status === "VALID" ? "(opsional)" : "*"}
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      {command.error && <span className="page-frame-field-error">{command.error}</span>}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setStatus("")}>
          Batal
        </Button>
        <Button
          size="sm"
          disabled={command.busy || (status !== "VALID" && reason.trim().length < 3)}
          onClick={() =>
            void command.run(
              `/master-data/product-registrations/${registration.id}/verify`,
              reason.trim() ? { status, reason: reason.trim() } : { status },
              `Izin edar ditandai ${registrationLabel[status]!.toLowerCase()}`,
            )
          }
        >
          Simpan keputusan
        </Button>
      </div>
    </div>
  );
}

export function RegistrationSection({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const can = useCan(),
    command = useCommand(onChanged);
  const empty = { permit_type: "AKL", permit_number: "", holder: "", issued_on: "", expires_on: "", evidence: "" };
  const [open, setOpen] = useState(false),
    [values, setValues] = useState(empty);
  const set = (field: keyof typeof empty, value: string) => setValues((v) => ({ ...v, [field]: value }));
  const submit = async () => {
    if (!values.permit_number.trim() || !values.holder.trim())
      return command.setError("Nomor izin dan pemegang izin wajib diisi.");
    const body = {
      permit_type: values.permit_type,
      permit_number: values.permit_number.trim(),
      holder: values.holder.trim(),
      issued_on: values.issued_on || null,
      expires_on: values.expires_on || null,
      ...(values.evidence ? { evidence_object_key: values.evidence } : {}),
    };
    if (await command.run(`/master-data/products/${product.id}/registrations`, body, "Izin edar ditambahkan")) {
      setOpen(false);
      setValues(empty);
    }
  };
  return (
    <>
      {can("master_product.update") && (
        <ActionPanel
          title="Tambah izin edar"
          open={open}
          onOpen={() => setOpen(true)}
          onCancel={() => setOpen(false)}
          onSubmit={() => void submit()}
          busy={command.busy}
          error={command.error}
        >
          <SelectionField
            label="Jenis izin *"
            value={[values.permit_type]}
            options={[
              { id: "AKL", name: "AKL" },
              { id: "AKD", name: "AKD" },
            ]}
            onChange={(v) => set("permit_type", v[0] ?? "AKL")}
          />
          <label>
            Nomor izin *
            <Input value={values.permit_number} onChange={(e) => set("permit_number", e.target.value)} />
          </label>
          <label>
            Pemegang izin *
            <Input value={values.holder} onChange={(e) => set("holder", e.target.value)} />
          </label>
          <label>
            Tanggal terbit
            <Input type="date" value={values.issued_on} onChange={(e) => set("issued_on", e.target.value)} />
          </label>
          <label>
            Berlaku sampai
            <Input type="date" value={values.expires_on} onChange={(e) => set("expires_on", e.target.value)} />
          </label>
          <div className="span-full">
            <Upload purpose="PRODUCT_MASTER" onChange={(id) => set("evidence", id)} />
          </div>
        </ActionPanel>
      )}
      <Table
        head={["Izin", "Pemegang", "Berlaku sampai", "Status", "Bukti", "Keputusan"]}
        rows={product.registrations.map((r) => [
          `${r.permit_type} ${r.permit_number}`,
          r.holder,
          date(r.expires_on),
          <span key="s">
            {registrationLabel[r.status]}
            {r.disposition_reason && <span className="page-frame-subtitle block">{r.disposition_reason}</span>}
          </span>,
          <Evidence key="e" id={r.evidence_object_key ?? undefined} />,
          r.status === "PENDING" && can("master_product.activate") ? (
            <VerifyActions key="v" registration={r} onChanged={onChanged} />
          ) : (
            "—"
          ),
        ])}
      />
      <p className="page-frame-subtitle" style={{ marginTop: 12 }}>
        Izin baru selalu menunggu verifikasi. Status valid memerlukan bukti dan keputusan pemegang izin aktivasi produk.
      </p>
    </>
  );
}

export function PriceSection({ product, onChanged }: { product: Product; onChanged: () => void }) {
  const can = useCan(),
    command = useCommand(onChanged);
  const productUoms = (product.uoms ?? []).filter((u) => u.active).map((u) => u.uom);
  const empty = { kind: "PURCHASE", uom_id: product.base_uom.id, currency: "", unit_price: "", effective_from: "" };
  const [open, setOpen] = useState(false),
    [values, setValues] = useState(empty);
  const set = (field: keyof typeof empty, value: string) => setValues((v) => ({ ...v, [field]: value }));
  const submit = async () => {
    const price = toDecimal(values.unit_price);
    if (!decimal.test(price)) return command.setError("Isi harga dengan format 1.250.000,50.");
    if (!/^[A-Z]{3}$/.test(values.currency)) return command.setError("Isi kode mata uang tiga huruf.");
    if (!values.effective_from) return command.setError("Isi tanggal mulai berlaku.");
    const body = {
      kind: values.kind,
      uom_id: values.uom_id,
      currency: values.currency,
      unit_price: price,
      effective_from: new Date(`${values.effective_from}T00:00:00`).toISOString(),
    };
    if (await command.run(`/master-data/products/${product.id}/reference-prices`, body, "Harga acuan ditambahkan")) {
      setOpen(false);
      setValues(empty);
    }
  };
  const kinds: Record<string, string> = { PURCHASE: "Harga Beli Acuan", SALE: "Harga Jual Standar" };
  return (
    <>
      {can("master_product.update") && (
        <ActionPanel
          title="Tambah harga acuan"
          open={open}
          onOpen={() => setOpen(true)}
          onCancel={() => setOpen(false)}
          onSubmit={() => void submit()}
          busy={command.busy}
          error={command.error}
        >
          <SelectionField
            label="Jenis harga *"
            value={[values.kind]}
            options={Object.entries(kinds).map(([id, name]) => ({ id, name }))}
            onChange={(v) => set("kind", v[0] ?? "PURCHASE")}
          />
          <SelectionField
            label="Satuan *"
            value={[values.uom_id]}
            options={productUoms.map((u) => ({ id: u.id, name: u.name }))}
            onChange={(v) => set("uom_id", v[0] ?? product.base_uom.id)}
          />
          <label>
            Harga per satuan *
            <Input inputMode="decimal" placeholder="1.250.000" value={values.unit_price} onChange={(e) => set("unit_price", e.target.value)} />
          </label>
          <label>
            Mata uang *
            <Input maxLength={3} placeholder="IDR" value={values.currency} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
          </label>
          <label>
            Berlaku sejak *
            <Input type="date" value={values.effective_from} onChange={(e) => set("effective_from", e.target.value)} />
          </label>
        </ActionPanel>
      )}
      <Table
        head={["Jenis", "Satuan", "Harga", "Berlaku sejak", "Berlaku sampai"]}
        rows={(product.reference_prices ?? []).map((p) => [
          kinds[p.kind],
          p.uom?.name,
          formatDecimal(p.unit_price, p.currency),
          date(p.effective_from),
          p.effective_to ? date(p.effective_to) : "Berjalan",
        ])}
      />
      <p className="page-frame-subtitle" style={{ marginTop: 12 }}>
        Harga acuan bukan HPP atau nilai stok. Harga baru tidak menulis ulang dokumen historis.
      </p>
    </>
  );
}
