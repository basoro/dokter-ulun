import React from 'react';
import {
  BellRing,
  BookOpen,
  Brain,
  ClipboardList,
  FileHeart,
  FlaskConical,
  HeartPulse,
  Image,
  LogIn,
  Settings,
  ShieldCheck,
  Stethoscope
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/contexts/AuthContext';

const quickLinks = [
  { id: 'login', label: 'Login & OTP' },
  { id: 'navigasi', label: 'Navigasi Utama' },
  { id: 'pasien', label: 'Pasien & Rekam Medik' },
  { id: 'klinis', label: 'Fitur Klinis' },
  { id: 'diagnostik', label: 'Menu Lab & Rad' },
  { id: 'pendukung', label: 'Fitur Pendukung' },
  { id: 'kendala', label: 'Kendala Umum' }
];

const guideSections = [
  {
    id: 'login',
    title: 'Login dan OTP',
    description: 'Panduan masuk ke aplikasi dan memahami kapan verifikasi OTP dibutuhkan.',
    icon: LogIn,
    items: [
      'Masukkan username dan password pada halaman login, lalu tekan tombol Login.',
      'Input OTP akan muncul jika OTP diwajibkan oleh server atau diaktifkan dari pengaturan pada perangkat Anda.',
      'Jika OTP tampil, masukkan 6 digit kode yang dikirim ke WhatsApp.',
      'Gunakan tombol Kirim Ulang OTP jika kode belum diterima.',
      'Gunakan ikon tampil/sembunyikan password bila perlu memeriksa input password.'
    ]
  },
  {
    id: 'navigasi',
    title: 'Navigasi Utama',
    description: 'Struktur menu utama yang paling sering digunakan dokter saat bekerja.',
    icon: BookOpen,
    items: [
      'Dashboard digunakan untuk melihat ringkasan informasi pelayanan dan aktivitas kerja.',
      'Menu Pasien menjadi pintu masuk ke daftar pasien Booking, IGD, Rawat Jalan, Rawat Inap, dan Hemodialisa.',
      'AI Asisten membantu pencarian data secara natural dengan bahasa sehari-hari.',
      'Presensi, Booking Operasi, Tarif INA-CBGs, Kode Medis, dan Statistik tersedia dari sidebar.',
      'Header menyediakan pencarian rekam medis, notifikasi proses, pengaturan, dan logout.'
    ]
  },
  {
    id: 'pasien',
    title: 'Pasien dan Rekam Medik',
    description: 'Alur utama dokter dari memilih pasien sampai membuka area kerja rekam medik.',
    icon: Stethoscope,
    items: [
      'Pilih pasien dari menu Pasien sesuai unit layanan yang sedang dikerjakan.',
      'Buka rekam medik pasien dari daftar pasien atau melalui pencarian rekam medis di header.',
      'Gunakan rekam medik untuk meninjau identitas pasien, riwayat kunjungan, pemeriksaan, resep, laboratorium, radiologi, dan resume.',
      'Gunakan area kerja rekam medik untuk menambah atau memperbarui data klinis pasien sesuai kunjungan aktif.',
      'Untuk pasien IGD, form Triase IGD akan tampil terpisah jika kunjungan memang termasuk IGD.'
    ]
  },
  {
    id: 'klinis',
    title: 'Fitur Klinis',
    description: 'Fitur inti yang paling sering digunakan dokter dalam pelayanan klinis.',
    icon: HeartPulse,
    items: [
      'Pemeriksaan pasien digunakan untuk mengisi anamnesis, pemeriksaan fisik, penilaian, terapi, dan tindak lanjut.',
      'Resep Obat digunakan untuk membuat, memperbarui, dan meninjau riwayat pemberian obat.',
      'Laboratorium dan Radiologi digunakan untuk membuat permintaan pemeriksaan dan meninjau hasil yang sudah selesai.',
      'ICD dan Kode Medis membantu pencatatan diagnosis dan tindakan berbasis referensi kode.',
      'Resume Pasien, Catatan Pasien, Rujukan Internal, dan Laporan Operasi tersedia sesuai kebutuhan klinis.'
    ]
  },
  {
    id: 'diagnostik',
    title: 'Menu Laboratorium dan Radiologi',
    description: 'Panduan memakai menu baru Laboratorium dan Radiologi dari sidebar untuk meninjau hasil pemeriksaan penunjang.',
    icon: FlaskConical,
    items: [
      'Menu Laboratorium dan Radiologi hanya tampil jika username login Anda diberi akses oleh administrator melalui konfigurasi sistem.',
      'Buka menu Laboratorium atau Radiologi dari sidebar untuk melihat daftar pasien berdasarkan rentang tanggal dan kata kunci pencarian.',
      'Klik seluruh baris pasien pada tabel untuk membuka detail pasien melalui panel dari sisi kanan layar.',
      'Pada Laboratorium, hasil pemeriksaan ditampilkan dalam kelompok template layanan agar lebih mudah dibaca per panel pemeriksaan.',
      'Baris hasil laboratorium dengan keterangan H atau L diberi warna penanda agar nilai tinggi dan rendah cepat dikenali.',
      'Pada Laboratorium, dokter dapat meninjau lampiran hasil lalu mengisi Kesan dan Saran pada form yang tersedia.',
      'Pada Radiologi, dokter dapat meninjau hasil, kesan, saran, serta melihat thumbnail gambar atau PACS dari panel detail pasien.',
      'Klik thumbnail gambar untuk membuka modal viewer sederhana dengan preview besar, zoom, pindah gambar, dan download.'
    ]
  },
  {
    id: 'pendukung',
    title: 'Fitur Pendukung',
    description: 'Fitur tambahan yang membantu efisiensi kerja dokter di aplikasi.',
    icon: Brain,
    items: [
      'AI Asisten dapat digunakan untuk menanyakan data pasien, kunjungan, hasil pemeriksaan, dan informasi klinis lain yang tersedia.',
      'Notifikasi membantu memantau proses resep, laboratorium, dan radiologi yang menunggu, diproses, atau selesai.',
      'Berkas Digital dan PACS digunakan untuk membuka file pendukung, melihat gambar, zoom, dan download jika tersedia.',
      'Pengaturan digunakan untuk melihat profil dokter, mengubah password, mengatur notifikasi, dan keamanan login.',
      'Riwayat Audit hanya tampil untuk username yang diberi akses oleh administrator.'
    ]
  }
];

const featureHighlights = [
  {
    title: 'Resep, Lab, dan Radiologi',
    description: 'Dokter dapat membuat permintaan, memantau progres, meninjau hasil dari rekam medik, serta membuka menu Lab dan Rad khusus bila memiliki akses.',
    icon: FlaskConical
  },
  {
    title: 'Resume dan Clinical Pathway',
    description: 'Gunakan resume pasien dan pathway untuk dokumentasi serta monitoring penanganan pasien secara terstruktur.',
    icon: ClipboardList
  },
  {
    title: 'Berkas Digital dan PACS',
    description: 'Gambar dan dokumen pendukung pasien dapat dibuka langsung dari aplikasi untuk menunjang penilaian klinis.',
    icon: Image
  },
  {
    title: 'Pengaturan Akun',
    description: 'Atur OTP login, ganti password, dan preferensi notifikasi sesuai kebutuhan penggunaan harian.',
    icon: ShieldCheck
  }
];

const troubleshootingItems = [
  {
    title: 'Tidak bisa login',
    description: 'Pastikan username dan password benar. Jika OTP diwajibkan, selesaikan verifikasi OTP sebelum masuk.'
  },
  {
    title: 'OTP tidak muncul',
    description: 'Cek apakah OTP sedang diwajibkan server atau diaktifkan dari pengaturan perangkat Anda.'
  },
  {
    title: 'OTP tidak diterima',
    description: 'Pastikan nomor WhatsApp aktif dan benar, lalu gunakan tombol Kirim Ulang OTP jika diperlukan.'
  },
  {
    title: 'Menu tertentu tidak terlihat',
    description: 'Beberapa menu bergantung pada hak akses akun atau konfigurasi sistem. Hubungi admin jika menu yang dibutuhkan tidak muncul.'
  }
];

const Panduan: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-2 md:p-6 animate-fade-in">
      <Card className="overflow-hidden border-primary/10">
        <CardHeader className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <BookOpen className="h-6 w-6 text-primary" />
                Panduan Penggunaan Dokter
              </CardTitle>
              <CardDescription className="max-w-3xl text-sm md:text-base">
                Panduan ini membantu dokter memahami alur penggunaan aplikasi, mulai dari login,
                membuka rekam medik, mengelola data klinis, hingga memakai fitur pendukung.
              </CardDescription>
            </div>
            <div className="rounded-lg border bg-white/80 px-4 py-3 text-sm shadow-sm">
              <p className="text-muted-foreground">Login sebagai</p>
              <p className="font-semibold text-foreground">{user?.name || user?.username || 'Dokter'}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 p-6">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {featureHighlights.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="rounded-xl border bg-background/80 p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <p className="font-medium">{feature.title}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <BellRing className="h-5 w-5 text-primary" />
            Navigasi Cepat
          </CardTitle>
          <CardDescription>Pilih bagian panduan yang ingin dibaca lebih dulu.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {quickLinks.map((link) => (
              <a
                key={link.id}
                href={`#${link.id}`}
                className="rounded-full border bg-muted/40 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                {link.label}
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-6">
          {guideSections.map((section) => {
            const Icon = section.icon;
            return (
              <Card key={section.id} id={section.id} className="scroll-mt-24">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <Icon className="h-5 w-5 text-primary" />
                    {section.title}
                  </CardTitle>
                  <CardDescription>{section.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {section.items.map((item) => (
                      <div key={item} className="flex gap-3 rounded-lg border bg-muted/20 p-4">
                        <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
                        <p className="text-sm leading-6 text-foreground">{item}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <Card id="kendala" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Settings className="h-5 w-5 text-primary" />
                Kendala Umum
              </CardTitle>
              <CardDescription>Beberapa masalah yang sering ditemui saat penggunaan aplikasi.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {troubleshootingItems.map((item, index) => (
                <React.Fragment key={item.title}>
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                  {index < troubleshootingItems.length - 1 ? <Separator /> : null}
                </React.Fragment>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="xl:sticky xl:top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileHeart className="h-5 w-5 text-primary" />
                Ringkasan Harian
              </CardTitle>
              <CardDescription>Alur singkat yang umum dipakai dokter saat bekerja.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                'Login ke aplikasi dan selesaikan OTP bila diminta.',
                'Buka Dashboard untuk melihat ringkasan pelayanan.',
                'Masuk ke menu Pasien dan pilih unit layanan yang sedang ditangani.',
                'Buka rekam medik pasien untuk meninjau riwayat dan mengisi data klinis.',
                'Jika memiliki hak akses, gunakan menu Laboratorium atau Radiologi untuk melihat daftar pasien penunjang secara khusus.',
                'Pantau notifikasi resep, lab, dan radiologi untuk tindak lanjut cepat.',
                'Gunakan Pengaturan untuk keamanan akun dan preferensi penggunaan.'
              ].map((item, index) => (
                <div key={item} className="flex gap-3 rounded-lg border p-3">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Panduan;
