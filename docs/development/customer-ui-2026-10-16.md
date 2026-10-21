# Master Data Pelanggan - 16 Oktober 2026

## Arah yang disetujui
Pengguna meminta daftar, buat/edit, dan detail mengikuti tiga halaman PDF Redesign UI Master Data-Pelanggan. Tambahkan nomor HP/WA pada setiap PIC. Fokus desktop; sidebar global tetap. Ini melanjutkan izin membangun tanpa pertanyaan visual ulang.

## Cakupan dan penerimaan
- MD-01/05/06/07, CRM-01/05: satu institusi, kontak reusable, kode server, master lifecycle dan finance read-only.
- Daftar: pencarian kode/nama, filter onboarding/hubungan/channel, kolom sesuai PDF, pagination server, izin data keuangan terpisah.
- Buat/edit: cek kandidat duplikat; enam panel berurutan; alamat utama/penagihan/pengiriman, channel/rayon; PIC per fungsi dengan HP/WA/email dan kontak bersama; legalitas/PJT; ringkasan Finance; NOO; onboarding/penagihan.
- Detail: status dan aksi, ringkasan 4 kolom, tab Kontak PIC/Legalitas/NOO/Penjualan/Perubahan.
- Next/React, komponen bersama, TanStack Query/Table, Sonner; permission company-scoped, versi update, audit. Tidak menulis saldo/kredit/pajak melalui master.

## Kontrak yang ditemukan
Master create/update dan activate/deactivate tersedia, read detail lengkap/filter khusus/history belum tersedia. Customer menyimpan JSON legalDocuments/responsiblePerson/responsibleLicense/nooDocument; kontak memakai Contact CRM (phone string). CRM create kontak idempoten tersedia, update kontak perlu adapter berizin/versioned. Onboarding hanya DRAFT/NEEDS_REVIEW/VERIFIED; status Perlu Perbaikan belum tersedia. Upload bukti saat ini JPEG/PNG 2 MB. WAPU, opening dan verifikasi onboarding tidak boleh dibuat dari field bebas; tampilkan status sumber atau belum tersedia.

## Pemeriksaan
Pemeriksaan browser pada route nyata; typecheck/build/lint/validator; uji backend terarah untuk scope, filter dan optimistic update kontak. Persistence transaksi domain tidak digantikan data simulasi.


## Hasil implementasi dan bukti
- Route operasional `/master-data/customers`, `/new`, `/:id/edit`, `/:id` memakai workspace khusus sesuai struktur PDF. Panel ringkasan 4 kolom pada desktop lebar, 2 kolom pada panel browser sempit. Filter, pemilih kolom, badge, enam panel form dan lima tab detail tersedia.
- React/Next, komponen UI bersama dan token, TanStack Query/Table serta Sonner digunakan. Field mobile tidak termasuk cakupan. Tidak ada migrasi database.
- Browser lokal memuat daftar dari endpoint baru, edit pelanggan simulasi CUS-000005 berhasil menyimpan dua nomor PIC berbeda dan detail menampilkan keduanya; audit master.updated muncul. Bukti `tmp/pdfs/customer-redesign/list-result.png`, `form-result.png`, `detail-result.png`.
- Enam unit test batas perusahaan, izin Finance, versi kontak, reassignment dan audit lulus (`tests/unit/customer-workspace.test.ts`). Office typecheck, backend build, lint file terkait, repository validator lulus.
- Keterbatasan sumber: WAPU/saldo awal belum tersedia; impor saldo awal dinonaktifkan; Validasi memeriksa isian dasar dan tidak memverifikasi/aktivasi onboarding. Upload mengikuti backend JPEG/PNG maksimal 2 MB. Tidak mengklaim alur verifikasi legal/pajak sudah tersedia. Penyimpanan master dan PIC berupa beberapa request; bila sebagian gagal UI memberi pesan dan retry mempertahankan kontak yang telah tersimpan.
- Uji create melalui UI berhasil membuat draft CUS-000009 (Klinik Uji UI Pelanggan 161026) pada DATA UJI FIKTIF, dengan tiga PIC/nomor berbeda; detail menunjukkan ketiga nomor. Tab Legalitas/NOO kosong tampil tanpa error. Bukti created-result.png.

## Koreksi daftar, shell dan navigasi — 16 Oktober 2026

Permintaan pengguna: hilangkan tulisan di atas filter Status onboarding, Tahap hubungan dan Channel; rapikan shell, navigasi dan breadcrumb. Cakupan MD-01/05, APP-03, NFR-05 pada route Master Pelanggan: daftar/detail/edit memakai shell global, konten menggunakan lebar tersedia, submenu tetap aktif pada turunannya, breadcrumb menunjukkan hierarki dan tautan kembali yang benar. Label aksesibel filter dipertahankan dengan hideLabel, pilihan Semua diberi konteks agar dropdown dapat dibedakan. Acuan tetap standar desain global web. Tidak mengubah kontrak API, izin, schema atau transaksi. Penerimaan melalui browser operasional, pengukuran kontrol/popup, typecheck dan validator repository.

Hasil QA koreksi: login nyata memuat daftar, detail dan edit pelanggan. Label filter tersembunyi secara visual namun aria-label tetap ada; dropdown dapat dibuka lewat kontrol aksesibel dan ditutup dengan Escape. Popup terukur 150 px, font 12 px. Kontrol pencarian/filter sekitar 36 px. Breadcrumb edit memuat Master Data > Pelanggan > kode > Ubah, dengan tautan kembali ke daftar dan detail. Sidebar Pelanggan tetap aria-current pada detail/edit; collapse/expand berfungsi. Konten memakai max-width none, tidak ada overflow horizontal halaman pada viewport browser yang diuji; scrollbar thin. Bukti customer-list-shell-2026-10-16.png. Typecheck Office, ESLint terarah dan validator repository lulus. Perubahan ini hanya presentasi/navigasi; tanpa migrasi database.
