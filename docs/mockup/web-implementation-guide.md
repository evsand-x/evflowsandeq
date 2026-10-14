# Panduan implementasi web Office

Keputusan pengguna terbaru, 7 Oktober 2026, membatalkan kewajiban skill desain tambahan dan file desain lama. Panduan ini menggantikan instruksi visual lama yang bertentangan.

## Acuan

- Keputusan terbaru pengguna, [standar desain global web](web-design-standard.md), serta blueprint fungsi, izin, data dan invariant backend.
- Komponen, token, warna, tipografi dan koreksi global yang sudah disetujui tetap digunakan sampai pengguna mengubahnya.
- Catatan modul dan inventaris desain historis bukan instruksi atau syarat kesesuaian layar.
- Fokus web Office; Field ditunda.

## Pelaksanaan

1. Terapkan skill ERP proyek untuk traceability dan batas domain. Tidak ada kewajiban skill desain tambahan.
2. Baca requirement dan dokumen lintas lapisan terkait. Catat route, aksi, state, data/API, izin dan kriteria penerimaan.
3. Selaraskan keputusan material yang belum dijawab sebelum coding; jangan mengulang keputusan pengguna.
4. Implementasikan pada aplikasi operasional dengan sesi dan izin nyata, token serta komponen bersama.
5. Uji ukuran tombol, label, filter dan popup portal dalam browser, termasuk keyboard, focus, contrast dan viewport sempit.
6. Buktikan persistence, audit, otorisasi dan alur backend terkait. Laporkan gap secara eksplisit.
7. Jalankan `./tools/validate-repository.ps1` dan pemeriksaan relevan.

Jangan membuat route preview atau memakai principal/data simulasi sebagai pengganti backend. Data uji boleh di-seed ke database development lokal dengan guard lingkungan, idempotency, audit dan command domain untuk transaksi/saldo; jangan gunakan seed fiktif pada production.
