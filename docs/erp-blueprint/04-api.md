# API — kontrak awal v1

## Detail SO dan uang muka — Bagian 2, 26 Oktober 2026

POST /sales-orders/:id/advances membutuhkan sales_order_advance.create dan Idempotency-Key; body amount, received_at (datetime), bank_account_id, bank_reference opsional, evidence_id. POST /sales-order-advances/:id/verify dan /reject membutuhkan sales_order_advance.verify, version; reject juga reason. GET /operations/orders/:id/related dan /actions membutuhkan sales_order.read dan menyaring per jenis/tindakan. POST /sales-orders/:id/print-events membutuhkan sales_order.print; POST /sales-orders/:id/duplicate membutuhkan sales_order.create dan Idempotency-Key. Detail menambah progress baris, neighbors, companyProfile, lastChanged/lastPrinted; advances/DP hanya untuk izin sumber dan remainingBill juga mensyaratkan akses invoice.

## Backend SO mudah — kontrak 25 Oktober 2026

POST /sales-orders menerima customer_reference, delivery_address, evidence_id opsional; order_date YYYY-MM-DD, payment_term_code, salesperson_id, warehouse_id dan lines[].warehouse_id opsional dengan resolusi default server. Currency tetap IDR. Revisi /sales-orders/:id/revise menerima field yang sama; penghilangan mempertahankan kepala lama, evidence_id null menghapus bukti opsional, versi/alasan tetap wajib. Submit memeriksa ulang kewajiban bukti/referensi serta termin draft.

GET /operations/lists/orders menerima status DRAFT|WAITING_APPROVAL|OPEN|PARTIALLY_SHIPPED|IN_DELIVERY|COMPLETED|CANCELLED, from/to berdasarkan order_date dan cari nomor/pelanggan/No. SP. Tambahan respons: customerReference, orderDate, paymentTermCode, warehouseId, salespersonId, displayStatus, dueDateEstimate, downPayment. summary berisi hitungan tujuh status + all; field lama dipertahankan untuk kompatibilitas. Paging 25 baris, urutan orderDate desc/number desc/id asc; filter, hitungan, dan fakta halaman dalam transaksi baca RepeatableRead. Snapshot kredit tidak dikirim dalam daftar.

GET /operations/order-options (sales_order.create atau update) menambah warehouses, salespeople (hanya id/nama anggota aktif), terms, defaults dan closedThrough. GET /operations/stock-availability?warehouse_id=UUID&product_ids=UUID,UUID (sales_order.create) menerima maksimal 100 produk; data lain perusahaan ditolak. Respons data berisi productId, available string decimal dan elsewhere[{locatorType,locatorName,quantity}]. Pembacaan tidak mengubah reservasi.

Error konfigurasi memuat kode pada errors.code, pesan manusia pada detail dan settings_href di root problem response. Scope perusahaan tetap berasal dari sesi; izin per submenu tetap diperiksa server.


## Dampak keputusan 24 Oktober 2026 — rancangan

Mengikuti [desain arah fleksibel](../superpowers/specs/2026-10-24-erp-fleksibel-design.md). Kontrak final ditetapkan pada rencana implementasi. Kelompok baru: pengaturan terpusat (profil, format angka, termin, ongkir, mode kredit, penomoran), struktur organisasi (departemen, jabatan, karyawan, atasan), aturan persetujuan (CRUD, validasi, simulasi, aktivasi), kotak masuk persetujuan lintas jenis dokumen (daftar, setujui, tolak, minta revisi, delegasi). Endpoint pengecualian SO lama dialihkan ke kontrak persetujuan umum. Semua mutasi tetap memakai sesi, CSRF, izin per submenu dan Idempotency-Key.

Kontrak aktif tahap 2: `GET /settings/preferences` (semua sesi; `company_name`, `logo_object_key`, `number_format` dari `OPS-FLX-06`), `GET /settings/numbering` (`numbering_rule.read`; per jenis dokumen: `label`, `prefix`, `digits`, `reset_yearly`, `effective_from`, `next_preview`, `active`), `PUT /settings/numbering/:kind` (`numbering_rule.manage`, header `Idempotency-Key` 8–200 karakter; body `prefix` `^[A-Z0-9/._-]{1,20}$`, `digits` 3–10, `reset_yearly`; jenis tak dikenal 404; berlaku sejak hari ini zona perusahaan, urutan berlanjut, audit `numbering_rule.revised`). Kebijakan `OPS-FLX-*` memakai `GET/PATCH /operational-policies/:code` dengan `If-Match`.

## Submenu Akun dan migrasi master — 16 Oktober 2026

Kontrak aktif Akun: GET /accounts?q=&category=&status=&page= (25 baris), GET /accounts/options, GET /accounts/:id (referensi dan 30 riwayat terakhir), POST /accounts, PATCH /accounts/:id, POST /accounts/import. Izin berturut account.read/create/update/import; endpoint konfigurasi legacy juga mewajibkan account.create. Mutasi wajib Idempotency-Key, PATCH wajib If-Match versi berpetik. Body master: code, name, category, category_label, description, parent_id, account_type, normal_balance, psak118_category, active, reason. Impor atomik create-only memakai file_name, sha256, rows; kolom saldo ditolak. Kontrak tree/reclassify/DELETE/export/import-jobs di bagian rancangan berikut belum termasuk implementasi tahap ini.

### Penyempurnaan master pajak — 16 Oktober 2026

Body master menerima usage SALES|PURCHASE|BOTH (opsional untuk kompatibilitas; PATCH yang menghilangkan usage mempertahankan nilai tersimpan). GET /tax/options menerima query usage=SALES|PURCHASE dan memfilter master sesuai penggunaan atau BOTH. Snapshot SO mewajibkan SALES, supplier invoice PURCHASE; ketidakcocokan menghasilkan TAX_USAGE_MISMATCH. GET /tax/accounts menyertakan category/active dan akun nonaktif untuk pembacaan riwayat; form hanya menawarkan akun aktif serta akun lama yang sedang dipilih.

## Pembaruan pajak operasional — 16 Oktober 2026

Kontrak aktif: GET/POST `/tax/master`, GET/PATCH `/tax/master/:id`, GET `/tax/accounts`, GET `/tax/options`, GET `/tax/invoices/output|input`, POST `/tax/invoices/output|input/:id`. List memakai q/page, ukuran 20. Mutasi wajib Idempotency-Key; PATCH master wajib If-Match versi berpetik. Body master: name, kind PPN|PPH, effect ADD|DEDUCT, account_id, percentage string, decimal_places, rounding, active, effective_from. Tanggal masa depan ditolak; versi berjalan langsung tanpa approval. Metadata faktur: number, document_date, evidence_id, version (0 untuk baru). Server memeriksa perusahaan, POSTED, tujuan evidence TAX_OUTPUT/TAX_INPUT dan konflik versi/nomor. SO line dan supplier invoice menerima tax_master_id; nilai dihitung server. Endpoint legacy tetap kompatibel tetapi bukan master utama baru.


Izin Dashboard terbaru: GET `/dashboard/summary` memerlukan `dashboard_executive.read`; GET `/dashboard/{sales|warehouse|finance|hris|actions}` memerlukan `dashboard_<view>.read`; seluruh endpoint `/reports/*` dan `/report-exports` memerlukan `dashboard_reports.read`. Admin Sistem melewati pemeriksaan grant tampilan. Pemeriksaan izin dan scope data sumber tetap berjalan setelah izin tampilan. Tanpa izin tampilan API mengembalikan 403. Migrasi hanya menambah katalog, tanpa grant peran lama.

## Koreksi ongkir revisi SO — 8 Oktober 2026

POST `/sales-orders/{id}/revise` menerima `freight` optional dengan bentuk yang sama
seperti create SO (`payer`, `basis: PER_SHIPMENT`, `estimate`, `tax_mode`, `tax_rule_id?`).
Tidak dikirim berarti mempertahankan nilai lama; `null` menghapus estimasi dan terms.
Kena PPN diverifikasi terhadap rule aktif perusahaan/pelanggan. Gate versi, alasan,
bukti, SO DRAFT/OPEN dan tidak ada fulfillment aktif tetap berlaku. Revisi kembali
ke DRAFT untuk evaluasi ulang, tercatat di audit dan tidak mengubah snapshot terbit.

## Kontrak operasional 7 Oktober 2026 — proforma manual

GET `/operations/fulfillment-batches/{id}/proforma-preview` dan POST
`/fulfillment-batches/{id}/issue-proforma` memerlukan `proforma.issue` company/privileged
scope perusahaan sesi. Preview mengembalikan `version` hash sumber, snapshot baris/
subtotal/pajak/total serta `existing`/`supersedes`; tidak mengambil nomor. POST menerima
`{version, freight?}` dan Idempotency-Key, mengunci customer/tahap, memeriksa kelayakan serta
versi, menyimpan nomor/snapshot/audit secara atomik. Versi berubah/status tidak layak
409, beda perusahaan 404, izin tidak cukup 403. Retry identik dan penerbitan paralel
untuk sumber sama mengembalikan satu dokumen; key sama dengan payload berbeda 409.

Submit SO dan koreksi picking tidak menerbitkan proforma. Daftar/detail proforma
mencakup `PROFORMA` dan `PROFORMA_REVISION:*`. Detail menambah status baca ISSUED,
REVISION_REQUIRED, SUPERSEDED atau VOID berdasarkan sumber/revisi terakhir. Snapshot
historis tidak ditulis ulang. Endpoint generik `/proformas/{id}/issue` tetap rancangan;
command manual Office memakai endpoint tahap di atas. Tidak ada AR/jurnal proforma.

POST `/operations/fulfillment-batches/{id}/proforma-preview` menerima
`{freight?: {amount, tax_mode, tax_rule_id?}}` dengan validasi dan izin yang sama.
Nominal berupa string desimal nonnegatif; mode `TAXABLE` atau `NON_TAXABLE`.
Preview memakai kalkulator ongkir penerbitan untuk mengembalikan snapshot total baru,
tanpa menyimpan ongkir, mengambil nomor atau membuat jurnal. `version` tetap hash
sumber tersimpan untuk pemeriksaan penerbitan. Office menghitung ulang setelah input
berubah dan menahan penerbitan sampai respons terbaru tersedia. Pajak mengikuti
aturan aktif server; UI hanya menampilkan toggle Kena PPN, tanpa pilihan tax rule.

Base path `/api/v1`, disediakan oleh NestJS untuk web kantor Next.js/React dan aplikasi mobile Nuxt/Vue pada Android/iOS; PWA/browser merupakan akses tambahan. Ini spesifikasi desain, belum endpoint yang berjalan atau OpenAPI lengkap. Endpoint bisnis membutuhkan JWT valid dan akun/membership/sesi aktif. Login/recovery/CSRF bootstrap dibatasi sesuai fungsinya; refresh membutuhkan refresh token valid. Contoh ID adalah placeholder; implementasi memakai UUID.

Kontrak API memakai nama teknis (`snake_case`, enum, kode error dan nilai desimal) agar stabil bagi program. Nama tersebut tidak boleh diteruskan mentah ke layar pengguna. Respons yang ditampilkan UI harus memetakan field ke **label manusia**, **arti bisnis**, **satuan**, dan **format lokal** sesuai [Kamus Label Manusia dan Bahasa Layar](07-design.md). Pesan error juga memakai istilah kerja, misalnya “Jumlah penerimaan melebihi pesanan” dan bukan `over_receipt_tolerance_exceeded`.

## 1. Konvensi

