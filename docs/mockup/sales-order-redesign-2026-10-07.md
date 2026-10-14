# Perombakan layout Sales Order — 7 Oktober 2026

Status 7 Oktober 2026: acuan artefak desain pada catatan historis ini telah dicabut. Pemetaan frame dan perbandingan lama hanya bukti pekerjaan terdahulu, bukan perintah untuk implementasi berikutnya. Panduan aktif: [implementasi web](web-implementation-guide.md) dan [standar global](web-design-standard.md).

## Keputusan pengguna dan cakupan

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Pengguna meminta perbaikan Daftar, Buat/Edit, dan Detail Sales Order karena belum puas dengan tampilan yang mengikuti artefak desain lama (dicabut). Pengguna memilih: **Rombak layout Sales Order, pertahankan biru/Inter dan sidebar saat ini**. Permintaan ini mengizinkan implementasi pada route operasional dan menggantikan kewajiban menyalin komposisi frame AmndB/q5a8BK/ZkDEz untuk ketiga permukaan tersebut. Mockup menjadi bukti awal; standar global tetap mengatur identitas visual dan komponen. Tidak ada perubahan tema produk, navigasi, izin, API, database, atau aturan transaksi.

## Rencana dan inventaris penerimaan

| Permukaan | Route | Requirement | Perubahan yang direncanakan | Kontrol yang dipertahankan |
|---|---|---|---|---|
| Daftar (AmndB) | `/operations/orders` | OTC-12, APP-03/04, NFR-05 | Hirarki nomor/pelanggan, angka rata kanan, ringkasan lebih ringkas, filter dan reset jelas | Pencarian/filter/pagination server, visibilitas kolom, summary company, loading/error/empty |
| Buat/Edit (q5a8BK) | `/operations/orders/new`, `/operations/orders/:id/edit` | OTC-01/02/03, APP-03/04, NFR-05 | Kelompok pelanggan/pengiriman, metadata ringkas, tabel produk fokus pada input, ringkasan kanan, aksi simpan mudah dijangkau | Decimal, lampiran wajib, lookup API, alasan revisi, dirty guard, pending/idempotency, izin server |
| Detail (ZkDEz) | `/operations/orders/:id` | OTC-04/05/10/11/12, APP-03/04, NFR-05 | Header dokumen, status berlabel, rincian produk, panel nilai, pemenuhan/dokumen terpisah, aksi utama di atas | Perintah submit/revisi/evaluasi/tutup/batal, snapshot pajak, riwayat, dokumen privat, cetak |

Rekomendasi agent: menggabungkan kode/nama produk; memindahkan keterangan stok/diskon yang belum tersedia ke informasi kontekstual; memakai pemisah baris dan input numerik rata kanan; aksi hapus selalu terlihat; ringkasan pada sisi kanan di desktop dan menumpuk di web sempit. Detail pajak tetap terlihat per produk. Tidak mengisi nilai unavailable dengan angka simulasi. Tidak membuat route preview.

Di luar tahap ini: integrasi availability, diskon/ongkir, penugasan salesperson, perubahan workflow O2C, mobile Field. Sumber: domain 10 bagian Sales Order-to-Cash; Requirements OTC-01–05/10–12; User Flow 1; Design 4–6; Database 4; API 3 dan kontrak operasional 5 Oktober; Architecture 1/2 dan cache UI; Features Sales & Marketing. Kebijakan bisnis tetap backend, tidak ada parameter OPS baru.

Kriteria: ketiga route operasional dapat ditinjau, desktop dan 390px tanpa overflow halaman, keyboard/popup/form berfungsi, nilai uang tetap string Decimal, data/aksi yang belum tersedia dijelaskan, typecheck/lint/validator lulus. Periksa navigasi baca dan interaksi lokal tanpa mengajukan atau mengubah transaksi tersimpan hanya untuk QA visual. Bukti dan keterbatasan dicatat setelah validasi.

## Hasil implementasi dan pemeriksaan

Daftar menampilkan nomor dan pelanggan pada baris terpisah, nilai rata kanan dengan label sebelum pajak, kartu ringkasan, reset filter, dan status terpisah. Placeholder Query dibatasi daftar SO milik company/user yang sama sehingga pencarian tidak kehilangan fokus; data lama ditandai saat hasil baru dimuat. Tidak memakai placeholder lintas detail atau lintas sesi.

