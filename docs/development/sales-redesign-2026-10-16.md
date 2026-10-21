# Redesign Sales — 16 Oktober 2026

## Keputusan dan acuan
Pengguna meminta analisis dan implementasi struktur 14 halaman Redesign-UI-Sales.pdf, termasuk badge dan warna tombol, menggunakan ERP Builder dan Figma. Tidak ada file/frame Figma; skill dibaca, PDF menjadi referensi visual yang dirender. Fokus Office desktop, sidebar dipertahankan. Kolom kode/nama tetap terpisah sesuai keputusan sebelumnya. Semua data/status berasal dari backend dan izin nyata.

## Inventaris cakupan
| Halaman | Route/surface | Requirement/pemilik | Implementasi dan dependensi |
|---|---|---|---|
| 1 | Daftar SO | OTC-01/12 Sales | Tab antrean, KPI, tabel dimensi terpisah, langkah berikutnya |
| 2 | Buat/edit SO | OTC-01/03/14 Sales | Form bertahap, pelanggan/referensi/barang/pengiriman/catatan; stok informatif dan ongkir belum ditetapkan memerlukan sumber backend |
| 3–8 | Detail SO enam tab | OTC-04/05/10/11 Sales/Warehouse | Ringkasan, Barang, Pemenuhan, Dokumen, Tagihan, Riwayat; aksi tetap command berizin |
| 9–11 | Proforma | OTC-05/15 Sales | Daftar/status, pratinjau alokasi, dokumen, penyerahan, pembayaran terverifikasi |
| 12–14 | Invoice | OTC-05/06 Finance | Daftar/status bayar, POD ke draft/posting, detail, tukar faktur, penerimaan |

Backend saat audit: draft invoice satu POD sudah tersedia; gabungan POD belum tersedia. Ongkir mendukung per pengiriman dan taxable/non-taxable, belum memiliki included-in-price/once-per-order. Upload JPEG/PNG 2MB, belum PDF 10MB. Penyerahan/tukar faktur/janji bayar belum tersedia. Dependensi ini tidak boleh ditampilkan sebagai status sukses palsu. Struktur PDF diterapkan pada sumber yang tersedia; setiap selisih fungsional dicatat dan diberi penjelasan di UI.

## Kriteria penerimaan
Navigasi tiga dokumen konsisten, SO enam tab dengan tindakan kontekstual, form berurutan dan ringkasan kanan, tombol primer emerald/outline, badge bertitik semantik. TanStack Query/Table, komponen bersama dan Sonner digunakan. Izin dan posting tetap di server; angka finansial memakai Decimal/snapshot. Uji browser sesi nyata, build/typecheck/lint/test relevan dan validator repository. Tidak mengklaim semua fungsi PDF selesai hanya karena panel tersedia.

## Hasil implementasi dan verifikasi
- Implementasi: navigasi berizin; KPI/filter server SO, Proforma dan Invoice; lima kelompok form SO; enam tab detail SO; tabel kolom kode/nama terpisah; next action; summary kanan; penyerahan dokumen dengan bukti, histori dan janji bayar; badge semantik dan tombol hijau.
- Penyerahan yang sebelumnya belum tersedia kini memakai API company-scoped, idempotency, penguncian dan AuditEvent immutable. Tidak mengubah saldo, TOP atau ledger dan tidak membutuhkan migration. Dana Proforma menampilkan receipt posted yang masih tersedia pada batch serta currency yang sama.
- SO menampilkan estimasi ongkir per pengiriman secara terpisah dari nilai barang termasuk pajak. Total final tiap pengiriman tetap sumber backend; tidak menambahkan estimasi berulang ke SO.
- Stack: React/Next/TypeScript, komponen bersama, TanStack Query/Table dan Sonner digunakan. Browser memverifikasi navigasi SO enam tab, daftar/filter Proforma, daftar/detail Invoice dan form tukar faktur dengan sesi nyata. Angka berasal dari database lokal. Mutasi handoff diuji lewat integration test, bukan dikirim ke dokumen demo melalui browser.
- Lulus: office typecheck, backend build, scoped ESLint, validator repository; integration test terarah outbound UI draft + handoff (persist, replay, bukti salah purpose, company isolation). API tanpa sesi pada /api/v1/operations/commercial-handoffs/invoice/:id menghasilkan 401.
- Rangkaian keseluruhan otc-controls: 2 passed, 18 failed; terdapat kegagalan cleanup fixture akibat POSTED_FINANCE_IMMUTABLE. Tidak menonaktifkan proteksi ledger untuk meluluskan tes. Lulusnya test terarah tidak berarti seluruh regression gate lulus.
- Screenshot browser tersimpan di tmp/pdfs/sales-redesign/sales-browser.png; versi crop ruang kosong: sales-browser-content.png. Capture browser menghasilkan kanvas jauh lebih besar daripada viewport DOM; inspeksi juga memakai computed styles. Warna tombol terukur rgb(8,127,91), kartu putih dan border sesuai sketsa. Override viewport telah direset.

