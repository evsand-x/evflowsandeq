# UI/UX Barang Keluar — implementasi 16 Oktober 2026

## Arah dan cakupan

Pengguna menyetujui struktur 15 halaman `Sketsa UI Barang Keluar.pdf`, termasuk badge dan warna tombol. Fokus desktop; sidebar dan identitas aplikasi tetap konsisten. Lima tahap: Pick Slip, Checking/Packing, Pengiriman, POD dan Retur; masing-masing memiliki daftar, form dan detail. Kolom produk, batch dan ED dipisah.

Sumber aturan: domain 11 Warehouse/Logistik dan alur OTC, Finance untuk Invoice/credit note, IAM-01/04 untuk akses, APP-03/NFR-05 untuk tabel serta aksesibilitas. Blueprint mengatur otorisasi dan mutasi; sketsa pengguna mengatur komposisi visual.

## Implementasi

- `OutboundWorkspace` pada route operasional `/operations/pick-slips`, `/operations/warehouse?stage=checking|shipping|pod` dan `/operations/returns`. Detail memakai ID; `view=form` membuka form, `/returns/new` menerima retur.
- Tab tahap, kartu ringkasan, pencarian/filter status, pagination 25 baris, badge dengan titik dan teks, tombol hijau primer/outline, panel detail dua kolom, riwayat dan footer tindakan.
- Backend menyediakan antrean company-scoped, status turunan, KPI dari seluruh hasil pencarian (sebelum pagination), daftar/detail retur dan lookup POD/locator karantina. Data biaya stok dan harga unit retur tidak diproyeksikan pada detail retur.
- Picking: qty aktual, alasan selisih, simpan draft dengan revision check, konfirmasi, serta penyelesaian kekurangan melalui command yang tersedia. Draft tidak mengonfirmasi picking.
- Checking: qty dan kondisi per baris; backend menolak mismatch/kerusakan sebelum Packing List terbit. Metadata kemasan tersimpan pada snapshot dokumen.
- Pengiriman: sopir, kendaraan, waktu, toggle ongkir/PPN; rencana disimpan sebelum dispatch. Retry mempertahankan idempotency command dan hasil save shipment; pengiriman ganda dicegah selama rangkaian tindakan.
- POD: qty diterima default sisa transit, nama penerima, waktu/bukti; opsional buat draft Invoice melalui command resmi setelah POD tersimpan.
- Retur: sumber POD dan locator karantina dicari melalui lookup, penerimaan fisik ke karantina; detail memperlihatkan referensi dan barang.
- Migration `20261016090000_outbound_return_capability` mendaftarkan permission endpoint `customer_return.receive`, tanpa grant otomatis. Role demo khusus disinkronkan melalui AccessService berdasarkan permintaan full-access sebelumnya; audit dan pencabutan sesi tetap berlaku.

## Stack dan kontrol

Next.js/React/TypeScript, komponen Button/Input/SelectionField bersama, CSS scoped dengan warna sketsa, TanStack Query untuk cache company/user/permissions, TanStack Table untuk daftar dan produk, Sonner untuk konfirmasi hasil server: digunakan. Tabel memakai pagination/filter backend dengan urutan createdAt/ID tetap; sort interaktif belum tersedia. Aplikasi mobile tidak termasuk cakupan. Semua mutasi tetap melalui command transaksi, locking, audit dan idempotency; saldo tidak diedit langsung.

## Bukti pengujian

- Office typecheck, backend build, contracts build, scoped ESLint dan validator repository lulus.
- Tiga unit test status: pembatalan, pengiriman selesai/POD sebagian, dan shortage decimal presisi.
- Satu integration test PostgreSQL terisolasi: draft OPEN/pickedAt null, revision increment, replay idempotent, stale revision ditolak, checking mismatch/kerusakan ditolak, checking valid menjadi CHECKED. Test memakai company khusus dan dibersihkan; 19 test lain pada file tidak dijalankan.
- Browser sesi demo lokal: daftar Pick Slip menampilkan 6 tahap nyata (2 siap, 4 selesai), form memuat produk/batch/ED/locator, draft qty 10 berhasil disimpan dan detail tetap Siap diambil. Kontrak runtime lama ditemukan saat QA, contracts dibuild ulang dan API watcher dimuat ulang; save kemudian berhasil.
- Pengukuran DOM sebelumnya: tombol primer rgb(8,127,91), tinggi sekitar 36px; badge sukses rgb(232,245,238), tinggi sekitar 26px. Screenshot browser gagal ditangkap; tidak mengklaim verifikasi visual pixel-perfect.

## Selisih yang masih terbuka terhadap PDF

Belum lengkap: penggantian batch/locator di form, prioritas tugas, master sopir/kendaraan, kontak penerima dan alasan selisih POD; pengajuan retur sebelum penerimaan fisik, pemeriksaan mutu/release/pemusnahan, serta bukti PDF 10MB. Bukti saat ini JPEG/PNG maksimal 2MB. Kesiapan pembayaran diperiksa server ketika dispatch; belum berupa preflight lengkap. KPI mengikuti sumber nyata, bukan angka hari ini yang belum tersedia. Fitur yang belum didukung diberi keterangan dan tidak dipalsukan sebagai tindakan berhasil. Pemeriksaan semua transisi shipping/POD/retur melalui UI masih diperlukan sebelum dianggap setara penuh 15 halaman sketsa.

QA lanjutan: daftar Checking 4 dokumen, Pengiriman 4 (termasuk Selesai), POD 3 (1 menunggu), Retur empty state dan form penerimaan dapat dibuka. Toggle ongkir mengaktifkan nominal. Endpoint outbound tanpa sesi menghasilkan HTTP 401. Viewport override tidak tercermin pada DOM (tetap 4363px), sehingga verifikasi 1440px belum terbukti; override direset.
