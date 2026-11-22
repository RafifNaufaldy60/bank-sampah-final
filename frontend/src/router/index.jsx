import { Link, Route, Routes } from 'react-router-dom'
import RootLayout from '../layouts/RootLayout'
import ProtectedRoute from '../components/ProtectedRoute'
import GuestRoute from '../components/GuestRoute'
import HomePage from '../pages/HomePage'
import Login from '../pages/Login'
import Register from '../pages/Register'
import AccountHome from '../pages/AccountHome'

export default function AppRoutes() {
  return <Routes><Route element={<RootLayout />}>
    <Route index element={<HomePage />} />
    <Route element={<GuestRoute />}><Route path="login" element={<Login />} /><Route path="register" element={<Register />} /></Route>
    <Route element={<ProtectedRoute />}><Route path="akun" element={<AccountHome />} /></Route>
    <Route path="*" element={<main className="session-screen"><h1>Halaman tidak ditemukan</h1><Link to="/">Kembali ke Beranda</Link></main>} />
  </Route></Routes>
}
