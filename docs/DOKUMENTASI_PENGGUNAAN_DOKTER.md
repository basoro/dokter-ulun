# Dokumentasi Penggunaan Aplikasi Dokter

Dokumentasi ini ditujukan untuk dokter sebagai panduan penggunaan aplikasi dalam kegiatan pelayanan sehari-hari, mulai dari login, melihat daftar pasien, membuka rekam medik, mengelola tindakan klinis, hingga memakai fitur pendukung seperti AI Asisten, notifikasi, dan pengaturan akun.

## 1. Tujuan Aplikasi

Aplikasi ini membantu dokter untuk:

- melihat daftar pasien berdasarkan unit layanan
- membuka dan meninjau rekam medik pasien
- mengisi atau memperbarui data pemeriksaan
- mengelola resep, laboratorium, radiologi, tindakan, resume, dan dokumen klinis lain
- memantau notifikasi proses klinis
- menggunakan AI Asisten untuk membantu pencarian data
- mengelola keamanan login dan preferensi pribadi

## 2. Login ke Aplikasi

### Langkah Login

1. Buka halaman login aplikasi.
2. Masukkan `username` dan `password`.
3. Klik tombol `Login`.
4. Jika verifikasi OTP diperlukan, masukkan kode OTP WhatsApp 6 digit.
5. Setelah berhasil, Anda akan masuk ke dashboard aplikasi.

### Kapan OTP Ditampilkan

Input OTP akan muncul jika salah satu kondisi berikut terpenuhi:

- OTP diwajibkan oleh server
- OTP diaktifkan dari pengaturan login pada perangkat Anda

Jika OTP tidak diwajibkan server dan tidak diaktifkan dari pengaturan pengguna, login akan langsung masuk tanpa verifikasi OTP.

### Catatan Login

- Gunakan `Ingat saya` jika ingin menyimpan sesi login pada perangkat yang digunakan.
- Jika OTP tidak masuk, gunakan tombol `Kirim Ulang OTP`.
- Jika password ingin dilihat saat mengetik, gunakan ikon tampil/sembunyikan password.

## 3. Navigasi Utama

Setelah login, dokter dapat mengakses menu utama berikut dari sidebar:

- `Dashboard`
- `Pasien`
- `AI Asisten`
- `Presensi`
- `Booking Operasi`
- `Tarif INA-CBGs`
- `Kode Medis`
- `Statistik`

Selain sidebar, bagian header menyediakan:

- pencarian rekam medis pasien
- notifikasi proses resep, laboratorium, dan radiologi
- pengaturan akun
- logout

## 4. Dashboard

Halaman dashboard menampilkan ringkasan informasi penting bagi dokter, seperti:

- statistik pelayanan
- ringkasan kunjungan
- grafik atau ringkasan aktivitas layanan
- informasi operasional yang membantu memantau beban pelayanan

Gunakan dashboard sebagai titik awal sebelum membuka daftar pasien atau fitur lainnya.

## 5. Menu Pasien

Menu `Pasien` adalah pusat utama aktivitas klinis dokter.

### Submenu Pasien

- `Booking`
- `IGD`
- `Rawat Jalan`
- `Rawat Inap`
- `Hemodialisa`

### Fungsi Umum

Pada halaman pasien, dokter dapat:

- melihat daftar pasien sesuai unit layanan
- memilih pasien untuk membuka rekam medik
- berpindah antar tab pasien sesuai konteks pelayanan
- membuka fitur lanjutan seperti Clinical Pathway atau rekam medik aktif

## 6. Rekam Medik Pasien

Rekam medik adalah area kerja utama dokter untuk meninjau dan mengelola data klinis pasien.

### Cara Membuka Rekam Medik

Rekam medik dapat dibuka dari:

- daftar pasien
- pencarian pasien pada topbar/header

### Informasi yang Umum Ditampilkan

- identitas pasien
- riwayat kunjungan
- riwayat pemeriksaan
- riwayat resep obat
- riwayat laboratorium
- riwayat radiologi
- hasil PACS atau berkas digital
- resume medis
- catatan tambahan

### Fitur Utama di Rekam Medik

Dokter dapat menggunakan rekam medik untuk:

- menambah atau memperbarui pemeriksaan
- melihat histori data klinis pasien
- menambah tindakan medis
- mengelola resep obat
- membuat permintaan laboratorium
- membuat permintaan radiologi
- melihat hasil laboratorium dan radiologi
- membuka berkas digital dan gambar PACS
- mengelola diagnosis ICD
- membuat catatan pasien
- mengisi resume pasien
- membuat rujukan internal
- mengisi laporan operasi bila diperlukan

