# Arah baru: evflow yang fleksibel dan mudah dipakai — desain 24 Oktober 2026

Status: draf untuk persetujuan pengguna. Setelah disetujui, dokumen ini menjadi dasar revisi blueprint (`docs/erp-blueprint`), `AGENTS.md`, dan standar desain web, lalu rencana implementasi.

## 1. Maksud dan alasan

Pengguna (pemilik perusahaan, PT Sandeq Sarana Medika) bingung memakai evflow. Pembanding yang dipakai adalah Kledo: pengaturan mata uang, penomoran dokumen, tarif pajak, pengguna dan peran dapat diatur sendiri tanpa dihalangi; Sales Order tidak mewajibkan kredit/TOP di master pelanggan; ongkos kirim dapat ditambahkan sebelum atau sesudah PPN.

Aplikasi dipakai sendiri oleh seluruh tim perusahaan (sales, keuangan, administrasi), bukan dijual sebagai SaaS multi-tenant. Targetnya: terasa seperti ERP SaaS pada umumnya — langsung bisa dipakai, sedikit isian wajib, pengaturan terpusat — tanpa kehilangan kekuatan ERP distribusi yang sudah dibangun (stok batch/FEFO, posting, pajak, audit).

Masalah yang ditemukan pada kondisi sekarang:

- Menu Setting di sidebar menampilkan banyak submenu, tetapi hanya Pengguna dan Peran yang berfungsi. Penomoran, pajak dan kredit tersebar di layar Operasional.
- Proses diblokir bila konfigurasi belum ada (contoh: SO gagal `NUMBERING_RULE_REQUIRED_OR_CONFLICTING`), tanpa nilai bawaan.
- Pelanggan baru dipaksa COD tiga bulan; Tempo mewajibkan TOP, limit kredit dan masa toleransi di master (`TOP_AND_CREDIT_LIMIT_REQUIRED`).
- Ongkir pada SO memakai istilah teknis (penanggung Pelanggan/Perusahaan/Ekspedisi, centang kena pajak).
- Persetujuan hanya ada untuk pengecualian SO; tidak ada mesin persetujuan umum maupun struktur organisasi/atasan.

## 2. Tujuan

1. **Pengaturan terpusat** seperti Kledo: satu menu Pengaturan berisi profil perusahaan, mata uang dan format angka, penomoran dokumen, pajak, termin pembayaran, ongkir, kredit, pengguna, peran, struktur organisasi dan persetujuan. Semua dapat diedit oleh pengguna berizin.
2. **Nilai bawaan siap pakai**: perusahaan langsung mempunyai format nomor per jenis dokumen, PPN aktif, daftar termin, dan kebijakan default, sehingga SO bisa dibuat tanpa menyiapkan apa pun lebih dulu.
3. **Alur Sales Order sampai pembayaran atau retur yang ringan** (prioritas pertama pengguna): SO → alokasi/pengiriman → invoice → pembayaran, serta retur/credit note.
4. **Peran bebas**: pengguna membuat peran sendiri dan mengatur hak akses per menu dan per tindakan; tidak ada peran preset yang dipaksakan.
5. **Mesin persetujuan umum** dengan struktur organisasi (atasan langsung).
6. **Menu jujur**: menu yang belum berfungsi tidak tampil.

## 3. Bukan tujuan

- Multi-tenant/penjualan SaaS ke perusahaan lain, billing langganan, onboarding publik.
- Transaksi multi-mata uang (kurs, selisih kurs, revaluasi). Untuk saat ini hanya Rupiah; Pengaturan mengatur format angka/pembulatan. Kolom mata uang yang sudah ada dipertahankan agar multi-mata uang dapat ditambah kelak.
- Menulis ulang aplikasi atau seluruh tampilan Office dari nol.
- Aplikasi Field (tetap ditunda).
- Mengubah mesin posting, ledger, stok atau pajak yang sudah teruji, selain bagian yang disebut di dokumen ini.

## 4. Anti-tujuan (gagal walau "berjalan")

- Fleksibilitas yang membuat data keuangan bisa diubah diam-diam: dokumen posted diedit, saldo diketik ulang, nomor terpakai didaur ulang, perubahan tarif mengubah transaksi lama.
- Izin yang hanya disembunyikan di UI tetapi terbuka di API.
- Persetujuan yang macet tanpa jalan keluar (tidak ada approver) atau lolos otomatis tanpa jejak.
- Form yang kembali dipenuhi isian wajib dan istilah teknis.

