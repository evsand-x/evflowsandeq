# Arah aksi dokumen pada detail SO — 9 Oktober 2026

Tujuan: tombol pada kartu Langkah Berikutnya menyebut tindakan yang benar-benar tersedia untuk tahap pemenuhan SO.

Cakupan: web Office, detail Sales Order. Aksi Picking Slip memakai command backend yang sudah ada dan hanya untuk tahap `ALLOCATED` tanpa slip; aksi Proforma membuka detail penerbitan pada tahap `ALLOCATED` yang belum memiliki Proforma atau memerlukan revisi. Bila dokumen sudah ada, tombol membuka daftar dokumen terkait. Untuk beberapa tahap yang memenuhi syarat, pengguna memilih tahapnya. Mobile, aturan backend, dan dokumen historis tidak diubah.

Keputusan pengguna: mengganti penekanan Daftar Picking Slip / Daftar Proforma dengan Buat Pick Slip / Buat Proforma pada SO. Rekomendasi agent: label tetap mengikuti status nyata, sehingga contoh satu Picking Slip yang sudah terbit menampilkan Lihat Picking Slip, sedangkan Proforma yang belum terbit menampilkan Buat Proforma. Izin dan keunikan dokumen tetap diputuskan server.

Kriteria: tindakan buat terlihat ketika eligible dan berizin; tombol lihat tersedia untuk dokumen yang sudah ada; daftar Pick Slip dan Proforma dapat menampilkan tahap yang menunggu tindakan tanpa menerbitkan nomor; navigasi membuka tahap yang tepat; loading/error tidak dipresentasikan sebagai jumlah nol.
