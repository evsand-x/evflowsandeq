# SJ terbit dan penerimaan terpisah - 30 Oktober 2026

## Arah dan cakupan

Keputusan pengguna: penerbitan langsung tanpa konfirmasi penerimaan, penerimaan lewat tombol pada detail SJ terbit; stok, pendapatan/HPP dan kelayakan invoice tetap saat issue. Requirement OTC-05/06, WH-08 dan IAM-01/04. Desain: [kontrak](../superpowers/specs/2026-10-30-sj-penerimaan-terpisah-design.md).

## Implementasi

- Issue menerima objek kosong dan memposting jumlah draft tersimpan pada issuedAt, bukan waktu penerimaan. Snapshot ongkir yang ditagihkan tetap utuh; biaya ongkir tercatat terpisah dari nilai yang dibebankan pelanggan.
- Receipt API/kontrak dan tombol Penerimaan Barang pada detail ISSUED menyimpan nama, jabatan opsional, waktu, bukti dan jumlah/selisih. Selisih tidak mengoreksi saldo/Invoice otomatis. Form direset sepenuhnya saat dibuka dan state dipisahkan per SJ.
- Tabel delivery_note_receipts append-only, unik per SJ; lock, company scope, bukti sesuai purpose, idempotency, audit/outbox. Dokumen dan baris SJ terbit tetap immutable. Penerimaan lama tetap dibaca tanpa diubah.
- Read outbound_shipping.read; command fulfillment.dispatch milik submenu Surat Jalan, tanpa grant/fallback baru. Grant SO/Invoice/POD tidak membuka endpoint ini.
- TanStack Query dipakai dan diinvalidasi setelah command; dialog menggunakan komponen bersama. Tabel form yang sudah ada tetap dipakai; tidak ada perubahan tema/navigasi.
- Migration 20261030160000_delivery_note_receipt diterapkan ke PostgreSQL lokal. Blueprint 00, README, 02-08, 10-12 dan 15 diperbarui untuk kontrak baru.

## Bukti verifikasi

- 51 tes / 11 file lulus: SJ issue/receipt, form/list, invoice/backend/read/concurrency, progres SO, otorisasi submenu dan utilitas UI.
- Terbit tanpa bukti, stok/jurnal tepat sekali, invoice sebelum penerimaan, receipt discrepancy tanpa posting ulang, idempotency, immutability trigger, historical handover, scope/date/evidence/qty rejection diuji pada database lokal dengan rollback fixtures.
- Build API dan dependencies 5/5 lulus; Office typecheck lulus; ESLint file implementasi berubah lulus.
- Review independen menemukan risiko snapshot ongkir dan state formulir saat dibuka ulang; keduanya diperbaiki. Regresi snapshot ongkir dibuktikan gagal lalu lulus.
- Browser nyata pada sesi Admin Demo: daftar dan draft operasional terbaca, label Terbitkan Surat Jalan, font 12px, tinggi 42px, latar rgb(11,77,162), teks putih. Bukti [draft](../mockup/review/sj-receipt-2026-10-30/draft.png).

## Batas verifikasi

Database sesi browser yang tersedia hanya mempunyai SJ draft dengan stok layak 0; tidak menerbitkan transaksi pengguna atau mengubah saldo untuk QA. Jalur sukses issue/receipt diverifikasi lewat integration test, tetapi popup penerimaan, viewport sempit, dan alur penuh sukses di browser belum diverifikasi. Ini bukan klaim release gate produksi selesai.

Prisma generate memperbarui client JS/TS tetapi mengembalikan EPERM saat mengganti binary Windows yang sedang dikunci proses lain. Migrasi, runtime integration tests, typecheck dan build memakai client baru berhasil; tidak mengklaim generate bersih. Validasi repository dijalankan setelah sinkronisasi.
