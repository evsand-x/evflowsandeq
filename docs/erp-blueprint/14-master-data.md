# Domain Master Data

## Keputusan 24 Oktober 2026 — atribut pelanggan dan produk

Mengikuti [desain konsolidasi](../superpowers/specs/2026-10-24-konsolidasi-pengaturan-design.md): Pelanggan memuat termin bawaan, kode faktur bawaan, limit kredit, freeze dan toleransi jatuh tempo (izin kredit pelanggan). Produk memuat harga jual umum dan batas diskon produk. Harga khusus pelanggan dikelola di Sales & Marketing.


Implementasi backend produk pada 9 Oktober 2026 dicatat di [catatan pembangunan Master Data Produk](../development/product-master-backend-2026-10-09.md). Catatan tersebut menjelaskan endpoint dan migration yang sudah dibangun tanpa mengubah kepemilikan aturan lintas modul.

Status: sumber domain identitas dan referensi reusable yang dipakai transaksi. Master menyimpan status, masa berlaku, versioning dan audit; transaksi menyimpan snapshot agar perubahan master tidak menulis ulang histori. Kemunculan sebuah data pada layar Master Data tidak memindahkan kepemilikan aturan harga, kredit, stok, pajak atau posting dari modul domainnya.

## 1. Kelompok master

| Kelompok | Data reusable yang dikelola Master Data | Data terkait dan pemilik aturan | Syarat siap dipakai transaksi baru |
|---|---|---|---|
| Produk | Kode, nama, kategori, satuan dasar dan konversi, kebutuhan batch/expiry/serial, izin edar, profil penyimpanan, status; harga beli acuan dan harga jual standar dapat diisi dari form produk sesuai izin | Lot, tanggal expiry aktual, karantina, recall dan stok: Warehouse. Harga PO/MOU: Pengadaan. Pricelist, harga khusus dan prioritas harga: Sales & Marketing. HPP/valuasi: Finance | Kategori/UOM aktif, NIE dan bukti valid, kondisi simpan/shelf-life wajib tersedia serta lolos pemeriksaan data menurut kategori; harga yang belum tersedia tidak dianggap nol |
| Pelanggan dan kontak | Identitas institusi, tahap hubungan, channel/rayon, alamat, legalitas, kontak reusable dan fungsi PIC; satu institusi tidak disalin saat menjadi pelanggan bertransaksi | Menu Kontak dan aktivitas CRM: Sales & Marketing. Policy default: Setting. Termin bawaan, limit kredit, freeze dan toleransi: atribut pelanggan di Master Data dengan izin kredit pelanggan; exposure dihitung Finance (konsolidasi 24 Oktober 2026). Saldo awal/piutang dan invoice pertama posted: Finance | Prospek boleh tersimpan dengan data ringkas; kesiapan SO mengikuti data wajib per channel/jenis, verifikasi onboarding dan payment policy aktif; status bertransaksi berasal dari invoice pertama posted |
| Supplier | Identitas pemasok barang dagang, kategori, alamat, PIC, legalitas/izin, NPWP, PJT dan tautan MOU berversi | Isi MOU, harga/qty/ongkir dan TOP pada PO: Warehouse & Logistik → Pengadaan. Tagihan/AP/pembayaran: Finance | Identitas, izin dan perjanjian yang wajib untuk kategori/produk telah diverifikasi; TOP tidak menjadi angka tetap pada master supplier |
| Vendor | Identitas penyedia aset, barang operasional atau jasa; jenis, kategori, PIC, legalitas, pajak, rekening terverifikasi, tautan kontrak dan status | PO/kontrak/TOP: Pengadaan. Verifikasi rekening untuk pembayaran, tagihan/AP dan utang opening: Finance. Register unit aset: Finance | Dokumen sesuai jenis/kategori lengkap; rekening hanya dipakai setelah verifikasi berizin; saldo utang opening bukan field saldo bebas |
| Gudang dan locator | Kode, nama, alamat, penanggung jawab, zona waktu, profil penyimpanan, jenis locator, urutan picking, kapasitas bila relevan dan status | Qty, pemilik barang, transit, karantina, konsinyasi, quality hold dan movement: Warehouse & Logistik. Nilai stok: Finance | Gudang/locator aktif, jenis dan profil suhu sesuai barang; lokasi saja tidak menetapkan kepemilikan atau kelayakan stok |
| Item operasional | Kode, nama, jenis barang/jasa/model aset, kategori, spesifikasi, UOM, harga beli acuan opsional, stok minimum/locator bila relevan dan status | Pengajuan item baru, pemenuhan/PR/PO/stok: Warehouse & Logistik sesuai alur. Register per unit, kapitalisasi, beban dan nilai aset: Finance | Barang yang disimpan harus berkode master dan lolos klasifikasi; usulan item baru tidak otomatis aktif atau menambah stok; harga acuan kosong berarti belum tersedia |
| Referensi reusable | Kategori produk/item, UOM, channel, rayon dan identitas daftar yang dapat dipilih ulang | Daftar alasan dan status konfigurabel: Setting. Definisi payment term/kebijakan pelanggan: Setting/Finance. Tax profile/rule: Finance Pajak. Stage/target: Sales & Marketing dengan konfigurasi Setting | Kode/nama unik pada scope, status aktif dan versi berlaku; daftar yang sudah dipakai tidak dihapus; referensi domain wajib lolos validasi pemiliknya |

Tabel ini membedakan **tempat data dipilih atau ditampilkan** dari **modul yang berwenang mengubah aturan dan transaksi**. Form Master Data boleh menampilkan ringkasan atau tautan lintas modul sesuai izin, tetapi tidak menulis saldo, posting, stock movement, keputusan approval, tax rule atau harga khusus melalui update master biasa.

## 2. Aturan umum

Kode unik memakai sequence awal `PRD-`, `CUS-`, `CON-`, `SUP-`, `VEN-`, `EMP-` dan `AST-` dengan enam digit sesuai OPS-WH-04; kode legacy dipertahankan melalui mapping migrasi. Master Data mengelola kode produk/pelanggan/kontak/supplier/vendor; `EMP-` dimiliki HRIS dan `AST-` oleh Finance meskipun prefix-nya dikonfigurasi bersama. Status Active/Inactive/Archived tidak menghapus histori. Master yang sudah dipakai tidak boleh dihapus; gunakan inactive/superseded. Perubahan material memakai effective date/version dan snapshot pada transaksi.

