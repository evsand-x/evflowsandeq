# Standar struktur halaman dan URL Office — draf 23 Oktober 2026

Status: **kerangka disetujui pengguna 23 Oktober 2026**; bagian normatif sudah dipindahkan ke `docs/mockup/web-design-standard.md` (Struktur halaman dan URL). Dokumen ini menyimpan inventaris, keputusan dan bukti.

## Arah dari pengguna

Pengguna (23 Oktober 2026): susun standar struktur halaman (daftar, detail, form) dan URL yang mengikuti menu, lalu terapkan ke Master Data sebagai modul pertama. Latar belakang: UI/UX Office membingungkan dan strukturnya tidak konsisten; Master Data Finev dan daftar piutang akan dibawa ke evflow setelahnya.

## Temuan yang menjadi dasar

| Temuan | Bukti |
|---|---|
| URL tidak mengikuti menu: SO (Sales), gudang (Warehouse), pajak dan akun (Finance) berada di `/operations/*` | `apps/office/app/operations/[[...path]]/page.tsx` |
| Tiga mekanisme navigasi: segmen path, query `?stage=`/`?view=form`, dan awalan `lists/` | `operations/workspace.tsx` baris 460–480 |
| Satu komponen melayani banyak layar lewat cabang `kind`/`stage` | `workspace.tsx` ±2.250 baris, `outbound.tsx` ±1.930 baris |
| Tidak ada kerangka halaman bersama; `DataTable` diambil dari `crm/crm-common.tsx` | impor pada seluruh workspace |
| Master Data: hanya Pelanggan yang punya halaman; Produk, Supplier, Vendor, Gudang, Item Operasional hanya label sidebar | `lib/navigation.ts`, `dashboard-sidebar.tsx` |
| Standar desain bertentangan sendiri: paragraf atas netral-emerald + Plus Jakarta Sans, tabel warna biru `#064A9D` + Inter; aplikasi memakai biru + Plus Jakarta Sans | `web-design-standard.md`, `globals.css`, `app/layout.tsx` |
| Route `preview/*` masih ada walau dilarang keputusan 7 Oktober | `app/preview/**` |

## Usulan 1 — URL mengikuti menu

```
/<modul>/<submenu>                daftar
/<modul>/<submenu>/new            buat
/<modul>/<submenu>/<id>           detail (tab via ?tab=)
/<modul>/<submenu>/<id>/edit      ubah
/<modul>/<submenu>/<sub-submenu>  daftar anak, mis. /master-data/warehouses/locators
```

- Segmen modul: `sales`, `warehouse`, `finance`, `hris`, `master-data`, `setting`. Segmen submenu memakai nama resource bahasa Inggris jamak yang sama dengan API (`products`, `suppliers`, `vendors`, `warehouses`, `operational-items`).
- Query hanya untuk state daftar yang dapat dibagikan: `q`, filter, `sort`, `page`/`cursor`, `tab`. Tidak ada `?view=form`; form selalu `/new` atau `/edit`.
- Tahap proses (mis. picking/checking/shipping) menjadi submenu atau segmen path tersendiri, bukan `?stage=`.
- Route lama dialihkan (redirect) ke route baru dengan pemeriksaan izin tujuan; tidak ada dua route aktif untuk satu layar.

## Usulan 2 — anatomi halaman

Semua halaman memakai shell global (sidebar, topbar) dan tiga kerangka bersama di `apps/office/components/web`:

| Kerangka | Urutan isi |
|---|---|
| **Daftar** | Breadcrumb → Judul + deskripsi satu baris → tombol utama kanan (Tambah) → toolbar (cari, filter, pemilih kolom, ekspor bila berizin) → tabel TanStack (server pagination, sort) → state kosong/error/memuat/tanpa izin |
| **Detail** | Breadcrumb (Modul › Submenu › Kode) → Judul = nama + badge status → aksi kanan (Ubah, Aktifkan/Nonaktifkan) → ringkasan atribut kunci → tab (Informasi, relasi khusus, Riwayat) |
| **Form** | Breadcrumb (… › Baru/Ubah) → Judul → panel berseksi sesuai kelompok atribut 07-design → footer tetap: Batal (kembali ke asal) dan Simpan; cek duplikat sebelum create; `If-Match` pada ubah; peringatan perubahan belum tersimpan |

Aturan bersama: label tombol konsisten (Tambah, Ubah, Simpan, Batal, Aktifkan, Nonaktifkan); tidak ada tombol Hapus untuk master; nilai kosong tampil "Belum tersedia", bukan 0; toast hanya setelah konfirmasi server, error penting tetap terlihat di halaman.

## Usulan 3 — penerapan Master Data

