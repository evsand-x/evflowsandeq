# Matriks hak akses — 7 Oktober 2026

Status 7 Oktober 2026: acuan artefak desain pada catatan historis ini telah dicabut. Pemetaan frame dan perbandingan lama hanya bukti pekerjaan terdahulu, bukan perintah untuk implementasi berikutnya. Panduan aktif: [implementasi web](web-implementation-guide.md) dan [standar global](web-design-standard.md).

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Arah pengguna: sesuaikan UI/UX matriks dengan mockup, langsung pada aplikasi development operasional. Acuan frame `j4z8e7` (420, 1600 × 1400) di artefak desain lama (dicabut), diinspeksi melalui Pencil. Standar global pada `web-design-standard.md` tetap mengatur shell. Tidak ada keputusan material terbuka.

Cakupan IAM-01/04/11, APP-03/04 dan NFR-03/05: route `/setting/roles/[id]/permissions`, detail peran, tab CRUD/tindakan khusus/cakupan/anggota/riwayat, legenda, matriks berkelompok, batas perubahan dan tinjauan sebelum menyimpan. Data role dan permission berasal dari API existing; akses hanya Admin Sistem dengan permission terkait. Grant di luar company tetap dipertahankan. Tidak mengubah assignment atau grant dalam QA.

Kriteria penerimaan: komposisi frame diterapkan, semua permission backend tetap dapat ditemukan, CRUD dipisahkan dari tindakan lain, tanda tidak berlaku dibedakan dari checkbox kosong, perubahan ditinjau sebelum PATCH existing. Shell global dan web sempit diperiksa pada browser. Tidak ada migration atau perubahan kontrak server. Riwayat IAM belum memiliki endpoint baca dan pengeditan scope belum tersedia; tampilkan keterbatasan tersebut secara eksplisit, tanpa data rekaan.

Varian turunan: checkbox kelompok merangkum hak aktual (termasuk indeterminate) dan memilih hanya aksi yang ada; expand menampilkan resource individual. Isi/jumlah baris mengikuti katalog backend, bukan nilai contoh mockup. Panel anggota memuat pengguna hanya bila memiliki `user.read`. Bukti dan hasil validasi dicatat setelah implementasi.

## Hasil implementasi dan bukti

| Frame / route | Temuan awal | Perbaikan | Bukti |
|---|---|---|---|
| `j4z8e7` / `/setting/roles/[id]/permissions` | Judul menyatu dengan nama peran, tidak ada panel detail/tab, delapan aksi bercampur | Panel detail aktual, lima tab, empat kolom CRUD, kelompok dapat diperluas, legenda dan batas perubahan | [Desktop 1600 × 1400](review/permission-matrix-2026-10-07/desktop.jpg) |
| Frame sama / web sempit | Tabel lebar berisiko memperlebar halaman | Detail menjadi satu kolom, tab membungkus, tabel menggulir dalam panel | [Web 390 × 844](review/permission-matrix-2026-10-07/narrow.jpg) |
| Tinjauan, turunan interaksi | Simpan langsung tanpa rincian perubahan | Dialog perubahan per kode izin dan dampak anggota sebelum PATCH; Batal/navigasi/logout menjaga draft | [Dialog tanpa menyimpan](review/permission-matrix-2026-10-07/review-unsaved.jpg) |

Shell matriks memakai sidebar 248px dan ExecutiveTopbar 72px sesuai standar global. Browser memastikan panel putih/border `#CAD9E8`, tab aktif `#064A9D`, heading 26px, checkbox 22px, tab 40px dan tombol dialog 42px/12px. Popup akun 12px dengan item Keluar 32px; Escape, collapse/expand, expand kelompok, checkbox/draft, tinjauan, anggota, cakupan dan tab tindakan khusus diperiksa. Lebar dokumen desktop 1600px dan web sempit tidak melebihi viewport 390px. Tindakan khusus menyajikan seluruh 45 izin aktual dalam 25 resource; menggunakan daftar berkelompok agar tidak menghasilkan 25 kolom kosong. Ini state turunan karena frame hanya menggambar tab CRUD aktif.

Isi berbeda dari contoh mockup: nama, jumlah anggota, centang dan jumlah kelompok mengikuti database. Tidak membuat grant Dashboard generik; izin dashboard existing berada pada domain pemiliknya. Sidebar mengikuti izin sesi, bukan menyalin semua label mockup. Teks tambahan menjelaskan aturan administrator terbaru. Tidak mengklaim identik piksel untuk seluruh state/tab.

Next.js/React/Tailwind dan shadcn Tabs, Checkbox, Table, Dialog, Button benar-benar dirender. TanStack Query digunakan untuk role/permission/anggota dengan konteks user/perusahaan, serta invalidasi setelah server mengonfirmasi; Sonner hanya setelah sukses. TanStack Table tidak diterapkan pada grid editor permission karena bukan tabel daftar record dengan sort/pagination. Anggota/cakupan memakai daftar semantik. Tidak ada fixture principal atau data runtime baru.

Typecheck Office dan ESLint file terdampak lulus. 15 tes existing IAM/navigasi/controller lulus; guard akses tidak diubah. Validator repository lulus. Tidak menjalankan workflow O2C atau menyimpan perubahan izin dalam QA; checkbox dikembalikan dan tombol tinjauan kembali disabled. Bukti ini tidak membuktikan mutasi database end-to-end baru. Tidak ada migration.

Batas fungsi: riwayat IAM belum memiliki API baca, tab menampilkan status belum terhubung; cakupan khusus dapat dilihat dan dipertahankan, belum diedit. Halaman daftar Pengguna/Peran lain belum termasuk rekonstruksi visual ini. Penjagaan browser refresh memakai beforeunload; navigasi sidebar, Batal dan logout memakai dialog. Navigasi history browser internal tidak diklaim terjaga oleh dialog khusus.
