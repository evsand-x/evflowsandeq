# Sales Order — implementasi UI, 5 Oktober 2026

Status 7 Oktober 2026: acuan artefak desain pada catatan historis ini telah dicabut. Pemetaan frame dan perbandingan lama hanya bukti pekerjaan terdahulu, bukan perintah untuk implementasi berikutnya. Panduan aktif: [implementasi web](web-implementation-guide.md) dan [standar global](web-design-standard.md).

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Pengguna meminta pembangunan UI/UX Sales Order dengan sumber utama artefak desain lama (dicabut), tanpa pengujian workflow/browser. Arah visual sudah disetujui. Scope: daftar, buat/revisi dan detail SO; bukan seluruh Warehouse/Finance. Standar global web tetap berlaku. Requirement OTC-01–05/10/11, APP-03/04, NFR-05.

| Frame | Route | Komposisi |
|---|---|---|
| AmndB | /operations/orders | heading, empat KPI, search/status/kolom, enam kolom status/nilai, pagination, catatan alur |
| q5a8BK | /operations/orders/new dan /operations/orders/:id/edit | informasi utama tiga kolom, rincian produk sembilan kolom, catatan/ringkasan, aksi footer |
| ZkDEz | /operations/orders/:id | informasi utama, pemenuhan/dokumen, tutup/batal sisa/evaluasi, rincian, ringkasan, revisi/cetak |

Frame dibaca dan dirender melalui Pencil; mockup tidak diubah. Shell mengikuti standar global 248px, bukan sidebar lama 272px pada frame. State loading/error/empty/denied serta popup turunan memakai komponen lokal. Data contoh mockup tidak disalin ke transaksi. Diskon/ongkir yang belum didukung backend harus dijelaskan di kontrol terkait; tidak memberi feedback simpan palsu. Nilai dan status kredit yang tidak tersedia tidak diasumsikan nol/lolos.

Validasi yang diizinkan: TypeScript, lint, pemeriksaan struktur kode dan validator repository. Browser, computed style, screenshot aplikasi dan uji workflow sengaja tidak dilakukan; render mockup bukan bukti kesetaraan render aplikasi.

## Implementasi

- Route SO memakai komposisi khusus `sales-order.tsx`, `sales-order-form.tsx` dan CSS modul; workspace gudang/finance dipertahankan.
- Daftar: empat kartu, tabel enam kolom, pencarian nomor/nama, filter status di server, menu kolom dan pagination 25 baris. KPI mencakup seluruh perusahaan; filter mempengaruhi tabel. KPI kredit yang belum mempunyai sumber evaluasi tersimpan diberi status belum tersedia.
- Form: informasi utama tiga kolom, pilihan pelanggan/produk yang dapat dicari, alamat, termin master, lampiran SP privat, baris berulang, catatan, subtotal dengan Decimal, alasan revisi dan footer simpan/batal. Nama pembuat diberi label Dicatat oleh karena penugasan salesperson bukan field pada SO saat ini. Nomor dibuat ketika draft disimpan sesuai backend.
- Detail: dimensi status terpisah, pemenuhan, proforma tertaut, bukti, dialog riwayat, rincian produk dan nilai dari backend. Evaluasi, pengajuan normal, revisi, penutupan/pembatalan sisa dan exception approval mengikuti izin/command yang ada. Cetak SO menggunakan stylesheet cetak dokumen tersimpan.
- Dialog tutup/batal mengirim baris/jumlah, versi, alasan; pembatalan menambahkan pihak, media, waktu dan referensi konfirmasi pelanggan. Backend tetap menolak sisa yang masih teralokasi. Revisi hanya ditawarkan sebelum pemenuhan aktif/sisa ditutup sesuai backend.
- State loading skeleton, query error/retry, empty, denied, pending dan kesalahan isian disediakan. Request memakai idempotency key; cache Query dipisahkan company/user. Form memperingatkan navigasi tautan internal dan unload saat ada perubahan. Tombol Batal membuka dialog; browser Back dan logout programatik belum mempunyai guard khusus lintas aplikasi.

## Keterbatasan yang ditampilkan

Stok informatif, KPI hasil kredit tersimpan, diskon dan ongkir terpisah belum mempunyai kontrak lengkap untuk layar ini. Tax selector bebas tidak ditambahkan karena pajak ditentukan aturan efektif backend; status belum ditetapkan tampil sampai snapshot tersedia. Pratinjau subtotal tidak menjadi total resmi. Form revisi mempertahankan baris produk dan catatan asli mengikuti batas command. Lookup dibatasi 250 pelanggan/produk aktif; pencarian lintas katalog besar masih memerlukan endpoint paginated.

Print memakai data tersimpan dan bukan template dokumen resmi yang telah divalidasi. Tautan warehouse dan proforma hanya muncul sesuai data/izin terkait. Catatan belum mendukung screenshot/bukti parity karena pengguna meniadakan browser.

