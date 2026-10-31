# Form produk mengikuti mockup

Tanggal: 31 Oktober 2026

Form `/master-data/products/new` dan `/master-data/products/:id/edit` dibangun ulang mengikuti board "Form · Produk baru" di `docs/mockup/evflow-office-design.pen` (canvas `Product-form.dc.html`).

## Keputusan pengguna

- Kode produk diisi manual, bukan dari sequence.
- Lacak lot/batch dan wajib tanggal kedaluwarsa berupa toggle; kedaluwarsa hanya bisa diaktifkan bila lot/batch dilacak.
- Izin edar (NIE) tetap ada tetapi tidak wajib, termasuk untuk aktivasi. Jenis izin: AKL (Impor) | AKD (Dalam Negeri).

## Backend

- `createProductSchema`: `code` wajib, `uoms` (konversi, maks. 20), `permit_evidence_object_key`; refine kedaluwarsa butuh lot/batch. `updateProductSchema`: `code` opsional.
- `createProduct`: kode unik (`PRODUCT_CODE_TAKEN`), konversi divalidasi (aktif, bukan satuan dasar, tidak ganda, faktor > 0) dan dibuat dalam transaksi yang sama, bukti izin hanya bila izin diisi dan berpurpose `PRODUCT_MASTER`.
- `updateProduct`: ganti kode hanya saat Draf dan belum dipakai stok/SO/PO (`PRODUCT_CODE_LOCKED`).
- Aktivasi (`changeState` → `ACTIVE`): syarat izin edar Valid dilepas; catatan + profil penyimpanan dan masa simpan (bila kedaluwarsa dilacak) tetap wajib.

## Office

- Halaman penuh berseksi dengan kartu "Kesiapan aktivasi" di bawah navigasi bagian (`FormFrame` mendapat prop `navAside`).
- Produk baru: konversi, izin edar awal (dengan unggah bukti JPEG/PNG) dan harga acuan dikirim dalam satu create. Ubah produk: konversi, izin edar dan harga acuan tampil ringkas dan tetap dikelola dari tab detail; batas diskon dapat diubah.
- Pesan error kode/konversi/aktivasi diterjemahkan di `lib/api.ts`.
- Unggah bukti mengikuti endpoint yang ada: JPEG/PNG maks. 2 MB (mockup menyebut PDF; belum didukung backend).

## Verifikasi

- `tests/integration/product-form.test.ts` (5) dan `tests/unit/product-form-utils.test.ts` (5) lulus.
- Suite penuh: 40 kegagalan sama persis dengan sebelum perubahan (proforma, otc-controls, milestone IAM, dashboard unit).
- Browser (Admin Demo): produk baru dengan kode diketik huruf kecil (otomatis kapital), konversi Kit 0,01 Box, kedaluwarsa + masa simpan 730 hari, harga 125.000/150.000 (margin 16,7%) tersimpan sebagai Draft lalu berhasil diaktifkan tanpa izin edar; di form ubah, kode dan satuan dasar terkunci setelah aktif.
