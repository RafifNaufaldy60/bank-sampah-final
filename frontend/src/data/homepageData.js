import iconNasabah from '../assets/icons/Group nasabah.svg'
import iconBerat from '../assets/icons/Group berat sampah.svg'
import iconUang from '../assets/icons/akar-icons_money.svg'
import iconHarga from '../assets/icons/Material=Botol Plastik PET.svg'
import iconJadwal from '../assets/icons/Icon jadwal.svg'
import iconSetoran from '../assets/icons/Group setoran.svg'
import stepPilah from '../assets/icons/Group langkah1.svg'
import stepBersih from '../assets/icons/Group botol2.svg'
import stepSetor from '../assets/icons/Group langkah 3.svg'
import stepPantau from '../assets/icons/Group langkah 4.svg'
import facebook from '../assets/icons/Facebook.svg'
import instagram from '../assets/icons/Instagram.svg'
import twitter from '../assets/icons/Twitter.svg'
import youtube from '../assets/icons/YouTube.svg'
import linkedin from '../assets/icons/LinkedIn.svg'

export const headerNavigation = [
  { label: 'Beranda', href: '#beranda', active: true },
  { label: 'Info Harga', href: '#info-harga' },
  { label: 'Jadwal Layanan', href: '#cara-kerja' },
  { label: 'Saldo & Riwayat', href: '/login' },
]

export const headerActions = [
  { label: 'Masuk', href: '/login', variant: 'outline' },
  { label: 'Daftar Sekarang', href: '/register', variant: 'primary' },
]

export const heroContent = {
  eyebrow: 'Setoran kecil, dampak besar',
  title: 'Sampah terpilah,',
  highlightedTitle: 'masa depan terjaga.',
  description: 'Ketahui nilai sampahmu, cek jadwal layanan, dan pantau setiap setoran secara transparan dalam satu tempat.',
  actions: [
    { label: 'Lihat harga sampah', href: '#info-harga', variant: 'primary', showArrow: true },
    { label: 'Cek jadwal layanan', href: '#cara-kerja', variant: 'outline' },
  ],
  benefits: ['Harga diperbarui', 'Riwayat transparan', 'Jadwal teratur'],
  impact: { label: 'DAMPAK BERSAMA', value: '2.480 kg terselamatkan' },
  activeCustomers: { label: 'Nasabah aktif', value: '1.248' },
}

export const stats = [
  { value: '1.248', label: 'Nasabah terdaftar', icon: iconNasabah },
  { value: '12,8 ton', label: 'Sampah terkumpul', icon: iconBerat },
  { value: 'Rp 26,4 jt', label: 'Nilai setoran warga', icon: iconUang },
]

export const featuresHeading = {
  eyebrow: 'MULAI DARI SINI',
  titleLine1: 'Semua kebutuhan setoranmu,',
  titleLine2: 'dalam satu tempat.',
  description: 'Informasi yang jelas membantu kamu memilah dengan tepat dan menyetor tanpa ragu.',
}

export const featureCards = [
  {
    number: '01',
    title: 'Kenali jenis & harganya',
    description: 'Cari sampah yang diterima, harga per kilogram, dan cara menyiapkannya.',
    icon: iconHarga,
    href: '#info-harga',
  },
  {
    number: '02',
    title: 'Sesuaikan jadwalmu',
    description: 'Lihat waktu penyetoran, penimbangan, dan ketersediaan layanan.',
    icon: iconJadwal,
    href: '#cara-kerja',
  },
  {
    number: '03',
    title: 'Pantau hasil setoran',
    description: 'Saldo dan rincian transaksi tersimpan rapi dan mudah ditelusuri.',
    icon: iconSetoran,
    href: '/login',
  },
]

export const howItWorksContent = {
  eyebrow: 'CARA KERJA',
  titleLine1: 'Dari rumah,',
  titleLine2: 'jadi rupiah.',
  description: 'Empat langkah sederhana agar sampah rumah tangga kembali punya nilai.',
  buttonLabel: 'Baca panduan lengkap',
}

export const steps = [
  { number: '01', title: 'Pilah', description: 'Pisahkan sampah sesuai jenisnya.', icon: stepPilah },
  { number: '02', title: 'Bersihkan', description: 'Pastikan kering dan bebas sisa makanan.', icon: stepBersih },
  { number: '03', title: 'Setorkan', description: 'Datang sesuai jadwal layanan.', icon: stepSetor },
  { number: '04', title: 'Pantau', description: 'Cek hasil dan saldo di akunmu.', icon: stepPantau },
]

export const footerContent = {
  description: 'Bank Sampah Desa yang membantu warga mengubah sampah terpilah menjadi nilai dan lingkungan yang lebih lestari.',
  socialLinks: [
    { label: 'Facebook', href: '#', icon: facebook },
    { label: 'Instagram', href: '#', icon: instagram },
    { label: 'Twitter', href: '#', icon: twitter },
    { label: 'YouTube', href: '#', icon: youtube },
    { label: 'LinkedIn', href: '#', icon: linkedin },
  ],
  serviceLinks: headerNavigation,
  address: 'Jl. Melati No. 18, Kelurahan Mojoroto',
  openingHours: 'Senin-Sabtu, 08:00-15:00 WIB',
  copyright: 'Copyright © 2026 Bank Sampah Desa RahayuLestari | All Rights Reserved | Terms and Conditions | Privacy Policy',
}
