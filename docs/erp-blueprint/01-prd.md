# PRD — evflow untuk PT Sandeq Sarana Medika

Versi 1.0, 25 September 2026. Nama aplikasi final adalah **evflow**. Nama perusahaan awal dapat dikelola melalui Profil Perusahaan pada UI. Fakta, referensi SOP, keputusan final dan release gate mengikuti [register keputusan](README.md) serta [dokumen 39](00-document-map.md). Kepemilikan aturan antarfile mengikuti [Peta Dokumen](00-document-map.md).

## Fokus pelaksanaan terbaru — 29 September 2026

Pekerjaan saat ini memprioritaskan web Office berdasarkan mockup pengguna; Field/native mobile ditunda. Sasaran produk dan release gate tetap berlaku. Urutan implementasi rinci mengikuti inventaris mockup dan dependensi alur web pada [panduan implementasi web](../mockup/web-implementation-guide.md). Keputusan ini belum menyatakan fitur selesai dan belum memulai coding aplikasi.

## 1. Masalah dan hasil yang dituju

Operasional distribusi alat kesehatan masih tersebar di catatan manual, Excel, WhatsApp, dan arsip fisik. Dampak utama yang disampaikan pengguna adalah lemahnya administrasi/akuntansi, kesulitan memantau piutang, belum adanya target yang jelas, ketidakpastian HPP/harga jual dan margin, payroll, rekrutmen, serta permintaan barang operasional.

Produk harus menghubungkan transaksi operasional dengan dokumen, stok, tagihan, dan jurnal. Pengguna perlu mengetahui tugas berikutnya, alasan transaksi tertahan, penanggung jawabnya, serta bukti pendukung setiap saldo.

| Hasil | Ukuran penerimaan produk |
|---|---|
| Saldo dapat ditelusuri | Setiap transaksi pilot yang diposting memiliki dokumen sumber, jurnal seimbang, dan riwayat pengguna |
| Piutang dapat ditindaklanjuti | Daftar outstanding per invoice, umur berdasarkan jatuh tempo, penanggung jawab penagihan dan riwayat pembayaran |
| Stok dan HPP konsisten | Kuantitas serta nilai persediaan dapat direkonsiliasi dengan buku besar; batch terlarang tidak dapat dialokasikan |
| Closing terpandu | Checklist dari rekonsiliasi sampai review dan penguncian periode; selisih tidak disembunyikan |
| Target terukur | Target memiliki periode, pemilik, metrik dan dasar realisasi yang eksplisit |
| Payroll dapat dijelaskan | Setiap komponen slip berasal dari aturan bertanggal efektif atau penyesuaian yang disetujui |

Angka peningkatan bisnis seperti penurunan DSO atau waktu proses belum memiliki baseline; ukur pada pilot sebelum menetapkan target persentase.

## 2. Pengguna dan tanggung jawab

Peran berikut adalah template yang dapat dikombinasikan untuk tim 6–12 orang, bukan daftar jabatan yang dipaksakan.

| Template peran | Tugas utama | Batas data penting |
|---|---|---|
| Pimpinan | Dashboard, kebijakan, approval, review closing | Biaya dan laporan sesuai otorisasi |
| Sales | Prospek, kunjungan, penawaran, pesanan, tindak lanjut tagihan | Pelanggan/area penugasan; payroll orang lain tertutup |
| Admin sales | Dokumen pesanan, harga, proforma, pengiriman/tukar faktur | Perubahan harga memerlukan hak khusus |
| Gudang | Penerimaan, karantina, locator, picking, packing, stok opname | Tidak otomatis boleh melihat harga modal |
| Purchasing | PR/PO, supplier, jadwal pengadaan | Approval pembelian/pembayaran dipisahkan |
| Finance/akuntansi | AR/AP, pembayaran, jurnal, rekonsiliasi, closing | Posting dan buka periode memiliki izin tersendiri |
| HR/payroll | Rekrutmen, kontrak, absensi, payroll, dashboard/laporan HRIS, resign | Data gaji dan identitas dibatasi |
| Karyawan | Permintaan, reimbursement, cuti, slip pribadi, aset pinjaman | Hanya data milik sendiri |
| Admin sistem | Akun, role, pengaturan operasional | Tidak otomatis memperoleh akses payroll dan posting |

