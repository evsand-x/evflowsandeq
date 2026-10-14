# Keputusan Final Parameter Bisnis

Status: **Gelombang A–F Approved untuk blueprint/pilot oleh pengguna pada 25 September 2026**. D06 adalah keputusan stack, D28 menetapkan nama aplikasi final **evflow**, D29 menyederhanakan Profil Perusahaan, dan D30 menetapkan parameter operasional editable melalui UI. Dokumen domain tetap menjadi sumber aturan rinci.

Final pada dokumen ini berarti aturan, default, blocker dan pemilik data sudah diputuskan untuk implementasi. Tarif pajak, formula payroll, identitas resmi, shelf-life, suhu produk dan nilai kontraktual yang harus berasal dari dokumen berwenang tetap wajib diisi melalui policy bertanggal efektif. Ketidaktersediaan data tersebut menahan transaksi resmi dan tidak memberi izin kepada sistem untuk menebak.

## 1. Prinsip final

1. Policy/rule memiliki versi, tanggal efektif, owner, status Draft/Active/Retired dan audit.
2. Transaksi menyimpan snapshot policy; perubahan tidak menghitung ulang histori diam-diam.
3. Nilai yang memengaruhi uang, pajak, stok, mutu, payroll atau privasi tidak boleh memakai nol/default tersembunyi.
4. Konfigurasi wajib yang belum lengkap menjadi blocker dengan pesan dan owner tindakan.
5. Data uji terpisah dari production dan tidak boleh dipakai untuk pajak, payroll atau laporan resmi.
6. Keputusan baru setelah tanggal ini memakai change request dan sinkronisasi Requirements, domain, User Flow, Design, Database, API, Features, README serta audit.
7. Nama produk pada seluruh kanal adalah **evflow**. Nama perusahaan awal PT Sandeq Sarana Medika dapat diedit langsung melalui Profil Perusahaan tanpa effective date, alasan atau approval; dokumen issued mempertahankan snapshot.
8. Nilai operasional yang tercantum dalam katalog [dokumen 40](15-setting.md) adalah nilai awal. Pengguna berizin dapat mengubahnya melalui UI; kode aplikasi tidak boleh menanam angka tersebut sebagai konstanta bisnis.

Seluruh angka/default pada tabel Gelombang A–F yang memiliki kode `OPS-*` di dokumen 40 dibaca sebagai **nilai awal editable**, bukan aturan permanen. Invariant pada dokumen 40 bagian 9 tetap mengikat.

## 2. Gelombang A — keuangan, persediaan dan order-to-cash

Status: **Approved**.

| Topik | Keputusan final |
|---|---|
| Mata uang/tahun buku | Nilai awal OPS-COMP: IDR; 1 Januari–31 Desember; Asia/Makassar untuk tanggal bisnis. Timestamp teknis tetap UTC |
| Pendapatan/HPP | Nilai awal kebijakan akuntansi: diakui pada POD sebesar jumlah diterima; kontrak khusus memakai posting profile tersendiri |
| HPP | Nilai awal moving average per perusahaan+produk dalam satuan dasar; transit/konsinyasi keluar membawa cost snapshot |
| Harga jual | `biaya acuan / (1 − target margin)`; price list tidak dapat dipublish sebelum margin, pembulatan, batas diskon dan approver scope lengkap |
| Kredit | Follow-up H-7, H, H+3, H+7, H+14; freeze H+30; exception melalui unlock beralasan dan bertenggat |
| Exposure | AR + unbilled POD + transit + stok teralokasi tanpa hitung ganda − uang muka tertaut; backorder belum dialokasikan tidak memakai limit |
| Jatuh tempo AP | Tanggal invoice lengkap diterima dan diverifikasi + TOP; invoice date atau GR hanya bila dipilih eksplisit pada PO/MOU |
| Matching | Nilai awal OPS-FIN-02–04: tolerance qty/harga 0 dan pembulatan Rp1; selisih di atas policy aktif menjadi exception |
| Landed cost | OPS-FIN-05 awalnya berdasarkan nilai pembelian net per charge; berat/volume/qty/rata dapat dipilih dan memerlukan data lengkap |
| Mata uang asing | Nonaktif pada versi awal |
| Beberapa POD | OPS-FIN-07 awalnya hanya menggabungkan POD dengan customer, currency, tax profile, TOP dan tanggal POD sama; validasi due date/pajak tetap wajib |
| Reservasi prepay | OPS-FIN-06 awalnya sampai akhir satu hari kerja berikutnya; hanya qty belum picking yang dapat dilepas otomatis setelah evaluasi |
| Kapitalisasi aset | Tidak otomatis; kandidat direview menjadi beban, prepaid, persediaan operasional, CIP atau aset |
| Aging/opening | OPS-FIN-08 awalnya belum jatuh tempo, 1–30, 31–60, 61–90, >90 hari; opening tetap per invoice/tagihan |

