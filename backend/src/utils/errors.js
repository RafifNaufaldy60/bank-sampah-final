export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function ensure(condition, status, code, message) {
  if (!condition) throw new ApiError(status, code, message);
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);
  let status = error instanceof ApiError ? error.status : 500;
  let code = error instanceof ApiError ? error.code : 'INTERNAL_ERROR';
  let message = error instanceof ApiError ? error.message : 'Terjadi kesalahan pada server.';
  const mappings = {
    '23505': [409, 'DATA_DUPLIKAT', 'Data atau kunci permintaan sudah digunakan.'],
    '23503': [422, 'REFERENSI_TIDAK_VALID', 'Data yang dirujuk tidak tersedia atau tidak sesuai.'],
    '23514': [422, 'DATA_TIDAK_VALID', 'Data tidak memenuhi aturan database.'],
    'P0001': [422, 'SETORAN_TIDAK_VALID', 'Periksa akun aktif, tanggal, jenis sampah, berat, dan ketersediaan tarif.'],
    '55P03': [409, 'DATA_SEDANG_DIPROSES', 'Data sedang diproses. Silakan coba kembali.'],
    '40P01': [409, 'DATA_SEDANG_DIPROSES', 'Terjadi perubahan bersamaan. Silakan coba kembali.'],
    '40001': [409, 'DATA_SEDANG_DIPROSES', 'Terjadi perubahan bersamaan. Silakan coba kembali.'],
    '57014': [503, 'DATABASE_TIMEOUT', 'Database belum dapat menyelesaikan permintaan.'],
  };
  if (mappings[error.code]) [status, code, message] = mappings[error.code];
  if (error.type === 'entity.parse.failed') [status, code, message] = [400, 'JSON_TIDAK_VALID', 'Body harus berupa JSON yang valid.'];
  if (error.type === 'entity.too.large') [status, code, message] = [413, 'BODY_TERLALU_BESAR', 'Body maksimal 32 KB.'];
  if (status >= 500) console.error('Permintaan gagal:', req.requestId, code);
  const details = error instanceof ApiError && code === 'LOGIN_LOCKED' ? error.details : undefined;
  if (details) res.set('Retry-After', String(details.retry_after_seconds));
  res.status(status).json({ error: { code, message, ...details }, request_id: req.requestId });
}
