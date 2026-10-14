# Domain Setting

## Capability proforma — 7 Oktober 2026

`proforma.issue` mengizinkan pratinjau dan penerbitan manual proforma dari tahap
pemenuhan pada company/privileged scope yang sesuai. Terpisah dari sales_order.submit;
admin menetapkan melalui Peran → Atur Hak Akses. Penomoran memakai aturan aktif
`document_PROFORMA`; preview tidak mengonsumsi nomor. Tidak ada tarif/OPS baru.
Atas persetujuan eksplisit pengguna, role DEV_SALES_ORDER pada perusahaan fiktif lokal
menerima capability ini melalui layanan akses dan audit; sesi terdampak dicabut.

Status: sumber domain kanonis untuk pengaturan lintas ERP. Setting mengatur identitas perusahaan, izin, policy, approval, nomor, template, periode dan audit. Setting tidak mem-posting transaksi atau mengubah saldo.

## 1. Struktur submenu

1. Profil Perusahaan
2. Pengguna
3. Peran (termasuk Matriks Hak Akses pada detail peran)
4. Kebijakan Operasional
5. Kebijakan Pelanggan Baru
6. Kredit & Exposure
7. Pengaturan Persetujuan
8. Template Cetak
9. Penomoran Dokumen
10. Daftar Referensi & Alasan
11. Periode & Closing
12. Impor/Ekspor & Arsip
13. Audit

Master Data, transaksi, posting, stok, payroll, laporan dan Dashboard tetap dimiliki modul masing-masing. Setting hanya menyediakan konfigurasi, IAM, approval, nomor, template, referensi, periode, import orchestration dan audit read-only.

## 2. Profil Perusahaan

Pengguna dengan izin `company_profile.update` dapat mengubah nama perusahaan, nama legal, alamat, kontak, logo dan identitas profil melalui Edit → Simpan. Tidak ada tanggal berlaku, alasan atau approval wajib. Perubahan langsung berlaku pada tampilan dan dokumen baru. Dokumen issued/posted menyimpan snapshot identitas saat diterbitkan; cetak ulang tidak berubah.

## 3. Pengguna, peran dan hak akses

Satu akun dapat memiliki beberapa role. Jabatan tidak otomatis memberikan role. Dari daftar **Peran**, admin berizin memilih **Atur Hak Akses** untuk membuka Matriks Hak Akses pada detail peran. Matriks menggabungkan resource, action dan scope: lihat, buat, ubah draft, ajukan, setujui/tolak, posting, batalkan, cetak/ekspor dan tindakan khusus. Scope dapat self, subordinate, department, rayon, gudang, assigned portfolio, company atau privileged.

Izin efektif dihitung server pada setiap request, ekspor dan attachment. Akses biaya modal, payroll, rekening dan dokumen pribadi dipisahkan. Perubahan role, scope, sesi, privilege dan force revoke diaudit; pencabutan berlaku pada kedua frontend.

Login (dan MFA bila diaktifkan) membuat sesi server yang terikat pengguna serta membership aktif. Setelah login atau refresh, klien mengambil profil dan izin efektif sebelum menampilkan menu serta membuka stream perubahan. Perubahan role/scope/membership menaikkan versi izin dan memberi sinyal perubahan akses tanpa data privat; klien menutup stream lama, membatalkan request, menghapus cache privat, mengambil izin terbaru dan menyusun ulang navigasi. Logout menutup sesi yang dipakai; penonaktifan/offboarding/force revoke mencabut sesi yang dituju termasuk pada tab atau perangkat lain. Server segera menolak request dan subscribe/replay memakai sesi atau izin lama, sekalipun sinyal realtime belum diterima.