- Kedua frontend memakai access JWT berumur pendek dan refresh token berotasi dalam cookie HttpOnly/Secure/SameSite, dengan CSRF/origin checks pada mutasi. Token tidak ditaruh di localStorage. Server memverifikasi signature/issuer/audience/expiry serta status sesi dan izin terkini. Integrasi token eksternal belum termasuk P1.
- Usulan satu origin: web kantor `/`, PWA `/lapangan/`, API `/api/v1/`. SSR tidak meng-cache data privat antar pengguna. Service worker PWA tidak meng-cache API, auth atau attachment privat; refresh/logout berlaku pada kedua frontend di browser yang sama.
- Backend menentukan company/scope dari membership; `company_id` dari request tidak dipercaya tanpa validasi.
- JSON `snake_case`; tanggal `YYYY-MM-DD`; timestamp ISO 8601 UTC; money/qty/rate sebagai string desimal, bukan float.
- GET list: `?cursor=...&limit=25&sort=-business_date`; maksimum 100. Filter di-whitelist. Output `{data:[],meta:{next_cursor:null,limit:25}}`.
- TanStack Table menggunakan sort/filter/pagination server melalui kontrak list yang sama pada React dan Vue. Tambahkan urutan ID stabil sebagai tie-breaker di backend. Perubahan filter/sort mereset cursor. UI menyediakan sebelumnya/berikutnya dengan histori cursor; tidak menampilkan jumlah halaman atau lompat ke halaman terakhir tanpa metadata/dukungan API.
- TanStack Query menyertakan resource, company, user/cakupan izin, filter, sort dan cursor dalam query key. Cache memori frontend tidak mengubah ketentuan HTTP/service-worker `no-store`. Summary/total lintas halaman dihitung backend dengan filter/scope yang sama; jangan menjumlahkan hanya halaman yang sudah dimuat lalu menyebutnya total laporan.
- Event realtime tersedia melalui WebSocket terotorisasi (SSE read-only sebagai fallback web) dengan cursor/replay, heartbeat dan reconnect. Payload hanya memuat `event_id`, `resource`, `resource_id`, `version`, `change_kind`, `occurred_at` dan metadata aman; klien mengambil DTO terbaru melalui GET setelah invalidasi query. Server memfilter event menurut company, user, scope dan field authorization.
- Draft update memakai `If-Match: "<version>"`; mismatch 412. Header wajib pada aksi terhadap existing aggregate agar persetujuan tidak berlaku atas versi lama.
- POST create dan perintah mutasi bisnis memakai `Idempotency-Key`. Key sama + body/route/actor/company sama mengembalikan respons pertama; body beda menghasilkan 409. Unique business-event tetap permanen walau key cache kedaluwarsa.
- Draft save tidak sama dengan issue/approve/post. Service menghitung total, tax, exposure dan HPP; angka client hanya input yang diizinkan.
- GET tidak melakukan posting atau mengubah status. File diunduh dengan otorisasi ulang/signed URL singkat, bukan public bucket.

## 2. Sumber daya dan perintah

### Implementasi Dashboard Tugas dan Laporan — 29 September 2026

- `GET /dashboard/actions`: sesi aktif; company/user berasal dari principal. Query strict `month` (YYYY-MM, 1900–2199), `tab=approvals|followups|completed`, `module=all|sales|warehouse|finance|hris`, `search` maksimal 100 karakter, `sort=asc|desc`, `limit` 1–50, `cursor`. Antrean personal dapat dibuka semua pengguna aktif; tanpa izin sumber tidak ada data sumber dikirim. Saat ini hanya `crm.read` company/privileged pada company aktif yang menyediakan next action prospek milik pengguna, dengan periode WITA, pengecualian Deferred/Dropped, total dan pagination server. Cursor terikat user/company/filter. Persetujuan/selesai dan sumber domain lain unavailable/null; bukan nol atau approval palsu. Item mempunyai source/version, tanpa command selesai atau tujuan UI palsu. Dua hitungan prospek diberi label sumber parsial.
- `GET /reports/catalog`: metadata lima laporan mockup yang difilter `crm.read`, `warehouse.read`, `finance.read`, atau `hr.read` company/privileged pada company aktif; tanpa izin menghasilkan katalog kosong. Katalog bukan grant detail/export. Setiap item memuat lokasi pemilik, versi definisi, alasan sumber unavailable, `destination:null`, `can_export:false`. Scope lebih sempit belum didukung dan tidak diperluas.
- `GET /reports/:code/preview`: memeriksa izin domain; query strict `as_of` tanggal kalender valid 1900–2199, `scope=authorized`, `format=xlsx|csv|pdf`. Sumber transaksi/ledger/kehadiran belum tersedia, sehingga rows kosong dengan status unavailable. Nominal, payroll, atau private attachment tidak dikirim.
- `GET /report-exports`: read contract riwayat milik principal; saat ini unavailable, items kosong dan total null karena persistence/job belum dibangun. Tidak menerima company/requested_by dari client.
- `POST /reports/:code/exports`: gate sementara tanpa mutasi. Sesi/CSRF, izin domain, dan parameter diperiksa; request valid berakhir 409 dengan pesan belum tersedia, tanpa job/file. Izin baca tidak pernah membuat file. Generator, izin ekspor rinci, durable job/outbox, storage privat, checksum, audit download dan OPS-SYS-03 wajib dibangun sebelum route ini dapat menerima pekerjaan. Tidak ada expiry/SLA hardcoded.

Kontrak tahap ini tidak menggantikan sasaran `/report-runs` dan `/report-exports` penuh. Tidak ada migration/grant baru. Lihat [cakupan dan bukti](../mockup/dashboard-actions-reports-build.md).

### Implementasi bertahap Dashboard HRIS — 29 September 2026

`GET /dashboard/hris` memerlukan sesi aktif dan `hr.read` company/privileged sesuai company sesi. Jabatan/admin tidak otomatis memberi izin; scope sempit belum didukung dan ditolak. Query strict: `month=YYYY-MM` (1900–2199), `process=all|contracts|attendance|onboarding|payroll` (default all). Tanpa sesi 401, izin/scope tidak cocok 403, query asing/invalid 400.

Response `{data}` memuat company_id, month, process, timezone Asia/Makassar, definition_version hris-dashboard-v1, data_as_of, updated_at, freshness, metrics, processes, actions, total_actions, actions_status/reason. Empat KPI serta lima status proses null/unavailable; actions kosong dan total_actions null. Timestamp adalah waktu pemeriksaan, bukan transaksi/rekap. Belum ada tabel karyawan/kontrak/absensi/onboarding/payroll; endpoint ini kontrak ketersediaan terotorisasi, bukan pembacaan data SDM. Akun ERP bukan sumber headcount.

Kontrak strict tidak menerima field tambahan payroll/rekening/dokumen privat. hr.read pada tahap ini hanya status dashboard; bukan akses nominal atau dokumen pribadi. Suppression kelompok kecil OPS-SYS-02, field authorization dan scope sumber wajib diterapkan sebelum agregat nyata diaktifkan; tidak menanam threshold 5 atau pengingat kontrak 30 hari di service ini. Preview berisi fixture yang diberi label simulasi. Migration hanya katalog izin, tanpa assignment atau mutasi HR. Detail implementasi: [Dashboard HRIS](../mockup/dashboard-hris-build.md).

### Implementasi bertahap Dashboard Finance — 29 September 2026

`GET /dashboard/finance` memakai sesi aktif dan izin `finance.read` company/privileged yang cocok dengan company sesi; scope sempit belum didukung dan ditolak, bukan diperluas. Tanpa sesi 401, tanpa izin/scope sesuai 403. Query strict: `month=YYYY-MM` (1900–2199, wajib), `process=all|receivables|matching|allocation|closing` (default all). Query asing, periode/proses salah, dan company dari klien menghasilkan 400.

Response `{data}` memuat company_id, month, process, timezone Asia/Makassar, currency IDR, definition_version finance-dashboard-v1, data_as_of, updated_at, freshness, metrics, closing, actions, total_actions, actions_status/reason. Seluruh empat metrik nominal dan empat status closing saat ini null/unavailable dengan alasan; actions kosong, total_actions null. Periode dipilih bukan bukti periode akuntansi berstatus Terbuka. Timestamp menunjukkan pemeriksaan layanan, bukan waktu posting. Belum ada sumber AR/AP/penerimaan/pembayaran/closing di schema; endpoint ini kontrak ketersediaan terotorisasi dan tidak mengklaim membaca saldo keuangan dari database. Tidak menggunakan master/pricelist sebagai pengganti ledger. Filter proses hanya menyatakan permintaan sampai sumber dibangun.

Migration mendaftarkan katalog finance.read tanpa assignment. Izin ini untuk dashboard read-only; tidak memberikan posting, pembayaran, closing, payroll, HPP atau ekspor. Scope sempit/field-level permission untuk sumber finansial mendatang harus dilengkapi sebelum mengirim nominal nyata. Tidak ada mutasi, realtime atau ekspor baru. Kontrak Zod: `packages/contracts/src/dashboard-finance.ts`; bukti pada [catatan Finance](../mockup/dashboard-finance-build.md).

### Implementasi bertahap Dashboard Warehouse — 29 September 2026

`GET /dashboard/warehouse` memerlukan sesi dan `warehouse.read`. Scope company/privileged harus cocok dengan company sesi; scope warehouse digabung hanya untuk gudang aktif milik company tersebut. Scope lain atau gudang terpilih yang tidak aktif/tidak diizinkan menghasilkan 403 generik. Query strict: `month=YYYY-MM` (1900–2199, wajib), `warehouse_id` UUID opsional, `stage=all|inbound|picking|shipping|quality` (default all). Query asing atau format tidak valid 400; tanpa sesi 401. Company tidak diterima dari klien.

Response `{data}` memuat company, month, warehouse_id, stage, timezone Asia/Makassar, definition_version warehouse-dashboard-v1, data_as_of, updated_at, warehouses (id/kode/nama aktif yang diizinkan), metrics, actions, total_actions dan actions_status/reason. Saat ini hanya pilihan gudang dibaca dari database; semua tujuh metrik operasional null/unavailable dengan satuan/alasan, actions kosong dan total_actions null (bukan nol). Freshness keseluruhan unavailable; waktu menunjukkan waktu pemeriksaan, bukan tanggal transaksi stok. Filter periode/tahap belum mempunyai sumber transaksi untuk dihitung; tidak mengklaim snapshot historis. Tidak mengirim alamat/HPP atau mengambil nilai dari jumlah locator.

Izin didaftarkan melalui migration tanpa assignment otomatis. Ini pembacaan langsung, tanpa mutasi/posting/realtime/ekspor. Lihat [cakupan Warehouse](../mockup/dashboard-warehouse-build.md). Kontrak ada di `packages/contracts/src/dashboard-warehouse.ts`.

### Implementasi bertahap Dashboard Sales — 29 September 2026

`GET /dashboard/sales` memakai sesi aktif dan `crm.read` pada scope company/privileged yang cocok dengan perusahaan sesi. Scope lain belum didukung dan ditolak (403), tanpa izin 401/403 sesuai status autentikasi. Query di-whitelist: `month=YYYY-MM` (1900–2199, wajib), `status=all|overdue|upcoming`, `sort=asc|desc`, `limit=1..50` (default 4), dan `cursor` opsional. Parameter perusahaan/pemilik dari klien tidak diterima. Input/cursor tidak valid menghasilkan 400.

Endpoint komposit ini mengembalikan `{data:{company_id,owner_id,month,timezone,definition_version,data_as_of,updated_at,freshness,metrics,actions,total_actions,next_cursor,source}}`. Metadata periode/scope/versi berlaku untuk seluruh bagian. `freshness=fresh` berarti pembacaan jadwal prospek live; metrik yang belum memiliki sumber tetap mempunyai `freshness=unavailable`, `value=null`, satuan dan alasan masing-masing. Invoice, target, estimasi, kunjungan dan invoice pertama belum tersedia pada tahap ini.

`actions` berasal dari `prospects.next_action/next_action_at`, hanya prospek aktif (bukan Ditunda/Tidak Dilanjutkan), company sesi dan owner pengguna login. Batas bulan memakai Asia/Makassar; interval awal inklusif, akhir eksklusif. `overdue` berarti tenggat lebih kecil dari waktu baca; `upcoming` berarti sama/lebih besar. Ini jadwal terkini prospek, bukan snapshot historis semua task Sales. Total dihitung pada seluruh filter sebelum cursor; sort memakai jadwal lalu ID. Cursor terikat filter bulan/status/sort; scope company/owner selalu diterapkan ulang. Response bukan izin mengubah status tugas. Rincian terbatas pada field baris yang dikirim.

Read-only tanpa migrasi/posting. Tidak ada endpoint ekspor baru. Pembaruan saat ini manual/focus; realtime masih belum diimplementasikan. Kontrak Zod berada pada `packages/contracts/src/dashboard-sales.ts`; sumber lama `/dashboard/summary` tetap kompatibel. Cakupan dan bukti ada pada [implementasi Dashboard Sales](../mockup/dashboard-sales-build.md).

Boundary resource mengikuti dokumen domain: [Sales Order-to-Cash](10-sales-marketing.md), [Warehouse & Logistik](11-warehouse-logistik.md), [Master Karyawan dan Kontrak](13-hris.md), [Master Data](14-master-data.md), dan [Setting/IAM](15-setting.md).

Endpoint detail menggunakan `/{id}`. `CRUD draft` berarti GET/POST/PATCH dan cancel sesuai izin; tidak berarti bebas menghapus histori.

