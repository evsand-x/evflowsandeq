# Ongkir edit SO dan kartu Proforma — 8 Oktober 2026

Arahan pengguna: tampilkan ongkir di edit/revisi SO, kecilkan kartu Proforma dekat
Catatan, hentikan pergeseran layout saat mengetik. Web desktop; tombol Proforma
ganda pada SO ditunda. Mengikuti standar global web dan OTC-05/FIN-12/IAM-03.

Temuan: form menyembunyikan kartu saat initial ada; reviseOrder strict belum menerima
freight. Preview Proforma memasang/menghapus paragraf status di atas input pada
setiap request. CSS desktop memakai grid posisi anak, bukan sidebar flex biasa.

Implementasi: revisi menerima freight optional, null menghapus, omission mempertahankan;
nilai awal dibaca dari SO. Tetap mensyaratkan SO DRAFT/OPEN tanpa fulfillment aktif,
versi dan bukti/alasan. Validasi pajak memakai kalkulator server. Snapshot dan audit
revisi menyimpan perubahan, tidak mengubah batch/dokumen terbit. Tidak ada migrasi.

Kartu Proforma ditempatkan pada kolom 320 px sebelah Catatan. Status memiliki ruang
tetap setelah input, angka ringkasan memiliki tinggi tetap. Tidak mengubah kalkulasi
preview, cache scope, izin ataupun menerbitkan dokumen saat mengetik.

Kriteria: ongkir edit dapat diisi ulang/diubah/dimatikan; request tanpa freight tidak
menghapus nilai lama; batch aktif tetap menolak revisi. Kartu Proforma berada dekat
Catatan dan input tetap pada posisi yang sama selama perhitungan berlangsung.