Pada login Office, akun dengan kredensial valid dan lebih dari satu membership aktif memilih perusahaan sebelum sesi dibuat. Tanpa `company_id`, respons `COMPANY_SELECTION_REQUIRED` hanya memberi daftar perusahaan aktif yang diizinkan; belum ada sesi, cookie autentikasi atau event sukses `auth.login`. Pengiriman ulang email/kata sandi yang sama bersama pilihan perusahaan tetap memeriksa ulang kredensial dan membership aktif. Perusahaan tidak dikenal, nonaktif atau di luar izin menghasilkan 401 generik. Pilihan perusahaan tidak memberikan role tambahan atau menggabungkan scope antarperusahaan. Setelah sukses, `/auth/me` menjadi gate akses privat; retry bootstrap tidak mengulang login. Tidak ada migration untuk kontrak ini. MFA belum wajib sesuai keputusan 26 September 2026; renovasi Office tidak mencakup recovery, login native atau penyelesaian penuh revocation realtime lintas perangkat.

## 4. Kebijakan Operasional

Katalog parameter editable berada pada [Kebijakan Operasional dan Konfigurasi UI](40-kebijakan-operasional-konfigurasi.md). Nilai awal bukan konstanta kode. Pengguna berizin memilih kelompok, Edit → Simpan, lalu sistem membuat versi, waktu dan actor otomatis. Perubahan langsung aktif secara default; tanggal berlaku, alasan atau approval hanya muncul bila definition policy mewajibkannya.

Kelompok policy: Perusahaan & Lokalisasi, Finance & Penagihan, Gudang & Pengadaan, CRM & Target, Kunjungan & Lokasi, HR & Perjalanan, Dashboard/Ekspor/Retensi. UI memvalidasi tipe, unit, rentang, urutan, overlap, konflik dan dependensi. Transaksi menyimpan snapshot policy. Invariant pada bagian 9 dokumen 40 tidak tersedia sebagai toggle.

### 4.1 Kebijakan pelanggan, TOP dan kredit

**Kebijakan Pelanggan Baru** menetapkan mode awal COD saat barang diterima atau Bayar sebelum Pengiriman. Setelah evaluasi Finance, pengguna berwenang dapat menetapkan fasilitas Tempo, TOP, limit kredit, tanggal efektif, toleransi dan status freeze/unlock pada kebijakan pelanggan tertentu. Nilai tersebut bukan atribut bebas yang mengubah saldo pada Master Data.

TOP dan limit kredit pelanggan dikelola melalui **Finance → Kredit & TOP Pelanggan** dengan referensi pelanggan dan versi kebijakan. Setting hanya menyediakan policy global/default; Finance menjadi pemilik evaluasi fasilitas, exposure, past due dan keputusan kredit. Sales membaca hasil kebijakan saat membuat atau mengevaluasi SO. SO dan invoice menyimpan snapshot TOP/limit/policy yang dipakai sehingga perubahan berikutnya tidak mengubah histori.

#### Pengaturan fasilitas per pelanggan

Alur layar: **Finance → Kredit & TOP Pelanggan → pilih pelanggan → Tambah/Revisi Fasilitas**. Form menampilkan identitas pelanggan dan histori versi, lalu menyediakan:

- mode pembayaran: COD, Prepay atau Tempo;
- TOP dan dasar jatuh tempo;
- limit kredit dan mata uang;
- tanggal mulai/berakhir serta cakupan perusahaan/channel bila relevan;
- toleransi, catatan evaluasi, bukti dan alasan keputusan;
- status Draft, Menunggu Persetujuan, Aktif, Ditangguhkan atau Berakhir.

Finance menyusun atau merevisi draft, sistem memeriksa kelengkapan dan konflik tanggal, lalu approval berjalan sesuai policy. Hanya versi **Aktif** yang dapat dipakai evaluasi SO; pelanggan baru tetap memakai mode awal COD/Prepay sampai fasilitas Tempo disetujui. Perubahan TOP atau limit tidak mengubah invoice/SO historis dan memerlukan snapshot baru untuk transaksi berikutnya. Master Data → Pelanggan hanya menampilkan ringkasan dan tautan read-only ke fasilitas ini.