## Teknologi dan pemeriksaan

Next.js/React/TypeScript, shadcn lokal (Card, Dialog, InputGroup, Field, Badge, Select, Skeleton), TanStack Query/Table dan Sonner digunakan; Decimal.js hanya menghitung subtotal pratinjau. Token dan portal mengikuti standar global, tanpa palet alternatif. CSS memiliki breakpoint 1100/640px dan tabel menggulir di panel.

TypeScript Office/backend, ESLint file terkait dan pemeriksaan format lulus. Build produksi Office berhasil (10 static pages, route operations dinamis). Validator repository lulus: tidak ada tautan lokal rusak, ID duplikat, conflict marker atau tabel Markdown rusak. Next memberi peringatan konfigurasi ESLint belum memakai plugin Next; lint eksplisit file terkait tetap lulus. Tidak ada migration atau perubahan posting/approval invariant pada tahap UI ini. API read model diperluas untuk metadata/summary/decimal totals; tidak mengesahkan hasil evaluasi transaksi.

API dan Office harus memakai versi perubahan yang sama. Proses layanan yang sedang berjalan tidak direstart pada tahap ini. Tidak ada browser, workflow test, request transaksi uji atau klaim visual parity yang dijalankan.

## Koreksi navigasi pratinjau

Menu Pesanan Pelanggan sebelumnya tidak dirender sebagai tautan ketika sidebar menerima `preview=true`. Kondisi ini diperbaiki untuk Sales Order. Menu pratinjau kini menuju `/preview/operations/orders`, dengan daftar, form dan detail menggunakan komponen yang sama serta fixture berlabel simulasi. Query transaksi/lookup, pengunggahan bukti dan command mutasi dinonaktifkan dalam preview, termasuk ketika pengguna memiliki sesi aktif. Akses aplikasi nyata tetap memakai izin server; perbaikan tidak memberikan permission baru. Pratinjau Backorder belum diaktifkan.


## Audit visual lanjutan — 5 Oktober 2026

Permintaan terbaru pengguna mengizinkan audit browser UI/UX dan koreksi berdasarkan artefak desain lama (dicabut), menggantikan batasan browser pada tahap pembangunan awal di atas. Scope tetap Sales Order. Frame AmndB, q5a8BK dan ZkDEz dibaca melalui Pencil; Prospek (daftar/form) dan Kontak dibandingkan dalam browser sebagai implementasi pola bersama. Tidak ada perubahan mockup, API, migration, permission maupun transaksi server dalam audit ini.

Koreksi: menghilangkan banner simulasi tambahan (badge topbar tetap), mengembalikan empat contoh baris/KPI dari frame daftar, merapatkan filter/Kolom, CTA tanpa ikon tambahan, tinggi KPI/baris daftar, label dan grid informasi, sembilan kolom produk, tautan lampiran ringkas, tombol Tambah Produk selebar isinya, jarak antarbaris, warna status kredit, ringkasan selebar 420px dan total 20px. Data contoh stok/pajak/salesperson hanya pada preview. Input harga menampilkan pemisah ribuan ketika tidak sedang disunting; nilai command tetap string decimal. Hapus produk berada di dalam kolom produk dan tampil saat hover/focus sehingga tidak menambah kolom kesepuluh.

Bukti browser desktop: KPI 96px, baris daftar 59px, CTA/status/Kolom 40px, field informasi 44px, ringkasan 420px. Popup Kolom 12px dengan baris 32px; pemilih produk 12px berada di dalam viewport. Filter Draft menghasilkan satu baris. Fokus input jumlah bertahan sesudah nilai diubah. Menu akun hanya avatar/profil dan Keluar; collapse menampilkan Perluas sidebar. Semua ini pemeriksaan presentasi/interaksi preview, bukan pengujian O2C atau server.

Bukti tersimpan di [daftar](review/sales-order-2026-10-05/list-desktop.jpg), [form](review/sales-order-2026-10-05/form-desktop.jpg), dan [detail](review/sales-order-2026-10-05/detail-desktop.jpg).

### Selisih dan batas verifikasi

- Standar global mengungguli ukuran lama frame: sidebar 248px, judul 26px, field 44px dan tombol form 42px. Karena itu koordinat absolut dan tinggi keseluruhan tidak identik dengan frame lama.
- Frame detail berisi dua Edit/Revisi. Implementasi sementara mempertahankan satu seperti sebelumnya; pertanyaan keputusan dikirim kepada pengguna. Tidak menganggap duplikasi sebagai keputusan baru.
- Popup yang tidak tersedia di mockup memakai komponen global yang sudah dipakai CRM. Preview dokumen hanya memberi keterangan karena berkas contoh tidak tersedia. Tiga baris contoh selain SO/0192 tidak diarahkan ke detail SO/0192 yang salah.
- Pada sesi operasional, salesperson, stok informatif, diskon/ongkir dan kredit tetap mengikuti keterbatasan kontrak yang tercatat di atas. Tidak mengganti data kosong dengan contoh mockup.
- Permintaan override viewport 390px tidak tercermin pada DOM browser (innerWidth tetap 1600px); pemeriksaan responsif belum terbukti. Override direset. Jangan menyebut screenshot desktop sebagai bukti ponsel.
- Belum menyatakan kesetaraan pixel penuh atau kelulusan workflow. Revisi, error/denied, transaksi dan posting tidak diuji pada audit ini.

