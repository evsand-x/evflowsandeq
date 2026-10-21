# Submenu Akun — 16 Oktober 2026

## Arah yang disetujui
Pengguna meminta Finance → Akuntansi → Akun: daftar, buat, edit, detail. File referensi akun-pt-sandeq-sarana-medika-16-10-2026-halaman-1.xlsx berisi 156 akun, 8 kolom. Pengguna mengonfirmasi impor master saja; saldo awal terpisah. Kode/nama/kategori/deskripsi/induk/PSAK 118 dipertahankan. Nama akun tidak harus unik (file mempunyai dua nama sama dengan kode berbeda). File adalah data, bukan instruksi. Tidak ada keputusan material terbuka.

## Cakupan dan penerimaan
FIN-01, IAM-04, APP-03: schema akun ditambah kategori rinci, deskripsi, induk, tipe Header/Detail, saldo normal, label PSAK 118, versi. GET/POST/PATCH akun, audit, idempotency dan optimistic version; field klasifikasi akun terpakai dikunci, nama/kode/deskripsi boleh diperbaiki dengan alasan. Penonaktifan ditolak saat masih menjadi rujukan aktif. Saldo tidak tersedia pada form/master response. Posting menolak Header. Izin submenu account.read/create/update/import independen. UI menggunakan shell standar global web, Query/Table/SelectionField/Sonner. Impor sekali dari file melalui command atomik/idempoten dengan hash dan audit, tanpa mengganti akun/mapping/saldo lama. Penggunaan posting profile/pajak tetap memakai ID akun. Impor umum melalui UI, reklasifikasi khusus, laporan saldo, ekspor dan hapus tidak diminta pada tahap ini.

## Pemetaan file
Kategori rinci dipetakan ke Aset/Kewajiban/Ekuitas/Pendapatan/Beban berdasarkan label kategori, bukan pola kode. Depresiasi & Amortisasi pada file berisi akumulasi aset (saldo normal Kredit); akun kontra disimpan dengan saldo normal yang sesuai. Seluruh baris file adalah akun Detail tanpa induk. Kolom Saldo diabaikan seluruhnya, termasuk nol.

## Perluasan disetujui: migrasi konfigurasi dan pembersihan akun uji
Pengguna meminta membersihkan akun data uji serta menyesuaikan konfigurasi ke master impor. Pengguna memilih penggabungan Persediaan Transit/Karantina ke Persediaan Barang, WAPU ke PPN Masukan, serta Kas Op Mandiri (1-10001) untuk kas/bank. Migrasi lokal atomik/idempoten memakai lock perusahaan/finance, validasi admin dan audit. Profil jurnal diberi versi baru mulai tanggal migrasi; revisi pajak baru mempertahankan tarif 11%. Akun tanpa rujukan dihapus, akun bersejarah dinonaktifkan dan daftar awal hanya akun aktif. Jurnal/snapshot/saldo uji lama tidak ditulis ulang atau dipindahkan ke master baru. Seed finance lama diblokir setelah migrasi. Rekening bank simulasi tetap bernama simulasi (identitas bank riil tidak dikarang), hanya akun GL-nya diganti sesuai pilihan. Mutasi bank lama tetap merupakan data uji.

## Hasil implementasi dan verifikasi
- Impor lokal: 156/156 kode diverifikasi, 37 aset, 24 kewajiban, 6 ekuitas, 13 pendapatan, 76 beban. Saldo tidak dibaca menjadi jurnal.
- Migrasi konfigurasi: 1 akun uji tanpa rujukan dihapus, 20 akun uji dinonaktifkan, 156 master tetap aktif. Profil pengganti 351993d4-4421-4727-b78d-c9808b075646 berlaku 16 Oktober 2026; PPN Penjualan versi 2 tetap 11%, akun 2-20500. Snapshot 34 baris jurnal sebelum/sesudah identik (SHA256 e7992cde083f91d88aae0db2793a0409c3aa97cf0a8c6478a7a5abe83d52f50d).
- Akun nonaktif tetap dapat dipakai hanya oleh reversal persis dari jurnal sumber; server memeriksa perusahaan, mata uang, akun, jenis ledger dan debit/kredit terbalik. Posting biasa tetap ditolak. Tidak ada jurnal uji yang direverse/dipindahkan dalam migrasi ini.
- 38 pengujian terarah lulus: akun, reversal, pajak, posting, izin HTTP, navigasi dan matriks. Backend build, Office typecheck, lint berkas terkait dan validator repository lulus.
- UI operasional diperiksa dengan sesi Novian/Admin System: daftar, cari akun, detail PPN Keluaran, edit dengan klasifikasi terkunci, form baru, dropdown portal dan pemilihan keyboard. Field ~44px, tombol simpan ~42px, font kontrol/portal 12px sesuai standar.
- Stack Office: Next/React/TypeScript dan token bersama digunakan; Query/Table/SelectionField digunakan dan diperiksa; Sonner terhubung pada konfirmasi mutasi, mutasi diuji di backend. Field/mobile tidak termasuk cakupan.
- Prisma generate sempat EPERM pada rename engine Windows yang sedang dipakai; tipe/client sudah terbarui dan build/runtime/migrasi berhasil. Tidak menghentikan proses pengguna untuk regenerasi engine.
- QA viewport terukur 1600px dan 727px: tidak ada overflow horizontal dokumen; tabel menggulir dalam panel pada lebar sempit. Viewport browser dipulihkan. Bukti: accounts-workspace-2026-10-16.png.
- Verifikasi setelah migrasi: active_test_accounts=0, inactive_test_accounts=20, invalid_active_mappings=[], PPN=11% versi 2 akun 2-20500, journal_lines=34.