## 3. Gelombang B — gudang, kualitas, retur dan master

Status: **Approved**.

| Topik | Keputusan final |
|---|---|
| Shelf-life | Wajib berasal dari policy produk/kategori/supplier/customer. Nilai yang belum tersedia menghasilkan quality hold dan blok alokasi/dispatch, bukan asumsi universal |
| Suhu | Rentang berasal dari izin edar/produsen yang diverifikasi. Data suhu hilang atau excursion menghasilkan hold dan review PJT |
| GR | Nilai awal over-receipt tolerance 0% melalui OPS-WH-01; short receipt dicatat aktual sebagai selisih dan sisa PO, tanpa stok fiktif |
| POD | Accepted/rejected/missing selalu aktual; tidak ada tolerance otomatis yang mengubah qty |
| Alokasi | OPS-WH-02/03 awalnya lolos kredit dan eligibility batch → FEFO → waktu komitmen SO. Eligibility invariant tetap pertama; realokasi tidak menarik barang yang sudah dispatch |
| Retur pelanggan | Semua retur memakai alasan, baris sumber, qty, bukti dan review. Eligibility/batas waktu wajib policy aktif; jika belum ada, retur masuk karantina dan keputusan finansial ditahan |
| Retur supplier | Wajib tertaut PO/GR dan memilih return, replacement atau credit note secara eksplisit |
| Karantina | Retur pelanggan dan finding mutu otomatis ke locator karantina yang sesuai suhu dan tidak available |
| Recall | Recall aktif memblok alokasi, picking dan dispatch; release hanya oleh PJT/pihak kualitas berizin dengan bukti |
| Pemusnahan | Memerlukan pengusul, approver berbeda, witness, metode, bukti, stock movement dan jurnal; tidak ada pengurangan saldo langsung |
| Konsinyasi | Ownership wajib dari agreement. Barang supplier tidak masuk valuasi perusahaan; barang perusahaan tetap membawa cost snapshot |
| Kode master | Nilai awal OPS-WH-04: `PRD-000001`, `CUS-000001`, `CON-000001`, `SUP-000001`, `VEN-000001`, `EMP-000001`, `AST-000001`; perubahan tidak mengganti kode historis |
| Kelengkapan master | Daftar data wajib per jenis/saluran/kategori. Master belum lengkap tetap Draf dan tidak dapat dipakai transaksi resmi |
| NIE | Jenis AKL/AKD, nomor, pemilik, masa berlaku, status dan bukti berversi. NIE invalid/expired memblok transaksi baru kecuali disposition PJT berizin |

## 4. Gelombang C — pajak dan Coretax

Status: **Approved sebagai kontrol pajak**. Data resmi dan bukti eksternal tetap prasyarat production.

| Topik | Keputusan final |
|---|---|
| Identitas pajak | Hanya dari dokumen resmi PT Sandeq Sarana Medika; identitas contoh XML dilarang menjadi production profile |
| Tax profile pihak | PKP, WAPU, pemotong/pemungut, NPWP/TIN, ID TKU, masa berlaku dan bukti wajib diverifikasi |
| PPN/PPh | DPP, tarif, waktu terutang, eligibility dan akun berasal dari rule aktif bertanggal efektif; tidak di-hardcode |
| WAPU | PPN Dipungut WAPU dan PPh Dipotong tetap dua komponen dengan bukti, status verifikasi dan akun terpisah |
| PPh Badan | Worksheet tahunan wajib. Provision bulanan nonaktif pada awal dan hanya diaktifkan melalui policy Finance/pajak. Pajak tangguhan nonaktif sampai materiality/policy disahkan |
| Coretax | Ekspor XML file mengikuti template pengguna. Production membutuhkan XSD aktual, katalog kode resmi, identitas terverifikasi dan sedikitnya satu batch UAT Accepted |
| Faktur koreksi | Pengganti/retur harus tertaut dokumen asal dan mengikuti rule aktif; tidak mengedit XML/faktur posted |
| Integrasi | Direct API Coretax dan parser hasil terstruktur di luar scope awal; upload dan pencatatan hasil dilakukan manual dengan bukti |

## 5. Gelombang D — HRIS, payroll, biaya dan perjalanan

Status: **Approved sebagai workflow dan mandatory configuration**. Payroll resmi tetap diblokir sampai nilai HR/pajak diaktifkan dan parallel run lulus.

