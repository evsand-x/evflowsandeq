# Penyelarasan kolom Status dan Keterangan — 15 Oktober 2026

## Arah pengguna

- Tujuan: gaya label pada kolom Status dan Keterangan tabel web Office seragam.
- Cakupan: tabel pada route Office operasional yang sudah tersedia. Dashboard, CRM, transaksi, dan Setting termasuk dalam audit; Field ditunda.
- Acuan visual: implementasi tabel Daftar Sales Order yang dipilih pengguna, terutama label status ringkas dengan titik warna, ukuran 11 px, radius 6 px, dan warna semantik.
- Isi Keterangan, alasan, dan arti status tetap mengikuti pemilik domain. Perubahan ini tidak mengubah API, izin, persistence, atau transisi bisnis.
- Pengguna meminta skill Figma. Tidak ada URL/node Figma pada repository atau percakapan. Karena pengguna memilih tabel Daftar Sales Order sebagai acuan, pemeriksaan visual menggunakan implementasi lokal itu dan standar desain global web.

## Pemetaan

APP-03 dan NFR-05 mengatur tabel konsisten, label selain warna, responsivitas, dan aksesibilitas. `07-design.md` dan `41-kamus-label-dan-bahasa.md` mengatur label yang jelas. `docs/mockup/web-design-standard.md` mengatur ukuran header/isi tabel dan token Office. Domain 09–15 tetap menjadi pemilik arti status. Implementasi berada di komponen tabel Office dan CSS global; tidak ada migrasi atau perubahan kontrak.

## Kriteria penerimaan

- Sel status pada tabel tersedia memakai bentuk, ukuran, dan indikator titik yang konsisten dengan daftar Sales Order; warna status yang sudah bermakna tetap dipertahankan.
- Keterangan memakai tipografi isi tabel, membungkus saat panjang, dan nilai lengkap tetap bisa dibaca.
- Header Status dan Keterangan tetap jelas, urutan kolom dan data tidak berubah.
- Pemeriksaan mencakup desktop dan viewport sempit pada route operasional yang dapat diakses, termasuk state kosong dan izin yang tersedia.

## Koreksi ukuran

Label bersama disamakan dengan struktur `.so-status` pada daftar Sales Order: font 11 px/500, line-height 1.5, padding 4 px 9 px, radius 6 px, titik 5 px dengan jarak flex 4 px dan margin kanan 5 px. Wrapper tabel tidak menambah padding pada Badge bersarang. Pemeriksaan DOM route `/operations/orders` pada 15 Oktober 2026 tertahan di state “Silakan masuk”; perbandingan computed style antarrute memerlukan sesi pengguna operasional yang sah.
