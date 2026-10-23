# Arah Invoice dari Packing List — 21 Oktober 2026

## Keputusan pengguna

- Menu Finance → Piutang (AR) → Tagihan diganti menjadi Invoice.
- Halaman Invoice menyediakan antrean Packing List yang sudah selesai disiapkan, dicek, dan diterbitkan, siap dibuatkan Surat Jalan. Surat Jalan/POD bukan prasyarat penerbitan invoice.
- Pengguna memilih sumber di antrean dan melakukan Buat Invoice secara manual. Pengiriman tidak otomatis membuat invoice.
- Invoice yang diterbitkan dapat dicetak dan langsung membentuk AR melalui posting transaksi, bukan perubahan saldo langsung.
- Kuantitas mengikuti hasil checking/Packing List. Dokumen tetap tertaut SO dan tahap pemenuhan.
- Keputusan sebelumnya mengenai pendapatan/HPP saat dispatch dan credit note/reversal otomatis atas selisih POD belum dibatalkan oleh permintaan terbaru.

## Cakupan dan penerimaan

Prioritas: antrean dan tindakan manual dalam halaman Invoice, rincian sumber dan cetak, kemudian bukti posting AR, otorisasi, idempotency, dan pencegahan penghitungan ganda pada dispatch/POD. Tidak membuat route preview. Acuan visual: `docs/mockup/web-design-standard.md`.

Requirement terkait: OTC-02 (exposure tanpa hitung ganda), OTC-05 (rantai dokumen), OTC-06 (jatuh tempo), FIN (AR dan jurnal), IAM-01/04 (izin tindakan), APP-03 (integrasi operasional). Perubahan kontrak menyentuh Requirements, Finance, Warehouse, User Flow, Design, Database, API, Architecture, Features dan register keputusan.

Antrean harus berasal dari sumber perusahaan sesi yang sudah checked dan memiliki dokumen PACKING, dengan pemeriksaan invoice yang telah diterbitkan. Backend memvalidasi ulang kelayakan, izin, locking, periode, konfigurasi akun/pajak dan idempotency. Posting harus atomik dengan invoice/audit; cetak mempertahankan snapshot. UI tidak boleh mengarahkan Buat Invoice ke antrean Warehouse atau memilih POD sebagai sumber.

## Keputusan yang masih terbuka

Invoice kini dapat mendahului Surat Jalan. Keputusan pengguna: jatuh tempo dihitung dari tanggal penerbitan Invoice + TOP.

## Temuan implementasi saat audit

- Form InvoiceCreation masih mengambil kandidat delivery receipt/POD dan menyimpan draft berbasis POD.
- Tombol pada daftar Invoice mengarah ke Warehouse shipping.
- issueInvoice menghasilkan ISSUED_WAITING_POD dan outstanding nol; belum membentuk AR.
- Dispatch masih memindahkan persediaan ke transit. Pengakuan pendapatan/HPP saat dispatch serta koreksi POD perlu diselaraskan lintas lapisan; tidak cukup mengganti status invoice menjadi POSTED.

Catatan ini mencatat arah dan temuan, bukan bukti bahwa implementasi atau release gate telah selesai.