| Topik | Keputusan final |
|---|---|
| Fingerprint | Impor file ke staging; raw row immutable, mapping/deduplikasi/review sebelum commit. Tidak ada koneksi langsung mesin pada versi awal |
| Kalender/shift | Kalender dan shift wajib per kelompok serta bertanggal efektif. Tidak ada jadwal kerja global yang ditebak |
| Cuti/izin | Ledger saldo wajib; jenis, kuota, accrual, carry-forward, minus, bukti dan approval berasal dari policy aktif. Policy hilang memblok pengajuan jenis tersebut |
| Lembur | Rencana → approval → realisasi → verifikasi. Scan terlambat tidak menjadi lembur otomatis; formula wajib policy aktif |
| Payroll | Komponen, prorata, cut-off, pay date, rekening, approval dan rule wajib lengkap. Sebelum resmi, jalankan minimal dua parallel run yang direkonsiliasi dengan hitungan manual |
| THR/BPJS/PPh 21 | Rule bertanggal efektif dari sumber tervalidasi; tidak ada tarif atau formula hardcoded |
| Komisi | Sumber aktual posted, eligibility, formula, cut-off, adjustment dan approval berversi; payout hanya setelah review |
| Rekrutmen | Hiring request dan offer memakai approval/budget. Kandidat menjadi karyawan hanya melalui konversi berizin; tidak ada create employee diam-diam |
| Offboarding | Notice, task, handover, pencabutan akses, aset, advance dan final pay memakai snapshot. Kehilangan aset tidak otomatis dipotong tanpa policy/legal review |
| Biaya/reimbursement | Kategori harus memiliki akun, bukti, limit, approver, dimensi dan tax treatment; mapping hilang menjadi Exception |
| Perjalanan | Nilai awal OPS-HR-01–05: advance H-7, settlement 5 hari, cut-off 10/25, hotel Rp350.000, uang harian Rp100.000, makan Rp35.000 maksimal 3 kali, entertainment Rp250.000, dan ambang 6 jam. Policy aktif menentukan batas; biaya di atas batas memerlukan exception |
| Aset operasional | Kapitalisasi dan penyusutan hanya setelah asset-class policy aktif; sebelum itu kandidat tetap Menunggu Review Finance |
| Retensi kandidat | OPS-HR-06 awalnya dua tahun setelah aktivitas/consent terakhir, lalu anonymize/delete sesuai legal hold; akses catatan seleksi dibatasi |

## 6. Gelombang E — CRM, target dan aplikasi mobile

Status: **Approved**.

| Topik | Keputusan final |
|---|---|
| Pipeline | OPS-CRM-01 awalnya menutup peluang saat month-end; dapat diubah melalui UI. Sisa layak diteruskan melalui Copy Remaining setelah review, bukan reopen otomatis |
| Win/cut-off | Win saat PO/SP diterima dan diverifikasi. Koreksi setelah close menjadi adjustment pada periode terbuka dengan tautan ke periode asal |
| Pelanggan aktif | OPS-CRM-02 awalnya invoice posted dalam 12 bulan terakhir; terpisah dari status master Active/Inactive |
| Retur target | Mengurangi aktual pada periode credit note/retur finansial diposting; laporan tetap menyediakan dimensi periode invoice asal |
| Atribusi | Default 100% kepada owner invoice/SO. Split diperbolehkan dengan total tepat 100%, alasan, approver dan versi |
| A/T arah menurun | Template awal OPS-CRM-04: `max(0%, min(200%, 200% − (Aktual ÷ Target × 100%)))`; target 0 menampilkan “—”. Formula dipilih dari template yang didukung, bukan kode bebas |
| KPI gabungan | OPS-CRM-05 awalnya nonaktif. Jika diaktifkan, bobot wajib berjumlah 100% dan setiap metrik menyimpan formula/satuan/arah |
| Kunjungan | Approval atasan; nilai awal OPS-VIS adalah satu foto dan radius 200 meter. Pelanggaran policy, perubahan atau kunjungan di luar rencana tetap dicatat sebagai Exception dan memerlukan review |
| Mobile | Nuxt/Vue 3 + Capacitor; minimum Android 10 dan iOS 15; pilot melalui distribusi internal Android dan TestFlight iOS; PWA/browser hanya akses tambahan |
| Tracking | Sesi kerja mulai/akhir eksplisit; OPS-VIS-03–06 awalnya 5/15 menit, raw 90 hari dan ringkasan 1 tahun, lalu mengikuti legal hold |
| Sampel | Issue membutuhkan account/tax/disposition policy aktif. Policy hilang menahan issue; sampel gratis tidak otomatis menjadi penjualan/NOO |

## 7. Gelombang F — IAM, infrastruktur, laporan dan arsip

Status: **Approved**.

