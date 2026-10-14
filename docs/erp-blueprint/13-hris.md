# Domain HRIS

Dokumen ini adalah sumber domain kanonis untuk modul ini. Judul ‘Bagian asal’ mempertahankan keterlacakan isi sebelum konsolidasi; prioritas keputusan tetap mengikuti Peta Dokumen.


---

## Bagian asal: 13-hris.md

# Perjalanan Dinas, Cash Advance, dan Klaim

Status: aturan operasional disusun dari slide 11–12 PPT Administrasi Keuangan & Operasional dan dihubungkan ke alur reimbursement. Nilai yang kosong pada PPT tidak ditebak dan harus diisi melalui Setting sebelum transaksi resmi menggunakan kategori tersebut.

Perjalanan yang disetujui menjadi sumber status **Dinas Luar/Perjalanan Dinas** pada absensi untuk tanggal terkait. Integrasinya mengikuti [Waktu, Kehadiran, Cuti dan Lembur](13-hris.md) dan tidak membuat karyawan harus mengajukan izin kedua untuk tanggal yang sama.

## 1. Pengajuan cash advance

Cash advance perjalanan diajukan **paling lambat tujuh hari sebelum keberangkatan**. Sistem menerima pengajuan pada rentang tanggal pengajuan sampai tujuh hari sebelum tanggal mulai kegiatan, kecuali ada exception yang disetujui.

Form:

- karyawan dan departemen;
- tujuan/kota dan customer/kegiatan terkait;
- tanggal mulai dan selesai;
- kategori biaya dan estimasi;
- rekening pembayaran;
- alasan dan bukti penugasan;
- approver atasan;
- status advance sebelumnya yang belum diselesaikan.

Alur:

**Draft → Diajukan → Persetujuan Atasan → Persetujuan Finance sesuai limit → Dibayar → Menunggu Settlement → Selesai**.

Advance yang masih outstanding dapat menahan advance baru, kecuali ada exception. Pembayaran advance memakai Kas & Bank dan membentuk Uang Muka Karyawan, bukan beban.

## 2. Settlement perjalanan

Laporan dan settlement diajukan **maksimal lima hari kalender setelah perjalanan selesai**. Form memuat tanggal aktual, rute, tujuan, biaya per kategori, bukti, sisa uang muka dan klaim tambahan.

| Hasil settlement | Perlakuan |
|---|---|
| Biaya sama dengan advance | Advance ditutup dengan bukti biaya |
| Biaya kurang | Karyawan mengembalikan sisa; kas/bank dicatat dan advance ditutup |
| Biaya lebih | Selisih menjadi reimbursement setelah approval |
| Bukti kurang | Baris menjadi exception dan tidak selesai sampai diselesaikan |
| Tidak ada laporan | Advance tetap outstanding dan masuk pengingat/escalation |

## 3. Siklus pembayaran klaim

Klaim yang sudah lengkap dan disetujui masuk ke jadwal pembayaran:

- diajukan paling lambat tanggal **10**, dibayar tanggal **15**;
- diajukan paling lambat tanggal **25**, dibayar pada akhir bulan.

Jika tanggal pembayaran jatuh pada hari libur, Finance menjadwalkan hari kerja sesuai kebijakan. Klaim yang belum disetujui pada cut-off masuk siklus berikutnya. Pembayaran klaim tidak membuat beban kedua.

Pengajuan insentif sales mengikuti aturan terpisah: diajukan paling lambat tanggal **7 pada awal bulan berjalan** setelah approval atasan. Rincian komponen dan perhitungan insentif tetap mengikuti kebijakan komisi/payroll yang dibahas pada HRIS.

## 4. Plafon perjalanan

| Kategori | Luar Kota | Dalam Kota | Aturan awal |
|---|---:|---:|---|
| Hotel/penginapan | Maksimal Rp350.000/malam | Tidak diberikan otomatis | Bukti menginap wajib; jumlah malam mengikuti tanggal perjalanan |
| Transportasi | Pesawat kelas ekonomi; bus, ojek atau sewa kendaraan | Bus, ojek atau sewa kendaraan sesuai kebutuhan | Tiket/struk/bukti perjalanan wajib |
| Uang harian | Rp100.000/hari | Tidak diberikan otomatis | Hari <6 jam mendapat 50%; ≥6 jam mendapat 100% |
| Uang makan | Rp35.000 per makan, maksimal 3 kali/hari | Aktual berbukti sesuai kegiatan | Tidak boleh diklaim dua kali dengan fasilitas makan yang ditanggung pihak lain |
| Entertainment | Maksimal Rp250.000 per kegiatan | Maksimal Rp250.000 per kegiatan | Wajib tujuan, peserta, bukti dan approval sesuai policy |

Nilai di atas menjadi nilai awal pada OPS-HR-01–05 dan dapat diubah melalui Setting → Kebijakan Operasional. Plafon bukan hak otomatis. Biaya di atas plafon aktif memerlukan alasan, bukti dan approval exception. Sistem tidak mengubah nilai plafon pada klaim historis ketika Setting diperbarui.

## 5. Kontrol dan larangan

- Klaim duplikat berdasarkan bukti, tanggal, vendor, nominal dan sumber perjalanan ditandai.
- Klaim tanpa bukti atau di atas plafon tidak diposting otomatis.
- Cash advance, reimbursement dan pembayaran Vendor tidak boleh membayar biaya yang sama dua kali.
- Perubahan tujuan, tanggal, nominal, rekening atau penerima setelah approval memerlukan evaluasi ulang.
- Sales/karyawan tidak boleh menyetujui klaim sendiri jika policy self-approval nonaktif.
- Finance dapat menolak baris yang bukan biaya perusahaan, meminta revisi atau mencatat pengecualian beralasan.

## 6. Laporan dan pengingat

Dashboard HR/Finance menampilkan advance yang akan jatuh settlement, settlement terlambat, klaim menunggu review/approval, klaim pada cut-off berikutnya, plafon terlampaui, dan reimbursement yang belum dibayar. Pengingat internal tidak mengirim WhatsApp/email otomatis tanpa integrasi yang disetujui.

## 7. Keputusan final dan konfigurasi wajib

- dalam kota memakai biaya aktual berbukti; tidak ada hotel/uang harian otomatis;
- hari parsial: <6 jam = 50% uang harian, ≥6 jam = 100%;
- entertainment maksimum Rp250.000 per kegiatan;
- hari kerja pengganti saat tanggal pembayaran libur;
- daftar bukti wajib per kategori;
- limit approval dan batas exception;
- aturan pajak/withholding untuk kategori tertentu.

Daftar bukti, limit approver, rekening dan tax treatment wajib dikonfigurasi sebelum klaim diposting. Perubahan plafon memakai versi baru dan tidak mengubah perjalanan historis.


---

## Bagian asal: 13-hris.md

# Waktu, Kehadiran, Cuti dan Lembur

Status: workflow Gelombang D difinalkan. Dokumen ini menjadi sumber utama kalender kerja, shift, impor fingerprint, absensi, cuti/izin, lembur dan cut-off. Nilai toleransi, kuota, pembulatan dan kompensasi adalah mandatory configuration HR bertanggal efektif; policy yang belum aktif memblok proses terkait.

## 1. Tujuan dan batas proses

Modul ini menghasilkan catatan waktu kerja yang dapat diperiksa sebelum menjadi input payroll. Catatan fingerprint adalah bukti kejadian masuk/pulang, bukan hasil kehadiran final. Sistem harus menggabungkan kalender, shift, penugasan, fingerprint, cuti/izin, perjalanan dinas, lembur dan koreksi untuk menghasilkan rekap harian serta bulanan.

