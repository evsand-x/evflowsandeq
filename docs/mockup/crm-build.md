# Pembangunan web CRM — 29 September 2026

Status 7 Oktober 2026: acuan artefak desain pada catatan historis ini telah dicabut. Pemetaan frame dan perbandingan lama hanya bukti pekerjaan terdahulu, bukan perintah untuk implementasi berikutnya. Panduan aktif: [implementasi web](web-implementation-guide.md) dan [standar global](web-design-standard.md).

## Arah yang disepakati

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Seluruh halaman CRM dimulai dari Prospek. Web Office dan artefak desain lama (dicabut) menjadi acuan; mobile ditunda. Shell, ukuran KPI, tipografi dan spacing mengikuti Ringkasan Eksekutif serta standar global web. Review per layar/alur. Tidak ada keputusan arah yang belum dijawab.

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Pengguna menetapkan bahwa seluruh varian layar pada file artefak desain lama (dicabut) menjadi acuan tetap untuk UI, sedangkan tahap kerja saat ini memprioritaskan pemrosesan data backend sebelum interaksi UI lanjutan. Urutan backend: Master Pelanggan, aktivitas dan lampiran, penawaran, lalu Win/Lost.

Implementasi lanjutan backend dimulai dari aktivitas terpadu dan metadata lampiran privat. Akses file yang belum lolos pemeriksaan diperlakukan sebagai tertunda dan tidak dikembalikan pada daftar lampiran yang dapat dibaca.

Tahap berikutnya menambahkan fondasi Win/Lost di backend. PO/SP pelanggan dicatat terpisah dari PO pengadaan dan harus berstatus terverifikasi sebelum peluang dapat dimenangkan. Win menyimpan strategi maintain dan jumlah per baris dengan Decimal serta menolak jumlah melebihi kebutuhan; Lost menyimpan alasan dan strategi tindak lanjut. Perubahan status peluang, hasil, verifikasi, scope perusahaan, optimistic version, idempotency pencatatan PO/SP, dan audit diproses server. Constraint lama yang membatasi peluang hanya DRAFT dilepas melalui migrasi terpisah agar status CLOSED_WON/CLOSED_LOST dapat digunakan.

## Inventaris cakupan

| Layar | Frame | Requirement | Status |
|---|---|---|---|
| Daftar Prospek | Q8Tu7 | CRM-01/06 | Query, pencarian, filter, pagination dan KPI sumber tersedia |
| Detail dan kebutuhan | We4fI, ESebI | CRM-01/07 | Institusi tunggal, kebutuhan decimal/null |
| Detail peluang, kontak, riwayat | FN14c, SX2Xv, e4igpu | CRM-05/06/09/14 | Kontak nyata, aktivitas terpadu belum tersedia |
| Tambah Prospek, status | X2TEpK, hZj9h | CRM-01/06/07 | Validasi, persistence, audit, concurrency |
| Kontak dan form | RWujd, Q6JZy | CRM-05 | Daftar dan detail kontak perusahaan |
| Peluang, form, Win | GiCa5, C7WRIo, m2y6N | CRM-09/10 | Draft dalam pembangunan; Win belum operasional |
| Pelanggan | CMg1n, p9TdIU | MD-04/06, CRM-01 | Identitas/PIC, belum seluruh kelengkapan transaksi |

Hierarki: Sales & Marketing → CRM → Prospek / Kontak / Pelanggan (Master Pelanggan). Peluang berada pada detail Prospek. Izin Master terpisah dari CRM.

## Tahap operasional pertama

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Pengguna menyetujui Prospek → Kontak → Kebutuhan Produk → Peluang draft, tetap web dan mockup sumber. Requirement CRM-01/05/06/07 serta irisan persiapan CRM-09. Cakupan: identitas institusi reuse, kontak tersimpan, kebutuhan tambahan, peluang draft dengan snapshot sumber, persistence, scope server, audit dan retry. Penawaran, aktivasi stage/confidence, Win/Lost, PO/SP, SO, lampiran dan posting ditunda. Draft tidak masuk forecast aktif atau aktual penjualan.

