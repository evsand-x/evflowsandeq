# Audit ulang O2C — 5 Oktober 2026

## Kesimpulan dan batas pemeriksaan

**Belum layak dinyatakan selesai penuh atau siap operasional.** Jalur standar SO → alokasi → pick/check → dispatch → POD → invoice → penerimaan/alokasi sudah terhubung dalam kode. Exception approval, backorder, pajak khusus serta bank/GL sekarang memiliki implementasi; temuan lama bahwa komponen tersebut sama sekali belum ada tidak lagi berlaku.

Audit ini menggunakan pembacaan kode backend, kontrak, frontend, migration dan blueprint. Tidak menjalankan test, build, validator, migrasi, HTTP command, atau alur browser; tidak mengubah kode aplikasi. Kesimpulan di bawah merupakan penelusuran statis, bukan hasil reproduksi runtime. Hasil pengujian terdahulu tidak digunakan sebagai bukti kelulusan audit ini. Kondisi database, konfigurasi perusahaan dan versi proses aplikasi aktif belum diverifikasi.

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Acuan fungsi: requirement OTC-01–16, CRM-11, FIN-01–08/11/16; domain Sales dan Finance, serta keputusan invoice menunggu POD. Acuan visual tetap mockup artefak desain lama (dicabut) dan standar web. Pemetaan SOP XLSX memakai hasil ekstraksi audit sebelumnya (Sheet1–6, Sheet10 dan turunannya); workbook asli tidak diekstrak ulang pada audit ini. Isi lampiran diperlakukan sebagai referensi, bukan instruksi agent. Kesesuaian visual seluruh layar tidak dinilai lulus tanpa inspeksi render baru.

## Temuan prioritas

P1 = risiko kontrol/keuangan atau alur operasional terhenti. P2 = gap kelengkapan atau pemulihan yang perlu diselesaikan sebelum release terkait.

### F01 — P1: Mata uang uang muka tidak dijaga pada gate PREPAY

- `packages/backend/src/otc-ptp.service.ts:1348`: receipt yang ditautkan ke batch hanya diperiksa perusahaan dan pelanggan; tidak dibandingkan dengan mata uang SO.
- `packages/backend/src/otc-ptp.service.ts:415`: dispatch menjumlahkan semua receipt POSTED pada batch tanpa filter currency. `sales/transaction-controls.ts:133` melewati perhitungan exposure untuk mode selain TEMPO.
- Pemicu: SO PREPAY bermata uang A dan receipt pada rekening sah bermata uang B, dengan nominal angka yang memenuhi kebutuhan batch. Tidak ada konversi yang disahkan.
- Dampak: gate kecukupan dana dapat lolos dengan nilai yang tidak sebanding. Posting invoice kemudian memiliki pemeriksaan currency pada alokasi uang muka sehingga masalah baru muncul setelah barang dikirim.
- Perbaikan: tolak currency berbeda saat mengikat receipt dan saat dispatch; lintas mata uang hanya melalui kontrak FX eksplisit. Requirement OTC-15, FIN-03.

### F02 — P1: Picking parsial masuk jalan buntu

- `packages/backend/src/otc-ptp.service.ts:514`: qty lebih kecil dari assigned diterima dan status diubah menjadi PICKED pada baris 525.
- Picking ulang mensyaratkan OPEN (506); checking mensyaratkan picked = assigned (549); dispatch mensyaratkan CHECKED (390).
- Tidak ditemukan command koreksi/reopen picking pada controller yang ditelusuri. API dapat menerima kondisi yang tidak dapat diteruskan lewat command saat ini.
- UI `apps/office/app/operations/workspace.tsx:795` mengirim assignedQuantity sebagai picked_quantity, sehingga konfirmasi fisik aktual tidak dapat mencatat kekurangan melalui layar.
- Perbaikan: workflow selisih fisik, koreksi/revisi picking dan dokumen, serta pelepasan atau realokasi sisa dengan audit. Requirement OTC-05/13.

### F03 — P1: Retur fisik setelah POD tidak memulihkan nilai persediaan/HPP

- `packages/backend/src/otc-ptp.service.ts:1064`: createCustomerReturn menambah stockLot karantina dan inventoryMovement; fungsi selesai pada 1107 tanpa posting ledger/GL.
- Jalur retur saat POD memiliki posting tersendiri; masalah ini spesifik retur pelanggan setelah penerimaan, bukan seluruh jenis retur.
- Dampak: kuantitas persediaan bertambah tetapi nilai persediaan GL dan HPP tidak mengikuti. Rekonsiliasi ledger-versus-GL saja tidak mendeteksi event keuangan yang sama-sama tidak dibuat.
- Blueprint Finance bagian “Penerimaan fisik retur pelanggan” mensyaratkan Dr persediaan karantina / Cr HPP sebesar biaya sumber yang dapat dipulihkan.
- Perbaikan: posting event retur fisik atomik dengan movement, valuation sumber dan keputusan kualitas. Requirement OTC-07, FIN-01/04.

