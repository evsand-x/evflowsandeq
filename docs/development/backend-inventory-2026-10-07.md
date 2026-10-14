# Inventaris backend — 7 Oktober 2026

Pemeriksaan lanjutan atas permintaan pengguna mengenai backend yang tersedia. Metode: penelusuran registrasi NestJS, controller, service/domain helper, schema/migration, worker dan berkas pengujian. Tidak menjalankan test workflow, browser, command transaksi, migration atau mengubah kode aplikasi. Status implementasi tidak membuktikan kelulusan runtime, konfigurasi perusahaan, versi proses aktif maupun kesiapan production.

Acuan: peta dokumen dan register keputusan blueprint; OTC-01–16, CRM-11, FIN-01–08/11/16 untuk O2C. Modul lain diinventarisasi sebagai gambaran cakupan, bukan audit acceptance seluruh requirement. Laporan remediasi 5 Oktober menjadi riwayat; keberadaan implementasi diperiksa kembali pada sumber saat ini.

## Backend yang sudah mempunyai implementasi

| Area | Cakupan yang ditemukan | Bukti sumber |
|---|---|---|
| Identitas dan hak akses | Login, refresh/logout, CSRF, sesi pengguna, pengguna/peran/permission | `identity/auth.controller.ts`, `identity/access.controller.ts` |
| Setting | Profil perusahaan, baca/validasi/perubahan kebijakan operasional | `administration/administration.controller.ts` |
| Master | Pelanggan, produk/UOM, supplier/vendor, gudang/locator, referensi dan aktivasi | `master/master.controller.ts` |
| CRM | Prospek, kontak, kebutuhan, peluang, quotation, SP pelanggan, aktivitas/attachment | `crm/crm.controller.ts` |
| SO | Draft/submit, revisi terbatas, daftar/detail/lookup, tutup atau batalkan sisa | `otc-ptp.service.ts`, `sales/o2c-lifecycle.ts`, `sales/operations.service.ts` |
| Kredit | Policy pembayaran, freeze, overdue, exposure AR + alokasi + transit + POD belum ditagih − advance tertaut; penguncian pelanggan | `sales/transaction-controls.ts` |
| Harga/pajak SO | Harga acuan dan rule pajak efektif, snapshot, Decimal, penolakan policy kosong/konflik dan harga khusus tanpa grant | `sales/pricing-controls.ts` |
| Approval exception | Unlock/harga khusus, assignment/limit, langkah approval, self-approval guard, expiry, hash perubahan material, cancel/delegate | `sales/exception-controls.ts` |
| Stok/backorder | Pemilihan lot FEFO/FIFO, hold/expiry, locking, realokasi, pelepasan reservasi, expiry PREPAY dan antrean evaluasi | `sales/transaction-controls.ts`, `sales/reservation-controls.ts`, `sales/exception-evaluation.ts` |
| Gudang/POD | Picking/checking, penyelesaian selisih, dispatch, dokumen pengiriman, POD parsial/retur | `otc-ptp.service.ts`, `sales/o2c-lifecycle.ts` |
| Invoice/AR/penerimaan | Invoice menunggu POD dan posting dari POD, aging, receipt/uang muka serta alokasi | `otc-ptp.controller.ts`, `otc-ptp.service.ts` |
| Retur/refund/pajak khusus | Retur fisik, credit note, refund berapproval, advance tax, WAPU/PPh, dokumen resmi/koreksi pajak | `finance/controls.controller.ts`, `finance/advance-tax.ts`, `finance/advance-refund.ts`, `finance/remediation.ts` |
| Bank/GL | Konfigurasi posting, jurnal, statement, matching/unmatch/reopen, transaksi bank, rekonsiliasi, request reversal dan close/reopen periode | `finance/controls.controller.ts`, `finance/posting.ts`, `finance/economic-reconciliation.ts`, `finance/period-close.ts` |
| Procurement/AP | Approval PR, PO, goods receipt, supplier invoice dan posting | `otc-ptp.controller.ts`, `otc-ptp.service.ts` |
| Kontrol bersama | Transaction command dengan hash/replay dan advisory lock; audit, dokumen dan numbering; migration proteksi jurnal | `common/transaction-command.ts`, `common/audit.service.ts`, `common/document-number.ts`, migration finance |

