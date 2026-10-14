# Penerbitan proforma manual — 7 Oktober 2026

Pengguna menyetujui alokasi otomatis saat submit SO, dengan proforma diterbitkan manual
per tahap setelah ditinjau. Tidak ada pertanyaan material terbuka. Scope: OTC-05/15,
IAM-03/06, APP-03/04; Sales memiliki proforma, Warehouse memiliki alokasi, Finance
tetap memiliki uang muka/invoice/AR. Acuan visual: standar global web.

Implementasi: hilangkan penerbitan proforma otomatis dari submit dan koreksi picking;
sediakan preview backend, command berizin proforma.issue, token revisi sumber,
locking/idempotency, snapshot/nomor/audit, tindakan pada detail SO, serta pembacaan
riwayat revisi. Nilai berasal dari alokasi positif dan snapshot harga/pajak.
Proforma tidak membuat stok, AR, atau jurnal. Tidak menambah approval SO.

Nomor wajib terkonfigurasi; permission baru didaftarkan tanpa grant otomatis ke akun
atau peran. Dokumen lama dipertahankan. Penyempurnaan diskon/ongkir, PDF/template final,
serta reserve-funds terpisah tetap di luar perubahan penerbitan manual ini.

Kriteria: submit tidak membuat proforma; penerbitan eksplisit memerlukan scope/izin,
SO open dan tahap allocated tidak kedaluwarsa, alokasi positif/layak, serta versi sumber
yang sama dengan preview; retry/concurrency satu dokumen; revisi terlacak; preview tidak
mengambil nomor; tes mencakup penolakan dan tidak adanya posting keuangan.
