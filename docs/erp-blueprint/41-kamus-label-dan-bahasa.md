# Kamus Label Manusia dan Bahasa Layar

Status: keputusan final untuk penamaan yang tampil kepada pengguna. Dokumen ini melengkapi dokumen teknis; tidak mengubah nama tabel, kolom, endpoint, enum, atau kode policy yang menjadi kontrak implementasi. Istilah lintas domain dirinci pada [Matriks Label Lintas Dokumen](07-design.md).

## 1. Aturan bahasa

1. Semua label, judul kolom, pilihan, pesan validasi, status dan tombol pada layar pengguna memakai Bahasa Indonesia yang jelas dan konsisten.
2. Nama teknis seperti `OPS-WH-01`, `value_type`, `percent`, `over_receipt_tolerance`, `posted`, `UUID`, `JSON`, `API`, `GR`, `POD`, `FEFO` dan `FIFO` tidak boleh menjadi label utama.
3. Bila pengguna perlu melihat identitas teknis, tampilkan di bagian **Detail teknis** yang dapat dibuka, dengan label manusia tetap menjadi judul utama.
4. Jangan menampilkan pasangan teknis seperti `Mode: percent` atau `Value: 0`. Tampilkan **Cara menghitung: Persentase** dan **Batas tambahan: 0% (tidak ada kelonggaran)**.
5. Setiap atribut teknis memiliki tiga hal: label manusia, penjelasan singkat, dan satuan/format. Nilai kosong memakai `Belum diisi`; nilai nol dijelaskan sesuai arti bisnisnya.
6. Satu konsep memakai satu istilah. Gunakan `Penerimaan barang`, bukan campuran `GR`, `goods receipt`, dan `penerimaan`; gunakan `Bukti barang diterima`, bukan campuran `POD` dan `proof of delivery` pada layar utama.
7. Akronim boleh muncul setelah istilah manusia, misalnya **Bukti barang diterima (POD)**. Akronim teknis tanpa penjelasan tidak boleh menjadi pilihan tunggal.

## 2. Contoh perbaikan dari layar konfigurasi

| Tampilan yang tidak boleh dipakai | Label yang dipakai | Penjelasan untuk pengguna |
|---|---|---|
| `Value` | **Nilai kebijakan** | Nilai yang dipakai sistem untuk menjalankan aturan ini. |
| `Mode` | **Cara menghitung** | Cara sistem membaca nilai: persentase, jumlah barang, nominal, pilihan, atau durasi. |
| `percent` | **Persentase** | Ditulis dalam persen, misalnya `0%` atau `5%`. |
| `Value = 0` | **Batas tambahan: 0%** | Tidak ada kelonggaran di atas jumlah pada pesanan. |
| `over-receipt` | **Penerimaan melebihi pesanan** | Jumlah barang yang diterima lebih banyak daripada jumlah pada PO. |
| `tolerance` | **Kelonggaran yang diizinkan** | Selisih maksimum yang masih dapat diterima tanpa pemeriksaan khusus. |
| `qty` | **Jumlah barang** | Banyaknya barang dalam satuan yang dipilih. |
| `UOM` | **Satuan barang** | Satuan seperti pcs, box, botol, atau unit. |
| `exception` | **Perlu pemeriksaan** | Kondisi yang tidak dapat diproses otomatis dan harus ditinjau. |
| `posted` | **Sudah dibukukan** | Transaksi sudah dicatat resmi dan tidak dapat diedit langsung. |
| `active/inactive` | **Aktif/Nonaktif** | Menentukan apakah pilihan masih dapat digunakan untuk transaksi baru. |
| `effective date` | **Mulai berlaku** | Tanggal saat aturan mulai dipakai. |
| `fallback` | **Pengganti bila tidak tersedia** | Pengguna atau aturan yang dipakai bila penanggung jawab utama tidak tersedia. |

## 3. Label manusia untuk katalog Kebijakan Operasional

Kolom **Kode teknis** hanya untuk admin, audit, API dan dokumentasi. Kolom **Label pada layar** adalah label utama pada Setting.

