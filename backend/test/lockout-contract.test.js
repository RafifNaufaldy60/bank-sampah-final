// Tes unit kontrak login tanpa akses jaringan atau database produksi.
// Simulasi transaksi hanya menguji alur service; atomicity PostgreSQL asli
// tetap diuji secara terpisah oleh test/lockout.test.js + TEST_DATABASE_URL.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword } from '../src/utils/security.js';
import { loginAccount } from '../src/services/login-service.js';

test('Alur 5/15, status akun, pilihan role, dan penerbitan sesi pada login-service', async () => {
  let now = Date.parse('2030-01-01T00:00:00Z');
  const clock = async () => new Date(now);
  const password = 'Password-For-Test-123';
  const rows = new Map();
  const sessions = [];
  for (const [email, peran, status_akun] of [
    ['nasabah@example.test', 'nasabah', 'active'],
    ['pengelola@example.test', 'pengelola', 'active'],
    ['pending@example.test', 'pengelola', 'pending'],
  ]) {
    rows.set(email, {
      id: String(rows.size + 1), nama: 'Penguji', email, kode_akun: 'UNIT',
      nomor_whatsapp: null, peran, status_akun, aktif: true, is_ketua: false,
      password_hash: await hashPassword(password),
      login_failed_attempts: 0, login_locked_until: null,
    });
  }
  let queue = Promise.resolve();
  const client = {
    async query(sql, params = []) {
      if (sql.includes('FROM akun WHERE lower(email)')) return { rows: rows.has(params[0]) ? [{ ...rows.get(params[0]) }] : [] };
      if (sql.startsWith('UPDATE akun SET login_failed_attempts')) {
        const account = [...rows.values()].find(row => row.id === params[0]);
        account.login_failed_attempts = params[1] ?? 0;
        account.login_locked_until = params[2] ?? null;
        return { rows: [] };
      }
      if (sql.startsWith('DELETE FROM sesi_login')) return { rows: [] };
      if (sql.includes('INSERT INTO sesi_login')) {
        sessions.push(params[0]);
        return { rows: [{ kedaluwarsa_pada: new Date(now + 24 * 3600000).toISOString() }] };
      }
      throw new Error('Query tidak dikenal di test double.');
    },
  };
  const db = {
    async transaction(callback) {
      let release;
      const current = new Promise(resolve => { release = resolve; });
      const preceding = queue;
      queue = current;
      await preceding;
      try { return await callback(client); } finally { release(); }
    },
  };
  const config = { sessionHours: 24 };
  const login = (email = 'nasabah@example.test', pass = password, peran) =>
    loginAccount(db, { email, password: pass, peran }, config, clock);
  const failure = async (code, email, pass, peran) => {
    await assert.rejects(login(email, pass, peran), error => error.code === code);
  };
  const customer = rows.get('nasabah@example.test');
  for (let i = 1; i < 5; i++) {
    await failure('LOGIN_GAGAL', customer.email, 'salah');
    assert.equal(customer.login_failed_attempts, i);
  }
  await failure('LOGIN_LOCKED', customer.email, 'salah');
  const deadline = new Date(customer.login_locked_until).valueOf();
  assert.equal(deadline - now, 15 * 60 * 1000);
  const before = sessions.length;
  await failure('LOGIN_LOCKED', customer.email, password);
  assert.equal(new Date(customer.login_locked_until).valueOf(), deadline);
  assert.equal(sessions.length, before);
  assert.equal((await login('pengelola@example.test', password, 'pengelola')).akun.peran, 'pengelola');
  now = deadline;
  await failure('LOGIN_GAGAL', customer.email, 'salah');
  assert.equal(customer.login_failed_attempts, 1);
  await failure('LOGIN_GAGAL', customer.email, password, 'pengelola');
  assert.equal(customer.login_failed_attempts, 0, 'password benar mereset counter');
  assert.equal(sessions.length, before + 1, 'pilihan role salah tidak menerbitkan sesi');
  assert.equal((await login(customer.email, password, 'nasabah')).akun.peran, 'nasabah');
  assert.equal((await login(customer.email, password)).akun.peran, 'nasabah', 'klien lama tetap kompatibel');
  await failure('ACCOUNT_PENDING', 'pending@example.test', password, 'pengelola');

  // Rangkaian request bersamaan tidak dapat membuat counter lewat dari 5 pada transaksi terserialkan.
  const answers = await Promise.allSettled(Array.from({ length: 12 }, () => login(customer.email, 'salah')));
  assert.equal(answers.filter(x => x.reason?.code === 'LOGIN_GAGAL').length, 4);
  assert.equal(answers.filter(x => x.reason?.code === 'LOGIN_LOCKED').length, 8);
  assert.equal(customer.login_failed_attempts, 5);
});
