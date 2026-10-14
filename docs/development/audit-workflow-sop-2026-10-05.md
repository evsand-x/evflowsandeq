# Audit workflow terhadap SOP — 5 Oktober 2026

## Kesimpulan

**Backend dan frontend belum mengikuti seluruh alur SOP secara operasional dari awal sampai akhir.** Fondasi autentikasi, multi-role, master, CRM tertentu, dan sebagian transaksi order-to-cash/procure-to-pay sudah ada. Akan tetapi, beberapa kontrol transaksi inti belum sesuai, banyak langkah SOP belum memiliki implementasi, dan menu transaksi Office sebagian besar masih berupa label tanpa layar.

Ini adalah audit implementasi sementara, bukan persetujuan go-live. Tidak digunakan persentase kepatuhan karena satu baris SOP bisa memuat beberapa kontrol dengan bobot berbeda. Tidak ada proses dalam matriks di bawah yang dinyatakan lulus menyeluruh berdasarkan bukti audit ini.

## Cakupan, sumber, dan batas bukti

- Sumber SOP: `C:/Users/LENOVO/Downloads/Kerangka Pembuatan SOP (4).xlsx`, seluruh 21 worksheet, termasuk kelompok Sheet10 (2)–(12). Judul Sheet10 (11)/(12) masih sama dengan pemetaan pasar, tetapi aktivitasnya masing-masing kunjungan dan penawaran.
- Acuan keputusan: README dan 00-document-map blueprint; requirement 02; domain Sales, Warehouse, Finance, HR, Master, Setting; kontrak workflow dan teknis terkait. SOP merupakan referensi proses, bukan instruksi untuk menjalankan WhatsApp, menghapus arsip, atau mengganti keputusan produk.
- Bukti implementasi: route Office, API/controller/service, kontrak request, model Prisma/migration, serta tes yang tersedia. Keberadaan nama menu, tabel, atau dashboard tidak dihitung sebagai workflow operasional.
- `pnpm test`: **21 file, 103 tes lulus**, termasuk database integration dan HTTP E2E. Pesan unique constraint yang muncul berasal dari tes penolakan duplikat yang lulus.
- `./tools/validate-repository.ps1`: **lulus**, 0 broken links, duplicate requirement/decision IDs, conflict markers, dan malformed Markdown tables.
- Tes yang ada tidak mencakup semua langkah SOP. Tidak dilakukan UAT klik browser dengan akun setiap peran, pemeriksaan hasil cetak, file pajak produksi, atau pembuktian pekerjaan fisik gudang. Temuan kode dibedakan dari hasil pengujian runtime; skenario tambahan di bawah adalah usulan pengujian, belum dijalankan.
- Audit tidak mengubah kode aplikasi, schema, migration, workbook sumber, atau kontrak blueprint. Hanya laporan ini yang ditambahkan. Tes memakai mekanisme fixture suite yang tersedia.

## Perbedaan SOP dan keputusan produk yang perlu direkonsiliasi

| Acuan SOP | Perbedaan | Perlakuan audit |
|---|---|---|
| Sheet2 C10 | Nota harus ditandatangani supervisor | Keputusan blueprint OTC-01: SO normal otomatis; approval hanya exception. Jangan menambahkan approval rutin SO hanya untuk menyalin SOP lama. Revisi SOP digital agar eksplisit. |
| Sheet7 C20; Sheet8 B4, C14 | Penanganan PR/PO dikaitkan Finance | Blueprint PTP-01: PR/PO milik Warehouse/Procurement; Finance menangani tagihan/AP/bayar. Approver tetap dapat orang Finance menurut policy, tanpa memindahkan pemilik domain. |
| Sheet5 C15 | Stok dikurangi saat picking | Blueprint memisahkan reservation/picking, dispatch/transit, dan POD. Pengurangan on-hand ketika dispatch bukan otomatis cacat; SOP digital perlu menjelaskan tiap saldo. |
| Sheet9 C16 | Hutang supplier masuk “Accounts Receivable (AR)” | Istilah SOP keliru: seharusnya Accounts Payable (AP). Implementasi AP justru benar. |
| Sheet9 C12; Sheet10 (12) C10 | Contoh PPN 11% | Tidak boleh dijadikan konstanta universal. Ikuti rule pajak resmi bertanggal efektif; gap saat ini adalah belum lengkapnya mesin pajak, bukan semata ketiadaan angka 11%. |
| Sheet1 C13–C15 dan dokumen lainnya | WhatsApp, Excel, cetak rangkap, bantex | Dapat tetap merupakan pekerjaan manual atau digantikan proses digital yang disepakati. Yang perlu dipertahankan adalah referensi sumber, bukti, penerima, waktu, status, dan arsip. Integrasi WhatsApp otomatis bukan requirement yang dapat diasumsikan. |
| README blueprint, keputusan penerimaan supplier | Mengacu “SOP Sheet5” | Dalam workbook yang diaudit, Sheet5 adalah outbound; inbound ada pada Sheet6. Referensi dokumen perlu diperbaiki setelah menyamakan versi sumber. |

