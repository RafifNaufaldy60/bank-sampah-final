import * as v from '../utils/validation.js';
import { ensure } from '../utils/errors.js';
import { hashPassword, verifyPassword, newToken, digest } from '../utils/security.js';
import { accountColumns } from '../middleware/auth.js';

export function authController(db, config) {
  return {
    register: async (req, res) => {
      const body = v.fields(req.body, ['nama', 'email', 'password', 'nomor_whatsapp']);
      const nama = v.text(body.nama, 'nama', { max: 100 });
      const email = v.email(body.email);
      const whatsapp = v.whatsapp(body.nomor_whatsapp, true);
      const hash = await hashPassword(v.password(body.password));
      const { rows } = await db.query(`INSERT INTO akun(peran,nama,email,nomor_whatsapp,password_hash)
        VALUES('nasabah',$1,$2,$3,$4) RETURNING ${accountColumns}`, [nama, email, whatsapp, hash]);
      res.status(201).json({ data: rows[0] });
    },
    login: async (req, res) => {
      const body = v.fields(req.body, ['email', 'password']);
      const email = v.email(body.email);
      const password = v.password(body.password);
      const account = (await db.query(`SELECT ${accountColumns}, password_hash FROM akun WHERE lower(email)=$1`, [email])).rows[0];
      const valid = await verifyPassword(password, account?.password_hash);
      ensure(valid && account.aktif, 401, 'LOGIN_GAGAL', 'Email atau kata sandi salah, atau akun tidak aktif.');
      delete account.password_hash;
      const token = newToken();
      const session = await db.transaction(async client => {
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
  };
}