## Temuan sebelum koreksi struktur (historis)
Belum parity penuh 1:1. Belum tersedia: filter periode dan antrean tugas personal SO; stok langsung dan sisa kredit pada form; tanggal permintaan kirim; ongkir termasuk harga/sekali per SO/unknown yang dapat disimpan; upload PDF 10 MB (saat ini JPEG/PNG 2 MB); kuantitas ditagih pada tab Barang; lampiran bebas pada tab Dokumen; penggabungan beberapa POD; koreksi jatuh tempo; pelacakan cetak/checklist lengkap dan sidebar versi; susunan pembayaran WAPU presisi sketsa. Form pra-terbit Proforma masih mempertahankan alur refresh/alokasi yang ada. Data dokumen lama mungkin tidak menyimpan kode produk, UOM dan tarif; UI menampilkan tidak tersedia, tidak mengarang snapshot. QA keyboard/seluruh permission state dan kesetaraan visual seluruh 14 halaman belum tuntas. Seluruh dependensi ini harus ditutup sebelum menyatakan sketsa diimplementasikan sama persis.

## Koreksi struktur atas review pengguna
Pengguna menegaskan seluruh panel/kartu harus mengikuti posisi, urutan dan pengelompokan PDF. Implementasi berikut menghapus komposisi lama, bukan hanya mengganti CSS. Header tunggal; daftar memiliki judul/filter/tombol dalam satu panel; detail SO memakai status inline dan banner ringkas; form ringkasan kanan; detail Proforma/Invoice menampilkan dokumen utuh kiri serta kartu tindak lanjut kanan; footer di bawah seluruh komposisi. Cakupan struktur meliputi 14 halaman referensi; bukti pemeriksaan akhir dirinci di bawah. Data/aksi yang belum tersedia diberi keterangan di lokasi yang tepat tanpa mengarang status atau memperluas aturan keuangan.


## Hasil koreksi struktur dan cakupan akhir
| Halaman PDF | Struktur yang diterapkan | Bukti verifikasi |
|---|---|---|
| 1 | Header, tab antrean, 4 KPI, judul/filter/aksi/tabel dalam satu panel | Browser daftar SO |
| 2 | Lima panel bernomor di kiri, ringkasan dan pemeriksaan di kanan, footer bawah | Browser buat SO; edit memakai komponen form yang sama |
| 3 | Status inline, banner tindakan, tab, pelanggan/pengiriman/catatan kiri, nilai/evaluasi/progres kanan | final-so-detail-content.png |
| 4 | Panel barang dengan filter dan tabel kuantitas, aksi sisa | final-so-barang.png |
| 5 | Tahap dan backorder kiri, dokumen tahap kanan; loading/error/izin eksplisit | final-so-pemenuhan.png |
| 6 | Panel transaksi dan panel lampiran terpisah | final-so-dokumen.png |
| 7 | Invoice dan ongkir kiri, ringkasan tagihan kanan | final-so-tagihan.png |
| 8 | Filter kategori dan tabel aktivitas | final-so-riwayat.png |
| 9 | Tab, 4 KPI, panel daftar dengan pencarian dan status yang dapat diketik | Browser daftar Proforma dan pencarian status revisi |
| 10 | Konteks/alokasi/ongkir kiri; ringkasan/syarat kanan; Batal/Terbitkan bawah | final-proforma-review.png |
| 11 | Satu kartu dokumen termasuk tabel dan total, penyerahan dan riwayat kiri; pembayaran/penyerahan/versi kanan | final-proforma-detail-content.png |
| 12 | Antrean/KPI dan satu panel tabel Invoice dengan create/filter | Browser daftar Invoice |
| 13 | POD/tinjauan barang/referensi kiri, ringkasan kanan, footer draft/post | final-invoice-form-content.png; kondisi tanpa kandidat POD |
| 14 | Strip lima tahap, dokumen/penyerahan/riwayat kiri, status/checklist/pembayaran kanan | final-invoice-detail-content.png; tahap Dibayar sebagian terverifikasi |

Screenshot berada di tmp/pdfs/sales-redesign. Pemeriksaan memakai sesi admin development yang nyata; tidak melakukan posting, pembayaran, atau penerbitan dokumen dari browser. Layout dua kolom dan tidak adanya overflow halaman diverifikasi melalui DOM. Tabel panjang tetap memiliki scroll internal agar kolom kode/nama dan diskon/pajak terpisah sesuai permintaan sebelumnya. Override CSS lama yang memaksa grid pelanggan dan kartu/tabel membulat telah dikoreksi dalam scope Sales.

