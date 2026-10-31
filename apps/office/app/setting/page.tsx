"use client";
import Link from "next/link";
import { isAccessAdministrator } from "@evflow/contracts";
import { OfficePage } from "@/components/web/page-frame";
import { hasCompanyPermission } from "@/lib/navigation";
import { useSession } from "../session-provider";
import "./settings.css";

type Entry = { label: string; description: string; href: string; allowed: boolean };

/** Pengaturan terpusat (CFG-08): each card appears only when its own permission is held. */
export default function SettingHubPage() {
  const { principal } = useSession();
  const can = (code: string) => (principal ? hasCompanyPermission(principal, code) : false);
  const admin = isAccessAdministrator(principal);
  const groups: { title: string; entries: Entry[] }[] = [
    {
      title: "Perusahaan",
      entries: [
        {
          label: "Profil Perusahaan",
          description: "Nama, alamat, NPWP dan logo pada dokumen.",
          href: "/setting/company",
          allowed: can("company_profile.read"),
        },
        {
          label: "Kebijakan Umum",
          description: "Zona waktu, tahun buku, format angka dan parameter umum lain.",
          href: "/setting/general",
          allowed: can("setting_general.read"),
        },
      ],
    },
    {
      title: "Pengguna & Akses",
      entries: [
        {
          label: "Pengguna",
          description: "Akun, peran yang dipasang dan sesi aktif.",
          href: "/setting/users",
          allowed: admin,
        },
        {
          label: "Peran",
          description: "Peran bebas dan hak akses per menu.",
          href: "/setting/roles",
          allowed: admin,
        },
      ],
    },
    {
      title: "Penjualan",
      entries: [
        {
          label: "Termin & Kredit",
          description:
            "Daftar termin, ongkir bawaan, pelanggan baru dan cara memeriksa limit kredit.",
          href: "/setting/terms",
          allowed: can("terms_credit.read"),
        },
        {
          label: "Daftar Tarif Pajak",
          description: "Daftar pajak, PPN penjualan bawaan dan pajak pembelian bawaan.",
          href: "/setting/tax",
          allowed: can("tax_setting.read"),
        },
        {
          label: "Jenis Potongan",
          description:
            "Potongan yang boleh dipotong pelanggan dari pembayaran, akun penyelesaian dan buktinya.",
          href: "/setting/deductions",
          allowed: can("deduction_type.read"),
        },
        {
          label: "Pemetaan Akun",
          description:
            "Akun untuk jurnal otomatis, rekening bank dan periode; berlaku umum untuk seluruh transaksi.",
          href: "/setting/account-mapping",
          allowed: can("account_mapping.read"),
        },
      ],
    },
    {
      title: "Dokumen",
      entries: [
        {
          label: "Penomoran Dokumen",
          description: "Format nomor SO, invoice, surat jalan dan lainnya.",
          href: "/setting/numbering",
          allowed: can("numbering_rule.read"),
        },
      ],
    },
  ];
  const visible = groups
    .map((group) => ({ ...group, entries: group.entries.filter((entry) => entry.allowed) }))
    .filter((group) => group.entries.length);
  return (
    <OfficePage
      section="setting"
      crumbs={[{ label: "Setting" }]}
      title="Pengaturan"
      subtitle="Atur perusahaan, akses, penjualan dan dokumen di satu tempat."
    >
      {visible.length ? (
        <div className="setting-hub">
          {visible.map((group) => (
            <section key={group.title} className="page-frame-panel setting-hub-group">
              <h2>{group.title}</h2>
              {group.entries.map((entry) => (
                <Link key={entry.href + entry.label} className="setting-hub-link" href={entry.href}>
                  <strong>{entry.label}</strong>
                  <span>{entry.description}</span>
                </Link>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <p className="page-frame-subtitle">Anda belum memiliki akses ke pengaturan apa pun.</p>
      )}
    </OfficePage>
  );
}