Harga beli/jual acuan bukan HPP, bukan posting beban dan bukan nilai stok otomatis. UOM conversion baru berlaku untuk dokumen baru. NIE invalid/expired memblok transaksi baru kecuali disposition PJT berizin. Suhu dan shelf-life wajib berasal dari izin/produsen/customer policy; nilai hilang menahan transaction-ready atau menghasilkan quality hold.

Pelanggan prospek boleh dibuat sebelum transaksi; invoice pertama diposting menjadi pelanggan bertransaksi. Kontak bukan user ERP. Supplier dan Vendor tidak boleh saling tertukar pada PO/tagihan.

## 3. Workflow master

Draf → Validasi duplikat/daftar data wajib → Review pemilik domain → Aktif/Siap transaksi → Nonaktif/Digantikan. Master belum lengkap boleh disimpan Draf tetapi tidak dipakai transaksi resmi. Perubahan sensitif yang terlihat dari form master—ketentuan pembayaran, kredit, rekening, profil pajak, NIE dan harga khusus—memerlukan command, hak pemilik domain dan audit terpisah; update master biasa tidak boleh mengubahnya.

## 4. API dan data

Kontrak memakai `/api/v1`, JSON `snake_case`, UUID, tanggal ISO, dan nilai uang/qty sebagai string desimal. `company_id` dan scope ditentukan server dari membership; client tidak boleh memilih company atau scope sendiri. Mutasi aggregate yang sudah ada memakai `If-Match: "<version>"`; create dan command memakai `Idempotency-Key`. Duplicate candidate adalah hasil pemeriksaan sebelum create, sedangkan unique constraint tetap menjadi pengaman terakhir.

### 4.1 Resource kanonis Master Data

| Resource | Kepemilikan dan data utama | Command/lifecycle | Permission minimum dan blocker |
|---|---|---|---|
| `/products` | Produk, kategori, UOM dasar, flag batch/expiry/serial, profil penyimpanan, status dan versi | `GET/POST/PATCH`; `duplicate-check`; `activate/deactivate`; `history` | `master.product.read/create/update/activate`; aktivasi ditahan jika kategori/UOM/NIE/profil mutu wajib belum valid |
| `/products/{id}/registrations`, `/products/{id}/uoms`, `/products/{id}/reference-prices` | NIE/AKL/AKD dan bukti, konversi UOM efektif, Harga Beli Acuan serta harga jual standar yang ditulis ke pricelist standar | Tambah/revisi versi sesuai jenis; harga jual standar memanggil service harga Sales dalam transaksi yang konsisten | Izin NIE/UOM/harga beli/harga jual terpisah; izin edar tidak dapat menjadi valid tanpa verifikasi berwenang; UOM/harga baru tidak menulis ulang transaksi historis |
| `/product-categories` | Kategori alat kesehatan reusable | `GET/POST/PATCH`; `activate/deactivate`; `history` | `master.reference.manage`; tidak boleh menonaktifkan kategori yang masih diperlukan tanpa pengganti |
| `/uoms` | Satuan reusable | `GET/POST/PATCH`; `activate/deactivate`; `history` | `master.reference.manage`; faktor konversi produk dikelola melalui `/products/{id}/uoms` |
| `/customers` | Identitas institusi, tahap hubungan, channel/rayon dan status | `GET/POST/PATCH`; `duplicate-check`; `activate/deactivate`; `history` | `customer.read/create/update/activate`; Prospek boleh disimpan tanpa transaction-ready; status `transacted` hanya dari invoice pertama posted |
| `/customers/{id}/addresses`, `/customers/{id}/legal-documents`, `/customers/{id}/onboarding/verify` | Beberapa alamat, legalitas, penanggung jawab, izin, berkas NOO dan keputusan verifikasi | Tambah/revisi data; `onboarding/verify` menjadi command verifikator dan menyimpan snapshot daftar data wajib | Berkas upload tidak otomatis valid; validasi channel/jenis dan hak verifikator di server; tidak mengubah saldo/kredit |
| `/contacts` | Identitas kontak dan fungsi PIC yang tertaut ke customer; dipakai Master Data dan menu CRM tanpa salinan kedua | `GET/POST/PATCH`; `duplicate-check`; `activate/deactivate`; `history` | Mutasi mengikuti `crm.contact.read/create/update`; tidak membuat akun ERP atau transaksi |
| `/suppliers` | Supplier barang dagang, kategori, PIC, legalitas, PJT dan tautan agreement | `GET/POST/PATCH`; `duplicate-check`; `activate/deactivate`; `history` | `master.supplier.read/create/update/activate`; TOP/harga PO memakai command Pengadaan |
| `/suppliers/{id}/contacts`, `/suppliers/{id}/legal-documents`, `/supplier-agreements` | PIC dengan beberapa fungsi, izin/legalitas berversi dan perjanjian sumber pengadaan | Mutasi PIC/legalitas sesuai izin master; mutasi isi MOU dan produk/harga/termin ditangani Pengadaan | Supplier aktif saja tidak membenarkan PO bila agreement/izin wajib belum valid |
| `/vendors` | Vendor aset, barang operasional dan jasa, tautan rekening, legalitas dan kontrak | `GET/POST/PATCH`; `duplicate-check`; `activate/deactivate`; `history` | `master.vendor.read/create/update/activate`; pembayaran dan rekening terverifikasi memerlukan izin Finance |
| `/vendors/{id}/contacts`, `/vendors/{id}/legal-documents`, `/vendor-agreements` | PIC, izin/legalitas dan tautan kontrak/SPK | Mutasi identitas sesuai izin master; syarat pekerjaan, harga dan TOP pada PO/kontrak ditangani Pengadaan | Jenis/kategori vendor menentukan bukti wajib; detail rekening tidak dibuka dari read umum |
| `/warehouses` | Identitas gudang dan profil lokasi | `GET/POST/PATCH`; `duplicate-check`; `activate/deactivate`; `history` | `warehouse.master.read/create/update/activate`; tidak membuat saldo stok |
| `/locations` | Locator gudang dengan tipe, parent, profil simpan, urutan picking dan status | `GET/POST/PATCH`; `duplicate-check`; `activate/deactivate`; `history` | `warehouse.location.read/create/update/activate`; movement, ownership dan quality state memakai Warehouse command |
| `/operational-items` | Item barang operasional, model aset dan jasa berulang | `GET/POST/PATCH`; `duplicate-check`; `activate/deactivate`; `history`; `new-item-requests` | `master.operational_item.read/create/update/activate`; request baru tidak otomatis aktif atau menambah stok |
| `/customer-channels` dan `/rayons` | Referensi channel/rayon pelanggan | `GET/POST/PATCH`; `activate/deactivate`; `history` | `master.reference.manage`; data terpakai tidak dihapus |

