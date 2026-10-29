# Domain Sales & Marketing

> **Batas Release 1 O2C:** Surat Jalan terbit adalah bukti serah terima dan event stok, pendapatan serta HPP. Invoice hanya berasal dari Surat Jalan terbit. Termin/TOP dipilih di SO. Aturan yang masih menyebut POD, Packing List atau invoice menunggu POD berlaku setelah Release 1.


## Detail SO dan uang muka — Bagian 2, 26 Oktober 2026

Detail SO menghitung progress setiap barang serta dokumen terkait, termasuk invoice menunggu Surat Jalan terbit. DP sekarang mencakup receipt POSTED tertaut langsung SO atau batch SO, dikurangi refund tanpa hitung ganda. Catatan uang muka pending tidak masuk DP. Daftar/detail menyembunyikan DP tanpa izin receipt/advance; invoice dan dokumen warehouse mengikuti izin submenu masing-masing. Duplikat membuat draft baru dengan default kepala terbaru, referensi/bukti kosong dan harga diperiksa saat submit.

## Backend daftar dan form SO — 25 Oktober 2026

Tanggal dokumen tersimpan sebagai tanggal bisnis; default hari ini zona perusahaan, boleh di periode akuntansi terkunci. No. SP dan lampiran opsional dengan sakelar wajib pada OPS-FLX-12/13; lampiran yang disertakan tetap divalidasi perusahaan dan tujuan. Alamat bawaan dari alamat kirim utama/alamat pelanggan. Sales bawaan pembuat dan harus anggota aktif perusahaan. Termin dipilih dari daftar aktif OPS-FLX-03, disimpan di kepala SO dan disnapshot saat submit; perubahan katalog tidak mengubah snapshot SO yang sudah diajukan. Termin draft yang tidak lagi tersedia ditolak.

Gudang dipilih pada kepala; kode gudang bawaan OPS-FLX-10, atau satu-satunya gudang aktif. Banyak gudang tanpa pilihan/default menghasilkan pesan Setting. Gudang per barang hanya jika OPS-FLX-11 aktif. Alokasi dan alokasi ulang mengikuti gudang baris/kepala serta FEFO/FIFO dan kelayakan lot; tanpa stok cukup, sisa tetap terbuka. SO lama tanpa gudang tetap mempertahankan perilaku lama lintas gudang sampai direvisi; tidak menulis ulang alokasi lama.

Status tampilan tunggal mengikuti urutan CANCELLED, DRAFT dengan exception SUBMITTED belum kedaluwarsa, DRAFT, selesai/semua jumlah diterima setelah dikurangi jumlah ditutup, semua dikirim, sebagian dikirim, OPEN. Jumlah terkirim untuk status = diterima + dalam perjalanan; jumlah ditolak kembali menjadi kebutuhan. Filter tanggal menggunakan tanggal SO, bukan waktu record dibuat. Jatuh tempo perkiraan hanya untuk Tempo (tanggal SO + hari); invoice tetap memakai tanggal terbit + snapshot TOP.

DP sementara berasal dari penerimaan POSTED yang terkait batch SO, dikurangi pengembalian dana; penerimaan tanpa tautan batch tidak ikut. Command penerimaan yang ada membukukan dana melalui akun uang muka. Pencatatan uang muka langsung dari SO dan verifikasi Finance ada pada bagian 2, belum dibangun dalam tahap ini. Daftar hanya mengirim field aman, tidak mengekspos snapshot limit kredit.


## Keputusan 24 Oktober 2026 — harga dan diskon

Mengikuti [desain konsolidasi](../superpowers/specs/2026-10-24-konsolidasi-pengaturan-design.md) dan OTC-18/19: harga otomatis dari harga khusus pelanggan atau harga umum; batas diskon per peran/orang/produk; Harga Khusus diajukan dan disetujui di Penawaran & Harga. Ketentuan versi penawaran dan harga khusus lama yang bertentangan diganti keputusan ini.


## Keputusan 24 Oktober 2026 — Sales Order fleksibel

Mengikuti register README dan [desain arah fleksibel](../superpowers/specs/2026-10-24-erp-fleksibel-design.md): isian SO minimal; termin dipilih pada SO dan diwarisi invoice (OTC-17); TOP/limit master opsional; kredit mengikuti mode Nonaktif/Peringatan/Blokir; ongkos kirim Ditanggung perusahaan atau Dibebankan ke pelanggan Sebelum/Sesudah PPN; persetujuan SO hanya bila aturan aktif, dijalankan sebelum kredit dan alokasi tanpa reservasi stok selama menunggu. Pengecualian kredit memakai mesin persetujuan umum. Ketentuan lama di bawah yang bertentangan diganti keputusan ini.

## Keputusan 7 Oktober 2026 — penerbitan proforma manual

Setelah submit SO berhasil, alokasi/tahap pemenuhan tetap otomatis. Proforma belum
terbit sampai pengguna berizin `proforma.issue` meninjau tahap dan menerbitkannya.
Pratinjau memakai alokasi positif, harga/pajak snapshot dan total server; bukan input
item bebas. Penerbitan menolak tahap non-allocated, SO non-open, stok tidak layak,
reservasi kedaluwarsa tanpa dana cukup, atau versi sumber berubah. Retry/click ganda
tidak menerbitkan nomor kedua. Revisi jumlah/nilai tidak otomatis menerbitkan proforma
pengganti; histori lama tetap terbaca dan revisi aktif ditautkan ke sumber sebelumnya.
Tidak menambah approval rutin atau posting finansial. Lihat [bukti implementasi](../development/manual-proforma-2026-10-07.md).

Dokumen ini adalah sumber domain kanonis untuk modul ini. Judul ‘Bagian asal’ mempertahankan keterlacakan isi sebelum konsolidasi; prioritas keputusan tetap mengikuti Peta Dokumen.


---

## Bagian asal: 10-sales-marketing.md

# CRM operasional — pipeline, penawaran, kunjungan, follow-up dan sampel

Status: rancangan bisnis dan teknis untuk ditinjau, bukan fitur yang telah diimplementasikan. Keputusan pengguna pada percakapan ini menjadi acuan. Ketentuan implementasi yang belum disebut pengguna ditandai sebagai rancangan/usulan, bukan fakta SOP.

## 1. Sumber dan keputusan

Lampiran dibaca tanpa diubah: `C:/Users/LENOVO/Downloads/Sales_DA_18092026.xlsx`.

