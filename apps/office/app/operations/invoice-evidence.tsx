"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/api";

/**
 * Unggah bukti pembayaran (PAYMENT) atau bukti potong (TAX) untuk satu Invoice terposting.
 * Disimpan privat; id bukti dikirim bersama perintah pembayaran.
 */
export function InvoiceEvidenceUpload({
  invoiceId,
  purpose,
  label,
  invalid = false,
  onChange,
}: {
  invoiceId: string;
  purpose: "PAYMENT" | "TAX";
  label: string;
  invalid?: boolean;
  onChange: (id: string, name: string) => void;
}) {
  const id = useId();
  const [state, setState] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="inv-upload">
      <label htmlFor={id} className={`inv-upload-btn ${invalid ? "inv-upload-invalid" : ""}`}>
        {busy ? "Mengunggah…" : label}
      </label>
      <input
        id={id}
        type="file"
        className="sr-only"
        accept="image/jpeg,image/png"
        disabled={busy}
        aria-invalid={invalid || undefined}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          onChange("", "");
          if (file.size > 2097152) return setState("Ukuran melebihi 2 MB.");
          setBusy(true);
          setState("");
          try {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result).split(",")[1]!);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            const r = await apiRequest<{ data: { id: string } }>(
              `/sales-invoices/${invoiceId}/payment-evidence`,
              { method: "POST", body: JSON.stringify({ purpose, name: file.name, base64 }) },
            );
            onChange(r.data.id, file.name);
            setState(`Tersimpan: ${file.name}`);
          } catch (error) {
            setState(error instanceof Error ? error.message : "Unggah gagal.");
          } finally {
            setBusy(false);
          }
        }}
      />
      <span role="status" className="sor-hint">
        {state || "JPEG/PNG, maksimal 2 MB."}
      </span>
    </div>
  );
}

/** Tampilkan bukti tersimpan yang melekat pada pembayaran atau pemotongan invoice ini. */
export function InvoiceEvidenceView({
  invoiceId,
  evidenceId,
  label = "Lihat bukti",
}: {
  invoiceId: string;
  evidenceId: string;
  label?: string;
}) {
  const [image, setImage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <span className="inv-evidence">
      <Button
        type="button"
        variant="link"
        size="sm"
        disabled={busy}
        onClick={async () => {
          if (image) return setImage("");
          setBusy(true);
          setError("");
          try {
            const r = await apiRequest<{ data: { image: string } }>(
              `/sales-invoices/${invoiceId}/payment-evidence/${evidenceId}`,
            );
            setImage(r.data.image);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Bukti belum dapat dimuat.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {image ? "Tutup bukti" : label}
      </Button>
      {error && (
        <span role="alert" className="sor-err">
          {error}
        </span>
      )}
      {image && <img src={image} alt="Bukti tersimpan" className="inv-evidence-img" />}
    </span>
  );
}
