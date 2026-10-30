# Frontend Sales Order Release 1 — 29 Oktober 2026

Cakupan: Daftar, Form (buat/ubah) dan Detail Sales Order pada route operasional `/operations/orders`, mengikuti canvas evflow Office Design (`SO-list`, `SO-form`, `SO-detail`) dan `docs/mockup/evflow-office-design.pen` untuk tata letak, serta kontrak backend O2C Release 1 untuk isian dan aksi.

## Keputusan pengguna

- Mockup menjadi acuan tata letak dan hierarki; backend menjadi sumber kebenaran isian dan aksi.
- Jangan menampilkan input yang belum didukung endpoint dan jangan membuat endpoint baru untuk memenuhi mockup.
- Harga per baris diketik di form; server memeriksa price list saat SO diajukan.
- Posisi PPN ongkir diambil dari Setting › Termin & Kredit (`OPS-FLX-04`).
- Kode digabungkan ke branch `docs/erp-fleksibel` (fast-forward ke `716b84c`).

## Keputusan agent (dapat diubah pengguna)

- Label status `OPEN` menjadi **Diajukan** di seluruh layar SO (mengikuti Daftar dan Detail pada mockup).
- Tanggal SP tidak ditampilkan karena `POST /sales-orders` tidak menerimanya (Nomor SO: lihat lanjutan di bawah).
- Ongkir: pilihan Ditanggung pelanggan / Ditanggung perusahaan; nilai di Ringkasan dikirim sebagai `freight.estimate` dengan `basis: PER_SHIPMENT`. Ditanggung pelanggan memakai `tax_mode` dari `OPS-FLX-04` (Sebelum PPN = `TAXABLE`, Sesudah PPN = `NON_TAXABLE`; README dan FIN-12); Ditanggung perusahaan dikirim `NON_TAXABLE` karena tidak ditagihkan. Bila akun tidak dapat membaca `OPS-FLX-04`, pilihan Ditanggung pelanggan ditahan dengan pesan konfigurasi.
- Total SO = nilai barang + PPN, sama dengan total server; ongkos kirim ditagih per Surat Jalan sehingga tidak dijumlahkan ke Total SO.
- Detail: aksi yang tampil hanya Kembali, Cetak, SO baru, Ubah, Ajukan SO dan Buat Surat Jalan. Aksi jalur lama (picking, Packing List, POD, invoice dari batch, proforma, alokasi ulang, tutup sisa, uang muka, persetujuan pengecualian, duplikat) disembunyikan karena bukan bagian Release 1.
- Daftar: tab Semua, Draft, Perlu dikirim, Belum diinvoice (hanya dengan `sales_invoice.read`) dan Terkirim penuh, dengan hitungan dari server.

## Lanjutan 29 Oktober 2026: backend nomor, daftar, detail dan status

Atas permintaan pengguna backend dilengkapi (kontrak di `04-api.md`, bagian Release 1):

- Nomor SO usulan dari Setting dapat diubah dan harus unik; hanya dapat diubah selama Draft.
- Surat Jalan terbit dihitung sebagai serah terima pada status, filter dan progress SO.
- Daftar: termin, Pengiriman, Tagihan (dengan `sales_invoice.read`), tab Perlu dikirim dan Belum diinvoice.
- Detail: alamat utama pelanggan, Terkirim/Diinvoice per barang, ringkasan tagihan, daftar Surat Jalan (dengan `outbound_shipping.read`); aksi Ubah tidak ditawarkan setelah Surat Jalan terbit.
- Kolom Status menampilkan status dokumen (Draft, Menunggu persetujuan, Diajukan, Dibatalkan); kemajuan kirim ada di kolom Pengiriman sesuai mockup.
- Data dummy: `pnpm db:seed:o2c-demo` (setelah `db:seed:dev` dan akun demo) membuat satu SO 150 Box diajukan, satu Surat Jalan terbit 86 Box dan satu Invoice dari Surat Jalan itu melalui command domain dengan kunci idempoten.

## Lanjutan 30 Oktober 2026: kolom sesuai `.pen`, diskon, PPN 11% dan pelanggan dapat dicari

- Kolom Daftar, Form dan Detail mengikuti `evflow-office-design.pen`. Form Barang: Produk | Qty | Satuan | Harga | Diskon | Subtotal (kolom PPN dihapus dari form). Detail Barang tetap Produk | Dipesan | Terkirim | Sisa | Diinvoice | Harga | PPN | Subtotal (keputusan pengguna: ikuti `.pen` persis).
- Diskon persen per baris disimpan di SO (`sales_order_lines.discount_rate`), diperiksa terhadap batas diskon OTC-18 di server, dan mengurangi nilai SO sebelum PPN. Keputusan pengguna: **hanya SO dulu**; Surat Jalan dan Invoice belum memakai diskon.
- PPN ditampilkan sebagai tarif efektif (tarif × faktor DPP): bawaan 12% × 11/12 tampil **11%** di Ringkasan form dan kolom/ringkasan detail.
- Pelanggan di form SO memakai field yang diketik langsung untuk mencari (`SearchSelectField`), bukan dropdown; mockup canvas dan `.pen` diselaraskan.