| Sumber | Temuan yang digunakan |
|---|---|
| SALES_PIPELINE!A9:P9 | Customer, produk/kategori, estimasi qty/harga/nilai/closing, stage, confidence, status, action plan/tanggal, alasan dan catatan |
| SALES_PIPELINE!K10, formula | LEAD 10%; QUALIFIED 25%; PENAWARAN 40%; NEGOSIASI 60%; PO EXPECTED 80%; CLOSED WON 100%; CLOSED LOST 0% |
| SALES_PIPELINE!H10 | Estimasi nilai = estimasi qty × estimasi harga; tidak memakai confidence di formula ini |
| SALES_PIPELINE!J10:J34 dan K10:K34 | Stage/confidence dicatat pada baris produk, sehingga kebutuhan produk dalam satu institusi perlu dapat dipantau terpisah |
| DAILY_ACTIVITY_LOG!A8:K9 | Tanggal, customer, user/kontak, aktivitas/tujuan, produk, hasil, status peluang dan catatan |

Validasi dropdown yang diperiksa pada sheet SALES_PIPELINE memisahkan Stage dari Status (ACTIVE, ON HOLD, DROPPED). Lampiran tidak memberikan katalog alasan Win/Lost terstruktur; kolom Alasan berisi catatan. Katalog alasan ERP harus dapat dikelola, bukan diklaim sudah tersedia di workbook.

Keputusan langsung pengguna:

- Prospek/peluang memakai siklus awal sampai akhir bulan; yang gagal mencapai Win ditutup karena tenggat akhir bulan.
- Setiap stage memiliki persentase; Win dan Lost wajib beralasan. Win wajib dilengkapi strategi maintain pelanggan atau kontak/user.
- **Win dipicu PO/SP pelanggan yang diterima dan diverifikasi.** Ini tidak mengubah dasar aktual penjualan dan NOO yang tetap memakai invoice diposting.
- Penawaran, masa berlaku, revisi, pengajuan harga/diskon per produk/pelanggan, tanggapan pelanggan dan penerusan item ke SO harus dirancang lengkap.
- Kunjungan memerlukan persetujuan atasan, foto wajib dan pelacakan lokasi aplikasi HP, termasuk di luar rencana/perubahan.
- **Pelacakan sepanjang aktivitas kerja termasuk ketika aplikasi tertutup.** Kebutuhan ini memperluas rancangan PWA awal; lihat bagian 5 dan Architecture.
- Follow-up/pengingat dan pengajuan sampel beserta hasil trial masuk cakupan.
- Target penjualan berbasis **net**: nilai barang sesudah diskon dan pengurang retur, tidak memasukkan pajak/ongkir. Nominal pembayaran AR tetap memakai jumlah uang sebenarnya yang dialokasikan ke tagihan.

## 2. Pipeline bulanan dan hasil per produk

Pisahkan **identitas pelanggan/kontak yang permanen**, **profil prospek**, dan **peluang bulanan**. Penutupan akhir bulan menutup peluang periode tersebut; tidak menonaktifkan pelanggan, menghapus kontak, SO atau invoice.

Rancangan alur: buka periode bulan → susun peluang serta beberapa produk → perbarui stage, alasan dan action plan → verifikasi PO/SP yang masuk → catat Win/Lost serta strategi maintain → akhir periode menutup sisa yang belum Win → tampilkan rekap hasil dan histori.

| Stage awal | Confidence |
|---|---:|
| LEAD | 10% |
| QUALIFIED | 25% |
| PENAWARAN | 40% |
| NEGOSIASI | 60% |
| PO EXPECTED | 80% |
| CLOSED WON | 100% |
| CLOSED LOST | 0% |

Setting menyimpan stage, urutan, confidence dan versi. Nilai berasal dari lampiran sebagai nilai awal. Riwayat perubahan stage menyimpan pengguna, waktu dan versi confidence. Persentase adalah tingkat keyakinan pipeline; bukan A/T dan bukan bukti pendapatan. Cut-off penutupan peluang dan jendela pelanggan aktif mengikuti OPS-CRM pada dokumen 40.

Form peluang: nomor, periode, pelanggan, kontak terkait, penanggung jawab, asal prospek/kunjungan, estimasi closing, status aktivitas, catatan/lampiran. Tabel produk: produk/kategori, estimasi qty/satuan, harga bruto/diskon/harga net acuan, nilai net, stage/confidence, action plan/tanggal/PIC, alasan, qty/nilai yang dimenangkan dan referensi baris PO/SP.

Stage per produk mengikuti struktur sumber. Rancangan menang sebagian: qty/produk yang sudah dikonfirmasi mempunyai hasil Win sendiri; sisa tetap terbuka sampai ada keputusan atau tenggat. Header menampilkan ringkasan Terbuka/Win Sebagian/Win/Lost tanpa memaksa seluruh produk menjadi Win. Rincian batas pemecahan qty dapat dievaluasi saat desain final.

Estimasi nominal = jumlah nilai net baris. Usulan tambahan estimasi berbobot = jumlah nilai net baris terbuka × confidence masing-masing; beri label **Forecast**, terpisah dari pesanan terkonfirmasi dan realisasi invoice. Angka berbobot merupakan rancangan tambahan, bukan perhitungan yang sudah ada di sel H10.

Saat Win:

1. Rekam PO/SP, nomor/tanggal, pelanggan, produk, qty/satuan, lampiran, waktu penerimaan dan verifikator berizin.
2. Cocokkan pelanggan/baris/qty peluang dengan bukti PO/SP; nilai yang sama tidak dimenangkan berulang pada peluang salinan.
3. Wajibkan alasan Win dan strategi maintain: pelanggan/kontak sasaran, tujuan, tindakan, PIC, jadwal pertama, frekuensi jika berulang dan ukuran keberhasilan.
4. Tugas maintain ditautkan ke peluang dan pelanggan. Contoh strategi untuk dievaluasi: memastikan pemakaian awal, evaluasi kepuasan, pelatihan produk atau pengingat kebutuhan berikutnya.
5. Penerusan ke SO tetap menjalankan pemeriksaan harga/kredit/stok. Win tidak memberikan unlock otomatis dan tidak menambah A/T penjualan/NOO sebelum invoice diposting.

Saat Lost: alasan dan catatan wajib, dengan katalog yang dapat diatur. Contoh alasan rancangan: harga tidak disepakati, spesifikasi tidak sesuai, anggaran ditunda, memilih produk lain, atau kebutuhan batal. Pada akhir bulan, sisa terbuka menjadi **CLOSED LOST — Tenggat akhir bulan**; alasan otomatis ini dibedakan dari penolakan pelanggan. Simpan stage terakhir, estimasi dan tugas terkait sebagai histori. Tidak mengubah Win yang sudah tercatat.