| Domain | Endpoint | Perintah / izin utama |
|---|---|---|
| Auth | POST `/auth/login`, `/auth/refresh`, `/auth/logout`; GET `/auth/me`, `/auth/csrf` | Login/MFA sesuai kebijakan; rotasi refresh, revoke sesi/logout, profil/izin terkini, bootstrap CSRF |
| Event realtime | WebSocket `/events` dan fallback SSE GET `/events/stream?after_event_id=` | Auth sesi/JWT, filter izin/scope pada subscribe dan replay, heartbeat, cursor serta sinyal `resync_required`; hanya event notifikasi, bukan mutasi bisnis |
| Access | `/users`, `/roles`, `/permissions`, `/approval-policies` | Admin terbatas; re-auth untuk perubahan sensitif, MFA bila diaktifkan. Activate policy menolak self-approval default, assignee/scope/limit/fallback yang belum lengkap; SLA default 4 jam/1 hari |
| Profil Perusahaan | GET/PATCH `/company-profile` | Pengguna dengan `company_profile.read/update` dapat melihat dan menyimpan nama, alamat, kontak, logo serta identitas profil. Update nama berlaku langsung tanpa effective date, reason atau approval; dokumen issued memakai snapshot yang sudah tersimpan |
| Kebijakan Umum | GET `/operational-policies`, GET/PATCH `/operational-policies/{code}`, POST `/operational-policies/{code}/validate` | Hak read/update dapat dibatasi per kelompok. PATCH memakai version/If-Match, validasi schema/dependensi dan membuat versi aktif baru; reason, approval dan `effective_from` opsional kecuali definition mewajibkan. Invariant CFG-07 tidak memiliki endpoint untuk dinonaktifkan |
| Master Data | `/products`, `/product-categories`, `/uoms`, `/customers`, `/contacts`, `/suppliers`, `/vendors`, `/warehouses`, `/locations`, `/operational-items`, `/customer-channels`, `/rayons`; subresource NIE/UOM/harga acuan, alamat/legalitas/onboarding, dan PIC/legalitas pihak | CRUD/duplicate-check/activate/deactivate/history memakai permission dan scope terpisah; activation memeriksa data wajib dan dependensi. Batch, stock, pricelist, payment policy, credit, tax profile dan rekening memakai resource pemilik domain masing-masing |
| Price & customer policy | `/price-lists`, `/price-list-items`, `/customer-price-requests`, `/customers/{id}/payment-policies`, `/customers/{id}/credit-exposure` | Finance command; Sales hanya membaca/evaluasi; update Master Data tidak mengubah harga khusus, TOP, limit, exposure atau approval |
| Ketentuan pelanggan | GET/POST `/customers/{id}/payment-policies`, GET `/customers/{id}/credit-exposure` | Hak `customer.payment_policy.manage` untuk menetapkan mode/TOP/limit bertanggal efektif; exposure server mencakup AR/unbilled/transit/alokasi dikurangi uang muka tertaut; membuat pelanggan memakai `customer.create` dan default COD tiga bulan |
| CRM | `/leads`, `/contacts`, `/opportunities`, `/sales-visits`, `/sales-targets`, `/target-attributions`, `/quotes` | Assignment scope; visit check-in/foto memakai OPS-VIS aktif (awal radius 200 m/minimal satu foto) atau menyimpan Exception; atribusi sumber wajib total 100% |
| Referensi CRM | `/lead-sources`, `/lead-approach-statuses`, `/contact-functions` | Konfigurasi berizin, nonaktifkan data terpakai tanpa menghapus histori |
| Kebutuhan CRM | `/leads/{id}/requirement-lines`, `/opportunities/{id}/requirement-lines` | Beberapa baris produk atau kategori/uraian; estimasi qty/satuan/waktu/catatan; pencatatan tidak membuat reservasi atau PR |
| SO | `/sales-orders` | CRUD draft; POST `/{id}/submit`, `/reevaluate`, `/close-remaining`, `/cancel-remaining`, `/cancel`; GET `/{id}/evaluations`, `/{id}/fulfillments`; validasi/alokasi/release normal dijalankan sistem |
| Sisa dan konfirmasi pesanan | POST `/sales-orders/{id}/customer-confirmations`; GET `/order-remainder-actions/{id}` | Rekam konfirmasi pelanggan; lihat penyelesaian close/cancel dan tugas pengembalian picking bila diperlukan |
| Unlock SO | POST `/sales-orders/{id}/unlock-requests`; GET `/unlock-requests`, `/unlock-requests/{id}` | Buat dan ajukan permintaan beralasan; keputusan melalui approval instance kind `sales_order_unlock` oleh pihak terkonfigurasi |
| Inventory | GET `/stock-availability`, `/stock-ledger`, `/valuation-report`, `/inventory-valuation`, `/landed-cost` | `inventory.availability.read` memungkinkan informasi stok saat Draft/credit hold; GET tidak mereservasi; costing memakai izin terpisah |
| Tahap pemenuhan | `/fulfillment-batches` | GET list/detail; POST `/{id}/issue-proforma`, `/issue-pick-list`, `/issue-packing-list`, `/reserve-funds`; sumber tahap/alokasi/revisi diverifikasi server. Reservasi prepay memakai OPS-FIN-06 dan worker hanya melepas qty belum picking |
| Picking / packing | `/pick-lists`, `/packing-lists` | Pick list POST `/{id}/confirm-pick`, `/confirm-check`; Packing List diterbitkan dari aktual lolos checking |
| Fulfillment | `/shipments`, `/delivery-receipts` | POST shipments `/{id}/dispatch`; delivery receipts `/{id}/confirm` |
| Billing | `/proformas`, `/sales-invoices`, `/invoice-handoffs`, `/credit-notes` | Proforma `/issue`; invoice/credit note `/post`; handoff `/confirm`. Create/post invoice menolak gabungan POD yang berbeda pelanggan, currency, tax profile, TOP, tanggal POD atau due date |
| Buying | `/purchase-requests`, `/purchase-orders`, `/goods-receipts`, `/service-acceptances`, `/supplier-invoices` | `/submit`, approval, `/issue`, `/post`, `/match`, `/resolve-exception`; due basis AP default verified complete invoice date + TOP, tolerance qty/harga 0, dan hanya rounding sistem sampai Rp1 per invoice yang nonblocking |

Implementasi backend O2C/P2P saat ini menyediakan `POST /purchase-orders/{id}/supplier-invoices` untuk mencatat dan mencocokkan invoice supplier dengan PO/GR menggunakan `Idempotency-Key`, serta `POST /supplier-invoices/{id}/post` untuk membuat AP open item dan jurnal GRNI, pajak masukan, dan AP secara atomik.
| Quality | `/quality-inspections`, `/temperature-logs`, `/stock-counts`, `/returns`, `/recall-cases`, `/destructions`, `/consignment-settlements` | Missing suhu/shelf-life menghasilkan hold; recall memblok fulfillment; destruction memerlukan approver berbeda, witness, evidence, movement dan jurnal |
| AR/AP | GET `/receivables`, `/payables`, `/aging`; `/receipts`, `/payments`, `/settlements` | Receipt/payment `/submit`, `/post`, `/reverse`; receipt membawa `cash_received`, allocations dan `tax_components[]`. WAPU memakai baris terpisah `vat_collected_by_customer` dan `income_tax_withheld`, masing-masing dengan rule/DPP/rate/amount/evidence status; alokasi berizin dan kontrol outstanding |
| Accounting | `/accounts`, `/journal-entries`, `/periods`, `/close-runs` | Journal `/post`, `/reverse`; close-run `/validate`, `/review`, `/close`; period `/reopen` |
| Reports | GET `/reports/trial-balance`, `/general-ledger`, `/balance-sheet`, `/profit-loss`, `/cash-flow`, `/margins` | `as_of`/period wajib sesuai laporan; GET export membuat job bila besar |
| Bank/assets | `/bank-statements`, `/bank-matches`, `/bank-reconciliations`, `/assets`, `/asset-assignments`, `/depreciation-runs`, `/asset-disposals`, `/expense-claims`, `/budgets` | Import/approve/post/dispose; kapitalisasi, penyusutan dan handover/return evidence |
| Tax | `/tax-profiles`, `/tax-rules`, `/party-tax-profiles`, `/tax-transactions`, `/tax-documents`, `/withholding-certificates`, `/tax-periods`, `/tax-reconciliations`, `/tax-payments`, `/corporate-tax-runs`, `/fiscal-adjustments`, `/corporate-tax-loss-carryforwards`, `/corporate-tax-credit-allocations`, `/tax-exchange-jobs`, `/coretax-reference-codes`, `/coretax-item-mappings`, `/coretax-uom-mappings` | Kelola pajak internal; PPh Badan mendukung lifecycle review/posting. Coretax pajak keluaran mendukung validate/preview/generate/download/mark-uploaded/result/supersede sesuai dokumen 38; direct API submission belum aktif |
| HR | `/employees`, `/employment-contracts`, `/hiring-requests`, `/job-openings`, `/candidates`, `/applications`, `/interviews`, `/offers`, `/onboarding-cases`, `/work-calendars`, `/shifts`, `/shift-assignments`, `/attendance`, `/attendance-corrections`, `/leave-requests`, `/overtime-requests`, `/attendance-periods`, `/separation-requests`, `/offboarding-cases`, `/asset-return-inspections`, `/access-revocation-tasks`, `/final-pay-runs`, `/employee-archives` | Recruiter/interviewer/manager/HR/self scope; approval, konversi karyawan, offboarding, koreksi, rekap dan dokumen pribadi |
| Payroll | `/attendance-import-profiles`, `/attendance-imports`, `/attendance-cutoff-snapshots`, `/payroll-calendars`, `/payroll-components`, `/payroll-rules`, `/payroll-runs`, `/thr-runs`, `/bpjs-profiles`, `/tax-profiles`, `/commission-rules`, `/payslips`, `/payroll-reconciliations` | Impor `validate/commit/reprocess`; payroll `/calculate`, `/review`, `/approve`, `/post`; official posting/payment ditolak sebelum policy lengkap dan dua parallel run lulus |
| HR dashboard/reports | `/hr-dashboard/summary`, `/hr-dashboard/actions`, `/hr-reports/*`, `/hr-report-exports` | Filter/as-of/scope; suppression dan expiry export mengikuti OPS-SYS-02/03, dengan nilai awal <5 orang/7 hari; audit download |
| Shared | `/approval-instances/{id}/decisions`, `/attachments`, `/import-jobs`, `/opening-batches`, `/audit-events` | Imports `/validate`, `/preview`, `/commit`; opening `/approve`, `/post`; audit read-only |

Setiap perintah harus memiliki permission granular seperti `sales_order.submit`, `sales_order.close_remaining`, `sales_order.cancel`, `sales_order.unlock.request`, `sales_order.unlock.approve`, `sales_order.unlock.reject`, `proforma.issue`, `pick_list.issue`, `packing_list.issue`, `inventory.cost.read`, `journal.post`, `period.reopen`, `payroll.read_all`. Tidak ada hak approve SO normal atau endpoint yang langsung membuka kunci tanpa permintaan/keputusan. Endpoint yang belum masuk fase aktif tidak diekspos sebagai tindakan berfungsi.

Kontrak CoA: GET/POST `/accounts`, GET/PATCH `/accounts/{id}`, POST `/{id}/activate`, `/{id}/deactivate`, `/{id}/reclassify`, GET `/{id}/history` dan `/accounts/tree`. DELETE hanya berhasil bila akun belum pernah dipakai/direferensikan. Mutasi memakai version untuk optimistic concurrency. Backend menolak siklus parent, kode duplikat, posting ke header/nonaktif, perubahan field terkunci, dan penonaktifan akun dengan mapping aktif. Impor memakai `/import-jobs` dengan jenis `chart_of_accounts`; validate/preview tidak menulis akun atau saldo. Permission mengikuti spesifikasi CoA; `account.balance.read` terpisah dari pengelolaan master.

Kontrak jurnal otomatis: sumber bisnis memakai perintah `/post` pada resource asal; backend memilih posting profile aktif, mengunci dokumen/periode/subledger, menghitung ulang nominal, menulis accounting event, journal, open item/settlement/stock movement dan outbox dalam satu transaksi. GET `/posting-previews?source_type=&source_id=` menampilkan preview terotorisasi tanpa menjamin hasil jika sumber berubah. `/posting-profiles` mendukung draft/validate/activate/deactivate/version, sedangkan `/posting-exceptions` menyediakan daftar dan penyelesaian berizin. POST `/journal-entries/{id}/reverse` wajib membawa tanggal periode terbuka, alasan, versi dan idempotency key; jurnal yang berasal dari modul harus dibalik melalui sumber agar subledger ikut konsisten. Detail mengikuti dokumen 12-jurnal-otomatis.