## 5. Batasan yang tetap berlaku (invariant)

Tetap dijaga backend dan tidak menjadi toggle: jurnal posted seimbang; posted/issued record tidak diedit/dihapus langsung; koreksi lewat reversal/adjustment/retur/credit note; saldo stok, AR/AP, kas/bank, GL, payroll tidak diketik ulang; idempotency; nomor resmi tidak didaur ulang; alokasi/pembayaran tidak melebihi saldo/qty sah; batch recall/expired/blocked/karantina tidak dapat dikirim; izin, scope dan isolasi perusahaan diperiksa backend; dokumen issued menyimpan snapshot identitas, nilai, tarif dan policy; uang memakai `numeric`/decimal.

Perubahan pengaturan (tarif pajak, format nomor, termin default, aturan persetujuan) berlaku untuk dokumen baru sejak disimpan; dokumen yang sudah diterbitkan memakai snapshot-nya.

## 6. Pendekatan

| Pendekatan | Ringkas | Trade-off |
|---|---|---|
| **A. Perbaiki bertahap di atas aplikasi yang ada (dipilih)** | Pertahankan backend; longgarkan aturan yang terlalu kaku; bangun Pengaturan terpusat, nilai bawaan, alur SO ringan, peran, struktur organisasi dan persetujuan | Hasil bertahap, risiko rendah; sebagian kerumitan lama tersisa di area yang belum disentuh |
| B. Tulis ulang seluruh tampilan Office | UI baru gaya Kledo di atas API sekarang | API dibentuk untuk alur kaku; UI baru terbentur aturan backend sehingga kerja dobel |
| C. Mulai ulang aplikasi | Bebas sepenuhnya | Membuang posting, FEFO, pajak, audit yang teruji; berbulan-bulan; risiko tertinggi |

Pengguna memilih A dan meminta mulai dari revisi dokumen.

## 7. Keputusan pengguna (24 Oktober 2026)

### 7.1 Pengaturan dan nilai bawaan

- Semua parameter bisnis diatur lewat Pengaturan dan dapat diedit: mata uang/format angka, penomoran, pajak, termin, ongkir, kredit, persetujuan.
- **Profil Perusahaan** (nama perusahaan, alamat, kontak, NPWP, logo) diedit langsung di Pengaturan dan dipakai pada tampilan aplikasi serta dokumen baru; dokumen yang sudah terbit menyimpan snapshot (IAM-10 tetap, halaman wajib dibangun). Nama perusahaan tidak boleh tertulis tetap di kode atau dokumen panduan sebagai identitas aplikasi.
- Konfigurasi yang dibutuhkan transaksi **dibuat otomatis dengan nilai bawaan** saat perusahaan disiapkan (seed/migrasi untuk perusahaan yang sudah ada). Proses hanya tertahan bila pengguna sendiri menonaktifkan/mengosongkan konfigurasi wajib, dengan pesan yang menunjuk halaman Pengaturan terkait.
- Ini menggantikan aturan "konfigurasi wajib yang hilang memblokir proses" sebagai perilaku awal. Larangan hardcode tetap: nilai bawaan disimpan sebagai data konfigurasi yang dapat diedit, bukan konstanta di kode.

### 7.2 Sales Order, termin dan kredit

- **Termin (TOP) dipilih pada SO/invoice**: Tunai/COD, Bayar sebelum kirim, atau Tempo N hari (daftar termin di Pengaturan, bisa diketik). Bila pelanggan punya termin bawaan, nilai itu terisi otomatis dan tetap dapat diganti pada dokumen, kecuali dikunci oleh kebijakan.
- **Master pelanggan tidak wajib mengisi TOP/limit kredit.** Aturan "pelanggan baru wajib COD tiga bulan" menjadi kebijakan opsional (default: nonaktif).
- **Limit kredit menjadi fitur opsional** dengan mode per perusahaan: Nonaktif / Peringatan saja / Blokir (default: Peringatan). Saat Blokir, pengecualian memakai persetujuan (lihat 7.4).
- Isian wajib SO minimal: pelanggan, tanggal, barang, jumlah, harga. Sisanya punya nilai bawaan.

### 7.3 Ongkos kirim

