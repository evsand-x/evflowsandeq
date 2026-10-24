# Kebijakan Operasional dan Konfigurasi UI

## Keputusan 24 Oktober 2026 — konsolidasi

Mengikuti [desain konsolidasi](../superpowers/specs/2026-10-24-konsolidasi-pengaturan-design.md): Kebijakan Operasional menjadi Kebijakan Umum di Setting. Termin, ongkir dan kredit dikelola di Setting › Termin & Kredit; `OPS-COMP-01..03` digantikan data perusahaan; `OPS-FLX-05` menjadi pola awal untuk jenis dokumen baru.


Status: keputusan final. Dokumen ini menjadi sumber utama parameter bisnis lintas modul yang dapat diubah melalui **Setting → Kebijakan Operasional**. Nilai pada dokumen 39 dan dokumen domain menjadi nilai awal, bukan angka yang ditanam permanen dalam kode.

## Nilai bawaan baru — keputusan 24 Oktober 2026

Nilai berikut dibuat otomatis saat perusahaan disiapkan (CFG-08) dan dapat diedit melalui Setting. Nilai disimpan sebagai data konfigurasi, bukan konstanta kode.

| Kode | Parameter | Nilai awal | Pilihan |
|---|---|---|---|
| OPS-FLX-01 | Mode pemeriksaan limit kredit | Peringatan | Nonaktif, Peringatan, Blokir |
| OPS-FLX-02 | Kebijakan COD awal pelanggan baru | Nonaktif (durasi 3 bulan bila dinyalakan) | Aktif/nonaktif, durasi, mode COD atau Bayar sebelum kirim |
| OPS-FLX-03 | Daftar termin | Tunai/COD, Bayar sebelum kirim, Tempo 7/14/30/45/60 hari | Tambah, ubah, nonaktifkan; termin bebas boleh diketik pada SO |
| OPS-FLX-04 | Ongkos kirim bawaan pada SO | Dibebankan ke pelanggan, Sebelum PPN | Ditanggung perusahaan; Dibebankan ke pelanggan Sebelum/Sesudah PPN; akun per pilihan |
| OPS-FLX-05 | Penomoran dokumen | Satu aturan aktif per jenis dokumen, prefix jenis + tahun + urutan | Pola prefix/tahun/bulan/urutan dan reset periode (IAM-06) |
| OPS-FLX-06 | Format angka | Rupiah, pemisah ribuan titik, desimal koma | Jumlah desimal tampilan dan pembulatan |
| OPS-FLX-07 | Persetujuan SO | Tidak ada aturan aktif | Aturan per kondisi pada Pengaturan Persetujuan |
| OPS-FLX-08 | Persetujuan dokumen sendiri | Nonaktif | Izinkan eksplisit per jenis dokumen |

## 1. Prinsip penggunaan

1. Pengguna memerlukan permission sesuai kelompok kebijakan untuk melihat atau mengubah nilai.
2. Perubahan memakai tindakan **Edit → Simpan** dan berlaku langsung secara default. Alasan perubahan dan approval tidak diwajibkan kecuali sebuah jenis kebijakan secara eksplisit mengaktifkannya.
3. Sistem tetap menyimpan versi, waktu, dan pengguna secara otomatis agar transaksi dapat menjelaskan konfigurasi yang dipakai; form tidak harus meminta alasan.
4. Tanggal berlaku bersifat opsional. Jika tidak diisi, perubahan berlaku saat disimpan. Tanggal masa depan hanya digunakan bila perusahaan memang ingin menjadwalkan perubahan.
5. Dokumen issued/posted dan transaksi yang telah menyimpan snapshot tidak dihitung ulang. Draft atau transaksi baru membaca konfigurasi terbaru sesuai aturan domain.
6. UI memvalidasi tipe, rentang, urutan, konflik, dan dependensi. Nilai salah tidak disimpan sebagai konfigurasi aktif.
7. Konfigurasi tidak boleh menonaktifkan invariant pada bagian 9.

8. Kode seperti `OPS-WH-01`, nama teknis seperti `value_type`, serta pilihan `percent` hanya digunakan untuk admin, audit, API dan dokumentasi. Label utama dan penjelasan yang tampil pada layar wajib mengikuti [Kamus Label Manusia dan Bahasa Layar](07-design.md). Contoh untuk OPS-WH-01: **Kelonggaran penerimaan melebihi pesanan**, **Cara menghitung: Persentase**, **Batas tambahan: 0% (tidak ada kelonggaran)**.

