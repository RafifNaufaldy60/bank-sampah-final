import * as v from '../utils/validation.js';
import { ensure } from '../utils/errors.js';
import { loginAccount } from '../services/login-service.js';
import { accountColumns } from '../middleware/auth.js';
import { registerAccount } from '../services/account-service.js';

export function authController(db, config) {
  return {
    register: async (req, res) => {
      res.status(201).json({ data: await registerAccount(db, req.body) });
    },
    login: async (req, res) => {
      const body = v.fields(req.body, ['email', 'password', 'peran']);
      const email = v.email(body.email);
      // Peran yang dipilih pada UI hanyalah konteks login, bukan sumber hak akses.
      // Optional agar klien lama (email + password) tetap kompatibel.
      const peran = body.peran === undefined ? undefined : v.choice(body.peran, ['nasabah', 'pengelola'], 'peran');
      // Sandi salah yang pendek tetap respons autentikasi generik; aturan panjang baru berlaku saat membuat sandi.
      ensure(typeof body.password === 'string' && body.password.trim().length > 0 && body.password.length <= 128, 400, 'VALIDASI_GAGAL', 'Password wajib diisi, maksimal 128 karakter.');
      const password = body.password;
      res.json({ data: await loginAccount(db, { email, password, peran }, config, config.authClock) });
    },
    logout: async (req, res) => {
      await db.query('DELETE FROM sesi_login WHERE token_hash=$1', [req.tokenHash]);
      res.json({ data: { message: 'Logout berhasil.' } });
    },
    me: (req, res) => res.json({ data: req.user }),
    updateMe: async (req, res) => {
      const body = v.fields(req.body, ['nama', 'nomor_whatsapp']);
      ensure(Object.keys(body).length > 0, 400, 'VALIDASI_GAGAL', 'Isi profil yang hendak diubah.');
      const params = [];
      const changes = [];
      if (Object.hasOwn(body, 'nama')) { params.push(v.text(body.nama, 'nama', { max: 100 })); changes.push(`nama=$${params.length}`); }
      if (Object.hasOwn(body, 'nomor_whatsapp')) { params.push(v.whatsapp(body.nomor_whatsapp, true)); changes.push(`nomor_whatsapp=$${params.length}`); }
      params.push(req.user.id);
      const result = await db.query(`UPDATE akun SET ${changes.join(',')} WHERE id=$${params.length}
        AND aktif AND status_akun='active' RETURNING ${accountColumns}`, params);
      ensure(result.rows[0], 401, 'SESI_TIDAK_VALID', 'Akun tidak aktif.');
      res.json({ data: result.rows[0] });
    },
  };
}
