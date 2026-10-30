# Sales Order mudah dipakai, matrix hak akses pohon, dan pindah locator — desain

Tanggal: 25 Oktober 2026. Status: **draf menunggu persetujuan pengguna**. Keputusan pengguna di bawah sudah final; pendekatan **A** dipilih pengguna (lihat bagian Pendekatan). Ukuran: proyek (enam bagian). Belum ada kode yang diubah.

Acuan pembanding: aplikasi Kledo yang dipakai pengguna (Pengaturan › Alur Bisnis, Penjualan › Pemesanan, Pengaturan › Peran). Kledo hanya contoh pola UI; blueprint tetap mengatur fungsi dan invariant bisnis.

## Maksud

Pengguna merasa hampir semua UX transaksi evflow menyulitkan: tampilan tidak terasa seperti faktur, istilah dan kalimat teknis sistem membingungkan, dan isian terlalu banyak. evflow harus semudah ERP SaaS seperti Kledo. Pekerjaan dimulai dari Sales Order, lalu matrix hak akses dan pindah locator yang dibutuhkan alur SO.

## Sasaran

1. Daftar SO yang langsung terbaca seperti daftar faktur.
2. Form SO bergaya faktur padat dengan isian wajib minimal.
3. Detail SO yang menjawab tiga pertanyaan pengguna: barang apa yang belum terpenuhi, dokumen (terutama invoice) apa saja yang terbentuk, dan apa langkah berikutnya.
4. Dokumen turunan (Proforma, Pick Slip, Surat Jalan, Invoice) dapat dibuat dari SO sesuai izin orang yang membuka.
5. Matrix hak akses berbentuk pohon centang berbahasa awam.
6. Kekurangan stok karena barang berada di locator lain dapat ditindaklanjuti dari form SO.

## Bukan sasaran

- Mengubah urutan pemenuhan, posting, atau invariant stok/kredit/pajak.
- Melonggarkan izin backend; pemisahan izin per submenu tetap berlaku.
- Modul Field (ditunda).
- Pola per pasangan pelanggan × produk.

## Anti-sasaran (gagal walau berfungsi)

- Layar masih memakai kalimat teknis seperti "server memeriksa…", "snapshot", "dialokasikan", "backorder", "evaluasi".
- Pengguna harus membaca tiga badge status untuk mengetahui posisi SO.
- Tombol tampil bagi pengguna yang tidak berhak; atau harga hanya disembunyikan di layar padahal tetap dikirim server.
- Stok diambil diam-diam dari locator/gudang yang tidak dipilih, atau saldo stok diedit langsung untuk memenuhi SO.
- Hak peran lama bertambah diam-diam saat matrix diubah tampilannya.

## Keputusan pengguna (25 Oktober 2026)

### Daftar SO

- Kolom meniru daftar Pemesanan Kledo: **Nomor, Pelanggan, No. SP (referensi), Tanggal, Jatuh Tempo, Status, DP, Total**.
- Filter status berupa **tab** yang langsung terlihat, bukan dropdown.
- **Status tunggal** menggantikan tiga badge (status pesanan, pemenuhan, sisa):

| Status | Arti |
|---|---|
| Draft | Belum diajukan |
| Menunggu Persetujuan | Hanya bila aturan persetujuan SO aktif dan cocok |
| Open | Aktif; belum ada barang dikirim |
| Dikirim Sebagian | Sebagian barang dikirim; sisanya belum (termasuk karena stok kurang) |
| Dalam Pengiriman | Semua barang dikirim, belum semua diterima pelanggan |
| Selesai | **Semua barang diterima pelanggan (POD)**, atau sisanya ditutup |
| Dibatalkan | SO dibatalkan |

- SO **tidak** menunggu invoice atau pembayaran untuk Selesai; status tagihan berada di halaman Tagihan.
- Bila pelanggan menerima lebih sedikit dari yang dikirim (ditolak/kurang), **kekurangan menjadi sisa yang harus dikirim ulang**; SO belum Selesai sampai sisa tersebut diterima atau ditutup.
- **DP** = uang muka pelanggan yang telah diterima dan diverifikasi Finance serta dikaitkan ke SO; hanya ditampilkan (baca lintas modul), bukan isian SO. Saat ini penerimaan pelanggan terkait melalui batch pemenuhan, sehingga DP = jumlah penerimaan berstatus POSTED pada batch milik SO. *(keputusan pembangun)*
- Nama "Dalam Pengiriman" adalah usulan dan dapat diganti pengguna.

