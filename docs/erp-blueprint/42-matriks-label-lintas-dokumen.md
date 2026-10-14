# Matriks Label Lintas Dokumen

Status: wajib dipakai untuk seluruh layar, laporan, ekspor, dokumen cetak, notifikasi, validasi dan pesan error. Nama teknis tetap dipakai di Database/API sebagai kontrak program, tetapi tidak boleh tampil sebagai label utama.

## 1. Aturan penerapan

1. Penulis requirement, domain, User Flow, Design, Database dan API menggunakan kolom **Label manusia** saat menjelaskan pengalaman pengguna.
2. Kolom **Nama teknis** hanya digunakan untuk kontrak data, contoh payload, SQL, audit, integrasi dan bagian **Detail teknis**.
3. Bila istilah tidak ada di matriks, gunakan kata kerja Bahasa Indonesia yang menjelaskan dampaknya, lalu tambahkan pasangan istilahnya ke dokumen ini sebelum rilis.
4. Akronim ditulis setelah istilah manusia pada kemunculan pertama: **Penerimaan barang (GR)**, **Bukti barang diterima (POD)**, **Bagan akun (CoA)**.
5. Angka selalu memiliki satuan dan arti. `0` tidak boleh tampil sendirian bila berarti tidak ada kelonggaran, tidak ada saldo, atau belum ada data.

## 2. Data umum, audit dan versi

| Nama teknis | Label manusia | Arti pada layar |
|---|---|---|
| `id`, `uuid` | Nomor sistem | Identitas internal, hanya pada Detail teknis. |
| `company_id` | Perusahaan | Perusahaan tempat data berlaku. |
| `created_at` | Dibuat pada | Waktu data pertama kali dibuat. |
| `created_by` | Dibuat oleh | Pengguna yang membuat data. |
| `updated_at` | Terakhir diubah | Waktu perubahan terakhir. |
| `updated_by` | Diubah oleh | Pengguna yang mengubah data terakhir. |
| `version`, `version_no` | Versi data/aturan | Urutan perubahan untuk memastikan data tidak tertimpa. |
| `effective_from` | Mulai berlaku | Tanggal dan waktu aturan mulai digunakan. |
| `effective_to` | Berakhir pada | Tanggal dan waktu aturan berhenti digunakan. |
| `state` | Status | Keadaan data saat ini. Pilihan dijelaskan dengan kata kerja pengguna. |
| `active` | Aktif | Masih dapat dipilih untuk data baru. |
| `inactive` | Nonaktif | Tidak dapat dipakai untuk data baru, histori tetap terlihat. |
| `reason` | Alasan | Penjelasan wajib atas perubahan atau pengecualian. |
| `audit` / `audit_event` | Riwayat aktivitas | Catatan siapa melakukan apa dan kapan. |
| `snapshot` | Salinan saat transaksi | Nilai yang disimpan agar dokumen lama tidak berubah. |
| `hash` | Sidik data | Pemeriksaan bahwa isi tidak berubah; hanya Detail teknis. |

## 3. Alur kerja, persetujuan dan hak akses

| Nama teknis | Label manusia | Arti pada layar |
|---|---|---|
| `draft` | Draf | Belum diajukan atau belum diterbitkan. |
| `submitted` | Diajukan | Menunggu pemeriksaan atau keputusan. |
| `pending` | Menunggu keputusan | Belum ada keputusan dari pihak berwenang. |
| `approved` | Disetujui | Sudah mendapat keputusan yang diperlukan. |
| `rejected` | Ditolak | Tidak disetujui dan harus diperbaiki atau dihentikan. |
| `needs_revision` | Perlu diperbaiki | Dikembalikan untuk dilengkapi atau diperbaiki. |
| `blocked` | Tertahan | Tidak dapat dilanjutkan karena syarat belum terpenuhi. |
| `exception` | Perlu pemeriksaan | Tidak dapat diproses otomatis dan memerlukan peninjauan. |
| `posted` | Sudah dibukukan | Sudah dicatat resmi; tidak boleh diedit langsung. |
| `issued` | Sudah diterbitkan | Dokumen resmi sudah dikeluarkan. |
| `reversed` | Dibatalkan melalui pembalikan | Koreksi resmi yang membuat transaksi asal tidak berlaku tanpa menghapus histori. |
| `voided` | Dibatalkan | Dokumen dibatalkan dengan jejak audit. |
| `assignee` | Penanggung jawab | Pengguna yang harus melakukan tindakan. |
| `approver` | Pemberi persetujuan | Pengguna yang berwenang menyetujui atau menolak. |
| `scope` | Cakupan data | Batas perusahaan, unit, gudang, wilayah, atau portofolio yang boleh dilihat/dikerjakan. |
| `limit` | Batas kewenangan | Nilai maksimum yang boleh diputuskan pengguna. |
| `fallback` | Pengganti bila tidak tersedia | Penanggung jawab berikutnya bila pihak utama tidak dapat bertindak. |
| `quorum` | Jumlah persetujuan minimum | Banyaknya persetujuan yang diperlukan. |
| `self_approval` | Persetujuan atas pengajuan sendiri | Apakah pengaju boleh menyetujui pengajuannya sendiri. |
| `delegation` | Pelimpahan tugas | Penyerahan tugas sementara kepada pengguna lain. |
| `reminder` | Pengingat | Pemberitahuan sebelum atau saat batas waktu terlewati. |
| `escalation` | Penerusan ke penanggung jawab berikutnya | Tindakan saat keputusan melewati batas waktu. |