| Submenu (07-design) | Route | Kondisi backend saat ini | Gap backend |
|---|---|---|---|
| Pelanggan | `/master-data/customers` | lengkap (list server, detail, history, PATCH) | disesuaikan ke kerangka bersama |
| Produk | `/master-data/products` | list tanpa paginasi, detail, PATCH, history, NIE/UOM/harga | paginasi server |
| Supplier | `/master-data/suppliers` | list, create, PATCH | detail, history, paginasi |
| Vendor | `/master-data/vendors` | list, create | detail, PATCH, history, paginasi |
| Gudang › Lokator | `/master-data/warehouses`, `/master-data/warehouses/locators` | list, create | detail, PATCH, history, paginasi |
| Item Operasional | `/master-data/operational-items` | list, create | detail, PATCH, history, paginasi |
| Referensi: Kategori Produk, Satuan, Channel, Rayon | belum diputuskan | list, create, activate/deactivate | PATCH, history |

Izin per submenu memakai resource `master_*` yang sudah terpisah (IAM-01/04); tidak ada grant induk.

## Keputusan pengguna — 23 Oktober 2026

1. **Acuan visual: rancang ulang.** Kerangka Daftar/Detail/Form baru disusun dan direview bersama sebelum diterapkan, termasuk ke Pelanggan. Token warna dan font Office yang berjalan dipertahankan sampai pengguna memutuskan lain (perubahan tema global perlu arah eksplisit).
2. **Referensi sebagai tab di halaman induk.** Produk memuat tab Kategori dan Satuan; Pelanggan memuat tab Channel dan Rayon. Route `/master-data/products/categories`, `/master-data/products/uoms`, `/master-data/customers/channels`, `/master-data/customers/rayons`. Izin tetap per referensi (`master_product_category`, `master_uom`, `master_customer_channel`, `master_rayon`); tab tidak tampil tanpa izinnya dan izin induk tidak membuka tab.
3. **Cakupan: semua submenu Master Data**, urut kebutuhan impor Finev: Supplier → Vendor → Gudang & Lokator → Item Operasional → Produk, lalu Pelanggan disesuaikan ke kerangka. Termasuk melengkapi API detail/ubah/riwayat/paginasi server.

4. **Kerangka Daftar/Detail/Form disetujui** (mockup Supplier). Pengguna meminta mulai dari Supplier lalu urutan yang disepakati.

## Hasil implementasi — 23 Oktober 2026

Requirement: MD-01/03/04/05/07, IAM-01/04, APP-03/04, NFR-05.

| Lapisan | Perubahan |
|---|---|
| Backend | `packages/backend/src/master/master-workspace.ts`: daftar berhalaman, detail, riwayat (dengan nama aktor) dan cek duplikat untuk supplier/vendor/gudang/lokator/item. `MasterService.updateSimpleMaster`: PATCH berversi + audit untuk vendor/gudang/lokator/item. Update supplier kini mengubah bentrok nama menjadi 409. |
| Kontrak | `updateVendorSchema`, `updateWarehouseSchema`, `updateLocatorSchema` (tanpa gudang induk), `updateOperationalItemSchema` (tanpa satuan dasar). |
| Office | Kerangka `components/web/page-frame.tsx`/`.css`; komponen Master Data `app/master-data/master-shared.tsx` (state daftar di URL, aksi status, kontak PIC, cek duplikat, format desimal tanpa `number`). Route `/master-data/suppliers`, `/vendors`, `/warehouses`, `/warehouses/locators`, `/operational-items`. Sidebar Master Data memakai izin baca per submenu dan hanya menautkan layar yang tersedia. |
| Perbaikan | Status "Nonaktif" pada tabel sebelumnya berwarna sukses karena cocok dengan kata "aktif"; urutan pencocokan diperbaiki (`crm-common.tsx`). Breadcrumb tidak lagi menaruh separator `<li>` di dalam `<li>` (error hidrasi). |
| Migrasi | Tidak ada. |

Pengujian: `tests/unit/master-workspace.test.ts` (scope perusahaan, filter whitelist, resource yang dilayani, independensi izin submenu) lulus. Typecheck backend dan Office, ESLint terarah lulus. Browser pada `localhost:3000` dengan sesi nyata (Admin Sistem): Supplier create → detail → aktifkan → ubah (kontak, PJT) → riwayat → cek duplikat → filter status di URL → viewport 760px tanpa overflow halaman; Vendor create + ubah; Lokator ubah urutan picking; tab Lokator di detail Gudang; Item Operasional create dengan Harga Beli Acuan desimal dan pembacaan kembali. Data uji fiktif dibuat di DB dev lokal: SUP-000001, VEN-000001, item ATK uji.

Belum diuji: akun tanpa izin submenu tertentu (penolakan API langsung hanya dibuktikan unit test), konflik versi 412 dari dua tab, keyboard penuh pada popup SelectionField.