Kriteria penerimaan: hasil penyimpanan dapat dibuka ulang; kebutuhan/kontak dari institusi lain ditolak; retry identik tidak menggandakan dokumen/audit; payload berbeda pada key yang sama ditolak; kuantitas decimal/null; policy nomor hilang memblokir dengan pesan administrator. Konfigurasi wajib mengikuti Setting, tanpa nilai perusahaan yang ditebak.

## Bukti historis sebelum tahap draft

Create kontak/prospek memiliki persistence, audit dan idempotency transaksi. Status memakai optimistic concurrency. Penomoran berasal dari OPS-WH-04; prefix prospect belum terdapat pada katalog awal sehingga perlu dilengkapi administrator. Tes sebelumnya: 7 CRM database, 7 Dashboard Sales/tugas, 10 HTTP, 5 navigasi. Browser penyimpanan berizin belum terbukti end-to-end pada tahap historis tersebut.

Komponen shadcn lokal, TanStack Query/Table dan Sonner digunakan. Preview terpisah dan berlabel Data simulasi. Screenshot historis: review/crm-prospects-web.png, review/crm-prospect-detail-web.png, review/crm-contacts-web.png, review/crm-visual-alignment.png. KPI diselaraskan menjadi min-height 126px, angka 24px/29px, unavailable 18px/29px, padding 20px, gap 16px, judul 26px. Panel radius 6px dan antarseksi 20px. Form 3/2/1 kolom mengikuti viewport.

## Gap dan audit visual

Peluang aktif/Win/Lost/PO-SP/maintain, kunjungan/follow-up/penawaran, lampiran, riwayat terpadu, status dinamis Setting dan Master Pelanggan 17 atribut belum lengkap. Audit struktur menemukan toolbar, label dan kolom berbeda dari mockup; daftar Prospek dikoreksi ke pencarian, Semua status, Kolom; Channel / rayon dan footer simulasi diselaraskan. Master kini memiliki tiga KPI preview dan kolom Onboarding; detail kebutuhan memakai Est. jumlah dan Semua kebutuhan. Ini bukan bukti seluruh frame identik secara visual maupun alur operasional selesai.


## Bukti tahap operasional pertama