### 4.2 Resource terkait yang bukan mutasi Master Data

| Resource | Pemilik command | Hubungan dengan Master Data |
|---|---|---|
| `/product-batches`, `/stock-movements`, `/stock-balances` | Warehouse & Logistik | Produk/UOM/locator dirujuk; batch aktual dan saldo tidak ditulis dari master |
| `/price-lists`, `/price-list-items`, `/customer-price-requests` | Sales & Marketing | Produk dan customer menjadi referensi; harga khusus, approval, prioritas dan publikasi memakai service Sales |
| `/customers/{id}/payment-policies`, `/credit-exposure` | Finance; Sales hanya membaca saat evaluasi SO | Customer menjadi aggregate asal; mode COD/prepay/credit, TOP, limit dan exposure memiliki version/snapshot sendiri |
| `/payment-terms`, `/tax-profiles`, `/party-tax-profiles` | Setting/Finance/Pajak | Master Data hanya menampilkan pilihan atau tautan sesuai izin; rule bertanggal efektif tidak diubah melalui update customer biasa |
| `/party-bank-accounts` | Finance | Rekening dapat diringkas pada Vendor/Supplier/Customer; nomor penuh, verifikasi dan perubahan memakai permission Finance |
| `/import-jobs` | Setting sebagai orkestrasi bersama | Import Master Data memakai `kind=master_data` dan tetap memanggil service pemilik resource |

### 4.3 Aturan command bersama

1. Untuk resource `R`, bentuk umum adalah `GET R`, `GET R/{id}`, `POST R`, `PATCH R/{id}`, `POST R/duplicate-check`, `POST R/{id}/activate`, `POST R/{id}/deactivate`, dan `GET R/{id}/history`. Hanya command yang relevan bagi jenis resource diekspos; tidak ada DELETE untuk data yang telah dipakai.
2. `GET list/detail` selalu menerapkan company, scope, filter whitelist, sort stabil dan cursor pagination. Data sensitif direduksi di API, bukan hanya disembunyikan kolom UI.
3. `POST R/duplicate-check` tidak menulis data dan hanya mengembalikan kandidat yang boleh dilihat pemohon; create tetap mengulang validasi di server dan constraint unik menolak race.
4. `PATCH R/{id}` hanya mengubah draft atau field yang belum terkunci; field sensitif memakai command domain terpisah. Mismatch `If-Match` menghasilkan 412.
5. `activate` memeriksa data wajib OPS-WH-05, dependensi aktif, bukti dan konflik effective date; kegagalan mengembalikan 422 berisi field, alasan dan owner tindakan. Status aktif master dan `transaction-ready` pelanggan merupakan dua penilaian terpisah.
6. `deactivate`/`supersede` tidak menghapus histori dan tidak membatalkan dokumen lama; transaksi baru tidak dapat memilih master nonaktif. Revisi yang berlaku masa depan memakai versi/tanggal efektif hanya pada field yang mendukungnya.
7. `history` bersifat read-only dan menampilkan versi, actor, waktu, perubahan terbatas, alasan bila diwajibkan dan snapshot yang digunakan transaksi sesuai izin.
8. `POST /import-jobs` dengan `kind=master_data` mengikuti `staging → validate → preview → commit → error report`; commit atomik per batch yang disetujui, hash file dan idempotency mencegah duplikasi.

## 5. Kriteria penerimaan

1. Master reusable tidak membuat transaksi atau jurnal hanya karena dibuat.
2. Perubahan master tidak mengubah dokumen historis.
3. Duplicate candidate ditampilkan sebelum create.
4. Supplier/Vendor dan Customer/Contact memakai tipe yang benar.
5. Master inactive tidak dapat dipilih pada transaksi baru.
6. Import retry tidak menggandakan master.

## 6. Keputusan final dan konfigurasi wajib

Awalan nomor master dan daftar data wajib mengikuti OPS-WH-04/05 pada [katalog OPS-WH-04/05](40-kebijakan-operasional-konfigurasi.md). Nilai PRD/CUS/CON/SUP/VEN/EMP/AST menjadi nilai awal dan dapat diubah melalui UI tanpa mengganti kode historis.

Format kode, siklus hidup dan penghalang sudah ditetapkan. Daftar data wajib dan pemeriksa disimpan per jenis/saluran/kategori; nilai aktual dokumen wajib, suhu dan masa simpan harus diisi pemilik domain dari sumber resmi. Kepemilikan konsinyasi wajib berasal dari perjanjian dan tidak boleh disimpulkan dari lokasi penyimpanan.

## 7. Katalog atribut kanonis

Bagian ini memusatkan atribut bisnis Master Data yang sebelumnya tersebar pada Design dan model data. Form dapat menampilkan kelompok dan isian bertahap; ketiadaan data wajib menurut OPS-WH-05 menahan aktivasi/transaction-ready, bukan memaksa placeholder. Data sensitif hanya tersedia bagi izin dan scope yang sesuai.

### 7.1 Produk, satuan, izin edar, kualitas dan harga

| Kelompok | Atribut dan aturan |
|---|---|
| Identitas produk | Kode/SKU unik per perusahaan, nama, kategori alat kesehatan, status, versi dan audit |
| Satuan | Satuan dasar, alternatif UOM, faktor konversi positif, tanggal berlaku/akhir; transaksi menyimpan faktor snapshot |
| Penelusuran | Flag kebutuhan batch, expiry dan serial berada pada master produk; lot, tanggal produksi/kedaluwarsa, quality/recall state dan serial aktual dicatat Warehouse saat penerimaan/movement |
| Izin edar | Jenis AKL/AKD, nomor, pemilik/pemegang, tanggal terbit/akhir, status, bukti dan disposition PJT berizin |
| Penyimpanan | Profil/rentang suhu, kelembapan bila berlaku, shelf-life, sumber dokumen, verifikator dan waktu verifikasi; data wajib hilang menghasilkan hold |
| Harga Beli Acuan | Nilai, satuan, mata uang, tanggal berlaku/akhir dan versi; terpisah dari MOU, HPP dan valuasi |
| Harga Jual Standar | Nilai, satuan, mata uang dan tanggal berlaku melalui pricelist standar; harga channel/pelanggan/kontrak mengikuti prioritas domain Sales |
| Audit | Actor, waktu, alasan bila diwajibkan, perubahan versi dan snapshot pada transaksi baru; posted record historis tidak diubah |