Tahap awal menggunakan **impor file fingerprint**, bukan koneksi langsung ke mesin. Format file, zona waktu mesin dan kode perangkat harus dibuat sebagai profil impor setelah contoh file tersedia. Data mentah tidak boleh diubah atau dihapus setelah impor dilakukan.

## 2. Struktur kebijakan

Semua kebijakan mempunyai versi, tanggal berlaku dan status Draft/Aktif/Nonaktif. Perubahan hanya memengaruhi tanggal setelah masa berlakunya dan tidak menghitung ulang periode yang sudah dikunci tanpa proses buka cut-off.

| Kebijakan | Isi minimum |
|---|---|
| Kalender kerja | perusahaan/unit, hari kerja mingguan, hari libur nasional/perusahaan, hari kerja pengganti, zona waktu |
| Shift | jam mulai/selesai, lintas hari, waktu istirahat, toleransi masuk/pulang, minimum jam kerja, aturan hari libur |
| Kehadiran | cara memilih scan masuk/pulang, scan berlebih, lupa scan, terlambat, pulang cepat, tidak hadir dan kerja di luar kantor |
| Cuti/izin | jenis, satuan hari/setengah hari/jam, kuota, accrual, carry forward, masa berlaku, dokumen dan approval |
| Lembur | kelayakan, minimum/maksimum, pembulatan, waktu istirahat, hari kerja/libur, approval dan hubungan dengan payroll |
| Cut-off | periode, tanggal batas data, pemilik review, kondisi penguncian dan izin buka kembali |

## 3. Kalender kerja dan shift

1. Setiap karyawan memiliki kalender kerja dan shift default bertanggal efektif.
2. HR dapat membuat penugasan shift per karyawan atau kelompok untuk rentang tanggal. Penugasan khusus mengalahkan default dan menyimpan alasan.
3. Shift boleh melewati tengah malam. Tanggal kerja mengikuti tanggal mulai shift, bukan sekadar tanggal scan.
4. Perubahan shift setelah ada data kehadiran menampilkan dampak dan memerlukan alasan; periode yang sudah cut-off tidak berubah langsung.
5. Hari libur nasional, libur perusahaan dan hari kerja pengganti dicatat terpisah agar perhitungan cuti/lembur dapat ditelusuri.
6. Karyawan tanpa kalender/shift pada hari yang seharusnya dihitung masuk daftar exception, bukan otomatis dianggap hadir atau absen.

## 4. Impor fingerprint

Alur: unggah file → pilih profil mesin/format → validasi → preview → selesaikan mapping → commit → rekonsiliasi hasil.

Staging menyimpan nama dan hash file, perangkat, waktu unggah, zona waktu sumber, pengunggah, jumlah baris serta setiap baris mentah. Validasi memeriksa:

- ID fingerprint terhubung ke tepat satu karyawan pada waktu kejadian;
- timestamp valid dan dapat dikonversi ke zona waktu bisnis;
- duplikasi berdasarkan sumber/perangkat, ID eksternal, timestamp dan tipe kejadian;
- kejadian terlalu jauh dari shift atau urutan masuk/pulang yang ambigu;
- impor ulang file yang sama dan benturan dengan file lain.

Baris berstatus **Valid**, **Perlu Mapping**, **Duplikat**, **Ambigu**, atau **Ditolak**. Hanya baris valid yang membentuk event kehadiran. Memperbaiki mapping dapat memproses ulang baris staging secara terkontrol; tidak mengubah raw record. Commit menggunakan idempotency key sehingga retry tidak menggandakan scan.

## 5. Absensi harian

Mesin kalkulasi membuat satu hasil per karyawan dan tanggal kerja dengan snapshot kalender, shift serta versi kebijakan. Status minimum:

- Hadir;
- Terlambat;
- Pulang Cepat;
- Tidak Lengkap/Lupa Scan;
- Tidak Hadir;
- Cuti;
- Izin;
- Sakit;
- Dinas Luar/Perjalanan Dinas;
- Hari Libur/Libur Pengganti.

Satu hari dapat mempunyai indikator tambahan, misalnya Hadir + Terlambat atau Dinas Luar + Lembur. Status payroll tidak boleh disimpulkan hanya dari satu label UI. Sistem menyimpan jadwal, scan terpilih, scan lain, menit terlambat/pulang cepat, jam kerja terhitung, sumber pengecualian dan status review.

Perjalanan dinas yang disetujui pada dokumen 17 menjadi sumber status Dinas Luar untuk tanggal terkait. Kunjungan sales tidak otomatis menggantikan absensi; bila kebijakan perusahaan mengizinkannya sebagai bukti kerja lapangan, hubungan tersebut harus diaktifkan dalam policy HR dan tetap dapat direview.

## 6. Koreksi absensi

Karyawan atau HR berizin dapat mengajukan koreksi untuk lupa scan, waktu keliru, salah shift, tugas luar atau alasan lain yang tersedia di Setting. Pengajuan memuat tanggal, nilai sebelum/sesudah, alasan dan bukti bila diwajibkan.

Status: **Draft → Diajukan → Disetujui/Ditolak → Diterapkan**. Approval mengikuti policy terkonfigurasi. Persetujuan tidak menghapus scan asli; sistem membuat adjustment dan menghitung ulang hari terkait. Koreksi setelah cut-off memerlukan permintaan buka cut-off atau menjadi adjustment periode berikutnya sesuai kebijakan payroll.

HR tidak boleh diam-diam mengubah hasil final. Perubahan administratif tetap memerlukan alasan, izin khusus dan audit pengguna/waktu/nilai sebelum-sesudah.

## 7. Cuti, sakit dan izin

Jenis cuti/izin dikelola di Setting dan menentukan kuota, eligibility, masa kerja minimum, satuan, dokumen, approval, saldo boleh minus, carry forward dan dampak payroll. Tidak ada entitlement global yang ditebak; jenis tanpa policy aktif tidak dapat diajukan.

Saldo menggunakan ledger, bukan angka yang dapat diketik ulang. Mutasi minimum: saldo awal, accrual, carry forward, pemakaian, pembatalan, kedaluwarsa dan adjustment beralasan. Total saldo merupakan hasil penjumlahan ledger.

Alur: pilih jenis/tanggal → sistem menghitung hari kerja yang terpakai → cek benturan jadwal/cuti lain/saldo → ajukan → approval → kalender dan absensi diperbarui. Pembatalan setelah disetujui memakai permintaan pembatalan; saldo dikembalikan melalui ledger dan histori tetap ada.

Sakit/izin tanpa kuota tetap dicatat sebagai jenis terpisah dengan bukti dan dampak payroll sesuai policy. Permintaan yang belum disetujui pada cut-off masuk exception dan tidak dianggap otomatis disetujui.

## 8. Lembur

Lembur memisahkan **rencana/pengajuan** dari **realisasi**. Pengajuan berisi tanggal, waktu rencana, alasan/tugas, lokasi dan approver. Setelah kegiatan, realisasi berisi waktu aktual serta bukti bila diwajibkan. Sistem membandingkan rencana, scan dan realisasi, lalu menghitung durasi yang layak menurut versi policy.

Status: **Draft → Diajukan → Disetujui/Ditolak → Direalisasikan → Diverifikasi → Masuk Cut-off**. Tidak ada nilai lembur untuk payroll hanya karena scan pulang lebih malam. Lembur tanpa pengajuan dapat memakai exception beralasan jika policy mengizinkan. Formula nominal lembur dibahas pada payroll; modul ini menyediakan durasi terverifikasi dan klasifikasi hari kerja/libur.

