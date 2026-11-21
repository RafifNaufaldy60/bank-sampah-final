import * as v from '../utils/validation.js';
import { ensure } from '../utils/errors.js';
import { verifyPassword, newToken, digest } from '../utils/security.js';
import { accountColumns } from '../middleware/auth.js';
import { registerAccount } from '../services/account-service.js';

export function authController(db, config) {
  return {
    register: async (req, res) => {
      res.status(201).json({ data: await registerAccount(db, req.body) });
    },
    login: async (req, res) => {
      const body = v.fields(req.body, ['email', 'password']);
      const email = v.email(body.email);
      // Sandi salah yang pendek tetap respons autentikasi generik; aturan panjang baru berlaku saat membuat sandi.
      ensure(typeof body.password === 'string' && body.password.length <= 128, 400, 'VALIDASI_GAGAL', 'Password harus string maksimal 128 karakter.');
      const password = body.password;
      const account = (await db.query(`SELECT ${accountColumns}, password_hash FROM akun WHERE lower(email)=$1`, [email])).rows[0];
      const valid = await verifyPassword(password, account?.password_hash);
      ensure(valid, 401, 'LOGIN_GAGAL', 'Email atau kata sandi salah, atau akun tidak aktif.');
      ensure(account.status_akun !== 'pending', 403, 'ACCOUNT_PENDING', 'Pendaftaran menunggu persetujuan ketua.');
      ensure(account.status_akun !== 'ditolak', 403, 'ACCOUNT_REJECTED', 'Pendaftaran ditolak.');
      ensure(account.aktif && account.status_akun === 'active', 401, 'LOGIN_GAGAL', 'Email atau kata sandi salah, atau akun tidak aktif.');
      delete account.password_hash;
      const token = newToken();
      const session = await db.transaction(async client => {
        // Kunci akun agar perubahan status tidak berlomba dengan penerbitan sesi.
        const current = (await client.query('SELECT aktif,status_akun FROM akun WHERE id=$1 FOR SHARE', [account.id])).rows[0];
        ensure(current?.aktif && current.status_akun === 'active', 401, 'LOGIN_GAGAL', 'Email atau kata sandi salah, atau akun tidak aktif.');
        await client.query('DELETE FROM sesi_login WHERE kedaluwarsa_pada <= now()');
        return (await client.query(`INSERT INTO sesi_login(token_hash,akun_id,kedaluwarsa_pada)
          VALUES($1,$2,now()+$3*interval '1 hour') RETURNING kedaluwarsa_pada`, [digest(token), account.id, config.sessionHours])).rows[0];
      });
      res.json({ data: { akun: account, token, token_type: 'Bearer', expires_at: session.kedaluwarsa_pada } });
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