Stack: Next/React/TypeScript, komponen bersama, TanStack Query/Table digunakan dan diperiksa pada layar nyata. Sonner tetap digunakan untuk hasil command, tetapi tidak ada command transaksi baru dieksekusi dalam QA visual ini. Tidak ada perubahan kontrak backend, migration, maupun invariant finansial pada koreksi struktur ini. Requirement: OTC-01/03/04/05/06/10/11/12/14/15 sebagaimana pemetaan awal.

Batasan yang masih berlaku: filter periode ditampilkan disabled dengan keterangan; antrean tugas personal, kredit/stok langsung, tanggal kirim diminta, kuantitas ditagih per baris, lampiran bebas, gabungan POD, koreksi jatuh tempo dan pelacakan cetak belum memiliki sumber lengkap. Versi Proforma menampilkan dokumen yang tersedia, bukan histori versi yang dikarang. Snapshot dokumen lama dapat tidak menyimpan perusahaan/kode/satuan/diskon/tarif. Pembayaran tetap dua tindakan resmi (pencatatan dan alokasi), komponen pajak WAPU mengikuti kontrol backend yang ada. Karena itu struktur sudah disusun ulang, tetapi seluruh isi/fungsi PDF belum setara 1:1.

QA tambahan yang belum terverifikasi: edit Invoice dengan draft nyata (tidak ada draft/kandidat POD pada sesi ini), seluruh kombinasi permission/error dan keyboard menyeluruh. Pencarian dropdown status dan Escape telah diperiksa. Pemeriksaan mobile tidak termasuk cakupan. Hasil final: office typecheck dan scoped ESLint lulus. Hasil regression historis di atas tetap berlaku; tidak diulang untuk perubahan layout.

Validator repository akhir lulus: tidak ada broken links, ID duplikat, conflict markers, atau tabel Markdown malformed.

## Koreksi jarak panel detail SO
Aturan lama min-width 1100px membuat so-detail-main display:contents sehingga panel pengiriman mengikuti baris grid terpisah dan menyisakan ruang besar. Override scope Sales mempertahankan flex column dengan gap 14px. Terverifikasi DOM pada viewport normal 967px dan viewport lebar (runtime melaporkan 4363px): display flex, jarak aktual sekitar 14px, posisi horizontal panel sama. Override viewport telah direset. Bukti: so-panel-spacing-content.png. Perubahan CSS saja, tidak ada perubahan data/API.

## Tambah pelanggan dari form buat SO
Permintaan pengguna: tombol tambah pelanggan di samping pemilih pelanggan. Implementasi: tombol outline dengan ikon tambah, dialog nama/alamat/telepon/email tanpa navigasi meninggalkan SO. Route Master Pelanggan new masih placeholder sehingga dialog memakai POST /master-data/customers yang tersedia. Izin master_data.create diperiksa di UI dan server; pembuatan mengikuti schema dan state DRAFT backend, tanpa autoaktivasi atau perubahan kebijakan kredit. Data pelanggan aktif tetap sumber order-options. Tombol tanpa izin disabled. Sukses baru ditampilkan setelah respons server dan query opsi diinvalidasi. Dialog menggunakan portal dan menghentikan bubbling submit agar form SO tidak ikut terkirim.
Verifikasi: typecheck Office dan ESLint terarah lulus; browser memverifikasi posisi sejajar (bottom kedua kontrol sama), dialog buka/tutup, tombol Simpan disabled untuk nama kosong. Tidak menyimpan pelanggan uji pada pemeriksaan UI ini; persistence memakai endpoint domain yang sudah ada, belum diuji ulang end-to-end. Screenshot: so-add-customer-content.png.

## Koreksi alur Tambah Pelanggan (keputusan terbaru)
Pengguna menolak modal tambahan. Tombol di SO sekarang berupa tautan satu tab ke /master-data/customers/new, hanya tampil dengan master_data.read dan master_data.create sesuai route tujuan. Guard perubahan belum disimpan milik form SO tetap berlaku. Form nama/alamat/telepon/email dipindahkan ke halaman Master Data; placeholder pada route new diganti CustomerCreateForm dengan pemeriksaan izin create dan endpoint domain yang sama. Setelah berhasil disimpan diarahkan ke detail pelanggan dan cache daftar pelanggan diinvalidasi. Tombol create pada daftar Master Pelanggan juga mengikuti izin create. Tidak ada modal pembuatan pelanggan di SO.
Verifikasi: navigasi melalui tombol SO menampilkan heading Tambah Pelanggan dan sidebar Master Data/Pelanggan; form tampil tanpa dialog. Office typecheck dan scoped ESLint lulus. Tidak membuat record uji. Bukti: master-customer-create-content.png. Bagian modal pada catatan sebelumnya sudah digantikan keputusan ini.