Form mengelompokkan pelanggan/pengiriman, produk, dan catatan; metadata serta ringkasan nilai berada di kanan desktop. Kode/satuan menjadi metadata produk; tabel input berisi Produk, Jumlah, Harga satuan, Subtotal, dan aksi hapus yang selalu terlihat. Field wajib dan lampiran lebih jelas. Sticky footer menampilkan status perubahan dan simpan/batal. FieldGroup memakai container-type normal agar grup tidak kehilangan tinggi saat viewport berubah. Detail memisahkan ringkasan status berlabel, pelanggan/pengiriman, produk, pemenuhan/dokumen, nilai dan catatan. Aksi dokumen berada di atas; Ajukan SO merupakan aksi primer untuk Draft berizin, cetak/revisi sekunder. Tombol pengaturan ongkir yang hanya membuka pesan unavailable dihapus; keterbatasan tetap dijelaskan di ringkasan.

| Sumber lama | Route | Bukti hasil desktop | Bukti web sempit |
|---|---|---|---|
| AmndB | `/operations/orders` | [Daftar](review/sales-order-redesign-2026-10-07/sales-order-list-desktop.jpg) | [390px](review/sales-order-redesign-2026-10-07/sales-order-list-mobile.jpg) |
| q5a8BK | `/operations/orders/new` | [Form terisi lokal](review/sales-order-redesign-2026-10-07/sales-order-form-desktop.jpg) | [390px](review/sales-order-redesign-2026-10-07/sales-order-form-mobile.jpg) |
| q5a8BK | `/operations/orders/:id/edit` | [Edit](review/sales-order-redesign-2026-10-07/sales-order-edit-desktop.jpg) | [390px](review/sales-order-redesign-2026-10-07/sales-order-edit-mobile.jpg) |
| ZkDEz | `/operations/orders/:id` | [Detail](review/sales-order-redesign-2026-10-07/sales-order-detail-desktop.jpg) | [390px](review/sales-order-redesign-2026-10-07/sales-order-detail-mobile.jpg) |

Review memakai sesi Novian dan empat draft database dev yang sudah ada. Desktop 1600×1040; web sempit 390×844, document scrollWidth 380px (scrollbar internal browser), tanpa overflow horizontal halaman. Tabel produk 650px menggulir di panel. Input angka computed text-align right; tombol hapus sempit 44×44px dan opacity 1. Menu Kolom memakai font 12px/baris 32px. Panel padding terukur dikoreksi agar tidak bertumpuk dengan padding global.

Pemeriksaan yang lulus: pencarian Citra menghasilkan satu SO, reset mengembalikan empat, filter Open menghasilkan empty state yang benar, menu Kolom/Escape, lookup pelanggan/produk dari API, dua baris input lokal 20×310000 + 30×85000 menghasilkan subtotal Rp8.750.000, tambah baris, format harga saat blur, dialog batal untuk dirty form, navigasi Detail/Edit serta field alasan revisi. Fokus pencarian tetap pada input setelah refetch. Isian QA dibuang; tidak menyimpan revisi, mengunggah bukti baru, submit, alokasi atau posting. Log browser terakhir tidak memuat error. Permintaan daftar SO tanpa sesi menghasilkan HTTP 401.

Stack: Next.js/React, komponen shadcn existing (Card/Button/Field/Dialog/Popover/Table), token bersama dan TanStack Query/Table **digunakan dan diperiksa pada render**. CLI shadcn info/docs mengonfirmasi konfigurasi Tailwind v4/Radix. Sonner tetap digunakan oleh command existing, tetapi **notifikasi mutasi belum diuji ulang**. Realtime lintas klien/denied role/error jaringan/cetak browser dan workflow O2C **belum diuji**. Field/native **tidak berlaku** pada cakupan ini. Tidak ada dependency aplikasi baru, perubahan API, permission, migration atau backend.

Typecheck Office dan ESLint kedua file TSX lulus; validator repository lulus. Keterbatasan availability, diskon/ongkir, kredit summary, salesperson dan lookup 250 tetap seperti baseline. Hasil ini menyelesaikan perombakan layout dan pemeriksaan UI yang dicatat, bukan sertifikasi seluruh proses O2C atau parity pixel terhadap mockup lama.