## 4. Keuangan, pajak dan laporan

| Nama teknis | Label manusia | Arti pada layar |
|---|---|---|
| `AR` / `accounts_receivable` | Piutang pelanggan | Tagihan yang belum dibayar pelanggan. |
| `AP` / `accounts_payable` | Utang pemasok/vendor | Tagihan yang harus dibayar perusahaan. |
| `aging` | Umur tagihan | Kelompok tagihan berdasarkan jumlah hari sejak jatuh tempo. |
| `past_due` | Lewat jatuh tempo | Tagihan yang belum dibayar setelah tanggal jatuh tempo. |
| `outstanding` | Sisa tagihan | Nilai yang masih harus dibayar. |
| `unbilled` | Sudah diterima tetapi belum ditagih | Barang/jasa sudah diterima, invoice belum dicatat. |
| `unallocated` | Belum dialokasikan | Dana sudah diterima tetapi belum dipasangkan ke tagihan. |
| `matching` | Pencocokan dokumen | Pemeriksaan kesesuaian PO, penerimaan dan invoice. |
| `tolerance` | Kelonggaran yang diizinkan | Selisih maksimum yang masih dapat diterima. |
| `landed_cost` | Biaya tambahan barang | Ongkos atau biaya lain yang dibagikan ke nilai barang. |
| `settlement` | Penyelesaian uang muka/biaya | Pencocokan uang muka dengan bukti dan biaya aktual. |
| `opening_balance` | Saldo awal | Nilai yang dibawa dari periode atau sistem sebelumnya. |
| `debit` | Debet | Sisi kiri pencatatan jurnal. |
| `credit` | Kredit | Sisi kanan pencatatan jurnal. |
| `general_ledger` / `GL` | Buku besar | Kumpulan pencatatan akun yang sudah dibukukan. |
| `chart_of_accounts` / `CoA` | Bagan akun | Daftar akun yang dipakai untuk pencatatan. |
| `tax_profile` | Profil pajak | Status dan identitas pajak pihak terkait. |
| `tax_rule` | Aturan pajak | Ketentuan tarif, dasar pengenaan dan waktu pajak. |
| `withholding` | Pajak yang dipotong/dipungut | Pajak yang dipotong atau dipungut oleh pihak sesuai ketentuan. |
| `DPP` | Dasar pengenaan pajak | Nilai yang menjadi dasar penghitungan pajak. |
| `as_of` / `data_as_of` | Data per tanggal | Tanggal dan waktu yang menjadi batas data laporan. |
| `freshness` | Terakhir diperbarui | Umur data laporan sejak pembaruan terakhir. |
| `drill_down` | Buka rincian | Membuka transaksi sumber dari angka ringkasan. |

## 5. Penjualan, gudang dan logistik

| Nama teknis | Label manusia | Arti pada layar |
|---|---|---|
| `SO` / `sales_order` | Pesanan penjualan | Pesanan pelanggan yang diproses perusahaan. |
| `PO` / `purchase_order` | Pesanan pembelian | Pesanan perusahaan kepada pemasok/vendor. |
| `PR` / `purchase_request` | Permintaan pembelian | Permintaan internal sebelum pesanan pembelian dibuat. |
| `GR` / `goods_receipt` | Penerimaan barang | Catatan barang yang diterima dari pemasok atau retur. |
| `POD` / `proof_of_delivery` | Bukti barang diterima | Bukti pelanggan menerima barang. |
| `dispatch` | Pengeluaran untuk pengiriman | Konfirmasi barang keluar dari gudang menuju tujuan. |
| `transit` | Dalam perjalanan | Barang sudah keluar gudang dan belum diterima tujuan. |
| `backorder` | Sisa pesanan | Jumlah pesanan yang belum dapat dipenuhi. |
| `locator` | Lokasi penyimpanan | Tempat fisik barang di gudang. |
| `batch` | Kelompok produksi | Kelompok barang dengan nomor produksi dan kedaluwarsa yang sama. |
| `FEFO` | Kedaluwarsa terdekat lebih dulu | Cara memilih barang dengan tanggal kedaluwarsa paling dekat. |
| `FIFO` | Barang yang masuk lebih dulu | Cara memilih barang berdasarkan urutan penerimaan. |
| `quarantine` | Karantina | Lokasi/status barang yang belum boleh dijual atau dipakai. |
| `recall` | Penarikan barang | Penghentian dan penarikan barang karena masalah mutu atau izin. |
| `short_receipt` | Penerimaan kurang | Jumlah diterima lebih sedikit daripada dokumen pesanan. |
| `over_receipt` | Penerimaan melebihi pesanan | Jumlah diterima lebih banyak daripada dokumen pesanan. |
| `allocation` | Pembagian stok ke pesanan | Penetapan stok tertentu untuk memenuhi pesanan. |
| `reservation` | Cadangan stok | Stok yang ditahan untuk pesanan tertentu. |
| `quality_hold` | Tertahan untuk pemeriksaan mutu | Barang belum dapat digunakan sampai hasil pemeriksaan keluar. |

