# CRM modern — 7 Oktober 2026

Pengguna meminta UI/UX CRM seperti ERP SaaS modern dan menyetujui pengayaan data dummy lokal. Desktop menjadi prioritas, tema emerald/netral dan Plus Jakarta Sans tetap konsisten dengan Office.

Cakupan CRM-01/05/06/07/09 dan APP-03/NFR-05: daftar Prospek/Kontak, pencarian/filter/sort server, kepadatan tabel, pemilihan kolom, detail institusi, kebutuhan, peluang draft dan form. Data lebih mudah dipindai melalui identitas visual, hierarki dua baris, badge status dan tanggal tindak lanjut. Form kontak dipindahkan sepenuhnya ke aksi Tambah Kontak agar daftar fokus pada penelusuran.

Kontrak tetap: CRM workspace/company scope, API CRUD/domain command yang ada, TanStack Query/Table, komponen lokal/Tailwind, Sonner. Kebutuhan tidak mereservasi stok; peluang operasional saat ini draft, bukan forecast atau realisasi. Tidak membangun kunjungan/penawaran aktif yang belum tersedia. Tidak ada migration atau perluasan izin.

Seed terpisah, additive dan idempoten dengan guard development: institusi, PIC, kebutuhan, variasi status pendekatan dan peluang draft. Tidak menimpa edit pengguna atau transaksi seed O2C terdahulu. Nama dan email fiktif berlabel, tanpa pengiriman komunikasi.

Penerimaan: tabel desktop rapi, filter/sort/pencarian nyata, reset filter, empty state, kolom dan keyboard popup, halaman detail/form/peluang dengan database aktual; typecheck/lint/validator dan bukti screenshot. Mobile khusus ditunda. QA dicatat setelah implementasi.

## Hasil pemeriksaan

- Browser operasional: 13 prospek dan 21 kontak total; data tambahan 8/16/5 tetap sama setelah seed ulang. Status potensial menghasilkan dua baris, pengurutan Nama A–Z dari server, pencarian yang tidak cocok menghasilkan empty state.
- Mode ringkas terukur 56 px per baris. Pemilihan kolom bekerja. Popup memakai Plus Jakarta Sans 12 px. Pencarian kebutuhan mengurangi dua baris menjadi satu secara benar. Invoice/stok tidak disentuh seed CRM.
- Detail prospek menampilkan kebutuhan, kontak dan draft peluang yang tertaut. Form Kontak tetap memakai field 42 px/radius 9 px; halaman tidak memiliki overflow horizontal pada desktop yang diperiksa. Form peluang diperiksa tanpa menyimpan transaksi tambahan.
- TanStack Query dan Table dipakai dan diuji pada filter/sort/pencarian; cache placeholder hanya dipertahankan untuk user/company/resource sama. Komponen React/Tailwind/token dan Sonner tetap digunakan; toast mutasi tidak diuji ulang karena submit form tidak diubah.
- Office typecheck, typecheck seed, ESLint file berubah, formatting dan repository validator lulus. Seed lokal: `EVFLOW_ALLOW_DEV_SEED=LOCAL_FICTITIOUS_ONLY`, lalu `pnpm db:seed:crm`.
- UI form/detail diperbarui melalui komposisi dan styling CRM. Backend pipeline aktif, forecast, kunjungan, penawaran dan revisi kontak belum dilengkapi dalam pekerjaan tampilan ini. Tidak mengklaim seluruh blueprint CRM operasional selesai. Error/denied backend tidak disimulasikan; cabang lama dan izin tetap digunakan. Mobile khusus ditunda.
- Seed melakukan satu koreksi master kontak fiktif untuk kode fungsi PIC FINANCE, terbatas fixture belum diedit, dengan audit; tidak menyunting uang, stok atau akun pengguna.