Penutupan memakai batas akhir bulan pada timezone perusahaan dan kunci periode; job yang terlambat tetap mengevaluasi keadaan pada cut-off, bukan membuat kesempatan Win dengan backdate. Timestamp bukti, verifikasi dan pencatatan dipisah. Koreksi setelah periode ditutup memerlukan hak/alasan/jejak, bukan mengedit histori diam-diam.

Peluang boleh dibuka kapan saja dalam bulan. Bila sisa masih layak, pengguna menjalankan **Copy Remaining** setelah review untuk membuat peluang periode berikutnya dengan tautan predecessor; periode lama tidak dibuka kembali dan qty Win tidak digandakan. Data kontak dan kegiatan tetap permanen.

## 3. Penawaran dan pengajuan harga/diskon

Kebijakan sumber harga, margin, batas diskon, pricelist dan konflik versi mengikuti [Harga Jual dan Margin](10-sales-marketing.md); bagian CRM mengatur konteks pelanggan, penawaran dan konversi ke SO.

Form header: nomor/versi, tanggal, berlaku sampai, pelanggan, PIC tujuan, penanggung jawab, peluang asal, mata uang, ketentuan pembayaran/pengiriman, ongkir/pajak terpisah, catatan dan lampiran. Baris: produk, spesifikasi, qty, satuan, harga acuan, harga usulan, diskon, harga net, pajak, nilai net, referensi kebutuhan/peluang dan pengajuan harga bila ada.

Rancangan status dokumen: Draft → Siap Diterbitkan → Diterbitkan, dengan Kedaluwarsa/Dibatalkan/Digantikan bila berlaku. Status pengajuan harga dan tanggapan pelanggan adalah dimensi terpisah. Cetak mengikuti template/penomoran yang disepakati. Menandai dokumen dikirim mencatat waktu/media/bukti; tidak berarti ada pengiriman WhatsApp/email otomatis.

Pengajuan harga/diskon dibuat **per pelanggan dan produk/satuan**, dapat memuat beberapa baris. Field: harga referensi/usulan, diskon, harga net, qty/minimum pembelian jika disyaratkan, tanggal berlaku, alasan, lampiran, batas cakupan (penawaran tertentu atau harga khusus pelanggan), pemohon dan pemberi keputusan. Diskon nominal dan persen harus dihitung dengan basis yang jelas; diskon efektif tidak dikurangkan dua kali.

Alur: simpan draft penawaran → periksa kewenangan/aturan harga → ajukan baris yang perlu pengecualian → pihak berwenang menyetujui/menolak/meminta revisi per baris → terapkan hasil yang valid → terbitkan versi penawaran. Harga dalam batas yang sudah diizinkan tidak harus meminta pengecualian baru; batas, approver dan delegasi dikonfigurasi. Pengajuan untuk penawaran tertentu tidak otomatis mengubah pricelist global.

Perubahan pelanggan, produk, satuan, nilai harga/diskon atau syarat yang menjadi dasar keputusan membatalkan pemakaian approval lama untuk baris terdampak. Persetujuan terikat versi/cakupan/masa berlaku. Riwayat penawaran yang sudah terbit disimpan; revisi menghasilkan versi baru dan penawaran lama bertanda digantikan. Tanggapan menyebut versi yang diterima pelanggan.

Tanggapan pelanggan: Menunggu, Diterima, Diterima Sebagian, Minta Revisi, Ditolak; catat tanggal, kontak pemberi tanggapan, alasan/bukti dan qty/item yang diterima. Persetujuan penawaran saja belum otomatis Win; Win mengikuti PO/SP terverifikasi.

Tindakan Buat SO memilih item/qty sesuai PO/SP dan penawaran yang diterima, mempertahankan harga/syarat versi sumber. Sisa qty yang belum dipindahkan terlihat. Cegah konversi berulang melebihi qty yang diterima; perubahan qty/pesanan harus ditelusuri. Penawaran kedaluwarsa/harga tidak valid memerlukan pembaruan atau keputusan berizin sesuai aturan sebelum dapat dipakai. SO memakai persetujuan hanya bila aturannya aktif, dan seluruh item pesanan pelanggan masuk SO, termasuk stok kosong. Penawaran tidak memesan stok atau menciptakan PR.

## 4. Kunjungan berizin, foto dan perubahan

Form rencana: nomor, sales/pelaksana, tanggal/jam, pelanggan/prospek, satu/beberapa kontak, alamat/lokasi, tujuan, beberapa produk/kebutuhan, referensi peluang/penawaran/SO/invoice dan catatan. Atasan/atasan pengganti dipetakan melalui penugasan berizin; jabatan tidak otomatis memberi semua hak akses.

Alur: Draft → Ajukan → Menunggu Persetujuan → Disetujui / Perlu Revisi / Ditolak. Pelaksanaan normal memakai versi rencana yang disetujui. Check-in dan check-out tetap per sesi pelanggan/lokasi; hasil, kebutuhan dan tindak lanjut dapat berbeda per kontak.

Nilai awal memerlukan minimal satu foto asli per kunjungan dan radius check-in 200 meter. Jumlah foto dan radius dapat diubah melalui OPS-VIS-01/02 pada Setting. Bukti ditautkan ke visit_id, pengunggah, waktu perangkat/server serta koordinat. Kamera/lokasi ditolak, di luar radius atau gagal menghasilkan status Exception yang memerlukan review; tidak membuat bukti palsu atau status sukses diam-diam.

Rencana berubah: ajukan revisi beralasan berisi perbedaan tanggal, lokasi, pelanggan/kontak, tujuan atau pelaksana; atasan menyetujui versi baru. Jangan menimpa rencana yang disetujui maupun waktu aktual. Kunjungan di luar rencana: buat pengajuan mendadak dengan alasan/lokasi/tujuan, minta persetujuan atasan; tidak otomatis melewati approval. Bila aktivitas telanjur terjadi, catat fakta dan tandai belum disetujui untuk review, tidak melakukan backdate persetujuan.

Selesai terverifikasi memerlukan versi rencana/pengajuan mendadak yang disetujui, check-in/out sah, jumlah bukti sesuai OPS-VIS-02 aktif dan hasil. Tidak bertemu tetap catatan kunjungan, bukan target berhasil. Pengecualian setelah kejadian tetap berstatus Exception dan hanya menjadi patuh setelah review berizin; histori fakta tidak diubah.

Layar: Daftar/Kalender Rencana, Antrean Persetujuan Atasan, Kunjungan Hari Ini, Detail Rencana/Revisi, Realisasi per Kontak, Riwayat Lokasi dan Laporan Rencana vs Realisasi. Data dipilah sesuai izin.

## 5. Pelacakan lokasi selama aktivitas kerja

