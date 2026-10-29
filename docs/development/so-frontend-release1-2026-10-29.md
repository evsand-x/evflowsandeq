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

## Gap yang masih tercatat

| Mockup | Kondisi |
|---|---|
| Tanggal SP | Belum ada di backend; tidak ditampilkan |
| Ongkir Ditanggung pelanggan untuk akun tanpa izin baca Setting | Ditahan dengan pesan konfigurasi |

## Verifikasi

- Typecheck office, backend, seed; ESLint dan Prettier berkas yang diubah: lulus.
- Unit `apps/office/lib/sales-order-copy.test.ts`; integrasi `tests/integration/so-release1-read-model.test.ts`, `o2c-delivery-note.test.ts`, `so-stock-availability.test.ts`; e2e `apps/api/test/so-form.e2e.test.ts`; unit `tests/unit/order-list-filters.test.ts`: lulus di PostgreSQL lokal.
- Seed dummy dijalankan dua kali pada database kosong (idempoten). Daftar, Detail dan Form diperiksa di browser pada route operasional dengan akun demo; SO baru dengan nomor ubahan tersimpan.