- Institusi baru dan prospek atomik, pemeriksaan channel/rayon dan duplikasi; kontak tersimpan dengan institusi yang sama; tautan Tambah Kontak dari detail mengisi institusi awal.
- Kebutuhan tambahan memakai versi prospek, validasi decimal/produk/satuan, audit dan idempotency. Draft peluang memilih kebutuhan sumber dan kontak aktif; catatan dan snapshot tersimpan, daftar draft dapat dibuka lagi pada tab Peluang & Pipeline.
- Frame C7WRIo dibaca dan dirender melalui Pencil. Form mempertahankan Peluang & periode, tabel Produk / kebutuhan peluang, Revisi peluang, dan aksi bawah. Field operasional lanjutan ditandai belum tersedia. Preview tidak menyimpan.
- Migration additive lokal berhasil. Sepuluh tes integrasi CRM dan satu skenario HTTP lintas alur lulus, termasuk auth, CSRF, read/create separation, retry, payload conflict, sumber salah, versi basi, dan read-back hasil persistence. Ini tidak sama dengan bukti browser menyimpan menggunakan akun produksi.
- Prefix customer/contact/prospect/opportunity membutuhkan konfigurasi administrator yang valid. Test memakai konfigurasi khusus company fixture dan membersihkannya; policy serta grant akun pengguna tidak diubah.
- QA akhir: 11 tes lulus, lint CRM dan typecheck Office/Backend/Contracts lulus. Validator repository lulus. Form peluang preview diperiksa pada lebar 1600 dan 768 piksel, tanpa overflow horizontal dokumen; pemilihan kontak/periode dan feedback penyimpanan simulasi terverifikasi. Belum mengklaim kesamaan piksel seluruh frame atau penyimpanan melalui browser akun pengguna.
- Field Kontak / PIC pada Buat Prospek kini memakai dropdown multi-pilih berbasis kontak aktif milik pelanggan terpilih. Endpoint opsi menerima `customer_id`, server memvalidasi scope perusahaan dan kepemilikan kontak, dan pilihan disimpan pada `prospects.contact_ids`; institusi baru belum dapat memiliki kontak sebelum kontaknya didaftarkan.
- Tab Bar detail Prospek tidak memiliki scrollbar. Tab membungkus secara responsif di dalam area bar dengan `overflow: hidden`; scrollbar tetap dicadangkan hanya untuk tabel atau konten yang memang membutuhkan pengguliran.
- Form Tambah Prospek dinormalisasi terhadap respons API lama/parsial: daftar kontak kosong secara aman ketika belum dikirim server, sehingga tidak lagi memicu `Cannot read properties of undefined (reading 'filter')`. API lokal juga telah dijalankan ulang agar endpoint terbaru mengirim daftar kontak pelanggan.
- Backend Master Pelanggan kini memiliki pembaruan data pelanggan dengan kontrol versi optimistis, validasi channel/rayon dalam perusahaan, audit sebelum/sesudah, dan perlindungan agar status `TRANSACTED` hanya ditetapkan oleh proses Finance setelah invoice diposting.
- Backend Win/Lost kini memiliki `customer_orders`, `opportunity_outcomes`, dan `opportunity_outcome_lines`; endpoint pencatatan/verifikasi PO/SP serta Win/Lost memvalidasi kepemilikan pelanggan, status verifikasi, versi peluang, dan kuantitas Decimal. Tes integrasi menutup jalur Win tanpa bukti terverifikasi, Win berhasil, Lost berhasil, dan pembersihan audit/relasi.
- Form Win Office tidak lagi berhenti pada placeholder: pengguna memilih peluang dari tab pipeline, mengisi jenis dan nomor PO/SP, strategi maintain, serta jumlah Win per baris. UI menjalankan pencatatan → verifikasi → Win berurutan melalui API dan menampilkan loading/error/permission state. Preview tetap diberi label simulasi dan tidak menulis data.
- Audit ulang frame `m2y6N` (38 · Form — Win Peluang) dan `D5SzUR` (39 · Form — Lost & Lanjut Periode) menemukan form sebelumnya terlalu ringkas. Struktur visual kini mengikuti kelompok frame: Bukti pesanan pelanggan; Jumlah yang menjadi Win dengan lima kolom; Alasan & rencana maintain; Penutupan jumlah sisa; Salin sisa ke periode berikutnya. Breadcrumb dan judul Lost juga dibedakan. Upload bukti, tanggal/penanggung jawab tersimpan penuh, dan pembuatan peluang lanjutan masih memerlukan kontrak backend lanjutan; field yang belum terhubung tidak boleh diklaim tersimpan.

## Audit menyeluruh halaman Prospek — 30 September 2026

Audit read-only terhadap frame `Q8Tu7`, `We4fI`, `ESebI`, `FN14c`, `SX2Xv`, `e4igpu`, `GiCa5`, `X2TEpK`, `hZj9h`, `C7WRIo`, `m2y6N`, dan `D5SzUR`, serta render route preview yang sesuai, menghasilkan matriks berikut. Kesamaan label utama atau status HTTP 200 tidak dianggap bukti pixel-perfect.