## 7. Pemeriksaan Pasien

Pada area pemeriksaan, dokter dapat mengisi data klinis pasien sesuai kebutuhan pelayanan.

### Umumnya Digunakan Untuk

- anamnesis
- pemeriksaan fisik
- penilaian klinis
- tindak lanjut
- catatan terapi atau instruksi medis

### Catatan

- Pastikan data yang disimpan sesuai pasien dan kunjungan aktif.
- Untuk IGD, beberapa pasien dapat menampilkan bagian `Triase IGD` sebagai form terpisah.

## 8. Triase IGD

Untuk pasien IGD, aplikasi dapat menampilkan bagian `Form Triase IGD`.

### Fungsi

- melihat data triase pasien
- menyesuaikan triase bila diperlukan
- menyimpan hasil triase sebagai bagian dari kunjungan IGD

### Catatan Penting

- Form triase hanya muncul untuk kunjungan yang memang termasuk IGD.
- Tampilan warna bagian triase mengikuti level triase pasien.

## 9. Resep Obat

Menu resep di rekam medik digunakan untuk mengelola data resep dan riwayat pemberian obat.

### Yang Bisa Dilakukan

- membuat resep baru
- memperbarui resep
- menghapus resep jika diperlukan dan diizinkan
- melihat `Data Resep Obat`
- melihat `Riwayat Pemberian Obat`

### Catatan

- Sub-tab default pada riwayat resep adalah `Riwayat Pemberian Obat`.
- Nama dokter pada riwayat pemberian obat ikut ditampilkan seperti pada data resep.

## 10. Laboratorium

Dokter dapat membuat permintaan laboratorium dan meninjau hasil pemeriksaannya.

### Fungsi

- membuat permintaan laboratorium
- memperbarui permintaan laboratorium
- menghapus permintaan jika diperlukan
- meninjau hasil laboratorium yang telah selesai

### Catatan

- Pada riwayat laboratorium, sub-tab hasil menjadi fokus utama agar hasil bisa dilihat lebih cepat.

## 11. Radiologi

Dokter dapat membuat permintaan radiologi dan melihat hasil radiologi pasien.

### Fungsi

- membuat permintaan radiologi
- memperbarui permintaan radiologi
- menghapus permintaan jika diperlukan
- meninjau hasil radiologi
- membuka gambar pemeriksaan jika tersedia

### Catatan

- Pada riwayat radiologi, sub-tab hasil ditampilkan sebagai tampilan utama.
- Untuk penampil gambar PACS non-CT tersedia kontrol zoom dan download.

## 12. Berkas Digital dan PACS

Dokter dapat meninjau dokumen atau gambar pendukung pasien melalui modal penampil berkas.

### Kegunaan

- membuka file digital pasien
- melihat gambar radiologi
- memperbesar atau memperkecil tampilan
- mengunduh file bila tersedia

## 13. ICD dan Kode Medis

Fitur ini digunakan untuk membantu pencatatan diagnosis dan tindakan berbasis kode.

### Yang Tersedia

- pencarian kode diagnosis
- pencarian kode tindakan
- referensi `ICD-10`
- referensi `ICD-9-CM`
- referensi `SNOMED CT`
- referensi `LOINC`

Gunakan fitur ini saat mengisi diagnosis atau tindakan agar pencatatan lebih konsisten.

## 14. Resume Pasien

Resume pasien digunakan untuk merangkum kondisi dan penanganan pasien secara menyeluruh.

### Umumnya Berisi

- diagnosis utama dan tambahan
- ringkasan kondisi pasien
- terapi dan tindakan
- tindak lanjut
- status verifikasi resume bila diterapkan

## 15. Catatan Pasien dan Rujukan Internal

Dokter dapat menambahkan data pendukung melalui tombol aksi cepat atau menu terkait.

### Fitur Tambahan

- `Catatan Pasien`
- `Rujukan Internal`
- `Laporan Operasi`
- `Berkas Digital`

Fitur ini dipakai sesuai kebutuhan klinis masing-masing pasien.

## 16. Clinical Pathway

Clinical Pathway membantu dokter dalam pengelolaan alur pelayanan pasien sesuai pathway yang berlaku.

### Penggunaan

- inisiasi pathway untuk pasien yang sesuai
- monitoring kegiatan pathway
- memperbarui status aktivitas pathway
- memperbarui status pasien dalam pathway

### Biasanya Diakses Dari

- halaman pasien tertentu
- konteks rawat inap atau IGD sesuai alur pelayanan

## 17. AI Asisten

`AI Asisten` membantu dokter melakukan pencarian informasi secara natural menggunakan bahasa biasa.

