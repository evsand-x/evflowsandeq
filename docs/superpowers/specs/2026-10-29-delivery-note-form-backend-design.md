# Desain Backend Form Surat Jalan

## Intent

Menyesuaikan kontrak backend Surat Jalan dengan form pada `docs/mockup/evflow-office-design.pen` agar field yang ditampilkan UI dapat divalidasi, disimpan, dibaca kembali, dan tetap terlacak saat dokumen diterbitkan.

## Cakupan

- Field draft: nomor Surat Jalan, tanggal Surat Jalan, tanggal kirim, gudang asal, ekspedisi, kendaraan, pengemudi, ongkos kirim, catatan, alamat pengantaran, dan kuantitas per baris.
- API create/update/get untuk draft Surat Jalan.
- Snapshot immutable untuk data yang menjadi dasar dokumen terbit, termasuk alamat, TOP, harga/pajak, ongkir, dan identitas transport yang diisi.
- Validasi perusahaan, SO, gudang, kuantitas kumulatif, angka desimal, dan idempotensi.
- Penerbitan tetap menjadi event stok, pendapatan, dan HPP; dokumen terbit tidak dapat diedit.

## Di luar cakupan

- Modul master ekspedisi, kendaraan, atau pengemudi baru.
- Perubahan aturan bisnis SO, TOP, pajak, stok, HPP, invoice, atau izin.
- Perubahan UI selain penyesuaian kontrak yang diperlukan untuk memakai API.

## Pendekatan

Field identitas dan operasional yang perlu divalidasi/query disimpan sebagai kolom terstruktur pada `DeliveryNote`. Data dokumen yang sudah terbit disalin ke snapshot sehingga perubahan Setting atau master setelah penerbitan tidak mengubah dokumen lama. Referensi ekspedisi/kendaraan/pengemudi disimpan sebagai metadata Surat Jalan sampai master assignment resmi tersedia.

## Kriteria penerimaan

1. UI dapat membuat dan memperbarui draft menggunakan field form mockup.
2. Backend menolak tanggal, nomor duplikat, gudang lintas perusahaan, kuantitas melebihi sisa SO, dan nilai desimal tidak valid.
3. Ongkir dan data komersial mengikuti snapshot SO/policy; tidak ada tarif pajak atau angka bisnis hardcoded.
4. Penerbitan menyimpan snapshot handover dan metadata form, mem-posting event yang sudah ada, serta menjaga immutable record.
5. Akses tetap memakai grant `outbound_shipping.*` dan `fulfillment.dispatch`; tidak ada grant `delivery_note` baru.
6. Pengujian mencakup jalur berhasil, idempotensi, penolakan otorisasi/scope, validasi kuantitas, dan immutability.

## Keputusan terbuka

Tidak ada. Detail teknis migration, nama kolom, dan bentuk payload ditetapkan saat implementasi tanpa mengubah perilaku bisnis yang disetujui.
