import { accountColumns } from '../middleware/auth.js';
import { ApiError } from '../utils/errors.js';
import { verifyPassword, newToken, digest } from '../utils/security.js';

const invalid = () => new ApiError(401, 'LOGIN_GAGAL', 'Email atau kata sandi salah, atau akun tidak aktif.');
const serverClock = async client => new Date((await client.query('SELECT clock_timestamp() AS time')).rows[0].time);
function locked(until, now) {
  const error = new ApiError(429, 'LOGIN_LOCKED', 'Terlalu banyak percobaan login yang gagal. Silakan coba lagi nanti.');
  error.details = { locked_until: new Date(until).toISOString(), retry_after_seconds: Math.max(1, Math.ceil((new Date(until) - now) / 1000)) };
  return error;
}

// Row lock serializes verification, counters, status checks and session issuance across processes.
// Return expected errors from the transaction so failed-attempt updates COMMIT before throwing.
// Clock injection is for isolated tests only; production always uses the database clock.
export async function loginAccount(db, { email, password }, config, clock = serverClock) {
  const result = await db.transaction(async client => {
    const account = (await client.query(`SELECT ${accountColumns}, password_hash, login_failed_attempts, login_locked_until
      FROM akun WHERE lower(email)=$1 FOR UPDATE`, [email])).rows[0];
    if (!account) { await verifyPassword(password); return invalid(); }
    const now = await clock(client);
    if (account.login_locked_until && new Date(account.login_locked_until) > now) return locked(account.login_locked_until, now);
    const attempts = account.login_locked_until ? 0 : account.login_failed_attempts;
    if (!await verifyPassword(password, account.password_hash)) {
      const count = attempts + 1;
      const timestamp = await clock(client);
      const until = count === 5 ? new Date(timestamp.getTime() + 15 * 60 * 1000) : null;
      await client.query('UPDATE akun SET login_failed_attempts=$2, login_locked_until=$3 WHERE id=$1', [account.id, count, until]);
      return until ? locked(until, timestamp) : invalid();
    }
    await client.query('UPDATE akun SET login_failed_attempts=0, login_locked_until=NULL WHERE id=$1', [account.id]);
    if (account.status_akun === 'pending') return new ApiError(403, 'ACCOUNT_PENDING', 'Pendaftaran menunggu persetujuan ketua.');
    if (account.status_akun === 'ditolak') return new ApiError(403, 'ACCOUNT_REJECTED', 'Pendaftaran ditolak.');
    if (!account.aktif || account.status_akun !== 'active') return invalid();
    delete account.password_hash;
    delete account.login_failed_attempts;
    delete account.login_locked_until;
    const token = newToken();
    await client.query('DELETE FROM sesi_login WHERE kedaluwarsa_pada <= now()');
    const session = (await client.query(`INSERT INTO sesi_login(token_hash,akun_id,kedaluwarsa_pada)
      VALUES($1,$2,now()+$3*interval '1 hour') RETURNING kedaluwarsa_pada`, [digest(token), account.id, config.sessionHours])).rows[0];
    return { akun: account, token, token_type: 'Bearer', expires_at: session.kedaluwarsa_pada };
  });
  if (result instanceof ApiError) throw result;
  return result;
}
