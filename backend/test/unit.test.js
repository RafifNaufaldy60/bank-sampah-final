import test from 'node:test';
import assert from 'node:assert/strict';
import { todayJakarta, dateRange, weekRange } from '../src/utils/dates.js';
import * as v from '../src/utils/validation.js';
import { hashPassword, verifyPassword } from '../src/utils/security.js';
import { authRateLimit } from '../src/middleware/auth.js';
import { connectionString } from '../src/db.js';

test('Tanggal operasional berpindah saat tengah malam Jakarta, bukan UTC', () => {
  assert.equal(todayJakarta(new Date('2026-12-31T17:01:00Z')), '2027-01-01');
  assert.equal(todayJakarta(new Date('2026-12-31T16:59:00Z')), '2026-12-31');
  assert.deepEqual(weekRange('2027-01-03'), { dari: '2026-12-28', sampai: '2027-01-03' });
});
test('Filter periode dan tahun melewati pergantian tahun dengan benar', () => {
  assert.deepEqual(dateRange({ periode: 'tiga_bulan' }, '2027-01-18'), { dari: '2026-11-01', sampai: '2027-01-18' });
  assert.deepEqual(dateRange({ periode: 'bulan_ini' }, '2026-11-18'), { dari: '2026-11-01', sampai: '2026-11-18' });
  assert.deepEqual(dateRange({ periode: 'tahun_ini' }, '2026-11-18'), { dari: '2026-01-01', sampai: '2026-11-18' });
  assert.throws(() => dateRange({ periode: 'bulan_ini', dari: '2026-01-01' }));
  assert.throws(() => dateRange({ dari: '2026-12-01', sampai: '2026-01-01' }));
});
test('Berat, ID besar, tanggal, dan input tidak valid ditolak tanpa pembulatan diam-diam', () => {
  assert.equal(v.weight('1.234'), '1.234');
  assert.equal(v.weight(2), '2.000');
  for (const value of [0, -1, 'NaN', 'Infinity', '1.0001', '1e3', true, [], 1000000000]) assert.throws(() => v.weight(value));
  for (const value of ['2026-02-29', '2026-13-01', '2026-2-01', '2026-11-18T00:00:00Z']) assert.throws(() => v.date(value));
  assert.equal(v.date('2024-02-29'), '2024-02-29');
  assert.equal(v.id('9007199254740993'), '9007199254740993');
  assert.throws(() => v.id(9007199254740993));
  assert.throws(() => v.fields({ peran: 'pengelola' }, ['nama']));
  assert.equal(v.search('100%_'), '%100\\%\\_%');
});
test('Hash scrypt memakai salt acak dan memverifikasi sandi secara benar', async () => {
  const first = await hashPassword('Sandi-Uji-Sementara-123');
  const second = await hashPassword('Sandi-Uji-Sementara-123');
  assert.notEqual(first, second);
  assert.equal(await verifyPassword('Sandi-Uji-Sementara-123', first), true);
  assert.equal(await verifyPassword('salah', first), false);
  assert.equal(await verifyPassword('salah', null), false);
});
test('Batas percobaan login memberikan 429 dan Retry-After', () => {
  const limiter = authRateLimit({ max: 1 });
  const headers = {};
  const res = { set: (name, value) => { headers[name] = value; } };
  limiter({ ip: '127.0.0.1' }, res, () => {});
  assert.throws(() => limiter({ ip: '127.0.0.1' }, res, () => {}), error => error.status === 429);
  assert.ok(Number(headers['Retry-After']) > 0);
});

test('Koneksi SSL memverifikasi server dan pesan URL invalid tidak membocorkan input', () => {
  assert.match(connectionString('postgresql://contoh:rahasia-contoh@localhost/db?sslmode=require'), /sslmode=verify-full/);
  assert.throws(() => connectionString('kredensial-contoh-bukan-url'), error => !error.message.includes('kredensial-contoh'));
  assert.throws(() => connectionString('https://localhost/db'));
});