## 9. Rekap bulanan dan cut-off payroll

Rekap bulanan per karyawan menampilkan hari kerja terjadwal, hadir, tidak hadir, cuti per jenis, sakit/izin, dinas luar, menit terlambat/pulang cepat, kejadian tidak lengkap, jam kerja dan lembur terverifikasi. Drill-down membuka bukti sumber.

Status periode: **Open → Review → Ready for Cut-off → Cut-off**. Cut-off ditolak jika terdapat mapping fingerprint belum selesai, hari tanpa shift yang wajib, koreksi/cuti/lembur yang masih menunggu keputusan, atau kalkulasi gagal. HR dapat menerima exception hanya dengan alasan, dampak payroll, pemilik dan rencana penyelesaian.

Saat cut-off, sistem menyimpan snapshot input dan hash per karyawan. Payroll membaca snapshot tersebut, bukan data live yang dapat berubah. Buka cut-off memerlukan izin, alasan dan audit; jika payroll sudah diposting, perubahan mengikuti adjustment payroll dan tidak menimpa hasil lama.

## 10. Navigasi dan layar

**HRIS → Waktu & Kehadiran**:

1. Kalender Kerja
2. Shift & Penugasan
3. Impor Fingerprint
4. Absensi Harian
5. Koreksi Absensi
6. Cuti & Izin
7. Lembur
8. Rekap Bulanan
9. Cut-off Payroll

Layar dibuat bersih. Ringkasan atas menampilkan periode, jumlah karyawan, exception dan status cut-off. Tabel harian memakai filter tanggal, departemen, status dan exception. Penjelasan panjang disimpan dalam panel bantuan, sedangkan alasan tertahan tampil langsung pada baris terkait.

Self-service karyawan menampilkan jadwal, absensi, saldo/mutasi cuti, pengajuan sendiri, lembur sendiri dan status keputusan. Atasan hanya melihat bawahan dalam scope. Data seluruh karyawan, ekspor dan cut-off membutuhkan izin HR khusus.

Ringkasan lintas periode dan definisi metrik kehadiran mengikuti [Dashboard dan Pelaporan ERP](09-dashboard.md); transaksi dan cut-off tetap dikelola pada modul ini.

## 11. Data dan API konseptual

Entitas utama: `work_calendars`, `calendar_days`, `shifts`, `shift_assignments`, `attendance_import_profiles`, `attendance_imports`, `attendance_import_rows`, `attendance_events`, `daily_attendance_results`, `attendance_corrections`, `leave_types`, `leave_policies`, `leave_ledger_entries`, `leave_requests`, `overtime_requests`, `overtime_realizations`, `attendance_periods`, `attendance_exceptions`, dan `attendance_cutoff_snapshots`.

Endpoint utama:

- `/work-calendars`, `/shifts`, `/shift-assignments`;
- `/attendance-import-profiles`, `/attendance-imports/{id}/validate|commit|reprocess`;
- `/attendance/daily`, `/attendance/recalculate`, `/attendance-corrections`;
- `/leave-types`, `/leave-balances`, `/leave-ledger`, `/leave-requests`;
- `/overtime-requests/{id}/submit|approve|realize|verify`;
- `/attendance-periods/{id}/validate|submit-review|cutoff|reopen`;
- `/attendance-reports/monthly`.

Perintah mutasi memakai version dan idempotency key. Kalkulasi massal dapat berjalan melalui queue, tetapi status selesai hanya diberikan setelah hasil tersimpan. API menerapkan scope self/subordinate/all serta izin granular seperti `attendance.import`, `attendance.correct.request`, `attendance.correct.approve`, `leave.approve`, `overtime.verify`, `attendance.cutoff`, dan `attendance.reopen`.

## 12. Kriteria penerimaan

1. Impor ulang file yang sama tidak menggandakan event.
2. Baris tanpa mapping tidak menghasilkan kehadiran final dan terlihat sebagai exception.
3. Shift lintas tengah malam menghasilkan tanggal kerja yang benar.
4. Scan mentah tetap tersedia setelah koreksi.
5. Cuti menggunakan ledger dan pembatalan membuat mutasi balik.
6. Lembur payroll hanya berasal dari realisasi yang diverifikasi sesuai policy.
7. Perjalanan dinas disetujui dapat membentuk status Dinas Luar tanpa entri ganda.
8. Cut-off ditolak bila blocker wajib belum selesai.
9. Snapshot cut-off dapat direkonsiliasi dengan input payroll.
10. Buka cut-off dan perubahan setelahnya memiliki alasan, approval dan audit.
11. Karyawan tidak dapat melihat absensi, cuti atau dokumen pribadi orang lain tanpa scope.
12. Perubahan policy tidak mengubah periode historis yang sudah dikunci.

## 13. Konfigurasi wajib dan release gate

Contoh file/perangkat, kalender/shift, toleransi, jenis cuti, formula lembur, approval dan dampak payroll wajib diisi HR sebelum policy Active. Kunjungan sales hanya menjadi bukti tambahan bila policy HR mengaktifkannya; bukan pengganti otomatis fingerprint. Sistem boleh dipakai untuk pilot, tetapi payroll resmi menunggu konfigurasi tersebut dan dua parallel run yang lulus.


---

## Bagian asal: 13-hris.md

# Payroll, THR, BPJS dan PPh 21

Status: spesifikasi bisnis HRIS tahap payroll. Dokumen ini menjadi sumber utama untuk struktur penggajian, input variabel, simulasi, review, approval, posting, slip, pembayaran, THR, BPJS, PPh 21, komisi dan adjustment. Tarif, formula pajak/iuran dan komponen perusahaan harus diisi melalui rule bertanggal efektif serta diverifikasi HR/Finance; aplikasi tidak menebaknya.

## 1. Prinsip kendali

Payroll menghitung hak dan kewajiban berdasarkan snapshot. Data live karyawan, absensi, cuti, lembur, komisi dan reimbursement tidak boleh berubah diam-diam setelah payroll masuk tahap review. Setiap komponen memiliki sumber, formula/rule version, periode, pembuat dan bukti.

Payroll tidak boleh dipakai sebagai pencatatan resmi untuk pembayaran sebelum **dua periode parallel run** dibandingkan dan direkonsiliasi dengan perhitungan manual yang disetujui. Seluruh nominal menggunakan presisi internal; pembulatan tampilan dan pembulatan payroll merupakan aturan terpisah.

## 2. Periode dan status payroll

Periode mengikuti kalender payroll perusahaan dan memiliki tanggal kerja, cut-off absensi, cut-off input variabel, tanggal approval dan tanggal pembayaran. Status run:

**Draft → Calculated → Review → Approved → Posted → Paid → Reconciled**

Status **Rejected**, **Cancelled** dan **Adjustment** digunakan sesuai kejadian. Run yang sudah Posted tidak diedit atau dihitung ulang untuk mengganti nilai. Koreksi memakai adjustment run yang merujuk run asal dan menjelaskan dampak bersih.

## 3. Komponen payroll

Master komponen menyimpan tipe **earning**, **deduction**, **employer liability** atau **informational**, metode pajak/iuran, akun GL, formula atau sumber input, prioritas, prorata, pembulatan, masa berlaku dan scope karyawan.

Komponen yang disiapkan untuk evaluasi:

- gaji pokok;
- tunjangan tetap dan tidak tetap;
- lembur dari realisasi terverifikasi;
- komisi sales dari accrual yang disetujui;
- reimbursement yang telah disetujui dan memang dibayarkan melalui payroll;
- potongan ketidakhadiran atau keterlambatan bila policy mengizinkan;
- pinjaman/uang muka karyawan dan potongan lainnya;
- BPJS Kesehatan dan BPJS Ketenagakerjaan: porsi karyawan dan porsi perusahaan;
- PPh 21;
- THR sebagai run/komponen khusus;
- penyesuaian manual dengan alasan dan approval.