Keputusan final: aplikasi HP memakai **Nuxt/Vue 3 + Capacitor**, minimum Android 10 dan iOS 15, dengan lokasi latar belakang selama sesi kerja. Pilot memakai distribusi internal Android dan TestFlight iOS; PWA/browser hanya akses tambahan. Menu sales/gudang mengikuti izin; web kantor tetap Next.js/React.

Aktivitas kerja: mulai sesi secara jelas → rekam lokasi menurut interval OPS-VIS-03/04, dengan nilai awal 5 menit saat bergerak/15 menit saat diam → tautkan titik dengan sesi/kunjungan → akhiri sesi → hentikan tracking. Retensi memakai OPS-VIS-05/06, dengan nilai awal raw point 90 hari dan ringkasan rute/kunjungan 1 tahun. Tampilkan indikator tracking dan batasi viewer sesuai izin.

Setiap titik: session_id, pengguna, captured_at, received_at, latitude/longitude, accuracy, sumber dan kondisi pengiriman. Bedakan **lokasi terakhir** dengan posisi langsung; tampilkan umur data, status izin, baterai/jaringan bila tersedia serta jeda/sinyal terputus. Jangan mengisi jalur kosong dengan titik yang seolah nyata.

Layar terkunci atau UI ditutup berbeda dari perangkat mati, izin dicabut, force-stop, atau pembatasan OS. Pelacakan tidak boleh dijanjikan tetap berjalan pada semua keadaan tersebut. Uji perangkat nyata diperlukan sebelum fitur dianggap siap.

Telemetri lokasi dapat memakai antrean lokal terenkripsi khusus untuk mengirim titik saat jaringan kembali; bedakan timestamp rekam/terima. Ini bukan izin membuat SO/pembayaran/posting atau menyelesaikan kunjungan secara offline. Status transaksi tetap menunggu konfirmasi server sesuai prinsip awal. Prototipe harus menguji pembatasan OS dan perlindungan data antar akun/sesi.

## 6. Follow-up, pengingat dan maintain

Tugas tertaut pelanggan, kontak, peluang/baris produk, kunjungan, penawaran, sampel atau trial. Field: jenis, uraian tindakan, PIC, tenggat, prioritas, pengingat, status, hasil, bukti dan tugas berikutnya. Status rancangan: Terbuka, Dikerjakan, Selesai, Dibatalkan; Terlambat dihitung dari tenggat dan status, bukan tombol bebas.

Sumber tugas: action plan pipeline; hasil kunjungan per kontak; tanggapan/revisi penawaran; masa berlaku penawaran; pengajuan harga; jadwal trial/hasil belum diisi; pengembalian sampel; serta strategi maintain wajib saat Win. Cegah duplikasi tugas dari event/retry yang sama.

Pengingat aplikasi sebelum jatuh tempo dan saat terlambat; jadwal dan eskalasi ke atasan dikonfigurasi. Berikan tautan langsung ke pekerjaan dan sumbernya. Menyelesaikan tugas memerlukan hasil dan waktu; tunda/jadwal ulang/cancel menyimpan alasan. Follow-up masa depan tidak terhapus hanya karena peluang bulanan ditutup; beri konteks periode lama, lalu atur kelanjutannya secara tercatat.

Tidak ada pengiriman otomatis ke pelanggan via WhatsApp/email pada lingkup awal. Notifikasi internal aplikasi/HP dan pencatatan komunikasi menjadi rancangan awal; pengiriman eksternal memerlukan integrasi serta pengaturan terpisah.

## 7. Target penjualan net

Dasar nilai untuk target dan aktual penjualan harus sama:

**Nilai penjualan net = nilai barang sebelum pajak − diskon barang − pengurang retur/koreksi penjualan yang sudah diposting.** Pajak dan ongkir tidak masuk komponen nilai barang ini.

Jika invoice sudah menyimpan nilai setelah diskon, jangan mengurangkan diskon lagi. Diskon tingkat dokumen dialokasikan ke baris dengan aturan konsisten agar rekap produk/kategori/pelanggan cocok. Retur yang belum diposting secara finansial ditampilkan sebagai proses tertunda, tidak otomatis mengurangi realisasi dua kali bersama nota kredit.

Contoh simulasi: nilai barang Rp100 juta, diskon Rp5 juta, pengurang retur diposting Rp10 juta menghasilkan net Rp85 juta; pajak dan ongkir terpisah tidak menambah net. Pengembalian uang terkait nota kredit tidak mengurangi net untuk kedua kalinya.

Sumber aktual tetap invoice diposting dan dokumen koreksi yang ditautkan; Win/PO/SP bukan aktual penjualan. Retur mengurangi aktual pada periode credit note/retur finansial diposting dan laporan menyimpan dimensi periode invoice asal. Atribusi default 100% kepada owner invoice/SO; split diperbolehkan bila total tepat 100%, beralasan, berapproval dan berversi. Histori tidak dihitung ulang diam-diam.

Keputusan net ini berlaku untuk nilai target penjualan; target penagihan uang tetap pembayaran sebenarnya yang dialokasikan ke invoice. Nilai net bukan pengganti total tagihan atau saldo AR.

## 8. Pengajuan sampel dan hasil trial

Rancangan alur: Pengajuan Sampel → Persetujuan → Persiapan Gudang → Serah Terima → Trial → Catat Hasil → Follow-up/penawaran atau penyelesaian/pengembalian sampel.

Form pengajuan: nomor/tanggal, pemohon/PIC, pelanggan, kontak/user penerima, peluang asal, tujuan, tanggal diperlukan, rencana trial/lokasi, produk lebih dari satu, qty/satuan, cara penyediaan, sifat habis pakai atau dipinjamkan, rencana kembali bila dipinjam, estimasi biaya sesuai izin, alasan dan lampiran. Jenis sampel tersebut adalah rancangan untuk mencakup barang konsumsi dan alat demo, bukan klaim seluruh produk boleh dipinjam atau diberikan.

Persetujuan memakai pihak/limit biaya yang diatur. Pengajuan atau persetujuan saja tidak mengurangi stok. Gudang mengeluarkan jumlah aktual melalui dokumen sampel tertaut, menyimpan batch/expiry/serial/locator dan penerima. Hanya stok yang layak boleh dipilih. Sampel milik supplier dibedakan dari milik perusahaan; jangan membebankan stok milik sendiri untuk barang titipan.

Habis pakai/gratis: pergerakan dan biaya mengikuti account/tax/disposition policy aktif, tidak otomatis menjadi penjualan/AR atau NOO. Bila policy belum lengkap, issue ditahan. Alat dipinjam: pindah lokasi/kustodian dengan tenggat kembali; bukan pengurangan aset permanen.

