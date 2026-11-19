import { ensure } from './errors.js';

const invalid = message => ensure(false, 400, 'VALIDASI_GAGAL', message);
export function fields(value, allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) invalid('Input harus berupa object.');
  for (const key of Object.keys(value)) if (!allowed.includes(key)) invalid(`Parameter ${key} tidak diizinkan.`);
  return value;
}
export function text(value, name, { min = 1, max = 200, optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) invalid(`${name} harus berisi ${min}–${max} karakter.`);
  return value.trim();
}
export function id(value, name = 'id', max = 9223372036854775807n) {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^[1-9]\d*$/.test(String(value))) invalid(`${name} harus ID positif.`);
  if (typeof value === 'number' && !Number.isSafeInteger(value)) invalid(`${name} terlalu besar; kirim sebagai string.`);
  if (BigInt(value) > max) invalid(`${name} terlalu besar.`);
  return String(value);
}
export function weight(value, name = 'berat_kg') {
  if ((typeof value !== 'string' && typeof value !== 'number') || !/^\d{1,9}(\.\d{1,3})?$/.test(String(value)) || Number(value) <= 0) invalid(`${name} harus positif, kurang dari 1 miliar kg, maksimal 3 desimal.`);
  return Number(value).toFixed(3);
}
export function date(value, name = 'tanggal') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31') invalid(`${name} harus tanggal YYYY-MM-DD yang valid (mulai tahun 1900).`);
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) invalid(`${name} tidak valid.`);
  return value;
}
export function email(value) {
  const result = text(value, 'email', { max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) invalid('Format email tidak valid.');
  return result;
}
export function password(value) {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128 || !value.trim()) invalid('Kata sandi harus berisi 10–128 karakter.');
  return value;
}
export function whatsapp(value, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return null;
  const result = text(value, 'nomor_whatsapp', { max: 20 });
  if (!/^\+?\d{8,15}$/.test(result)) invalid('Nomor WhatsApp harus berisi 8–15 digit, boleh diawali +.');
  return result;
}
export function choice(value, values, name) {
  if (!values.includes(value)) invalid(`${name} harus salah satu: ${values.join(', ')}.`);
  return value;
}
export function boolean(value, name) {
  if (typeof value !== 'boolean') invalid(`${name} harus boolean.`);
  return value;
}
export function time(value, name) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:00)?$/.test(value)) invalid(`${name} harus HH:mm (WIB).`);
  return value.slice(0, 5);
}
export function uuid(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) invalid('Header Idempotency-Key wajib berupa UUID.');
  return value.toLowerCase();
}
export function pagination(query) {
  const page = Number(id(query.page ?? '1', 'page', 1000000n));
  const limit = Number(id(query.limit ?? '20', 'limit', 100n));
  return { page, limit, offset: (page - 1) * limit };
}
export function pageMeta(total, page, limit) {
  return { page, limit, total: Number(total), total_pages: Math.ceil(Number(total) / limit) };
}
export function search(value) {
  const term = text(value, 'search', { max: 100, optional: true });
  // Pencarian substring literal, bukan wildcard yang dikendalikan pemanggil.
  return term ? `%${term.replace(/[\\%_]/g, '\\$&')}%` : null;
}