## Matriks seluruh worksheet

“Parsial” berarti ada implementasi nyata untuk sebagian langkah, bukan lulus SOP. “Belum ditemukan” berarti tidak ditemukan workflow domain tersebut pada model, service/controller, dan route yang diperiksa; dashboard/read model tidak menggantikannya.

| SOP / rentang | Workflow | Backend saat ini | Frontend Office | Gap utama / requirement |
|---|---|---|---|---|
| Sheet1 A8:C15 | Penanganan pesanan penjualan | Parsial: PO/SP CRM dan SO terpisah | Form CRM tertentu tersedia; layar transaksi SO belum tersedia | Belum ada rantai SP terverifikasi → SO, pencocokan pricelist, diskon/UOM lengkap, dan handoff admin. OTC-01, CRM-04. |
| Sheet2 A8:D20 | Verifikasi dan proses SO | Parsial: payment policy, limit sederhana, alokasi | Menu pesanan belum menjadi layar operasional | Past due/freeze, exposure benar, unlock, dokumen/cetak/arsip belum lengkap. OTC-01–03, 08–09. |
| Sheet3 A8:C16 | Proforma dan invoice resmi | Invoice dari qty POD tersedia; proforma belum ditemukan | Layar penerbitan/tukar faktur belum tersedia | Proforma, template, bukti tukar faktur, pajak dan handoff penagihan. OTC-05–06, FIN-08. |
| Sheet4 A7:C16 | Faktur pajak keluaran | Workflow tax document/Coretax belum ditemukan | Menu pajak belum menjadi layar | Validasi identitas/DPP/PPN, ekspor, rekam hasil approval/nomor/PDF, arsip. FIN-08/16. API langsung Coretax memang ditunda. |
| Sheet5 A8:C32 | Pengeluaran dan distribusi | Parsial: reservation, pick, check, dispatch, POD | Menu Barang Keluar belum menjadi layar | Proforma, packing list/SJ, koli/berat/label, bukti serah terima, tracking dan selisih picking. OTC-05/13, WH-08. |
| Sheet6 A8:C24 | Penerimaan dan penyimpanan | Parsial: GR, batch/expiry, locator, movement, GRNI | Menu Barang Masuk belum menjadi layar | Pemeriksaan kondisi, layak/karantina per baris, suhu/shelf-life, quality release dan arsip. PTP-07, WH-01/02. |
| Sheet7 A8:C21 | Perencanaan kebutuhan/PR | Kekurangan SO otomatis membuat PR draft | Menu Pengadaan belum menjadi layar | Evaluasi forecast/min-max, PR/PO/kiriman berjalan, penyusunan kebutuhan dan review sebelum belanja. PTP-01/05. |
| Sheet8 A8:C18 | Pesanan pembelian | PR approve → PO; qty PR–PO dilacak | Layar PO belum tersedia | Budget check, approval policy/limit, kontrak/TOP/pajak, konfirmasi supplier, monitoring, konsolidasi beberapa PR. PTP-02/05/06, FIN-15. |
| Sheet9 A8:C17 | Invoice dan utang supplier | Parsial: matching qty/harga, posting AP/GRNI | Layar tagihan/bayar belum tersedia | Verifikasi bukti/pajak, due date dari PO/MOU, exception, approval dan pembayaran supplier. PTP-03/04, FIN-02/03. |
| Sheet10 A8:C20 | Penomoran dokumen | Counter transaksi atomik sederhana | Pengaturan nomor belum menjadi layar | Format perusahaan/tahun/bulan Romawi/reset, nomor pada penerbitan, logbook nontransaksi/void/arsip. IAM-03, ADM-01. |
| Sheet10 (2) A8:C26 | Arsip dan pemusnahan | Metadata lampiran CRM bukan workflow arsip | Daftar Arsip belum menjadi layar | Register, klasifikasi/lokasi, peminjaman/pengembalian, retensi, legal hold dan pemusnahan. ADM-01. |
| Sheet10 (3) A8:C15 | Surat masuk/disposisi | Belum ditemukan | Belum tersedia | Register surat, disposisi, penerima/PIC, bukti distribusi, status tindak lanjut. ADM-01. |
| Sheet10 (4) A8:C14 | Surat keluar | Belum ditemukan | Belum tersedia | Draft/revisi, persetujuan, nomor, tanda tangan, bukti kirim dan arsip. ADM-01. |
| Sheet10 (5) A8:C22 | Dokumen legal | Identitas/legalitas master sebagian ada; bukan lifecycle dokumen legal | Workflow legal belum tersedia | Versi dokumen, lokasi asli, expiry reminder, renewal, pinjam/kembali dan akses. ADM-01, MD-01/03. |
| Sheet10 (6) A8:C18 | Pemusnahan dokumen inaktif | Belum ditemukan | Belum tersedia | DUPD, cek audit/sengketa, otorisasi, saksi, BAPD, status akhir dan retensi bukti. ADM-01. |
| Sheet10 (7) A8:C23 | Kontrak kerja karyawan | HrModule kosong; dashboard tidak menjadi sumber kontrak | Karyawan & Kontrak belum menjadi layar | Draft/review/signature, register privat, reminder, evaluasi, addendum dan penghentian. HR-01/07. |
| Sheet10 (8) A8:C23 | Kontrak pelanggan | Master pelanggan/SO tidak menggantikan kontrak | Workflow kontrak belum tersedia | Legal review, versi/signature, termin/milestone billing, reminder dan retensi. ADM-01, FIN-02. |
| Sheet10 (9) A8:C17 | Kontrak supplier | Master supplier dan PO dasar tersedia | Workflow kontrak belum tersedia | MOU aktif sebagai sumber harga/TOP, revisi, approval, monitoring/renewal/evaluasi. MD-08, PTP-05, ADM-01. |
| Sheet10 (10) A8:C19 | Pemetaan pasar/master pelanggan | Parsial: institusi, prospek, kontak, kebutuhan, peluang | Sebagian form/daftar sudah terhubung API | Profil potensi faskes, klasifikasi, verifikasi berkala, pengkinian kontak/master dan geografi belum lengkap. CRM-01/05/06/07, MD-06. |
| Sheet10 (11) A8:C23 | Rencana dan realisasi kunjungan | Next-action/aktivitas CRM bukan lifecycle kunjungan berapproval | Tombol kunjungan disabled | Call plan, persetujuan/revisi, realisasi, bukti PIC, hasil dan review supervisor. CRM-02/08/12/14. Field ditunda sesuai keputusan produk. |
| Sheet10 (12) A8:C13 | Penawaran harga/SPH | Penyimpanan draft quote dan baris harga/diskon ada | Tombol penawaran disabled | Pricelist/exception, approval, revisi, cetak/kirim/bukti, response dan konversi SO. CRM-04, FIN-05. |