Serah terima merekam tanggal, produk/batch/serial/qty, kontak penerima dan bukti. Catat penggunaan, sisa, kehilangan atau kerusakan melalui transaksi terkait, bukan mengubah qty asal. Barang yang kembali dari pelanggan masuk karantina, diperiksa sebelum tersedia lagi; barang habis pakai terpakai tidak dikembalikan ke stok.

Form hasil trial per produk: nomor/referensi sampel, pelanggan/kontak penguji, tanggal/lokasi, tujuan, kriteria evaluasi yang disepakati, qty/batch/serial yang digunakan, hasil per kriteria, kesimpulan Sesuai/Tidak Sesuai/Perlu Trial Ulang, feedback, kendala, lampiran/bukti, pencatat/reviewer, rekomendasi dan tindakan berikutnya. Hasil trial tidak otomatis menjadi klaim klinis, Win, pesanan atau pendapatan. Jangan meminta data pasien untuk evaluasi komersial yang tidak memerlukannya.

Trial ulang menjadi catatan baru yang tertaut hasil sebelumnya. Status pengajuan, pemenuhan, trial dan pengembalian terpisah agar pengiriman sebagian atau trial selesai dengan barang belum kembali tetap terlihat. Pantau pengajuan menunggu keputusan, sampel belum diterima, trial lewat jadwal, hasil belum diisi dan alat belum dikembalikan.

## 9. Hal yang perlu ditetapkan dan pemeriksaan sebelum implementasi

- Nilai batas harga/diskon dan limit/approver sampel tetap mandatory configuration, bukan keputusan alur terbuka.
- Kriteria detail hasil campuran produk/qty, perangkat uji dan plugin lokasi diverifikasi melalui acceptance test.
- Account/tax/disposition policy sampel wajib Active sebelum issue.

Skenario penerimaan rancangan: penutupan bulan tidak mengubah master pelanggan; sisa gagal diberi alasan tenggat tanpa menimpa Win; retry tidak menggandakan close/tugas/SO/issue sampel; PO/SP yang sama tidak memenangkan qty dua kali; perubahan harga/rencana tidak memakai approval versi lama; check-in satu pelanggan dengan beberapa kontak dihitung satu sesi; foto/lokasi gagal terlihat sebagai belum lengkap; telemetry stale tidak ditampilkan sebagai live; penawaran parsial tidak menggandakan qty SO; net invoice/retur cocok dengan rekap; trial/pengeluaran sampel tidak menambah penjualan atau NOO; pengembalian alat melewati karantina.


---

## Bagian asal: 10-sales-marketing.md

# Kebijakan Harga Jual dan Margin

Status: spesifikasi bisnis Finance/Sales poin harga jual selesai dan aturan dasarnya difinalkan pada Gelombang A. HPP buku berasal dari [HPP dan Penilaian Persediaan](12-finance-administration.md). Harga jual memakai biaya acuan yang terlihat sumbernya dan target margin; sistem membedakan margin dari markup.

## 1. Prinsip

1. Harga jual tidak mengubah HPP, nilai persediaan atau jurnal sampai transaksi diposting.
2. Harga sebelum pajak dihitung terpisah dari PPN, ongkir dan biaya lain.
3. Pricelist memiliki versi, tanggal efektif, satuan, mata uang, channel/pelanggan dan status.
4. Harga khusus pelanggan tidak otomatis mengubah pricelist global.
5. Penawaran, pengajuan harga dan SO menyimpan snapshot harga, diskon, margin dan policy yang dipakai.
6. Harga yang sudah dipakai pada dokumen terbit/posted tidak diedit; revisi menghasilkan versi baru atau koreksi berizin.

## 2. Basis harga

Pengguna memilih basis:

- HPP buku rata-rata bergerak;
- biaya pengganti/acuan pembelian;
- harga MOU supplier;
- harga standar yang disetujui;
- basis khusus kontrak/tender dengan bukti.

HPP buku dan biaya pengganti ditampilkan terpisah. Biaya belum tersedia tidak dianggap nol dan tidak dapat menghasilkan rekomendasi otomatis.

## 3. Rumus

**Margin** = `(Harga net sebelum pajak − biaya) / Harga net sebelum pajak × 100%`

**Markup** = `(Harga net sebelum pajak − biaya) / biaya × 100%`

Dengan target margin `m`:

`Harga net rekomendasi = biaya / (1 − m)`

Jika ada diskon daftar `d`:

`Harga daftar = biaya / ((1 − m) × (1 − d))`

Contoh: biaya Rp100.000 dan target margin 25% menghasilkan harga net Rp133.333,33. Markup 25% hanya menghasilkan Rp125.000 dan margin 20%, sehingga kedua istilah tidak boleh dipertukarkan.

Pembulatan, minimum harga, diskon maksimum dan mata uang mengikuti policy bertanggal efektif.

Tidak ada target margin, pembulatan atau batas diskon global yang ditebak oleh sistem. Price list tidak dapat dipublikasikan sebelum policy yang sesuai scope memiliki nilai tersebut dan approver aktif. Dengan demikian, aturan bisnis final tetap aman walaupun angka komersial berbeda antar kategori, channel atau pelanggan.

## 4. Price list

Field utama: kode/nama, cakupan perusahaan/channel/pelanggan, produk, satuan, mata uang, harga sebelum pajak, minimum margin, diskon maksimum, tanggal berlaku, tanggal berakhir, prioritas, status, alasan dan approver.

Urutan pemilihan harga:

1. Harga khusus pelanggan yang masih berlaku;
2. harga channel/rayon yang masih berlaku;
3. harga standar perusahaan;
4. harga rekomendasi hanya sebagai usulan, bukan harga aktif otomatis.

Jika terdapat dua harga dengan prioritas sama dan masa berlaku tumpang tindih, sistem menahan penerbitan dan meminta penyelesaian konflik.

## 5. Diskon

Diskon dapat berupa persen atau nominal per baris/dokumen, dengan basis yang jelas. Sistem menyimpan harga bruto, diskon, harga net dan margin setelah diskon. Diskon tingkat dokumen dialokasikan ke baris dengan metode yang ditetapkan agar target dan margin tidak menghitung dua kali.

Jika margin setelah diskon masih di atas batas minimum, sales dapat memakai kewenangan sesuai policy. Jika di bawah batas, sistem membuat **Pengajuan Harga/Diskon Khusus** dengan pelanggan, produk, qty, harga, diskon, margin, alasan, masa berlaku dan bukti.

Persetujuan terikat pada baris, versi, cakupan dan masa berlaku. Perubahan pelanggan, produk, qty, harga, diskon, TOP atau syarat material membatalkan keputusan lama untuk bagian terdampak.

