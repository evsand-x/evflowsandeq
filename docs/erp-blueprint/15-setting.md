# Domain Setting

## Keputusan 24 Oktober 2026 — konsolidasi pengaturan

Mengikuti [desain konsolidasi](../superpowers/specs/2026-10-24-konsolidasi-pengaturan-design.md). Submenu Setting: Profil Perusahaan, Pengguna, Peran (termasuk batas diskon per peran dan per orang), Kebijakan Umum (zona waktu, tahun buku, mata uang dari data perusahaan; format angka), Penomoran Dokumen (IAM-06), Pajak (FIN-17), Termin & Kredit (daftar termin, mode kredit, ongkir bawaan), Jenis Potongan (FIN-18), Pemetaan Akun, Persetujuan (tahap 4). Setiap submenu memiliki izin sendiri (CFG-11). Kebijakan duplikat identitas perusahaan (`OPS-COMP-01..03`) dihentikan.


## Keputusan 24 Oktober 2026 — Pengaturan terpusat

Mengikuti register README dan [desain arah fleksibel](../superpowers/specs/2026-10-24-erp-fleksibel-design.md). Setting menjadi satu tempat untuk mengatur aplikasi seperti ERP SaaS pada umumnya. Semua parameter bisnis dapat diedit pengguna berizin, dan konfigurasi yang dibutuhkan transaksi tersedia sejak awal sebagai nilai bawaan (CFG-08). Profil Perusahaan (nama, alamat, kontak, NPWP, logo) diedit langsung (IAM-10). Hanya Rupiah; format angka diatur (CFG-09). Struktur Organisasi (IAM-12) dan mesin persetujuan umum (IAM-02/07) dikelola di sini. Peran dibuat bebas tanpa preset (IAM-13); Pengguna, Peran dan Hak Akses tetap khusus Admin Sistem untuk mencegah pengguna menaikkan haknya sendiri, sedangkan pengaturan lain memakai izin per submenu sehingga dapat didelegasikan. Menu yang belum berfungsi disembunyikan (CFG-10). Master pajak tetap di Finance → Pajak dan ditautkan dari Setting.

**Implementasi tahap 2 (24 Oktober 2026):** hub `/setting`, Profil Perusahaan (`/setting/company`), Penomoran Dokumen (`/setting/numbering`), Termin, Ongkos Kirim & Kredit (`/setting/sales`, kebijakan `OPS-FLX-01..04`) dan Kebijakan Operasional (`/setting/policies`). Navigasi menampilkan Kebijakan Pelanggan Baru dan Kredit & Exposure sebagai satu entri "Termin, Ongkos Kirim & Kredit"; matriks izin tetap memisahkan capability-nya. Nilai bawaan dan 156 akun dibuat oleh provisioning idempotent. Bukti: [catatan implementasi](../development/setting-hub-2026-10-24.md).

## Submenu Akun dan migrasi master — 16 Oktober 2026

Matriks menampilkan Finance → Akuntansi → Akun dengan izin independen account.read, account.create, account.update, account.import. Admin Sistem tetap penuh dalam perusahaan aktif; grant peran biasa lama tidak diperluas otomatis. Mapping jurnal dan akun pajak tetap konfigurasi Finance berbasis ID akun, bukan hardcode kode sumber. Kode pada migrasi lokal hanya data konfigurasi pengguna. Riwayat audit mencatat impor, pemetaan dan penonaktifan akun uji.

### Penyempurnaan master pajak — 16 Oktober 2026

Admin mengatur penggunaan master pajak dan akun melalui Finance/Pajak. Pemeriksaan kesesuaian penggunaan adalah validasi backend; tidak memperkenalkan pengelompokan domain izin atau grant baru.

## Pembaruan pajak operasional — 16 Oktober 2026

Pengaturan master pajak operasional berada pada Finance → Pajak → Daftar & Aturan Pajak. Persentase, jenis, tambah/potong, akun, pembulatan dan status editable pengguna berizin tanpa approval. Hak independen tax_master.read/create/update, tax_output.read/update, tax_input.read/update dapat diatur Admin Sistem; hak administrator penuh tetap berlaku. Versi/audit/snapshot dan isolasi perusahaan merupakan invariant backend. Kebijakan approval konfigurasi lama tidak berlaku untuk master pajak ini.


