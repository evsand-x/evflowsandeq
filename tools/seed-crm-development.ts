/** Additive CRM showcase fixtures; never production or runtime UI mocks. */
import "../packages/backend/node_modules/reflect-metadata";
import { prisma, type Prisma } from "../packages/database/src";
import { assertDevelopmentSeed } from "../packages/database/prisma/dev-seed-guard";
import { assertFictitiousCompany } from "./dev-company";
import { AuditService } from "../packages/backend/src/common/audit.service";
import { CrmService } from "../packages/backend/src/crm/crm.service";
import { AdministrationService } from "../packages/backend/src/administration/administration.service";

async function main() {
  assertDevelopmentSeed();
  const c = "00000000-0000-4000-8000-000000000001";
  const company = await prisma.company.findUniqueOrThrow({ where: { id: c } });
  await assertFictitiousCompany(company.id);
  const actor = await prisma.user.findUniqueOrThrow({
    where: { email: "demo.admin@evflow.local" },
    select: { id: true, active: true },
  });
  const a = actor.id;
  if (
    !actor.active ||
    !(await prisma.companyMembership.findFirst({
      where: { companyId: c, userId: a, active: true },
    }))
  )
    throw new Error("ACTIVE_MEMBERSHIP_REQUIRED");
  const audit = new AuditService(),
    crm = new CrmService(audit);
  const policy = await prisma.systemPolicy.findUniqueOrThrow({
    where: { companyId_code: { companyId: c, code: "OPS-WH-04" } },
    include: { versions: { where: { state: "ACTIVE" }, orderBy: { versionNo: "desc" }, take: 1 } },
  });
  const version = policy.versions[0]!;
  const value = version.valueSnapshot as Record<string, Prisma.InputJsonValue>;
  if (!value.opportunity)
    await new AdministrationService(audit).updatePolicy(c, a, "OPS-WH-04", version.versionNo, {
      value: { ...value, opportunity: "DEV-OPP" },
      reason: "Prefix peluang DATA UJI FIKTIF untuk review CRM",
    });
  const scenarios = [
    [
      "RS Simulasi Cendana",
      "Rumah Sakit",
      "Makassar",
      "POTENTIAL",
      "Presentasi paket diagnostik",
      "06",
      "Kebutuhan reagen untuk perluasan laboratorium",
      "Referensi pelanggan",
      "Alya Pramesti",
    ],
    [
      "Klinik Simulasi Pelita",
      "Klinik",
      "Gowa",
      "IN_PROGRESS",
      "Konfirmasi spesifikasi kebutuhan",
      "07",
      "Paket pemeriksaan rutin klinik",
      "Pameran kesehatan",
      "Bima Santoso",
    ],
    [
      "Lab Simulasi Aksara",
      "Laboratorium",
      "Maros",
      "POTENTIAL",
      "Diskusi jadwal pengadaan",
      "09",
      "Pengembangan layanan hematologi",
      "Permintaan masuk",
      "Citra Lestari",
    ],
    [
      "RS Simulasi Samudra",
      "Rumah Sakit",
      "Makassar",
      "NEW",
      "Perkenalan dengan tim pengadaan",
      "12",
      "Pemetaan kebutuhan awal rumah sakit",
      "Kunjungan langsung",
      "Damar Prakoso",
    ],
    [
      "Klinik Simulasi Arunika",
      "Klinik",
      "Gowa",
      "DEFERRED",
      "Tinjau kembali alokasi anggaran",
      "21",
      "Anggaran ditunda sampai rapat pengadaan berikutnya",
      "Referensi mitra",
      "Eka Wulandari",
    ],
    [
      "Lab Simulasi Benuanta",
      "Laboratorium",
      "Maros",
      "IN_PROGRESS",
      "Kirim spesifikasi teknis untuk review",
      "08",
      "Persiapan evaluasi alat laboratorium",
      "Pameran kesehatan",
      "Farhan Aditya",
    ],
    [
      "RS Simulasi Sagara",
      "Rumah Sakit",
      "Makassar",
      "DROPPED",
      null,
      null,
      "Kebutuhan dibatalkan oleh institusi pada skenario simulasi",
      "Referensi pelanggan",
      "Gita Maheswari",
    ],
    [
      "Klinik Simulasi Nirmala",
      "Klinik",
      "Gowa",
      "NEW",
      null,
      null,
      "Kebutuhan dan jadwal belum dikonfirmasi",
      "Permintaan masuk",
      "Hana Permata",
    ],
  ] as const;
  const results = [];
  for (const [i, s] of scenarios.entries()) {
    const [name, channelName, region, status, action, day, notes, source, pic] = s;
    const channel = await prisma.customerChannel.upsert({
      where: {
        companyId_code: {
          companyId: c,
          code: `DEV-CRM-${channelName.toUpperCase().replaceAll(" ", "-")}`,
        },
      },
      update: {},
      create: {
        companyId: c,
        code: `DEV-CRM-${channelName.toUpperCase().replaceAll(" ", "-")}`,
        name: `${channelName} · Simulasi`,
        normalizedName: `${channelName.toLowerCase()} · simulasi`,
        createdById: a,
        updatedById: a,
      },
    });
    const rayon = await prisma.rayon.upsert({
      where: { companyId_code: { companyId: c, code: `DEV-CRM-${region.toUpperCase()}` } },
      update: {},
      create: {
        companyId: c,
        code: `DEV-CRM-${region.toUpperCase()}`,
        name: `${region} · Simulasi`,
        normalizedName: `${region.toLowerCase()} · simulasi`,
        createdById: a,
        updatedById: a,
      },
    });
    const previous = await prisma.prospect.findFirst({
      where: { companyId: c, customer: { normalizedName: name.toLowerCase() } },
    });
    const prospect = await crm.createProspect(
      c,
      a,
      {
        new_customer: {
          name,
          channel_id: channel.id,
          rayon_id: rayon.id,
          primary_address: `Kawasan Simulasi ${region} — alamat fiktif untuk review`,
        },
        owner_id: a,
        source,
        next_action: action,
        next_action_at: day ? `2026-10-${day}T02:00:00.000Z` : null,
        notes: `DATA UJI FIKTIF. ${notes}`,
        needs: [
          {
            description: notes,
            estimated_qty: i % 3 === 0 ? null : String((i + 1) * 10),
            needed_period: "Oktober 2026",
            notes: "Diskusi spesifikasi dengan PIC sebelum penawaran.",
          },
          {
            description: "Bahan habis pakai penunjang pemeriksaan",
            estimated_qty: null,
            needed_period: "November 2026",
            notes: "Volume pemakaian masih dikonfirmasi.",
          },
        ],
      },
      `crm-modern-v1-prospect-${i}`,
    );
    if (!previous && status !== "NEW")
      await crm.updateProspectStatus(
        c,
        a,
        prospect.id,
        prospect.version,
        status,
        `DATA UJI FIKTIF. ${notes}`,
      );
    const contacts = [];
    for (const n of [0, 1]) {
      const existingContact = await prisma.contact.findFirst({
        where: {
          companyId: c,
          customerId: prospect.customerId,
          email: `crm-${i + 1}-${n + 1}@example.invalid`,
          notes: "DATA UJI FIKTIF. Kontak simulasi, tidak untuk komunikasi eksternal.",
        },
      });
      // Correct only the untouched fixture from the first local seed run.
      // Contacts are master data; there is no contact-update command in this slice.
      if (
        existingContact?.version === 1 &&
        JSON.stringify(existingContact.picFunctions) === '["PAYMENT"]'
      ) {
        await prisma.$transaction(async (tx) => {
          await tx.contact.update({
            where: { id: existingContact.id },
            data: { picFunctions: ["FINANCE"], version: { increment: 1 }, updatedById: a },
          });
          await audit.recordWith(tx, {
            companyId: c,
            actorId: a,
            action: "development.crm_contact.corrected",
            resourceType: "contact",
            resourceId: existingContact.id,
            before: { pic_functions: ["PAYMENT"] },
            after: { pic_functions: ["FINANCE"] },
            reason: "Normalisasi fungsi PIC fixture ke katalog CRM",
          });
        });
      }
      contacts.push(
        existingContact ??
          (await crm.createContact(
            c,
            a,
            {
              customer_id: prospect.customerId,
              full_name: `${pic}${n ? " — PIC Keuangan" : " — PIC Pengadaan"}`,
              nickname: pic.split(" ")[0],
              job_title: n ? "Koordinator Keuangan" : "Kepala Pengadaan",
              department: n ? "Keuangan" : "Pengadaan & Logistik",
              pic_functions: n ? ["FINANCE"] : ["PURCHASING", "RECEIVING"],
              email: `crm-${i + 1}-${n + 1}@example.invalid`,
              notes: "DATA UJI FIKTIF. Kontak simulasi, tidak untuk komunikasi eksternal.",
            },
            `crm-modern-v1-contact-${i}-${n}`,
          )),
      );
    }
    if (status !== "DROPPED" && status !== "NEW") {
      await crm.createOpportunity(
        c,
        a,
        {
          prospect_id: prospect.id,
          period: "2026-10",
          source_need_ids: prospect.needs.map((n) => n.id),
          contact_ids: contacts.map((n) => n.id),
          notes: `${notes} — DATA UJI FIKTIF`,
        },
        `crm-modern-v1-opportunity-${i}`,
      );
    }
    results.push({ name, prospect_id: prospect.id, contacts: contacts.length });
  }
  await audit.record({
    companyId: c,
    actorId: a,
    action: "development.crm_seed.applied",
    resourceType: "development_seed",
    metadata: { version: "crm-modern-v1", prospect_ids: results.map((r) => r.prospect_id) },
  });
  console.log(
    JSON.stringify(
      {
        company: company.name,
        scenarios: results,
        prospects: results.length,
        contacts: results.length * 2,
        opportunities: 5,
      },
      null,
      2,
    ),
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Seed failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
