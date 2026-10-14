# Sales Order SaaS — 7 Oktober 2026

Pengguna meminta perombakan daftar, buat/edit dan detail Sales Order, kolom tabel tidak digabung (nama/kode dan sejenisnya), kolom Diskon dan Pajak sebelum Subtotal, dan semua dropdown dapat dicari dengan mengetik. Desktop prioritas, tema Office emerald/netral dan Plus Jakarta Sans. Ini persetujuan implementasi, bukan perubahan aturan transaksi.

Cakupan OTC-01–12/APP-03/NFR-05: `/operations/orders`, `/new`, `/:id/edit`, `/:id`; daftar server-filtered, detail produk, form, pilihan dan exception terkait. Nomor/pelanggan serta kode/nama/satuan dipisahkan. Komponen TanStack Query/Table, Sonner, SelectionField berbasis Command/Popover dipertahankan. Pilihan pada layar SO dan exception terkait memakai SelectionField berbasis Command/Popover yang dapat dicari dengan mengetik; perubahan shared component juga menjaga pencarian kode produk.

API/domain tetap otoritatif. Diskon terpisah belum tersedia dalam kontrak create/revise: kolom jujur unavailable, tidak dibuat input palsu. Pajak tersimpan memakai taxAmount dari projection server; draft/revisi menunggu evaluasi, tidak memakai snapshot lama sebagai hitungan baru. Subtotal tetap sebelum pajak sesuai kontrak, ringkasan total termasuk pajak setelah evaluasi. Tidak ada migration, mutasi stok/keuangan, atau perubahan izin.

Penerimaan: header tabel terpisah, Diskon → Pajak → Subtotal, search keyboard semua dropdown pada SO, pilihan produk bisa dicari kode/nama, form tetap stabil saat mengetik, sidebar/ringkasan/form tidak menekan tabel lebar, daftar/form/detail browser aktual, typecheck/lint/validator dan bukti visual. Mobile khusus ditunda.


## QA 7 Oktober 2026

- Browser route nyata dengan sesi Novian: daftar, form baru, detail tersimpan, dan revisi draft diperiksa pada desktop.
- Filter status dicari dengan mengetik Draft menghasilkan 5 draft; pelanggan dicari lewat nama; produk dicari memakai kode DEV-E2E-PRD.
- Kolom produk terpisah: Kode produk, Nama produk, Satuan, Jumlah, Harga satuan, Diskon, Pajak, Subtotal. Subtotal form menghitung jumlah × harga; detail tersimpan menampilkan PPN 11%, subtotal Rp2.500.000 dan total Rp2.775.000.
- Revisi sementara dari 5 menjadi 6 × Rp250.000 menampilkan subtotal Rp1.500.000. Isian dibuang melalui dialog aplikasi tanpa menyimpan transaksi.
- Typecheck Office, ESLint file berubah, dan validate-repository.ps1 lulus. Pemeriksaan role tanpa izin dan error server tidak diulang dalam tahap kosmetik ini; mobile ditunda sesuai keputusan pengguna.
- Bukti visual: sales-order-saas-detail.png dan sales-order-saas-edit.png di output percakapan.
- Stack: Next/React/TypeScript dan token Office digunakan; TanStack Query/Table berjalan pada daftar server-filtered; Command/Popover diuji dengan keyboard dan pencarian. Sonner dipertahankan, tetapi toast hasil mutasi tidak diuji karena QA tidak menyimpan transaksi.