## 3. Ruang lingkup produk lengkap

Enam modul utama mengikuti permintaan pengguna. **Pengadaan (kebutuhan persediaan, PR dan PO) berada di Warehouse & Logistik**, sesuai keputusan terbaru; tidak menambah modul utama Procurement. Finance menangani verifikasi tagihan, utang dan pembayaran. HR tetap mengelola kebutuhan operasional; akses pengadaan/persetujuannya mengikuti izin. Manajemen aset menghubungkan finance, administrasi, dan HRIS.

Produk memiliki web kantor Next.js + React dan aplikasi mobile Nuxt/Vue + Capacitor pada **Android 10+ dan iOS 15+**. Semua klien memakai satu NestJS API, PostgreSQL/Prisma, BullMQ/Redis, private S3 dan RBAC/scope. Mobile memprioritaskan tugas lapangan; P1 menyimpan transaksi online dan PWA/browser menjadi akses tambahan.

Kedua frontend menggunakan Tailwind CSS untuk tampilan, TanStack Query untuk data API, dan TanStack Table untuk tabel interaktif. Tabel operasional menyediakan filter, sort, pilihan kolom dan pagination sesuai izin. Total keuangan tetap dihitung server dari seluruh data yang memenuhi filter, bukan hanya baris yang sedang ditampilkan.

1. Sales & Marketing: prospek pada identitas Master Pelanggan yang sama, database Kontak dengan 11 atribut, beberapa peluang per institusi dan beberapa kebutuhan produk per prospek/peluang, aktivitas/follow-up, kunjungan HP, penawaran, referensi SP/PO pelanggan, SO, status pemenuhan dan tagihan. Kebutuhan boleh berupa kategori/uraian sebelum produk spesifik diketahui; pencatatan kebutuhan tidak mereservasi stok atau membuat PR. Pelanggan bertransaksi dihitung saat invoice pertama diposting. Sumber domain: [CRM Operasional](10-sales-marketing.md) dan [Sales Order-to-Cash](10-sales-marketing.md).
2. Warehouse & Logistik: kebutuhan persediaan, PR, perencanaan pembelian/konsolidasi, PO Supplier/Vendor, monitoring PO, penerimaan, kualitas, lokasi, batch, suhu, persediaan, FEFO/FIFO, pengiriman, retur, konsinyasi, recall, pemusnahan, serta pengeluaran/pengembalian sampel tertaut CRM. Sumber domain: [Warehouse & Logistik](11-warehouse-logistik.md).
3. Finance: verifikasi Tagihan Supplier/Vendor terhadap PO/penerimaan, AR/AP, pembayaran, kas/bank, akuntansi, pajak transaksi dan PPh Badan, anggaran/budget check, aset, biaya operasional, arsip dan closing. Pajak internal mengikuti [Pajak dan Kepatuhan Pajak](12-finance-administration.md); ekspor XML faktur pajak keluaran Coretax mengikuti [dokumen 38](12-finance-administration.md).
4. HRIS: kebutuhan tenaga, rekrutmen, kandidat, offer, onboarding, kontrak, kalender/shift, impor fingerprint, absensi dan koreksi, cuti/izin, lembur, rekap/cut-off, payroll, gaji, tunjangan/potongan, THR, BPJS, PPh 21, resign, offboarding, final pay, pengembalian aset dan reimbursement. Kandidat tidak menjadi karyawan sebelum konversi berizin. Akses dinonaktifkan melalui checklist/audit; aset dan final pay tidak menghapus histori. Catatan fingerprint menjadi sumber event; hasil kehadiran final berasal dari aturan bertanggal efektif dan review exception. Payroll memakai snapshot input dan rule version. Master karyawan/kontrak mengikuti [dokumen 34](13-hris.md).
5. Master Data: produk, satuan, NIE, channel, pelanggan, kredit, supplier, akun, pajak, gudang, pegawai dan parameter terkait. Sumber domain: [Master Data](14-master-data.md).
6. Setting: akun dan akses, persetujuan, nomor dokumen, periode, audit, impor/ekspor, backup dan notifikasi. Sumber domain: [Setting, IAM dan Konfigurasi](15-setting.md).