## Temuan prioritas dan bukti implementasi

### G01 — Tinggi: kredit SO belum sesuai SOP dan blueprint

`submitSalesOrder` menjumlahkan `salesInvoice.subtotal` berstatus POSTED dan seluruh nilai SO. Ia tidak memakai outstanding invoice, tidak mengecek due date/freeze, tidak memasukkan komponen alokasi/transit/unbilled secara benar, dan ikut membebankan backorder yang belum dialokasikan. Akibatnya pelanggan lunas bisa tetap dianggap memakai limit; pelanggan menunggak atau dengan komitmen lain bisa lolos pemeriksaan yang tidak lengkap.

Bukti: [otc-ptp.service.ts:160](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.service.ts:160). SOP Sheet2 C11:C14; OTC-02/03. Kriteria penutupan: pembayaran mengurangi exposure, past due/freeze sesuai policy memblokir, komponen tidak ganda, backorder tanpa alokasi tidak menggunakan limit, evaluasi di bawah lock pelanggan.

### G02 — Tinggi: kelayakan stok dan urutan FEFO belum terjaga

Filter alokasi hanya memeriksa lot ACTIVE, qty positif, dan locator aktif bukan karantina; tidak memfilter expiry terhadap tanggal sekarang. Query pertama diurutkan expiry, tetapi hasil dibaca ulang setelah lock tanpa `orderBy` dan array hasil itulah yang dialokasikan. Dengan demikian FEFO tidak terjamin. Tidak ada gate expiry ulang pada dispatch di service ini.

