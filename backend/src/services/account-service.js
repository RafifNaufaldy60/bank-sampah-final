import * as v from '../utils/validation.js';
import { hashPassword } from '../utils/security.js';
import { accountColumns } from '../middleware/auth.js';

export async function registerAccount(db, input) {
  v.fields(input, ['nama', 'email', 'password', 'nomor_whatsapp', 'peran']);
  const peran = v.choice(input.peran === undefined ? 'nasabah' : input.peran, ['nasabah', 'pengelola'], 'peran');
  const params = [v.text(input.nama, 'nama', { max: 100 }), v.email(input.email),
    v.whatsapp(input.nomor_whatsapp, true), await hashPassword(v.password(input.password)),
    peran, peran === 'nasabah' ? 'active' : 'pending'];
  const result = await db.query(`INSERT INTO akun(peran,nama,email,nomor_whatsapp,password_hash,is_ketua,status_akun)
    VALUES($5,$1,$2,$3,$4,false,$6) RETURNING ${accountColumns}`, params);
  return result.rows[0];
}

// CLI lama mengikuti persetujuan yang sama dengan registrasi publik.
export async function createManager(db, input) {
  v.fields(input, ['nama', 'email', 'password', 'nomor_whatsapp']);
  return registerAccount(db, { ...input, peran: 'pengelola' });
}
