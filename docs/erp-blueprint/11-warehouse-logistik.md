# Domain Warehouse & Logistik

## Gudang pada SO — backend 25 Oktober 2026

OTC-04: SO baru menyimpan gudang kepala dan opsional per baris. Alokasi mengunci lot dan memeriksa ulang kelayakan, hanya pada gudang baris atau kepala; tidak otomatis mengambil gudang lain. SO lama tanpa gudang mempertahankan perilaku sebelumnya sampai direvisi. Pembacaan stok pada form hanya informasi: saldo dikurangi reservasi pada STORAGE/DISPATCH dengan mutu AVAILABLE dan expiry sah. Stok locator lain ditampilkan terpisah, termasuk karantina, tanpa membuat reservasi atau memindahkan barang. Pengajuan pindah locator belum bagian backend daftar/form ini.


Dokumen ini adalah sumber domain kanonis untuk modul ini. Judul ‘Bagian asal’ mempertahankan keterlacakan isi sebelum konsolidasi; prioritas keputusan tetap mengikuti Peta Dokumen.


---

## Bagian asal: 11-warehouse-logistik.md

# Warehouse & Logistik

Status: sumber domain Warehouse & Logistik untuk kebutuhan persediaan, PR/PO, inbound, penyimpanan, stok, picking, pengiriman, retur dan kontrol kualitas.

## 1. Kepemilikan

Logistik memiliki kebutuhan persediaan, PR, perencanaan konsolidasi, PO Supplier/Vendor, monitoring kiriman, penerimaan, batch/locator, quality, stok, picking, packing, pengiriman dan retur fisik. Finance memiliki invoice/tagihan, AP, pembayaran dan jurnal. HR mengelola permintaan barang operasional sesuai hak akses. Supplier dan Vendor tetap master terpisah.

## 2. Procure-to-Pay operasional

Forecast/backorder/minimum stock/kebutuhan internal → evaluasi stok dan PO berjalan → PR → approval policy → konsolidasi atau pembagian per supplier/vendor → PO → konfirmasi dan monitoring pengiriman → GR/service acceptance → quality/locator → Finance three-way match → AP/payment.

PR tidak otomatis menjadi PO. Satu PR dapat dibagi ke beberapa PO karena supplier, ongkir, jumlah, jadwal atau kategori. Tidak ada supplier comparison requirement; pemasok mengikuti MOU/kontrak perusahaan.

Status PR: Draft, Diajukan, Disetujui, Ditolak, Sebagian Dipenuhi, Selesai, Cancelled. Status PO: Draft, Menunggu Approval, Disetujui, Diterbitkan, Dikonfirmasi, Sebagian Diterima, Selesai, Closed, Cancelled. Sisa PO dapat menunggu susulan atau ditutup beralasan.

## 3. PO dan monitoring supplier/vendor

PO menyimpan pihak, tipe Supplier/Vendor, kontrak/MOU, alamat kirim, TOP, `due_basis`, mata uang, item, UOM, harga, diskon, pajak, ongkir, jadwal, syarat shelf-life, dokumen dan approval. `due_basis` default adalah tanggal invoice lengkap diterima dan diverifikasi; tanggal invoice supplier atau GR hanya dipakai bila PO/MOU memilihnya eksplisit. Monitoring per shipment mencatat resi, ETA, update terakhir, qty dikirim, qty diterima, kendala dan PIC.

## 4. Inbound dan penerimaan

Persiapan inbound → cocokkan PO/surat jalan → hitung qty dan periksa kondisi → catat batch/lot/expiry/serial/suhu → pisahkan layak dan karantina → tentukan locator → GR → quality release atau hold → selisih/shortage → arsip bukti.

GR dapat mencatat layak dan karantina dalam satu penerimaan. Nilai awal OPS-WH-01 menetapkan over-receipt tolerance 0% dan dapat diubah melalui Setting; penerimaan di atas batas aktif menjadi exception. Qty kurang dicatat aktual sebagai selisih dan sisa PO, bukan stok fiktif. Suhu/shelf-life yang hilang atau excursion membuat quality hold. Barang belum layak tidak available for sales. GR tidak otomatis menjadi AP; invoice supplier diproses Finance.

## 5. Stok dan locator

Setiap movement menyimpan produk, UOM dasar, qty, batch, expiry, serial bila relevan, locator asal/tujuan, kepemilikan, source document dan user. Locator mendukung gudang, karantina, transit, konsinyasi, suhu khusus dan status hold. Strategi batch mengikuti OPS-WH-02; nilai awal FEFO untuk barang berexpiry dan FIFO bila expiry tidak tersedia.

Stock opname membekukan scope/lokasi, mencatat count, variance dan approval, lalu membuat stock movement serta jurnal bila berdampak nilai. Tidak ada edit saldo langsung.

## 6. Outbound dan retur

Picking berdasarkan reservation fulfillment dari domain Sales OTC. Petugas mencatat batch/locator/qty aktual; checking memverifikasi item, batch, expiry, qty dan kemasan; packing/SJ hanya dari hasil checking. Dispatch memindahkan stok ke transit; POD mengonfirmasi penerimaan.

Retur pelanggan masuk locator karantina otomatis. Eligibility/batas waktu berasal dari policy aktif; tanpa policy, keputusan finansial ditahan walaupun penerimaan fisik tetap dicatat. Quality menentukan release, reject, recall atau destruction. Recall aktif memblok alokasi/picking/dispatch. Pemusnahan memerlukan pengusul, approver berbeda, witness, metode, bukti, stock movement dan jurnal.