| Topik | Keputusan final |
|---|---|
| Self-approval | Nonaktif secara default. Pengecualian harus eksplisit per document kind, beralasan, berversi dan diaudit |
| Role awal | Admin Sistem, Sales, Supervisor Sales, Warehouse, Purchasing/Logistik, Finance, HR dan Pimpinan; satu pengguna boleh beberapa role |
| Approval assignment | Tidak ada approver atau limit nominal tebakan. Policy tidak dapat Active sebelum assignee, scope, limit dan fallback lengkap |
| SLA approval | OPS-SYS-06/07 awalnya reminder 4 jam kerja dan escalation 1 hari kerja; jenis transaksi dapat override melalui policy |
| Hosting | Pilot dan production terpisah. Gunakan managed PostgreSQL, Redis dan private object storage; prioritas region Jakarta, fallback Singapore dengan keputusan terdokumentasi; secret di secret manager |
| Backup/DR | Pilot RPO 24 jam/RTO 8 jam. Production RPO ≤1 jam/RTO 4 jam; point-in-time recovery, backup harian terenkripsi dan restore test minimal triwulanan |
| Retensi | Nilai awal OPS-HR/OPS-SYS: finance/pajak/stok/transaksi/audit/arsip karyawan 10 tahun, security/session 2 tahun, lokasi 90 hari/1 tahun dan kandidat 2 tahun; batas hukum aktif tetap menjadi minimum |
| Dashboard | Default per role; personalisasi hanya layout/filter. Angka/formula tetap dari definition version dan tidak dapat diubah personalisasi |
| Realtime dan refresh | Nilai awal OPS-SYS-01: event perubahan committed terlihat pada klien aktif berizin ≤10 detik; fallback refresh maksimal 5 menit. Laporan berat menampilkan `data_as_of` dan boleh asynchronous |
| Penyamaran laporan HR kelompok kecil | Nilai awal OPS-SYS-02 menyembunyikan metrik HR untuk kelompok kurang dari 5 orang; pengguna HR khusus tetap mengikuti izin per bidang data |
| Ekspor | File privat, checksum dan audit download; nilai awal OPS-SYS-03 expiry 7 hari, lalu pengguna membuat ulang dari sumber bila retensi data masih berlaku |
| Template cetak | Prioritas: SO, Proforma, Picking, Packing, Surat Jalan, Invoice, PO, GR, pembayaran, nota retur dan kartu piutang. Template wajib versioned/published; dokumen terbit menyimpan version snapshot |
| Keamanan | MFA untuk admin/finance/HR/pimpinan dan aksi sensitif direncanakan, tetapi belum wajib pada tahap implementasi saat ini; production dipisah dari data uji; least privilege dan permission test menjadi release gate |

## 8. Status register keputusan

| Register | Status final |
|---|---|
| D01–D05 | Approved Gelombang A |
| D06 | Stack dikonfirmasi pada README |
| D07–D08 | Approved Gelombang A/F |
| D09 | Approved Gelombang D; profile file perangkat tetap data implementasi |
| D10 | Approved Gelombang A |
| D11 | Approved Gelombang D/E; formula komisi wajib policy aktif |
| D12 | Approved Gelombang F |
| D13 | Approved Gelombang B; nilai suhu/shelf-life wajib sumber resmi |
| D14 | Approved Gelombang A |
| D15 | Approved Gelombang B |
| D16 | Approved Gelombang A |
| D17 | Approved Gelombang B |
| D18–D19 | Approved Gelombang E |
| D20–D23 | Approved Gelombang D sebagai workflow/mandatory configuration |
| D24–D25 | Approved Gelombang C sebagai kontrol; evidence resmi tetap release gate |
| D26–D27 | Approved Gelombang F |
| D28–D30 | Approved: identitas evflow, Profil Perusahaan sederhana dan Kebijakan Operasional editable |

## 9. Gerbang penggunaan

Pilot transaksi dengan data uji fiktif dapat memakai seluruh keputusan final di atas. Operasional resmi baru boleh dimulai setelah:

1. data awal stok, nilai persediaan, AR/AP, kas/bank dan aset direkonsiliasi;
2. tax profile, XSD/katalog Coretax dan UAT Accepted tersedia untuk fungsi pajak yang digunakan;
3. policy produk untuk suhu/shelf-life dan matriks mandatory field diaktifkan;
4. kalender HR, cuti, lembur, payroll, THR/BPJS/PPh 21 dan rekening pembayaran diaktifkan serta dua parallel run lulus;
5. assignee/limit approval, rekening, CoA mapping, template cetak dan nomor dokumen dipublish;
6. proof-of-concept Android/iOS, permission test, backup/restore dan acceptance test lintas modul lulus.

Kegagalan salah satu gerbang tidak membatalkan blueprint; sistem harus menahan fungsi resmi yang terdampak dan menjelaskan konfigurasi atau evidence yang masih kurang.


---

## Bagian asal: 00-document-map.md\n
