import summaryLight from '../../assets/icons/Ringkasan Light.svg'
import summaryDark from '../../assets/icons/Ringkasan dark.svg'
import depositLight from '../../assets/icons/Setoran Light.svg'
import depositDark from '../../assets/icons/Setoran Dark.svg'
import scheduleLight from '../../assets/icons/Kelola jadwal light.svg'
import scheduleDark from '../../assets/icons/Kelola jadwal dark.svg'
import historyLight from '../../assets/icons/Riwayat ligh.svg'
import historyDark from '../../assets/icons/riwayat dark.svg'
import approvalLight from '../../assets/icons/Kelola akun light.svg'
import approvalDark from '../../assets/icons/Kelola akun dark.svg'

const asset = name => new URL(`../../assets/dashboard/${name}.svg`, import.meta.url).href
export const dashboardAsset = asset
// The asset names describe the background: light for the active cream row,
// dark for the green sidebar. Both SVG variants have transparent backgrounds.
export const managerMenu = [
  { path: 'ringkasan', label: 'Ringkasan', icon: summaryDark, activeIcon: summaryLight },
  { path: 'catatan-setoran', label: 'Catat Setoran', title: 'Catatan Setoran', icon: depositDark, activeIcon: depositLight },
  { path: 'kelola-jadwal', label: 'Kelola Jadwal', icon: scheduleDark, activeIcon: scheduleLight },
  { path: 'riwayat-nasabah', label: 'Riwayat Nasabah', icon: historyDark, activeIcon: historyLight },
  { path: 'persetujuan-akun', label: 'Kelola Akun Pengelola', icon: approvalDark, activeIcon: approvalLight, chairOnly: true },
]
export const menuFor = user => managerMenu.filter(item => !item.chairOnly || (user?.peran === 'pengelola' && user.is_ketua === true && user.status_akun === 'active' && user.aktif === true))
