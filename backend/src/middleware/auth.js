import { digest } from '../utils/security.js';
import { ensure } from '../utils/errors.js';

export const accountColumns = 'id, kode_akun, nama, email, nomor_whatsapp, peran, aktif';

export function authenticate(db) {
  return async (req, res, next) => {
    const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.get('Authorization') || '');
    ensure(match, 401, 'BELUM_LOGIN', 'Silakan login terlebih dahulu.');
    req.tokenHash = digest(match[1]);
    const { rows } = await db.query(`SELECT a.id, a.kode_akun, a.nama, a.email, a.nomor_whatsapp, a.peran, a.aktif
      FROM sesi_login s JOIN akun a ON a.id = s.akun_id
      WHERE s.token_hash = $1 AND s.kedaluwarsa_pada > now() AND a.aktif`, [req.tokenHash]);
    ensure(rows[0], 401, 'SESI_TIDAK_VALID', 'Sesi tidak valid atau telah kedaluwarsa.');
    req.user = rows[0];
    next();
  };
}
export const role = (...allowed) => (req, res, next) => {
  ensure(allowed.includes(req.user.peran), 403, 'AKSES_DITOLAK', 'Peran akun tidak memiliki akses.');
  next();
};

// Pembatas sederhana untuk satu proses MVP; tidak menyimpan email atau sandi.
export function authRateLimit({ max = 30, windowMs = 15 * 60 * 1000 } = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    let entry = attempts.get(req.ip);
    if (!entry) {
      ensure(attempts.size < 10000, 429, 'TERLALU_BANYAK_PERMINTAAN', 'Silakan coba beberapa saat lagi.');
      entry = { count: 0, until: now + windowMs };
      attempts.set(req.ip, entry);
    }
    entry.count += 1;
    if (entry.count > max) res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000)));
    ensure(entry.count <= max, 429, 'TERLALU_BANYAK_PERMINTAAN', 'Terlalu banyak percobaan. Coba kembali setelah 15 menit.');
    next();
  };
}