Keputusan pembangun (dapat dikoreksi pengguna):

- "Dikirim" = Surat Jalan telah dikirim (stok pindah ke dalam perjalanan), bukan sekadar Packing List terbit.
- SO yang tertahan pengecualian kredit ikut berstatus **Menunggu Persetujuan**, karena sejak 24 Oktober 2026 pengecualian kredit melalui mesin persetujuan umum.
- Status tunggal diturunkan dari fakta pemenuhan dengan aturan tunggal di backend; filter tab dan paging dilakukan di server. Cara penyimpanan (dihitung saat baca atau kolom yang diperbarui command) diputuskan pada rencana implementasi.

### Form SO

- Pola **faktur padat** (dipilih dari dua mockup): satu kartu; kepala faktur di atas (Pelanggan, Nomor otomatis, Tanggal, Termin, Jatuh Tempo, No. SP, Sales, Gudang, Kirim ke), tabel barang (Produk, Qty, Satuan, Harga, Diskon, Pajak, Jumlah) di tengah, total di kanan bawah. Catatan, lampiran, diskon tambahan dan ongkos kirim di balik tautan "+".
- Isian wajib bawaan: **pelanggan, tanggal, barang** (jumlah dan harga per baris).
- **No. SP pelanggan dan lampiran opsional secara bawaan**; Setting menyediakan sakelar "No. SP wajib diisi" dan "Lampiran wajib diisi". Backend menegakkan sakelar tersebut.
- **Alamat kirim** terisi otomatis dari alamat kirim utama pelanggan; perubahan hanya untuk SO itu.
- **Tanggal SO** bawaan hari ini dan dapat diubah. **SO boleh dicatat dengan tanggal di periode akuntansi yang sudah dikunci**, karena SO tidak memposting jurnal; form hanya menampilkan peringatan "Tanggal ini berada di periode yang sudah ditutup buku". Penguncian periode tetap ditegakkan saat transaksi turunan diposting (Surat Jalan, Invoice, uang muka, dan dokumen berjurnal lain) dengan tanggal masing-masing. *(keputusan pengguna 25 Oktober 2026)*
- **Termin** terisi dari termin bawaan pelanggan dan dapat diganti (keputusan 24 Oktober). **Jatuh tempo di SO adalah perkiraan** (tanggal SO + termin) dan diberi label demikian; jatuh tempo resmi tetap tanggal terbit invoice + termin (keputusan 21 Oktober). *(keputusan pembangun)*
- **Sales** terisi dari PIC sales pelanggan dan dapat diganti (master pelanggan belum memiliki isian PIC sales berupa pengguna; sampai isian itu ada, bawaan = pembuat SO); menjadi pemilik data untuk batasan "data milik sales lain" dan dipakai laporan penjualan. Tidak menjadi dasar komisi dalam pekerjaan ini. *(keputusan pembangun)*
- **Gudang** wajib ada di SO (keputusan pengguna). Bawaan dari gudang bawaan di Setting. Bila perusahaan hanya memiliki satu gudang, isian terisi otomatis dan tidak ditampilkan. Sakelar Setting "Gudang per barang" (bawaan mati) mengizinkan gudang per baris. Alokasi tetap FEFO/FIFO, hanya dari gudang yang dipilih.
- Bahasa layar memakai istilah faktur sehari-hari. Peringatan (stok kurang, limit kredit) muncul singkat di baris/saat Simpan.

### Stok kurang dan pindah locator

- Kekurangan stok memberi **peringatan** pada baris barang; stok tidak diambil dari gudang/locator lain secara diam-diam.
- Penyebab umum di perusahaan pengguna: barang berada di **locator lain dalam gudang yang sama**. Pengguna memakai satu gudang dengan locator berkode:

| Kode pengguna | Jenis evflow | Tersedia untuk SO |
|---|---|---|
| 00 Persediaan | STORAGE | Ya |
| 01 Intransit | TRANSIT | Tidak |
| 02 Penerimaan | RECEIVING | Tidak — perlu dipindah ke 00 |
| 03 Pengeluaran | DISPATCH | Ya |
| 04 Karantina (rusak/retur/ED) | QUARANTINE | Tidak — harus lolos pemeriksaan mutu |