## 6. CRM, HRIS dan perangkat

| Nama teknis | Label manusia | Arti pada layar |
|---|---|---|
| `lead` | Prospek | Calon pelanggan atau peluang awal. |
| `opportunity` | Peluang penjualan | Kesempatan penjualan yang sedang dikelola. |
| `stage` | Tahap | Posisi data dalam alur kerja. |
| `confidence` | Tingkat keyakinan | Perkiraan kemungkinan peluang menjadi pesanan. |
| `check_in` | Mulai kunjungan | Pencatatan kedatangan di lokasi tujuan. |
| `check_out` | Selesai kunjungan | Pencatatan berakhirnya kunjungan. |
| `telemetry` | Data lokasi perangkat | Data lokasi dan kondisi pengiriman dari perangkat. |
| `stale` | Tidak diperbarui | Data sudah melewati batas umur yang dianggap layak. |
| `cash_advance` | Uang muka perjalanan | Dana yang diberikan sebelum perjalanan. |
| `payroll` | Penggajian | Proses menghitung dan membayar penghasilan karyawan. |
| `earning` | Penghasilan | Komponen yang menambah gaji. |
| `deduction` | Potongan | Komponen yang mengurangi gaji. |
| `employer_liability` | Kewajiban perusahaan | Komponen yang menjadi kewajiban perusahaan. |
| `cut_off` | Tanggal penutupan perhitungan | Batas data yang masuk ke proses periode tersebut. |
| `parallel_run` | Perhitungan pembanding | Perhitungan sistem yang dibandingkan dengan hitungan manual. |
| `onboarding` | Penyiapan karyawan baru | Proses menyiapkan karyawan sebelum mulai bekerja. |
| `offboarding` | Proses keluar karyawan | Proses serah terima dan penutupan akses saat karyawan keluar. |

## 7. API dan format teknis

| Nama teknis | Label manusia | Aturan tampilan |
|---|---|---|
| `snake_case` | Nama teknis sistem | Tidak ditampilkan sebagai label pengguna. |
| `payload` | Data permintaan | Pada layar disebut data yang dikirim, bukan payload. |
| `endpoint` | Alamat layanan | Hanya Detail teknis/API. |
| `GET` | Lihat data | Tombol memakai “Lihat”, “Muat”, atau “Buka”. |
| `POST` | Buat/kirim/proses | Tombol memakai tindakan bisnis yang spesifik. |
| `PATCH` | Ubah sebagian data | Tidak ditampilkan kepada pengguna. |
| `DELETE` | Hapus | Hanya digunakan bila aturan bisnis memang mengizinkan penghapusan. |
| `null` | Belum diisi | Tidak ditampilkan sebagai `null`. |
| `true` / `false` | Ya / Tidak atau Aktif / Nonaktif | Pilih istilah sesuai arti field. |
| `401` | Sesi berakhir | Minta pengguna masuk kembali. |
| `403` | Tidak memiliki izin | Jelaskan bahwa pengguna tidak berwenang. |
| `404` | Data tidak ditemukan | Gunakan kalimat kerja, bukan kode HTTP. |
| `409` | Data berubah atau terjadi benturan | Minta pengguna memuat ulang dan meninjau perubahan. |
| `422` | Data belum memenuhi aturan | Tampilkan field dan perbaikannya. |
| `500` | Sistem mengalami gangguan | Tampilkan tindakan coba lagi dan nomor pelacakan bila tersedia. |

## 8. Kewajiban audit

Setiap perubahan dokumen yang menambah field, status, parameter, laporan, ekspor, endpoint, atau pesan error harus:

1. menambahkan pasangan nama teknis dan label manusia ke matriks ini bila belum ada;
2. memakai label manusia pada [Design](07-design.md), [User Flow](06-user-flow.md), Requirements dan dokumen domain;
3. menyimpan nama teknis hanya pada [Database](03-database.md), [API](04-api.md), contoh payload, audit atau Detail teknis;
4. menjalankan `./tools/validate-repository.ps1` dan memeriksa pencampuran istilah pada layar yang berubah.\n