### Contoh Penggunaan

- mencari data pasien terbaru
- meninjau riwayat kunjungan
- melihat data rawat inap
- melihat ringkasan laboratorium atau radiologi
- membantu eksplorasi data klinis yang tersedia untuk dokter

### Catatan

- Gunakan kalimat yang jelas dan spesifik agar hasil lebih relevan.
- AI Asisten bersifat pendukung, keputusan klinis tetap berada pada dokter.

## 18. Notifikasi

Notifikasi membantu dokter mengetahui perkembangan proses layanan penunjang.

### Kategori Notifikasi

- `Resep`
- `Lab`
- `Rad`

### Fungsi

- melihat item yang menunggu
- melihat item yang sedang diproses
- melihat item yang selesai
- membuka data terkait dari notifikasi

### Catatan

- Notifikasi dapat memiliki suara alert jika diaktifkan.
- Preferensi notifikasi dapat diatur dari halaman pengaturan.

## 19. Pengaturan

Halaman `Pengaturan` digunakan untuk mengelola preferensi akun dan keamanan login.

### Tab Pengaturan

- `Profil`
- `Keamanan Login`
- `Ganti Password`
- `Notifikasi`

### Yang Dapat Diatur

- profil singkat dokter
- keamanan login, termasuk OTP saat login
- ganti password
- notifikasi resep, lab, radiologi, dan suara

### Catatan OTP

- Jika toggle `OTP Saat Login` diaktifkan, login akan meminta verifikasi OTP pada perangkat tersebut.
- Jika server mewajibkan OTP, maka OTP tetap diminta walaupun toggle perangkat dimatikan.

## 20. Presensi

Halaman `Presensi` digunakan untuk aktivitas absensi dokter.

### Fitur Presensi

- melihat absensi hari ini
- melihat riwayat absensi
- melihat rekap bulanan
- melakukan proses presensi sesuai alur yang tersedia

## 21. Booking Operasi

Menu `Booking Operasi` digunakan untuk melihat atau mengelola data booking operasi sesuai kewenangan yang tersedia pada aplikasi.

Gunakan menu ini untuk meninjau kebutuhan operasi terjadwal dan data pendukungnya.

## 22. Statistik

Halaman statistik membantu dokter melihat gambaran data pelayanan.

### Jenis Statistik

- statistik kunjungan pasien
- distribusi diagnosis
- kinerja dokter
- statistik rawat jalan
- statistik rawat inap

Gunakan statistik sebagai bahan monitoring pelayanan dan evaluasi beban kerja.

## 23. Riwayat Audit

Menu `Riwayat Audit` hanya tampil untuk username dokter tertentu yang telah diizinkan oleh administrator melalui konfigurasi sistem.

### Fungsi

- melihat log aktivitas create, update, dan delete
- melakukan pencarian riwayat audit
- memfilter audit berdasarkan aksi, status, atau entitas data

Jika menu ini tidak terlihat, berarti akun Anda tidak termasuk pengguna yang diizinkan.

## 24. Tips Penggunaan Harian

- Mulailah dari `Dashboard` untuk melihat gambaran kerja hari ini.
- Gunakan `Pasien` untuk memilih pasien berdasarkan unit layanan.
- Buka `Rekam Medik` untuk bekerja pada data klinis pasien.
- Pantau `Notifikasi` untuk mengetahui progres resep, lab, dan radiologi.
- Gunakan `Pengaturan` untuk menyesuaikan keamanan login dan preferensi notifikasi.
- Gunakan `AI Asisten` untuk membantu pencarian data, bukan sebagai pengganti keputusan klinis.

## 25. Kendala Umum

### Tidak Bisa Login

- pastikan username dan password benar
- periksa apakah OTP sedang diwajibkan
- jika OTP aktif, pastikan nomor WhatsApp dokter tersedia dan benar

### OTP Tidak Muncul

- periksa pengaturan `OTP Saat Login`
- periksa apakah OTP memang diwajibkan oleh server

### OTP Tidak Diterima

- pastikan nomor WhatsApp aktif
- coba `Kirim Ulang OTP`
- hubungi admin jika masalah berulang

### Menu Tidak Muncul

Beberapa menu atau fitur dapat dibatasi berdasarkan hak akses atau konfigurasi sistem. Jika suatu menu tidak terlihat, hubungi admin aplikasi.

## 26. Penutup

Dokumentasi ini disusun sebagai panduan penggunaan aplikasi untuk dokter. Jika alur kerja di fasilitas Anda memiliki kebijakan khusus, tetap ikuti SOP klinis dan administrasi yang berlaku di institusi.