## 2. Perusahaan dan lokalisasi

| Kode | Parameter | Nilai awal | Perilaku UI |
|---|---|---|---|
| OPS-COMP-01 | Zona waktu bisnis | Asia/Makassar | Pilih zona waktu IANA; timestamp teknis tetap UTC |
| OPS-COMP-02 | Awal tahun buku | 1 Januari | Pilih bulan/tanggal awal; validasi terhadap periode yang sudah dibuka/ditutup |
| OPS-COMP-03 | Mata uang dasar | IDR | Dapat dipilih sebelum transaksi moneter posted; setelah itu UI menjelaskan bahwa perubahan memerlukan cut-over atau company baru |

Nama, alamat, kontak dan logo tetap dikelola melalui **Setting → Profil Perusahaan** sesuai IAM-10, bukan melalui policy ini.

## 3. Finance, AR/AP dan penagihan

| Kode | Parameter | Nilai awal | Pilihan/perilaku |
|---|---|---|---|
| OPS-FIN-01 | Dasar jatuh tempo AP | Tanggal invoice lengkap diterima/diverifikasi + TOP | Invoice terverifikasi, tanggal invoice supplier, atau GR; PO/MOU dapat override |
| OPS-FIN-02 | Kelonggaran jumlah saat pencocokan | 0% | Persentase atau jumlah barang sesuai satuan; nilai negatif ditolak |
| OPS-FIN-03 | Kelonggaran harga saat pencocokan | 0% | Persentase atau nominal; tidak mengubah harga PO diam-diam |
| OPS-FIN-04 | Batas pembulatan tagihan | Rp1 | Nominal tidak boleh negatif dan akun pembulatan wajib bila lebih dari nol |
| OPS-FIN-05 | Dasar pembagian biaya tambahan barang | Nilai pembelian bersih | Nilai bersih, berat, volume, jumlah, atau rata-rata; data dasar wajib tersedia |
| OPS-FIN-06 | Lama penyimpanan pesanan setelah pembayaran di muka | Sampai akhir 1 hari kerja berikutnya | Jumlah hari/jam kerja dan tindakan saat kedaluwarsa; jumlah yang sudah diambil tidak dilepas langsung |
| OPS-FIN-07 | Syarat penggabungan bukti barang diterima ke tagihan | Pelanggan, mata uang, profil pajak, termin dan tanggal bukti barang diterima harus sama | Pilih kriteria yang boleh digabung; tanggal jatuh tempo dan pajak tidak boleh ambigu |
| OPS-FIN-08 | Kelompok umur piutang dan utang | Belum jatuh tempo, 1–30, 31–60, 61–90, >90 hari | Tambah/ubah batas kelompok secara berurutan tanpa tumpang tindih atau celah yang tidak disengaja |

Metode pengakuan pendapatan/HPP dan metode penilaian persediaan dapat disediakan sebagai **Kebijakan Akuntansi** berizin tinggi. Nilai awal adalah POD dan moving average. Perubahan setelah transaksi posted tidak menghitung ulang histori; implementasi harus menyediakan cut-over/adjustment terkontrol.

## 4. Gudang dan pengadaan

| Kode | Parameter | Nilai awal | Pilihan/perilaku |
|---|---|---|---|
| OPS-WH-01 | Kelonggaran penerimaan melebihi pesanan | 0% | Persentase atau jumlah per pemasok, kategori, atau seluruh perusahaan; penerimaan di atas batas menjadi perlu pemeriksaan |
| OPS-WH-02 | Cara memilih kelompok barang | FEFO bila ada tanggal kedaluwarsa, FIFO bila tidak | Pilihan urutan pemilihan; barang diblokir, ditarik, kedaluwarsa, atau dikarantina tetap tidak dapat dipilih |
| OPS-WH-03 | Urutan pembagian stok ke pesanan | Kelayakan → cara memilih kelompok barang → waktu komitmen pesanan | Urutan kriteria yang didukung; pemeriksaan mutu dan kepemilikan selalu pertama |
| OPS-WH-04 | Prefix kode master | PRD, CUS, CON, SUP, VEN, EMP, AST | Prefix, panjang sequence dan preview per jenis master; kode yang sudah terpakai tidak berubah |
| OPS-WH-05 | Daftar data wajib per kondisi | Berdasarkan jenis, saluran, atau kategori | Pilih data wajib per konteks tanpa menghapus data historis |

