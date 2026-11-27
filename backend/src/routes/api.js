import { Router } from 'express';
import { authenticate, role, chair, authRateLimit } from '../middleware/auth.js';
import { approvalController } from '../controllers/approval-controller.js';
import { ownershipScope } from '../middleware/ownership.js';
import { authController } from '../controllers/auth-controller.js';
import { catalogController } from '../controllers/catalog-controller.js';
import { dashboardController } from '../controllers/dashboard-controller.js';
import { scheduleController } from '../controllers/schedule-controller.js';
import { pickupController } from '../controllers/pickup-controller.js';
import { depositController } from '../controllers/deposit-controller.js';
import { ApiError } from '../utils/errors.js';

export function apiRoutes(db, config) {
  const router = Router();
  const auth = authController(db, config);
  const approval = approvalController(db);
  const catalog = catalogController(db);
  const dashboard = dashboardController(db);
  const schedule = scheduleController(db);
  const pickup = pickupController(db);
  const deposit = depositController(db);
  const loggedIn = authenticate(db);
  const manager = role('pengelola');
  const customer = role('nasabah');
  const authLimiter = authRateLimit();
  router.get('/health', async (req, res) => {
    try { await db.query('SELECT 1'); }
    catch { throw new ApiError(503, 'DATABASE_TIDAK_TERSEDIA', 'Koneksi database belum berhasil.'); }
    res.json({ status: 'ok', message: 'Backend Bank Sampah terhubung ke PostgreSQL.' });
  });
  router.post('/auth/register', authLimiter, auth.register);
  router.post('/auth/login', authLimiter, auth.login);
  router.post('/auth/logout', loggedIn, auth.logout);
  router.get('/auth/me', loggedIn, auth.me);
  router.patch('/auth/me', loggedIn, auth.updateMe);
  router.get('/pengajuan-pengelola', loggedIn, chair, approval.list);
  router.get('/pengajuan-pengelola/:id', loggedIn, chair, approval.detail);
  router.post('/pengajuan-pengelola/:id/setujui', loggedIn, chair, approval.approve);
  router.post('/pengajuan-pengelola/:id/tolak', loggedIn, chair, approval.reject);
  router.get('/jenis-sampah', catalog.list);
  router.get('/jenis-sampah/:id/harga', catalog.price);
  router.post('/harga-sampah', loggedIn, manager, catalog.addPrice);
  router.get('/layanan', catalog.services);
  router.get('/jadwal', schedule.list);
  router.get('/jadwal/:id', schedule.detail);
  router.post('/jadwal', loggedIn, manager, schedule.create);
  router.patch('/jadwal/:id', loggedIn, manager, schedule.update);
  router.get('/nasabah', loggedIn, manager, catalog.customers);
  router.get('/ringkasan', loggedIn, manager, dashboard.summary);
  router.get('/saldo', loggedIn, customer, dashboard.balance);
  // Jalur ekspor harus diletakkan sebelum /:id.
  router.get('/setoran/export.xlsx', loggedIn, manager, ownershipScope, deposit.export);
  router.get('/setoran', loggedIn, ownershipScope, deposit.list);
  router.get('/setoran/:id', loggedIn, ownershipScope, deposit.detail);
  router.post('/setoran', loggedIn, manager, deposit.create);
  router.get('/pengajuan-penjemputan', loggedIn, ownershipScope, pickup.list);
  router.get('/pengajuan-penjemputan/:id', loggedIn, ownershipScope, pickup.detail);
  router.post('/pengajuan-penjemputan', loggedIn, customer, pickup.create);
  router.post('/pengajuan-penjemputan/:id/setujui', loggedIn, manager, pickup.approve);
  router.post('/pengajuan-penjemputan/:id/tolak', loggedIn, manager, pickup.reject);
  return router;
}