Empat kategori awal mengikuti MD-01. Harga belum tersedia berbeda dari nol. Hak melihat/mengubah harga beli terpisah dari harga jual. NIE invalid/expired memblok transaksi baru kecuali disposition PJT; master Draft boleh menyimpan data yang belum lengkap.

### 7.2 Pelanggan dan kontak — atribut disetujui

### 3.1 Form data pelanggan baru — 17 atribut pengguna

Daftar atribut berikut berasal dari pengguna. Pengelompokan dan perilaku input merupakan rancangan penerapan; kewajiban dokumen per channel masih perlu ditentukan sesuai jenis pelanggan. Registrasi prospek untuk kunjungan tetap memakai form ringkas, tidak harus melengkapi seluruh atribut pelanggan transaksi.

| No. | Atribut | Isian / perilaku rancangan |
|---|---|---|
| 1 | Kode Pelanggan | Kode unik per perusahaan; usulan dihasilkan otomatis menurut penomoran, dengan validasi kode saat migrasi |
| 2 | Nama Pelanggan | Nama institusi/badan usaha; tampilkan kandidat duplikat sebelum membuat data baru |
| 3 | Alamat Utama | Alamat lengkap terstruktur; alamat penagihan dapat ditentukan terpisah bila berbeda |
| 4 | Alamat Pengantaran Barang | Pilihan sama dengan alamat utama atau alamat berbeda; dukung beberapa tujuan dan satu default, dipilih pada SO |
| 5 | Channel | Pilih master channel; Tambah Channel Baru tersedia sesuai izin pengelolaan master |
| 6 | Rayon | Pilih master rayon; Tambah Rayon Baru sesuai izin; rayon berbeda dari channel |
| 7 | Kontak PIC Pembelian | Nama, jabatan/unit, telepon/WhatsApp dan email bila ada; dapat memakai kontak institusi yang sudah terdaftar |
| 8 | Kontak PIC Penerimaan Barang | Rincian kontak dan kaitan alamat tujuan bila relevan; dapat memuat PIC gudang |
| 9 | Kontak PIC Pembayaran/Keuangan | Rincian kontak untuk penagihan/tukar faktur dan tindak lanjut pembayaran; dapat memuat PIC penagihan |
| 10 | Legalitas dan Izin Operasional | Daftar dokumen: NIB, KTP, akta perubahan, SDAK, SIPA/SIPTTK/surat penugasan, tanda daftar gudang, spesimen tanda tangan/stempel dan izin lain sesuai channel; simpan nomor, penerbit, masa berlaku, berkas, status verifikasi |
| 11 | NPWP | Teks untuk menjaga nol di depan, nama/alamat terdaftar dan berkas bila diperlukan; simpan NPWP/NIK, status PKP/Non-PKP dan alamat sesuai pajak |
| 12 | Apoteker Penanggung Jawab/Penanggung Jawab Teknis | Nama, jenis penanggung jawab, kontak dan masa penugasan bila tersedia; berlaku sesuai jenis pelanggan |
| 13 | Izin Penanggung Jawab | Tertaut ke penanggung jawab: jenis/nomor izin, penerbit, masa berlaku dan berkas; dukung riwayat penggantian |
| 14 | Termin Pembayaran | Opsional: termin bawaan pelanggan dari daftar termin Setting (Tunai/COD, Bayar sebelum kirim, Tempo N hari) yang hanya mengisi otomatis SO. COD memiliki TOP 0 dan jatuh tempo dari waktu serah terima Surat Jalan terbit (keputusan 24 Oktober 2026) |
| 15 | Limit Kredit | Nilai uang dan tanggal efektif; hanya pengguna berwenang. Pelanggan baru tidak otomatis mendapat limit/Tempo; limit untuk prepay/COD dapat tetap kosong sesuai policy |
| 16 | Saldo Awal Piutang | Ringkasan hasil proses opening per invoice dan tanggal cut-over; tombol Isi/Impor Rincian Piutang Awal mengikuti hak finance. Bukan angka bebas yang langsung mengubah kartu piutang |
| 17 | Upload Berkas NOO | Unggah berkas dengan nama, tanggal, versi dan catatan; akses privat. Istilah NOO dipertahankan sesuai pengguna; template/kewajiban mengikuti channel |
| Tambahan | Kebijakan onboarding dan penagihan | Jenis pelanggan, potensi, pola pembayaran, jadwal tukar faktur, metode pembayaran, toleransi hari, PIC penagihan/gudang, status verifikasi onboarding dan status WAPU untuk instansi pemerintah |

Usulan kelompok form: **Identitas & Wilayah** (1–6), **Kontak PIC** (7–9), **Legalitas & Penanggung Jawab** (10–13), **Pembayaran & Piutang Awal** (14–16), **Berkas NOO** (17), dan **Onboarding & Penagihan** (tambahan). Satu kontak boleh menjalankan beberapa fungsi PIC, dan setiap fungsi dapat memiliki kontak cadangan. Gunakan data kontak yang sama agar pergantian nomor tidak menghasilkan salinan yang saling berbeda.

Simpan Draft tetap tersedia ketika kelengkapan belum selesai; tampilkan data belum tersedia/tidak berlaku dengan alasan sesuai kebijakan. Jangan mewajibkan apoteker atau jenis izin tertentu secara seragam untuk seluruh channel. Kewajiban upload NOO dan daftar izin mengikuti channel. Pengunggahan berkas saja tidak berarti telah diverifikasi. Status onboarding/approval pelanggan terpisah dari tahap hubungan Prospek dan dari approval SO normal.

Saldo awal pelanggan yang belum pernah bertransaksi dengan perusahaan memang nol. Pelanggan lama yang baru dimasukkan ke ERP harus melalui verifikasi opening; nilai belum diketahui ditandai **Belum diverifikasi**, bukan otomatis nol. Rincian minimal mencakup nomor/tanggal invoice asli, jatuh tempo, nilai invoice, sisa belum dibayar dan bukti bila tersedia. Ringkasan pelanggan berasal dari rincian yang direkonsiliasi dan diposting melalui prosedur opening, bukan disimpan dua kali pada master dan ledger. Upload dokumen historis/opening tidak dihitung sebagai transaksi penjualan baru periode migrasi.