Bukti: [otc-ptp.service.ts:191](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.service.ts:191), [dispatch:298](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.service.ts:298). SOP Sheet6 C15:C22; WH-01/02, OTC-13. Kriteria penutupan: lot expired/hold/recall/karantina tidak eligible; FEFO/FIFO deterministik setelah lock; kondisi diperiksa ulang sebelum keluar.

### G03 — Tinggi: qty reservasi dan submit paralel belum aman secara lengkap

Dalam satu SO dengan dua baris produk sama, `lockedLots` dibaca sekali. Increment reservasi di database tidak memperbarui objek lot lokal. Contoh stok 10, dua baris masing-masing 8: setiap baris masih dapat menghitung available 10 dan total reservasi menjadi 16. Schema request tidak menolak duplikasi produk dan migration yang diperiksa tidak menyediakan check reserved <= on-hand. Selain itu SO tidak dikunci sebelum pengecekan DRAFT; dua submit dengan key berbeda dapat sama-sama melihat DRAFT. Ini temuan penelusuran kode, belum direproduksi lewat uji konkurensi pada audit ini.

Bukti: [service:202](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.service.ts:202), [kontrak SO:25](/D:/APLIKASI/disflow/packages/contracts/src/otc-ptp.ts:25). OTC-04, invariant stok/idempotency. Kriteria penutupan: akumulasi qty per lot benar dalam request, lock/version SO, replay terikat payload, dan tes paralel tidak menggandakan fulfillment/reservasi.

### G04 — Tinggi: harga dan pajak belum divalidasi sebagai transaksi resmi

SO menerima `unit_price` langsung; belum ada lookup pricelist efektif/exception atau snapshot diskon, pajak dan ketentuan sumber. Invoice penjualan hanya menghitung subtotal qty diterima × harga. Supplier invoice menerima `tax_amount` opsional dengan default nol tanpa perhitungan rule pajak. Draft quote sudah memiliki harga/diskon tetapi tidak tersambung menjadi otoritas harga SO.

Bukti: [createSalesOrder:87](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.service.ts:87), [postInvoice:592](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.service.ts:592), [supplier invoice:1186](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.service.ts:1186). SOP Sheet1 C9, Sheet2 C16, Sheet3 C8/C12, Sheet4, Sheet9 C12; FIN-05/08/16. Kriteria penutupan: rule efektif dan snapshot, hitung ulang server, blokir konfigurasi wajib hilang, verifikasi dokumen pajak.

### G05 — Tinggi: approval PR/PO masih sekadar transisi status