- Ongkos kirim pada SO punya dua pilihan:
  - **Ditanggung perusahaan**: tidak ditagihkan; biaya kirim aktual dibukukan sebagai COGS/biaya pengiriman.
  - **Dibebankan ke pelanggan**: muncul sebagai baris **Ongkos kirim** di bagian total SO/proforma/invoice, dengan pilihan **Sebelum PPN** (masuk DPP) atau **Sesudah PPN** (tidak dikenai pajak).
- Pilihan bawaan dan akun jurnal untuk masing-masing pilihan diatur di Pengaturan; tidak ada akun yang ditulis tetap di kode.
- Pencatatan teknis FIN-12 (biaya aktual ekspedisi, penanggung, tagihan ekspedisi terpisah, pencegahan biaya ganda) tetap berlaku di backend dengan nilai bawaan; tidak ditampilkan di form SO kecuali dibuka pengguna.

### 7.4 Persetujuan

- **Mesin persetujuan umum** yang dapat dipasang ke jenis dokumen apa pun. Jenis awal: Sales Order, Permintaan Biaya, Perjalanan Dinas, Entertain, Call Plan Harian, Rekonsiliasi, Cuti. Jenis lain dapat ditambah tanpa mengubah mesin.
- **Persetujuan SO diperbolehkan** sebagai aturan yang dapat dinyalakan. Ini mencabut larangan "SO normal tanpa approval manual rutin" (OTC-01, IAM-02, IAM-07, invariant 15 §9 dan 40 §9, `AGENTS.md`, 00-document-map). Tanpa aturan yang aktif, SO langsung berjalan seperti sekarang.
- Per jenis dokumen diatur: aktif/nonaktif; kondisi (selalu, nilai > X, diskon > Y%, pelanggan menunggak/lewat limit, dan kondisi lain yang didukung); tahap berurutan; per tahap pemberi persetujuan dan cukup-satu/semua.
- **Sumber pemberi persetujuan per tahap**: atasan langsung pembuat; atasan N tingkat di atasnya; kepala departemen; orang tertentu; peran tertentu.
- Kotak masuk **Perlu Persetujuan** lintas jenis dokumen, aksi Setujui / Tolak / Minta Revisi dengan catatan, notifikasi, riwayat keputusan.
- Dokumen terkunci selama menunggu; perubahan material setelah disetujui memicu persetujuan ulang.
- Pembuat tidak menyetujui dokumennya sendiri kecuali diizinkan eksplisit per jenis dokumen. Admin Sistem tetap dapat memutus dan tercatat di audit (keputusan IAM 16 Oktober tetap).
- Delegasi saat atasan berhalangan untuk periode tertentu.
- Tidak menemukan pemberi persetujuan (tidak punya atasan, atasan = diri sendiri, posisi kosong) → dialihkan ke Admin Sistem, tidak macet dan tidak otomatis disetujui.
- Ini memperluas IAM-07/08/09 yang sudah ada di 15-setting.md, bukan mengganti seluruhnya.

### 7.5 Struktur organisasi

- Pengaturan → Struktur Organisasi: Departemen, Jabatan, dan **atasan langsung** per karyawan; tampilan bagan.
- Struktur dibangun di atas **data karyawan**, bukan akun login: ada karyawan tanpa akun (misal sopir, staf lapangan) yang tetap menjadi bawahan atau penyetuju. Akun pengguna ditautkan opsional ke satu karyawan. Usulan pembangun: memberi keputusan persetujuan memerlukan akun login. Bila atasan yang dituju tidak punya akun, persetujuan naik ke atasan berikutnya yang punya akun, lalu ke Admin Sistem; jalur ini tercatat di riwayat.
- Struktur ini sumber kebenaran untuk "atasan langsung" pada persetujuan dan scope "bawahan saya". Bila HRIS dibangun, data karyawan memakai struktur yang sama, bukan salinan.

### 7.6 Peran dan hak akses

- **Tidak ada peran preset yang dipaksakan.** Pengguna membuat peran dengan nama bebas.
- Hak akses diatur dalam tabel: menu (baris, mengikuti urutan navigasi) × tindakan (Lihat, Buat, Ubah, Hapus, Setujui, Ekspor, dan tindakan bisnis yang nyata). Pilih Semua per modul dan per kolom; **salin dari peran lain**.
- **Cakupan data** per izin: milik sendiri / bawahan / departemen / seluruh perusahaan.
- Izin independen per submenu dan penegakan backend (keputusan 16 Oktober) tetap berlaku — itulah dasar fleksibilitas yang diminta.
- Admin Sistem tetap berhak penuh dan dilindungi.

### 7.7 Menu dan tampilan

