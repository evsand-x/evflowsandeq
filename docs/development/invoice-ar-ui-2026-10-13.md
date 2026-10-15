# UI Invoice dan Piutang (AR) — 13 Oktober 2026

Implementasi web Office menyamakan detail Invoice dengan pola detail Proforma: ringkasan dokumen, informasi pelanggan dan pengiriman, tabel produk, ringkasan nilai, serta tindakan cetak dan penerimaan pembayaran.

Daftar Invoice memakai kolom tetap: No. Invoice, Pelanggan, Tanggal dibuat, Tanggal Jatuh tempo, Status, Sisa Tagihan, Total Tagihan, dan Keterangan. Keterangan berasal dari status Invoice, sisa AR, nota kredit dan komponen pajak tersimpan. `DPP Lunas` hanya ditampilkan bila sisa persis sama dengan nilai pajak pada model saat ini; pemisahan DPP/pajak yang lebih kuat memerlukan settlement per komponen. Pelaporan PPN/SSP tetap ditampilkan sebagai belum terverifikasi sampai ada bukti status yang sesuai.

Invoice posted tetap mengikuti aturan backend: nilai, pajak, jatuh tempo, dan sisa tagihan berasal dari POD, policy pembayaran, dan posting Finance. Form pembuatan memilih POD yang siap ditagihkan, menyimpan draft dengan snapshot persisten, lalu dapat diedit pada referensi dan catatan sebelum posting. Produk, jumlah, harga, pajak, dan ongkir tetap berasal dari POD serta policy backend agar draft tidak dapat mengubah fakta pengiriman atau formula pajak.

Cakupan OTC-05/06, FIN-02/11 dan APP-03/04: komponen Proforma dipakai bersama untuk rincian Invoice; TanStack Query/Table dan Sonner dipertahankan. `POST /sales-invoice-drafts` dan `POST /sales-invoice-drafts/:id` memakai izin `sales_invoice.post`, idempotency, company scope, lock pelanggan/POD, audit dan versi snapshot. Posting memakai identitas draft yang sama; perubahan nilai sumber memblokir posting hingga draft disegarkan. Tidak ada migrasi; snapshot disimpan pada `issuedSnapshot` yang sudah ada. Edit nilai komersial bebas belum diimplementasikan.

Verifikasi: build backend, typecheck Office, lint file terkait dan validator repositori lulus. Browser akun Novian memuat daftar dua Invoice dengan delapan kolom dan keterangan terbaru. Akun ini tidak menampilkan aksi Buat Invoice; uji simpan/edit/post dengan akun berizin belum dilakukan. Label DPP Lunas, SSP belum dikumpulkan, serta utang/pelaporan PPN masih memerlukan sumber status yang lebih lengkap; bukan disimpulkan dari total pajak.

## Koreksi visibilitas tindakan — 15 Oktober 2026

Label status tabel Invoice memakai kelas `so-status` yang sama dengan tabel Sales Order, termasuk radius 6px, font 11px/500, padding 4px 9px dan titik indikator 5px. Warna pembayaran tetap memakai token semantik. Stylesheet SO diimpor secara eksplisit agar kunjungan langsung ke Invoice mendapat desain yang sama.

Penyempurnaan tabel: badge pembayaran menggunakan token semantik hijau untuk Lunas, amber untuk Dibayar Sebagian, merah untuk Belum Dibayar, serta netral untuk status yang belum tersedia. Label teks tetap ditampilkan agar makna tidak bergantung pada warna. Tidak mengubah perhitungan pembayaran.

Keputusan pengguna berikutnya: kolom Status dan status detail Invoice menampilkan status pembayaran saja (Lunas, Dibayar Sebagian, Belum Dibayar). POSTED tetap state internal pembukuan. Status pembayaran dihitung dengan Decimal dari total dan sisa AR backend; draft, menunggu POD, dan void tidak memiliki status pembayaran, ditampilkan sebagai tanda pisah dengan tahap dokumen terpisah di Keterangan/detail. Data saldo tidak tersedia atau tidak valid tidak boleh disimpulkan Lunas. Cakupan hanya presentasi web; tanpa perubahan ledger, izin atau lifecycle. Penerimaan: daftar/detail konsisten, saldo nol lunas hanya untuk POSTED, pembayaran parsial mempertahankan presisi, dan draft nol tidak salah ditampilkan lunas.

Dalam cakupan OTC-05/06 dan FIN-02/11, tombol Buat Invoice pada daftar sebelumnya disembunyikan ketika izin `sales_invoice.post` tidak tersedia. Koreksi UI mempertahankan tombol nonaktif bagi pengguna dengan izin baca saja, disertai penjelasan izin yang diperlukan. Pengguna berizin tetap menuju `/operations/invoice-create`. Tidak ada perubahan hak akses, endpoint, aturan posting, atau migrasi. Typecheck Office, ESLint file terkait, dan validator repositori lulus. Verifikasi visual sesi berizin belum tersedia pada pemeriksaan ini; tab yang dibuka masih memuat sesi.
