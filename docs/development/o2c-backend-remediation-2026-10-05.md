# Perbaikan backend O2C — arah kerja 5 Oktober 2026

Pengguna mengizinkan penyelesaian backend dari laporan audit statis tanpa jeda. UI/UX dan pengujian alur ditunda sampai tahap berikutnya. Tidak ada keputusan visual atau izin coding yang perlu ditanyakan ulang. Skill evflow-erp-builder tetap digunakan.

Cakupan: F01 currency PREPAY; F02 pemulihan picking dan selisih; F03 jurnal retur fisik; F04 currency, rekening refund dan koreksi pajak; F05 matching bank masuk/keluar dan pemulihan; F06 pajak advance parsial per sumber; F07 penerbitan invoice menunggu POD. F08 bagian backend menyediakan data uang muka, sedangkan layar sengaja ditunda.

Matriks laporan juga mencakup close remainder/cancel/release, expiry dan antrean backorder, lifecycle approval, rekonsiliasi economic subledger, opening, reversal/closing, serta perlindungan posted records. Semua dicatat statusnya secara eksplisit; keberadaan command atau build tidak dianggap bukti release gate operasional.

Requirement: OTC-01–16, CRM-11, FIN-01–08/11/16. Pemilik aturan: Sales, Warehouse, Finance dan Setting. Backend berwenang atas izin, state, transaksi, Decimal, idempotency dan audit. Kontrak API/schema serta dokumen 03/04/08 diperbarui bersama perubahan. Data resmi pajak, konfigurasi perusahaan, kalender kerja dan bukti eksternal tidak boleh direkayasa.

Validasi tahap ini: pemeriksaan statis, Prisma schema, TypeScript/build backend, lint file terkait dan validator repository. Tidak menjalankan UI, browser, HTTP UAT atau test alur. Pengujian runtime/concurrency tetap perlu sebelum operasional.

## Hasil implementasi

Status berikut berarti kode backend tersedia dan lolos pemeriksaan statis, bukan pengujian alur atau persetujuan operasional.

| Temuan | Perubahan backend | Batas |
|---|---|---|
| F01 | Currency receipt, batch dan gate PREPAY disamakan; SO baru dibatasi mata uang dasar perusahaan | FX belum aktif, data legacy perlu rekonsiliasi |
| F02 | Resolve discrepancy dengan bukti/versi, revisi picking/proforma, pelepasan kekurangan ke backorder, gate zero allocation | Layar qty aktual/revisi ditunda |
| F03 | Retur fisik atomik dengan movement dan Dr persediaan karantina / Cr HPP; biaya mengikuti dispatchUnitCost | Legacy tanpa sumber biaya ditolak |
| F04 | Currency asal, rekening/bukti/refund approval eksplisit; koreksi pajak dengan dokumen terverifikasi; refund uang muka dan reversal | Coretax dan seluruh siklus faktur resmi belum lengkap |
| F05 | Matching masuk/keluar berdasarkan journal line, partial/combined, unmatch/reopen; opening/fee/transfer/pembayaran supplier berapproval; continuity statement | Timing exceptions dan rekonstruksi saldo historis belum penuh |
| F06 | Advance tax berdasarkan porsi belum diserahkan, detail per allocation, consumption/reversal sumber yang sama | Data pajak legacy tanpa detail diblokir; belum diuji runtime |
| F07 | ISSUED_WAITING_POD tanpa GL/AR/due date; finalisasi POD menggunakan identitas dan nomor yang sama | Integrasi layar ditunda |
| F08 | Endpoint funding batch dan receipt tertaut batch tersedia | UI penerimaan sebelum dispatch belum dikerjakan |

Kontrol tambahan: revisi material SO membatalkan validitas grant lama; cancel/delegate exception request; release/cancel fulfillment; close remainder dengan konfirmasi pelanggan; expiry reservasi menurut kalender; antrean evaluasi backorder ketika stok tersedia; immutable control events; proteksi DELETE jurnal/ledger; saldo awal stok melalui jurnal berimbang; rekonsiliasi ekonomi stok/transit/unbilled/advance; request approval close/reopen periode dan aktivasi rule pajak.