- Dari form SO pengguna dapat **mengajukan pindah locator** (mis. 02 Penerimaan → 00 Persediaan) untuk jumlah kekurangan. Pengajuan masuk daftar tugas Gudang, dapat memakai mesin persetujuan umum, dieksekusi petugas gudang setelah barang dipindah fisik, dan menghasilkan pergerakan stok yang diaudit. Setelah itu kekurangan SO dialokasikan ulang.
- Stok di Karantina tidak dapat diminta pindah dari SO.
- **Mutu saat pindah** (keputusan pengguna 25 Oktober 2026, pilihan A; praktik pengguna: barang di Penerimaan wajib diperiksa sebelum masuk 00 Persediaan): lot berstatus mutu belum diperiksa boleh diajukan pindah. Saat konfirmasi pindah, keputusan mutu **wajib** diambil di layar yang sama oleh pengguna yang juga memegang izin Kelayakan Stok. **Lolos** → lot pindah ke locator tujuan berstatus Tersedia, lalu kekurangan SO dialokasikan ulang. **Tahan** → lot tidak dipindah, tetap di locator asal berstatus Ditahan, pengajuan ditutup "Ditahan mutu" dengan alasan. *(perilaku Tahan: keputusan pembangun)* Lot yang sudah Tersedia di locator non-jual dipindah tanpa keputusan mutu ulang.
- SO tetap dapat disimpan dengan peringatan; barang yang stoknya cukup berjalan lebih dulu (blueprint: kekurangan satu barang tidak menahan barang lain). *(keputusan pembangun)*
- Pindah locator adalah submenu Warehouse tersendiri dengan izin per tindakan. Mesin persetujuan umum belum ada di kode; sampai tersedia, pengajuan tidak memakai persetujuan dan kontrolnya adalah konfirmasi petugas gudang berizin. *(keputusan pembangun)* Setelah pindah dikonfirmasi, kekurangan SO terkait dialokasikan ulang otomatis. Jumlah pada pengajuan yang masih menunggu tidak direservasi; pengajuan ganda untuk lot yang sama ditampilkan sebagai peringatan. *(keputusan pembangun)*
- SO terbuka yang sudah ada tetap memakai alokasi yang sudah terbentuk; alokasi berikutnya memakai gudang bawaan. Perusahaan pengguna hanya memiliki satu gudang. *(keputusan pembangun)*
- Catatan: evflow belum memiliki transaksi pindah locator (put-away/relokasi) maupun pengajuan penyesuaian stok; ini fitur Warehouse baru.

### Detail SO

- Tabel barang empat kolom utama: **Dipesan · Diterima pelanggan · Sisa · Status baris**; baris bersisa di atas dan diberi warna; angka rinci (teralokasi, dikirim, ditutup) saat baris dibuka.
- Panel **Dokumen terkait**: Proforma, Pick Slip, Packing List, Surat Jalan, POD, Invoice dengan nomor, tanggal, status dan nilai; nomor dapat diklik.
- Satu tombol utama mengikuti langkah berikutnya, ditambah **Buat ▾** (Proforma, Pick Slip, Surat Jalan, Invoice).
- Tombol yang tidak diizinkan untuk pengguna **disembunyikan**. Tombol abu-abu dengan alasan singkat hanya untuk hambatan alur.
- "Buat Surat Jalan" dari SO membuka Pick Slip yang siap; tahapan pengambilan dan pemeriksaan barang tidak dilompati.
- Pembuat dokumen bervariasi (satu admin, gudang dan finance, atau pemilik) tergantung izin yang diberikan; layar mengikuti izin efektif.
- Invoice mengikuti keputusan 21 Oktober 2026: dibuat dari Packing List yang telah diterbitkan, tanpa menunggu Surat Jalan/POD.

Pola Kledo (Detil Pemesanan) yang dipakai — keputusan pengguna 25 Oktober 2026:

