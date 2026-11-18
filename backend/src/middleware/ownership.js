// Dipakai dalam WHERE daftar maupun rincian, sehingga ID milik orang lain menghasilkan 404.
export function ownershipScope(req, res, next) {
  req.nasabahScope = req.user.peran === 'nasabah' ? req.user.id : null;
  next();
}
