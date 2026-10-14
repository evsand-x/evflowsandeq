# Pembangunan kontrol dan alur operasional OTC

## Arah pengguna — 5 Oktober 2026

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Pengguna meminta implementasi, bukan audit lanjutan: benahi backend kredit, kelayakan/reservasi stok, harga/pajak dan approval terlebih dahulu; kemudian sambungkan SO → gudang → POD → invoice → pembayaran, berikut layar, bukti dokumen, audit dan pengujian penolakan. Arah visual Office tetap mengikuti mockup artefak desain lama (dicabut) dan standar global web. Field tetap ditunda. SO normal tetap otomatis tanpa approval rutin.

## Inventaris cakupan

| Area | Requirement | Kondisi awal | Pekerjaan |
|---|---|---|---|
| Kredit | OTC-01–03, 08–09, 15 | Limit sederhana; tanpa past due/exposure lengkap | Exposure per komponen, lock, policy/snapshot, freeze/exception |
| Kelayakan/reservasi | OTC-04/13/16, WH-01/02 | Reservasi ada; expiry dan konkurensi belum aman | Gate mutu/expiry, FEFO/FIFO deterministik, qty kumulatif, replay |
| Harga/pajak | CRM-04, FIN-05/08 | Input harga; tax penjualan belum tersedia | Rule efektif, snapshot, perhitungan server, blocker konfigurasi |
| Approval | PTP-01/02, Setting §5 | Permission dan status PR saja | Penunjukan, limit, pemisahan tugas dan rekam keputusan |
| Dokumen/pemenuhan | OTC-05/06/13, WH-08 | Pick/check/dispatch/POD dasar | Dokumen tahap, bukti, audit, list/detail dan aksi web |
| Invoice/penerimaan | FIN-02/03/11, OTC-06 | Invoice dan receipt dasar | TOP snapshot, total/pajak, bukti dana, alokasi dan penolakan |
| UI | APP-01, NFR-05/11/13 | Menu transaksi placeholder | Route per domain, Query/Table, shadcn, izin, loading/error/retry |

## Kriteria penerimaan

Konfigurasi resmi yang tidak tersedia memblokir transaksi terkait; tidak mengarang tarif, harga atau approver. Uji database/HTTP membuktikan transaksi, replay dan penolakan akses/data salah; stok dan kredit aman saat paralel. Dokumen dan audit dapat ditelusuri; frontend hanya mengumumkan sukses setelah server menyimpan. QA browser pada viewport mockup dan sempit memeriksa kontrol, portal, keyboard dan state. Jalankan validasi repository, typecheck dan pengujian yang relevan. Catat bagian yang belum terbukti secara eksplisit.

## Catatan pelaksanaan

### Perluasan yang diminta pengguna

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Pengguna meminta kelima gap diselesaikan penuh: approval unlock/harga khusus (OTC-08/09, CRM-11, IAM-07–09), alokasi ulang backorder (OTC-04/16), pajak khusus OTC (FIN-08/11/16), rekonsiliasi bank/GL (FIN-01/03/07), serta seluruh layar alur ini sesuai mockup (APP-01, NFR-05/11/13). Ini izin implementasi lanjutan. Tidak ada perubahan arah visual atau approval rutin SO. Cakupan tidak dinyatakan selesai hanya dari backend atau build. Konfigurasi perusahaan dan bukti eksternal pajak tetap wajib, bukan data yang boleh direkayasa.

Inventaris penerimaan lanjutan: request/decision/grant versi SO dan per baris harga; keputusan bertahap dan penolakan; backorder membuat batch baru tanpa mengalokasikan ulang qty lama; bukti pajak terpisah dan verifikasi sebelum settlement; rekening/mapping/period/jurnal serta staging/matching/review rekonsiliasi; matriks frame–route dan QA browser setiap kelompok layar. Semua item ini masih dalam pengerjaan sampai bukti aktual dicatat di bawah.

Implementasi berlangsung berurutan: kontrol backend dahulu, kemudian integrasi dokumen/API/UI dan verifikasi. Laporan audit 5 Oktober menjadi baseline gap, bukan klaim kondisi setelah perbaikan. Keputusan material tentang tujuan, cakupan, prioritas dan visual telah diberikan; tidak memerlukan pengulangan persetujuan mulai.

## Hasil baseline sebelum perluasan — 5 Oktober 2026