Catatan operasional: API dev memuat `packages/backend/dist`; setelah mengubah backend/contracts jalankan `pnpm --filter @evflow/contracts --filter @evflow/backend build`.

## Lanjutan: Produk dan Pelanggan — 23 Oktober 2026

Arahan pengguna: lanjut ke Produk dengan tab Kategori Produk dan Satuan, lalu Pelanggan dengan tab Channel dan Rayon, memakai kerangka yang sama.

| Lapisan | Perubahan |
|---|---|
| Backend | Daftar berhalaman `products` (filter kategori) dan empat referensi pada workspace bersama; PATCH referensi berversi (kode tetap). Purpose bukti `PRODUCT_MASTER`. |
| Invariant yang ditutup | (1) Create produk sebelumnya menyimpan `permit_status` dari input sehingga izin edar bisa langsung VALID tanpa bukti/verifikasi; kini selalu PENDING. (2) `evidence_object_key` registrasi sebelumnya teks bebas; kini wajib bukti `PRODUCT_MASTER` milik perusahaan. (3) Satuan dasar produk dapat diganti kapan saja; kini hanya saat Draf dan belum dipakai stok/SO/PO, dengan baris konversi dasar faktor 1 diganti. |
| Office | `reference-workspace.tsx` generik untuk empat referensi. Produk: daftar, detail (Informasi, Satuan & konversi, Izin edar dengan unggah bukti dan verifikasi, Penyimpanan & mutu, Harga acuan, Riwayat), form tiga seksi, panduan kesiapan aktivasi. Pelanggan: shell, daftar (filter onboarding/tahap/channel di URL), detail bertab dan form enam seksi dipindah ke kerangka; isi tab dan aturan tetap. `FormFrame` kini meminta konfirmasi sebelum Batal saat ada perubahan dan mendukung tombol tambahan (Validasi). |
| Perbaikan | Nonaktifkan Pelanggan pada UI lama mengirim body tanpa `version` sehingga selalu 400; kini sesuai skema. Ditambah Aktifkan kembali untuk pelanggan Nonaktif (izin `master_customer.activate`). |
| Migrasi | Tidak ada. |

Pengujian: unit test workspace (5) lulus; suite penuh 40 gagal/197 lulus dengan 40 kegagalan yang sama di file proforma, O2C, IAM, dashboard dan customer-workspace seperti sebelum tahap ini. Browser sesi nyata: Produk baru → Aktifkan ditolak backend ("Produk belum memiliki izin edar yang valid") → tambah izin AKL dengan unggah PNG → Tandai valid → Aktifkan berhasil → harga beli acuan `125.000,50` tersimpan dan tampil desimal. Satuan baru dibuat lalu diubah namanya dengan kode terkunci. Pelanggan: filter `?relationship=PROSPECT`, detail `?tab=contacts`, Nonaktifkan lalu Aktifkan kembali (CUS-000009, sebelumnya Draf kini Aktif), simpan form ubah, daftar Rayon. Data uji fiktif baru: produk "Spuit 3 ml Uji Kerangka 231026", satuan UJI-PACK.

## Gap dan sisa pekerjaan

- Izin terpisah untuk NIE, konversi satuan, harga beli dan harga jual (blueprint 4.1) belum ada; backend masih memakai `master_product.update` untuk ketiganya dan `master_product.activate` untuk verifikasi izin edar.
- Audit registrasi izin edar dan harga acuan tercatat dengan resourceId registrasi/harga, sehingga belum muncul di Riwayat produk.
- Enam produk seed dev berstatus Aktif tanpa izin edar (dibuat di luar alur aktivasi); data seed, bukan perilaku layar.
- Ringkasan stok/alokasi dari detail produk tidak ditampilkan karena endpoint mengembalikannya hanya dengan izin `master_product.read`; perlu batas izin Warehouse sebelum ditampilkan.
- Atribut tanpa penyimpanan resmi tampil "Belum tersedia": legalitas Vendor, rekening pembayaran dan saldo awal utang (Finance), penanggung jawab dan profil penyimpanan Gudang, profil suhu Lokator. Kategori Supplier/Vendor masih teks bebas dipisah koma karena tabel kategori belum ada.
- `DataTable` masih bersumber di `app/crm/crm-common.tsx` dan diekspor ulang dari kerangka; perlu dipindah ke `components/web`.
- Standar warna: tabel warna di `web-design-standard.md` menyebut biru `#064A9D`/Inter, sedangkan Office yang berjalan memakai aksen emerald dan Plus Jakarta Sans sesuai keputusan 7 Oktober. Perlu keputusan pengguna untuk merapikan tabel tersebut.

## Keputusan terbuka

- Migrasi URL `/operations/*` ke modul masing-masing: setelah Master Data (rekomendasi agent), belum diputuskan.
