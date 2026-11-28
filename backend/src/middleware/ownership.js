import { ensure } from '../utils/errors.js';

// Dipakai dalam WHERE daftar maupun rincian, sehingga ID milik orang lain menghasilkan 404.
export function ownershipScope(req, res, next) {
  ensure(req.user.peran === 'pengelola' || (req.user.peran === 'nasabah' && req.user.id != null),
    403, 'AKSES_DITOLAK', 'Akses ditolak.');
  req.nasabahScope = req.user.peran === 'nasabah' ? req.user.id : null;
  next();
}
