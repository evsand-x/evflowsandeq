# Sidebar — pengalaman navigasi tahap pertama

Keputusan pengguna 7 Oktober 2026: implementasikan rekomendasi prioritas 1–4, yaitu cabang aktif otomatis, kondisi navigasi bertahan, flyout pada mode ciut, dan indentasi/penanda halaman aktif yang lebih jelas. Biru, Inter, posisi sidebar dan hierarki bisnis tetap. Pencarian menu, favorit, serta perubahan presentasi menu belum tersedia ditunda. Tidak memerlukan persetujuan tambahan.

Requirement: APP-03, NFR-05, IAM-01/04. Sumber hierarki lengkap adalah Design 07 bagian 2 (Dashboard, Sales & Marketing, Warehouse & Logistik, Finance, HRIS, Master Data, Setting); implementasi tetap memakai visibleModules/visibleDashboardViews dan mapping route/permission existing. Batas domain dan snapshot transaksi tidak berubah. Tidak menambah route, permission, API, database atau fitur transaksi.

Inventaris perilaku: Dashboard → tujuh view; Sales → CRM (Prospek/Kontak/Pelanggan), Pesanan Pelanggan (SO/Backorder); Warehouse → Barang Keluar (Pemenuhan & POD); Finance → AR (Invoice & Pembayaran), Kas & Bank (Rekonsiliasi/Mutasi), Akuntansi (Pengaturan Jurnal Otomatis), Pajak (Profil/Aturan/Faktur Keluaran); Master → Pelanggan; Setting → Pengguna/Peran. Tautan kontrol dan seluruh label kelompok existing dipertahankan. Hierarki blueprint yang belum memiliki route tetap merupakan gap sebelumnya, bukan layar selesai pada tahap ini.

Penerimaan: pada SO hanya cabang Sales/Pesanan Pelanggan otomatis terbuka pada sesi navigasi baru; grup lain boleh dibuka manual. Preferensi grup/scroll dipisahkan user/company dan bertahan saat perpindahan komponen halaman; pindah cabang membuka ancestor tujuan tanpa menutup pilihan manual lainnya. Mode ciut bertahan lintas halaman dan reload memakai preferensi browser yang sudah ada. Flyout klik menyediakan nama modul, submenu yang sama, Escape/focus-return, dan tutup setelah navigasi. Mobile tetap drawer. Label panjang membungkus tanpa terpotong; halaman aktif lebih kuat daripada modul induk. Periksa route daftar/detail/edit, antar-modul, keyboard, portal, desktop dan web sempit; jalankan typecheck, lint, tes perilaku yang relevan dan validator.


## Hasil implementasi dan verifikasi

- APP-03/NFR-05: controlled Collapsible, penyimpanan kelompok/scroll dalam memori per user/company, pemulihan cookie mode ciut, Popover untuk submenu desktop. Leaf aktif memakai primer penuh, induk memakai aksen; label membungkus dengan indentasi 12px.
- IAM-01/04: tree submenu/fungsi penyaringan izin dan href dipakai bersama pada expanded/flyout; tidak ada perubahan API, izin, database, atau migrasi.
- TypeScript Office, ESLint berkas TSX terkait, Prettier dan validate-repository lulus.
- Browser operasional: kunjungan awal SO hanya membuka Sales/Pesanan; CRM tertutup. CRM yang dibuka manual tetap terbuka setelah membuka detail SO. Mode ciut bertahan saat pindah ke CRM dan setelah reload. Flyout dapat menavigasi ke Prospek dan kembali ke SO. Escape menutup flyout dan mengembalikan fokus ke pemicu.
- Desktop 1600x1040: computed font Inter; daun aktif biru rgb(6,74,157) dengan teks putih. Label yang diperiksa tidak overflow horizontal. Mobile 390x844: drawer 288px, label tidak overflow, tombol tutup bekerja.
- Stack: React/Next, token semantik, shadcn Collapsible/Popover/Sidebar digunakan dan diuji; TanStack tidak relevan untuk state navigasi ini. Pengujian izin dengan akun kedua dan isolasi antarperusahaan belum dijalankan; filter izin tidak berubah. Persistence scroll diimplementasikan, belum diuji lintas seluruh kombinasi menu.
- Batas bukti: API screenshot browser berulang kali gagal dengan pesan Unable to capture screenshot. Tidak ada screenshot baru yang dapat disimpan; verifikasi visual terbatas pada DOM/computed styles, sehingga review visual akhir masih diperlukan.


## Koreksi berdasarkan review pengguna

Pengguna meminta profil footer rapi dan menu otomatis menutup saudara pada tingkat yang sama. Keputusan ini menggantikan perilaku multi-open sebelumnya: satu modul terbuka; satu cabang submenu per modul terbuka. Menutup modul juga mereset cabang turunannya. Navigasi ke cabang baru membuka hanya jalur aktif. Profil nama/peran satu baris dengan elipsis; daftar peran lengkap tersedia melalui tooltip teks. Izin dan hierarki tetap.