Shelf-life, suhu, retur, konsinyasi dan disposition kualitas tetap dikelola pada policy domain Gudang/Master yang sudah tersedia.

## 5. CRM, target dan pelanggan

| Kode | Parameter | Nilai awal | Pilihan/perilaku |
|---|---|---|---|
| OPS-CRM-01 | Penutupan peluang | Otomatis pada akhir bulan | Aktif/nonaktif, waktu cut-off, alasan otomatis dan kebijakan Copy Remaining |
| OPS-CRM-02 | Jendela pelanggan aktif | Invoice posted dalam 12 bulan terakhir | Jumlah bulan/hari dan event transaksi yang diakui |
| OPS-CRM-03 | Formula A/T arah meningkat | Aktual ÷ Target × 100% | Pilih template formula dan batas tampilan; bukan kode bebas |
| OPS-CRM-04 | Cara menghitung pencapaian yang makin rendah makin baik | 200% − Aktual ÷ Target × 100%, dibatasi 0–200% | Pilih pola “angka lebih rendah lebih baik”, batas bawah, dan batas atas |
| OPS-CRM-05 | Gabungan beberapa indikator kinerja | Nonaktif pada pilot | Aktif/nonaktif; bobot harus tepat 100% bila digunakan |

Stage pipeline, confidence, alasan Win/Lost, skema target, penerima target, kebijakan pelanggan baru, freeze dan follow-up kredit tetap memakai menu Setting/domain terkait yang sudah dirancang.

## 6. Kunjungan dan pelacakan lokasi

| Kode | Parameter | Nilai awal | Pilihan/perilaku |
|---|---|---|---|
| OPS-VIS-01 | Radius check-in | 200 meter | Meter, nilai positif; di luar radius menjadi exception, bukan lokasi palsu |
| OPS-VIS-02 | Foto minimum | 1 foto | Bilangan bulat nonnegatif; bila nol, policy dapat menetapkan bukti lain |
| OPS-VIS-03 | Interval saat bergerak | 5 menit | Rentang tervalidasi sesuai kemampuan perangkat dan privasi |
| OPS-VIS-04 | Interval saat diam | 15 menit | Tidak boleh lebih agresif dari batas teknis/perangkat tanpa peringatan |
| OPS-VIS-05 | Retensi titik mentah | 90 hari | Jumlah hari sesuai kebijakan privasi/legal hold |
| OPS-VIS-06 | Retensi ringkasan rute | 1 tahun | Jumlah hari/bulan sesuai kebijakan privasi/legal hold |

Tracking tetap hanya berjalan pada sesi kerja yang dimulai secara jelas dan mengikuti permission perangkat.

## 7. HR, perjalanan dan retensi

| Kode | Parameter | Nilai awal | Pilihan/perilaku |
|---|---|---|---|
| OPS-HR-01 | Batas pengajuan advance | H-7 | Hari sebelum perjalanan |
| OPS-HR-02 | Batas settlement | 5 hari kalender | Jumlah hari dan basis kalender/kerja |
| OPS-HR-03 | Cut-off klaim | Tanggal 10 dan 25 | Satu atau beberapa tanggal setiap bulan |
| OPS-HR-04 | Plafon perjalanan | Sesuai dokumen 17 | Nilai per kategori, wilayah, satuan dan mata uang |
| OPS-HR-05 | Ambang durasi uang harian | <6 jam 50%; ≥6 jam 100% | Rentang durasi dan persentase |
| OPS-HR-06 | Retensi kandidat | 2 tahun | Hari/bulan/tahun dan tindakan anonymize/delete |
| OPS-HR-07 | Retensi arsip karyawan | 10 tahun setelah keluar | Durasi dan legal hold |

Nilai payroll, cuti, lembur, THR, BPJS dan PPh 21 tetap dikelola pada policy HR/payroll bertanggal sesuai kebutuhan hukum.

## 8. Dashboard, ekspor dan retensi sistem