Status: alur standar TEMPO dengan harga acuan, pajak penjualan eksplisit, stok layak, POD dan pembayaran tunai/bank tercatat telah terhubung. **Belum memenuhi seluruh release gate blueprint atau seluruh cakupan exception yang diminta.** Pembayaran di sini pencatatan penerimaan dan alokasi; tidak mengirim uang ke bank.

| Prioritas | Implementasi aktual | Bukti | Sisa cakupan |
|---|---|---|---|
| Kredit | Lock pelanggan; AR outstanding + reservasi + transit + POD belum invoiced, dikurangi uang muka terkait yang dibatasi; overdue/freeze; TOP snapshot | Uji paralel dua SO, overdue sampai pelunasan, snapshot TOP | Workflow approval unlock/exception kredit belum tersedia; kondisi tersebut tetap diblokir |
| Stok | Lock lot, FEFO/FIFO dari OPS-WH-02, akumulasi SKU berulang, expiry/mutu/locator aktif; pemeriksaan ulang saat dispatch; retur POD ke karantina | Uji FEFO, overreservation, hold/expiry setelah picking, retur transit dengan jurnal seimbang | Reallocation backorder, pembatalan/release reservasi dan siklus inspeksi QC lengkap belum tersedia |
| Harga/pajak | Harga SALE efektif per base UOM; rule pajak efektif customer/product, DPP/rounding eksplisit; snapshot harga/pajak; total dihitung Decimal oleh server | Penolakan harga menyimpang/rule hilang; invoice 20+2=22 pada fixture sintetis | Approval exception harga, discount/freight, WAPU/PPh, pajak uang muka dan faktur pajak resmi belum tersedia |
| Approval | PR harus submitted dengan requester/nilai; policy efektif, assigned active user, batas nilai, ANY/ALL bertahap, larangan self-approval, audit | Uji missing policy, self/unassigned/limit/multistep | UI authoring saat ini satu tahap; API mendukung multi-step. PR create/submit/reject, delegasi dan revision workflow belum lengkap |
| Alur standar | SO → picking → checking → dispatch → POD → invoice → receipt → alokasi | HTTP UAT berakhir outstanding 0; dua alokasi parsial dari receipt yang sama | PREPAY gate backend ada tetapi layar penerimaan uang muka sebelum invoice belum tersedia; COD reconciliation belum lengkap |
| Bukti | Gambar JPEG/PNG privat maksimal 2 MB, decode/re-encode, SHA-256, company/purpose check; SP/POD/pembayaran wajib | Upload dan fetch privat UAT; gambar rusak ditolak | PDF/scanning, arsip/retensi dan tanda tangan digital belum tersedia |
| Dokumen | Snapshot proforma, picking, packing, surat jalan, invoice; nomor sequence; dokumen gudang tanpa harga/HPP | Snapshot transaksi tersimpan dan dapat dibaca/cetak | Template cetak bisnis lengkap, konfigurasi numbering resmi dan immutable storage policy belum lengkap; tidak ada API edit dokumen terbit |
| Finance | Transit/COGS/revenue/unbilled/AR/tax/advance/cash events; lock alokasi; journal source per alokasi | Jurnal uji seimbang, pengakuan revenue sekali, over-allocation dan replay ditolak | Posting profile akun GL, rekening bank master/statement reconciliation, moving-average HPP, reversal dan closing gate masih release blocker |

### Route dan stack UI

Route Office: `/operations/orders`, `/operations/orders/new`, `/operations/orders/:id`, `/operations/warehouse`, `/operations/warehouse/:id`, `/operations/invoices`, `/operations/invoices/:id`, `/operations/documents/:id`, `/operations/controls`. Menu tetap modul → grup → submenu. Kemampuan baru terdaftar melalui migration, **tanpa grant otomatis** ke pengguna nyata; gunakan pengaturan peran yang sudah ada untuk penugasan.

TanStack Query digunakan untuk list/detail/lookup/audit dengan key company/user dan invalidation setelah respons server. TanStack Table dipakai untuk list/detail rows dengan pagination/search server; sort/status filter lengkap belum tersedia. Field/Input/Button/Select/Popover/Card/Sidebar memakai komponen shadcn lokal; Sonner hanya setelah respons berhasil. Error transaksi menetap di halaman dan form dipertahankan. Key idempotency tetap sama saat mencoba ulang payload identik setelah hasil yang belum pasti.

