import * as v from '../utils/validation.js';
import { ensure } from '../utils/errors.js';
import { hashPassword } from '../utils/security.js';
import { accountColumns } from '../middleware/auth.js';

// Input pemilik menyebut dua email dan mode secara eksplisit. Tidak dipasang ke HTTP.
export async function bootstrapChairs(db, input) {
  ensure(Array.isArray(input) && input.length === 2, 400, 'BOOTSTRAP_INVALID', 'Bootstrap harus berisi tepat dua akun.');
  const entries = input.map(entry => {
    v.fields(entry, ['email', 'mode', 'nama', 'password', 'nomor_whatsapp']);
    const mode = v.choice(entry.mode, ['create', 'existing'], 'mode');
    const result = { email: v.email(entry.email), mode };
    if (mode === 'create') {
      result.nama = v.text(entry.nama, 'nama', { max: 100 });
      result.password = v.password(entry.password);
      result.whatsapp = v.whatsapp(entry.nomor_whatsapp, true);
    } else {
      v.fields(entry, ['email', 'mode']);
    }
    return result;
  });
  ensure(entries[0].email !== entries[1].email, 400, 'BOOTSTRAP_INVALID', 'Dua email ketua harus berbeda.');
  return db.transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended(current_schema() || ':bootstrap-ketua',0))");
    // Hanya proses bootstrap operator: serialisasi terhadap perubahan akun bersamaan.
    await client.query('LOCK TABLE akun IN SHARE ROW EXCLUSIVE MODE');
    const others = (await client.query('SELECT id FROM akun WHERE is_ketua AND lower(email) <> ALL($1::text[])', [entries.map(e => e.email)])).rows;
    ensure(!others.length, 409, 'BOOTSTRAP_CONFLICT', 'Sudah ada ketua di luar dua email pilihan; bootstrap dibatalkan.');
    const accounts = [];
    for (const entry of entries) {
      let account = (await client.query(`SELECT ${accountColumns} FROM akun WHERE lower(email)=$1 FOR UPDATE`, [entry.email])).rows[0];
      if (account) {
        ensure(account.peran === 'pengelola' && account.aktif && account.status_akun === 'active',
          409, 'BOOTSTRAP_CONFLICT', 'Email existing harus pengelola aktif yang sudah disetujui; nasabah/pending/nonaktif tidak dipromosikan.');
        ensure(entry.mode === 'existing' || account.is_ketua, 409, 'BOOTSTRAP_CONFLICT', 'Email sudah ada; pilih mode existing secara eksplisit.');
        account = (await client.query(`UPDATE akun SET is_ketua=true WHERE id=$1 RETURNING ${accountColumns}`, [account.id])).rows[0];
      } else {
        ensure(entry.mode === 'create', 409, 'BOOTSTRAP_CONFLICT', 'Akun mode existing tidak ditemukan.');
        account = (await client.query(`INSERT INTO akun(peran,nama,email,nomor_whatsapp,password_hash,is_ketua,status_akun)
          VALUES('pengelola',$1,$2,$3,$4,true,'active') RETURNING ${accountColumns}`,
        [entry.nama, entry.email, entry.whatsapp, await hashPassword(entry.password)])).rows[0];
      }
      accounts.push(account);
    }
    return accounts;
  });
}