Kebijakan harga jual mengikuti [Harga Jual dan Margin](10-sales-marketing.md): biaya acuan/HPP terpisah, margin vs markup, pricelist bertanggal efektif, diskon dan exception per pelanggan/produk. Perluasan CRM yang diminta: pipeline bulanan dengan stage/persentase dari lampiran, Win berdasarkan PO/SP terverifikasi beserta alasan dan strategi maintain, Lost sisa karena tenggat; penawaran versi/masa berlaku, pengajuan harga/diskon per produk/pelanggan dan konversi parsial; kunjungan berizin atasan/foto wajib/perubahan/di luar rencana; tugas/pengingat; target penjualan net tanpa pajak/ongkir setelah diskon/retur; pengajuan sampel dan hasil trial.

Tracking sepanjang sesi kerja termasuk aplikasi tertutup memakai lokasi native. Nilai awal adalah 5 menit saat bergerak, 15 menit saat diam, raw point 90 hari dan ringkasan 1 tahun; seluruhnya editable melalui OPS-VIS pada Setting. Pilot memakai distribusi internal Android dan TestFlight iOS. Tracking production tetap menunggu proof-of-concept perangkat dan permission/privacy test lulus.

Tidak termasuk dalam rancangan awal: produksi, penjualan marketplace, integrasi bank/WhatsApp otomatis, koneksi langsung fingerprint, pengiriman API langsung/pelaporan otomatis ke Coretax, atau pengendalian cold room melalui perangkat IoT. Pembuatan file XML pajak keluaran untuk unggah manual termasuk lingkup. Aplikasi terpasang Android/iOS kini termasuk lingkup berdasarkan keputusan terbaru pengguna.

## 4. Versi dan urutan penggunaan

| Fase | Hasil | Cakupan |
|---|---|---|
| P0 — persiapan | Kebijakan serta sumber data teridentifikasi | Register keputusan, template master, inventarisasi saldo awal, COA, role |
| P1 — kandidat v1.0.0 pilot | Uji skenario lengkap menggunakan data uji fiktif | Akses, produk/UOM/batch, pelanggan/supplier, SO–kredit–stok, GR/PO sederhana, kirim/POD, invoice, AR/AP, penerimaan/pembayaran, jurnal, neraca saldo, checklist closing; target dan kunjungan dasar |
| P2 — penggunaan resmi bertahap | Transaksi nyata pada lingkup yang lulus pengujian | Saldo awal terverifikasi, rekonsiliasi bank, costing, laporan, review periodik, kontrol operasional yang diperlukan produk nyata |
| P3 — perluasan | Kelengkapan administrasi, SDM dan distribusi khusus | Payroll/rekrutmen, aset/anggaran lengkap, konsinyasi, recall/pemusnahan lengkap, forecasting, komisi, analitik |

P1 merupakan kandidat lingkup, bukan jaminan seluruh daftar selesai awal Oktober. Bila waktu tidak cukup, kurangi skenario/modul demo; jangan menonaktifkan kontrol jurnal, akses, atau stok untuk mengejar tanggal. Produk dengan kebutuhan suhu, karantina, recall atau izin khusus hanya masuk operasional resmi setelah kontrol terkait siap, walaupun modul tersebut berada di fase lanjut pada daftar umum.

## 5. Waktu

Target pengguna adalah uji coba pada awal Oktober 2026. Jendela kerja: 24–26 September finalisasi blueprint/data; 27–30 September implementasi prioritas; 1–7 Oktober demonstrasi dan uji skenario. Stack dan parameter blueprint sudah dipilih. Pilot mengutamakan alur kantor inti dan tugas mobile terbatas; penggunaan resmi mengikuti release gate dokumen 39.

## 6. Skenario demonstrasi minimum

