import * as v from '../utils/validation.js';
import { hashPassword } from '../utils/security.js';
import { accountColumns } from '../middleware/auth.js';

// Hanya dipanggil CLI lokal milik operator, tidak dipasang sebagai route HTTP.
export async function createManager(db, input) {
  v.fields(input, ['nama', 'email', 'password', 'nomor_whatsapp']);
  const params = [v.text(input.nama, 'nama', { max: 100 }), v.email(input.email),
    v.whatsapp(input.nomor_whatsapp, true), await hashPassword(v.password(input.password))];
  const result = await db.query(`INSERT INTO akun(peran,nama,email,nomor_whatsapp,password_hash)
    VALUES('pengelola',$1,$2,$3,$4) RETURNING ${accountColumns}`, params);
  return result.rows[0];
}
