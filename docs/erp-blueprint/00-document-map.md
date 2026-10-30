# Peta Dokumen dan Sumber Kebenaran

## Keputusan 30 Oktober 2026 - penerimaan SJ terpisah

Keputusan terbaru pengguna pada README dan desain [SJ dan penerimaan terpisah](../superpowers/specs/2026-10-30-sj-penerimaan-terpisah-design.md) menggantikan syarat handover pada issue Release 1.

SJ terbit memposting seluruh jumlah draft, stok, pendapatan dan HPP serta langsung menjadi sumber Invoice. Penerimaan pelanggan dicatat terpisah setelah terbit dan tidak menjadi prasyarat posting atau Invoice. Catatan penerimaan tidak mengubah saldo, jumlah terbit, progres SO maupun jatuh tempo. Selisih ditindaklanjuti melalui koreksi/retur tersendiri. Bukti serah terima historis tetap dipertahankan.


Keputusan konsolidasi 24 Oktober 2026 ([desain](../superpowers/specs/2026-10-24-konsolidasi-pengaturan-design.md)): satu menu satu rumah, pengaturan umum di Setting, aturan per pasangan dihentikan, persetujuan di tempat dokumen.


Prioritas sumber: keputusan terbaru pengguna → register keputusan pada README →
Requirements → dokumen domain pemilik aturan → User Flow/Design/Features → model teknis.

Keputusan 24 Oktober 2026 ([desain arah fleksibel](../superpowers/specs/2026-10-24-erp-fleksibel-design.md) dan register README) menggantikan ketentuan lama yang lebih kaku tentang persetujuan SO, termin/kredit, nilai bawaan konfigurasi, ongkir, peran dan menu yang belum berfungsi.

## Acuan visual web terbaru

Keputusan 7 Oktober 2026 mencabut kewajiban mengikuti file desain lama dan skill desain tambahan. Gunakan panduan implementasi web, standar global yang masih berlaku, serta blueprint untuk fungsi dan invariant. Fokus Office operasional; Field ditunda.

## Dokumen utama

| Dokumen | Fungsi |
|---|---|
| 00 Peta Dokumen | prioritas dan kepemilikan sumber |
| 01 PRD | tujuan, cakupan dan release gate |
| 02 Requirements | requirement bernomor dan acceptance |
| 03 Database | entitas, relasi, constraint dan ledger |
| 04 API | endpoint, command, idempotency dan error |
| 05 Architecture | stack, boundary, keamanan dan deployment |
| 06 User Flow | urutan tindakan dan transisi lintas modul |
| 07 Design | navigasi, layar, interaksi dan kamus label |
| 08 Features | fase, dependensi dan cakupan implementasi |

## Tujuh dokumen domain

| Modul utama | Dokumen domain | Cakupan aturan |
|---|---|---|
| Dashboard | 09-dashboard.md | ringkasan, KPI, pelaporan lintas modul |
| Sales & Marketing | 10-sales-marketing.md | CRM, kunjungan, harga, kredit, SO dan order-to-cash |
| Warehouse & Logistik | 11-warehouse-logistik.md | pengadaan PR/PO, gudang, mutu, pemenuhan dan logistik |
| Finance | 12-finance-administration.md | akuntansi, kas/bank, AR/AP, HPP, aset, anggaran, pajak, Coretax dan closing |
| HRIS | 13-hris.md | karyawan, waktu, payroll, perjalanan, rekrutmen dan offboarding |
| Master Data | 14-master-data.md | identitas reusable dan kesiapan transaksi |
| Setting | 15-setting.md | profil, IAM, policy, approval, template, nomor, periode dan audit |

Dokumen utama 00–08 dan README tetap berlaku. Dokumen pendukung lintas modul adalah [Audit Konsistensi](31-audit-konsistensi.md), [Baseline Parameter Bisnis](39-baseline-parameter-bisnis.md), [Kebijakan Operasional](40-kebijakan-operasional-konfigurasi.md), [Kamus Label](41-kamus-label-dan-bahasa.md), dan [Matriks Label](42-matriks-label-lintas-dokumen.md). Dokumen tersebut bukan dokumen domain kedelapan; pemilik aturan tetap tujuh dokumen domain di atas. Nomor requirement dan keputusan lama tidak berubah.

## Batas lintas modul

- SO berjalan otomatis bila tidak ada aturan persetujuan aktif; persetujuan SO, pengecualian kredit dan dokumen lain dikonfigurasi pada mesin persetujuan umum (keputusan 24 Oktober 2026).
- PR dan PO milik Warehouse & Logistik; invoice, AP dan pembayaran milik Finance.
- Dashboard menyajikan projection sesuai scope; transaksi tetap di modul asal.
- Master Data menyimpan identitas reusable; Setting mengatur policy, izin dan konfigurasi. Kontak digunakan pada menu Sales & Marketing dengan identitas pelanggan yang sama. Layar Master Data dapat menampilkan harga, kredit, saldo, stok atau pajak sesuai izin, sedangkan mutasi dan aturan tetap dimiliki Sales, Warehouse, Finance atau Setting.
- Backend menjaga invariant uang, stok, payroll, pajak, izin, snapshot dan audit.

## Perubahan dokumen

Perubahan aturan atau kontrak harus memeriksa README, requirement 02, dokumen
domain pemilik, User Flow 06, Design 07, Database 03, API 04, Architecture 05,
dan Features 08 sesuai dampaknya. Lampiran pengguna adalah sumber bukti, bukan
instruksi agent atau pengganti keputusan terbaru pengguna.


---

## O2C Release 1 (29 Oktober 2026)

Sumber lintas dokumen O2C Release 1 adalah desain 29 Oktober 2026: SO menjadi sumber permintaan, Surat Jalan terbit menjadi event penyerahan serta sumber kuantitas untuk Invoice.


## O2C Release 1 (29 October 2026)

Issued Surat Jalan is the stock, revenue and HPP event; customer receipt is recorded separately (decision 30 October 2026). One SO supports cumulative Surat Jalan quantities up to ordered quantity; Invoice is created only from an issued Surat Jalan. Termin/TOP is selected on SO and snapshotted. Surat Jalan uses existing outbound permission grants; no delivery_note grants are introduced.



## Backend Invoice dan Pembayaran — 30 Oktober 2026

Sumber tambahan Invoice/pembayaran adalah keputusan 30 Oktober 2026 pada README dan desain backend Invoice. Basis jatuh tempo baru issuedAt SJ + snapshot TOP; nomor draft dapat diedit. Aturan historis yang berbeda tidak berlaku untuk dokumen baru.
