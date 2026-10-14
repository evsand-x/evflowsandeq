# Dashboard Tugas & Persetujuan dan Laporan & Ekspor

Status 7 Oktober 2026: acuan artefak desain pada catatan historis ini telah dicabut. Pemetaan frame dan perbandingan lama hanya bukti pekerjaan terdahulu, bukan perintah untuk implementasi berikutnya. Panduan aktif: [implementasi web](web-implementation-guide.md) dan [standar global](web-design-standard.md).

## Arah dan cakupan — 29 September 2026

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Pengguna menyetujui penyelesaian dua submenu tersisa, memakai skill tersedia. Keputusan sebelumnya tetap: web dahulu, seluruh layar mengikuti mockup, backend sumber tersedia, review melalui preview dan sesi aktual. Tidak ada keputusan material baru yang perlu ditanyakan ulang.

Acuan Pencil: `ilzbU` (1600×1080) dan `kSyPd` (1600×1060), dibaca dan dirender 29 September 2026 dari artefak desain lama (dicabut). Standar ukuran Ringkasan Eksekutif mengungguli ukuran frame: padding konten, jarak bagian, ukuran KPI, panel kanan 320px, dan kontrol tanggal. Tugas mempunyai tiga KPI sesuai frame, bukan menambah kartu keempat. Laporan tidak mempunyai KPI. Frame tidak mempunyai tombol ekspor header; ekspor berada pada parameter laporan.

## Inventaris cakupan

| Permukaan | Requirement / pemilik | Implementasi tahap ini | Dependensi operasional |
|---|---|---|---|
| Navigasi tujuh submenu | DSH-01, Design 07 | Route actions/reports live dan preview | Tidak ada |
| Antrean personal, cari/filter/sort/cursor | DSH-02, CRM, Dashboard 09 §9 | Backend tindak lanjut prospek milik pengguna dan company aktif; tab persetujuan/selesai eksplisit unavailable | Approval instance dan task domain lain |
| KPI tugas | DSH-01/02 | Total tindak lanjut dan terlambat hanya sumber prospek, diberi label cakupan; persetujuan null | Total lintas domain tidak boleh diklaim lengkap |
| Panel rincian | DSH-02, Setting 15 §5 | Pilihan baris, metadata sumber, tidak ada command approve atau selesai | Layar dokumen asal belum tersedia |
| Katalog lima laporan mockup | DSH-01/03, Dashboard 09 §10/12 | Metadata yang difilter izin domain server | Invoice posted, stock ledger, GL, kehadiran |
| Parameter tanggal, cakupan, format | APP-03/04, Dashboard 09 | Form dan validasi; pratinjau ketersediaan server | Generator laporan dan izin field/export rinci |
| Ekspor saya | DSH-01/03 | Kontrak privat unavailable, fixture hanya preview | Durable report runs/exports, worker/outbox, storage, audit download, OPS-SYS-03 |
| State dan UI stack | APP-03/04, NFR-05 | shadcn, TanStack Query/Table, Sonner, loading/empty/error/denied/unavailable, keyboard dan responsif | Tidak menyatakan mobile selesai |

Tidak menambahkan role/izin baru, memberi grant otomatis, membuat transaksi approval, atau membuat file palsu. Katalog read bukan izin ekspor. Permintaan membuat ekspor diblokir server selama generator dan otorisasi ekspor belum tersedia. Tidak hardcode expiry atau SLA. Tidak ada migration database; read model memakai prospek tersimpan. Laporan biaya/payroll tidak pernah dikirim.

## Kriteria penerimaan

Tujuh submenu menuju layar masing-masing; pencarian/filter menghapus pilihan dan cursor lama; panel tidak menampilkan data setelah 403/error/filter berganti; total berasal dari seluruh hasil server. Akun/company lain tidak masuk antrean, tab Selesai tidak disimpulkan dari hilangnya next action. Katalog tidak bocor lintas izin. Preview ditandai Data simulasi dan tidak memicu ekspor nyata. Validasi input, pengujian API/integrasi, typecheck/build, visual QA dan validator repository wajib dilaporkan.