| Frame sumber | Route | Verifikasi/gap |
|---|---|---|
| AmndB, q5a8BK | orders / new | Shell, referensi SP, alamat, bukti dan detail produk; KPI list, seluruh filter, discount/freight dan ringkasan form belum setara mockup |
| C6eNSG, UaneY | warehouse/:id | Picking/checking dan dokumen server; layar saat ini menggabungkan tahap, belum parity per-frame |
| bAdkP | warehouse/:id | Receiver, qty diterima, upload POD, penagihan; input retur/locator karantina ada di API tetapi belum di layar |
| S8SPc, d5uAgl, BbtTJ | invoices/:id | Invoice, bukti penerimaan, alokasi, print snapshot; komponen withholding dan pemilihan rekening belum tersedia |
| fK484, APTuW, f8Hty7 | controls | Form kredit, rule pajak, approval dan keputusan mutu; editor history/version dan multi-step visual belum lengkap |

### Pengujian

- `pnpm exec vitest run`: 112 tests, 22 files lulus (termasuk sembilan uji integrasi kontrol OTC).
- HTTP UAT pada API lokal baru: login nyata, create/submit/pick/check/shipment/dispatch/POD/invoice/receipt/dua alokasi sampai outstanding 0; 401, 403, 404, invalid image, dispatch premature, replay mismatch dan over-allocation ditolak. Script: `tools/qa/otc-http.ts`; fixture sintetis: `tools/qa/otc-fixture.ts`. Credential hasil fixture hanya di `tmp/` yang diabaikan Git.
- Build produksi Office, typecheck Office/backend/API, lint target dan validator repository dijalankan; lihat catatan QA akhir di bawah untuk hasil setelah perubahan terakhir.
- Pemeriksaan browser memakai server QA 3100/3101, terpisah dari API lama 3001. Proses lama tidak dapat dihentikan karena Windows access denied. Uji browser tidak membuktikan proses lama telah menerima kode baru.
- Generator Prisma melaporkan EPERM pada DLL yang dipegang proses lama. Client metadata baru dapat digunakan dan migrasi serta tes database lulus, tetapi generate bersih/restart proses aplikasi tetap harus diverifikasi sebelum deployment.

### Migrasi dan rollout

Lima migration additive: `20261005090000_otc_credit_stock_controls`, `20261005093000_otc_price_tax_approval`, `20261005100000_otc_command_replay`, `20261005103000_otc_evidence`, `20261005110000_otc_permissions_integrity`. Semua telah diterapkan pada database lokal. Stok lama menjadi PENDING, bukan otomatis disetujui; SO lama tanpa snapshot/bukti ditahan. Constraint numerik menggunakan NOT VALID untuk tidak mengarang koreksi saldo legacy, tetapi melindungi penulisan baru. Perlu inventory exception review dan migrasi data terverifikasi sebelum operational rollout. Jangan mengisi rule pajak/limit/approver nyata dari fixture UAT.

### QA akhir

Browser UAT menjalankan SO-00000001 → FUL-00000002 → POD dengan unggahan gambar → INV-00000002 → penerimaan BROWSER-UAT-ONLY → alokasi; layar menunjukkan sisa piutang 0. Percobaan alokasi tambahan ditolak server dan error tetap terlihat. Form penerimaan kosong setelah sukses, terpisah dari amount alokasi. Ini seluruhnya perusahaan UAT fiktif.

Viewport desktop 1600×1040 dan web sempit 390×844 diperiksa. Pada web sempit document scrollWidth 380 <= innerWidth 390; input 44 px, label 12 px; tombol form 42 px dan menu Kolom 40 px. Popup pilihan 299 px mengikuti trigger, pencarian 40 px dan option 32 px; Escape menutup popup. Ini bukti kontrol/responsif, bukan klaim parity seluruh frame mockup. Screenshot: [invoice lunas desktop](qa-otc-2026-10-05/invoice-paid-desktop.jpg), [penolakan web sempit](qa-otc-2026-10-05/invoice-rejected-narrow.jpg).

Build produksi Office berhasil; typecheck Office/backend/API dan lint file baru lulus. Full suite 112/112 lulus; setelah koreksi terakhir kontrol pelanggan aktif, currency jurnal dan state form, sembilan integration test OTC serta typecheck terkait diperiksa kembali. Validator repository lulus setelah sinkronisasi dokumen. Tidak ada kode akun/pajak nyata yang diisi dari data uji. Proses aplikasi pengguna pada 3001 tetap memerlukan restart untuk memakai build baru.

## Hasil perluasan — status terbaru 5 Oktober 2026

Bagian ini menggantikan status baseline di atas. **Permintaan penyelesaian penuh belum tercapai.** Implementasi dan bukti di bawah tidak menyatakan keseluruhan blueprint atau seluruh mockup lulus release gate.