TOP Supplier/Vendor tidak diatur pada Kredit & Exposure pelanggan. TOP tersebut ditetapkan pada **Warehouse & Logistik → Pengadaan → PO Supplier/PO Vendor** atau kontrak/MOU terkait, dengan basis jatuh tempo yang eksplisit. Finance menggunakan snapshot PO/kontrak untuk AP, pencocokan dan pembayaran. Pengadaan tidak mengubah limit kredit pelanggan.

## 5. Pengaturan Persetujuan

Policy approval memiliki jenis pengajuan, kondisi, scope, dasar nilai/mata uang, batas, tahap berurutan, mode any/all, approver user/role/atasan, delegasi, self-approval, reminder, escalation, pemicu reapproval, effective date dan version. Self-approval default nonaktif; nilai awal reminder 4 jam kerja dan escalation 1 hari kerja dapat dikonfigurasi.

Lifecycle: Draft → Validate/Simulate → Active → Inactive. Aktivasi ditolak bila assignee, scope, limit, fallback, prioritas atau jalur keputusan belum valid. Simulasi tidak menghasilkan keputusan. SO normal tidak memiliki approval rutin; approval dipakai untuk unlock SO dan exception domain.

Pengajuan: Draft → Menunggu Persetujuan → Disetujui / Perlu Revisi / Ditolak, dengan Dibatalkan atau Kedaluwarsa bila didukung. Revisi bisnis material membatalkan keputusan lama dan memulai evaluasi ulang. Delegasi tidak memperluas kewenangan; delegator dan pelaksana sebenarnya disimpan.

## 6. Template dan penomoran

Template memiliki jenis dokumen, versi, layout/kolom, status draft/published/retired, default dan preview. Publikasi menghasilkan versi baru. Dokumen issued menyimpan snapshot data, template dan file; perubahan default tidak mengubah histori. XML Coretax memakai generator/schema khusus.

Penomoran memiliki jenis, prefix, komponen periode, panjang urutan, reset policy, preview, counter atomik dan audit. Draft memakai referensi sementara; nomor resmi diambil pada penerbitan sesuai jenis. Nomor void tidak didaur ulang. Nomor faktur pajak dan nomor eksternal terpisah dari counter internal.

## 7. Referensi, periode, impor dan audit

Daftar alasan/status/reference dapat ditambah, diubah, diurutkan dan dinonaktifkan sesuai izin. Nilai yang sudah dipakai tidak dihapus dari histori. Periode memiliki timezone, fiscal year, Open/Closing/Closed dan Reopen berizin dengan alasan, reviewer dan audit.

Import mengikuti Staging → Validate → Preview → Commit → Arsip/Error Report. Retry memakai idempotency dan tidak menggandakan data. Ekspor menghasilkan file privat dengan expiry policy dan mencatat akses. Audit read-only menyimpan actor, action, resource, before/after terbatas, request id, timestamp dan reason bila relevan; data sensitif direduksi.

## 8. Kontrak API dan data

Resource utama: `/company-profile`, `/users`, `/roles`, `/permissions`, `/role-permissions`, `/operational-policies`, `/approval-policies`, `/approval-delegations`, `/approval-instances`, `/print-templates`, `/numbering-rules`, `/policies`, `/reasons`, `/periods`, `/audit-events` dan `/import-jobs`. Mutasi draft memakai `If-Match`; command memakai `Idempotency-Key`; scope/company ditentukan server.

Model data utama: `companies`, `users`, `auth_sessions`, `refresh_tokens`, `company_memberships`, `roles`, `permissions`, `role_permissions`, `user_roles`, `system_policies`, `policy_versions`, `approval_policies`, `approval_steps`, `approval_delegations`, `approval_instances`, `approval_actions`, `documents`, `document_sequences`, `print_templates`, `print_template_versions`, `reference_lists`, `reference_values`, `periods`, `import_jobs`, `import_rows` dan `audit_events`.