## Hasil verifikasi

- 37 pengujian lulus pada tujuh file: unit laporan/Finance/HRIS, integrasi Executive/Warehouse/Sales dan antrean tugas, serta HTTP identity/dashboard. Antrean diuji dengan fixture database multi-company/owner, batas bulan WITA, tie cursor, search/sort/total, scope salah, filter/cursor invalid dan sumber unavailable. Laporan menguji izin, tanggal kabisat/invalid, payload privat ditolak schema, dan ekspor tidak menciptakan file. HTTP menguji 401, 403, 400, 200, CSRF dan 409 export gate.
- Office/backend typecheck, focused ESLint, build contracts/backend, dan build produksi Office lulus. Build memiliki peringatan konfigurasi plugin Next ESLint yang sudah ada; focused ESLint lulus. Validator repository lulus (tautan lokal, ID requirement/keputusan, tabel Markdown dan conflict markers).
- Browser aktual: akun Demo Viewer memiliki CRM saja; tab Tindak lanjut menampilkan 0 prospek yang cocok secara sah, persetujuan unavailable. Katalog hanya Penjualan Net, tidak Finance/HRIS. Pratinjau meminta backend dan menampilkan sumber belum tersedia; Buat ekspor menerima penolakan 409, bukan sukses. Tidak ada grant baru atau logout akun pengguna.
- Preview: pilihan baris mengubah detail, pencarian vendor menghasilkan satu baris, filter Finance dua baris, tab Selesai menghapus detail lama. Semua tujuh tautan Dashboard memiliki tujuan yang benar; guard preview lama yang masih memblokir dua submenu telah dihapus.
- Parameter laporan berganti mengikuti pilihan; keyboard native mengubah tanggal, tanggal kosong memberi aria-invalid dan menonaktifkan ekspor. Tombol tanggal menampilkan format Indonesia dan membuka input tanggal. Ekspor simulasi menjelaskan tidak ada file. State loading/empty/error/denied/unavailable kedua layar diperiksa, tanpa fixture nominal/file siap pada state error/denied/loading/unavailable.
- Viewport 1600: KPI tugas tinggi 127,33px dan y=206 sama dengan Ringkasan Eksekutif; tiga kolom sesuai komposisi mockup. Panel kanan 320px. Pada 360px, document clientWidth/scrollWidth sama 350px; tabel menggulir internal. Override viewport direset setelah QA.
- Bukti: [Tugas & Persetujuan](review/dashboard-actions-web.png) dan [Laporan & Ekspor](review/dashboard-reports-web.png). Screenshot memakai viewport normal; halaman penuh dapat ditinjau pada dua route preview.

## Penggunaan stack dan batas akhir

shadcn Card/Button/Input/Field/InputGroup/Select/Table/Tabs/Badge/Empty/Alert/Skeleton digunakan dan dirender; Tabs dan Empty ditambahkan melalui CLI resmi, impor utilitas disesuaikan ke alias lokal. Card lama diberi atribut data-slot tanpa mengganti perilaku atau token. TanStack Query dipakai pada kedua halaman dengan key terisolasi company/user/permissions/filter dan AbortSignal. TanStack Table dipakai pada antrean dengan filtering/sort/cursor server; tabel ekspor saat ini hanya fixture/state unavailable, belum pagination transaksi. Sonner dipakai pada aksi simulasi/belum tersedia; blocker tetap terlihat inline. Native/mobile tidak berlaku untuk tahap web ini.

Tampilan tujuh submenu sudah tersedia untuk review. Modul Dashboard **belum operasional penuh**: approval/delegasi/policy domain, penyelesaian tugas, drill-down dokumen, generator laporan, export permission/field-level privacy, report runs/exports persistence, worker/outbox, private storage/checksum/audit download, OPS-SYS expiry/suppression dan realtime masih harus dibangun bersama sumber domain. Dokumen API 04, Design 07, Dashboard 09 dan panduan implementasi web diperbarui. Tidak ada migration, posting, atau perubahan saldo.