| Cakupan / requirement | Implementasi lintas lapisan | Bukti | Gap yang masih terbuka |
|---|---|---|---|
| Unlock dan harga khusus — OTC-08/09, CRM-11, IAM-07–09 | Request dengan evidence, scope SO/baris, material hash, batas nilai, masa berlaku; policy efektif dan keputusan ANY/ALL; self/unassigned/stale/expired ditolak. Evaluasi tersimpan atomik bersama keputusan, lease worker dan idempotency memulihkan proses terputus. UI request/decision/status evaluasi tersedia pada detail SO | Integrasi multistep, stale/expired/self; crash-recovery tidak menggandakan batch; harga kedaluwarsa menahan alokasi dan dispatch; renewal dengan cakupan sama diuji | Delegasi, editor revisi material SO, pembatalan request lengkap, dashboard tugas approver dan parity frame list/form harga belum lengkap |
| Backorder — OTC-04/16 | Alokasi hanya sisa; versi SO wajib pada command alokasi ulang; submit biasa tidak dapat memintasnya. Kredit, mutu, expiry dan grant diperiksa lagi. Layar daftar backorder dengan pencarian/pagination dan tautan SO | Uji alokasi paralel hanya satu berhasil, master qty tidak berubah; kredit gagal menggulung balik batch/reservasi | Penutupan sisa, ETA pengadaan dan pembatalan/release reservasi belum lengkap |
| Pajak khusus — FIN-08/11/16 | WAPU dan PPh memakai rule efektif/customer/type, Decimal/DPP/rounding server; evidence dan verifikasi terpisah sebelum settlement AR. Uang muka bertaxable-event ADVANCE diakui lalu dikompensasikan pada POD. Faktur pajak resmi terpisah dari invoice komersial, source snapshot dan verifikasi; layar aturan/faktur/komponen invoice tersedia | Invoice 22 diselesaikan bank 19 + WAPU 2 + PPh 1; bukti belum diverifikasi dan posting berulang ditolak; advance 22 mengakui pajak 2 sekali; HTTP verifikasi faktur dan bukti privat lulus | Tax rule approval/activation, koreksi faktur resmi, Coretax/XSD, tax closing, skenario uang muka ditolak/refund dan campuran parsial belum lengkap |
| Bank/GL — FIN-01/03/07 | Akun/rekening/periode/profile efektif dari konfigurasi. Posting operasional dan GL commit atomik; missing mapping/periode/bank menahan transaksi. DB menolak edit header/baris posted, penambahan baris di transaksi berikutnya, company salah dan jurnal tidak seimbang. Mutasi CSV/manual staging, hash/ID duplikat, matching parsial/gabungan receipt, review dan close; receipt bertanggal dalam rekonsiliasi tertutup ditolak | Uji WAPU/PPh bank/GL seimbang, duplicate import, close sebelum matching; DB invariant; CSV presisi/quote/formula; split/combined match, replay dan overmatch | Biaya bank/transfer/pembayaran AP dan timing-exception belum dipadankan; unmatch/reopen, reversal GL, financial closing, saldo awal resmi dan migrasi historical ledger belum lengkap. Rekonsiliasi GL mencakup ledger-kind dan AR open items; belum seluruh economic subledger. DB role/delete protection operasional masih perlu release gate |
| UI — APP-01, NFR-05/11/13 | Query/Table, shadcn, Sonner, persistent errors, navigasi Finance dan Backorder; form multi-step approval, pemilihan rekening, rule pajak dan evidence resmi | Browser rule sintetis tersimpan; overlapping rule ditolak; input 44px, label 12px, popup search40/option32, tombol42px; 390px viewport scrollWidth380. Manual staging/review bank tertahan dan bukti pajak ditampilkan | Seluruh layar **belum setara mockup**. Picking/checking/dispatch/POD masih gabungan; SO create/filter/KPI, halaman harga khusus, template dokumen dan seluruh state belum selesai QA per-frame |

### Route dan bukti tambahan