Komponen tidak boleh dibuat hanya dengan mengubah nama. Formula, sumber dan perlakuan pajak/iuran harus tersimpan dalam versi rule.

## 4. Input payroll

Sebelum kalkulasi, sistem mengunci referensi berikut:

1. karyawan aktif dan hubungan kerja pada tanggal payroll;
2. riwayat gaji/kompensasi yang berlaku;
3. snapshot attendance cut-off dari dokumen 26;
4. cuti, sakit, izin dan lembur yang telah diputuskan;
5. komisi yang telah diakru/disetujui sesuai kebijakan;
6. reimbursement/advance yang ditandai masuk payroll;
7. profil pajak dan BPJS yang efektif;
8. adjustment yang memiliki bukti dan approval;
9. rekening pembayaran yang telah diverifikasi.

Input kurang, mapping payroll tidak lengkap, rekening tidak valid, atau dokumen masih menunggu keputusan menghasilkan exception. Sistem tidak mengisi nol secara diam-diam.

## 5. Perhitungan

Untuk setiap karyawan, engine membuat rincian komponen dengan input snapshot, rule snapshot, formula version, hasil sebelum dan sesudah pembulatan. Minimum hasil:

| Hasil | Arti |
|---|---|
| Gross earnings | total penghasilan sebelum potongan |
| Employee deductions | potongan karyawan, termasuk pajak/iuran sesuai rule |
| Employer liabilities | kewajiban perusahaan di luar net pay |
| Net pay | jumlah yang dibayarkan kepada karyawan |
| Payroll payable | kewajiban yang harus diposting/settle |
| Tax/BPJS payable | kewajiban pihak ketiga berdasarkan komponen terkait |

Prorata untuk karyawan masuk, resign, perubahan gaji atau hari kerja parsial membutuhkan basis yang dikonfigurasi, misalnya hari kalender atau hari kerja. Sistem menampilkan basis yang dipakai dan tidak mencampur dua basis dalam satu komponen tanpa rule. Final pay dan settlement karyawan keluar mengikuti [Resign, Offboarding, Final Pay dan Pengembalian Aset](13-hris.md).

Absensi dan lembur hanya memengaruhi payroll setelah statusnya final/terverifikasi. Scan pulang lebih malam tidak otomatis menjadi lembur. Komisi dan reimbursement tetap memiliki sumber transaksi sendiri agar tidak dihitung dua kali.

## 6. THR, BPJS dan PPh 21

THR diproses sebagai jenis payroll/run khusus dengan tanggal acuan, daftar penerima, masa kerja, dasar perhitungan, pajak dan approval. Tidak ada asumsi bahwa THR selalu sama dengan satu kali gaji.

BPJS Kesehatan dan setiap program BPJS Ketenagakerjaan disimpan terpisah, dengan status peserta, dasar upah, porsi karyawan, porsi perusahaan, batas/aturan dan masa berlaku. Perubahan kepesertaan berlaku mulai tanggal efektif dan tidak mengubah run posted.

PPh 21 disimpan berdasarkan profil pajak, status PTKP/metode, penghasilan dan potongan yang relevan pada periode. Data yang dipakai, hasil kalkulasi, rule version dan exception harus dapat diekspor untuk pemeriksaan. Payroll menghitung PPh 21; kewajiban, dokumen dan rekonsiliasi pajaknya mengikuti [Pajak dan Kepatuhan Pajak](12-finance-administration.md). Dokumen 38 hanya mengaktifkan XML faktur pajak keluaran dan tidak mencakup ekspor Coretax PPh 21.

## 7. Review dan approval

Layar review menampilkan total run, perubahan dari periode sebelumnya, karyawan baru/resign, exception, komponen terbesar, nilai nol yang tidak biasa dan perbandingan manual. Reviewer dapat membuka rincian per karyawan dan per komponen, tetapi tidak dapat mengubah snapshot secara langsung.

Approval menyimpan pengguna, waktu, versi rule, komentar, bukti dan hash input. Pemisahan tugas dapat dikonfigurasi: pembuat run, reviewer dan approver tidak harus selalu orang berbeda, tetapi hak tersebut ditentukan pada Setting dan diaudit.

## 8. Posting, slip dan pembayaran

Saat Approved, payroll dapat diposting ke Finance secara atomik:

- debit beban gaji, tunjangan, lembur, THR, komisi dan BPJS perusahaan sesuai mapping;
- kredit utang gaji, utang pajak, utang BPJS dan kewajiban lain;
- reimbursement hanya diposting ke payroll bila ditandai sebagai komponen payroll.

Pembayaran dilakukan melalui Kas & Bank berdasarkan payroll payable. Satu run dapat dibayar dalam beberapa batch; alokasi tidak boleh melebihi saldo. Status Paid hanya setelah transaksi pembayaran terverifikasi dan diposting.

Slip gaji dibuat dari snapshot run, memiliki akses privat per karyawan, hash file dan tanggal publikasi. HR berizin dapat menerbitkan ulang salinan tanpa mengubah nominal; karyawan hanya melihat slip miliknya.

## 9. Adjustment dan reversal

Kesalahan setelah posting memakai adjustment run atau reversal sesuai jenis kesalahan. Dokumen mencantumkan run asal, karyawan/komponen terdampak, alasan, periode koreksi, perbedaan gross/net/kewajiban, approval dan dampak pembayaran. Tidak boleh mengedit atau menghapus slip dan jurnal historis.

Jika pembayaran gagal, status pembayaran menjadi Failed dan dapat dijadwalkan ulang dengan idempotency key. Jangan membuat payroll run baru hanya karena transfer bank gagal.

## 10. Navigasi dan layar

**HRIS → Payroll**:

1. Kalender Payroll & Cut-off
2. Komponen dan Aturan Payroll
3. Input Variabel
4. Payroll Run
5. Review & Approval
6. THR
7. BPJS
8. PPh 21
9. Slip Gaji
10. Pembayaran & Rekonsiliasi
11. Adjustment dan Riwayat

Dashboard payroll menampilkan periode aktif, status run, jumlah exception, total gross/net, kewajiban pihak ketiga, pembayaran tertunda dan perbandingan periode lalu. Desain tetap ringkas; rincian formula dibuka melalui panel detail.

Ringkasan lintas periode, antrean dan laporan payroll mengikuti [Dashboard dan Pelaporan ERP](09-dashboard.md) dengan pembatasan field yang sama.

## 11. Entitas dan API konseptual

Entitas: `payroll_calendars`, `payroll_components`, `payroll_rules`, `payroll_input_snapshots`, `payroll_runs`, `payroll_items`, `payroll_item_components`, `payroll_exceptions`, `thr_runs`, `employee_tax_profiles`, `employee_benefits`, `payslips`, `payroll_payment_links`, `payroll_adjustments` dan `payroll_reconciliations`.

Endpoint:

- `/payroll-calendars`, `/payroll-components`, `/payroll-rules`;
- `/payroll-inputs/preview`, `/payroll-inputs/lock`;
- `/payroll-runs`, `/payroll-runs/{id}/calculate`, `/review`, `/approve`, `/post`;
- `/thr-runs`, `/bpjs-profiles`, `/tax-profiles`, `/payslips`;
- `/payroll-runs/{id}/payment-batches`, `/payroll-reconciliations`;
- `/payroll-runs/{id}/adjustments` dan `/payroll-adjustments/{id}/approve|post`.