| Kode teknis | Label pada layar | Arti singkat |
|---|---|---|
| OPS-COMP-01 (dihentikan 24 Okt 2026) | Zona waktu perusahaan | Zona waktu yang dipakai untuk tanggal dan batas waktu bisnis. |
| OPS-COMP-02 (dihentikan 24 Okt 2026) | Awal tahun buku | Bulan dan tanggal dimulainya tahun pembukuan. |
| OPS-COMP-03 (dihentikan 24 Okt 2026) | Mata uang perusahaan | Mata uang utama untuk pencatatan transaksi. |
| OPS-FIN-01 | Dasar penentuan jatuh tempo tagihan pemasok | Tanggal yang menjadi awal perhitungan batas pembayaran. |
| OPS-FIN-02 | Kelonggaran jumlah saat pencocokan | Selisih jumlah barang yang masih boleh diterima saat mencocokkan dokumen. |
| OPS-FIN-03 | Kelonggaran harga saat pencocokan | Selisih harga yang masih boleh diterima saat mencocokkan dokumen. |
| OPS-FIN-04 | Batas pembulatan tagihan | Selisih pembulatan maksimum yang boleh dibukukan. |
| OPS-FIN-05 | Dasar pembagian biaya tambahan barang | Dasar pembagian ongkos atau biaya tambahan ke barang. |
| OPS-FIN-06 | Lama penyimpanan pesanan setelah pembayaran di muka | Lama reservasi sebelum pesanan yang belum diproses dilepas. |
| OPS-FIN-07 | Syarat penggabungan bukti barang diterima ke tagihan | Kondisi agar beberapa bukti penerimaan dapat digabung ke satu tagihan. |
| OPS-FIN-08 | Kelompok umur piutang dan utang | Rentang hari untuk mengelompokkan tagihan berdasarkan keterlambatan. |
| OPS-WH-01 | Kelonggaran penerimaan melebihi pesanan | Jumlah tambahan yang masih boleh diterima di atas PO. |
| OPS-WH-02 | Cara memilih kelompok barang | Urutan pemilihan batch berdasarkan kedaluwarsa atau urutan masuk. |
| OPS-WH-03 | Urutan pembagian stok ke pesanan | Prioritas yang dipakai saat stok dibagi ke pesanan. |
| OPS-WH-04 | Awalan nomor master | Huruf awal nomor produk, pelanggan, pemasok, karyawan, atau aset. |
| OPS-WH-05 | Daftar data wajib per kondisi | Data yang wajib diisi sesuai jenis, saluran, atau kategori. |
| OPS-CRM-01 | Waktu penutupan peluang | Kapan peluang yang belum selesai ditutup dan alasan yang dicatat. |
| OPS-CRM-02 | Periode pelanggan dianggap aktif | Jangka waktu transaksi yang dipakai untuk menentukan pelanggan aktif. |
| OPS-CRM-03 | Cara menghitung pencapaian yang makin tinggi makin baik | Rumus pencapaian target ketika angka lebih tinggi berarti lebih baik. |
| OPS-CRM-04 | Cara menghitung pencapaian yang makin rendah makin baik | Rumus pencapaian target ketika angka lebih rendah berarti lebih baik. |
| OPS-CRM-05 | Gabungan beberapa indikator kinerja | Apakah beberapa indikator digabung menjadi satu nilai. |
| OPS-VIS-01 | Jarak maksimal saat mulai kunjungan | Jarak dari lokasi tujuan yang masih dianggap berada di tempat kunjungan. |
| OPS-VIS-02 | Jumlah foto minimum | Jumlah foto bukti paling sedikit yang harus dilampirkan. |
| OPS-VIS-03 | Jeda pencatatan lokasi saat bergerak | Jarak waktu pencatatan lokasi ketika pengguna bergerak. |
| OPS-VIS-04 | Jeda pencatatan lokasi saat diam | Jarak waktu pencatatan lokasi ketika pengguna diam. |
| OPS-VIS-05 | Lama penyimpanan titik lokasi | Lama titik lokasi mentah disimpan. |
| OPS-VIS-06 | Lama penyimpanan ringkasan rute | Lama ringkasan perjalanan disimpan. |
| OPS-HR-01 | Batas pengajuan uang muka perjalanan | Paling lambat berapa hari sebelum perjalanan pengajuan dibuat. |
| OPS-HR-02 | Batas penyelesaian uang muka | Batas waktu penyelesaian uang muka setelah perjalanan. |
| OPS-HR-03 | Tanggal penutupan pengajuan biaya | Tanggal bulanan untuk menutup pengajuan biaya. |
| OPS-HR-04 | Batas biaya perjalanan | Nilai maksimum biaya menurut kategori dan wilayah. |
| OPS-HR-05 | Batas durasi uang harian | Durasi perjalanan yang menentukan persentase uang harian. |
| OPS-HR-06 | Lama penyimpanan data kandidat | Lama data kandidat disimpan sebelum dianonimkan atau dihapus. |
| OPS-HR-07 | Lama penyimpanan arsip karyawan | Lama arsip karyawan disimpan setelah tidak bekerja. |
| OPS-SYS-01 | Waktu pembaruan ringkasan operasional | Batas waktu pembaruan data ringkasan pada layar. |
| OPS-SYS-02 | Batas penyamaran laporan HR kelompok kecil | Jumlah orang minimum agar angka kelompok dapat ditampilkan. |
| OPS-SYS-03 | Masa berlaku file hasil ekspor | Lama file ekspor dapat diunduh sebelum kedaluwarsa. |
| OPS-SYS-04 | Lama penyimpanan transaksi dan dokumen penting | Lama data transaksi, keuangan, pajak, dan stok disimpan. |
| OPS-SYS-05 | Lama penyimpanan catatan keamanan | Lama catatan keamanan dan sesi pengguna disimpan. |
| OPS-SYS-06 | Batas pengingat persetujuan | Waktu tunggu sebelum pengingat persetujuan dikirim. |
| OPS-SYS-07 | Batas eskalasi persetujuan | Waktu tunggu sebelum persetujuan diteruskan ke penanggung jawab berikutnya. |