- `/operations/backorders`: frame I3VCka, daftar dan alokasi ulang; belum penutupan/ETA.
- `/operations/orders/:id`: frame c1Mtk/i7iUMq/dJAAr dipetakan ke request/decision terintegrasi, belum parity komposisi.
- `/operations/reconciliation` dan `/:id`: frame TiqX5; staging/matching/saldo/review dan kontrol tutup. [Desktop](qa-otc-2026-10-05/bank-review-blocked-desktop.jpg), [web sempit](qa-otc-2026-10-05/bank-review-blocked-narrow.jpg).
- `/operations/bank-statements`: input CSV/manual; backend memeriksa ulang bentuk, tanggal, duplikasi dan nominal.
- `/operations/accounting`: frame BfAjK/TYjTF, konfigurasi akun/bank/periode/profile; bukan seluruh layar jurnal/reversal.
- `/operations/tax-rules`: frame sX1pJ, form aturan withholding aktual; belum workflow draft/activation. [Desktop](qa-otc-2026-10-05/tax-rule-desktop.jpg), [penolakan sempit](qa-otc-2026-10-05/tax-rule-rejection-narrow.jpg).
- `/operations/tax-documents`: faktur keluaran/evidence privat dan verification. [Bukti terverifikasi](qa-otc-2026-10-05/tax-document-verified-desktop.jpg).

Catatan historis, bukan instruksi desain aktif (dicabut 7 Oktober 2026): Stack: Query dan Table digunakan dan diuji pada layar aturan/mutasi; shadcn field/button/selection/tab/card digunakan dan diukur; Sonner sukses hanya sesudah server. Keberadaan komponen ini tidak membuktikan seluruh frame sesuai mockup. Data screenshot berasal dari perusahaan fiktif QA.

### Migrasi lanjutan dan operasional

Migration additive yang sudah diterapkan lokal: `20261005120000_sales_exceptions`, `20261005130000_finance_control`, `20261005140000_advance_tax_documents`, `20261005150000_exception_evaluation_outbox`, `20261005160000_finance_posting_integrity`, forward-fix `20261005161000_finance_balance_trigger_record`, `20261005162000_finance_journal_append_guard`, dan `20261005170000_bank_partial_matches`. Tidak ada permission baru yang otomatis diberikan kepada pengguna nyata. Migrasi matching memindahkan match lama ke event nominal tanpa mengubah saldo transaksi.

Worker Foundation memproses antrean evaluasi tiap siklus; API mencoba evaluasi segera setelah approval. Gangguan sementara dijadwalkan ulang, kegagalan bisnis tersimpan BLOCKED; pengguna melihat sebabnya dan menjalankan command yang sesuai setelah sumber diperbaiki. UAT menguji fungsi worker dan pemulihan lease; keberlangsungan daemon produksi belum dibuktikan.

API QA3101 dibangun/restart terpisah; aplikasi lama3001 tidak dinyatakan memakai perubahan. `prisma generate` masih EPERM pada DLL proses lama. Migration/type metadata dan build dapat dijalankan, tetapi generate bersih serta restart aplikasi tetap prasyarat rollout. Akun, tarif, periode dan bank UAT tidak boleh dipindah sebagai konfigurasi operasional.

### Verifikasi perluasan

Full suite terbaru: **124/124 tests, 23 files lulus**. Integrasi OTC mencakup 19 skenario (termasuk split/combined bank match, overmatch, periode rekonsiliasi tertutup, immutable posted GL, balance/company DB guard, expired price renewal dan outbox recovery); parser CSV dua skenario termasuk presisi besar serta penolakan formula/malformed data. Perubahan terakhir evaluasi ulang SO tanpa sisa dialokasikan diuji kembali pada suite OTC.

Build produksi Office, build backend/dependensi/worker, typecheck Office, lint target dan validator repository lulus. HTTP UAT terbaru membuktikan alur standar sampai outstanding 0, upload TAX, pencatatan/verifikasi faktur resmi, penolakan verifikasi berulang, invalid statement period, dan 403 pembacaan GL tanpa inventory.cost.read. Bukti machine-readable tersimpan di `tmp/otc-uat/http-result.json` (fixture/kredensial tidak masuk dokumen atau log).

UAT browser tambahan: aturan WAPU/PPh tersimpan, overlapping version ditolak dengan pesan menetap; bukti faktur resmi dapat dibuka secara privat; input tabel mutasi dapat diketik berurutan tanpa kehilangan fokus; staging tersimpan dan review tetap menahan close ketika selisih43999. Pada 1600×1040 dan390×844, field/button/popup mengikuti ukuran global dan halaman tidak overflow horizontal. Ini belum QA semua layar/state atau sertifikasi parity mockup. Browser juga menolak nominal2 pada sisa mutasi1, menerima match0,5 dan menampilkan sisa0,5. Review terbaru tetap Tertahan dengan selisih65999. [Bukti match parsial](qa-otc-2026-10-05/bank-partial-match-desktop.jpg).
