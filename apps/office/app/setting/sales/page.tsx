"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SelectionField } from "@/components/web/selection-field";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../../session-provider";
import type { Freight, NewCustomerCod, Term } from "../settings-forms";
import { SettingFrame, SettingSection, usePolicyForm } from "../settings-ui";

const kinds = [
  { id: "COD", name: "Tunai/COD" },
  { id: "PREPAY", name: "Bayar sebelum kirim" },
  { id: "TEMPO", name: "Tempo" },
];

function Choice({
  name,
  value,
  current,
  label,
  help,
  disabled,
  onSelect,
}: {
  name: string;
  value: string;
  current: string;
  label: string;
  help: string;
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <label className="setting-choice">
      <input
        type="radio"
        name={name}
        value={value}
        checked={current === value}
        disabled={disabled}
        onChange={() => onSelect(value)}
      />
      <span>{label}</span>
      <small>{help}</small>
    </label>
  );
}

export default function SalesSettingsPage() {
  const { principal } = useSession();
  const canEdit = principal ? hasCompanyPermission(principal, "terms_credit.update") : false;
  const terms = usePolicyForm<Term[]>("OPS-FLX-03"),
    freight = usePolicyForm<Freight>("OPS-FLX-04"),
    credit = usePolicyForm<string>("OPS-FLX-01"),
    cod = usePolicyForm<NewCustomerCod>("OPS-FLX-02");
  const updateTerm = (index: number, patch: Partial<Term>) =>
    terms.value &&
    terms.set(terms.value.map((term, i) => (i === index ? { ...term, ...patch } : term)));
  return (
    <SettingFrame
      title="Termin, Ongkos Kirim & Kredit"
      subtitle="Nilai bawaan untuk Sales Order baru. Pengguna tetap dapat mengubahnya di setiap SO."
      permission="terms_credit.read"
    >
      <div className="setting-stack">
        <SettingSection
          title="Termin pembayaran"
          description="Pilihan termin yang muncul di Sales Order dan invoice."
          form={terms}
          canEdit={canEdit}
        >
          <div className="setting-terms web-form setting-form">
            {terms.value?.map((term, index) => (
              <div key={`${term.code}-${index}`} className="setting-term-row">
                <label>
                  Nama termin
                  <Input
                    value={term.label}
                    disabled={!canEdit}
                    onChange={(e) => updateTerm(index, { label: e.target.value })}
                  />
                </label>
                <label>
                  Hari
                  <Input
                    inputMode="numeric"
                    value={String(term.days)}
                    disabled={!canEdit || term.kind !== "TEMPO"}
                    onChange={(e) =>
                      updateTerm(index, { days: Number.parseInt(e.target.value || "0", 10) || 0 })
                    }
                  />
                </label>
                <SelectionField
                  label="Jenis"
                  value={[term.kind]}
                  options={kinds}
                  onChange={(v) =>
                    canEdit &&
                    updateTerm(index, {
                      kind: (v[0] as Term["kind"]) ?? "TEMPO",
                      ...(v[0] !== "TEMPO" ? { days: 0 } : {}),
                    })
                  }
                />
                {canEdit && (
                  <Button
                    variant="outline"
                    disabled={(terms.value?.length ?? 0) <= 1}
                    onClick={() => terms.set(terms.value!.filter((_, i) => i !== index))}
                  >
                    Hapus
                  </Button>
                )}
              </div>
            ))}
            {canEdit && (
              <div>
                <Button
                  variant="outline"
                  onClick={() =>
                    terms.set([
                      ...(terms.value ?? []),
                      {
                        code: `T${Date.now().toString(36).toUpperCase()}`,
                        label: "Tempo 90 hari",
                        days: 90,
                        kind: "TEMPO",
                      },
                    ])
                  }
                >
                  Tambah termin
                </Button>
              </div>
            )}
          </div>
        </SettingSection>

        <SettingSection
          title="Ongkos kirim"
          description="Pilihan bawaan saat ongkos kirim diisi di Sales Order."
          form={freight}
          canEdit={canEdit}
        >
          {freight.value && (
            <div className="setting-choices">
              <Choice
                name="freight-mode"
                value="CHARGE_CUSTOMER"
                current={freight.value.mode}
                label="Dibebankan ke pelanggan"
                help="Ongkos kirim ditagihkan di invoice."
                disabled={!canEdit}
                onSelect={() => freight.set({ ...freight.value!, mode: "CHARGE_CUSTOMER" })}
              />
              <Choice
                name="freight-mode"
                value="COMPANY"
                current={freight.value.mode}
                label="Ditanggung perusahaan"
                help="Tidak ditagihkan; biaya kirim dicatat sebagai COGS/biaya pengiriman."
                disabled={!canEdit}
                onSelect={() => freight.set({ ...freight.value!, mode: "COMPANY" })}
              />
              {freight.value.mode === "CHARGE_CUSTOMER" && (
                <div className="setting-choices">
                  <Choice
                    name="freight-tax"
                    value="BEFORE_TAX"
                    current={freight.value.tax_position}
                    label="Sebelum PPN"
                    help="Ongkos kirim ikut dikenai PPN."
                    disabled={!canEdit}
                    onSelect={() => freight.set({ ...freight.value!, tax_position: "BEFORE_TAX" })}
                  />
                  <Choice
                    name="freight-tax"
                    value="AFTER_TAX"
                    current={freight.value.tax_position}
                    label="Sesudah PPN"
                    help="Ongkos kirim ditambahkan setelah PPN dan tidak dikenai pajak."
                    disabled={!canEdit}
                    onSelect={() => freight.set({ ...freight.value!, tax_position: "AFTER_TAX" })}
                  />
                </div>
              )}
              <p className="page-frame-subtitle">
                Akun jurnal untuk ongkos kirim diatur di Finance › Akuntansi.
              </p>
            </div>
          )}
        </SettingSection>

        <SettingSection
          title="Kredit pelanggan"
          description="Cara sistem memeriksa limit kredit pelanggan yang memiliki limit."
          form={credit}
          canEdit={canEdit}
        >
          {credit.value && (
            <div className="setting-choices">
              <Choice
                name="credit"
                value="OFF"
                current={credit.value}
                label="Nonaktif"
                help="Limit kredit tidak diperiksa."
                disabled={!canEdit}
                onSelect={credit.set}
              />
              <Choice
                name="credit"
                value="WARN"
                current={credit.value}
                label="Peringatan saja"
                help="SO tetap jalan; pengguna melihat peringatan bila melewati limit."
                disabled={!canEdit}
                onSelect={credit.set}
              />
              <Choice
                name="credit"
                value="BLOCK"
                current={credit.value}
                label="Blokir"
                help="SO yang melewati limit tertahan sampai pengecualian disetujui."
                disabled={!canEdit}
                onSelect={credit.set}
              />
            </div>
          )}
        </SettingSection>

        <SettingSection
          title="Pelanggan baru"
          description="Wajibkan pembayaran tunai untuk pelanggan baru selama periode awal."
          form={cod}
          canEdit={canEdit}
        >
          {cod.value && (
            <div className="setting-inline web-form setting-form">
              <label className="setting-inline">
                <Switch
                  checked={cod.value.enabled}
                  disabled={!canEdit}
                  onCheckedChange={(enabled) => cod.set({ ...cod.value!, enabled })}
                />
                {cod.value.enabled ? "Aktif" : "Nonaktif"}
              </label>
              {cod.value.enabled && (
                <>
                  <label>
                    Lama (bulan)
                    <Input
                      inputMode="numeric"
                      value={String(cod.value.months)}
                      disabled={!canEdit}
                      onChange={(e) =>
                        cod.set({
                          ...cod.value!,
                          months: Number.parseInt(e.target.value || "1", 10) || 1,
                        })
                      }
                    />
                  </label>
                  <SelectionField
                    label="Cara bayar"
                    value={[cod.value.mode]}
                    options={[
                      { id: "COD", name: "Tunai/COD saat barang diterima" },
                      { id: "PREPAY", name: "Bayar sebelum kirim" },
                    ]}
                    onChange={(v) =>
                      canEdit &&
                      cod.set({ ...cod.value!, mode: (v[0] as "COD" | "PREPAY") ?? "COD" })
                    }
                  />
                </>
              )}
            </div>
          )}
        </SettingSection>
      </div>
    </SettingFrame>
  );
}