## Lanjutan 30 Oktober 2026: Daftar Surat Jalan

- Route `/operations/delivery-notes` mengikuti canvas `SJ-list`/`.pen`: tab Semua, Draft, Terbit belum diinvoice, Sudah diinvoice (dua tab terakhir, kolom Invoice dan banner hanya dengan `sales_invoice.read`); cari nomor SJ, SO atau pelanggan; filter gudang; kolom Nomor | Sales Order | Pelanggan | Gudang | Serah terima | Barang | Status | Invoice.
- Tombol "Surat Jalan dari SO" membuka Daftar SO tab Perlu dikirim (keputusan pengguna); Surat Jalan tetap dibuat dari detail SO. Tombol tampil bagi pemegang `fulfillment.dispatch` dan `sales_order.read`.
- Tab **Siap dibuatkan SJ** (keputusan pengguna 30 Oktober 2026): SO diajukan yang masih punya sisa belum dikirim, dari daftar SO yang sudah ada (`GET /operations/lists/orders?queue=TO_SHIP`, jumlah dari `summary.toShip`); kolom Nomor SO | Tanggal SO | Pelanggan | Termin | Sisa dikirim | Pengiriman | Buat Surat Jalan. Tab hanya untuk pemegang `sales_order.read` dan `fulfillment.dispatch`; tidak ada endpoint baru.
- Tab **Semua** menggabungkan SO siap dikirim dalam satu tabel (keputusan pengguna 30 Oktober 2026): baris SO tampil di atas dengan tombol Buat Surat Jalan di kolom Nomor, status "Belum dibuat", Gudang/Serah terima/Invoice "—", Barang = sisa dikirim. Hitungan Semua = dokumen Surat Jalan + SO siap dikirim. Baris SO hanya di halaman 1 dan tidak tampil saat filter gudang aktif (SO belum punya gudang kirim); daftar lengkapnya di tab Siap dibuatkan SJ.

## Lanjutan 30 Oktober 2026: Form Surat Jalan

- Route `/operations/delivery-notes/from-order/:soId` (draft baru) dan `/operations/delivery-notes/:id` untuk draft membuka form canvas `SJ-form`; Surat Jalan terbit tetap memakai halaman detail lama sampai Detail SJ dibangun.
- Memakai kontrak backend form Surat Jalan 29 Oktober (`number`, `document_date`, `ship_date`, `warehouse_id`, `carrier_name`, `vehicle_number`, `driver_name`, `freight_amount`; lihat `o2c-delivery-note-form-backend-2026-10-29.md`). Tambahan 30 Oktober: `receiver_title` pada penerbitan dan read model `GET /delivery-notes/form`.
- Nomor SJ diisi usulan Setting dan hanya dikirim bila diubah (tanpa nomor server memakai urutan). Gudang asal satu per Surat Jalan; kolom Stok = stok layak di gudang itu.
- Dialog Terbitkan: waktu serah terima, penerima, jabatan, qty diterima per baris (selisih menjadi `rejected_quantity` dengan alasan), bukti serah terima dan konfirmasi; sukses hanya setelah server menjawab.
- Nama ekspedisi berupa isian teks dengan saran dari nama yang pernah dipakai (belum ada master ekspedisi). Alasan selisih: pilihan mockup + "Lainnya" dengan keterangan.
- Ongkir (keputusan pengguna 30 Oktober 2026): ditagihkan hanya bila ongkir SO ditanggung pelanggan; nilai yang diisi menggantikan estimasi SO, kosong = estimasi SO. Bila ongkir SO ditanggung perusahaan, nilai di Surat Jalan hanya dicatat sebagai biaya kirim (`freight_amount`) dan tidak masuk tagihan, pendapatan, maupun Invoice.

## Gap yang masih tercatat

| Mockup | Kondisi |
|---|---|
| Tanggal SP | Belum ada di backend; tidak ditampilkan |
| Ongkir Ditanggung pelanggan untuk akun tanpa izin baca Setting | Ditahan dengan pesan konfigurasi |
| Diskon SO di Surat Jalan dan Invoice | Belum diwariskan; Invoice memakai nilai bruto baris SO (keputusan "hanya SO dulu") |
| Diskon di Detail SO | Tidak ada kolom Diskon (mengikuti `.pen`); Subtotal detail sudah setelah diskon |

## Verifikasi

- Typecheck office, backend, seed; ESLint dan Prettier berkas yang diubah: lulus.
- Unit `apps/office/lib/sales-order-copy.test.ts`; integrasi `tests/integration/so-release1-read-model.test.ts`, `o2c-delivery-note.test.ts`, `so-stock-availability.test.ts`; e2e `apps/api/test/so-form.e2e.test.ts`; unit `tests/unit/order-list-filters.test.ts`: lulus di PostgreSQL lokal.
- Seed dummy dijalankan dua kali pada database kosong (idempoten). Daftar, Detail dan Form diperiksa di browser pada route operasional dengan akun demo; SO baru dengan nomor ubahan tersimpan.