### CRM — Form Kontak, 11 atribut pengguna

| No. | Atribut | Perilaku isian |
|---|---|---|
| 1 | Kode Kontak | Identitas unik kontak, mengikuti pengaturan penomoran |
| 2 | Nama Lengkap - Panggilan | Dua isian: Nama Lengkap dan Nama Panggilan |
| 3 | Nama Pelanggan | Pilih dari Master Pelanggan; simpan hubungan ke data pelanggan, bukan salinan nama bebas |
| 4 | Jabatan | Jabatan kontak pada institusi/pelanggan |
| 5 | Unit/Bagian | Unit atau bagian tempat kontak bekerja; terpisah dari jabatan |
| 6 | Fungsi PIC | Dapat memilih beberapa fungsi; misalnya pembelian, penerimaan, pembayaran/keuangan, atau pengguna produk |
| 7 | Nomor HP/WA | Nomor komunikasi kontak |
| 8 | Email | Alamat email kontak |
| 9 | Tanggal Lahir | Tanggal lahir kontak |
| 10 | Status | Aktif atau tidak aktif; riwayat tetap tersimpan |
| 11 | Catatan | Informasi tambahan mengenai kontak |

Daftar atribut berasal dari pengguna. Rancangan isian: Nama Panggilan, Email dan Tanggal Lahir dapat dikosongkan bila belum diketahui; jangan mengisi tanggal contoh atau nilai palsu. Persyaratan field lain dapat dilengkapi pada validasi form sesuai proses.

Kelompok ringkas: **Identitas** (kode, nama lengkap, panggilan, tanggal lahir); **Pelanggan & Peran PIC** (pelanggan, jabatan, unit/bagian, fungsi); **Komunikasi & Status** (HP/WA, email, status, catatan). Tidak perlu deskripsi panjang pada halaman.

Menu **Sales & Marketing → Kontak** menampilkan database kontak tersendiri. Satu pelanggan dapat memiliki banyak kontak. PIC pada form pelanggan serta kontak tujuan kunjungan menggunakan data kontak yang sama; satu orang dengan beberapa fungsi PIC tidak perlu dibuat ulang. Data kontak bukan akun pengguna ERP dan tidak memberikan hak akses aplikasi.

Hubungan ke pelanggan tidak mensyaratkan PO atau invoice dan tidak berarti pelanggan sudah bertransaksi. Institusi/prospek sudah tercatat sekali di Master Pelanggan dengan tahap hubungan Prospek, sehingga pemilih Nama Pelanggan dapat digunakan sebelum transaksi. Saat data dilengkapi menjadi pelanggan terdaftar, pertahankan referensi pelanggan dan kontak yang sama. Status aktif kontak terpisah dari tahap hubungan pelanggan.


### 7.3 Supplier, Vendor dan item operasional — atribut disetujui

### Form Produk — Harga Beli dan Harga Jual

Keputusan pengguna: form **Buat Produk** memuat field **Harga Beli** dan **Harga Jual** yang dapat diisi saat registrasi produk. Tampilkan ringkas dalam kelompok Harga, dengan satuan harga yang eksplisit (default satuan dasar), mata uang dan tanggal berlaku. Rancangan awal nilai sebelum pajak ditandai pada label; harga per box/unit tidak boleh tertukar. Pengguna berhak dapat memperbarui harga dengan riwayat perubahan. Hak melihat/mengubah harga beli terpisah dari harga jual; field harga beli tidak dikirim ke pengguna tanpa izin.

Harga Beli menjadi acuan awal pembelian; harga MOU supplier yang berlaku tetap menjadi referensi utama PO dan perbedaan perlu diperiksa. Harga Jual menjadi harga standar awal produk; pricelist khusus pelanggan/channel yang berlaku dapat menggantikannya sesuai aturan harga. Simpan harga jual standar melalui mekanisme pricelist agar tidak ada dua sumber harga yang saling berbeda. Form produk tetap menyediakan kedua field, tanpa mengharuskan pengguna pindah halaman untuk mengisi harga awal.

Perubahan harga master berlaku untuk transaksi baru/repricing draft yang eksplisit, bukan mengubah histori PO/SO/invoice. Harga Beli master bukan HPP dan tidak menambah stok/nilai persediaan; HPP berasal dari penerimaan, biaya terkait dan valuasi. Data harga belum diisi dibedakan dari nol; jangan meneruskan harga nol diam-diam ke transaksi.

### Form data Supplier — atribut pengguna

Tampilan ringkas mengikuti preferensi halaman bersih. Atribut pengguna dikelompokkan sebagai berikut; tipe kontrol adalah rancangan penerapan.

| No. | Atribut | Isian / perilaku |
|---|---|---|
| 1 | Kode Supplier | Kode unik; usulan otomatis sesuai penomoran master |
| 2 | Nama Supplier | Nama badan usaha; periksa kandidat duplikat |
| 3 | Kategori | Pilihan kategori; contoh sesuai kegiatan: pabrik, importir, sole agent, pemilik izin edar; dukung lebih dari satu bila relevan |
| 4 | Alamat Utama | Alamat lengkap supplier |
| 5 | No. Telpon | Teks nomor telepon utama, menjaga nol di depan/kode negara |
| 6 | Kontak PIC Penjualan | Nama, jabatan, telepon/WhatsApp dan email bila ada |
| 7 | Kontak PIC Keuangan | Rincian kontak keuangan/penagihan supplier |
| 8 | Kontak PIC Pengiriman Barang | Rincian kontak untuk jadwal pengiriman dan tindak lanjut |
| 9 | Legalitas dan Izin Operasional | Daftar jenis/nomor dokumen, masa berlaku bila ada dan lampiran; kewajiban mengikuti kategori/kebijakan yang akan ditetapkan |
| 10 | NPWP | Teks nomor pajak; validasi format sesuai ketentuan berlaku |
| 11 | Nama Penanggung Jawab Teknis | Nama PJT supplier |
| 12 | TOP diatur pada PO | Bukan field TOP tetap di master supplier; isian TOP ada pada setiap PO |
| 13 | No. Dokumen Kontrak Kerjasama / MOU | Referensi ke dokumen kerja sama; dapat memiliki beberapa kontrak/versi dengan masa berlaku, lampiran dan cakupan produk |