## 7. Data utama

`inventory_requirements`, `purchase_requests`, `purchase_request_lines`, `purchase_plans`, `purchase_orders`, `purchase_order_lines`, `supplier_shipments`, `goods_receipts`, `goods_receipt_lines`, `service_acceptances`, `quality_inspections`, `temperature_logs`, `warehouses`, `locators`, `stock_ledger`, `stock_reservations`, `stock_counts`, `returns`, `recall_cases`, `destructions`, `consignment_movements` dan `sample_issues`.

## 8. API domain

`/inventory-requirements`, `/purchase-requests`, `/purchase-plans`, `/purchase-orders`, `/supplier-shipments`, `/goods-receipts`, `/service-acceptances`, `/quality-inspections`, `/warehouses`, `/locators`, `/stock-balances`, `/stock-movements`, `/stock-counts`, `/returns`, `/recall-cases` dan `/destructions`.

Reservation, GR, release, recall dan destruction memakai locking/idempotency. Read availability boleh cache, tetapi posting stock ledger selalu server-side dan atomik.

## 9. Kriteria penerimaan

1. PR dapat dibagi menjadi PO berbeda supplier/vendor.
2. Ongkir tercatat pada PO/shipment dan tidak hilang saat matching; basis default landed cost mengikuti OPS-FIN-05, dengan nilai awal nilai pembelian net per charge.
3. Partial PO dan partial GR mempertahankan sisa.
4. GR kurang/rusak tidak menambah qty layak.
5. Barang retur otomatis masuk karantina.
6. Batch expired/hold/recall tidak dapat dialokasikan.
7. Stock ledger dapat direkonstruksi dan direkonsiliasi ke GL.
8. Picking tidak boleh melebihi reservation atau ordered balance.
9. Retry tidak menggandakan GR atau movement.

## 10. Keputusan final dan konfigurasi wajib

Tolerance, hold, recall, retur, konsinyasi dan pemusnahan telah ditetapkan. Profil file/nomor inbound, nilai shelf-life/suhu, agreement ownership, daftar alasan dan reviewer wajib diisi dari sumber resmi sebelum policy diaktifkan. Nilai yang belum tersedia tidak boleh diganti default universal.

## Izin tahap barang keluar — 16 Oktober 2026

IAM-01/04: baca Pick Slip, Checking/Packing, Pengiriman dan POD dipisahkan menjadi `outbound_picking.read`, `outbound_checking.read`, `outbound_shipping.read`, `delivery_receipt.read`. Kode command picking/checking/dispatch yang sudah terpisah tetap berlaku dan ditempatkan pada resource submenu pemiliknya dalam katalog. Backorder & Alokasi Stok memakai `warehouse_allocation.read`. Induk Barang Keluar hanya mengelompokkan; izin baca satu tahap tidak membuka endpoint tahap lainnya. Status, bukti, stok, audit dan command domain tetap berlaku.

## Keputusan 24 Oktober 2026 — retur supplier, biaya dan persetujuan P2P

Mengikuti bagian 7 [desain konsolidasi](../superpowers/specs/2026-10-24-konsolidasi-pengaturan-design.md) (tahap 5 P2P dan tahap 6 Gudang).

- **Retur ke supplier (PTP-02).** Logistik mencatat retur barang: pilih GR asal, qty, batch dan locator sumber (layak atau karantina), lalu barang keluar melalui stock movement. Qty retur tidak melebihi qty diterima dikurangi yang sudah diretur. Finance menerbitkan nota debit dari retur tersebut. Klaim tanpa barang keluar (potongan harga, kurang kirim yang sudah ditagih) hanya berupa nota debit di Finance dan tidak membuat stock movement.
- **Biaya stok (FIN-04).** Batch, expiry dan locator tetap dilacak untuk FEFO/FIFO, recall dan karantina. Nilai keluar memakai rata-rata bergerak produk, bukan biaya per batch; penerimaan ulang batch yang sama dengan harga berbeda memperbarui rata-rata.
- **Persetujuan PO dan retur supplier (CFG-12).** Sampai mesin persetujuan umum aktif, persetujuan PO dan retur supplier memakai toggle di Setting › Persetujuan dengan nilai bawaan nonaktif. Bila aktif, PO berstatus Menunggu Approval sebelum Disetujui/Diterbitkan. Persetujuan opname/penyesuaian dan pemusnahan wajib dan tidak dapat dimatikan.
- **Urutan pembangunan.** Tahap 5 (P2P) dan 6 (Gudang) dikerjakan sebelum mesin persetujuan umum (tahap 4).

## O2C Release 1 (29 Oktober 2026)

Surat Jalan terbit adalah event handover dan pemindahan stok pada Release 1. Pengiriman parsial diperbolehkan secara kumulatif dan divalidasi ulang saat terbit.


## O2C Release 1 (29 October 2026)

Issued Surat Jalan is the handover, stock, revenue and HPP event. One SO supports cumulative Surat Jalan quantities up to ordered quantity; Invoice is created only from an issued Surat Jalan. Termin/TOP is selected on SO and snapshotted. Surat Jalan uses existing outbound permission grants; no delivery_note grants are introduced.