Command memakai version dan idempotency key. Kalkulasi draft boleh melalui BullMQ, tetapi hasil dan status disimpan di PostgreSQL. API tidak mengirim data payroll ke pengguna tanpa scope `payroll.self`, `payroll.hr` atau izin Finance yang sesuai.

## 12. Kriteria penerimaan

1. Payroll membaca snapshot absensi yang sudah cut-off, bukan data live.
2. Setiap nilai payroll dapat ditelusuri ke karyawan, komponen, input snapshot dan rule version.
3. Run dengan exception wajib tidak dapat di-approve tanpa keputusan beralasan.
4. Perubahan rule efektif tidak mengubah run historis.
5. Retry kalkulasi/posting/pembayaran tidak menggandakan jurnal atau pembayaran.
6. Run posted tidak dapat diedit; koreksi memakai adjustment.
7. Slip hanya dapat diakses karyawan yang bersangkutan atau pengguna berizin.
8. Total payroll payable cocok dengan jurnal kontrol dan saldo pembayaran.
9. THR, BPJS dan PPh 21 dapat dipisahkan per komponen dan periode.
10. Dua parallel run dan rekonsiliasi manual tersimpan sebagai bukti sebelum payroll resmi digunakan.

## 13. Konfigurasi wajib

- periode dan tanggal cut-off/pay date payroll;
- daftar komponen gaji/tunjangan/potongan dan formula prorata;
- perlakuan keterlambatan, ketidakhadiran, izin dan lembur;
- formula serta tanggal pembayaran komisi sales;
- dasar dan formula THR;
- parameter BPJS dan PPh 21 yang berlaku;
- rekening pembayaran dan approval payroll;
- apakah reimbursement tertentu dibayar melalui payroll atau Kas & Bank langsung.

Daftar tersebut bukan keputusan arsitektur terbuka: semuanya wajib diisi sebagai policy bertanggal efektif. Run resmi ditahan bila salah satu mapping, rekening, formula, approval atau bukti parallel run belum lengkap.


---

## Bagian asal: 13-hris.md

# Rekrutmen dan Onboarding

Status: workflow Gelombang D difinalkan untuk perencanaan tenaga, seleksi, offer, kontrak dan onboarding. Kanal, tes, dokumen dan matriks persetujuan tetap mandatory configuration; kandidat tidak menjadi karyawan sebelum konversi berizin. Retensi kandidat default dua tahun sejak aktivitas/consent terakhir, lalu anonymize/delete kecuali legal hold.

## 1. Tujuan dan prinsip

Modul membantu perusahaan mengetahui posisi yang dibutuhkan, alasan kebutuhan, biaya, kandidat yang sedang diproses, keputusan seleksi, serta kesiapan karyawan pada hari mulai kerja. Rekrutmen terhubung dengan struktur organisasi, anggaran, kontrak, akun ERP, absensi, payroll dan aset tanpa mencatat data yang sama berulang kali.

Prinsip utama:

- setiap lowongan harus berasal dari kebutuhan tenaga yang disetujui atau exception beralasan;
- satu kandidat dapat melamar beberapa lowongan tanpa membuat identitas duplikat;
- keputusan setiap tahap menyimpan penilai, waktu, hasil dan catatan;
- kandidat belum menjadi karyawan dan tidak mendapat akses ERP operasional;
- data pribadi kandidat dibatasi berdasarkan scope, tujuan dan masa retensi;
- perubahan offer, tanggal mulai, jabatan atau kompensasi setelah approval memicu review ulang sesuai kebijakan.

## 2. Permintaan tenaga kerja

Pemohon membuat kebutuhan tenaga dengan field minimum:

| Kelompok | Field |
|---|---|
| Posisi | jabatan, departemen, atasan, lokasi, jumlah orang |
| Alasan | posisi baru/pengganti/sementara, karyawan yang diganti bila relevan, urgensi |
| Hubungan kerja | tetap/kontrak/magang/jenis lain, durasi usulan, tanggal kebutuhan |
| Kualifikasi | pendidikan, pengalaman, kompetensi, sertifikasi, kebutuhan khusus pekerjaan |
| Biaya | rentang kompensasi, sumber anggaran, estimasi biaya rekrutmen/peralatan |
| Persetujuan | pemohon, reviewer HR, approver, catatan dan lampiran |

Status: **Draft → Diajukan → Review HR → Disetujui/Ditolak/Revisi → Dibuka → Terpenuhi/Ditutup/Dibatalkan**. Persetujuan kebutuhan tidak otomatis menyetujui kandidat atau nilai offer. Jumlah penerimaan tidak boleh melebihi headcount yang disetujui tanpa revisi kebutuhan.

Budget check membaca anggaran HR terkait bila modul anggaran aktif. Kebutuhan yang belum memiliki budget dapat ditahan atau diajukan sebagai exception sesuai policy, bukan disembunyikan dengan nominal nol.

## 3. Lowongan

Satu permintaan tenaga dapat menghasilkan satu atau beberapa lowongan menurut lokasi/jenis hubungan kerja. Lowongan menyimpan kode, judul publik/internal, deskripsi kerja, kualifikasi, jumlah, tanggal buka/tutup, PIC recruiter, kanal, status dan tautan permintaan tenaga.

Status lowongan: **Draft → Aktif → Dijeda → Ditutup → Terpenuhi/Dibatalkan**. Penutupan tidak menghapus kandidat. Integrasi job portal/email belum termasuk; sumber kandidat dicatat manual atau melalui impor yang tervalidasi.

## 4. Master kandidat dan lamaran

Identitas kandidat dipisahkan dari lamaran. Data kandidat minimum:

- kode kandidat;
- nama lengkap dan nama panggilan;
- nomor HP/WA dan email;
- domisili/alamat;
- pendidikan dan pengalaman ringkas;
- kompetensi/sertifikasi;
- CV dan dokumen pendukung;
- sumber kandidat/referral;
- ekspektasi kompensasi dan ketersediaan mulai;
- persetujuan pemrosesan data dan tanggalnya;
- status kandidat dan catatan terbatas.

NIK, NPWP, rekening, data keluarga dan dokumen sensitif lain hanya diminta ketika diperlukan dan dilindungi sebagai data privat. Sistem mencari kandidat duplikat berdasarkan kontak/identitas yang tersedia, tetapi penggabungan memerlukan keputusan pengguna berizin.

Satu kandidat dapat memiliki beberapa `applications`. Setiap lamaran menunjuk lowongan, tahap, pemilik, tanggal masuk, hasil dan alasan penolakan/pengunduran. Riwayat pada lowongan lama tidak berubah saat kandidat melamar posisi lain.

## 5. Pipeline seleksi

Tahapan awal yang dapat dikonfigurasi:

1. Lamaran Masuk
2. Screening HR
3. Tes/Assessment
4. Interview HR
5. Interview User/Atasan
6. Reference/Background Check bila diterapkan
7. Final Review
8. Offer
9. Hired
10. Rejected/Withdrawn

Perusahaan dapat mengubah urutan dan tahap melalui Setting dengan masa berlaku. Pemindahan tahap memerlukan hasil minimum sesuai konfigurasi. Interview menyimpan jadwal, media/lokasi, interviewer, rubric/kriteria, skor bila digunakan, catatan, rekomendasi dan keputusan. Skor membantu review tetapi tidak otomatis menerima/menolak kandidat tanpa policy eksplisit.

Alasan Rejected dan Withdrawn diambil dari daftar Setting serta dapat memiliki catatan privat. Kandidat dapat dipindahkan ke talent pool dengan persetujuan retensi; ini bukan status pegawai.