1. Masukkan saldo uji fiktif produk beserta batch, nilai awal, lokasi, pelanggan dan limit kredit.
2. Buat dan ajukan SO; sistem memvalidasi data/aturan, kredit dan stok tanpa approval SO rutin. Simulasikan credit hold, pengajuan unlock, keputusan pihak yang dikonfigurasi, lalu evaluasi ulang yang menghormati pengecualian disetujui. Permintaan ditolak tetap terkunci; permintaan disetujui tetap melewati pemeriksaan stok.
3. Masukkan seluruh item/jumlah pesanan, termasuk stok kosong. Periksa stok setelah kredit lolos; alokasikan jumlah tersedia dengan FEFO; larang batch expired/karantina.
4. Terbitkan proforma/picking hanya dari alokasi tahap terkait, packing list/surat jalan dari aktual lolos checking; kirim parsial lalu catat POD. Peragakan sisa per item sebagai backorder atau ditutup, pemenuhan backorder berikutnya, dan pembatalan berdasarkan konfirmasi pelanggan tanpa menghapus histori/AR.
5. Terbitkan invoice untuk kuantitas diterima yang belum ditagih; catat pembayaran parsial; cocokkan AR dengan buku besar.
6. Buat PR/PO/GR, cocokkan invoice supplier, tahan selisih, lalu bayar invoice yang disetujui.
7. Periksa costing, jurnal, laba rugi/neraca dan checklist closing; saldo tidak seimbang memblokir close.
8. Catat kunjungan dan target contoh; realisasi berasal dari metrik yang ditentukan, bukan penjumlahan dokumen ganda.
9. Buat pelanggan baru dari SO dengan pemeriksaan duplikasi dan mode awal COD saat barang diterima selama tiga bulan berturut-turut; Finance dapat memilih bayar sebelum pengiriman. Sales melihat stok saat input; alokasi/proforma tersedia sebelum pembayaran, tetapi dispatch tertahan sampai dana tahap terkait terverifikasi. Peragakan fasilitas tempo hanya dapat ditetapkan pengguna berwenang dengan TOP dan limit lengkap.

## 7. Gerbang penggunaan resmi

- Saldo awal pada tanggal cut-over disetujui: stok per batch dan nilai, AR/AP per invoice, kas/bank, aset, kewajiban, ekuitas dan akun lainnya.
- Total subledger stock/AR/AP/bank cocok dengan akun kontrol GL; akun penyeimbang migrasi tidak memiliki selisih tanpa penyelesaian.
- Kebijakan D01–D05, D07–D08 dan aturan pajak relevan diputuskan serta diuji dengan contoh yang diketahui hasilnya.
- Semua skenario kritis lulus: akses, pembatalan, koreksi, pembayaran parsial, race condition, penguncian periode, restore backup.
- Staf terkait dapat melakukan pekerjaan dan menelusuri dokumen; ada penanggung jawab akuntansi yang meninjau hasil.
- Data uji fiktif berada di lingkungan terpisah dan tidak tercampur dalam saldo resmi.
- Untuk payroll: aturan dan data payroll diverifikasi melalui perbandingan perhitungan manual sebelum pembayaran pertama.

## 8. Risiko dan penanganan dalam produk

| Risiko nyata | Penanganan |
|---|---|
| Belum ada saldo awal | Wizard inventarisasi, staging impor, rekonsiliasi, status belum siap |
| Pengguna belum memahami closing | Checklist dengan pemilik, bukti, alasan selisih, dan urutan kerja |
| Peran rangkap dalam tim kecil | Role fleksibel, tindakan berisiko terpisah, review pengecualian |
| Dokumen berubah setelah posting | Reversal/koreksi, snapshot nilai/harga/UOM/pajak; larangan edit langsung |
| Harga keliru karena margin tertukar markup | Kalkulator transparan dan validasi harga otomatis; pelanggaran tertahan untuk perbaikan atau pengajuan unlock jika jenis alasannya diizinkan kebijakan |
| Waktu pengembangan singkat | Pilot dengan data uji fiktif, irisan vertikal kecil, pengujian finansial mendahului ekspansi fitur |

## 9. Keputusan lanjutan

Pimpinan menentukan approver/limit, target dan komisi. Finance menetapkan COA, aturan kredit, perpajakan dan tanggal cut-over. Gudang menetapkan kondisi simpan/shelf-life. HR menentukan komponen dan cut-off payroll. Pengembang menentukan hosting, versi package yang kompatibel dan perangkat/browser uji dalam stack yang sudah dipilih. Keputusan ini dicatat bertanggal, tidak disisipkan sebagai konstanta tanpa jejak.




