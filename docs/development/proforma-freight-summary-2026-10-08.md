# Ringkasan ongkir Proforma — 8 Oktober 2026

Koreksi dalam cakupan OTC-05, FIN-12 dan IAM-03: pengguna mengisi ongkir tetapi
ringkasan masih membaca snapshot sebelum edit. Keputusan yang tetap berlaku:
toggle ongkir dan Kena PPN, per pengiriman, tanpa field tax rule, backend menghitung
pajak. Tidak mengubah desain global, stok, approval, migrasi atau posting keuangan.

Perbaikan: preview POST berizin menghitung nilai melalui fungsi pajak yang sama
dengan penerbitan; tidak menulis batch/dokumen. Form mengirim perubahan setelah jeda
300 ms dan memisahkan cache berdasarkan pengguna, perusahaan, batch, versi dan input.
Loading/error/input invalid menahan tombol terbitkan serta menyembunyikan total lama.
Form tetap dapat diedit. Kunci idempotency penerbitan mengikuti payload lengkap.

Kriteria penerimaan: perubahan nominal, TAXABLE/NON_TAXABLE dan toggle mati
memperbarui ongkir/pajak/total tanpa menggandakan nilai. Preview tidak mengubah
database. Input invalid, tax rule tidak tersedia, dan company lain ditolak.
Dokumen yang terbit memakai jumlah yang sama dengan preview pada sumber/aturan sama.

Verifikasi: tes integrasi manual-proforma dan tes akses proforma; typecheck Office,
backend/contracts; lint tertarget; validasi repository. Bukti UI dicatat setelah
API berjalan dengan build terbaru. Tidak menerbitkan Proforma milik pengguna saat QA.