- Kepala: judul "Sales Order {nomor}", satu status berwarna, tombol **Cetak**, **Aksi ▾** (pembuatan dokumen turunan dan Tutup sisa, sesuai izin), dan **⋮** (Ubah, Duplikat, Riwayat). Navigasi ‹ › ke SO sebelum/sesudah. *(isi menu ⋮ dan navigasi: keputusan pembangun)*
- Data kepala: Pelanggan (tautan) + alamat kirim, Nomor, Tanggal, Jatuh tempo (perkiraan), Gudang, Sales, No. SP.
- Tabel barang bergaya faktur dengan kolom sisa; Total, PPN, **Sisa tagihan**.
- **Transaksi / Dokumen terkait**: tanggal, jenis, nomor (tautan), status, jumlah.
- Jejak: "Terakhir diubah oleh … pada …" dan "Terakhir dicetak oleh … pada …".
- **Tombol Bagikan dan Kirim WhatsApp tidak dibuat.** Pemesanan berulang dan pengingat jatuh tempo tidak dibuat.

**Uang muka dari halaman SO** (keputusan pengguna):

- Pengguna dengan izin tersendiri dapat **mencatat uang muka langsung dari halaman SO** (jumlah, tanggal, akun kas/bank tujuan, referensi, lampiran bukti).
- Catatan tersebut **wajib diverifikasi Finance** sebelum berlaku. Sebelum terverifikasi berstatus "Menunggu verifikasi", tampil di SO terpisah dari DP, tidak menambah DP, tidak dihitung dana terverifikasi untuk syarat bayar-sebelum-kirim, dan tidak diposting ke buku besar.
- Verifikasi oleh pengguna Finance berizin memposting penerimaan sebagai uang muka pelanggan sesuai Pemetaan Akun dan mengaitkannya ke SO; penolakan menyimpan alasan. Pencatat tidak boleh memverifikasi catatannya sendiri. *(larangan verifikasi sendiri: keputusan pembangun, pemisahan tugas)*
- Kolom **DP** pada daftar/detail SO = jumlah uang muka terverifikasi yang terkait SO (menggantikan derivasi sementara dari batch pemenuhan untuk catatan baru).

### Matrix hak akses

- Bentuk **pohon centang** seperti Kledo: Modul → Submenu → hanya tindakan yang berlaku, dengan kata kerja sederhana (Lihat, Buat, Ubah, Hapus, Batalkan, Cetak, …). Mencentang submenu = Lihat.
- Kolom kosong "Belum tersedia/Tidak berlaku" dan paragraf legenda dihapus.
- Batasan data berupa centang berbahasa awam di dalam pohon: **Akses data milik pengguna lain, Lihat harga, Data milik sales lain**.
- Tetap: izin per submenu independen; centang induk mencentang anak satu per satu (tidak menyimpan grant induk); Admin Sistem penuh; tidak ada perluasan hak diam-diam.
- Dikerjakan dalam pekerjaan ini (keputusan pengguna).
- **Semua pengaturan akses diatur di peran** seperti Kledo, termasuk centang batasan data; pengguna memperoleh hak melalui peran yang diberikan. Tidak ada override hak akses per pengguna. Pengguna dengan beberapa peran memperoleh gabungan izin dan cakupan terluas.
- **Lihat harga:** tanpa izin ini, harga dan total disembunyikan di **semua** dokumen dan keluaran — SO, Proforma, Pick Slip, Surat Jalan, Invoice, laporan dan ekspor — dengan tidak mengirimkannya dari server (bukan hanya disembunyikan di layar). Pengguna tanpa Lihat harga tidak dapat membuat atau mengubah SO. *(bagian terakhir keputusan pembangun)*
- **Data milik sales lain / pengguna lain:** pemilik data adalah isian **Sales** pada dokumen. Berlaku lebih dulu di menu penjualan (SO, Proforma, Invoice, laporan penjualan), dengan pilihan cakupan **bawahan** berdasarkan Struktur Organisasi. Pembatasan diterapkan di query, ekspor dan agregasi server.
- Batasan data diwujudkan sebagai **kode izin** di pohon (`sales_price.read` "Lihat harga", `sales_data.others` "Data milik sales lain"), bukan jenis cakupan; "Akses data milik pengguna lain" digabung ke "Data milik sales lain" karena pemiliknya sama (isian Sales). Pilihan **bawahan** menunggu fitur Struktur Organisasi (karyawan, jabatan, atasan) yang belum ada di evflow. *(keputusan pembangun)*
- **Struktur Organisasi** (dipelajari dari Fingerspot, 25 Oktober 2026): data karyawan terpisah dari akun pengguna (karyawan boleh tanpa akun). Keputusan pengguna: **atasan langsung dipilih manual per karyawan**, tidak diturunkan otomatis dari pohon jabatan. Bawahan seseorang = seluruh karyawan dalam rantai atasan di bawahnya (langsung dan tidak langsung); rantai melingkar ditolak backend. Keputusan pengguna: **jabatan cukup daftar biasa** (bukan pohon jabatan). Departemen tetap berupa daftar sesuai desain 24 Oktober. Tampilan bagan dari desain 24 Oktober tidak dibuat dalam pekerjaan ini; daftar karyawan menampilkan kolom atasan langsung. *(bagan: keputusan pembangun)* Menu berada di Setting › Struktur Organisasi (Karyawan, Departemen, Jabatan) dengan izin per submenu.
- **Izin baru** (mis. Lihat harga, Cetak, Batalkan) diberikan saat migrasi **hanya kepada peran yang saat ini sudah dapat melakukan hal tersebut** (contoh: peran dengan Lihat SO memperoleh Lihat harga karena hari ini sudah melihat harga). Perubahan dicatat di audit dan ditampilkan pada layar ringkasan untuk ditinjau Admin Sistem.