| Frame | Route audit | Status visual | Temuan utama |
|---|---|---|---|
| Q8Tu7 — Daftar Prospek | `/preview/crm/prospects` | Sebagian sesuai | Shell, KPI, pencarian, filter status, tabel dan callout Master tersedia. Perlu bukti computed style/screenshot viewport sumber; aksi refresh internal dan state data operasional belum merupakan isi frame. |
| We4fI — Detail Prospek | `/preview/crm/prospects/sample-1` | Sebagian sesuai | Ringkasan dan empat tab tersedia. Tombol Jadwalkan Kunjungan/Catat Follow-up masih disabled; frame menampilkan aksi aktif. |
| ESebI — Kebutuhan Produk | detail tab Kebutuhan | Sebagian sesuai | Kolom utama, footer dan aksi tersedia. Filter/toolbar, state unavailable, dan komposisi panel belum dibuktikan identik melalui pengukuran browser. |
| FN14c — Peluang & Pipeline | detail tab Peluang | Belum sama | Pipeline stage/confidence, filter periode/pemilik, kolom nilai net, dan tindak lanjut pada frame belum tersedia penuh; implementasi masih menampilkan draft/placeholder dan aksi sederhana. |
| SX2Xv — Kontak | detail tab Kontak | Sebagian sesuai | Tabel kontak tersedia, tetapi riwayat interaksi pada frame belum menjadi bagian tab yang sama. |
| e4igpu — Riwayat Aktivitas | detail tab Riwayat | Belum sama | Preview memiliki tabel simulasi, sedangkan route operasional masih menampilkan “Riwayat aktivitas terpadu belum tersedia”. |
| GiCa5 — Detail Peluang | `/preview/.../opportunities` | Belum sama | Frame memiliki stage pipeline, keyakinan, nilai net, jumlah Win/sisa, filter dan aksi per baris; implementasi masih memetakan draft dan placeholder. |
| X2TEpK — Form Prospek | `/preview/.../new` | Belum sama | Form belum memiliki seluruh varian mockup seperti kode prospek, lokasi, lampiran, jadwal/penanggung jawab tindak lanjut, dan susunan field yang sama. |
| hZj9h — Edit Status | `/preview/.../status` | Belum sama | Belum ada field Tanggal tinjau ulang dan Penanggung jawab seperti frame; label alasan dan layout masih berbeda. |
| C7WRIo — Form Peluang | `/preview/.../opportunities/new` | Sebagian sesuai | Kelompok form dan tabel kebutuhan ada. Perkiraan tanggal Win, nilai net, stage, tindak lanjut dan lampiran masih unavailable/placeholder. |
| m2y6N — Form Win | `/preview/.../opportunities/win` | Sebagian sesuai | Tiga kelompok form dan lima kolom jumlah sudah mengikuti frame. Bukti upload, tanggal/penanggung jawab/kontak yang tersimpan, nilai sudah Win/sisa server, dan alasan Win belum lengkap secara operasional. |
| D5SzUR — Form Lost & Lanjut | `/preview/.../opportunities/win?outcome=lost` | Sebagian sesuai | Dua kelompok form dan tiga tombol sudah terlihat. Catat Lost Saja dan Catat Lost & Buat Lanjutan masih menjalankan aksi yang sama; pembuatan peluang periode baru belum tersedia. |

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Kesimpulan audit: halaman Prospek belum boleh disebut sama persis dengan artefak desain lama (dicabut). Satu-satunya sumber visual tetap artefak desain lama (dicabut); standar global hanya menerjemahkan token dan shell. Gap yang memengaruhi banyak layar harus diperbaiki pada komponen sumber, sedangkan gap fungsi harus diselesaikan bersama kontrak backend sebelum diberi label selesai.


## Audit visual menyeluruh — 29 September 2026

Audit terhadap frame Q8Tu7, RWujd, Q6JZy, X2TEpK, C7WRIo, We4fI, CMg1n, FN14c, SX2Xv, e4igpu, GiCa5 dan m2y6N menemukan variasi token, ukuran label, kontrol filter, popup Kolom, dan komposisi tabel. Perbaikan tahap ini memusatkan token Office pada `packages/design-tokens/src/theme.css`, aturan global pada `web-design-standard.md`, dropdown melalui komponen resmi shadcn, serta selection field bersama untuk PIC, institusi, kebutuhan, dan fungsi kontak. Tombol Kolom tidak lagi muncul pada tabel form Peluang; field catatan dan tabel kebutuhan mengikuti komposisi frame C7WRIo. QA browser memverifikasi daftar Prospek dan dropdown Kontak terkait pada viewport desktop; typecheck, lint dan 11 tes alur tetap lulus.