## 6. Offer dan kontrak

Offer dibuat dari kandidat final dan kebutuhan yang masih tersedia. Field minimum:

- posisi, departemen, atasan dan lokasi;
- jenis hubungan kerja dan durasi;
- tanggal mulai yang diusulkan;
- komponen kompensasi dan benefit yang diizinkan;
- masa percobaan bila berlaku;
- masa berlaku offer;
- syarat sebelum mulai bekerja;
- template, versi, approver dan lampiran.

Status: **Draft → Review → Disetujui → Dikirim → Diterima/Ditolak/Kedaluwarsa/Ditarik**. Diterima harus menyimpan tanggal dan bukti penerimaan. Offer yang diterima belum otomatis membuat karyawan aktif; HR menyelesaikan verifikasi dokumen dan tindakan konversi.

Kontrak kerja dibuat dari offer yang diterima atau melalui exception terotorisasi. Nomor kontrak, periode, jenis, jabatan, kompensasi, pihak penandatangan dan file final disimpan. Perubahan kontrak memakai versi/addendum dan tidak menimpa dokumen lama.

## 7. Konversi kandidat menjadi karyawan

HR menjalankan **Buat Karyawan** setelah offer diterima dan dokumen minimum dinyatakan lengkap. Sistem:

1. memeriksa kandidat/pegawai duplikat;
2. membuat satu employee ID/kode karyawan;
3. menyalin data yang disetujui dan relevan;
4. menautkan offer, kontrak, lamaran dan sumber rekrutmen;
5. membuat draft penempatan, kompensasi, pajak/BPJS/rekening bila tersedia;
6. membuat onboarding case dan checklist;
7. mempertahankan candidate ID untuk histori.

Retry tidak boleh menciptakan dua karyawan. Data kandidat yang tidak relevan dengan hubungan kerja tidak otomatis disalin. Status Hired tanpa konversi terlihat sebagai exception.

## 8. Onboarding

Onboarding case memiliki tanggal mulai, pemilik HR, atasan, lokasi, status dan template checklist berdasarkan jabatan/jenis karyawan. Checklist dapat mencakup:

- verifikasi identitas dan dokumen hubungan kerja;
- penandatanganan kontrak/kebijakan perusahaan;
- pembuatan akun ERP dan pemberian role/scope melalui Setting;
- penetapan kalender kerja, shift dan ID fingerprint;
- konfigurasi payroll, rekening, pajak dan BPJS;
- permintaan/serah terima laptop, HP, kendaraan, identitas, seragam atau aset lain;
- orientasi perusahaan, SOP, keselamatan dan pelatihan produk;
- penunjukan atasan/mentor serta target awal;
- evaluasi hari pertama, periode awal atau masa percobaan bila digunakan.

Status task: **Belum Mulai → Berjalan → Selesai/Tidak Berlaku/Blocked**. Setiap task mempunyai owner, due date, dependensi, bukti dan alasan bila tidak berlaku. Checklist selesai tidak otomatis memberikan hak akses; akun dan role dibuat melalui IAM dengan approval/scope yang sesuai.

Karyawan baru boleh berstatus **Pra-Mulai**, **Aktif**, **Ditunda**, atau **Batal Bergabung** sesuai proses. Aktivasi pada tanggal mulai memerlukan kontrak/penempatan minimum dan blocker kritis selesai. Kandidat batal bergabung setelah menerima offer tidak dihapus; lowongan/headcount dapat dibuka kembali.

## 9. Navigasi dan layar

**HRIS → Rekrutmen**:

1. Permintaan Tenaga
2. Lowongan
3. Kandidat
4. Pipeline Seleksi
5. Interview & Assessment
6. Offer
7. Talent Pool
8. Laporan Rekrutmen

**HRIS → Onboarding**:

1. Karyawan Akan Bergabung
2. Checklist Onboarding
3. Dokumen & Kontrak
4. Akun & Hak Akses
5. Absensi & Payroll Setup
6. Aset & Perlengkapan
7. Orientasi & Pelatihan
8. Onboarding Selesai/Exception

Dashboard menampilkan kebutuhan menunggu persetujuan, lowongan aktif, kandidat per tahap, interview mendatang, offer akan kedaluwarsa, karyawan akan bergabung dan task onboarding terlambat. Tampilan tidak menampilkan kompensasi atau dokumen privat kepada pengguna tanpa izin.

Definisi indikator, time to fill dan laporan lintas periode mengikuti [Dashboard dan Pelaporan ERP](09-dashboard.md).

## 10. Database dan API konseptual

Entitas utama: `hiring_requests`, `hiring_request_positions`, `job_openings`, `candidates`, `candidate_consents`, `candidate_documents`, `applications`, `recruitment_stage_definitions`, `application_stage_events`, `interviews`, `interview_evaluations`, `offers`, `offer_versions`, `talent_pool_entries`, `candidate_employee_links`, `onboarding_templates`, `onboarding_cases`, `onboarding_tasks` dan `onboarding_task_evidence`.

Endpoint:

- `/hiring-requests/{id}/submit|approve|reject|revise|open`;
- `/job-openings/{id}/activate|pause|close`;
- `/candidates`, `/candidates/{id}/applications`, `/candidate-duplicates`;
- `/applications/{id}/move-stage|reject|withdraw`;
- `/interviews`, `/interviews/{id}/evaluations`;
- `/offers/{id}/submit-review|approve|send|accept|decline|withdraw`;
- `/candidates/{id}/convert-to-employee`;
- `/onboarding-cases`, `/onboarding-tasks/{id}/start|complete|block|waive`.

Semua command memakai version dan idempotency key. API menerapkan scope recruiter, interviewer, hiring manager, HR, approver dan employee self. Interviewer hanya menerima data kandidat yang diperlukan. Lampiran kandidat dan offer memakai URL privat bertanda waktu serta audit akses.

## 11. Metrik dan laporan

- kebutuhan tenaga menurut status/departemen;
- lowongan aktif dan umur lowongan;
- jumlah kandidat per tahap;
- time to screen, interview, offer dan fill;
- sumber kandidat dan hasil akhirnya;
- acceptance/decline/withdraw rate;
- posisi dan biaya terhadap anggaran;
- onboarding completion dan task terlambat;
- kandidat Hired belum dikonversi atau karyawan aktif dengan setup belum lengkap.

Metrik tidak boleh memperlihatkan catatan privat atau kompensasi kepada pengguna tanpa izin.

## 12. Kriteria penerimaan

1. Lowongan menunjuk kebutuhan tenaga yang disetujui atau exception beralasan.
2. Penerimaan tidak melebihi headcount yang disetujui tanpa revisi.
3. Kandidat tidak otomatis menjadi karyawan ketika tahap berubah menjadi Hired.
4. Konversi kandidat idempoten dan mempertahankan hubungan histori.
5. Perubahan offer setelah approval memicu review ulang sesuai policy.
6. Kontrak/addendum historis tidak ditimpa.
7. Onboarding membuat task berdasarkan template jabatan/jenis hubungan kerja.
8. Role ERP tidak berasal otomatis dari jabatan tanpa konfigurasi IAM.
9. Data privat kandidat tidak tersedia melalui daftar, pencarian, ekspor atau attachment tanpa izin.
10. Karyawan tidak diaktifkan jika blocker onboarding kritis belum selesai.

## 13. Konfigurasi wajib

