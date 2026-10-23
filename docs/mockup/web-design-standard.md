# Standar desain global web evflow

## Fondasi visual biru logo — 23 Oktober 2026

Disetujui pengguna dari [canvas evflow Office Design](https://claude.ai/artifact/U1gLxdQ8GcjczdRcaiuybx) lalu diterapkan ke Office. Bagian ini menggantikan ketentuan warna emerald (7 Oktober) dan tabel warna biru `#064A9D`/Inter di bawah; ketentuan lain tetap berlaku bila tidak bertentangan. Sumber token: `packages/design-tokens/src/theme.css` (`:root.office-modern`); gaya shell: `apps/office/app/office-foundation.css`; ikon: `apps/office/components/web/icons.tsx`.

| Peran | Nilai | Pemakaian |
|---|---|---|
| Navy 900 | `#071A4A` | Item navigasi aktif, avatar, toast sukses, awal gradien pita |
| Biru merek 700 (primer) | `#0B4DA2` | Tombol utama, tautan, tab aktif, angka filter |
| Biru terang 500 | `#1F7FE0` | Cincin fokus, tanda sabit aktif; tidak untuk teks kecil |
| Latar halaman / permukaan | `#F3F6FB` / `#FFFFFF` | Area kerja putih di atas latar dingin |
| Teks / teks kedua | `#0E1B33` / `#5A6680` | Kontras AA pada putih dan latar |
| Garis / garis kontrol | `#D8E0EC` / `#C6D3E6` | Panel datar, input |
| Status sukses / peringatan / bahaya | `#17663F` di `#E5F4EC`, `#8A5300` di `#FFF1D6`, `#B42318` di `#FDECEA` | Status saja, bukan aksen |

- Cakupan (23 Oktober 2026): fondasi berlaku untuk seluruh layar Office yang terbangun. Master Data memakai `OfficePage`; CRM, Sales (SO, Proforma, Backorder, Invoice), Warehouse (Barang Keluar), Finance (Pajak, Akun, Akuntansi, Kontrol) dan Setting (Pengguna, Peran, Matrix) tetap memakai header lamanya (`.executive-heading`, `.ob-header`, `.access-heading`, `.access-page-heading`) yang ditampilkan sebagai pita oleh lapisan penyesuaian di `office-foundation.css`. Seluruh tampilan Dashboard (Ringkasan Eksekutif, Sales, Finance, Warehouse, HRIS, Tugas & Persetujuan, Laporan & Ekspor) juga memakai pita; banner tindakan biru terpisah dihapus dan tombol "Buka tugas saya" pindah ke pita. Skala tabel dan gaya ikon (Lucide dipaksa garis 1,75 ujung tegas lewat CSS) berlaku global. Migrasi struktural ke `OfficePage`/`DataTable` dan penggantian ikon Lucide tetap utang per modul.
- Gradien navy ke biru hanya pada pita judul halaman (`OfficePage`), dengan bentuk sabit logo samar di kanan. Area kerja tetap putih. Tombol utama di pita berwarna putih; tombol sekunder bergaris terang.
- Radius 8 px kontrol, 12 px panel dan popup, 6 px badge; tidak ada bentuk pil. Panel datar bergaris; bayangan hanya untuk lapisan yang bisa ditutup (popup, menu, dialog, toast).
- Plus Jakarta Sans tetap dipakai: bentuknya sejalan dengan wordmark dan memiliki angka tabular. Judul pita 24/32 bobot 750 (form 22/30), subjudul 12,5/18, eyebrow/breadcrumb 11 px, tab di pita 12,5 px; token `--ev-text-page-title`, `--ev-text-page-sub`, `--ev-text-eyebrow`.
- Skala rapat (koreksi pengguna 23 Oktober 2026, huruf 13 px terasa besar pada layar browser normal): isi tabel 12/16 px, header tabel 11 px bobot 600, padding sel 10×14 px; menu sidebar 12,5 px dengan tinggi item modul 36 px dan submenu 32 px. Nilai disimpan sebagai `--ev-text-table`, `--ev-text-table-head`, `--ev-text-nav` di `office-foundation.css`; ukur ulang di browser 1440 px saat QA.
- Ikon satu warna (`currentColor`), garis 1,75 px dengan ujung dan sudut tegas, dari `icons.tsx`. Ikon Lucide di layar yang belum dimigrasi adalah utang migrasi.
- Sidebar memakai logo gambar (`/evflow-logo.webp`). Submenu aktif berlatar navy dengan tanda sabit biru terang. Menu akun tidak lagi di footer sidebar.
- Topbar dibekukan (sticky, tinggi `--ev-topbar-height` 64 px; 60 px di bawah 640 px) dan mendapat bayangan tipis hanya setelah halaman digulung. Pita judul tetap ikut tergulung. Elemen sticky lain (header tabel, bar aksi form) wajib memakai `top: var(--ev-topbar-height)`.
- Topbar memuat nama perusahaan, notifikasi, dan menu akun. Notifikasi diturunkan dari Tugas & Persetujuan (`/dashboard/actions`, tab tindak lanjut) dengan izin `dashboard_actions.read`; angka di lonceng = tugas lewat waktu. Tanpa izin, popup menjelaskan kebutuhan izin dan tidak menampilkan angka.
- Tab memakai garis bawah 2 px primer, bukan pil. Daftar memakai kotak cari berikon dan tombol Filter berikon corong; filter lain ada di popup dengan angka filter aktif dan tombol Hapus filter.
- Toast di kanan bawah: sukses berlatar navy, info/peringatan/gagal berlatar putih dengan ikon berwarna sesuai makna.

Keputusan lanjutan 7 Oktober 2026 (warna digantikan oleh bagian di atas): tema netral-emerald dan Plus Jakarta Sans berlaku untuk seluruh Office, termasuk transaksi, CRM, Master, Finance, Warehouse, HRIS yang tersedia, Setting dan portal. Prioritas QA desktop; pekerjaan khusus mobile ditunda. Ketentuan Dashboard-only sebelumnya menjadi historis. Radius kartu 14px/kontrol 9px memakai token bersama; Field tidak berubah. [Cakupan rollout dan data uji](web-modern-rollout-2026-10-07.md).

Keputusan terbaru 7 Oktober 2026: Dashboard memakai tema terang netral/charcoal, aksen emerald, Plus Jakarta Sans, kartu radius 14px dan kontrol 9px. Token primer 162 77% 24%, latar 150 12% 97%, teks 160 16% 13%. Ini menggantikan ketentuan biru/Inter pada Dashboard dan portal-nya. Hierarki konten: sapaan, akses tugas, KPI, tindak lanjut, analisis, akses modul, riwayat. Modul transaksi lain belum termasuk perombakan ini. [Cakupan dan QA](dashboard-modern-2026-10-07.md).

Keputusan 7 Oktober 2026: pengguna mengizinkan perombakan layout khusus Daftar, Buat/Edit, dan Detail Sales Order dengan mempertahankan biru, Inter, dan sidebar. Komposisi baru tidak wajib identik dengan frame SO lama; cakupan dan bukti pada [perombakan Sales Order](sales-order-redesign-2026-10-07.md). Standar global dan aturan bisnis tetap berlaku; pengecualian ini tidak mengubah desain modul lain.

Disetujui pengguna pada 29 September 2026 setelah review Dashboard Ringkasan Eksekutif dan koreksi bersama. Berlaku untuk seluruh web Office berikutnya sampai keputusan pengguna mengubahnya. Mobile tetap ditunda. Ini standar bersama, bukan pernyataan bahwa seluruh halaman sudah menerapkannya.

## Prioritas dan penggunaan

Keputusan terbaru pengguna → standar ini untuk pola global yang telah direview → blueprint fungsi dan alur. Kewajiban mengikuti file desain lama dicabut pada 7 Oktober 2026. Gunakan komponen bersama sesuai kebutuhan layar.

Gunakan komponen/token bersama yang sudah tersedia. Perbaikan pola bersama dilakukan pada sumbernya agar tidak muncul variasi per halaman. Perubahan arah visual global perlu keputusan pengguna; penerapan standar ini tidak perlu persetujuan ulang.

## Shell dan navigasi

- Sidebar kiri, topbar perusahaan, dan area konten mengikuti struktur web yang telah direview. Acuan desktop Dashboard: sidebar 248 px, topbar 72 px; tata letak menyesuaikan viewport, tanpa lebar halaman paksa.
- Logo evflow, hierarki modul/submenu, status aktif, dan kontrol akses tetap konsisten. Navigasi mengikuti izin backend dan blueprint.
- Tombol collapse memakai chevron kiri `<`; expand memakai chevron kanan `>`. Pertahankan nama aksesibel “Ciutkan sidebar” dan “Perluas sidebar”. Pada drawer web sempit, kontrol penutup berlabel “Tutup menu”.
- Sidebar panjang menggulir pada area menu; footer akun tetap mudah dijangkau. Scrollbar tipis, track transparan, thumb membulat memakai muted opacity 22%, menguat menjadi 40% saat hover/focus. Fallback WebKit memakai lebar 6 px.
- Web sempit memakai drawer; bukan implementasi aplikasi mobile. Tabel lebar menggulir dalam areanya sendiri.

## Warna dan kontrol bersama

Tabel berikut historis; warna yang berlaku ada di bagian Fondasi visual biru logo.

| Peran | Acuan |
|---|---|
| Primer | `#064A9D` |
| Latar halaman | `#EEF5FC` |
| Latar sidebar | `#F4F8FD` |
| Kartu dan tombol tanggal/Ekspor normal | `#FFFFFF` |
| Teks utama | `#0A1628` |
| Teks sekunder dan ikon tanggal/Ekspor | `#53657A` |
| Border | `#CAD9E8` |
| Ikon KPI dan persetujuan | Primer |
| Ikon piutang lewat jatuh tempo | `#A56412` |

Gunakan token semantik yang menghasilkan warna tersebut, dengan Inter dan ikon Lucide. Jangan biarkan default komponen mengganti warna yang sudah disepakati. Ikon status mengikuti maknanya; warna amber bukan default semua ikon. Tombol tanggal/Ekspor memakai teks utama, ikon sekunder, border lembut dan latar putih; hover/focus tetap terlihat. Komposisi isi mengikuti kebutuhan layar; shadow minimal. Khusus modul Dashboard, ukuran dan spacing mengikuti Ringkasan Eksekutif sesuai koreksi pengguna, termasuk kontrol tanggal dan Ekspor. Ketentuan ini berlaku untuk seluruh Dashboard.

## Menu akun

- Sejak 23 Oktober 2026 pemicu ada di kanan topbar: avatar, nama dan peran (nama/peran disembunyikan pada web sempit). Sebelumnya di footer sidebar.
- Bagian atas popup hanya avatar, tanpa nama/jabatan. Avatar dapat difokuskan dan diklik, dengan label aksesibilitas/tooltip “Buka profil saya”. Gunakan inisial sebagai fallback jika foto belum tersedia.
- Tujuan akhirnya Profil Saya milik pengguna aktif. Saat ini halaman itu belum tersedia; klik memberi keterangan jujur, bukan tautan rusak atau klaim navigasi berhasil.
- Separator memisahkan avatar dari item terakhir “Keluar”, dengan ikon LogOut. Teks normal mengikuti menu; hover/focus memakai teks merah dan latar merah lembut.
- Logout tanpa konfirmasi rutin. Jika layar mempunyai perubahan belum tersimpan, integrasikan peringatan sebelum logout; mekanisme tersebut belum tersedia pada Dashboard yang tidak memiliki formulir.
- Saat logout berlangsung tampilkan status Keluar, cegah pengiriman ganda, dan tampilkan kegagalan secara jelas. Sesi server, request aktif, cache privat, sinkronisasi sesi antartab, dan pengalihan login mengikuti kontrak auth. Preview tidak mencabut sesi nyata.

## Validator visual sebelum penyerahan

- Cocokkan keputusan desain terkini dan standar ini: shell, tipografi, spacing, radius, warna latar/border/teks **serta setiap ikon dan tombol**.
- Periksa state normal, hover, focus, disabled, loading, error dan unavailable yang relevan. Jangan menganggap kompilasi membuktikan kesesuaian visual.
- Uji collapse/expand, drawer web, overflow, keyboard, menu akun, dan tujuan navigasi yang tersedia.
- Pastikan pola global konsisten antarlayar; catat gap profil, data simulasi, dan fitur yang belum operasional secara terpisah.
- Simpan bukti visual yang dapat dibaca; jalankan validator repository dan pemeriksaan kode yang relevan. Jangan mengklaim pengujian server bila hanya preview yang diuji.

Implementasi acuan saat ini: `apps/office/app/dashboard-sidebar.tsx`, `dashboard-sidebar.css`, `dashboard-executive.tsx`, dan `dashboard-executive.css`. Riwayat implementasi dan keterbatasannya ada pada [catatan Dashboard](dashboard-rebuild.md). Standar ini tidak mengesahkan seluruh CSS lama sebagai standar baru.

## Patokan ukuran modul Dashboard

Ringkasan Eksekutif menjadi acuan bersama: padding konten desktop 28px 32px 24px; jarak heading ke freshness, freshness ke KPI, serta KPI ke panel utama 20px; gap kartu 16px; padding KPI 20px; angka KPI 24px/29px. Panel kanan desktop 320px. Tombol tanggal dan Ekspor setinggi 38px, jarak 10px, padding 8px 16px; tanggal menyertakan ikon kalender dan chevron dropdown. Gunakan kelas bersama dari dashboard-executive.css, termasuk breakpoint 1100px dan 640px. Tinggi konten boleh bertambah untuk teks panjang, rincian, atau state data; jangan memotong informasi demi tinggi tetap.

Validator tambahan: bandingkan bounding box heading, freshness, KPI, dan tombol tanggal/Ekspor pada viewport serta label periode yang sama dengan Ringkasan Eksekutif. Periksa juga web sempit agar tombol dan tabel tidak menyebabkan overflow halaman.

Koreksi lanjutan pengguna: teks status “Belum tersedia” pada kartu Ringkasan Eksekutif disamakan dengan dashboard lainnya, 18px/29px dengan kelas `executive-unavailable-value`. Jangan menggabungkannya dengan kelas angka KPI yang berukuran 24px. Berlaku pula pada status kartu piutang dan persetujuan; nilai aktual tetap mengikuti ukuran angka masing-masing kartu.


## Scrollbar global web

Koreksi pengguna: seluruh scrollbar web memakai gaya lembut yang sama, mencakup halaman, sidebar, tabel horizontal, panel, dan popup yang memiliki overflow. Sumber tunggal ada pada globals.css: thin, muted 22%, track transparan, menguat 40% pada hover area internal/focus; fallback WebKit 6px pada kedua sumbu dan thumb membulat. Mode forced-colors mengikuti scrollbar sistem. Tidak menyembunyikan scrollbar atau mengubah mekanisme scrolling native. Cakupan APP-03/04 dan NFR-05; hanya presentasi web, tanpa perubahan API/database.



## Satu sumber acuan desain global

Dokumen ini adalah panduan normatif desain Office untuk pola global yang masih disetujui. Catatan pembangunan modul menyimpan bukti dan gap, bukan sumber instruksi visual alternatif. Artefak desain lama tidak lagi menjadi acuan wajib.

| Lapisan | Sumber tunggal | Tanggung jawab |
|---|---|---|
| Spesifikasi global | Dokumen ini | Prioritas, struktur, varian, aturan dan penerimaan |
| Token lintas aplikasi | `packages/design-tokens/src/theme.css` | Alias semantik, keluarga/ukuran font, spacing dan ukuran kontrol |
| Penerapan Office | `apps/office/app/globals.css` | Nilai warna Office presisi, gaya kontrol dan portal, pola `.web-form` |
| Komponen | `apps/office/components/ui` dan `components/web` | komponen bersama dan komposisi reusable; `SelectionField` untuk pilihan yang dapat dicari/multipilih |
| Komposisi modul | CSS dan komponen halaman | Urutan/kolom sesuai kebutuhan layar, tanpa mendefinisikan palet baru |

Nilai warna Office dipisahkan dari tema Field; perubahan web tidak memaksa perubahan visual mobile. Warna status CRM mengikuti review CRM: potensial `#246846` di `#E8F5EE`, pendekatan primer di `#E7F0FD`, baru muted di `#EDF1F5`, ditunda `#805B0B` di `#FFF3DD`. Warna ikon overdue Dashboard yang disetujui tetap `#A56412` dan tidak diganti dengan warna label CRM.

## Tipografi dan varian kontrol

| Peran | Ukuran / bobot / warna | Sumber |
|---|---|---|
| Judul global | Inter 26px / 600 / utama | Koreksi Dashboard global |
| Breadcrumb | 11px / 400 / muted | Standar CRM; Master 12px |
| Judul panel form | 16px / 600 / utama | Review komponen web |
| Label form Prospek/Peluang | 12px / 500 / utama | Review komponen web |
| Label form Kontak | 12px / 500 / muted | Review komponen web |
| Nilai field | 12px / 400 / utama; Kontak 13px | Standar komponen terkait |
| Header tabel daftar | 11px / 600 / muted | Review komponen web |
| Isi tabel daftar | 12px / 400; tautan primer 500 | Standar komponen terkait |
| Tombol toolbar | 12px / 600; tinggi 40px; padding 0 14px | Review komponen web |
| Tombol form | 12px / 600; tinggi 42px; padding 0 16px | Review komponen web |
| Field form | tinggi 44px, radius 4px; Kontak 42px | Review komponen web |
| Popup menu/filter | 12px / 400, baris minimum 32px, focus terlihat | Turunan interaksi dari kontrol 12px; perlu pemeriksaan popup aktual |

Tombol aksi utama primer/putih; aksi outline putih/primer dengan border global. Tanggal/Ekspor Dashboard memakai varian netral yang sudah disetujui, bukan aturan outline CRM. Normal, hover, focus, pressed, disabled dan loading harus dibedakan. State interaktif yang belum digambar menggunakan token yang sama, dicatat sebagai turunan, diverifikasi pada aplikasi operasional.

Form: panel padding 24px, radius 6px, gap antarseksi 20px, gap kolom 16px, label–kontrol 8px, textarea 86px. Daftar/tabel dan Master mengikuti kebutuhan layarnya. KPI Dashboard memakai ukuran yang telah disepakati. Dropdown pencarian mengikuti ukuran field global dan memakai Popover/Command resmi; pilihan multipilih tidak menjadi deretan checkbox permanen.

## Gerbang penyerahan visual

1. Rekam route serta varian komponen, bandingkan struktur, label, urutan kolom, warna, ukuran, padding dan posisi tombol. Kontrol tambahan harus sesuai kebutuhan pengguna.
2. Periksa computed style tombol, ikon, badge, label, header tabel dan **popup yang terbuka**. Portal harus mendapat font/token global. `Button` dan `Input` mempertahankan `data-slot` ketika dipakai melalui `asChild`.
3. Uji filter, pencarian, pemilihan kolom, keyboard/Escape/focus-return, isian berulang tanpa kehilangan fokus, serta empty/error/loading/denied. Uji desktop 1600px dan web sempit; tabel menggulir dalam panel.
4. Simpan bukti screenshot dan selisih yang masih ada di audit modul. Jangan mengklaim seluruh layar terverifikasi bila hanya sebagian diperiksa. Jalankan validator repository dan pemeriksaan kode terkait.
5. Pertahankan fungsi, izin dan data backend. Review dilakukan pada route operasional; kekurangan integrasi tidak diatasi dengan transaksi palsu atau perubahan struktur desain diam-diam.


## Struktur halaman dan URL (23 Oktober 2026)

Disetujui pengguna. Berlaku untuk layar Office baru dan layar yang direstrukturisasi; Master Data adalah modul pertama. Komponen sumber: `apps/office/components/web/page-frame.tsx` dan `page-frame.css`.

**URL mengikuti menu.** `/<modul>/<submenu>` daftar, `/new` buat, `/:id` detail, `/:id/edit` ubah, `/<submenu>/<sub-submenu>` daftar anak. Query hanya untuk state yang dapat dibagikan: `q`, filter, `page`, `tab`. Tidak ada `?view=form` atau `?stage=`; tahap proses menjadi submenu/segmen path. Route lama dialihkan dengan pemeriksaan izin tujuan.

| Kerangka | Urutan isi | Komponen |
|---|---|---|
| Daftar | Breadcrumb → judul + deskripsi satu baris → aksi utama kanan → sub-submenu bila ada → toolbar cari/filter/kolom → tabel server-paginated → empty/error/loading/tanpa izin | `OfficePage`, `SubNav`, `DataTable` |
| Detail | Breadcrumb Modul › Submenu › Kode → judul nama + badge status → Aktifkan/Nonaktifkan dan Ubah di kanan → ringkasan 4 atribut kunci → tab sesuai kelompok 07-design, Riwayat terakhir | `RecordBadge`, `SummaryStrip`, `DetailTabs`, `ValueItem`, `HistoryList` |
| Form | Breadcrumb … › Baru/Ubah → judul → navigasi seksi kiri (mengikuti scroll) + panel seksi → footer tetap Batal/Simpan | `FormFrame` dengan kelas `.web-form` |

Aturan bersama: label tombol Tambah, Ubah, Simpan, Batal, Aktifkan, Nonaktifkan; master tidak memiliki tombol Hapus. Nilai kosong tampil "Belum tersedia", bukan 0. Data milik domain lain ditampilkan sebagai keterangan/tautan, tidak diisi bebas. Cek kandidat duplikat saat nama selesai diisi; ubah memakai versi; peringatan perubahan belum tersimpan saat meninggalkan halaman. Toast hanya setelah konfirmasi server; error penting tetap terlihat di halaman. Field 44px/12px dan tombol form 42px mengikuti `.web-form`.

## Pengalaman sidebar (7 Oktober 2026)

Perbaikan sidebar yang disetujui mempertahankan biru/Inter, posisi kiri, hierarki, dan izin menu. Pada kunjungan awal hanya cabang aktif yang terbuka. Preferensi kelompok dan posisi scroll disimpan dalam memori per pengguna/perusahaan selama navigasi; masuk cabang baru membuka leluhurnya dan menutup cabang lain. Mode ciut dipulihkan dari cookie preferensi browser yang sudah ada.

Ikon modul pada mode ciut desktop membuka flyout dengan submenu yang sama, tooltip nama modul, penutupan Escape dan pengembalian fokus. Navigasi menutup flyout; mobile tetap drawer. Indentasi submenu 12px, label panjang membungkus, daun aktif memakai primer penuh dan induk aktif aksen ringan. Catatan cakupan dan bukti: [sidebar experience](sidebar-experience-2026-10-07.md).


Koreksi review sidebar 7 Oktober 2026: gunakan accordion satu modul dan satu submenu per tingkat. Membuka saudara menutup cabang sebelumnya beserta turunannya; menutup induk mereset turunan. Profil footer tetap ringkas: nama dan peran satu baris dengan elipsis, peran lengkap pada title.