Numbering kini memakai aturan bertanggal efektif, bukan prefix bisnis default tersembunyi. Penolakan konfigurasi hilang merupakan kontrol backend, bukan bukti perusahaan telah siap bertransaksi. Refund pajak uang muka memakai pembulatan snapshot aturan sumber dan validasi ulang dokumen resmi saat posting. Daftar request finance dibatasi izin domain, termasuk data pajak dan biaya persediaan.

## Migrasi dan kesiapan penerapan

- `20261005180000_o2c_remediation` dan `20261005190000_o2c_release_controls` telah diterapkan pada PostgreSQL lokal `evflow`.
- Prisma Client telah digenerate dengan binary engine. API/worker aktif tidak direstart; build baru belum dianggap versi proses yang sedang melayani pengguna.
- Administrator harus mengisi kalender kerja OPS-FIN-06, aturan numbering untuk jenis dokumen yang digunakan, mapping akun/posting profile, periode, rekening dan policy approval baru. Nilai/identitas resmi tidak dibuat otomatis.
- Grant exception sebelum perubahan material hash perlu diajukan ulang. Data advance tax lama tanpa detail dan dispatch legacy tanpa biaya memerlukan rekonsiliasi; tidak dibackfill dengan angka perkiraan.
- Izin baru tersedia pada migration; pemberian role perusahaan tetap melalui administrasi berwenang. Tidak ada privilege pengguna yang dinaikkan otomatis.

## Bukti validasi tahap ini

- Prisma generate dan schema validate: lulus.
- TypeScript backend: lulus.
- Build backend, API, worker, database dan contracts beserta dependensi: 6 task berhasil.
- ESLint file backend finance/sales, document-number, OTC service, contracts dan worker yang terkait: lulus tanpa warning.
- `./tools/validate-repository.ps1`: lulus; tidak ada broken link, duplicate ID, conflict marker atau tabel Markdown rusak.
- Tidak menjalankan unit/flow test, HTTP UAT, browser, UI/UX atau test concurrency. Tidak ada klaim bukti penolakan runtime.

Dokumen 03/04/05/06/08/15/40 disinkronkan dengan kontrak ini. Audit statis awal dipertahankan sebagai baseline historis.

## Gap backend yang belum tertutup penuh

Permintaan seluruh backend belum dapat dinyatakan selesai hanya dari perubahan di atas. Daftar berikut tetap terbuka, tidak dialihkan menjadi pekerjaan UI:

1. Discount/freight dan revisi SO yang menambah/menghapus produk belum mencakup seluruh model blueprint; revisi saat ini terbatas pada baris yang ada sebelum fulfillment aktif.
2. Outstanding timing rekonsiliasi bank belum mempunyai siklus exception tersendiri; close masih mensyaratkan kecocokan penuh. Rekonsiliasi semua subledger/historis, AP/GRNI, payroll dan tax closing belum lengkap. Close periode memakai blockers dan evidence checklist, bukan pengganti ledger domain yang belum tersedia.
3. Tukar faktur, penugasan collector/follow-up dan seluruh COD collection belum lengkap.
4. Coretax/XSD, penggantian/pembatalan faktur resmi serta verifikasi resmi keluaran belum lengkap; membutuhkan spesifikasi dan data pajak resmi, selain implementasi.
5. Template cetak final, arsip/retensi dan pemisahan role database produksi belum selesai.
6. Ketepatan pajak campuran, concurrency reservasi/approval, rollback/replay, posting dan reversal perlu dibuktikan ketika pengguna mengizinkan pengujian alur.

Karena itu, F01–F07 memiliki perbaikan backend, tetapi matriks kelengkapan O2C penuh belum lulus. UI/UX tahap berikutnya harus memakai kontrak baru dan tidak menyamarkan batas di atas.