Kelompok halaman: **Identitas** (1–5), **Kontak PIC** (6–8), **Legalitas & PJT** (9–11), **Kontrak/MOU** (13). Ketentuan nomor 12 diterapkan pada form PO sehingga tidak menambah field TOP yang membingungkan di halaman supplier. Satu kontak dapat mengisi beberapa fungsi PIC tanpa salinan data terpisah.

TOP pada PO mencatat jenis pembayaran, jumlah hari bila tempo, dasar perhitungan jatuh tempo dan ketentuan pembayaran yang relevan. MOU menjadi referensi untuk memeriksa kesesuaian ketentuan, bukan sumber yang diam-diam mengunci TOP master supplier. Snapshot TOP PO tersimpan untuk verifikasi tagihan/jatuh tempo AP. Default dasar jatuh tempo AP adalah tanggal invoice lengkap diterima dan diverifikasi + TOP; pilihan tanggal invoice supplier atau GR hanya muncul sebagai override eksplisit pada PO/MOU. Aturan pelanggan dari tanggal POD tidak berlaku untuk hutang supplier.

### Form data Vendor — atribut disetujui pengguna

Master/menu Vendor terpisah dari Supplier sesuai keputusan pengguna. Form ditujukan untuk penyedia aset, barang operasional/nonpersediaan dan jasa. Pengguna menyetujui 18 atribut berikut; kelengkapan dokumen menyesuaikan jenis/kategori vendor, bukan kewajiban legal seragam untuk semua vendor.

| No. | Atribut | Isian / perilaku |
|---|---|---|
| 1 | Kode Vendor | Kode unik; usulan otomatis sesuai penomoran master |
| 2 | Nama Vendor | Nama badan usaha atau perorangan; periksa kemungkinan duplikasi |
| 3 | Jenis Vendor | Badan usaha / perorangan |
| 4 | Kategori Vendor | Contoh ATK, IT, servis, sewa, ekspedisi, kendaraan; dapat beberapa kategori dan ditambah pengguna berwenang |
| 5 | Alamat Utama | Alamat vendor |
| 6 | No. Telepon | Nomor telepon utama, bertipe teks |
| 7 | Email | Email utama bila tersedia |
| 8 | Kontak PIC Penjualan/Pemesanan | Nama, jabatan, telepon/WhatsApp dan email bila ada |
| 9 | Kontak PIC Keuangan | Nama dan kontak untuk invoice/pembayaran |
| 10 | Kontak PIC Pelaksanaan/Pengiriman | Kontak pelaksana pekerjaan atau pengiriman barang |
| 11 | Legalitas dan Izin Usaha/Operasional | Jenis/nomor dokumen, masa berlaku bila ada dan lampiran sesuai jenis usaha; tidak mewajibkan izin distributor alkes pada vendor umum |
| 12 | NPWP | Identitas pajak sesuai data vendor dan kebutuhan transaksi; belum tersedia tidak diisi angka fiktif |
| 13 | Status PKP | PKP / Non-PKP / Belum diverifikasi, dengan bukti bila relevan; tarif/perlakuan pajak tetap mengikuti transaksi dan aturan berlaku |
| 14 | Rekening Pembayaran | Bank, nomor rekening, nama pemilik, mata uang jika relevan, status verifikasi dan rekening utama; mendukung beberapa rekening |
| 15 | No. Kontrak/SPK/Perjanjian | Nomor, masa berlaku, cakupan pekerjaan/pasokan serta berkas bila ada; vendor tidak wajib mempunyai MOU barang dagang |
| 16 | TOP | Ditetapkan pada PO atau kontrak terkait; tidak menjadi TOP tetap master. Dasar jatuh tempo vendor dinyatakan eksplisit pada transaksi |
| 17 | Saldo Awal Utang | Ringkasan read-only dari rincian tagihan opening yang disetujui; isi/impor melalui prosedur opening berizin |
| 18 | Status Vendor | Aktif / Nonaktif; penonaktifan tidak menghapus histori atau menghalangi penyelesaian kewajiban yang sudah ada sesuai izin |

Kelompok tampilan: **Identitas** (1–7), **Kontak PIC** (8–10), **Legalitas & Pajak** (11–13), **Pembayaran** (14 dan ringkasan 17), **Kontrak & Status** (15,18). TOP berada pada PO/kontrak sehingga tidak memerlukan field tetap pada form Vendor. Isian kondisional dibuka saat diperlukan, tanpa deskripsi panjang permanen.

Satu orang dapat dipilih untuk beberapa fungsi PIC, terutama vendor perorangan, tanpa membuat kontak duplikat. Dokumen/rekening dibatasi hak akses; perubahan rekening diaudit dan dipertimbangkan saat verifikasi pembayaran. Informasi rekening belum diverifikasi ditampilkan jelas dan tidak otomatis dianggap sah. Kebutuhan dokumen mengikuti kategori/jenis vendor. Pengaturan profil vendor tidak otomatis menentukan tarif/potongan pajak seluruh transaksinya.

Saldo awal utang vendor lama berasal dari nomor/tanggal tagihan, jatuh tempo, nilai dan sisa yang belum dibayar pada tanggal cut-over, direkonsiliasi melalui proses opening. Data belum lengkap ditandai Belum diverifikasi, bukan nol; vendor baru tanpa kewajiban awal memiliki saldo nol. Form tidak membuat kewajiban melalui angka master yang dapat diedit bebas. Tagihan vendor tetap terpisah dari tagihan supplier.

### Master Item Operasional dan pemilihan item

Keputusan pengguna: sediakan menu master untuk barang operasional, jenis/model aset dan jasa berulang, terpisah dari produk barang dagang. Pada baris permintaan internal, pencarian item menyediakan **Pilih Item** atau **Ajukan Item Baru**. Form item baru ringkas: nama, spesifikasi/ruang lingkup, jumlah dan satuan. Petugas berwenang meninjau kemungkinan duplikasi, klasifikasi dan kebutuhan master sebelum proses stok/aset; pemohon tidak harus mengisi akun biaya atau klasifikasi akuntansi.