- pihak dan batas persetujuan kebutuhan tenaga/offer;
- jenis hubungan kerja serta dokumen wajib;
- pipeline, rubric dan metode tes/interview;
- rentang kompensasi dan budget owner;
- kebijakan reference/background check;
- template offer, kontrak, onboarding dan masa percobaan;
- pengecualian retensi kandidat dari default dua tahun dan persetujuan pemrosesan data;
- task onboarding kritis sebelum status Aktif.

Policy tidak dapat Active sebelum approver, scope, limit/budget, dokumen, rubric dan task kritis yang relevan terisi.


---

## Bagian asal: 13-hris.md

# Resign, Offboarding, Final Pay dan Pengembalian Aset

Status: spesifikasi bisnis HRIS untuk proses keluar karyawan. Dokumen ini menjadi sumber utama pengajuan resign, persetujuan, masa pemberitahuan, serah terima pekerjaan/aset, penyelesaian advance dan reimbursement, final pay, pencabutan akses, serta arsip. Penyelesaian final pay tidak otomatis ditahan hanya karena aset belum kembali; perlakuan potongan/penahanan harus mengikuti kebijakan perusahaan dan tinjauan hukum/HR.

## 1. Prinsip

- riwayat karyawan, kontrak, payroll, aset, akses dan dokumen tidak dihapus;
- tanggal efektif keluar berbeda dari tanggal pengajuan dan tanggal persetujuan;
- alasan dan jenis pemisahan dicatat terpisah dari status aktif/nonaktif;
- akses operasional dinonaktifkan berdasarkan tanggal/waktu efektif dan tingkat risiko;
- aset dikembalikan melalui transaksi assignment yang sama, bukan membuat saldo aset baru;
- final pay mengambil snapshot payroll, cuti, komisi, advance, reimbursement dan kewajiban yang telah diputuskan;
- sengketa atau aset hilang menjadi exception yang terlihat dan memiliki pemilik.

## 2. Pengajuan dan persetujuan

Pengajuan dapat dibuat oleh karyawan, atasan atau HR sesuai izin. Field minimum:

- karyawan, departemen, atasan dan lokasi;
- jenis: resign sukarela, berakhir kontrak, pemutusan hubungan kerja, meninggal dunia, tidak melanjutkan masa percobaan atau kategori lain;
- tanggal pengajuan, tanggal efektif yang diminta, hari terakhir bekerja dan masa pemberitahuan;
- alasan/kategori alasan, catatan dan dokumen;
- rencana serah terima pekerjaan dan pengganti;
- kebutuhan pembatasan akses lebih awal bila ada risiko.

Status: **Draft → Diajukan → Review HR/Atasan → Disetujui/Ditolak/Revisi → Berjalan → Selesai/Cancelled**. Approval menyimpan pengguna, waktu, alasan, versi policy dan bukti. Perubahan tanggal efektif setelah approval memicu perhitungan ulang checklist dan final pay.

Perusahaan dapat mengizinkan pengajuan tanpa masa pemberitahuan, tetapi harus menyimpan exception dan approver. Sistem tidak menebak konsekuensi hukum atau potongan gaji.

## 3. Rencana transisi pekerjaan

Setiap offboarding case dapat membuat task transisi: daftar pelanggan/proyek, transaksi terbuka, dokumen, kontak pengganti, pekerjaan berulang, password/akses yang harus dipindahkan melalui prosedur aman, serta serah terima ke pemilik baru. Password tidak disimpan di ERP.

Task memuat owner, due date, status, bukti dan catatan. Status case tidak dapat Selesai bila task kritis belum selesai atau telah diberi exception beralasan oleh pihak berwenang.

## 4. Pengembalian aset dan barang operasional

HR membuka daftar assignment aktif dari register aset/penyerahan barang operasional:

- nomor aset atau kode item;
- nama, serial number, aksesori dan kondisi saat diserahkan;
- lokasi/kustodian;
- bukti serah terima awal;
- kondisi saat pengembalian, foto, tanggal dan pemeriksa;
- status: dikembalikan, rusak, hilang, dipindahkan, belum ditemukan atau tidak berlaku.

Proses: inventarisasi → jadwalkan pemeriksaan → karyawan menyerahkan → pemeriksa mencocokkan unit/serial/aksesori → catat kondisi → terima atau buat exception → tutup assignment atau buat mutasi resmi. Pengembalian tidak menghapus histori assignment. Barang operasional yang dikelola HR mengikuti stok/penyerahan internal dan tidak otomatis menjadi aset tetap.

Kerusakan atau kehilangan memerlukan investigasi, bukti dan keputusan terpisah. Nilai buku, impairment, disposal, write-off dan jurnal dikelola Finance sesuai [Aset Tetap dan Penyusutan](12-finance-administration.md). HR tidak boleh mengubah nilai aset untuk menutup checklist.

## 5. Akses dan keamanan

Case membuat rencana penonaktifan:

1. akun ERP, sesi aktif dan refresh token;
2. akses email/penyimpanan atau sistem lain bila dicatat sebagai checklist eksternal;
3. role dan scope khusus, termasuk akses harga modal, payroll, pembayaran dan data pelanggan;
4. perangkat yang ditugaskan serta bukti pengembalian;
5. kepemilikan tugas dan notifikasi internal.

Penonaktifan akun ERP dilakukan otomatis pada waktu efektif yang disetujui atau secara manual lebih awal bila ada instruksi berizin. Sistem harus mencabut sesi aktif dan menyimpan audit; tidak menghapus user, dokumen, approval atau jejak aktivitas. Pengguna yang sama tidak boleh menyetujui penonaktifan dirinya sendiri bila policy melarang.

## 6. Cuti, absensi dan payroll akhir

HR mengunci snapshot:

- hari kerja sampai hari terakhir;
- absensi, cuti, sakit, izin, dinas luar dan lembur yang telah diverifikasi;
- saldo cuti dan kebijakan pembayaran/pengembalian saldo bila berlaku;
- perubahan gaji/komponen efektif;
- komisi yang telah memenuhi basis payout;
- reimbursement dan employee advance;
- pinjaman/potongan yang memiliki dasar dan approval;
- pajak, BPJS, rekening dan dokumen pembayaran.

Final pay dapat diproses sebagai bagian payroll reguler atau final payroll run terpisah. Formula prorata, kompensasi cuti, pesangon, potongan, pajak dan tanggal bayar harus berasal dari rule version yang aktif dan keputusan HR/Finance. Sistem menampilkan gross, deduction, employer liability, net, utang/advance, adjustment dan sumber setiap nilai.

Final pay yang menunggu keputusan tidak boleh dianggap lunas. Jika terdapat sengketa, payroll dapat berstatus **Menunggu Penyelesaian** dengan nilai yang tidak disembunyikan. Adjustment setelah posted mengikuti dokumen payroll 27.

## 7. Advance, reimbursement dan utang karyawan

Finance/HR meninjau kasbon, employee advance, reimbursement, pinjaman dan klaim terbuka. Setiap saldo memiliki status **Akan Diselesaikan**, **Dibayar Kembali**, **Dipoton dari Payroll**, **Disengketakan**, atau **Dihapuskan dengan Approval**.

Pemotongan final pay hanya dilakukan bila ada dasar kebijakan, bukti dan approval yang diperlukan. Jika pembayaran kembali dilakukan melalui Kas & Bank, settlement dicatat sebagai transaksi terpisah dan tidak membuat beban kedua. Saldo yang belum diselesaikan menjadi blocker atau exception sesuai policy, bukan dihapus saat menutup case.

## 8. Exit interview dan arsip

Exit interview bersifat opsional dan aksesnya dibatasi HR. Field dapat mencakup alasan keluar, pengalaman, rekomendasi, risiko retensi dan kesediaan dihubungi kembali. Jawaban privat tidak tampil pada dashboard manajer tanpa izin.