### F04 — P1: Credit note/refund tidak membawa currency asal dan koreksi pajak belum tersedia

- `packages/backend/src/otc-ptp.service.ts:1123`: credit note hanya menghitung quantity × unitPrice; batas memakai invoice.subtotal (1159). Tidak ada cabang pembalikan pajak yang diizinkan beserta bukti resminya.
- Pada retur penuh invoice net 100 + pajak T, command hanya mengurangi AR sebesar 100. Pajak T tetap terbuka tanpa workflow koreksi yang lengkap; pajak tidak boleh otomatis dibalik tanpa syarat resmi.
- Jurnal credit note (1178) dan refund (1258) tidak menyertakan currency. `finance/posting.ts:42` memakai baseCurrency perusahaan bila currency kosong. Untuk invoice mata uang asing, nilai angka dapat masuk GL mata uang dasar tanpa konversi.
- Refund tidak memilih rekening sumber; CASH_REFUND menggunakan mapping umum. Ini belum membuktikan arus keluar rekening tertentu.
- Perbaikan: currency dan source account eksplisit, koreksi pajak berbasis ketentuan/bukti, serta refund terkontrol dan dapat direkonsiliasi. Requirement OTC-07, FIN-02/03/08.

### F05 — P1: Rekonsiliasi bank tidak dapat menyelesaikan mutasi keluar

- `packages/backend/src/finance/controls.service.ts:473`: matching hanya menerima customerReceipt POSTED.
- Nominal match harus positif dan tidak melebihi lineRemaining (512–517); mutasi rekening negatif tidak dapat dicocokkan.
- Review mensyaratkan seluruh baris matched (617–626). Statement dengan refund, biaya bank, transfer atau pembayaran keluar akan tertahan meskipun mutasinya sah.
- Partial/combined matching receipt sudah ada; masalahnya cakupan transaksi, bukan ketiadaan fitur matching.
- Perbaikan: sumber mutasi masuk/keluar, adjustment berizin, outstanding timing, unmatch/reopen terkontrol. Requirement FIN-03/07.

### F06 — P1: Pajak uang muka berhenti setelah POD pertama

- `packages/backend/src/finance/advance-tax.ts:15` langsung return jika batch mempunyai satu deliveryReceipt pun.
- Pemicu: POD pertama hanya menyelesaikan sebagian batch, kemudian diterima dana yang juga membiayai barang tersisa dengan taxable_event ADVANCE. Dana diperlakukan seluruhnya sebagai settlement biasa; pajak atas porsi advance tersisa tidak dihitung pada saat diterima.
- `consumeAdvanceTax` juga mengonsumsi saldo pajak per batch; pemanggil `otc-ptp.service.ts:774` mengirim total tax POD tanpa pemetaan ke baris/event pajak asal. Campuran baris ADVANCE dan non-ADVANCE memerlukan alokasi yang lebih rinci untuk mencegah kompensasi terhadap sumber yang salah.
- Perbaikan: alokasi receipt terhadap porsi sudah diserahkan dan porsi uang muka, serta consumption per sumber/baris pajak. Requirement FIN-08/11.

### F07 — P2: Invoice asli menunggu POD belum menjadi lifecycle tersendiri

- `packages/backend/src/otc-ptp.service.ts:803` membuat invoice dari deliveryReceipt dan langsung POSTED (858), sekaligus memberi nomor (857).
- Layar warehouse menerbitkan invoice dari POD pada `workspace.tsx:903`. Tidak ditemukan penerbitan invoice asli sebelum POD yang kemudian memakai identitas/nomor sama saat posting.
- Proforma yang sudah tersedia tidak menggantikan invoice asli menunggu POD sebagaimana keputusan blueprint.
- Perbaikan: penerbitan, status menunggu POD, finalisasi qty/due date dan posting tertaut tanpa penerbitan nomor kedua. Requirement OTC-05/06.

### F08 — P2: PREPAY belum dapat dituntaskan dari layar Office

