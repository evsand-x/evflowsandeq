# Penghapusan dua submenu Master Data — 16 Oktober 2026

## Arah pengguna dan cakupan

Pengguna meminta menghapus submenu **Referensi Reusable** dan **Ringkasan Lintas Domain**, termasuk UI dan backend khusus kedua submenu. Prioritasnya adalah navigasi Office operasional. Acuan tampilan tetap `docs/mockup/web-design-standard.md`; tidak ada arah visual baru.

Kriteria penerimaan: kedua submenu tidak muncul pada sidebar, termasuk flyout saat sidebar diciutkan dan drawer web sempit; tidak ada route, komponen, atau endpoint khusus kedua layar yang tersisa. Resource referensi yang dipakai form dan transaksi tetap tersedia melalui API kanonis dan izin backend. Tidak ada perubahan saldo, izin, data master, atau schema.

## Inventaris sebelum perubahan

| Item | Requirement/domain | Kondisi awal | Tindakan |
|---|---|---|---|
| Referensi Reusable sebagai submenu | MD-01/03/04, APP-03; Master Data | Label placeholder di `moduleNavigation`, tanpa route/halaman sendiri | Hapus label submenu |
| Ringkasan Lintas Domain sebagai submenu | MD-04/07, APP-03; Master Data dan pemilik data asal | Label placeholder di `moduleNavigation`, tanpa route/halaman/API agregasi sendiri | Hapus label submenu |
| Kategori, UOM, channel, rayon | MD-01/03/04; Master Data | Resource kanonis `/master-data/:resource`; dipakai data produk dan CRM | Pertahankan API, otorisasi, dan data |

Tidak ada backend khusus kedua submenu yang dapat dihapus. Endpoint referensi kanonis melayani identitas bersama dan tetap diperlukan oleh alur lain. Tidak ada migrasi.

## Pemeriksaan

- Tes navigasi `apps/office/lib/navigation.test.ts`: 7 lulus, termasuk kedua label tidak ada.
- Typecheck Office dan `./tools/validate-repository.ps1`: lulus.
- Aplikasi operasional pada `localhost:3000` dengan sesi berizin menampilkan Master Data berisi Produk, Pelanggan, Supplier, Vendor, Gudang dan Item Operasional; kedua submenu tidak muncul.