### Penomoran dokumen (bagian tambahan)

Pola Kledo (Pengaturan › Penomoran Otomatis) dipakai untuk Setting › Penomoran Dokumen:

- Jenis dokumen ditampilkan sebagai **kartu yang dikelompokkan** (Penjualan, Pembelian, Kas & Bank, Produk & Stok, Lainnya) dengan jumlah per kelompok dan kolom **Cari**; tiap kartu menampilkan contoh nomor saat ini.
- Format diisi sebagai **teks biasa dengan kode dalam kurung** (mis. `SO-SSM.[TAHUN].[BULAN].[NOMOR]`) dan dropdown **Tambah kode** berbahasa awam: nomor urut, nomor urut romawi, tanggal, tanggal romawi, bulan (01–12 / JAN–DES / romawi), tahun (4 digit / romawi). Kode singkatan yang harus dihafal (`TTTT`, `BB`, `0000`) tidak dipakai di layar.
- **Contoh hasil** langsung tampil saat format diketik.
- **Nomor saat ini** dapat diatur, **hanya dinaikkan** (tidak boleh mundur atau menghasilkan nomor yang sudah dipakai). *(invariant nomor)*
- **Reset**: tidak pernah, harian, bulanan, atau tahunan pada tanggal tertentu, dengan log reset. Perubahan mode reset berlaku periode berikutnya (keputusan 24 Oktober).
- Nomor tetap dibuat sistem, unik per perusahaan dan jenis dokumen, diterbitkan atomik; perubahan format berlaku untuk dokumen baru dan diaudit.

- Keputusan pengguna: format penomoran **seperti Kledo, tanpa kode berbasis data** (kode gudang, kode grup/referensi pelanggan tidak dibuat).
- Reset tahunan selalu pada **1 Januari** (tanpa pilihan tanggal lain), karena reset di tengah tahun dengan kode tahun kalender dapat menghasilkan nomor kembar. Format ditolak bila reset dapat menghasilkan nomor kembar (mis. reset harian tanpa kode tanggal/bulan/tahun, reset bulanan tanpa kode bulan dan tahun) atau bila sama persis dengan format jenis dokumen lain. Sakelar Kledo "nomor dikunci" tidak dibuat karena nomor evflow selalu dibuat sistem. *(keputusan pembangun)*
- Sakelar Kledo "nomor disamakan dengan transaksi asal" **tidak dibuat**, karena bertabrakan dengan nomor unik per jenis dokumen bila satu SO menghasilkan beberapa dokumen turunan. *(keputusan pembangun)*

### Pajak (bagian tambahan)

Pola Kledo (Pengaturan › Pajak) dipakai untuk Setting › Pajak:

- Daftar sederhana: **Nama, Persen efektif, Akun penjualan, Akun pembelian, Pemotongan, Aktif** (sakelar langsung di baris).
- Layar menampilkan **satu angka efektif** (mis. PPN 11%). Rumus tarif × DPP (12% × 11/12) tidak tampil di daftar; rinciannya tersedia saat pajak dibuka karena tetap disimpan per dokumen untuk faktur pajak Coretax. *(keputusan pembangun, invariant pajak)*
- Form singkat: Nama, Persen efektif (dengan rincian tarif dan DPP yang terisi otomatis untuk PPN), akun penjualan, akun pembelian.
- Tetap: semua produk kena PPN dengan pajak penjualan bawaan dan snapshot per dokumen (keputusan 24 Oktober); tarif tidak di-hardcode; pajak bawaan tidak dapat dinonaktifkan.