Barang operasional disimpan memerlukan master, sedangkan barang sekali pakai/jasa khusus boleh tetap berupa baris deskriptif yang dapat ditelusuri. Jenis/model aset dan unit aset ditampilkan terpisah: kode item untuk permintaan/pembelian, nomor aset untuk identitas unit dan penanggung jawab. Form mengikuti susunan atribut yang dibahas: kode, nama, jenis, kategori, spesifikasi, satuan dasar/konversi, Harga Beli Acuan, stok minimum, locator default, foto/lampiran dan status. Stok minimum/locator hanya tampil untuk barang yang relevan. Tidak perlu deskripsi panjang permanen pada form; tampilkan status peninjauan dan bantuan kontekstual bila diperlukan.

**Harga Beli Acuan disetujui pengguna sebagai isian opsional.** Tampilkan satuan dan mata uang yang jelas; barang menggunakan harga per satuan, jasa dapat per pekerjaan/paket/periode. Nilai belum diisi disimpan sebagai belum tersedia dan ditampilkan **Belum tersedia**, bukan Rp0. Field ini membantu estimasi permintaan/PR dan anggaran; harga aktual PO mengikuti kesepakatan vendor. Tidak ada harga jual pada lingkup item internal ini. Perubahan harga acuan sesuai izin dan diaudit; tidak menulis ulang estimasi dokumen historis atau membentuk HPP, beban maupun nilai aset. Nilai perolehan aktual dan kebijakan kapitalisasi mengikuti transaksi finance.


### 7.4 Gudang, locator dan data referensi

| Kelompok | Atribut dan aturan |
|---|---|
| Gudang | Kode, nama, alamat, zona waktu bisnis, penanggung jawab, status/versi, profil penyimpanan |
| Locator | Gudang induk, kode, nama, parent locator bila didukung, jenis receiving/storage/quarantine/transit/consignment/dispatch/return, suhu/profil simpan, urutan picking, kapasitas bila relevan dan status |
| Referensi | UOM, kategori, channel dan rayon dikelola sebagai identitas reusable; payment term, tax profile, alasan dan status mengikuti pemilik aturan Setting/Finance/Sales meski dapat ditampilkan sebagai pilihan pada form master |
| Supplier agreement | Nomor MOU/kontrak, versi dan tautan yang terlihat di master supplier; cakupan produk, harga/diskon, minimum order, ongkir dan ketentuan dikelola Pengadaan berdasarkan dokumen sumber |
| Rekening pihak | Bank, cabang, nomor terenkripsi/masked, nama pemilik, mata uang, bukti, status verifikasi, masa berlaku, rekening utama dan audit; query/ekspor dibatasi izin |

Barang supplier yang disimpan di lokasi perusahaan tidak otomatis menjadi milik perusahaan; ownership konsinyasi berasal dari agreement. Master gudang/locator tidak membuat stok. Penggunaan locator dalam transaksi baru memerlukan status aktif dan kesesuaian mutu/suhu.

### 7.5 Jejak model data logis

Tabel berikut adalah **jejak relasi lintas domain**, bukan daftar tabel yang semuanya dimiliki Master Data. Khususnya `product_batches`, `product_serials`, `customer_credit_policies`, `payment_terms`, `tax_profiles` dan `price_lists` mengikuti pemilik aturan pada bagian 1. Detail tipe, FK dan constraint tetap mengikuti [Database](03-database.md).

| Entitas | Kontrak atribut dan relasi |
|---|---|
| product_categories | name, code; empat kategori awal, active |
| products | sku unique per company, name, category_id, base_uom_id, batch_required, expiry_required, serial_required, storage_profile_id, valuation_policy_id, active |
| product_registrations | product_id, permit_type AKL/AKD, permit_number, holder, issued_on, expires_on nullable, status, evidence_id, disposition_by/at/reason; invalid/expired memblok transaction-ready kecuali disposition PJT |
| uoms / product_uoms | code; product_id, uom_id, factor_to_base, effective_from/to; satuan dasar berfaktor 1 |
| product_batches | product_id, manufacturer_lot, expiry_date nullable, manufacture_date nullable, quality_state, recall_state; identitas lot disambiguasi bila kode berulang |
| product_serials | product_id, batch_id nullable, serial_number; future optional, unique produk+serial |
| storage_profiles | min_temp, max_temp, humidity_limits nullable, handling_notes, shelf_life_policy, source_document, verified_by/at; nilai hilang menghasilkan quality hold |
| rayons | code, name, parent_id nullable, region/coverage notes, active; unique code per company |
| customer_channels | code/name, active, parent_id optional; dapat ditambah |
| customers | code, name, legal_name nullable, channel_id, rayon_id, assigned_sales_id, relationship_stage prospect/registered/transacted, onboarding_state, customer_type/potential nullable, transaction_ready_at nullable, first_posted_invoice_id nullable, payment_term_id, tax_profile_id nullable, collection_schedule_id nullable, invoice_exchange_schedule nullable, payment_method_preference nullable, payment_tolerance_days nullable, active; institusi prospek dan pelanggan memakai identitas yang sama |
| customer_addresses | customer_id, type primary/shipping/billing/tax, label, address_lines, village/district/city/province/postal_code/country_code, latitude/longitude nullable, delivery_notes, active |
| crm_contacts | code unique per company, full_name, preferred_name nullable, phone_whatsapp nullable, email nullable, birth_date nullable, active, notes; identitas orang terpisah dari akun ERP |
| customer_contacts / contact_functions / customer_contact_functions | customer_contacts: customer_id, contact_id, job_title, department, active, unique(customer_id, contact_id); contact_functions: code, name, active; customer_contact_functions: customer_contact_id, function_id unique pair; memungkinkan beberapa PIC dan beberapa fungsi tanpa menyalin identitas kontak |
| customer_legal_documents / customer_responsible_persons / customer_responsible_licenses | customer_id, document_type, number, issuer, issued_on/expires_on, attachment_id, verification_state; customer_id, person/contact reference, responsibility_type pharmacist/technical/other, effective dates; responsible_person_id, license_type/number/issuer/effective dates, attachment/verification |
| customer_onboarding_verifications | customer_id, revision, channel_requirement_snapshot, legal/tax/contact/NOO verification states, missing_items, reviewer, reviewed_at, decision/reason; upload saja tidak berarti verified |
| customer_credit_policies | customer_id, limit_amount nullable, payment_mode cod/prepay/credit, payment_term_id, grace_days, effective_from/to, version, set_by, reason, approval_reference nullable; pelanggan baru default COD 3 bulan, credit memerlukan TOP/limit yang ditetapkan pengguna berwenang |
| suppliers | code, legal_name, primary_address, primary_phone, technical_responsible_name, tax_profile_id/npwp, bank_detail_reference, active; tanpa TOP tetap, ketentuan pembayaran ditetapkan pada PO |
| supplier_categories / supplier_category_assignments | code/name, active; supplier_id, category_id; mendukung kategori lebih dari satu |
| supplier_contacts / supplier_contact_roles | supplier_id, name, position, phone, email; contact_id, role sales/finance/shipping; satu kontak dapat memiliki beberapa fungsi |
| supplier_legal_documents | supplier_id, document_type, document_number, issued_on, expires_on nullable, attachment_id, verification_state; persyaratan mengikuti kategori/kebijakan |
| supplier_agreements / supplier_agreement_products | supplier_id, agreement_number, version, effective_from/to, state, attachment_id, term_snapshot, currency, order_minimum, freight_terms; agreement_id, product_id, uom_id, price/discount, effective_dates; pemetaan pemasok sesuai MOU, tipe pabrik/importir/sole agent/pemilik izin dapat lebih dari satu |
| vendors / vendor_categories / vendor_category_assignments | code, legal_name/person_name, vendor_type company/individual, address, phone, email, tax_profile_id, responsible_person, bank_verification_state, active; code/name; vendor_id/category_id unique pair |
| vendor_contacts / vendor_contact_roles / vendor_legal_documents / vendor_agreements | vendor/contact identity and role finance/sales/service; legal/tax/permit evidence; contract number/version/effective dates/scope/attachment/state. Supplier dan Vendor tetap berbeda |
| party_bank_accounts | party_type supplier/vendor/customer/employee, party_id, bank/branch, encrypted account number, masked number, account holder, currency, verification_state, verified_by/at, effective_from/to, evidence, active; perubahan diaudit |
| operational_item_categories / operational_items / operational_item_uoms | category code/name/classification; item code/name/specification, base_uom, reference_purchase_price, minimum_stock, preferred_location, stock_controlled, asset_candidate, active; conversion factor/effective dates |
| payment_terms / tax_profiles / party_tax_profiles / tax_rules | due_basis, days, label/effective dates; reusable tax identity/profile; party_type/id, profile_id, PKP/WAPU/withholder roles, TIN/IDTKU, country/document type, verification/effective dates; tax type/code, effective dates, rate, DPP method, recoverable flag, rounding, account/document rule and state |
| price_lists / price_list_items | channel/customer scope, effective dates; product_id, uom_id, currency, price, minimum_margin, discount_limit |
| product_purchase_price_versions | product_id, uom_id, currency, reference_unit_price, effective_from/to, created_by, reason; menyimpan Harga Beli acuan yang diisi pada form produk, terpisah dari valuasi/HPP |
| warehouses / locations | company_id, code, name, address, timezone, responsible_user, active; warehouse_id, code, name, parent_location_id, type receiving/storage/quarantine/transit/consignment/dispatch/return, storage_profile_id, pick_sequence, capacity nullable, active |