Controller memeriksa permission `purchase_request.approve`, tetapi service langsung mengubah PR DRAFT/SUBMITTED menjadi APPROVED. Tidak ada evaluasi assignee, nilai/limit, tahapan, larangan self-approval atau budget. PO langsung OPEN setelah PR disetujui. Permission aksi merupakan fondasi yang benar, tetapi belum menggantikan approval instance untuk transaksi tertentu.

Bukti: [approvePurchaseRequest:1326](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.service.ts:1326), [createPurchaseOrder:1343](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.service.ts:1343). SOP Sheet7 C20, Sheet8 C10/C14; PTP-01/02, FIN-15, Setting §5. Kriteria penutupan: policy dan batas diperiksa server, keputusan tersimpan, approval stale setelah revisi material, bukti penolakan aktor tak berhak.

### G06 — Tinggi: penerimaan barang belum memisahkan keputusan kualitas

Request GR hanya memiliki satu locator untuk seluruh penerimaan, qty, batch dan expiry. Ia langsung POSTED dan menambah on-hand. Tidak ada qty layak vs karantina per baris, kondisi kemasan, suhu, pemeriksaan shelf-life maupun proses release. Memilih locator karantina memang mencegah alokasi pada alur berikutnya, tetapi tidak memaksa barang bermasalah masuk karantina berdasarkan hasil pemeriksaan.

Bukti: [receivePurchaseOrder:1415](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.service.ts:1415), [kontrak GR](/D:/APLIKASI/disflow/packages/contracts/src/otc-ptp.ts:85). SOP Sheet6 C14:C23; PTP-07. Kriteria penutupan: satu GR boleh beberapa batch/locator/kondisi, stok layak hanya berasal dari hasil pemeriksaan yang sah, shortage tidak menjadi stok.

### G07 — Tinggi: rantai dokumen dan pemenuhan sisa terputus

Ada pick/check/dispatch/POD dan invoice, tetapi tidak ditemukan workflow proforma, packing list, surat jalan, manifest/koli, bukti POD bertanda tangan, serta tukar faktur. POD hanya menerima waktu dan qty; data penerima/bukti tidak diwajibkan. Partial pick dapat disimpan tetapi check mewajibkan seluruh assigned qty; tidak ada command koreksi/reopen picking pada controller. Setelah GR, tidak ada reevaluate/allocate backorder, close remainder atau cancel SO pada controller yang diperiksa.

Bukti: [controller OTC/PTP](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.controller.ts:1), [confirmCheck:415](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.service.ts:415), [kontrak POD](/D:/APLIKASI/disflow/packages/contracts/src/otc-ptp.ts:50). SOP Sheet3/5; OTC-04/05/06/10/11/13. Kriteria penutupan: semua handoff memiliki sumber, status, actor dan bukti; selisih picking dan sisa SO bisa diselesaikan tanpa edit saldo atau hilangnya jumlah awal.

### G08 — Tinggi: invoice/AP belum sampai penyelesaian hutang supplier

Matching qty dan harga terhadap PO/penerimaan serta posting AP/GRNI sudah tersedia. Tetapi belum ditemukan command pembayaran supplier, approval bayar, bukti bank, alokasi dan reversal. `due_date` supplier diberikan oleh caller, bukan diturunkan dari snapshot TOP/basis tanggal PO/MOU. Pada sisi penjualan, invoice membaca TOP aktif saat posting; tidak menyimpan policy SO sebagai dasar jatuh tempo. Revisi TOP di antara SO dan invoice dapat mengubah ketentuan pesanan sebelumnya.

Bukti: [supplier invoice:1186](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.service.ts:1186), [invoice sales:602](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.service.ts:602), [schema SalesOrder](/D:/APLIKASI/disflow/packages/database/prisma/schema.prisma:1216). SOP Sheet9 C15:C17; PTP-03/04, FIN-02/03, Setting §4.1. Kriteria penutupan: hutang hanya berkurang setelah pembayaran sah dialokasikan; due date reproducible dari versi ketentuan dokumen sumber.

### G09 — Tinggi untuk operasional: frontend transaksi belum tersedia