Path sumber pada tabel relatif terhadap `packages/backend/src`, kecuali migration. Controller O2C/operations/finance-controls terdaftar di `OtcPtpModule`, yang diimpor `apps/api/src/app.module.ts`. `WarehouseModule` kosong tidak berarti tidak ada backend gudang: implementasi gudang saat ini berada di OtcPtpModule. Worker mengimpor dan menjalankan `processExceptionEvaluations` serta `processReservationExpiries`; keberhasilan eksekusi job tidak diverifikasi pada inventaris ini.

## Gap integrasi tampilan versus gap fungsi

1. **Kredit tersedia sebagai kontrol transaksi, belum tersedia sebagai KPI SO.** `sales/operations.service.ts` mengembalikan `summary.creditHold: null`. Read model SO juga belum menyajikan hasil evaluasi kredit terbaru untuk setiap baris.
2. **Kelayakan/reservasi stok tersedia, stok informatif form SO belum terhubung.** `sales/order-view.ts` menyajikan subtotal/pajak/total, fulfillment dan remainder, tanpa projection stok tersedia per produk. Mengubah label kosong menjadi angka contoh tidak menyelesaikan gap ini.
3. **Approval exception tersedia, antrean persetujuan Dashboard belum mengonsumsinya.** `dashboard/action-queue.service.ts` masih menyatakan approvals unavailable; tindak lanjut CRM memiliki query sendiri.
4. **Finance/gudang tersedia sebagian dalam transaksi, dashboard belum mengagregasikannya.** `finance-dashboard.service.ts` dan `warehouse-dashboard.service.ts` mengembalikan banyak sumber unavailable. Dashboard Sales juga belum mengambil net sales/target/realisasi kunjungan secara lengkap.
5. **Katalog laporan bukan mesin laporan operasional.** `dashboard/reports.service.ts` menandai katalog unavailable, `can_export: false`, dan hasil preview laporan kosong. Endpoint aging AR yang ada belum otomatis terhubung ke katalog tersebut. Istilah preview di sini adalah pratinjau laporan, bukan route UI simulasi.
6. **Diskon/ongkir SO dan revisi tambah/hapus produk masih gap domain/kontrak.** Perhitungan SO memakai quantity × unitPrice + pajak. Field diskon quotation yang ada pada schema tidak membuktikan diskon SO sudah didukung. Revisi SO terbatas pada baris yang sudah ada.
7. **HRIS belum mempunyai service transaksi inti.** `modules/hr.module.ts` kosong; dashboard HRIS menyediakan status unavailable. Tidak ditemukan implementasi payroll/absensi/cuti lengkap pada backend yang diinventarisasi.

## Batas O2C yang masih harus ditutup

Laporan remediasi mencatat gap outstanding timing bank, rekonsiliasi subledger/historis penuh, AP/GRNI/payroll/tax closing, tukar faktur/collector/COD collection, Coretax/XSD dan lifecycle faktur resmi, serta template cetak/arsip/retensi dan role database produksi. Inventaris ini tidak menemukan bukti yang cukup untuk mengubah gap tersebut menjadi selesai. Detail audit domain khusus tetap diperlukan; tidak semua fungsi Finance disimpulkan lengkap hanya karena endpoint tersedia.

Konfigurasi policy aktif, kalender, numbering, rekening, posting profile/periode, assignment approval dan pajak resmi tetap prasyarat transaksi. Keberadaan migration `20261005180000_o2c_remediation` dan `20261005190000_o2c_release_controls` diverifikasi di repository; status penerapannya pada database/proses aktif tidak diperiksa ulang.

## Bukti pengujian dan rekomendasi

Berkas `tests/integration/otc-controls.test.ts` memuat skenario kredit, reservasi concurrency, FEFO, approval harga/unlock, pajak advance/WAPU/PPh, bank matching, immutable journal, idempotency, alur SO–POD–invoice–pembayaran dan penolakan. `otc-corrections.test.ts` memuat refund dan penolakan retur lintas pelanggan/invoice. Berkas tersebut tidak dijalankan pada pemeriksaan ini; keberadaannya bukan bukti kelulusan versi sekarang. Remediasi terbaru sebelumnya hanya divalidasi statis.

Prioritas agar UI SO menampilkan fakta backend secara lengkap: projection hasil kredit/hold, stok informatif berizin beserta timestamp, lalu antrean approval. Pisahkan pekerjaan itu dari pengembangan kontrak diskon/ongkir dan revisi produk. Tidak ada perubahan permission, data/saldo, API, schema, atau migration pada pemeriksaan ini. Validator repository dijalankan untuk dokumen hasil inventaris.