Kontrak Kas & Bank: `/cash-bank-accounts`; `/receipts` dengan verify/post/reverse/allocate; `/payments` dengan submit/approve/reject/mark-executed/mark-failed/post/reverse; `/internal-transfers` dengan approve/confirm-out/confirm-in/post; `/petty-cash-vouchers`, `/cash-counts`, `/bank-statement-imports` dan `/unidentified-receipts`. Semua mutasi memakai idempotency key dan version. Posting mengunci account/open item/period serta menulis settlement dan jurnal secara atomik. Import statement hanya membuat staging sampai pengguna melakukan match/create draft; tidak mem-posting otomatis. Rincian mengikuti dokumen 13-kas-bank.

Kontrak AR/AP: GET `/receivables/cards`, `/payables/cards`, `/open-items` dan aging memerlukan tanggal acuan/scope; `/settlements` dan `/settlement-allocations` menangani preview/post/reverse/reallocate; `/advances` menangani identify/allocate/refund; `/credit-notes`, `/debit-notes`, `/ar-ap-disputes`, `/collection-followups` dan `/opening-batches/ar-ap` mengikuti workflow masing-masing. Server menghitung outstanding, mengunci open item saat posting, memvalidasi pihak/currency/period/version dan menolak settlement ganda. Offset/write-off/refund memerlukan jenis, bukti dan approval sesuai policy. Detail mengikuti dokumen 14-kartu-piutang-utang.

Kontrak biaya operasional: `/expense-categories`, `/internal-requests`, `/operational-issues`, `/expense-claims`, `/employee-advances`, `/vendor-direct-expenses`, `/prepaid-schedules` dan `/expense-exceptions` mendukung create/submit/review/approve/post/settle sesuai jenis. Klaim tidak membayar langsung; payment memakai `/payments` dari Kas & Bank. Server memeriksa evidence policy, duplicate source, account/tax/dimension, advance balance, version, period dan idempotency, lalu menulis jurnal/open item/stock movement secara atomik. Detail mengikuti dokumen 15-biaya-operasional-reimbursement.

Auth merupakan protokol terpisah dari idempotency dokumen bisnis: login/refresh/logout memakai rate limit, CSRF dan aturan sesi. Refresh melakukan rotasi atomik dan menangani reuse; jangan menjalankan login/refresh melalui queue. `GET /auth/me` mengembalikan scope dan izin efektif, tanpa token atau hash. Logout mencabut sesi server dan menghapus cookie; pemulihan akses tidak cukup dengan mengganti status tombol di UI.

Kontrak pemilihan perusahaan pada login Office: `POST /auth/login` tetap menerima `email`, `password` dan `company_id` opsional; respons sukses tetap HTTP 200 dengan principal yang sama. Setelah kredensial valid, bila pengguna memiliki lebih dari satu membership aktif dan `company_id` belum dikirim, server mengembalikan HTTP 409 `application/problem+json` dengan `code: COMPANY_SELECTION_REQUIRED`, `detail` berbahasa Indonesia dan `companies: [{id, name}]`. Setiap `id` adalah UUID perusahaan; daftar hanya berisi perusahaan yang aktif dan boleh diakses melalui membership aktif pengguna tersebut. Respons ini belum membuat sesi, menerbitkan cookie autentikasi atau mencatat event sukses `auth.login`.

Klien menampilkan pilihan perusahaan, lalu mengirim kembali email dan kata sandi yang sama beserta `company_id` pilihan melalui `POST /auth/login`. Backend memeriksa ulang kredensial, status akun, perusahaan dan membership terkini; daftar sebelumnya bukan grant akses. Kredensial tidak sah atau perusahaan tidak dikenal, nonaktif maupun di luar membership yang diizinkan menghasilkan 401 generik tanpa membocorkan keberadaan akun/perusahaan. Alur membership tunggal tetap memakai kontrak sukses yang ada. Pemilihan perusahaan tidak melewati CSRF/origin, rate limit, cookie, RBAC/scope atau audit yang sudah berlaku dan tidak memerlukan migration.

Setelah HTTP 200, klien menghapus kredensial dari state memori dan menjalankan gate `/auth/me`. Jika pemuatan akses gagal, tindakan Coba Lagi mengulang bootstrap akses tanpa mengirim ulang login. HTTP 409 dengan kode di atas adalah langkah pemilihan perusahaan, bukan konflik data biasa; 429 menandakan batas percobaan dan 503 menandakan layanan sementara tidak tersedia. UI membaca `detail` yang aman dan menampilkan pesan Bahasa Indonesia; gangguan jaringan dibedakan dari kredensial tidak sah. Password recovery belum memiliki alur yang diimplementasikan pada irisan ini.

Transport autentikasi Office membatasi waktu tunggu request auth sampai 20 detik. Kegagalan refresh dengan 429 atau 503 mempertahankan status dan detail gangguannya, bukan diubah menjadi 401. Timeout ini hanya berlaku pada request autentikasi dan tidak mengubah timeout command transaksi bisnis.

Setelah login/MFA berhasil, klien wajib memanggil `/auth/me` sebelum memuat data privat atau subscribe `/events`; respons memuat identitas, membership aktif, scope, izin efektif dan `permission_version`. Refresh dan setiap subscribe/replay memeriksa sesi serta `permission_version` terkini. Perubahan role/scope/membership mengirim sinyal kontrol `auth_context_changed` hanya kepada sesi pengguna terkait, tanpa daftar izin atau data privat; server menutup stream lama sehingga klien membatalkan request, menghapus cache, memanggil ulang `/auth/me`, lalu membuka stream baru jika diizinkan. Logout, penonaktifan dan force revoke menutup stream sesi yang dicabut. Semua request dengan sesi dicabut menghasilkan 401, sedangkan izin/scope yang tidak lagi berlaku menghasilkan 403/404 sesuai konteks, sekalipun pemberitahuan belum tiba. Sinyal kontrol autentikasi tidak diperlakukan sebagai event data untuk mengubah DTO bisnis.

`/api/v1` adalah satu kontrak bisnis untuk React dan Vue. Client types/schema dihasilkan dari OpenAPI yang sama saat implementasi; validasi frontend membantu input, sedangkan NestJS memutuskan izin, nilai uang, kredit, stok dan status. Router/server actions frontend tidak boleh menulis ledger atau mengimplementasikan ulang aturan posting.

TanStack Query membungkus client API tersebut dengan adapter React/Vue. Read request yang aman dapat diulang secara terbatas untuk gangguan sementara; 401/403/422 ditangani sesuai arti respons. Mutasi keuangan, stok, approval dan closing memakai retry frontend nonaktif dan menunggu hasil server. Jika respons terputus setelah pengiriman, tampilkan hasil belum terkonfirmasi, periksa status dokumen, dan gunakan kembali idempotency key operasi yang sama bila pengguna mengulangnya. Setelah mutasi berhasil, invalidasi query dokumen, daftar, saldo dan laporan terkait. Cache masing-masing frontend terpisah; refetch saat kembali fokus/reconnect mengurangi data lama, sedangkan validasi tindakan tetap dilakukan backend.

Event realtime menginvalidasi query terkait dan memicu refetch terkontrol. Replay memakai cursor terakhir; jika cursor kedaluwarsa atau versi terlewat, klien melakukan full refetch sesuai scope. Event bukan respons sukses mutasi dan tidak boleh memperbarui saldo atau status final tanpa GET server. Perubahan izin/logout menutup stream dan membersihkan cache privat.

### 2.1 Kontrak CRM yang diselaraskan dengan keputusan pengguna

- `/customers` melayani institusi sejak tahap Prospek melalui form ringkas. GET mendukung filter tahap hubungan; create tidak mensyaratkan seluruh legalitas/pajak pelanggan transaksi. Identitas prospek tetap memakai customer_id yang sama saat data dilengkapi. `relationship_stage=transacted` tidak dapat ditetapkan lewat mutasi bebas; sumbernya invoice pertama diposting.
- `/leads` merujuk customer_id wajib, kode prospek, sumber, owner, status pendekatan, next action/tanggal/penanggung jawab, catatan dan lampiran. Pembuatan institusi baru dari form prospek dapat menjadi satu operasi atomik; wajib memeriksa kemungkinan duplikasi. Alamat/channel/rayon merujuk master yang sama. Status Ditunda/Tidak Dilanjutkan memerlukan alasan sesuai konfigurasi.
- `/contacts` menyediakan kode, full_name, preferred_name, hubungan customer_id beserta job_title/department/function_ids, phone_whatsapp, email, birth_date nullable, active dan notes. Validasi institusi/cakupan pada server; mutasi kontak tidak membuat akun ERP atau mengubah tahap hubungan pelanggan.
- Endpoint requirement-lines menerima beberapa baris dengan product_id atau kategori/uraian, estimated_qty, uom_id, needed_on/needed_period serta notes. Nilai yang belum diketahui boleh null. Baris sumber ditautkan ketika membuat peluang/penawaran; baris deskriptif tidak langsung menjadi baris SO tanpa pemetaan produk, jumlah dan satuan yang valid.
- `/opportunities` memungkinkan beberapa peluang atas customer_id yang sama. Pembuatan penawaran dapat memilih kebutuhan yang relevan beserta source_requirement_line_id; pembuatan SO tetap mengikuti pesanan aktual dan validasi SO, tanpa mewajibkan seluruh tahapan CRM.
- Read riwayat kegiatan merangkai aktivitas, kontak, kunjungan, kebutuhan, penawaran dan tindak lanjut sesuai scope. Penulisan prospek/peluang/kebutuhan tidak memanggil alokasi stok, membuat PR atau menambah aktual penjualan.

Rancangan CRM lanjutan mengikuti [CRM operasional](10-sales-marketing.md). Ini kontrak konseptual, bukan endpoint yang telah berjalan.

Tahap backend yang sudah tersedia secara operasional pada Office: `POST /crm/customer-orders` untuk mencatat PO/SP pelanggan dengan Idempotency-Key, `POST /crm/customer-orders/{id}/verify` untuk verifikasi berizin, serta `POST /crm/opportunities/{id}/win` dan `/lose` untuk menutup peluang dengan pemeriksaan scope, versi, bukti verifikasi, alasan, strategi maintain, dan jumlah Decimal. Stage/confidence berversi, konversi SO, dan aktivitas tindak lanjut lanjutan tetap berada pada tahap berikutnya.

| Resource / perintah | Kontrol utama |
|---|---|
| `/pipeline-periods`, `/pipeline-stage-versions`, `/opportunities/{id}/lines`; POST `/opportunity-lines/{id}/transition`, `/win`, `/lose` | Stage/confidence berversi, scope pemilik, histori; Win hanya dengan PO/SP pelanggan terverifikasi, alasan dan strategi maintain; qty parsial tervalidasi |
| `/customer-orders` dan POST `/{id}/verify` | PO/SP masuk dari pelanggan, terpisah dari PO pengadaan. Referensi bukti/qty/pelanggan dan verifikator; bukan posting invoice atau approval SO |
| POST `/pipeline-periods/{id}/close`, `/opportunities/{id}/continue-next-period` | Server/worker berizin, lock dan idempotency; tenggat sesuai timezone/cut-off. Continuation mengikuti kebijakan yang ditetapkan, tautan predecessor, tidak membuka histori atau menggandakan qty Win |
| `/maintenance-plans`, `/crm-tasks`, `/crm-tasks/{id}/events` | Action/PIC/tenggat, hasil/penundaan beralasan, pengingat terdeduplikasi, tugas tidak dihapus saat close bulan |
| `/quotes/{id}/versions`, POST versi `/issue`, `/revise`; `/quote-responses`; POST `/quotes/{id}/create-sales-order` | Versi/masa berlaku dan item diterima, qty sisa, snapshot harga; konversi parsial atomik/idempotent; validasi SO normal tetap berlaku |
| `/customer-price-requests`, `/customer-price-request-lines` | Pelanggan/produk/satuan/cakupan/syarat/masa berlaku; keputusan melalui approval engine per versi/baris; mutasi material invalidasi keputusan lama |
| `/sales-visits/{id}/plan-versions`, `/visit-change-requests`, POST `/sales-visits/{id}/submit` | Approval atasan untuk rencana/revisi/di luar rencana, alasan dan bukti waktu; data kejadian tanpa izin ditandai belum disetujui |
| POST `/sales-visits/{id}/check-in`, `/check-out`, `/complete` | Check-in dan complete memakai OPS-VIS-01/02 aktif; nilai awal radius 200 m dan minimal satu foto. Kegagalan disimpan sebagai Exception untuk review, bukan sukses palsu |
| `/work-tracking-sessions`, POST `/{id}/location-points`, `/{id}/end`; GET `/sales-location-history` | Android 10+/iOS 15+; interval 5 menit bergerak/15 menit diam, raw 90 hari/ringkasan 1 tahun; idempotent point IDs, captured/received time dan label stale/gap |
| `/sample-requests`, `/sample-requests/{id}/submit`, `/sample-fulfillments`, `/sample-handovers`, `/sample-returns` | Approval versi/limit; issue/return aktual via gudang, batch/serial/qty/ownership; tidak membuat AR/NOO, return quarantine |
| `/sample-trials`, `/sample-trial-results`, POST `/sample-trials/{id}/complete` | Hasil/kriteria/bukti per produk, versi/retrial, reviewer/follow-up; tidak otomatis Win |