Sidebar hanya menghubungkan Dashboard, CRM tertentu, Master Pelanggan, Pengguna dan Peran. Sebagian besar item modul ditampilkan sebagai `<span title="Layar belum tersedia">`. Penawaran dan kunjungan juga disabled. Pengguna belum dapat menjalankan SOP pesanan → gudang → invoice → bayar melalui Office walaupun sebagian command backend ada.

Bukti: [dashboard-sidebar.tsx:219](/D:/APLIKASI/disflow/apps/office/app/dashboard-sidebar.tsx:219), [fallback menu:309](/D:/APLIKASI/disflow/apps/office/app/dashboard-sidebar.tsx:309), [penawaran:457](/D:/APLIKASI/disflow/apps/office/app/crm/crm-workspace.tsx:457), [kunjungan:620](/D:/APLIKASI/disflow/apps/office/app/crm/crm-workspace.tsx:620). Ini gap implementasi sementara yang konsisten dengan pembangunan bertahap, bukan bukti bahwa semua menu sudah operasional.

### G10 — Menengah: penomoran belum mengikuti format dan lifecycle SOP

Counter OTC/PTP menghasilkan `SO-00000001`, `PO-00000001`, dan seterusnya. Belum ada komponen perusahaan, tahun, bulan Romawi, reset policy, kategori administrasi umum, atau logbook permohonan nomor. Nomor SO sudah dialokasikan saat create draft. Counter atomik adalah fondasi positif, tetapi format/lifecycle masih berbeda dari SOP Sheet10 C8:C20 dan Setting §6.

Bukti: [num:10](/D:/APLIKASI/disflow/packages/backend/src/otc-ptp.service.ts:10). Kriteria penutupan: numbering rule editable, preview, nomor issued/void terlacak dan tidak dipakai ulang; snapshot template dan identitas menjaga cetak ulang.

### G11 — Menengah sampai tinggi: arsip, kontrak, kunjungan dan legal belum menjadi workflow

Model Attachment dan registrasi metadata CRM bukan bukti upload/storage/scan/download/retensi lengkap. Tidak ditemukan entitas/process untuk surat/disposisi, peminjaman arsip, DUPD/BAPD, legal hold atau kontrak karyawan/pelanggan/supplier. HrModule kosong. Data prospek, kontak dan peluang nyata tersedia, tetapi sebagian pemeliharaan kontak/master masih tidak dapat disimpan di UI. Kunjungan dan penawaran memiliki gap tersendiri pada matriks.

Bukti: [attachment registration:288](/D:/APLIKASI/disflow/packages/backend/src/crm/crm.service.ts:288), [HR module](/D:/APLIKASI/disflow/packages/backend/src/modules/hr.module.ts:1), [form CRM:421](/D:/APLIKASI/disflow/apps/office/app/crm/crm-forms.tsx:421). ADM-01, HR-01, CRM-02/04/05/08. Pekerjaan fisik seperti tanda tangan dan penyimpanan asli tetap memerlukan prosedur organisasi; aplikasi harus mencatat bukti dan statusnya bila masuk scope digital.

## Yang sudah terbukti sebagai fondasi

- Auth/permission guard server dan company filtering tersedia; multi-role serta HTTP autentikasi/penolakan tertentu dites. Scope pada guard saat ini terbatas company/privileged; ini tidak membuktikan assigned portfolio/warehouse/self sudah lengkap.
- CRM institusi/prospek/kontak/kebutuhan/peluang mempunyai persistence, audit dan idempotency; beberapa alur diuji melalui HTTP. Backend serta form Win/Lost juga sudah ada, sehingga catatan lama yang menyebut semua Win/Lost ditunda perlu diperbarui berdasarkan kondisi kode terkini.
- Banyak transaksi memakai Prisma Decimal dan database transaction, bukan number untuk uang/qty.
- SO mempertahankan ordered qty, allocated qty dan backorder qty; approval rutin SO tidak ditambahkan.
- Dispatch mensyaratkan picking/checking; prepay memiliki pemeriksaan receipt tertaut. POD memisahkan qty diterima/retur/transit; invoice berdasarkan qty diterima. Kontrol yang tersedia ini belum menutup semua kelemahan G01–G08.
- Supplier invoice memiliki nomor eksternal/internal, validasi qty/harga dan AP/GRNI. Retur/credit note/refund tertentu memiliki integration tests. Tidak tepat menyatakan backend seluruhnya kosong.