## Izin independen per submenu — keputusan terbaru 16 Oktober 2026

- Setiap submenu operasional memiliki identitas izin tersendiri untuk setiap tindakan yang tersedia. Izin baca, buat, ubah, hapus dan tindakan bisnis diperiksa sesuai capability nyata.
- Satu grant induk, seperti izin umum CRM atau Master Data, tidak boleh mengizinkan beberapa submenu sekaligus ataupun dipakai sebagai fallback. Prospek, Kontak dan Pelanggan harus dapat dibatasi secara terpisah. Tidak ada pewarisan izin otomatis dari induk navigasi. Tab Kontak pada Master Data › Pelanggan memakai grant `crm_contact` yang sama dengan menu CRM › Kontak, sehingga matriks izin tidak menambah checkbox kedua untuk data yang sama.
- Induk hanya menjadi pengelompokan. Pilih Semua pada induk mengubah pilihan grant masing-masing anak; penyimpanan tetap berupa grant anak individual. Jika induk memiliki halaman operasional sendiri, izin halaman tersebut hanya berlaku untuk halaman itu.
- Backend menegakkan izin submenu pada endpoint, query, ekspor dan data terkait. Menyembunyikan menu atau menggandakan checkbox untuk ID grant yang sama tidak memenuhi aturan. Endpoint yang dipakai beberapa layar harus menjaga pemisahan kemampuan dan tidak mempercayai asal menu yang dikirim klien sebagai bukti izin.
- Hak bawaan Admin Sistem tetap penuh dalam perusahaan sesi. Peran biasa mengikuti gabungan grant aktif dan scope; isolasi perusahaan serta invariant transaksi tetap berlaku.
- Migrasi dari grant bersama wajib memiliki pemetaan yang dapat ditinjau dan audit, tanpa memperluas hak peran lama secara diam-diam. Peran baru tetap menerima seluruh capability yang tersedia saat dibuat sesuai keputusan sebelumnya.
- Gate IAM-01/04: buktikan bahwa memberi atau mencabut izin submenu A tidak mengubah izin submenu B, termasuk akses API langsung, gabungan peran, ekspor dan data terkait. Capability yang belum dibangun tidak diberi checkbox semu. Implementasi yang masih berbagi grant dicatat sebagai utang migrasi dan belum lulus gate izin independen.

Ketentuan ini menggantikan pemetaan bersama CRM/Master Data yang sebelumnya diterima sebagai tampilan sementara.

Keputusan terbaru 16 Oktober 2026: Admin Sistem dapat mengatur izin semua menu yang operasional. Tujuh tampilan Dashboard memiliki izin baca tersendiri, sementara data tetap dibatasi izin/scope sumber. Sejak 24 Oktober 2026 menu yang belum berfungsi disembunyikan dari navigasi dan matriks. Pengosongan grant peran biasa lama yang diminta pengguna telah dilakukan pada database development lokal secara auditabel, bukan sebagai migrasi global.

Penghapusan, penonaktifan, atau perubahan grant peran biasa mencabut sesi anggota yang kehilangan atau mendapat izin baru. Bila anggota itu tetap memegang peran aktif `ADMIN_SYSTEM`, sesinya dipertahankan: hak Admin Sistem tidak berubah dan principal/izin dibaca ulang dari database pada setiap request. Pengubahan keanggotaan atau penonaktifan Admin Sistem sendiri tetap mengikuti aturan pencabutan sesi dan perlindungan administrator terakhir.

## Keputusan IAM terbaru — 16 Oktober 2026

Admin Sistem (`ADMIN_SYSTEM`) memiliki hak penuh dalam perusahaan sesi untuk mengatur aplikasi dan menjalankan transaksi. Hak itu melekat pada peran aktif dan tidak bergantung pada grant checkbox. Admin dapat memutus approval tanpa penunjukan dan untuk pengajuannya sendiri; audit mencatat pelaku dan keputusan. Peran lain fleksibel: dibuat, diubah, dihapus, serta dapat digabung pada seorang pengguna. Penghapusan peran melepas penugasan, mencabut sesi anggota dan diaudit. Peran Admin Sistem dilindungi sebagai jalur administrasi. Matriks hak akses disusun menurut fitur/tindakan tanpa kelompok atau filter domain. Aturan ini menggantikan paragraf IAM-01/04/11 lama di akhir dokumen yang mewajibkan permission aksi tambahan dan melarang bypass transaksi Admin Sistem. Isolasi perusahaan, status dan invariant bisnis tetap berlaku.

