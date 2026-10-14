# UI Invoice dan Piutang (AR) — 13 Oktober 2026

Implementasi web Office menyamakan detail Invoice dengan pola detail Proforma: ringkasan dokumen, informasi pelanggan dan pengiriman, tabel produk, ringkasan nilai, serta tindakan cetak dan penerimaan pembayaran.

Daftar Invoice memakai kolom tetap: No. Invoice, Pelanggan, Tanggal dibuat, Tanggal Jatuh tempo, Status, Sisa Tagihan, Total Tagihan, dan Keterangan. Keterangan berasal dari status Invoice, sisa AR, faktur pajak keluaran, dan komponen withholding yang tersimpan; UI tidak menyimpulkan bukti pajak dari tampilan saja.

Invoice posted tetap mengikuti aturan backend: nilai, pajak, jatuh tempo, dan sisa tagihan berasal dari POD, policy pembayaran, dan posting Finance. Form pembuatan yang tersedia saat ini memilih POD yang siap ditagihkan; dukungan penyimpanan dan perubahan draft Invoice dengan snapshot persisten masih menjadi pekerjaan backend terpisah karena model Invoice belum menyediakan command draft/edit atau detail baris Invoice yang mutable.