Setelah seluruh task selesai atau exception diterima:

- status employee menjadi Resigned/Ended sesuai jenis;
- tanggal efektif dan alasan tersimpan;
- kontrak ditutup dengan histori;
- akses dinonaktifkan;
- aset/assignment ditutup atau exception ditautkan;
- final pay dan settlement memiliki status;
- dokumen dipindahkan ke arsip dengan retensi dan akses yang ditetapkan.

Arsip tetap dapat dicari oleh HR/Finance berizin untuk audit, payroll, pajak, sengketa atau laporan historis. Data tidak dimusnahkan hanya karena user nonaktif.

## 9. Navigasi dan layar

**HRIS → Resign & Offboarding**:

1. Pengajuan Resign
2. Persetujuan
3. Case Berjalan
4. Serah Terima Pekerjaan
5. Pengembalian Aset & Barang
6. Penonaktifan Akses
7. Final Pay & Settlement
8. Exit Interview
9. Arsip dan Riwayat

Dashboard menampilkan pengajuan baru, hari terakhir mendatang, task terlambat, aset belum kembali, advance/reimbursement terbuka, final pay menunggu review dan akses yang belum dicabut. Nominal gaji, rekening, alasan privat dan dokumen sensitif mengikuti scope.

Ringkasan dan laporan offboarding lintas periode mengikuti [Dashboard dan Pelaporan ERP](09-dashboard.md); catatan exit interview tetap privat.

## 10. Database dan API konseptual

Entitas utama: `separation_requests`, `separation_approvals`, `offboarding_cases`, `offboarding_tasks`, `work_handover_items`, `asset_return_inspections`, `operational_item_returns`, `access_revocation_tasks`, `final_pay_inputs`, `final_pay_runs`, `separation_settlements`, `exit_interviews` dan `employee_archives`.

Endpoint:

- `/separation-requests/{id}/submit|approve|reject|revise|cancel`;
- `/offboarding-cases`, `/offboarding-cases/{id}/tasks`;
- `/work-handover-items`, `/asset-return-inspections`, `/operational-item-returns`;
- `/access-revocation-tasks/{id}/complete|force-revoke`;
- `/final-pay-inputs/{id}/lock`, `/final-pay-runs`, `/final-pay-runs/{id}/calculate|review|approve|post`;
- `/separation-settlements`, `/exit-interviews`, `/employee-archives`.

Command memakai version dan idempotency key. `force-revoke` memerlukan izin tinggi, alasan dan audit. Konversi status employee, penutupan assignment dan final pay tidak boleh dijalankan dua kali bila request diulang.

## 11. Kriteria penerimaan

1. Pengajuan menyimpan tanggal efektif, jenis, approval dan histori perubahan.
2. Case offboarding otomatis menampilkan aset/assignment aktif dan task berbasis template.
3. Pengembalian aset mencatat serial, kondisi, aksesori, foto, pemeriksa dan histori tanpa menggandakan aset.
4. Aset hilang/rusak menjadi exception; nilai aset dan jurnal hanya diubah Finance.
5. Akses ERP dan sesi aktif dicabut pada waktu yang ditetapkan serta diaudit.
6. Final pay membaca snapshot absensi, cuti, lembur, komisi, reimbursement dan advance.
7. Potongan final pay memerlukan dasar, bukti dan approval; tidak otomatis karena checklist aset belum selesai.
8. Final pay posted memakai adjustment untuk koreksi.
9. Case tidak dapat selesai bila blocker kritis belum selesai atau belum diberi exception beralasan.
10. Arsip dapat ditelusuri oleh HR/Finance berizin tanpa mengaktifkan kembali akses operasional.

## 12. Konfigurasi wajib

- jenis pemisahan dan approval masing-masing;
- masa pemberitahuan dan aturan perubahan tanggal;
- task transisi yang wajib per jabatan;
- daftar aset/barang yang wajib dikembalikan;
- aturan kondisi rusak/hilang dan tanggung jawab;
- waktu pencabutan akses normal dan force revoke;
- formula final pay, kompensasi cuti, pesangon, potongan dan pajak;
- perlakuan advance/reimbursement terbuka;
- retensi arsip karyawan default 10 tahun setelah tanggal efektif keluar; exit interview dan hak akses historis tetap field-level restricted. Perpanjangan hanya melalui legal hold/policy.


---

## Bagian asal: 13-hris.md

# Master Karyawan, Struktur Organisasi dan Kontrak

Status: sumber domain HRIS untuk identitas kerja, organisasi, penempatan, hubungan kerja, kontrak dan kompensasi efektif. Payroll, kehadiran, rekrutmen dan offboarding menggunakan master ini tanpa menyalin histori.

## 1. Struktur organisasi

`departments`, `positions`, `locations`, `reporting_lines` dan `employment_types` menyimpan struktur berversi. Atasan, departemen, jabatan dan lokasi memiliki effective_from/effective_to. Jabatan tidak otomatis memberi role ERP.

## 2. Master karyawan

Field minimum saat pembuatan: Kode Karyawan, Nama, Tanggal Bergabung, Jenis Hubungan Kerja dan Status. Field lain dikelompokkan:

- identitas dan kontak/alamat;
- keluarga dan kontak darurat;
- departemen, jabatan, atasan, lokasi dan rayon;
- tanggal bergabung, status, employee number dan ID fingerprint;
- rekening pembayaran, profil pajak, BPJS dan pengaturan payroll;
- dokumen privat dan consent;
- akun ERP tertaut;
- aset dari assignment, bukan input ulang.

NIK KTP berbeda dari kode karyawan dan ID fingerprint. Data privat field-level restricted. Resign mengakhiri status tanpa menghapus histori.

## 3. Kontrak dan kompensasi

`employment_contracts`, `contract_versions`, `employee_compensation_versions` dan `employee_benefits` menyimpan jenis hubungan, nomor, tanggal, probation, jabatan, penempatan, gaji, tunjangan, benefit, file dan approver. Perubahan membuat versi/addendum; tidak mengedit histori.

Kontrak status Draft, Review, Active, Expired, Terminated dan Superseded. Kompensasi memiliki effective date dan menjadi input payroll hanya bila aktif pada periode terkait.

## 4. API dan akses

`/departments`, `/positions`, `/employment-types`, `/employees`, `/employees/{id}/employment-history`, `/employment-contracts`, `/compensation-versions`, `/employee-tax-profiles`, `/employee-benefits` dan `/employee-account-links`.

HR mengelola seluruh data sesuai izin; karyawan melihat self; atasan melihat scope bawahan; Payroll/Finance menerima field yang diperlukan; admin sistem tidak otomatis melihat gaji atau identitas privat.

## 5. Kriteria penerimaan

1. Karyawan dapat memiliki beberapa versi jabatan, penempatan, kontrak dan kompensasi.
2. Tidak ada histori yang ditimpa oleh perubahan master.
3. Kode karyawan, NIK dan ID fingerprint tidak tercampur.
4. Kontrak expired menghasilkan pengingat/laporan, bukan perubahan diam-diam.
5. Aset karyawan dibaca dari assignment yang sama.
6. Role ERP hanya berasal dari IAM.

## 6. Konfigurasi wajib

Jenis hubungan kerja, field wajib per tipe, aturan nomor kontrak, masa probation, struktur departemen dan akses arsip data privat wajib diisi melalui policy. Kode karyawan memakai sequence `EMP-000001`; arsip karyawan default 10 tahun setelah keluar dan dapat diperpanjang hanya melalui legal hold/policy.