| Kode | Parameter | Nilai awal | Pilihan/perilaku |
|---|---|---|---|
| OPS-SYS-01 | Realtime dan fallback refresh operasional | Event perubahan ditargetkan tampil ≤10 detik; fallback refresh maksimal 5 menit | Detik/menit dalam batas kapasitas sistem; event tertunda menampilkan freshness dan status sinkronisasi |
| OPS-SYS-02 | Batas penyamaran laporan HR kelompok kecil | Kelompok kurang dari 5 orang disembunyikan | Bilangan bulat dan cakupan pengecualian berizin |
| OPS-SYS-03 | Kedaluwarsa file ekspor | 7 hari | Durasi; sumber tetap mengikuti retensi domain |
| OPS-SYS-04 | Retensi transaksi/finance/pajak/stok | 10 tahun | Durasi per kategori, tidak boleh lebih pendek dari kewajiban hukum yang dikonfigurasi |
| OPS-SYS-05 | Retensi security/session log | 2 tahun | Durasi dan kapasitas penyimpanan |
| OPS-SYS-06 | SLA reminder approval | 4 jam kerja | Durasi default; policy dokumen dapat override |
| OPS-SYS-07 | SLA escalation approval | 1 hari kerja | Durasi default; policy dokumen dapat override |

RPO/RTO, region hosting, versi runtime, minimum OS, backup encryption dan secret management merupakan konfigurasi infrastruktur/deployment, bukan Setting bisnis pada UI ERP.

## 9. Invariant yang bukan konfigurasi bebas

- jurnal posted harus seimbang;
- posted/issued record tidak diedit atau dihapus langsung;
- koreksi memakai reversal, adjustment, retur, credit note atau proses domain resmi;
- saldo stok, AR/AP, kas/bank, GL dan payroll tidak dapat diketik ulang langsung;
- idempotency mencegah posting/movement/pembayaran ganda;
- nomor resmi yang terpakai tidak didaur ulang;
- alokasi dan pembayaran tidak boleh melebihi saldo/qty yang sah;
- batch recall, expired, blocked atau karantina tidak dapat dikirim;
- izin dan scope selalu diperiksa backend;
- transaksi antar-company tidak tercampur;
- persetujuan tidak pernah lolos otomatis; pengajuan tanpa pemberi persetujuan dialihkan ke Admin Sistem;
- PR/PO tetap dimiliki Warehouse & Logistik, sedangkan invoice/AP/pembayaran dimiliki Finance;
- dokumen issued mempertahankan snapshot identitas, nilai, template dan policy yang relevan.

## 10. Navigasi dan hak akses

Menu **Setting → Kebijakan Operasional** memakai tab:

1. Perusahaan & Lokalisasi;
2. Finance & Penagihan;
3. Gudang & Pengadaan;
4. CRM & Target;
5. Kunjungan & Lokasi;
6. HR & Perjalanan;
7. Dashboard, Ekspor & Retensi.

Hak minimal dipisahkan menjadi `operational_policy.read` dan `operational_policy.update`, lalu dapat dibatasi per kelompok policy. Halaman menampilkan **Nilai kebijakan**, **Nilai awal**, **Satuan**, **Cara menghitung**, **Batas yang diizinkan**, **Terakhir disimpan**, dan **Disimpan oleh**. Tombol utama hanya **Edit, Simpan, Batal**; alasan, approval dan tanggal berlaku tidak muncul kecuali jenis policy mengaktifkannya. Kode policy dan nama field teknis berada di bagian **Detail teknis** yang dapat dibuka.\n

## Pembaruan backend O2C — 5 Oktober 2026

Kontrak OPS-FIN-06 diperluas tanpa mengubah nilai default lama: value integer positif, unit business_day/business_hour, expiry_action release_unpicked, working_weekdays (0–6), holidays (YYYY-MM-DD), working_start dan cutoff (HH:mm), memakai timezone perusahaan. Kalender tidak diasumsikan; default lama yang belum memiliki kalender memblokir reservasi PREPAY baru sampai administrator melengkapinya. Kebijakan harus mendefinisikan jam kerja yang valid. Nilai tetap editable dan snapshot disimpan pada batch.

Rujukan implementasi dan batas verifikasi: [laporan remediasi backend O2C](../development/o2c-backend-remediation-2026-10-05.md).

