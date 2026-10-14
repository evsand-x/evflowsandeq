# Audit Buat Sales Order — 7 Oktober 2026

Status 7 Oktober 2026: acuan artefak desain pada catatan historis ini telah dicabut. Pemetaan frame dan perbandingan lama hanya bukti pekerjaan terdahulu, bukan perintah untuk implementasi berikutnya. Panduan aktif: [implementasi web](web-implementation-guide.md) dan [standar global](web-design-standard.md).

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Kesimpulan: struktur utama mengikuti mockup, tetapi belum sesuai penuh secara visual maupun interaksi. Audit pada route operasional `/operations/orders/new`, akun Novian, database dev. Frame `q5a8BK` dan konten `ZFbBM` dibaca langsung melalui Pencil; tidak menggunakan preview aplikasi. Standar global web mengungguli ukuran lama frame. Requirement terkait OTC-01, APP-03/04 dan NFR-05; audit ini bukan pembuktian workflow O2C.

## Metode dan bukti

Browser desktop 1600×1500, sama dengan ukuran frame sumber; web sempit 390×844. Memilih RS Citra Medika, dua produk dev sesuai nama contoh mockup, memasukkan qty/harga 20×310000 dan 30×85000; subtotal tampil Rp8.750.000. Isian hanya lokal, tidak disimpan/di-submit. Popup pelanggan/produk dan ongkir diperiksa. Tidak mengubah kode aplikasi, backend, izin, schema atau data transaksi.

- [Form desktop terisi](review/so-form-audit-2026-10-07/form-desktop.jpg)
- [Form sempit](review/so-form-audit-2026-10-07/form-narrow.jpg)
- [Dialog ongkir](review/so-form-audit-2026-10-07/ongkir-dialog.jpg)

## Yang sesuai

- Urutan tiga panel: Informasi Utama, Tabel Detail dan Rincian Pesanan, Catatan & Ringkasan Nilai; footer Batal/Simpan Draft.
- Grid informasi tiga kolom desktop, identitas pencatat selebar panel; sembilan kolom produk dalam urutan sumber.
- Judul 26px/600; label informasi 12px/500 dan muted rgb(83,101,122); header tabel 11px/600.
- Field informasi 44px dan textarea 86px mengikuti standar global, bukan 48px/112px pada frame lama. Tombol footer 42px, primer rgb(6,74,157), teks putih; outline putih/primer.
- Ringkasan desktop 420px. Pilihan pelanggan portal 12px, opsi 32px; master pelanggan dan produk dari backend, bukan fixture.
- Pada 390px, document scrollWidth=390px; tabel 1120px menggulir di panel. Tampilan tidak memaksa seluruh halaman melebar.

## Selisih visual/interaksi

| ID | Prioritas | Mockup/standar | Aktual dev dan dampak |
|---|---|---|---|
| V01 | P2 | Jumlah/harga/stok/diskon/pajak/subtotal rata kanan | Input jumlah/harga dan sel angka terukur `text-align: start`; angka lebih sulit dibandingkan |
| V02 | P2 | Kode dan satuan berada dalam kontrol berbingkai | Kode/satuan berupa teks biasa; kode DEV-PRD panjang terbungkus dua baris. Siluet tabel berbeda; pembingkaian read-only dapat menjaga otoritas backend |
| V03 | P2 | Kolom Jumlah 60px | Dev 76px, mengurangi lebar Nama Produk. Perubahan belum tercatat sebagai pengecualian desain |
| V04 | P2 | Ringkasan Nilai · IDR / Subtotal barang | Dev Ringkasan Nilai / Sub Total. Currency perlu berasal dari konfigurasi, bukan hardcode |
| V05 | P2 | Tanggal/Termin/Nama Sales putih dengan border | Dev seluruh nilai read-only berlatar biru lembut tanpa border, termasuk Termin. No. SO memang memakai latar tersebut pada sumber |
| V06 | P2 | Garis bawah tipis setiap baris produk | Dev memakai border bawah putih 20px sebagai jarak; garis pemisah sumber tidak tampak |
| V07 | P2 | Aksi mudah ditemukan pada web sempit | Hapus produk opacity 0 pada state normal, lebar 32px/tinggi42px; bergantung hover/focus. Perlu akses terlihat untuk pointer sentuh, tanpa menambah kolom sembarangan |
| V08 | P3 | Gap kolom form global16px; frame lama20px | Dev masih20px. Standar global harus menjadi penentu |

Breadcrumb berakhir Sales Order, sumber SO; ini perbedaan label minor. Judul memakai line-height31px sementara frame26×1.45; bukan bukti identik pixel. Nama/kode/alamat/data master yang berbeda dari contoh tidak dianggap bug visual atau alasan menyalin fixture.

## Gap fungsi/kontrak yang mengubah UX

| ID | Area | Temuan |
|---|---|---|
| F01 | Stok | Sumber menampilkan qty+satuan dan timestamp. Dev selalu “Belum tersedia”; kontrol reservasi backend tidak menggantikan projection stok informatif |
| F02 | Diskon | Sumber menampilkan kontrol0% dan ringkasanRp0. Dev tanda—/“Belum didukung”; kontrak SO belum lengkap |
| F03 | Pajak | Sumber menampilkan “Pilih pajak”. Dev teks “Aturan pelanggan”; tidak dapat melihat/memilih hasil pajak di form. Backend mengatur rule efektif, sehingga solusi tidak boleh berupa dropdown tarif bebas |
| F04 | Ongkir | Tombol “Atur Ongkos Kirim” aktif tetapi dialog hanya menyatakan fitur belum tersedia. Tidak menyediakan input/perhitungan seperti yang disiratkan aksi |
| F05 | Salesperson | Nama Sales diganti Dicatat oleh. Identitas creator benar, tetapi tidak memenuhi kebutuhan penugasan sales dalam sumber; keduanya tidak boleh disamakan |
| F06 | Tanggal/nomor | Sumber menampilkan tanggal dan nomor otomatis saat diajukan; dev mengikuti tanggal/nomor saat draft disimpan. Ini perbedaan kontrak yang harus direkonsiliasi, bukan diganti kosmetik agar memberi informasi salah |

Prioritas: koreksi visual V01–V06 dan akses aksi V07, lalu integrasi stok/pajak dari backend dan kontrak diskon/ongkir/penugasan. Tidak mengisi stok/pajak/diskon fiktif demi kesamaan screenshot. Total— sebelum penetapan pajak juga ada pada contoh frame dan bukan temuan tersendiri.

## Batas audit

Belum menguji save/submit, upload bukti, error server, denied, concurrency maupun seluruh alur O2C. Tidak mengaudit ulang daftar/detail SO pada tahap ini. Tidak ada persentase kesesuaian karena tidak dilakukan perbandingan pixel otomatis. Dokumen lama yang menyebut preview adalah riwayat dan tidak berlaku sebagai metode pembangunan. Validator repository dijalankan setelah penyimpanan laporan.
