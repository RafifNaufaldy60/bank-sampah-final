import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const options = { N: 65536, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };
export const digest = value => createHash('sha256').update(value).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, options);
  return `scrypt$65536$8$1$${salt}$${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  const parts = typeof stored === 'string' ? stored.split('$') : [];
  const valid = parts.length === 6 && parts.slice(0, 4).join('$') === 'scrypt$65536$8$1'
    && /^[a-f0-9]{32}$/.test(parts[4]) && /^[a-f0-9]{128}$/.test(parts[5]);
  // Akun yang tidak ditemukan tetap menjalankan scrypt agar respons tidak terlalu berbeda.
  const key = await derive(password, valid ? parts[4] : '00000000000000000000000000000000', 64, options);
  return valid && timingSafeEqual(key, Buffer.from(parts[5], 'hex'));
}