## 9. Invariant yang bukan konfigurasi bebas

- jurnal posted harus seimbang;
- posted/issued record tidak diedit atau dihapus langsung;
- koreksi memakai reversal, adjustment, retur, credit note atau proses resmi;
- saldo stok, AR/AP, kas/bank, GL dan payroll tidak diketik ulang;
- idempotency mencegah posting, movement dan pembayaran ganda;
- nomor resmi terpakai tidak didaur ulang;
- alokasi tidak melebihi saldo/qty sah;
- batch recall, expired, blocked atau karantina tidak dapat dikirim;
- izin, scope dan company isolation selalu diperiksa backend;
- SO normal tidak memakai approval manual rutin;
- PR/PO berada di Warehouse & Logistik, invoice/AP/pembayaran di Finance;
- dokumen issued mempertahankan snapshot identitas, nilai, template dan policy.

## 10. Kriteria penerimaan

1. Izin efektif dan scope diperiksa server pada UI, API dan ekspor.
2. Satu user dapat memiliki banyak role tanpa menggandakan suara approval.
3. Policy aktif memiliki version dan snapshot; policy wajib yang tidak lengkap menjadi blocker.
4. Approval policy dapat divalidasi dan disimulasikan tanpa memutus transaksi.
5. Template, nomor dan identitas dokumen historis tidak berubah setelah diterbitkan.
6. Counter nomor atomik, idempotent dan tidak mendaur ulang nomor void.
7. Import retry tidak menggandakan data.
8. Reopen periode, force revoke dan perubahan privilege diaudit.
9. Invariant tidak memiliki toggle pada UI.

## Pembaruan backend O2C — 5 Oktober 2026

DocumentNumberRule menyimpan company, documentKind, prefix, digits, resetYearly, effectiveFrom/effectiveTo dan pembuat. Rule aktif harus tepat satu; tidak ada nomor default bisnis tersembunyi. Pengelolaan memerlukan numbering_rule.manage, pembacaan numbering_rule.read. Kalender OPS-FIN-06 wajib dikonfigurasi. Approval policy harus tersedia untuk BANK_TRANSACTION, TAX_CORRECTION, CUSTOMER_REFUND, ADVANCE_REFUND, SOURCE_REVERSAL, FINANCE_CLOSE, TAX_RULE_CHANGE; tanpa policy proses ditolak. Rule pajak baru DRAFT dan diaktifkan lewat approval.

Rujukan implementasi dan batas verifikasi: [laporan remediasi backend O2C](../development/o2c-backend-remediation-2026-10-05.md).


## Pengelolaan akses — keputusan 7 Oktober 2026

IAM-01/04/11: pengguna dapat memiliki beberapa peran; izin efektif adalah gabungan izin peran aktif sesuai scope. Pengelolaan akun dan peran hanya untuk pemegang peran aktif Admin Sistem (`ADMIN_SYSTEM`) dalam perusahaan sesi, dengan permission aksi yang sesuai. Nama jabatan atau nama tampilan peran bukan bukti administrator. Pengguna → pilih akun → tetapkan beberapa peran; Peran → Atur Hak Akses → ubah checkbox matriks peran → simpan. Menu Pengguna/Peran/Matriks disembunyikan bagi nonadministrator; deep link dan seluruh endpoint `/users`, `/roles`, `/permissions` beserta mutasinya ditolak 403 walaupun permission IAM terlanjur diberikan. Pengaturan bisnis lain tetap mengikuti permission domain. Tidak ada bypass izin transaksi untuk Admin Sistem. Perubahan akses diaudit dan sesi terdampak dicabut. Tidak ada perubahan model database atau migration; implementasi dan batas validasi dicatat pada [catatan pengelolaan akses](../development/iam-admin-only-2026-10-07.md).