## Urutan penutupan gap yang direkomendasikan

1. **Sebelum transaksi nyata:** tutup G01–G06, snapshot TOP, serta pengujian konkurensi/idempotency. Ini menyangkut kredit, stok layak, jumlah barang, nilai transaksi dan persetujuan.
2. **Satu alur operasional lengkap:** SP/SO → alokasi → proforma/picking/check/packing/SJ → dispatch/POD → invoice/tukar faktur → penerimaan. Bangun UI beserta list/detail, command, bukti, akses, koreksi dan arsipnya; bukan sekadar menambah menu.
3. **Pengadaan sampai pembayaran:** evaluasi kebutuhan → PR → approval → PO/MOU → konfirmasi/kiriman → GR/QC → invoice/AP → approval/pembayaran → rekonsiliasi. Pastikan backorder yang mendasari pembelian kembali tersambung ke fulfillment.
4. **Workflow pendukung SOP:** numbering/template, arsip/surat/legal/kontrak dan reminder; CRM penawaran/kunjungan mengikuti prioritas Office dan keputusan penundaan Field.
5. **UAT penerimaan:** jalankan dengan akun peran nyata, termasuk penolakan akses; simpan bukti dokumen, audit, movement dan jurnal. Revisi SOP digital serta traceability blueprint agar keputusan yang berbeda eksplisit.

### Skenario minimum tambahan untuk acceptance

| Skenario | Hasil yang wajib |
|---|---|
| Pelanggan sudah melunasi invoice lama | Exposure tidak tetap sebesar subtotal historis. |
| Pelanggan past due/freeze mencoba SO/dispatch | Ditahan menurut policy; exception hanya grant berizin. |
| Dua SO paralel pada pelanggan/lot sama | Limit dan qty tidak terlampaui; retry tidak menggandakan dokumen. |
| Satu SO punya dua baris produk sama | Akumulasi reserved <= qty layak yang tersedia. |
| Batch expired/hold/karantina/recall | Tidak dialokasikan atau dikirim; FEFO/FIFO terjaga setelah lock. |
| Picking kurang dari assigned | Ada jalur selisih, revisi dokumen dan penyelesaian sisa yang sah. |
| GR berisi baik + rusak + kurang | Hanya qty aktual, locator/kualitas terpisah, shortage tetap terbuka. |
| Stok baru datang untuk backorder | Re-evaluate kredit lalu alokasi sisa tanpa duplikasi PR/PO/fulfillment. |
| User punya permission approval tetapi bukan assignee/di atas limit | Ditolak; self-approval mengikuti policy. |
| TOP berubah sesudah SO | Invoice mengikuti snapshot yang sah, bukan diam-diam memakai setting terbaru. |
| Pajak wajib belum dikonfigurasi | Posting diblokir, bukan default pajak nol. |
| Supplier invoice dibayar parsial/di-retry | AP hanya berkurang sesuai alokasi posted sekali, dengan bukti/audit. |
| Dokumen memerlukan bukti serah terima/arsip | Bukti privat dapat diakses yang berizin dan tidak bisa dipalsukan oleh status UI saja. |

## Dampak perubahan audit

Requirement yang ditinjau terutama CRM-01/02/04–08/12/14, OTC-01–16, PTP-01–07, WH-01/02/08, FIN-02/03/05/08/15/16, HR-01/07, MD-06/08, IAM-03 dan ADM-01. Tidak ada requirement yang diimplementasikan dalam pekerjaan audit ini. Tidak ada perubahan backend/frontend, migration atau aturan produk. Dokumen baru ini mencatat gap dan acceptance; sinkronisasi normatif SOP/blueprint serta perbaikannya merupakan pekerjaan lanjutan.