Matriks memakai urutan jalur navigasi Office, bukan urutan alfabet resource. Untuk Admin Sistem, capability backend yang tersedia ditampilkan tercentang otomatis meski tidak tersimpan sebagai grant. Layar/menu tanpa capability tersendiri diberi **Belum dapat diatur** dan tidak menyediakan checkbox. Matriks tidak menyediakan filter domain.

Peran biasa baru mendapat seluruh capability yang tersedia dalam katalog saat pembuatan dengan cakupan perusahaan; grant dicatat atomik bersama peran. Peran lama tidak diubah otomatis. Admin Sistem dapat memilih semua izin pada matriks peran lama sebagai draf, meninjau dampaknya, lalu menyimpan satu peran setiap kali. Sesi anggota terdampak dicabut dan diff diaudit. Penambahan capability katalog nanti tidak otomatis memperluas peran biasa yang sudah dibuat. Hak `ADMIN_SYSTEM` tetap bawaan dan tidak disimpan sebagai grant.

Daftar Pengguna dan Peran menyediakan aksi Hapus dengan konfirmasi bagi Admin Sistem. Pengguna tanpa riwayat pemakaian dapat dihapus permanen; pengguna bersejarah diarsipkan melalui `company_memberships.deleted_at`, dinonaktifkan, dikeluarkan dari daftar dan tidak dapat diedit sebagai akun aktif. Hapus menolak akun sendiri dan Admin Sistem terakhir, mencabut sesi, melepas penugasan peran, dan mencatat audit. Email akun terarsip tetap unik/terpakai. Peran biasa dihapus sesuai dampak anggota; `ADMIN_SYSTEM` tidak dapat dihapus.

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
4. Struktur Organisasi
5. Kebijakan Operasional (termasuk format angka Rupiah)
6. Termin & Ongkos Kirim
7. Kebijakan Pelanggan Baru (opsional)
8. Kredit & Exposure (mode Nonaktif/Peringatan/Blokir)

Butir 6–8 tampil di navigasi sebagai satu halaman "Termin, Ongkos Kirim & Kredit".
9. Pengaturan Persetujuan
10. Template Cetak
11. Penomoran Dokumen
12. Daftar Referensi & Alasan
13. Periode & Closing
14. Impor/Ekspor & Arsip
15. Audit

Submenu hanya tampil setelah berfungsi (CFG-10).

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

**Kebijakan Pelanggan Baru** bersifat opsional (default nonaktif): bila dinyalakan, menetapkan mode awal COD saat barang diterima atau Bayar sebelum Pengiriman beserta durasinya. Pengguna berwenang dapat menetapkan termin bawaan, limit kredit (opsional), tanggal efektif, toleransi dan status freeze/unlock pada kebijakan pelanggan tertentu. Nilai tersebut bukan atribut bebas yang mengubah saldo pada Master Data.

Sejak konsolidasi 24 Oktober 2026, termin bawaan, limit kredit, freeze dan toleransi menjadi atribut **Master Data › Pelanggan** (izin kredit pelanggan). Ketentuan lama: TOP dan limit kredit pelanggan dikelola melalui Finance → Kredit & TOP Pelanggan dengan referensi pelanggan dan versi kebijakan. Setting menyediakan policy global/default, daftar termin dan mode kredit; Finance menjadi pemilik evaluasi fasilitas, exposure, past due dan keputusan kredit. Sales memilih termin pada SO; termin bawaan pelanggan hanya mengisi otomatis. SO dan invoice menyimpan snapshot TOP/limit/policy yang dipakai sehingga perubahan berikutnya tidak mengubah histori.

#### Pengaturan fasilitas per pelanggan

Alur layar (digantikan konsolidasi 24 Oktober 2026: Master Data › Pelanggan › Kredit): Finance → Kredit & TOP Pelanggan → pilih pelanggan → Tambah/Revisi Fasilitas. Form menampilkan identitas pelanggan dan histori versi, lalu menyediakan:

