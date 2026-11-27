import { Link, Navigate } from 'react-router-dom'
import RootLayout from '../layouts/RootLayout'
import ProtectedRoute from '../components/ProtectedRoute'
import GuestRoute from '../components/GuestRoute'
import HomePage from '../pages/HomePage'
import Login from '../pages/Login'
import Register from '../pages/Register'
import AccountHome from '../pages/AccountHome'
import PengelolaLayout from '../layouts/PengelolaLayout'
import RingkasanPage from '../pages/pengelola/RingkasanPage'
import PlaceholderPage from '../pages/pengelola/PlaceholderPage'
import RouteError from '../components/pengelola/RouteError'
import { InitialFallback } from '../components/pengelola/SummarySkeleton'
import { managerMenu } from '../components/pengelola/navigation'
import { createSessionLoaders } from './session'
import ChairGuard from '../components/pengelola/ChairGuard'
import KelolaAkunPage from '../pages/pengelola/KelolaAkunPage'
import { createApprovalRoutes } from './approvals'
import { createHistoryRoutes } from './history'
import RiwayatNasabahPage from '../pages/pengelola/RiwayatNasabahPage'
import KelolaJadwalPage from '../pages/pengelola/KelolaJadwalPage'
import { createScheduleRoutes } from './schedules'

export function createAppRoutes(store) {
  const loaders = createSessionLoaders(store)
  const approvals = createApprovalRoutes(store, loaders)
  const history = createHistoryRoutes(store, loaders)
  const schedules = createScheduleRoutes(store, loaders)
  return [{
    element: <RootLayout />, loader: loaders.bootstrap, HydrateFallback: InitialFallback, errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { element: <GuestRoute />, children: [{ path: 'login', element: <Login /> }, { path: 'register', element: <Register /> }] },
      { element: <ProtectedRoute />, children: [{ path: 'akun', element: <AccountHome /> }] },
      { path: 'pengelola', loader: loaders.manager, element: <PengelolaLayout />, errorElement: <RouteError />, children: [
        { index: true, element: <Navigate to="ringkasan" replace /> },
        { path: 'ringkasan', loader: loaders.summary, element: <RingkasanPage />, errorElement: <RouteError /> },
        { path: 'riwayat-nasabah', loader: history.loader, element: <RiwayatNasabahPage />, errorElement: <RouteError /> },
        ...['kelola-jadwal', 'kelola-jadwal/tambah', 'kelola-jadwal/:id/edit'].map((path, index) => ({
          path, loader: schedules.loader, action: schedules.action, element: <KelolaJadwalPage form={index > 0} />, errorElement: <RouteError />,
        })),
        { path: 'kelola-jadwal/pengajuan-penjemputan', loader: loaders.manager, element: <PlaceholderPage title="Pengajuan Penjemputan" />, errorElement: <RouteError /> },
        { path: 'persetujuan-akun', loader: approvals.loader, action: approvals.action, element: <ChairGuard><KelolaAkunPage /></ChairGuard>, errorElement: <RouteError /> },
        ...managerMenu.filter(item => !['ringkasan', 'riwayat-nasabah', 'kelola-jadwal'].includes(item.path) && !item.chairOnly).map(item => ({
          path: item.path, loader: loaders.manager,
          element: <PlaceholderPage title={item.title || item.label} />, errorElement: <RouteError />,
        })),
      ] },
      { path: '*', element: <main className="session-screen"><h1>Halaman tidak ditemukan</h1><Link to="/">Kembali ke Beranda</Link></main> },
    ],
  }]
}