- Keputusan pengguna: **satu pajak menyimpan akun penjualan dan akun pembelian sekaligus** seperti Kledo (menggantikan pemisahan pajak penjualan/pembelian saat ini).
- Keputusan pengguna: pajak yang dipotong lawan transaksi (PPh) **ditandai "Pemotongan"** di daftar Pajak seperti Kledo. Pengaturan bukti potong/SSP untuk pajak tersebut pindah ke pajak bertanda Pemotongan; halaman Jenis Potongan tinggal untuk potongan non-pajak (mis. biaya transfer). Ini merevisi sebagian keputusan konsolidasi 24 Oktober tentang potongan. *(pemindahan bukti potong: keputusan pembangun)*
- Pajak grup tidak dibuat dalam pekerjaan ini. *(keputusan pembangun)*
- Penggabungan data: pasangan pajak bawaan "PPN Penjualan" + "PPN Masukan" yang tarif dan DPP-nya sama digabung menjadi satu pajak "PPN" dengan dua akun. Jenis potongan PPh 22, PPh 23 dan PPN dipungut dipindah menjadi pajak bertanda Pemotongan (tarif awal sebagai nilai bawaan yang dapat diedit); Jenis Potongan tinggal berisi potongan non-pajak (Biaya transfer). Snapshot pajak pada dokumen lama tidak berubah. Pemakaian pajak (penjualan/pembelian) ditentukan oleh akun yang diisi. Pajak bawaan pembelian yang terisi otomatis di dokumen pembelian tidak dibuat di pekerjaan ini. *(keputusan pembangun)*
- Validasi jenis akun: PPN (ditambahkan) — akun penjualan = Kewajiban, akun pembelian = Aset. Pajak bertanda Pemotongan — akun penjualan (dipotong pelanggan, pajak dibayar di muka) = Aset, akun pembelian (kita memotong pemasok, utang pajak) = Kewajiban. *(keputusan pembangun)*
- Backend memvalidasi jenis akun pajak: akun penjualan PPN harus akun kewajiban (PPN Keluaran) dan akun pembelian PPN harus akun aset (PPN Masukan). Pada akun Kledo pengguna terlihat baris PPN dengan akun penjualan "PPN Masukan" dan akun pembelian "PPN Keluaran", contoh salah pasang yang harus dicegah. *(keputusan pembangun)*

Alur akuntansi Kledo yang diamati (Pengaturan › Pemetaan Akun dan Alur Bisnis) sebagai pola layar:

- **Pemetaan Akun** dikelompokkan (Produk, Penjualan, Pembelian, Kontak, Lainnya); setiap akun memiliki satu kalimat fungsi ("Menampung nominal diskon dari transaksi penjualan Anda") dan **terkunci dengan alasan** setelah dipakai transaksi ("Tidak dapat diubah karena sudah ada transaksi …"). Akun pajak tidak berada di Pemetaan Akun, melainkan pada masing-masing pajak.
- Pengiriman memposting **Penjualan Belum Ditagih / Piutang Belum Ditagih**, lalu tagihan mereklasifikasi — sejalan dengan alur unbilled pada blueprint evflow.
- Alur Bisnis per modul memuat sakelar pajak berbahasa awam: tampilkan kolom pajak, pajak wajib diisi, harga bawaan termasuk pajak, tampilkan DPP nilai lain, tampilkan pemotongan.
- evflow menerapkan pola layar yang sama pada Setting › Pemetaan Akun yang sudah ada (kalimat fungsi per akun, kunci beralasan setelah dipakai). Aturan posting evflow tidak berubah. *(keputusan pembangun)*

### Prioritas

- Pengguna meminta **backend lebih dulu**.

## Kondisi backend saat ini (pemetaan 25 Oktober 2026)

