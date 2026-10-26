# Eksekusi backend SO — 25 Oktober 2026

Arahan pengguna: «cek kembali lalu eksekusi». Acuan: rencana `../superpowers/plans/2026-10-25-so-mudah-bagian-1.md` dan spesifikasi SO mudah. Cakupan eksekusi ini adalah backend daftar/form (task 1–6), migrasi, kontrak dan dokumentasi; task layar 7–8 serta detail/uang muka langsung, matriks, pindah locator, penomoran dan pajak merupakan bagian berikutnya.

Requirement: OTC-01/04/12/17, IAM-01/04, CFG-08, NFR-02/09.

## Keputusan pelaksanaan

- Tanggal SO boleh pada periode terkunci sesuai rencana terbaru; SO tidak membuat jurnal. Pemeriksaan periode posting tetap berlaku.
- Bekerja pada checkout pengguna yang sudah berisi spesifikasi/rencana belum dikomit; tidak memindahkan atau menghapus perubahan lokal.
- Pertahankan field respons lama agar frontend operasional tetap kompatibel; tambahkan field baru dan hitungan status terpisah.
- Mesin persetujuan umum dan izin harga lintas dokumen belum termasuk bagian ini, sebagaimana batas rencana. Tidak mengklaim keduanya selesai.
- SO lama yang belum memiliki gudang tetap mempertahankan alokasi lama; backend menyimpan gudang eksplisit untuk SO baru. Perlakuan alokasi berikutnya harus diuji dan dicatat.
- DP tahap ini memakai penerimaan POSTED yang tertaut batch SO dikurangi `refundedAmount`; penerimaan tanpa tautan batch tidak ikut. Pemisahan sumber pembayaran invoice biasa memerlukan model alokasi yang belum tersedia dan tetap menjadi batasan tahap ini.

## Checklist

- [x] Kontrak, schema, migration, katalog kebijakan.
- [x] Resolver kepala, create/revise dan validasi wajib.
- [x] Submit/reallocation: termin dan gudang.
- [x] Status, filter, opsi form dan ketersediaan stok.
- [x] Tes, review, build backend dan validator; sinkronisasi blueprint.

## Verifikasi akhir tahap ini

- Status `CLOSED` tidak diproyeksikan sebagai `COMPLETED` bila alokasi masih belum diterima; regresi unit, SQL, dan command mencakup kasus ini.
- Build TypeScript untuk contracts, database, backend dan API lulus. Typecheck backend, API dan Office lulus.
- Tes terarah SO lulus, termasuk kontrak, migrasi, header, command, status SQL, ketersediaan stok dan HTTP form (10 file, 92 test pada cakupan ini). Full suite terakhir: 413 passed, 39 failed, 8 file gagal dari 76; kegagalan berada pada dashboard IAM, proforma, kontrol OTC/koreksi dan milestone API. Hasil ini tidak dinyatakan hijau; semua kegagalan belum dibuktikan sebagai baseline sebelum perubahan ini. Log lokal: `tmp/so-backend-suite-final.log`.
- Lint seluruh file TypeScript yang berubah/ditambahkan lulus. Dua migrasi `20261025100000_sales_order_header_fields` dan `20261025110000_sales_order_policy_defaults` telah diterapkan pada database development lokal.
- `tools/validate-repository.ps1` dijalankan setelah sinkronisasi dokumen. Penggantian binary Prisma saat `db:generate` tetap terhalang proses engine Windows yang sedang berjalan; generated JS/TS telah terbarui dan build/tes database berhasil.

Baseline audit sebelumnya: typecheck lulus, 4 tes unit izin lama gagal, lint memiliki noise build dan 8 error di tes/skrip setelah pengecualian. Jangan mengatribusikan kegagalan lama sebagai regresi tanpa membandingkan bukti.
