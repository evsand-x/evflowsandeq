# Koreksi nilai daftar SO — 7 Oktober 2026

Koreksi label terakhir: tabel hanya menampilkan persentase, misalnya 11%, tanpa
awalan PPN. Persentase tetap dari snapshot tarif pengaturan pajak pada SO, bukan
angka 11 yang di-hardcode. Rincian tetap nominal pajak dan total tetap termasuk pajak.

Koreksi terbaru pengguna: label tarif PPN hanya berlaku di tabel produk. Ringkasan
rincian pesanan tetap menampilkan nominal pajak dari `taxAmount` backend. Koreksi
ini menggantikan cakupan ringkasan pada arahan lanjutan di bawah. Total SO tetap
termasuk pajak; tanpa perubahan API, perhitungan, data, atau migration.

Arahan lanjutan pengguna: pajak pada SO ditampilkan sebagai label tarif seperti PPN 11%,
bukan nominal rupiah. Cakupan tabel produk detail dan ringkasan nilai; tarif berasal
dari snapshot backend, tidak menetapkan 11% sebagai tarif bisnis tetap. Total tetap
termasuk pajak. Snapshot kosong tetap ditampilkan belum ditetapkan; tarif campuran
ditampilkan masing-masing. Tidak ada perubahan API, perhitungan, atau migration.
Verifikasi lanjutan: detail SO DEV-SO-2026-000008 pada sesi operasional menampilkan
PPN 11% di tabel produk dan ringkasan, subtotal Rp37.500.000 dan total Rp41.625.000.
Typecheck Office, ESLint kedua file, dan validator repository lulus.

Arahan pengguna: nilai pada tabel daftar SO harus merupakan total termasuk pajak.
Cakupan: kolom nilai di route operasional `/operations/orders`, requirement OTC-01–03 dan APP-03/04.
Gunakan `total` Decimal dari backend; jangan menggantinya dengan `subtotal` ketika null.
Sesuai kontrak read model API, pajak/total tanpa snapshot tetap null: tampilkan tanda kosong
dan keterangan pajak belum ditetapkan, tanpa menebak tarif atau mengubah transaksi.
Judul kolom menjadi Total pesanan. Perhitungan backend, schema, dan mutasi tidak berubah.
Acuan visual: standar desain global web. Tidak ada keputusan material yang masih terbuka.

Kriteria penerimaan: total tersedia ditampilkan termasuk pajak; total null tidak menampilkan
subtotal sebagai total; nilai nol tetap ditampilkan; typecheck, lint, dan validator lulus.

Verifikasi: typecheck Office, ESLint file terkait, dan validator repository lulus.
Browser pada route operasional dengan sesi yang sudah aktif menampilkan empat SO dengan
total termasuk pajak (contoh DEV-SO-2026-000008 Rp41.625.000), serta lima draft dengan
`— / Pajak belum ditetapkan`. Header terukur 168,53 × 44 px, font 11 px.
Screenshot ditinjau untuk keterbacaan; tidak ada mutasi transaksi untuk pemeriksaan ini.
Nilai nol tetap melewati formatter karena kondisi kosong memakai pemeriksaan null,
bukan pemeriksaan truthy; tidak membuat data uji baru untuk kasus tersebut.