## 6. Channel, pelanggan pemerintah dan tender

Price list dapat berbeda untuk Rumah Sakit Pemerintah, Rumah Sakit Swasta, Dinas Kesehatan, Apotek/Klinik, Laboratorium, Institusi Pemerintah dan channel tambahan. Tender/kontrak menyimpan nomor kontrak, item, kuantitas, harga, periode dan dokumen sumber. Perlakuan pajak/WAPU tetap berasal dari tax profile dan tidak diubah oleh kalkulator harga.

## 7. Ongkir dan margin

Ongkir yang ditagihkan pelanggan ditampilkan terpisah dari nilai barang dan tidak masuk target penjualan net. Biaya ekspedisi yang ditanggung perusahaan dapat ditampilkan sebagai biaya distribusi pada margin setelah pengiriman. Sistem tidak memasukkan ongkir dua kali atau menjadikannya diskon barang tanpa policy.

## 8. Alur

**Pilih produk/satuan → ambil HPP/biaya acuan → pilih price list → hitung harga rekomendasi → masukkan diskon → validasi margin → ajukan exception bila perlu → setujui/publish versi → gunakan pada penawaran/SO → simpan snapshot.**

SO tetap menjalankan pemeriksaan harga, ketentuan pembayaran, kredit dan stok. Persetujuan harga khusus bukan persetujuan rutin SO.

## 9. Layar dan hak akses

- **Sales & Marketing → Penawaran & Harga → Price List:** katalog harga dapat menautkan Produk dan Harga Jual Standar dari Master Data, sedangkan aturan harga, simulasi, validasi konflik, approval, publikasi dan histori diputuskan service Sales & Marketing dengan izin harga khusus; perubahan produk biasa tidak dapat mempublikasikan pricelist.
- **Sales → Pengajuan Harga/Diskon:** ajukan per pelanggan/produk dan pantau keputusan.
- **Sales → Penawaran:** melihat harga acuan, diskon, net dan margin efektif sesuai hak.
- **Finance/Sales berwenang:** melihat biaya dan margin; akses HPP/modal terpisah dari akses harga jual.
- **Setting → Aturan Harga:** margin minimum, diskon maksimum, pembulatan, prioritas, approver dan delegasi.

## 10. API dan data

Endpoint: `/price-lists`, `/price-lists/{id}/simulate`, `/price-lists/{id}/submit`, `/price-lists/{id}/publish`, `/price-approvals`, `/customer-price-requests`, dan `/pricing/validate`.

Data utama: `price_lists`, `price_list_items`, `pricing_policies`, `price_approval_instances`, `customer_price_requests`, `price_snapshots` dan `pricing_conflicts`. Simulasi tidak mengubah harga aktif. Publish memerlukan versi, tanggal efektif, validasi konflik dan audit.

## 11. Kriteria penerimaan

1. Margin dan markup ditampilkan dengan rumus yang benar.
2. Harga tanpa biaya valid tidak direkomendasikan otomatis.
3. Harga khusus tidak mengubah pricelist global tanpa tindakan terpisah.
4. Diskon dan margin tersimpan dalam snapshot transaksi.
5. Harga berlaku tunggal ditentukan oleh prioritas dan tanggal efektif.
6. Konflik pricelist menahan publish.
7. Harga di bawah minimum memerlukan pengajuan dan approval.
8. Perubahan material membatalkan approval versi terdampak.
9. Pajak dan ongkir tidak bercampur dengan nilai net barang.
10. Histori harga, simulasi, keputusan, publish dan penggunaan pada dokumen diaudit.


---

## Bagian asal: 10-sales-marketing.md

# Kebijakan Kredit dan Exposure Pelanggan

Status: kebijakan kredit dan exposure difinalkan pada Gelombang A untuk blueprint/pilot. Kebijakan dapat diubah melalui Setting dengan versi dan tanggal efektif; transaksi berjalan memakai snapshot dan dievaluasi ulang jika berubah material.

## 1. Rumus exposure

**Exposure kredit = AR terbuka + piutang belum ditagih dari POD + barang dalam perjalanan yang belum menjadi unbilled + stok yang sudah dialokasikan untuk pengiriman − uang muka terverifikasi yang sudah ditautkan.**

Komponen harus saling eksklusif. Perpindahan dari alokasi → transit → unbilled → AR memindahkan nilai antar-komponen dan tidak menambah exposure dua kali.

Backorder yang belum dialokasikan tidak memakai limit. Saat stok tersedia dan akan dialokasikan, sistem memeriksa ulang past due, freeze, limit, policy pelanggan dan grant unlock secara atomik.

## 2. Mode pelanggan

- **COD:** TOP 0, jatuh tempo pada waktu serah terima Surat Jalan terbit; tidak memerlukan limit kredit, tetapi pembayaran tetap dipantau.
- **Prepay:** dispatch memerlukan dana terverifikasi dan ditautkan; dana tersebut tidak dapat digunakan dua kali.
- **Credit/Tempo:** memerlukan TOP, limit, tanggal efektif dan pengguna berwenang.

Termin dipilih pada SO; kebijakan COD awal pelanggan baru opsional (keputusan 24 Oktober 2026).

## 3. Pemakaian dan pelepasan limit

| Peristiwa | Dampak exposure |
|---|---|
| SO Draft/submit tanpa alokasi | Tidak memakai limit, tetapi simulasi exposure ditampilkan |
| Stok dialokasikan | Menambah komitmen kredit |
| Dispatch | Nilai berpindah dari alokasi ke transit |
| POD | Nilai berpindah dari transit ke unbilled |
| Invoice posted | Nilai berpindah dari unbilled ke AR |
| Pembayaran dialokasikan | Mengurangi AR/exposure |
| Credit note posted dan dialokasikan | Mengurangi AR/exposure |
| Alokasi dilepas atau sisa dibatalkan/ditutup | Melepas komitmen |
| Backorder belum dialokasikan | Tidak memakai limit |
| Uang muka ditautkan | Mengurangi kebutuhan exposure untuk tahap terkait |

## 4. Past due dan freeze

Nilai awal follow-up: H-7, H, H+3, H+7 dan H+14; freeze awal H+30 setelah jatuh tempo. Jadwal dan batas dapat diubah melalui Setting kebijakan kredit. Freeze menahan alokasi baru dan dispatch yang memerlukan kelayakan kredit, tetapi tidak menghapus transaksi atau saldo.

Finance dapat membuat policy lebih ketat per pelanggan/channel. Pengecualian hanya melalui unlock dengan alasan, scope, nilai, masa berlaku dan approver yang dikonfigurasi.

## 5. Invoice sengketa