Permission granular mencakup pipeline period manage/close, customer-order verify, quote issue, customer-price request/approve, visit submit/approve, tracking read sesuai cakupan, sample request/approve/issue dan trial record/review. Nama role/jabatan tidak menjadi pengganti otorisasi. Semua perubahan bisnis memakai versi/idempotency dan audit sesuai konvensi. API tidak mengirim notifikasi eksternal pelanggan tanpa integrasi/aturan yang ditetapkan.

#### Implementasi web CRM — 29 September 2026

Office memakai `GET /crm/workspace/prospects|contacts` dengan q/status/sort=name|updated/page (20 baris), `/:id`, dan `/crm/workspace/summary`, semuanya dengan crm.read perusahaan/privileged. Summary hanya prospek aktif dan next action sampai akhir hari WITA; peluang/penawaran null. `/crm/master/customers` dan `/:id` memerlukan master_data.read; kontak PIC tetap crm.read. Proyeksi tidak mengekspos pajak/kredit/saldo. `/crm/options?q=` membutuhkan crm.create dan mengembalikan pilihan institusi/produk (maksimal 50 hasil pencarian), pengguna aktif perusahaan serta UOM tanpa harga/biaya.

POST `/crm/contacts|prospects` wajib Idempotency-Key UUID. ID deterministik dipisah perusahaan/pengguna/jenis/key, advisory transaction lock, nomor, insert dan audit request_hash berada dalam satu transaksi. Retry identik mengembalikan record sama; payload berbeda pada key sama ditolak 409. Audit penciptaan harus dipertahankan selama record hidup. Penomoran memakai versi efektif ACTIVE OPS-WH-04 tanpa fallback; prefix prospect belum ada pada katalog awal dan harus dilengkapi administrator. PATCH status membutuhkan crm.update, quoted positive integer If-Match, update atomik id/perusahaan/versi, alasan untuk Ditunda/Tidak Dilanjutkan dan audit; versi usang 412. Jumlah kebutuhan decimal positif dengan satuan basis/konversi efektif produk.

Tindak lanjut Dashboard menautkan `/crm/prospects/:id`. Form peluang/Win belum memiliki mutasi operasional. Gap lengkap tercatat di [pembangunan CRM](../mockup/crm-build.md). Tidak ada migrasi, perubahan stok atau posting pada tahap ini.

### 2.2 Estimasi penjualan dan penagihan

Rancangan resource `/sales-forecasts` dan `/collection-forecasts`: daftar/detail menurut periode, as_of, pemilik/cakupan; versi dan rincian baris. POST `/{id}/suggest-lines` membuat usulan yang dapat ditinjau, `/{id}/versions` menyimpan revisi beralasan dengan optimistic locking/idempotency, GET `/{id}/comparison` memberi target, proyeksi akhir periode, aktual, E/T, A/T dan rincian sumber sesuai izin.

Server memvalidasi nilai net penjualan, satuan, sisa piutang, tanggal perkiraan dan cakupan sumber. Tahap peluang/penawaran/pesanan tidak dijumlahkan berulang; realisasi dipetakan ke dokumen posted. Total cicilan estimasi aktif tidak melampaui sisa invoice; skenario/versi alternatif tidak dijumlahkan. Tanggal acuan, versi dan status data sumber disertakan agar nominal tersimpan tidak disalahartikan sebagai posisi piutang terkini. Hak estimasi read/create/revise dipisah; tidak membuat pembayaran, jurnal, PR atau reservasi.

### 2.3 Pengaturan persetujuan

`/approval-policies` mendukung draft, validate/simulate, activate/inactivate. Activate menolak policy tanpa assignee, scope, limit dan fallback. `allow_self_approval` default false; reminder default 240 menit kerja dan escalation 480 menit kerja. `/approval-delegations` tidak memperluas limit. GET `/approval-tasks?assigned_to=me` mengambil antrean sesuai hak dan penunjukan.

POST `/approval-instances/{id}/decisions` memvalidasi versi bisnis, tahap aktif, hak/penunjukan/scope/limit terkini, delegasi, persetujuan sendiri dan satu suara per pengguna per tahap. Aksi approve/request_revision/reject menyimpan alasan sesuai kebijakan. Kunci instance/dokumen dalam satu transaksi; retry tidak menggandakan keputusan atau meloloskan versi lama. Policy berubah tidak otomatis merutekan ulang instance berjalan; pengalihan berizin harus tercatat. SO normal tetap ditolak oleh endpoint approval, sedangkan unlock memakai instance sendiri. Spesifikasi bisnis mengikuti IAM-07–09 dan Design.

### 2.4 Waktu, kehadiran, cuti dan lembur

`POST /attendance-imports` hanya membuat staging. `POST /attendance-imports/{id}/validate` memeriksa format, timezone, mapping dan duplikasi; `commit` membuat event valid secara idempoten; `reprocess` hanya memproses ulang baris staging setelah mapping diperbaiki dan tidak mengubah raw record. GET hasil impor mengembalikan jumlah Valid, Perlu Mapping, Duplikat, Ambigu dan Ditolak.

`POST /attendance/recalculate` menghitung hasil harian dari kalender, shift, event, cuti/izin, perjalanan dinas dan koreksi dengan versi policy yang berlaku. Koreksi, cuti dan lembur memakai command submit/approve/reject/cancel sesuai status. Periode absensi memakai `/attendance-periods/{id}/validate`, `/submit-review`, `/cutoff` dan `/reopen`; cut-off ditolak bila blocker wajib masih ada. Snapshot cut-off dibaca payroll dengan referensi ID/hash dan tidak diganti oleh perhitungan ulang data live. Detail mengikuti dokumen 26.

## 3. Contoh SO dan kredit

```http
POST /api/v1/sales-orders
Idempotency-Key: order-demo-001
Content-Type: application/json
```

```json
{
  "customer_id": "<uuid>",
  "business_date": "2026-10-01",
  "payment_term_id": "<uuid>",
  "customer_reference": "SP-DEMO-001",
  "attachment_ids": ["<uuid>"],
  "lines": [{"product_id":"<uuid>","uom_id":"<uuid>","quantity":"2.000000","unit_price":"250000.00","discount_rate":"0.00000000","tax_rule_id":"<uuid>"}]
}
```

Respons 201: document ID, draft number/reference, version=1, totals server, status terpisah. Semua item/jumlah pesanan wajib dikirim sebagai lines, termasuk stok kosong; create/update draft tidak mengurangi quantity berdasarkan availability. Client tidak menentukan validation_status, cost, credit_status, grant unlock atau posting_state.

`POST /sales-orders/{id}/submit` atau `/reevaluate` menjalankan pipeline validasi data/aturan → kredit → stok → alokasi/release otomatis. Pemeriksaan menggunakan rule snapshot dan grant unlock yang valid. Contoh hasil hold merupakan evaluasi sukses HTTP 200, bukan error teknis:

```json
{
  "data": {
    "credit_status": "held",
    "limit": "100000000.00",
    "exposure_after_order": "105000000.00",
    "excess_amount": "5000000.00",
    "reasons": [{"code":"CREDIT_LIMIT_EXCEEDED","message":"Nilai transaksi melebihi sisa limit kredit."}],
    "stock_allocation_check_allowed": false,
    "version": 3
  }
}
```

Alokasi/release merupakan langkah internal pipeline, bukan antrean persetujuan manual. Backend memvalidasi ketentuan pembayaran, mengunci customer/stock terkait, menilai kredit termasuk pengecualian valid untuk tempo, lalu memilih stok FEFO. Jika gate kredit tempo belum terpenuhi, tidak ada reservation baru dan pemeriksaan stok SO belum dijalankan. `stock_allocation_check_allowed` mengacu evaluasi/alokasi resmi; GET availability tetap tersedia sesuai izin saat input Draft/credit hold. Jika stok kurang, alokasikan jumlah tersedia per item dan tampilkan sisanya sebagai backorder yang dapat ditutup pengguna berizin. Stok nol tidak menghasilkan dokumen pemenuhan kosong. Backorder belum dialokasikan tidak memakai limit; komitmen mulai saat alokasi dan mengikuti keputusan D05.

POST `/customers` dapat dipanggil dari form SO oleh pengguna berizin dengan pemeriksaan kandidat duplikat; server menetapkan mode COD dengan periode awal tiga bulan; Finance dapat memilih prepay. Menetapkan tempo memakai hak pengelolaan kebijakan pelanggan, memerlukan TOP dan limit lengkap, versi/tanggal efektif serta audit; field kredit tidak dapat disisipkan melalui create/update master biasa oleh pengguna tanpa hak. Draft SO boleh tersimpan saat ketentuan belum lengkap, tetapi submit ditolak dengan penjelasan field yang perlu dilengkapi. Order mengambil snapshot kebijakan server, bukan nilai credit_mode/limit yang dipercaya dari frontend.

Pada prepay, evaluasi memberi credit_status `not_applicable`; alokasi/proforma dapat dibuat saat dana belum diterima. POST `/fulfillment-batches/{id}/reserve-funds` menerima sumber uang muka dan nominal, memeriksa penerimaan posted/terverifikasi serta dana bebas, lalu mengikatnya ke tahap tanpa posting AR Proforma. `dispatch` mengecek dana cukup terhadap nilai tahap terbaru, selain kualitas/picking/checking/kondisi dokumen, dalam transaksi terkunci. Respons kekurangan dana memakai `PREPAYMENT_REQUIRED`. Unggahan bukti transfer atau grant unlock kredit tidak menggantikan penerimaan dana. GET detail memberi nilai yang diperlukan, dana terikat dan kekurangan dari server; frontend tidak mengirim status paid yang dipercaya. Setiap jalur alokasi invoice/refund memeriksa funding links agar satu dana tidak terpakai ganda.

Reservasi prepay baru diberi `expires_at` berdasarkan OPS-FIN-06; nilai awal adalah akhir satu hari kerja berikutnya menurut kalender perusahaan. Worker expiry mengunci fulfillment/reservation/stock, mengecek ulang dana, lalu hanya melepas qty yang belum picking. Qty yang sudah picking menghasilkan tugas return-to-stock dan tidak dilepas melalui update saldo langsung.

Pengajuan unlock menerima `sales_order_business_revision`, `lock_ids`, alasan dan `evidence_attachment_ids`; server menentukan kelayakan alasan serta policy/approver dari konfigurasi, tidak menerima approver bebas dari pemohon. SO tetap held ketika request submitted. Respons 201 memuat request ID, approval instance dan status. Pemberi keputusan memakai `POST /approval-instances/{id}/decisions` dengan izin unlock sesuai keputusan, penunjukan, scope dan limit. Endpoint generik ini menolak keputusan terhadap SO normal.

Persetujuan menyimpan grant yang terkait SO/revisi/alasan/batas/masa berlaku dan memicu evaluasi ulang otomatis; penolakan menyimpan catatan dan mempertahankan hold yang belum terselesaikan. Grant tidak mengubah saldo AR/limit master. Pemeriksaan yang diizinkan melalui grant menghasilkan `passed_by_unlock`, dengan actual exposure tetap ditampilkan. Blokir lain tetap berlaku. Perubahan revisi/lock di luar lingkup atau keputusan ganda ditolak dengan 409; `If-Match` dan idempotency tetap berlaku. Request yang tidak lagi diperlukan karena penyebab telah selesai menjadi superseded.

### 3.1 Pemenuhan, penutupan sisa dan pembatalan