## Layar dan API submenu — 23 Oktober 2026

Supplier, Vendor, Gudang › Lokator dan Item Operasional memiliki daftar berhalaman server, detail bertab dengan Riwayat audit, form dengan pemeriksaan kandidat duplikat sebelum simpan, ubah berversi (If-Match/version) serta Aktifkan/Nonaktifkan berizin. Kontrak endpoint di [API](04-api.md). Atribut yang belum memiliki penyimpanan resmi—legalitas Vendor, rekening pembayaran, saldo awal utang, penanggung jawab dan profil penyimpanan Gudang, profil suhu Lokator—ditampilkan "Belum tersedia", bukan diisi field bebas. Produk (tab Kategori Produk dan Satuan) dan Pelanggan (tab Channel dan Rayon) memakai kerangka yang sama sejak 23 Oktober 2026. Pada Produk, izin edar, konversi satuan dan harga acuan ditambahkan dari tab detail melalui command masing-masing; izin edar baru selalu menunggu verifikasi dan bukti disimpan sebagai berkas privat perusahaan. Satuan dasar terkunci setelah produk tidak Draf atau sudah dipakai stok/SO/PO, karena qty transaksi historis bergantung padanya. Kode referensi tidak diubah setelah dibuat; nama dan catatan cakupan rayon dapat diubah berversi.

## Tab Kontak pada Pelanggan — 23 Oktober 2026

Halaman Pelanggan memiliki tab Pelanggan, Channel, Rayon dan Kontak. Kontak bukan resource Master Data baru: tab ini membaca dan mengubah resource `/contacts` yang sama dengan CRM melalui command kontak yang sudah ada, dengan izin `crm_contact.read/create/update`. Pengguna yang hanya memiliki `master_customer.read` tidak melihat tab Kontak, dan pengguna yang hanya memiliki `crm_contact.read` tidak dapat membuka daftar atau detail Pelanggan. Query, ekspor dan data terkait tetap dibatasi pada izin kontak; tidak ada grant induk Master Data yang membuka tab ini.

## Capability submenu operasional — 16 Oktober 2026

IAM-01/04: izin umum `master_data.*` diganti `master_product`, `master_customer`, `master_supplier`, `master_vendor`, `master_warehouse`, `master_locator`, `master_operational_item`, serta `master_product_category`, `master_uom`, `master_customer_channel`, `master_rayon` per tindakan yang sudah tersedia. Penamaan ini berlaku pada implementasi endpoint `/master-data` saat ini. Pengelolaan kontak tetap memakai `crm_contact`; Pelanggan CRM memakai `crm_customer` yang terpisah dari Master Pelanggan. Lookup referensi minimal pada formulir pelanggan tidak memberi akses halaman pengelolaan referensi. Tidak menambahkan hard delete atau mutasi saldo.

## O2C Release 1 (29 Oktober 2026)

Atribut pelanggan dan produk yang dipakai O2C disnapshot pada SO/Surat Jalan/Invoice; perubahan master tidak mengubah dokumen terbit.


## O2C Release 1 (29 October 2026)

Issued Surat Jalan is the handover, stock, revenue and HPP event. One SO supports cumulative Surat Jalan quantities up to ordered quantity; Invoice is created only from an issued Surat Jalan. Termin/TOP is selected on SO and snapshotted. Surat Jalan uses existing outbound permission grants; no delivery_note grants are introduced.