Invoice disputed tetap terlihat dan default tetap masuk exposure. Finance dapat menetapkan perlakuan berbeda hanya melalui policy/exception beralasan. Janji bayar, komunikasi pelanggan atau status follow-up tidak mengurangi exposure.

## 6. Unlock

Unlock berlaku untuk SO/revisi/alasan tertentu, maksimum nilai, syarat dan masa berlaku. Unlock tidak menaikkan limit master, menghapus past due, melunasi invoice atau melewati pemeriksaan stok/kualitas/dana lain. Perubahan material membuat grant stale dan memerlukan evaluasi ulang.

## 7. Evaluasi fasilitas Tempo

Finance meninjau histori COD/prepay, ketepatan pembayaran, nilai transaksi, potensi, dokumen pelanggan, sengketa, retur dan risiko. Hasil dapat berupa tetap COD, Prepay, Tempo dengan TOP/limit, pengurangan fasilitas atau freeze. Keputusan bertanggal efektif dan diaudit.

## 8. Layar dan laporan

Detail pelanggan menampilkan limit, exposure per komponen, sisa limit, past due, freeze, uang muka terikat, SO/alokasi terkait dan histori policy. Laporan menyediakan penggunaan limit, pelanggan mendekati limit, over-limit, past due, freeze, unlock aktif/kedaluwarsa dan konsentrasi exposure.

## 9. API dan data

Endpoint: `/customers/{id}/credit-exposure`, `/customers/{id}/payment-policies`, `/credit-checks`, `/sales-orders/{id}/reevaluate`, `/sales-orders/{id}/unlock-requests`, dan `/reports/credit-exposure`.

Entitas: `customer_credit_policies`, `credit_exposure_components`, `credit_commitments`, `credit_evaluations`, `customer_freezes`, `unlock_requests`, `unlock_grants` dan `credit_policy_versions`.

## 10. Kriteria penerimaan

1. Komponen exposure tidak dihitung ganda saat berpindah tahap.
2. Backorder belum dialokasikan tidak memakai limit.
3. Alokasi memeriksa ulang kredit di bawah lock.
4. Pembayaran hanya mengurangi exposure setelah posted dan dialokasikan.
5. Uang muka hanya mengurangi tahap yang ditautkan.
6. Freeze H+30 mengikuti due date dan policy efektif.
7. Invoice disputed tidak otomatis dikeluarkan.
8. Unlock terikat SO/revisi/alasan/nilai/masa berlaku.
9. Pelepasan alokasi/pembatalan melepas komitmen secara idempotent.
10. Laporan exposure dapat ditelusuri ke invoice, POD, shipment, alokasi, pembayaran dan unlock.


---

## Bagian asal: 10-sales-marketing.md

# Sales Order-to-Cash

Status: sumber domain Sales & Marketing untuk proses dari SP/PO pelanggan sampai SO, kredit, pemenuhan, POD, invoice dan hubungan AR. CRM rinci tetap pada [CRM Operasional](10-sales-marketing.md); aturan jurnal/AR tetap dirujuk dari Finance.

## 1. Ruang lingkup dan kepemilikan

Sales mencatat referensi SP/PO pelanggan sebagai sumber pesanan, lalu memiliki SO, status kredit/unlock, fulfillment request, proforma dan handoff penagihan. SP/PO pelanggan bukan transaksi internal yang diposting ERP. Warehouse memiliki picking, packing, surat jalan, dispatch, POD fisik dan stok. Finance memiliki invoice posted, faktur pajak, AR, penerimaan dan credit note. Satu dokumen tidak boleh memiliki dua pemilik posting.

## 2. Alur utama

SP/PO pelanggan → validasi pelanggan/harga → SO Draft → input seluruh item → Submit → validasi data dan kebijakan pembayaran → cek past due/limit/exposure → bila hold, unlock request → evaluasi ulang → cek stok dan alokasi atomik → fulfillment batch → proforma/picking → checking/packing/SJ → dispatch → monitoring transit → POD → invoice resmi → AR/follow-up → pembayaran.

SO tanpa aturan persetujuan aktif tidak membutuhkan approval manusia. Persetujuan SO dan pengecualian kredit memakai mesin persetujuan umum (24 Oktober 2026). Semua item pelanggan wajib masuk SO, termasuk stok kosong.

## 3. Status dan aturan kuantitas

| Dimensi | Status |
|---|---|
| Pesanan | Draft, Open, Selesai, Closed, Cancelled |
| Pemenuhan | Belum Dikirim, Sebagian, Terkirim Semua |
| Sisa | Backorder, Proses Pemenuhan, Ditutup |
| Pengiriman | Siap Dikirim, Dalam Perjalanan, Diterima Sebagian, Diterima |
| Invoice | Draft, Diterbitkan–Menunggu POD, Posted, Partially Paid, Paid, Reversed |

Ordered quantity tidak pernah ditulis ulang. Allocated, picked, shipped, delivered, invoiced, backordered dan closed quantity disimpan terpisah. Kumulatif tidak boleh melebihi ordered quantity.

## 4. Kredit dan stok

Submit menjalankan validasi server berurutan: pelanggan, alamat/PIC, pricelist/harga, payment policy, past due/freeze, limit/exposure, lalu stok. Exposure mengikuti [Kebijakan Kredit dan Exposure](10-sales-marketing.md). Backorder belum dialokasikan tidak memakai limit. Alokasi baru memeriksa ulang kredit secara atomik.

Termin dipilih pada SO (Tunai/COD, Bayar sebelum kirim, Tempo N hari); TOP/limit master opsional dan kebijakan COD awal opsional. Prepay menahan dispatch sampai dana terverifikasi.

Picking memilih batch/locator yang layak berdasarkan FEFO/FIFO. Expired, karantina, recall dan hold tidak boleh dialokasikan. Sales dapat melihat availability informatif, tetapi alokasi resmi hanya hasil service Warehouse.

## 5. Fulfillment, POD dan invoice

Fulfillment batch dapat dibuat beberapa kali dari satu SO. Proforma dan picking hanya memuat allocated quantity. Packing/SJ hanya memuat picking yang lolos checking. POD mencatat tanggal/jam aktual, penerima, bukti, qty diterima, selisih dan alasan.

Invoice Release 1 hanya mengacu qty Surat Jalan terbit yang belum ditagih. Jatuh tempo = waktu serah terima Surat Jalan terbit + TOP. Satu invoice hanya menggabungkan POD dengan pelanggan, mata uang, tax profile, TOP dan tanggal POD yang sama; POD berbeda tanggal dibuat menjadi invoice terpisah. Invoice asli dapat dibawa saat pengiriman dengan status menunggu POD; posting tetap menunggu POD tervalidasi. Invoice tidak boleh membuat pendapatan/HPP kedua.