GET SO memuat jumlah per baris `ordered_base_qty`, `reserved_base_qty`, `picked_base_qty`, `dispatched_base_qty`, `accepted_base_qty`, `open_to_ship_base_qty`, `backorder_base_qty`, `closed_base_qty`, `cancelled_base_qty` serta status lifecycle/credit/fulfillment/billing/payment terpisah. Picked adalah subset reserved, accepted adalah subset dispatched, dan backorder adalah bagian open_to_ship; klien tidak menjumlahkan semuanya menjadi total pesanan. Backorder belum diketahui dikirim null dengan stock_evaluation_status, bukan nol yang menyesatkan. Tampilkan satuan transaksi dengan factor_snapshot.

Penerbitan proforma/picking menerima ID dan versi tahap, bukan daftar item bebas dari klien. Server mengambil alokasi aktif yang belum dipakai tahap lain. Packing List berasal dari picking yang lolos checking. Semua jalur penerbitan, termasuk `/proformas/{id}/issue`, memakai service dan validasi yang sama. Qty berubah → revisi tahap dan void/supersede dokumen terdampak secara terlacak; PDF lama tetap diarsipkan. Retry menghasilkan dokumen yang sama, bukan dokumen/tagihan/alokasi baru.

`POST /sales-orders/{id}/close-remaining` menerima `lines: [{order_line_id, quantity_base}]` dan `reason`; jumlah harus positif dan belum dikirim/ditutup/dibatalkan. Tindakan ini menutup sisa tanpa mengubah ordered quantity. `POST /sales-orders/{id}/cancel-remaining` menerima baris/jumlah, alasan dan `customer_confirmation_id`; dipakai ketika pelanggan membatalkan sisa pada SO dengan realisasi kirim. `POST /sales-orders/{id}/cancel` menerima alasan dan `customer_confirmation_id` untuk menghentikan seluruh sisa aktif SO yang belum dikirim. Endpoint konfirmasi mencatat nama/kontak pelanggan, waktu, media, isi atau referensi, serta attachment opsional; server memeriksa konfirmasi milik SO/pelanggan yang sama.

Semua aksi memerlukan hak sesuai tindakan, If-Match dan Idempotency-Key. Server mengunci aggregate/alokasi, menilai ulang qty/dampak dan merekam action. Jika belum ada picking, penyelesaian dapat langsung completed dan melepas reservasi/komitmen belum terpakai. Jika sudah picking/packing, action pending dan qty sasaran dibekukan; respons 200 memuat `action_id`, `action_state`, `required_warehouse_tasks` dan status SO terkini. Setelah gudang mengonfirmasi pengembalian lewat pergerakan yang tertaut action, service memfinalisasi close/cancel secara atomik. HTTP sukses atas pencatatan pending bukan berarti pembatalan sudah selesai.

Full cancel yang menemukan pengiriman aktif/POD/invoice ditolak dengan `ORDER_HAS_EXECUTED_FULFILLMENT`; respons mengarahkan pengguna ke pembatalan sisa dan proses penyelesaian pengiriman/retur/koreksi. Tidak menghapus invoice/AR/settlement atau menganggap uang muka telah direfund. Perintah atas SO yang telah diubah pihak lain menolak versi lama; pembatalan versus dispatch dan close versus alokasi wajib saling mengunci, bukan hanya mengandalkan tampilan awal.

## 4. Invoice, pembayaran dan reversal

Create invoice menerima `delivery_receipt_line_id` dan `quantity`; backend memastikan qty diterima yang belum ditagih, harga referensi, tax profile dan periode. Posting invoice menciptakan open item dan jurnal/reklassifikasi satu transaksi. `POST /payments/{id}/post` memakai alokasi:

```json
{
  "business_date": "2026-10-05",
  "bank_account_id": "<uuid>",
  "amount": "1000000.00",
  "allocations": [{"open_item_id":"<uuid>","amount":"1000000.00"}],
  "unallocated_treatment": "reject",
  "evidence_attachment_id": "<uuid>"
}
```

Nominal lebih dari invoice tidak otomatis dihapus/dianggap pendapatan; jika disetujui sebagai uang muka, buat komponen advance eksplisit. Withholding memakai komponen dan bukti sendiri; uang masuk bank tidak dipaksakan sama dengan pengurangan AR bila ada potongan pajak sah. Total alokasi dan komponen harus merekonsiliasi nilai pembayaran. Reversal membutuhkan tanggal periode terbuka, alasan, original_id, approval bila diperlukan; menambah jurnal berlawanan dan membalik settlement, bukan menghapusnya.

## 5. Closing, impor dan pekerjaan lama

`POST /close-runs/{id}/validate` mengembalikan checklist dengan `blocking`, `source_reference`, `owner`, `difference`. Close menolak jika blocker masih terbuka dan memeriksa ulang di transaksi yang mengunci period. Contoh 409 `CLOSE_BLOCKED` memberi item `AR_GL_MISMATCH` dengan selisih serta tautan laporan. Perubahan ledger setelah validasi membuat hasil validasi stale dan memerlukan validasi ulang.

Upload menghasilkan import job 202; response mencantumkan `job_id` dan `status_url`. Validasi staging tidak menulis ledger. Preview menunjukkan create/update/error dan total kontrol; commit membutuhkan versi/hash input yang sama. Opening post menolak akun kontrol yang diimpor ganda lewat GL dan subledger. Pembuatan XML Coretax berjalan sebagai export job 202: validate dan preview tidak mengubah ledger, generate menyimpan file/hash serta snapshot versi, dan download tidak mengubah status otoritas. `mark-uploaded` atau pencatatan hasil memerlukan bukti; hasil file tidak otomatis menjadikan tax document approved/accepted.

BullMQ/Redis menjalankan pekerjaan lama dan kalkulasi draft dengan status durable di PostgreSQL. Posting dokumen tetap atomik di API; relay menerbitkan outbox setelah commit. Retry tidak menciptakan posting kedua. Status 202 hanya berarti pekerjaan diterima, bukan PDF sudah tersedia, payroll approved, atau faktur pajak disahkan.

## 6. Error dan status HTTP

Gunakan `application/problem+json`:

```json
{
  "type": "urn:ssm:problem:period-closed",
  "title": "Periode sudah ditutup",
  "status": 409,
  "code": "PERIOD_CLOSED",
  "detail": "Tanggal transaksi berada dalam periode yang telah ditutup.",
  "request_id": "<uuid>",
  "errors": [{"field":"business_date","message":"Pilih periode terbuka atau ajukan koreksi."}]
}
```

200 read/action; 201 create; 202 job; 204 logout/no body; 400 malformed; 401 unauthenticated; 403 forbidden; 404 tidak ditemukan atau di luar scope; 409 state/stock/idempotency conflict; 412 stale version; 422 field/business validation; 429 rate limit; 500 error tak terduga dengan request_id, tanpa stack trace/payload sensitif.

Kode stabil minimum: CREDIT_HOLD, STOCK_NOT_AVAILABLE, BATCH_BLOCKED, SOURCE_QTY_EXCEEDED, DOCUMENT_VERSION_CHANGED, CUSTOMER_CONFIRMATION_REQUIRED, ORDER_HAS_EXECUTED_FULFILLMENT, FULFILLMENT_REVISION_STALE, APPROVAL_REQUIRED, DUPLICATE_SUPPLIER_INVOICE, OVERALLOCATION, JOURNAL_NOT_BALANCED, PERIOD_CLOSED, CLOSE_BLOCKED, OPENING_NOT_RECONCILED, IDEMPOTENCY_CONFLICT. UI menerjemahkan kode ke tindakan yang dapat dilakukan pengguna.

## 7. Contract tests yang diperlukan

Uji schema dan serialisasi desimal; role/scope/IDOR; harga total dihitung server; idempotency retry/concurrency; stale version; partial fulfillment; invoice/payment over-allocation; non-atomic failure rollback; posted immutability; close-post race; signed attachment access; tax job hasil gagal; payroll self-service. Tambahkan pengujian kontrak dari kedua frontend, cookie/CSRF, refresh bersamaan, logout/revocation/role berubah, queue retry dan larangan cache data privat pada PWA. Kontrak OpenAPI dan client types dibuat saat implementasi setelah nama field final, lalu divalidasi terhadap endpoint nyata.


### Customer onboarding, collection schedule, dan perjalanan

- `POST /customers/{id}/onboarding/verify` memvalidasi legalitas, NPWP/NIK, PKP/Non-PKP, PIC, NOO dan dokumen channel; status tersimpan sebagai snapshot audit.
- `POST /customers/{id}/payment-policies` menerima `payment_mode` (`cod`, `prepay`, `credit`), tanggal efektif, TOP, limit dan alasan. Server menolak `credit` tanpa TOP/limit serta menolak perubahan tanpa hak.
- `GET /customers/{id}/collection-schedule` menghasilkan follow-up H-7, H, H+3, H+7, H+14 dan freeze H+30 dari due date; jadwal tidak mengubah saldo.
- `POST /collection-followups` mencatat hasil, janji bayar, bukti dan tindakan berikutnya. Freeze hanya dapat dikecualikan melalui unlock/policy yang disetujui.
- `POST /travel-requests`, `/travel-advances/{id}/submit`, `/travel-settlements/{id}/submit` menjalankan validasi tanggal, plafon, bukti, cut-off, outstanding advance dan approval. Nilai plafon diambil dari versi policy yang berlaku saat pengajuan.












### CRM tahap pertama — draft peluang

`POST /crm/prospects` menerima tepat satu `customer_id` atau `new_customer` ringkas (name, channel_id wajib, rayon_id/primary_address opsional). crm.create dan scope perusahaan wajib. Institusi baru dan prospek dibuat atomik; duplikasi normalized name ditolak dan rollback tidak meninggalkan institusi tanpa prospek. Identitas tetap pada tahap Prospek; tidak mengubah onboarding menjadi verified.

`POST /crm/prospects/:id/needs` memakai crm.create, Idempotency-Key UUID, body version dan needs (1–100). Versi prospek bertambah atomik, versi basi ditolak 412. Produk/satuan diperiksa terhadap perusahaan serta konversi produk. Estimasi null diperbolehkan, nol/negatif ditolak. Retry identik mengembalikan prospek tanpa membuat baris/audit ulang; payload berbeda pada key yang sama ditolak 409.

`POST /crm/opportunities` memakai crm.create dan Idempotency-Key UUID. Body: prospect_id, period YYYY-MM, source_need_ids unik (1–100), contact_ids aktif pada institusi yang sama, notes opsional. Customer/owner dan snapshot kebutuhan diturunkan server dari prospek. Tidak menerima stage/confidence atau status dari klien. Hasil hanya DRAFT; tidak mengaktifkan pipeline maupun menambah forecast/aktual. `GET /crm/prospects/:id/opportunities` memakai crm.read dan scope perusahaan, mengembalikan draft dengan baris snapshot/referensi sumber. Penomoran prospect/opportunity memakai prefix yang dikonfigurasi administrator pada OPS-WH-04; tidak ada prefix produksi yang ditebak.

### O2C correction implementation — 3 October 2026

Credit-note posting splits the net return amount between the source invoice's
open AR and customer advance liability. A paid invoice therefore creates customer
credit without making AR negative or posting cash out. Each liability ledger row
references its credit note; refund availability equals that note's posted advance
credit less posted refunds. The minimal ledger uses `CUSTOMER_ADVANCE` for this
liability, as permitted by Finance; a separate GL posting profile remains a release
gate. No schema migration is required for this correction.

Credit-note posting locks the return and invoice. Refund posting locks the note
and serializes the company/idempotency key. Changed refund payloads return
`IDEMPOTENCY_PAYLOAD_MISMATCH`; unavailable credit returns `REFUND_EXCEEDED`.
Return source lines must belong to the selected company, customer and invoice POD.
This does not complete configured approval, reversal, bank reconciliation or UI.

### Kontrak operasional OTC — 5 Oktober 2026

POST create SO, submit, picking/checking, dispatch, POD, invoice, receipt dan alokasi memerlukan Idempotency-Key (8–200 karakter). Company/actor berasal dari sesi. Replay payload identik mengembalikan snapshot respons; key sama dengan payload berbeda 409. SO memakai persetujuan hanya bila aturannya aktif (24 Oktober 2026). Missing policy/bukti, harga exception, credit hold, overdue, freeze, stock tidak layak dan approval tidak memenuhi assignment/limit ditolak server. SP memerlukan customer_reference, delivery_address, evidence_id; POD receiver_name/evidence_id; receipt bank_reference/evidence_id. Retur POD memerlukan quarantine_locator_id valid.

