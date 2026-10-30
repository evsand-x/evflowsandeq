# Surat Jalan: penerbitan dan penerimaan terpisah

## Keputusan pengguna

30 Oktober 2026: Terbitkan SJ tidak meminta konfirmasi penerimaan. Tombol Penerimaan Barang ada di detail SJ terbit. Pengguna menegaskan stok, jurnal pendapatan/HPP dan kelayakan invoice tetap berjalan saat SJ terbit. Keputusan ini menggantikan penyatuan issue dan handover pada Release 1.

## Kontrak dan pendekatan

- `POST /delivery-notes/:id/issue` menerima objek kosong. Jumlah berasal dari draft tersimpan; seluruh jumlah tersebut diposting sekali. Waktu penerbitan server menjadi tanggal event posting. `deliveredQuantity` tetap menjadi jumlah terbit untuk kompatibilitas invoice/progres SO; bukan bukti penerimaan pelanggan.
- `POST /delivery-notes/:id/receipt` mencatat waktu, nama/jabatan penerima, bukti SURAT_JALAN dan jumlah diterima per baris. Hanya SJ ISSUED, satu catatan immutable, idempotent, company-scoped, izin `fulfillment.dispatch` dalam submenu Surat Jalan. Read tetap `outbound_shipping.read`.
- Penerimaan disimpan dalam tabel terpisah; tidak mengubah SJ/line, invoice, stok, jurnal, termin atau progres SO. Selisih hanya catatan; penyelesaian finansial/stok memakai alur koreksi/retur terpisah. Waktu penerimaan tidak mendahului penerbitan; bukti wajib; jumlah boleh nol sampai jumlah terbit dan selisih wajib beralasan.
- Bukti handover lama tetap dibaca sebagai penerimaan historis; tidak ditulis ulang, tidak boleh dicatat ganda.
- Pendekatan terpilih mengikuti keputusan pengguna: posting saat terbit. Menunda posting sampai diterima bertentangan dengan keputusan; memperbarui kolom SJ terbit akan melemahkan invariant immutable, sehingga digunakan catatan penerimaan terpisah.

## Cakupan dan penerimaan

OTC-05/06, WH-08, IAM-01/04; lapisan kontrak, database, API, UI, audit/outbox dan test. Tidak menambah menu/preset peran atau mengubah grants. Standar visual: docs/mockup/web-design-standard.md. Penerimaan bertahap dan reversal tidak ditambahkan dalam perubahan ini.

Terbit tanpa bukti berhasil, stok/jurnal/invoice tetap bekerja, penerimaan tidak memposting ulang; draft/duplikat/scope/bukti/jumlah tidak sah ditolak; SJ lama dan perlindungan immutable bertahan. Tidak ada keputusan material terbuka.