| Kebutuhan | Kondisi |
|---|---|
| Daftar SO: No. SP, tanggal SO, jatuh tempo, DP | `customerReference` tersimpan tetapi tidak dikirim di daftar; hanya `createdAt`; tidak ada jatuh tempo di SO; DP tidak ada di SO |
| Status tunggal | Tidak ada; tiga status terpisah (`state` + string pemenuhan dan sisa dari `order-view.ts`); `COMPLETED` tidak pernah diset |
| Diterima pelanggan (POD) | Data ada di `FulfillmentAllocation.acceptedQuantity`; tidak ada agregat per baris/SO |
| Menunggu Persetujuan | Tidak menjadi status; SO tetap DRAFT selama exception |
| Isian wajib | `customer_reference`, `delivery_address`, `evidence_id` wajib di kontrak (`packages/contracts/src/otc-ptp.ts`) |
| Tanggal, termin, sales, gudang di SO | Tidak ada kolom; termin di-snapshot dari pelanggan saat submit; gudang implisit |
| Dokumen terkait | Tidak ada endpoint agregat; Surat Jalan/POD/Invoice tanpa status dan nilai pada detail SO |
| Tindakan yang tersedia | Dihitung di UI (`sales-order-journey.tsx`); backend hanya menolak saat command |
| Izin Lihat Harga | Tidak ada; `sales_order.read` mengembalikan harga |
| Katalog izin | `Permission` hanya `code/resource/action/description`; label, modul, submenu dan urutan hanya di UI (`iam.ts`, `access-matrix-navigation.ts`) |
| Cakupan data | Disimpan per grant (`scopeType`), tetapi guard hanya menerima `company/privileged`; `self/subordinate` tidak memfilter baris |
| Simpan matrix | Ganti penuh, maks. 200 grant per peran |
| Alokasi stok | Hanya locator STORAGE/DISPATCH aktif, semua gudang (`transaction-controls.ts`) |
| Pindah locator | Tidak ada |

## Pendekatan

Dipilih pengguna 25 Oktober 2026: **A**, karena permintaan "backend dulu" tetap terpenuhi di tiap bagian sementara hasil dapat dinilai per bagian. Urutan bagian: (1) daftar + form SO, (2) detail SO, (3) matrix pohon, (4) pindah locator, (5) penomoran dokumen, (6) pajak. Bagian 5 dan 6 ditambahkan pengguna 25 Oktober 2026. Perubahan yang dipakai bersama (metadata katalog izin, izin Lihat Harga, kolom sales/gudang pada SO) dirancang pada bagian pertama yang membutuhkannya.

| | Pendekatan | Kelebihan | Kekurangan |
|---|---|---|---|
| **A (usulan)** | Per bagian, backend dulu di tiap bagian: (1) daftar + form SO, (2) detail SO, (3) matrix pohon, (4) pindah locator | Hasil terlihat per bagian; kontrak backend langsung diuji layarnya | Perubahan bersama (katalog izin berlabel, Lihat Harga) dirancang di awal |
| B | Seluruh backend keempat bagian dulu, lalu seluruh layar | Backend konsisten dalam satu rangkaian | Lama sebelum terlihat; API berisiko diubah saat layar dibuat |
| C | Lapisan baca saja tanpa field baru | Tercepat | Tidak memenuhi gudang, termin, sales, sakelar wajib, izin harga, pindah locator |

## Dokumen yang perlu disinkronkan saat implementasi

Requirement dan dokumen domain pemilik aturan perlu diperbarui sebelum/bersama kode: `02-requirements.md` (OTC, IAM, WMS), `10-sales-marketing.md` (isian SO, status tunggal), `11-warehouse-logistik.md` (pindah locator, gudang di SO), `15-setting.md` (sakelar wajib-isi, gudang bawaan, gudang per barang, katalog izin), `06-user-flow.md`, `07-design.md`, `03-database.md`, `04-api.md`. Keputusan 23 Oktober tentang struktur detail SO (tab dan tabel 9 kolom) akan direvisi oleh desain detail di atas.

## Yang diserahkan ke pembangun

- Nama kolom/endpoint, bentuk respons agregat, dan strategi migrasi data lama (SO tanpa tanggal/sales/gudang).
- Penempatan sakelar di Setting mengikuti konsolidasi pengaturan 24 Oktober.
- Rancangan metadata katalog izin (tabel/kolom atau registry di contracts) dan perubahan batas 200 grant.