GET /operations/lists/{orders|warehouse|pick-slips|invoices|proformas} mendukung page (25 rows) dan search nomor. Daftar `orders` juga menerima `state`, `customer_id` (uuid), `from`/`to` (tanggal lokal perusahaan YYYY-MM-DD, inklusif, `from` ≤ `to`), `fulfillment=NOT_SHIPPED|PARTIAL|SHIPPED` (terkirim = diterima + dalam perjalanan + retur dibanding jumlah dipesan) dan `remainder=BACKORDER|IN_PROGRESS|NOT_EVALUATED|CLOSED` dengan aturan yang sama seperti status sisa pada read model SO; respons menambahkan `filters.customers` berisi pelanggan yang memiliki SO pada perusahaan aktif. Parameter ini ditolak untuk nilai tidak dikenal dan tidak berlaku pada daftar lain. Daftar `warehouse` juga menerima `stage=checking|shipping|pod` untuk memfilter antrean berdasarkan state picking/fulfillment; filter ini hanya read model dan tidak mengubah state. `POST /pick-lists/:id/confirm-pick` menerima seluruh baris pick list dan `picked_quantity` decimal yang tidak boleh melebihi alokasi. `POST /pick-lists/:id/confirm-check` menerima metadata checking/packing opsional (kondisi per baris, jumlah koli, berat, jenis kemasan, catatan, label) dan menerbitkan dokumen PACKING setelah validasi server. Daftar `pick-slips` memuat tahap ALLOCATED yang belum memiliki Pick Slip sebagai tugas “Belum dibuat” dan memerlukan `fulfillment.read`; daftar `proformas` memuat tahap ALLOCATED tanpa Proforma sebagai “Menunggu diterbitkan” dan memerlukan `sales_order.read` atau `proforma.issue`. Detail tersedia pada /operations/{orders|warehouse|invoices}/:id. Izin berurutan sales_order.read, fulfillment.read, sales_invoice.read; detail invoice dengan daftar receipt juga memerlukan customer_receipt.read. Dokumen /operations/documents/:id memakai izin domain dokumen; /operations/audit/:id memakai audit_event.read. POST /operations/evidence menerima purpose SALES_ORDER/POD/PAYMENT, name, base64 JPEG/PNG <=2 MB, diperiksa permission create/confirm/post terkait. GET bukti memerlukan read domain dan company sama; file dinormalisasi PNG privat, tidak memakai public URL.

POST /operations/warehouse/:id/shipment memerlukan fulfillment.dispatch dan data driver/vehicle/planned_at. POST /operations/stock/:id/quality memerlukan inventory.quality.decide dan alasan. POST /operations/tax-rules (sales_tax_rule.manage) serta /operations/approval-policies (transaction_approval.manage) memvalidasi interval non-overlap, scope pihak dan numeric/rule. Company lock menyerialkan penambahan rule. Konfigurasi approval PR/unlock/harga khusus mendukung ANY/ALL berurutan, tanpa self-approval. Batas cakupan: [pembangunan OTC](../development/otc-operational-build.md).

### Perluasan exception dan Finance OTC

- GET/POST `/operations/orders/:id/exceptions`, POST `/operations/exceptions/:id/decisions`: request/decision memakai izin unlock atau price_request sesuai jenis. Keputusan final menulis outbox evaluasi atomik. Respons dapat berisi evaluation_error meskipun approval tersimpan; status evaluasi juga tersedia pada daftar request. Perubahan material atau grant kedaluwarsa tidak mengizinkan proses.
- GET `/operations/backorders` (sales_order.read), POST `/operations/orders/:id/reallocate` (sales_order.reallocate, version wajib). Submit biasa pada OPEN dengan sisa ditolak REALLOCATION_COMMAND_REQUIRED. Alokasi ulang tetap memeriksa kredit, stok dan harga khusus.
- `/finance-controls/configuration` dan POST `/:kind` (layar Setting › Pemetaan Akun, `/setting/account-mapping`): izin per jenis; `profile` memakai account_mapping.manage, `account` account.create, `period` finance_period.close, `bank` bank_account.manage. GET hanya mengembalikan bagian yang boleh dibaca pemanggil (profil: account_mapping.read, akun: account.read, periode: finance_period.close). GET `/banks` menerima salah satu izin customer_receipt.post, bank_statement.import atau bank_reconciliation.read. Receipt baru wajib bank_account_id.
- GET/POST `/finance-controls/tax-rules`: tax_rule.read/sales_tax_rule.manage. `/invoices/:id/tax-components`, `/tax-components`, `/:id/verify`, `/:id/post` memakai izin read/create/verify/post terpisah. TAX adalah purpose evidence tambahan. Nominal WAPU/PPh dihitung server; hanya verified yang dapat diposting untuk settlement.
- `/official-tax-documents`, `/:id/verify`, `/tax-sources`: tax_component.read/create/verify; sumber invoice atau advance_tax; nomor/bukti resmi tidak dibuat oleh ERP. Pencatatan/verifikasi tidak mengulang jurnal.
- `/statements`, `/:id`, `/:id/review`, `/:id/close`, `/statement-lines/:id/match`: bank_statement.import dan bank_reconciliation.read/match/review/close. Match menerima receipt_id dan amount opsional (default sisa baris), mendukung parsial/gabungan tanpa overmatch. CSV di layar diubah menjadi baris staging dan semua nilainya divalidasi backend. Selisih/unmatched menahan close; closed menahan match dan receipt bertanggal dalam cakupannya.
- `/reconciliation`, `/journals/:id` memerlukan journal.read **dan** inventory.cost.read karena hasil memuat nilai persediaan/HPP. Rekonsiliasi saat ini membandingkan ledger-kind vs GL dan outstanding AR, belum seluruh subledger ekonomi.

Semua mutasi di atas memakai Idempotency-Key dan scope perusahaan sesi. Tidak ada endpoint edit saldo atau edit jurnal posted. Delegasi, reversal/closing penuh, correction faktur resmi, bank fees/transfer/timing exceptions dan seluruh parity UI masih belum tercakup.

## Pembaruan backend O2C — 5 Oktober 2026

Pembangunan layar Sales Order memperluas read model: GET `/operations/lists/orders` menerima pencarian nama/nomor dan `state` DRAFT/OPEN/CLOSED/CANCELLED, page size 25, mengembalikan dimensi pemenuhan/sisa, nilai Decimal dan summary seluruh perusahaan. Nilai pajak/total tanpa snapshot adalah null; summary kredit belum tersedia bernilai null, bukan nol. GET `/operations/orders/:id` menambah subtotal/pajak/remainder per baris, UOM, nama pembuat dan ringkasan. GET `/operations/order-options` memerlukan sales_order.create atau sales_order.update (company scope), mengembalikan pelanggan aktif, alamat pengiriman, termin tanpa limit/exposure, produk/satuan serta currency/timezone perusahaan. Tidak mengubah kontrak mutasi atau membuka harga modal.

Command tambahan mencakup revisi SO, resolve picking discrepancy, release fulfillment, close remainder, issue invoice sebelum POD, cancel/delegate exception approval, funding batch, bank match/unmatch/reopen, bank transaction approval/post, refund approval, advance refund, source reversal, tax rule activation dan period action. Finance memakai prefix finance-controls; request/decision/post terpisah, Idempotency-Key wajib untuk mutasi. Refund memerlukan bank_account_id, evidence_id, bank_reference, currency sumber dan approval_request_id. Pembacaan request dibatasi company dan izin domain. Rincian handler/payload berada pada contracts dan controller, dengan status batas implementasi pada laporan remediasi.

Rujukan implementasi dan batas verifikasi: [laporan remediasi backend O2C](../development/o2c-backend-remediation-2026-10-05.md).


## Pengelolaan akses — keputusan 7 Oktober 2026

IAM-01/04/11: pengguna dapat memiliki beberapa peran; izin efektif adalah gabungan izin peran aktif sesuai scope. Pengelolaan akun dan peran hanya untuk pemegang peran aktif Admin Sistem (`ADMIN_SYSTEM`) dalam perusahaan sesi, dengan permission aksi yang sesuai. Nama jabatan atau nama tampilan peran bukan bukti administrator. Pengguna → pilih akun → tetapkan beberapa peran; Peran → Atur Hak Akses → ubah checkbox matriks peran → simpan. Menu Pengguna/Peran/Matriks disembunyikan bagi nonadministrator; deep link dan seluruh endpoint `/users`, `/roles`, `/permissions` beserta mutasinya ditolak 403 walaupun permission IAM terlanjur diberikan. Pengaturan bisnis lain tetap mengikuti permission domain. Tidak ada bypass izin transaksi untuk Admin Sistem. Perubahan akses diaudit dan sesi terdampak dicabut. Tidak ada perubahan model database atau migration; implementasi dan batas validasi dicatat pada [catatan pengelolaan akses](../development/iam-admin-only-2026-10-07.md).

### Akses Proforma Office — 7 Oktober 2026

GET /operations/lists/proformas?page=1&search=... mengembalikan rows/total, urutan tahap terbaru, 25 baris per halaman. Baris tahap ALLOCATED tanpa Proforma berstatus PENDING dan memiliki tautan penerbitan, tanpa nomor atau snapshot dokumen. Search mencakup nomor Proforma, tahap pemenuhan, SO dan nama pelanggan. GET /operations/proformas/{id} mengembalikan dokumen PROFORMA beserta snapshot cetak dan referensi batch/SO. Daftar dan detail memerlukan `sales_order.read` atau `proforma.issue` pada company/privileged scope perusahaan sesi. Penerbitan tetap memakai `proforma.issue`; membaca baris antrean tidak membuat dokumen atau reservasi baru.
## Kontrak draft Invoice web

Draft Invoice berbasis POD dapat disimpan dan diperbarui sebelum posting. Endpoint `POST /sales-invoice-drafts` dan `POST /sales-invoice-drafts/:id` menerima `delivery_receipt_id`, `billing_reference`, `notes`, serta `version` wajib cocok pada edit. Keduanya memerlukan `sales_invoice.post` dan Idempotency-Key. Snapshot draft menyimpan versi, rincian sumber dan nilai desimal; tidak membentuk AR/jurnal. Nilai komersial mengikuti POD. Posting `POST /sales-invoices` menggunakan nomor/identitas draft yang sama dan memeriksa ulang nilai sumber. Invoice posted tidak dapat diedit melalui endpoint draft. Lihat [cakupan dan bukti UI Invoice](../development/invoice-ar-ui-2026-10-13.md).


### Antrean Barang Keluar dan draft picking (16 Oktober 2026)

- `GET /operations/outbound/:stage` (`picking|checking|shipping|pod`), izin `fulfillment.read`, query `page`, `search`, `status`: company-scoped; 25 baris, summary status seluruh hasil pencarian, urutan createdAt descending lalu ID.
- `GET /operations/returns`, `GET /operations/returns/:id`, `GET /operations/return-sources`, izin `customer_return.receive`: daftar/detail penerimaan karantina dan lookup 250 POD terakhir serta locator karantina aktif. Tidak memberikan izin Invoice/credit note atau keputusan mutu.
- `POST /pick-lists/:id/save-draft`, izin `fulfillment.pick`, Idempotency-Key: payload confirm-pick dengan `version` wajib; tetap OPEN, pickedAt null, audit `pick_list.draft_saved`, version bertambah. Seluruh ID baris unik wajib dikirim, qty 0 sampai alokasi; versi lama atau tahap tidak ALLOCATED ditolak.
- `confirm-pick` menerima optional `version` dan `reason`; version bila diberikan harus cocok. `confirm-check` menerima optional `checked_quantity` pada checks; harus sama dengan picked quantity, seluruh baris unik harus lengkap, kondisi BAIK. Ketidaksesuaian ditolak sebelum dokumen packing terbit.

## Redesign Sales dan penyerahan dokumen - 16 Oktober 2026

OTC-05/06/15: `GET /operations/commercial-handoffs/:kind/:id` membaca riwayat company-scoped; kind proforma/invoice. Izin baca Proforma sales_order.read atau proforma.issue, Invoice sales_invoice.read. POST pada path sama memerlukan proforma.issue atau sales_invoice.post dan Idempotency-Key. Payload: delivered_at (bukan masa depan), delivered_by, recipient, medium IN_PERSON/COURIER/EMAIL/OTHER, evidence_id, optional promise_date dan notes. Bukti harus milik perusahaan dan purpose PROFORMA_HANDOFF/INVOICE_HANDOFF. Hanya Proforma aktif ISSUED atau Invoice POSTED/PARTIALLY_PAID/PAID yang diterima. Transaksi mengunci dokumen/tahap, menyimpan audit immutable commercial_document.handed_over. Retry identik tidak menggandakan penyerahan. Janji bayar tidak mengubah due date, saldo, ledger atau status pembayaran. Tidak ada migration baru.