Untuk prepay, masa reservasi mengikuti OPS-FIN-06 dengan nilai awal sampai akhir satu hari kerja berikutnya. Jika dana belum terverifikasi saat expiry, sistem mengevaluasi ulang dan melepas reservasi yang belum picking. Barang yang sudah picking tidak dilepas otomatis dan wajib dikembalikan melalui movement terkontrol sebelum reservasi ditutup.

## 6. Backorder, tutup sisa dan pembatalan

Sisa per line dapat dipertahankan sebagai backorder, diproses saat stok masuk, atau ditutup dengan alasan. Pembatalan SO membutuhkan konfirmasi pelanggan dan tidak menghapus histori. Setelah dispatch/POD/invoice, gunakan return, credit note atau reversal yang sesuai.

## 7. Data utama

`customer_orders`, `sales_orders`, `sales_order_lines`, `order_validation_runs`, `credit_evaluations`, `unlock_requests`, `fulfillment_batches`, `fulfillment_lines`, `stock_reservations`, `proformas`, `pick_lists`, `packing_lists`, `shipments`, `delivery_receipts`, `sales_invoices`, `invoice_handoffs`, `order_remainder_actions` dan `sales_order_events`.

Snapshot wajib: pelanggan, alamat, payment policy, harga, UOM conversion, pajak, exposure evaluation, batch/locator, quantity dan rule version.

## 8. API domain

`/customer-orders`, `/sales-orders`, `/sales-orders/{id}/submit|reevaluate|cancel`, `/unlock-requests`, `/credit-evaluations`, `/fulfillment-batches`, `/proformas`, `/pick-lists`, `/packing-lists`, `/shipments`, `/delivery-receipts`, `/sales-invoices` dan `/order-remainder-actions`.

Semua command memakai version dan idempotency key. Backend menghitung total, exposure, allocation dan status; frontend tidak boleh mengirim hasil validasi sebagai kebenaran.

## 9. Hak akses

Sales/admin sales: create/update draft, submit, lihat availability dan follow-up. Unlock approver: keputusan sesuai policy. Warehouse: reserve/pick/check/pack/dispatch/POD sesuai penugasan. Finance: invoice, AR, payment, credit note dan tax. Harga modal, exposure rinci dan payroll tetap field-level restricted.

## 10. Kriteria penerimaan

1. SO memuat seluruh item pesanan termasuk stok kosong.
2. SO tanpa aturan persetujuan aktif tidak membuat approval manusia; dengan aturan aktif, persetujuan berjalan sebelum kredit dan alokasi.
3. Unlock memiliki approval, batas, masa berlaku dan audit.
4. Picking/proforma tidak memuat qty tanpa alokasi.
5. Partial fulfillment tidak menggandakan qty.
6. POD menjadi dasar invoice dan due date.
7. Backorder/close remainder per line mempertahankan ordered history.
8. Retry tidak menggandakan reservation, shipment, invoice atau jurnal.
9. Pembatalan tidak menghapus dokumen posted.

## 11. Konfigurasi wajib

Kontrak khusus waktu pengakuan, batas shelf-life, toleransi selisih POD dan daftar alasan close remainder. Kebijakan beberapa POD dalam satu invoice telah difinalkan pada Gelombang A.

## Penyerahan dokumen Office - 16 Oktober 2026

Penyerahan Proforma aktif dan tukar faktur Invoice posted dicatat dengan petugas, PIC penerima, waktu, media dan bukti privat. Riwayat disimpan sebagai audit event commercial_document.handed_over yang terikat perusahaan dan identitas dokumen. Janji bayar merupakan tindak lanjut, tidak mengubah TOP/jatuh tempo, saldo AR atau status pembayaran. Kontrak dan permission: [API](04-api.md). Struktur enam tab SO, antrean dokumen, ringkasan dan penyerahan mengikuti [cakupan Redesign Sales](../development/sales-redesign-2026-10-16.md). Penggabungan POD belum tersedia pada implementasi draft Invoice saat ini.

## Izin submenu operasional — 16 Oktober 2026

IAM-01/04: Prospek memakai `crm_prospect`, Kontak `crm_contact`, Pelanggan CRM `crm_customer`, Peluang `crm_opportunity`, Aktivitas `crm_activity`, Penawaran `crm_quote`, PO/SP `crm_customer_order`. Tindakan yang tersedia memiliki capability individual; tidak ada grant induk CRM. Proforma dan Backorder memakai izin baca sendiri. Proyeksi pelanggan CRM tetap terbatas; Master Pelanggan memakai izin terpisah. Data kontak pada detail memerlukan `crm_contact.read`. Pembuatan institusi dari Prospek juga memerlukan `crm_customer.create`. Tidak menambahkan CRUD yang belum memiliki endpoint.

## Pintu masuk Peluang dan Pelanggan — 16 Oktober 2026

CRM menampilkan Prospek, Peluang dan Kontak. Daftar Peluang perusahaan dapat dibuka dengan izin crm_opportunity.read tanpa izin Prospek. Pengguna berizin Prospek dapat membuka sumber untuk proses peluang yang sudah tersedia. Pelanggan tetap dikelola di Master Data; tautan dari prospek/kontak memeriksa izin Master Pelanggan. Sejak 23 Oktober 2026 data kontak yang sama juga tampil pada tab Kontak di Master Data › Pelanggan dengan izin `crm_contact`; kepemilikan aturan dan command kontak tetap di CRM. Tidak ada migrasi atau perubahan siklus bisnis peluang.

## O2C Release 1 (29 Oktober 2026)

### Addendum normatif Release 1

Surat Jalan dibuat langsung dari SO, mendukung pengiriman parsial kumulatif, dan saat diterbitkan mencatat bukti serah terima sekaligus event stok, pendapatan dan HPP. Invoice hanya dibuat dari Surat Jalan terbit. TOP dipilih pada SO dan disnapshot. Flow Picking/Packing List/dispatch/POD lama tetap menjadi later scope dan tidak boleh mengubah alur atau izin Release 1.

Sales Order menyimpan seluruh permintaan dan snapshot Termin/TOP yang dipilih. Penyerahan serta kuantitas yang dapat ditagih berasal dari Surat Jalan terbit.


## O2C Release 1 (29 October 2026)

Issued Surat Jalan is the handover, stock, revenue and HPP event. One SO supports cumulative Surat Jalan quantities up to ordered quantity; Invoice is created only from an issued Surat Jalan. Termin/TOP is selected on SO and snapshotted. Surat Jalan uses existing outbound permission grants; no delivery_note grants are introduced.

