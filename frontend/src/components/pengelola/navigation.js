const asset = name => new URL(`../../assets/dashboard/${name}.svg`, import.meta.url).href
export const dashboardAsset = asset
export const managerMenu = [
  { path: 'ringkasan', label: 'Ringkasan', icon: 'summary' },
  { path: 'catatan-setoran', label: 'Catat Setoran', title: 'Catatan Setoran', icon: 'deposit' },
  { path: 'kelola-jadwal', label: 'Kelola Jadwal', icon: 'schedule' },
  { path: 'riwayat-nasabah', label: 'Riwayat Nasabah', icon: 'history' },
  { path: 'persetujuan-akun', label: 'Kelola Akun Pengelola', icon: 'approval', chairOnly: true },
]
export const menuFor = user => managerMenu.filter(item => !item.chairOnly || (user?.peran === 'pengelola' && user.is_ketua === true && user.status_akun === 'active' && user.aktif === true))