Daftar Proforma/Invoice menerima view untuk filter server sebelum pagination, serta summary seluruh hasil pencarian. Nilai Proforma berasal dari snapshot; dana tersedia hanya receipt POSTED dengan batch dan currency sama serta izin customer_receipt.read. Keterbatasan dan bukti: [Redesign Sales](../development/sales-redesign-2026-10-16.md).


### Workspace Master Data bersama (23 Oktober 2026)

Untuk `suppliers`, `vendors`, `warehouses`, `locators` dan `operational-items`: GET `/master-data/workspace/:resource` (filter whitelist `q`, `state`, `parent` khusus lokator, `page`; 20 baris, urut nama/id, scope perusahaan), GET `/master-data/workspace/:resource/:id`, GET `/master-data/workspace/:resource/:id/history` (audit read-only dengan nama aktor) dan POST `/master-data/workspace/:resource/duplicate-check` (`name`, `exclude_id` opsional; tidak menulis data). Semua memakai izin `master_<resource>.read` per submenu, tanpa grant induk. PATCH `/master-data/{vendors|warehouses|locators|operational-items}/:id` memerlukan `master_<resource>.update`, `version` pada body, mengembalikan 412 bila versi berubah dan 409 bila nama bentrok, serta mencatat audit `master.<resource>.updated`. Gudang induk lokator dan satuan dasar item tidak dapat diubah lewat PATCH ini. Pelanggan dan Produk tetap memakai endpoint detail/ubah khususnya.

Lanjutan 23 Oktober 2026: daftar berhalaman yang sama melayani `products` (filter `parent` = kategori) serta referensi `product-categories`, `uoms`, `customer-channels` dan `rayons` (detail, riwayat dan cek duplikat ikut tersedia untuk referensi). PATCH `/master-data/{product-categories|uoms|customer-channels}/:id` menerima `name` + `version`, `/master-data/rayons/:id` juga `coverage_notes`; kode referensi tidak dapat diubah. Upload `POST /operations/evidence` menerima purpose `PRODUCT_MASTER` dengan izin `master_product.update` (baca `master_product.read`). `evidence_object_key` pada registrasi izin edar wajib berupa ID bukti `PRODUCT_MASTER` milik perusahaan yang sama, jika tidak 409 `BUKTI_IZIN_EDAR_TIDAK_VALID`. Create produk selalu menyimpan izin edar awal sebagai `PENDING` walaupun `permit_status` dikirim. PATCH produk menolak perubahan satuan dasar dengan 409 `PRODUCT_BASE_UOM_LOCKED` kecuali produk masih Draf dan belum dipakai stok, SO atau PO.

### Workspace Master Pelanggan (16 Oktober 2026)

GET `/master-data/customer-workspace/list` memerlukan `master_data.read`, scope perusahaan, pencarian kode/nama, filter onboarding/relationship/channel dan pagination 20 baris dengan urutan nama/id stabil. GET `/master-data/customers/:id`, `/history`, dan `/sales` memvalidasi kepemilikan perusahaan. Proyeksi kontak memerlukan `crm.read`; payment policy memerlukan `customer.payment_policy.manage`; histori SO dan invoice masing-masing memerlukan `sales_order.read` dan `sales_invoice.read`. History dan sales dibatasi 100 record terbaru.

PATCH `/crm/contacts/:id` memakai `crm.update`, If-Match positif, scope perusahaan, update atomik berdasarkan versi serta audit. Customer kontak tidak dapat dipindahkan melalui endpoint ini. HP/WhatsApp disimpan pada Contact.phone yang sama untuk setiap fungsi PIC. POST `/master-data/customers/:id/archive` memakai `master_data.activate`, If-Match dan alasan minimal 3 karakter.

Upload purpose `CUSTOMER_MASTER` memakai izin master create/update; pembacaan memakai master read, scope perusahaan dan penyimpanan privat. Referensi bukti pada legal/NOO harus milik perusahaan yang sama dengan purpose tersebut. Metadata legal baru/berubah tidak dapat menetapkan dirinya VERIFIED; status verifikasi lama hanya dipertahankan untuk isi dokumen yang identik.
# Keputusan kontrak IAM terbaru — 16 Oktober 2026

Principal dengan peran aktif `ADMIN_SYSTEM` dalam perusahaan sesi melewati pemeriksaan permission aksi/scope untuk API pengaturan dan transaksi, termasuk keputusan approval sendiri/tanpa penunjukan. Audit, autentikasi, isolasi perusahaan, validasi status/versi/bukti dan invariant bisnis tetap berlaku. `DELETE /roles/{id}` untuk peran biasa melepas penugasan anggota, mencabut sesi terdampak dan mencatat audit; `ADMIN_SYSTEM` tidak dapat dihapus. Ketentuan IAM 7 Oktober yang mewajibkan grant tambahan bagi Admin Sistem digantikan keputusan ini.

`POST /roles` membuat peran biasa beserta grant cakupan `company` untuk semua capability katalog yang tersedia saat transaksi pembuatan, lalu mencatat jumlah grant awal di audit. `ADMIN_SYSTEM` tetap memakai bypass bawaan tanpa grant tersimpan. `PATCH /roles/{id}/permissions` dipakai untuk perubahan peran lama atau pembatasan peran baru; snapshot grant yang diharapkan mencegah overwrite, sesi anggota dicabut dan diff diaudit. Pembuatan peran lain tidak memperluas peran lama.

`DELETE /users/{id}` hanya untuk Admin Sistem pada perusahaan sesi. Akun sendiri, Admin Sistem terakhir, dan akun di luar perusahaan ditolak. Akun tanpa riwayat pemakaian dihapus permanen; akun dengan sesi/aktivitas/audit atau referensi lintas perusahaan diarsipkan pada membership, disembunyikan dari daftar, dan tidak dapat diaktifkan lagi lewat edit biasa. Respons `{ data: { user_id, archived, deleted } }`; sesi dicabut dan audit `user.archived` atau `user.deleted` dicatat. `GET /users`, daftar workspace, detail dan anggota peran mengecualikan membership terarsip. Email akun terarsip tetap terdaftar agar identitas historis tidak dipakai ulang.


## Workspace Pengguna dan Peran — 16 Oktober 2026

IAM-01/03/04/11: GET `/access-workspace/users` dan `/access-workspace/roles` menerima q/status/role/page, halaman 20 baris dengan total terfilter. GET `/users/{id}` menambahkan created_at/created_by, assignments dan maksimal 100 sesi dengan proyeksi aman; GET `/users/{id}/history`, `/roles/{id}/history` serta `/roles/{id}/members` dibatasi perusahaan sesi dan Admin Sistem. History hanya mengirim waktu/pelaku/aksi/alasan serta diff izin dan jumlah anggota terdampak yang tersedia, tanpa snapshot mentah. POST `/users/{id}/revoke-sessions` mencabut sesi keanggotaan perusahaan dan mencatat audit.

Status pengguna pada create/edit berlaku pada CompanyMembership; User.active tetap menjadi batas global. Penugasan yang tidak berubah mempertahankan tanggal/pelaku awal. Create/update role menerima active; menonaktifkan ADMIN_SYSTEM ditolak. Perubahan status peran mencabut sesi anggota terdampak. PATCH permissions menerima expected_permissions opsional; workspace selalu mengirim snapshot ini. Backend mengunci role, menolak snapshot kedaluwarsa dengan 409, mempertahankan audit diff dan mencabut sesi dalam transaksi. Kebijakan administrator terbaru di atas tetap berlaku. Tidak memerlukan migrasi database.

## Kontrak izin submenu — 16 Oktober 2026

IAM-01/04: endpoint CRM memakai `crm_prospect`, `crm_contact`, `crm_opportunity`, `crm_quote`, `crm_customer_order`, `crm_activity`, dan `crm_customer` per aksi. Resource dinamis ditentukan allowlist server; grant `crm.*` tidak menjadi fallback. `/crm/options` wajib menerima `resource=prospects|contacts|opportunities` dan izin buat fitur tersebut. Detail Prospek/Pelanggan hanya menyertakan kontak dengan `crm_contact.read`; aktivitas/lampiran memeriksa izin sumber terkait. Membuat pelanggan melalui Prospek juga memerlukan `crm_customer.create`.

`GET /crm/master/customers` dan `POST /crm/master/customers` adalah proyeksi/buat pelanggan CRM dengan izin terpisah dari Master Pelanggan. `/master-data/:resource` serta subresource memakai `master_<resource>`; `/master-data/customer-options` menyediakan proyeksi referensi minimal untuk pemegang `master_customer.read` tanpa membuka pengelolaan referensi.

`GET /operations/outbound/:stage` dan `/:stage/:id` memakai `outbound_picking.read`, `outbound_checking.read`, `outbound_shipping.read` atau `delivery_receipt.read` sesuai stage allowlist. Endpoint lama warehouse memerlukan izin Checking; daftar warehouse memeriksa stage. Dokumen Picking/Packing/Pengiriman memeriksa izin pemiliknya. Proforma memerlukan `proforma.read`; `/operations/backorders` memakai `sales_backorder.read` dan `/operations/warehouse-backorders` memakai `warehouse_allocation.read`. Izin SO tidak menjadi fallback bagi endpoint tersebut. Hak bawaan Admin Sistem dan invariant transaksi tetap berlaku.

## Daftar Peluang operasional — 16 Oktober 2026

GET /crm/workspace/opportunities memerlukan crm_opportunity.read (scope perusahaan aktif). Query q maksimal 150 karakter dan page positif; pagination 20 baris, urutan updatedAt menurun lalu id. Respons data/total/page/page_size berisi id, code, period, state, prospect_id, notes dan identitas minimum customer (id/code/name). Tidak menyertakan kontak, data finansial atau outcome/order. Pencarian pada kode peluang/nama pelanggan. Tautan sumber prospek dan Master Pelanggan pada UI mengikuti izin tujuan. Tidak mengubah schema/database atau command peluang.

## Kontrak tahap 2b — konsolidasi pengaturan (24 Oktober 2026)

- `GET /settings/general` (`setting_general.read`) dan `PATCH /settings/general` (`setting_general.update`, `If-Match` versi): zona waktu (IANA) dan awal tahun buku.
- `GET /settings/numbering` mengembalikan `year_format` (`YYYY`|`YY`) dan `reset_period` (`MONTHLY`|`YEARLY`) sebagai pengganti `reset_yearly`; `PUT /settings/numbering/:kind` menerima `prefix`, `digits`, `year_format`, `reset_period`. Format nomor `Prefix.YYYY|YY.MM.Urutan`; perubahan reset berlaku periode berikutnya.
- `POST /tax/master/:id/default` (`tax_setting.update`, `If-Match`): menandai pajak bawaan penjualan atau pembelian (satu per arah per perusahaan). Pajak memiliki `dpp_factor`. Pajak per baris dokumen penjualan ditolak dengan `LINE_TAX_NOT_ALLOWED`.
- Atribut kredit pelanggan (`credit_limit`, `credit_frozen`, `freeze_reason`, `past_due_grace_days`, `default_term_code`, `default_tax_invoice_code`) diubah dengan izin `customer_credit.update`; `default_term_code` juga memerlukan izin ini. Halaman Termin & Kredit memakai `terms_credit.*`.
- `GET|POST /settings/deduction-types`, `GET /settings/deduction-types/accounts`, `PATCH /settings/deduction-types/:id` (`deduction_type.read|manage`).
- `POST /finance-controls/configuration/:kind` memeriksa izin per jenis: `profile` → `account_mapping.manage`, `account` → `account.create`, `period` → `finance_period.close`, `bank` → `bank_account.manage`. Pembaca `account_mapping.read` menerima opsi akun detail minimal (id, kode, nama).
- `GET /settings/discount-limit/me?product_id=` (semua sesi): batas diskon efektif pemanggil (persen atau `UNLIMITED`). `PATCH /settings/discount-limit/roles/:id` dan `/users/:id`: Admin Sistem saja. Batas produk lewat master produk (`discount_limit.manage`).
- Dihapus: `/operations/controls`, aturan pajak per pelanggan × produk, `CustomerPaymentPolicy` sebagai sumber tulis.