- mode pembayaran: COD, Prepay atau Tempo;
- TOP dan dasar jatuh tempo;
- limit kredit dan mata uang;
- tanggal mulai/berakhir serta cakupan perusahaan/channel bila relevan;
- toleransi, catatan evaluasi, bukti dan alasan keputusan;
- status Draft, Menunggu Persetujuan, Aktif, Ditangguhkan atau Berakhir.

Finance menyusun atau merevisi draft, sistem memeriksa kelengkapan dan konflik tanggal, lalu approval berjalan sesuai policy. Hanya versi **Aktif** yang dapat dipakai evaluasi SO; pelanggan baru tetap memakai mode awal COD/Prepay sampai fasilitas Tempo disetujui. Perubahan TOP atau limit tidak mengubah invoice/SO historis dan memerlukan snapshot baru untuk transaksi berikutnya. Master Data → Pelanggan hanya menampilkan ringkasan dan tautan read-only ke fasilitas ini.

TOP Supplier/Vendor tidak diatur pada Kredit & Exposure pelanggan. TOP tersebut ditetapkan pada **Warehouse & Logistik → Pengadaan → PO Supplier/PO Vendor** atau kontrak/MOU terkait, dengan basis jatuh tempo yang eksplisit. Finance menggunakan snapshot PO/kontrak untuk AP, pencocokan dan pembayaran. Pengadaan tidak mengubah limit kredit pelanggan.

## 5. Pengaturan Persetujuan

Policy approval memiliki jenis pengajuan, kondisi, scope, dasar nilai/mata uang, batas, tahap berurutan, mode any/all, pemberi persetujuan orang/peran/atasan langsung/atasan N tingkat/kepala departemen dari Struktur Organisasi, delegasi, self-approval, reminder, escalation, pemicu reapproval, effective date dan version. Self-approval default nonaktif; nilai awal reminder 4 jam kerja dan escalation 1 hari kerja dapat dikonfigurasi.

Lifecycle: Draft → Validate/Simulate → Active → Inactive. Aktivasi ditolak bila assignee, scope, limit, fallback, prioritas atau jalur keputusan belum valid. Simulasi tidak menghasilkan keputusan. Persetujuan dapat dipasang ke jenis dokumen apa pun, termasuk SO dan pengecualian kredit (24 Oktober 2026); tanpa aturan aktif, dokumen berjalan tanpa persetujuan. Pengajuan tanpa pemberi persetujuan dialihkan ke Admin Sistem.

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
- persetujuan tidak pernah lolos otomatis; pengajuan tanpa pemberi persetujuan dialihkan ke Admin Sistem;
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

## Implementasi workspace IAM — 16 Oktober 2026

Workspace Pengguna/Peran memakai halaman daftar, form penuh, detail bertab dan matriks terpadu sesuai referensi terbaru pengguna. Status akun pada workspace mengubah keanggotaan perusahaan; penonaktifan identitas global tetap dihormati. Aksi cabut sesi, status peran, penugasan dan perubahan izin dicatat pada audit, dengan invalidasi sesi perusahaan terdampak. Snapshot izin mencegah overwrite oleh editor lama. Tidak ada perubahan saldo/ledger/stock atau migrasi. Editor cakupan khusus dan empat kategori data sensitif terpisah masih bergantung pada resolver scope serta permission backend khusus; izin umum finance/hr tidak dianggap pengganti. Lihat [catatan implementasi](../development/access-ui-2026-10-16.md) dan kontrak API terbaru.

## Implementasi pemisahan submenu — 16 Oktober 2026

Migration `20261016210000_independent_submenu_permissions` menggantikan grant induk CRM/Master Data dan baca fulfillment dengan grant anak terpisah. Peran lama mempertahankan tindakan/scope efektif yang sudah dimiliki; peran tanpa grant tetap kosong. Pemetaan diaudit oleh sistem. Admin Sistem tetap penuh dan sesinya tidak dicabut selama peran aktif. Matriks memiliki pilihan semua per kelompok/per tindakan, status sebagian, jumlah izin dipilih, serta buka/tutup seluruh menu. Kontrol tersebut hanya mengubah grant anak individual. Catatan pelaksanaan dan gate pada [hak akses fleksibel](../development/flexible-access-2026-10-16.md).