## 4. Aturan lintas Database, API, dan UI

- Nama tabel, kolom, endpoint, JSON, UUID, tipe data, enum, indeks, kunci asing, versi, hash dan status teknis tetap boleh dipakai di dokumen Database/API.
- Setiap field teknis yang disebut dalam dokumen Database/API harus memiliki pasangan **Label pengguna** dan **Arti bisnis** pada bagian atau tabel yang sama bila field tersebut akan muncul di UI, laporan, ekspor, atau pesan kesalahan.
- Contoh payload wajib memisahkan nama teknis dari contoh tampilan. Contoh tampilan tidak boleh menyalin `snake_case`, kode enum, `null`, `true/false`, atau angka desimal tanpa satuan.
- Database menyimpan nilai presisi dan kode; UI menampilkan format lokal, satuan, status dan penjelasan yang mudah dipahami. Terjemahan label tidak mengubah kontrak data.
- Status teknis yang memiliki dampak bisnis harus diterjemahkan, misalnya `draft` → **Draf**, `active` → **Aktif**, `blocked` → **Tertahan**, `reversed` → **Dibatalkan melalui pembalikan**, dan `pending_review` → **Menunggu pemeriksaan**.

## 5. Checklist audit sebelum rilis

1. Tidak ada label utama berupa kunci database, kode `OPS-*`, enum, nama endpoint, atau campuran Indonesia-Inggris.
2. Setiap angka memiliki satuan dan penjelasan arti nol, kosong, batas minimum, dan batas maksimum.
3. Setiap pilihan menjelaskan dampaknya dalam bahasa kerja pengguna.
4. Istilah yang sama konsisten di Design, User Flow, API error, laporan, ekspor dan dokumen cetak.
5. Detail teknis tetap tersedia untuk admin/audit melalui bagian **Detail teknis**, tanpa mengganggu alur kerja staf.


---

## Bagian asal: 07-design.md\n