- Menu/submenu yang belum berfungsi **disembunyikan** dari navigasi (menggantikan "menu belum operasional tetap terlihat"). Pengaturan menu yang belum dibangun tidak muncul di matriks izin.
- Prinsip kemudahan ditambahkan ke standar desain web: isian wajib minimal dan bertanda jelas; nilai bawaan terisi; label bahasa bisnis, bukan istilah teknis/kode; buat-cepat dari dropdown (misal pelanggan/produk baru); bantuan singkat pada isian yang jarang dipahami; draft tidak hilang; pesan error menjelaskan cara memperbaiki dan menautkan ke Pengaturan terkait.
- Standar visual 23 Oktober (warna logo, struktur halaman) tetap; standar dirapikan agar menjadi satu panduan, bukan aturan piksel yang menghambat.

### 7.8 Keputusan pembangun (usulan, mohon dicek pengguna)

- **Urutan SO dengan persetujuan aktif**: Ajukan → validasi data → *persetujuan SO (bila aturannya cocok)* → pemeriksaan kredit → alokasi stok. Selama menunggu persetujuan, stok **tidak** direservasi; posisi antrean alokasi dihitung sejak disetujui. Stok tetap terlihat sebagai informasi.
- **Unlock kredit digabung ke mesin persetujuan umum**: saat mode kredit Blokir menahan SO, pengguna mengajukan pengecualian melalui jenis dokumen/kondisi "SO melewati limit/menunggak". Tabel dan kode unlock lama dimigrasikan, bukan dipertahankan sebagai jalur kedua.
- **Pengelolaan Pengguna, Peran dan Hak Akses tetap khusus Admin Sistem** (IAM-04 tetap), untuk mencegah pengguna menaikkan haknya sendiri. Pengaturan lain (penomoran, pajak, termin, ongkir, kredit, persetujuan, struktur organisasi) memakai izin per submenu sehingga dapat didelegasikan.
- **Migrasi**: aplikasi belum dipakai di production, sehingga data development lokal langsung memakai nilai bawaan baru. Peran lama tetap ada sebagai peran biasa yang dapat diedit/dihapus; grant tidak diperluas. Grant untuk menu yang disembunyikan dipertahankan di database dan berlaku lagi bila menu itu dibangun.
- **Termin**: ditetapkan di SO (bawaan dari pelanggan bila ada), diwarisi invoice, dan dapat diubah sebelum invoice diposting oleh pengguna berizin. Penggabungan beberapa POD ke satu invoice tetap hanya untuk termin yang sama; jatuh tempo = tanggal dasar + hari termin. "Dikunci" berarti opsi per pelanggan "termin tidak boleh diubah di dokumen".

## 8. Urutan kerja

1. **Revisi dokumen** (langkah ini): README (register keputusan), 00-document-map, 01-prd, 02-requirements (OTC-01/02/03, IAM-02/04/06/07/08/09, FIN-12 dan requirement terdampak), 06-user-flow, 07-design, 10-sales-marketing, 12-finance, 13-hris (struktur organisasi), 15-setting, 39/40 (nilai bawaan dan invariant), 03/04/05/08 sesuai dampak, `AGENTS.md`, `docs/mockup/web-design-standard.md`, skill `evflow-erp-builder` bila memuat aturan yang dicabut.
2. Pengaturan terpusat + nilai bawaan (prasyarat SO).
3. Alur SO → pengiriman → invoice → pembayaran / retur yang ringan.
4. Halaman Peran & Hak Akses yang lebih mudah + Struktur Organisasi + mesin persetujuan umum (dipasang ke SO lebih dulu).
5. Pengajuan karyawan (biaya, dinas, entertain, call plan, cuti) memakai mesin yang sama.
6. Rekonsiliasi dan jenis dokumen lain.

Setiap langkah 2–6 mendapat rencana implementasi sendiri dan diuji pada route operasional dengan sesi dan izin nyata.

## 9. Diserahkan kepada pembangun

- Bentuk tabel/kolom database untuk struktur organisasi, aturan persetujuan dan nilai bawaan, mengikuti pola yang ada (policy bertanggal efektif, audit, outbox).
- Daftar kondisi persetujuan tahap pertama selain yang disebut di 7.4.
- Isi tepat nilai bawaan (format nomor per jenis, daftar termin) berdasarkan dokumen 39/40 yang sudah ada.
- Migrasi data development lokal; tidak ada seed fiktif ke production.