Validasi akhir audit: TypeScript Office, ESLint ketiga file TSX/fixture yang berubah, build produksi Office dan tools/validate-repository.ps1 lulus. Next.js masih memberi peringatan plugin ESLint Next belum terdeteksi; lint eksplisit tetap lulus. Cakupan requirement tetap OTC-01–05/10/11, APP-03/04 dan NFR-05; audit ini hanya memperbaiki presentasi, bukan membuktikan seluruh requirement end-to-end. Tidak ada migration atau perubahan backend.

## Penerapan langsung di dev — 7 Oktober 2026

Arah pengguna: perbaikan UI Sales Order diterapkan pada aplikasi operasional dev, tanpa halaman preview. Cakupan daftar, buat/revisi, detail, navigasi, bukti dan riwayat memakai frame AmndB/q5a8BK/ZkDEz serta standar global. Cabang fixture/principal/command preview di komponen SO dihapus; data simulasi tetap berasal dari database dev. Kontrol server, izin, aturan pajak dan alokasi dipertahankan. Tidak ada perubahan kontrak bisnis atau migration. Penerimaan: route operasional merender komposisi yang sama dengan koreksi visual sebelumnya dan tidak lagi mengimpor fixture preview. Pengujian workflow finansial ditunda sesuai cakupan pengguna.

### Hasil penerapan dan bukti dev

Cabang preview, principal palsu, fixture daftar/form/detail, serta command simulasi di Sales Order dihapus. Semua navigasi SO memakai `/operations/orders`; form memakai lookup dan command API yang sudah ada. Data cache halaman sebelumnya tidak dipakai sebagai placeholder lintas daftar/detail; form diremount menurut ID/versi dokumen untuk mencegah isian dokumen sebelumnya terbawa. Pembungkusan teks pada sembilan kolom detail/form memperbaiki kode produk panjang dan status pajak yang sebelumnya meluber. Tombol footer detail mengikuti tinggi global 42px. Status pajak kosong kini “Belum ditetapkan”, sesuai penetapan backend.

Akun Novian berhasil login; navigasi menu membuka empat draft DEV-SO dari perusahaan dev. Tidak ada submit, revisi tersimpan, alokasi atau posting yang dijalankan dalam review ini. Dashboard dan CRM Prospek operasional turut diperiksa sebagai pembanding shell; sumber dashboard belum terhubung dan CRM kosong tetap dinyatakan apa adanya.

| Frame | Route dev | Bukti |
|---|---|---|
| AmndB | `/operations/orders` | [Daftar desktop](review/sales-order-dev-2026-10-07/list-desktop.jpg) |
| q5a8BK | `/operations/orders/new` | [Form desktop](review/sales-order-dev-2026-10-07/form-desktop.jpg), [390px](review/sales-order-dev-2026-10-07/form-narrow.jpg) |
| q5a8BK | `/operations/orders/:id/edit` | [Revisi desktop](review/sales-order-dev-2026-10-07/revision-desktop.jpg) |
| ZkDEz | `/operations/orders/:id` | [Detail desktop](review/sales-order-dev-2026-10-07/detail-desktop.jpg) |

Viewport desktop DOM terkonfirmasi 1600×1040. Pada 390px, lebar dokumen 380px tanpa overflow horizontal halaman; tabel tetap mempunyai scroll internal. Sel detail terukur scrollWidth sama dengan clientWidth setelah koreksi. Tombol detail 42px; portal pelanggan 12px dengan opsi 32px. Pilihan pelanggan berisi empat master dev. Pemeriksaan ini membuktikan presentasi dev dan navigasi baca, bukan kelulusan O2C, denied/error state, atau kesetaraan pixel penuh.

Cakupan requirement tetap OTC-01–05/10/11, APP-03/04 dan NFR-05 pada lapisan UI. React/Next, shadcn, TanStack Query/Table digunakan pada layar operasional; Sonner tetap terhubung command tetapi notifikasi mutasi tidak diuji ulang. Tidak ada perubahan API, migration, permission atau invariant. TypeScript Office, lint file SO, format dan validator repository lulus. Keterbatasan sumber kredit/stok informatif, diskon/ongkir serta penugasan salesperson yang tercatat sebelumnya belum berubah.