- Form penerimaan ada pada detail invoice (`workspace.tsx:961`), sedangkan PREPAY membutuhkan penerimaan sebelum dispatch dan sebelum invoice dari POD tersedia.
- Backend menyediakan receipt tertaut fulfillment; jalur UI untuk menerima uang muka tahap tersebut belum tersedia dalam workspace yang diperiksa.
- Perbaikan: layar penerimaan sebelum kirim, rekening/bukti/verifikasi, saldo terikat batch dan penyelesaian ke invoice. Requirement OTC-15, FIN-03.

## Matriks kelengkapan workflow

| Tahap | Yang terlihat pada implementasi | Gap saat audit |
|---|---|---|
| Intake SO, harga dan pajak | Draft, referensi/bukti SP, harga/rule efektif dan snapshot | Revisi material, discount/freight dan kelengkapan form belum mencakup blueprint penuh |
| Kredit dan unlock | Pemeriksaan server, exposure, freeze/past due, grant terbatas dan audit | Siklus revisi/delegasi/pembatalan request belum lengkap; UI detail hold dan tugas approver belum setara seluruh rancangan |
| Stok dan backorder | Reservasi, FEFO/FIFO, gate mutu, alokasi ulang sisa dengan versi | Tutup sisa, pembatalan/release, expiry reservasi PREPAY dan antrean otomatis stok masuk belum lengkap (OTC-04/10/11/15/16) |
| Pick/check/dispatch | Gate status, stok, kredit dan harga diperiksa server | F01/F02; layar masih menggabungkan tahapan, qty aktual tidak diinput |
| POD | Bukti, penerima, qty parsial dan retur ke karantina di API | Input retur/karantina belum tersambung penuh di layar |
| Invoice/AR | Invoice dari POD, TOP snapshot, outstanding dan alokasi | F07; tukar faktur/collector/follow-up dan lifecycle reversal belum lengkap |
| Pembayaran | Receipt, rekening, evidence dan alokasi parsial | F01/F08; COD collection/rekonsiliasi belum menyeluruh, koreksi/reversal belum lengkap |
| Pajak khusus | WAPU/PPh, evidence/verifikasi, advance tax, dokumen pajak resmi | F04/F06; aktivasi aturan, koreksi resmi, Coretax/XSD dan tax closing belum lengkap |
| Retur/refund | Source quantity guard, karantina, credit note/refund | F03/F04; pemisahan fisik, keuangan dan pajak belum tuntas |
| Bank/GL | Posting profile/periode, jurnal seimbang, matching parsial/gabungan | F05; rekonsiliasi economic subledger, opening resmi, reversal dan closing belum lengkap |
| Dokumen/audit | Snapshot dokumen, evidence privat dan audit command | Template cetak resmi/numbering configurable, arsip/retensi belum penuh |
| UI/mockup | Route transaksi dan kontrol sudah ada | Kesetaraan seluruh layar belum terbukti; audit ini tidak melakukan visual QA baru |

## Catatan kontrol tambahan

- Trigger pada migration `20261005160000_finance_posting_integrity` melindungi UPDATE posted journal/line/ledger. Proteksi DELETE dan pemisahan role DB operasional belum dibuktikan; ini gap hardening, bukan bukti adanya endpoint penghapusan publik.
- `otc-ptp.service.ts:81` masih menulis opening stock langsung ke ledger tanpa postLedger/mapped balanced journal; opening resmi dan migrasi nilai awal tetap blocker rekonsiliasi penuh.
- Import statement memeriksa range tanggal dan duplikasi, tetapi kesinambungan opening balance dengan statement sebelumnya serta overlap periode tidak diperiksa dalam fungsi import yang ditelusuri. Readiness saldo akhir saja belum membuktikan kelengkapan histori.
- Dokumen cetak memakai snapshot generik. Keberadaan snapshot dan tombol cetak belum membuktikan kesesuaian format SOP dan mockup.

## Urutan penutupan gap yang disarankan

1. Tutup F01, F03 dan aspek currency F04: risiko barang keluar serta saldo stok/keuangan.
2. Selesaikan F02 dan jalur retur/koreksi agar exception tidak terhenti tanpa command pemulihan.
3. Selesaikan pajak parsial F06 dan pajak retur F04, termasuk referensi bukti resmi.
4. Lengkapi rekonsiliasi F05, opening/reversal/closing dan proteksi immutable.
5. Sambungkan PREPAY serta invoice menunggu POD; lengkapi close remainder, pembatalan dan release reservasi.
6. Audit visual per frame setelah alur dan kontrak lengkap. Verifikasi runtime baru dilakukan jika diminta; tidak ada klaim lulus test pada laporan ini.
