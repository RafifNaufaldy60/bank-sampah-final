import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { isolatedDatabase } from './helpers/isolated-db.js';
import { createDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';
import { loginAccount } from '../src/services/login-service.js';
import { registerAccount } from '../src/services/account-service.js';
import { migrate } from '../src/migrate.js';

test('Persistent, atomic 5/15 account lockout in isolated PostgreSQL', { timeout: 180000 }, async t => {
  const fixture = await isolatedDatabase();
  const { db } = fixture;
  let time = Date.now();
  const clock = async () => new Date(time);
  const settings = { origins: ['http://localhost:5173'], sessionHours: 24, authClock: clock };
  let server = createApp(db, settings).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const password = 'Only-Isolated-Test-123';
  const input = email => ({ email, password, nama: 'Lockout Test', peran: 'nasabah' });
  const a = await registerAccount(db, input('lock-a@example.test'));
  const b = await registerAccount(db, input('lock-b@example.test'));
  const run = (account = a, pass = password, database = db) => loginAccount(database, { email: account.email, password: pass }, settings, clock);
  const bad = async (account = a, code = 'LOGIN_GAGAL', pass = 'wrong') => {
    try { await run(account, pass); assert.fail('Expected authentication error'); }
    catch (error) { assert.equal(error.code, code); return error; }
  };
  const state = async account => (await db.query('SELECT login_failed_attempts,login_locked_until FROM akun WHERE id=$1', [account.id])).rows[0];
  const request = async body => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { res, json: await res.json() };
  };
  try {
    await t.test('Migration safe defaults and idempotency', async () => {
      assert.deepEqual(await state(a), { login_failed_attempts: 0, login_locked_until: null });
      assert.deepEqual(await migrate(db), []);
    });
    let deadline;
    await t.test('Failures 1–4 generic; fifth locks for exactly 15 minutes', async () => {
      for (let n = 1; n <= 4; n++) { await bad(); assert.equal((await state(a)).login_failed_attempts, n); }
      const error = await bad(a, 'LOGIN_LOCKED');
      assert.equal(error.status, 429); assert.equal(error.details.retry_after_seconds, 900);
      deadline = error.details.locked_until;
      assert.equal(Date.parse(deadline) - time, 900000);
    });
    await t.test('Correct password denied while locked; deadline not extended; other account unaffected', async () => {
      time += 60000;
      assert.equal((await bad(a, 'LOGIN_LOCKED', password)).details.locked_until, deadline);
      assert.equal((await bad(a, 'LOGIN_LOCKED')).details.retry_after_seconds, 840);
      assert.equal((await run(b)).akun.id, b.id);
    });
    await t.test('HTTP 429, Retry-After, normalized email and restart persistence', async () => {
      await new Promise(resolve => server.close(resolve));
      const reconnected = createDatabase({ url: process.env.TEST_DATABASE_URL, schema: fixture.schema });
      try {
        server = createApp(reconnected, settings).listen(0, '127.0.0.1');
        await once(server, 'listening');
        const { res, json } = await request({ email: ' LOCK-A@EXAMPLE.TEST ', password });
        assert.equal(res.status, 429); assert.equal(res.headers.get('retry-after'), '840');
        assert.equal(json.error.code, 'LOGIN_LOCKED'); assert.equal(json.error.locked_until, deadline);
        assert.equal(json.error.retry_after_seconds, 840);
        await new Promise(resolve => server.close(resolve));
      } finally { await reconnected.close(); }
      server = createApp(db, settings).listen(0, '127.0.0.1'); await once(server, 'listening');
    });
    await t.test('After deadline first wrong is counted as one; correct password resets', async () => {
      time = Date.parse(deadline);
      await bad(); assert.deepEqual(await state(a), { login_failed_attempts: 1, login_locked_until: null });
      assert.equal((await run()).akun.id, a.id);
      assert.deepEqual(await state(a), { login_failed_attempts: 0, login_locked_until: null });
    });
    await t.test('Parallel wrong attempts cannot pass threshold or extend deadline', async () => {
      const results = await Promise.allSettled(Array.from({ length: 12 }, () => run(a, 'wrong')));
      assert.equal(results.filter(r => r.reason?.code === 'LOGIN_GAGAL').length, 4);
      assert.equal(results.filter(r => r.reason?.code === 'LOGIN_LOCKED').length, 8);
      const locks = results.filter(r => r.reason?.details).map(r => r.reason.details.locked_until);
      assert.equal(new Set(locks).size, 1); assert.equal((await state(a)).login_failed_attempts, 5);
      time += 900000; await run();
    });
    await t.test('Pending, rejected, inactive, manager and chair preserve account policy', async () => {
      for (const [suffix, status, aktif, isChair, expected] of [
        ['pending', 'pending', true, false, 'ACCOUNT_PENDING'],
        ['rejected', 'ditolak', true, false, 'ACCOUNT_REJECTED'],
        ['inactive', 'active', false, false, 'LOGIN_GAGAL'],
        ['manager', 'active', true, false, null], ['chair-fixture', 'active', true, true, null],
      ]) {
        const account = await registerAccount(db, { ...input(`${suffix}@example.test`), peran: 'pengelola' });
        assert.equal(account.status_akun, 'pending'); assert.equal(account.is_ketua, false);
        // Fixture only, no bootstrap and no real chairs.
        await db.query('UPDATE akun SET status_akun=$2,aktif=$3,is_ketua=$4 WHERE id=$1', [account.id, status, aktif, isChair]);
        await bad(account);
        if (expected) await bad(account, expected, password); else await run(account);
        assert.equal((await state(account)).login_failed_attempts, 0);
        for (let n = 0; n < 4; n++) await bad(account);
        await bad(account, 'LOGIN_LOCKED'); await bad(account, 'LOGIN_LOCKED', password);
        time += 900000;
      }
    });
    await t.test('Invalid input and DB failure do not consume attempts; unknown email generic', async () => {
      for (const body of [{ email: a.email, password: 123 }, { email: a.email, password: '' }, { email: a.email, password: '   ' }, { email: 'invalid', password }, { email: a.email, password, peran: 'pengelola' }]) {
        assert.equal((await request(body)).res.status, 400);
      }
      assert.equal((await state(a)).login_failed_attempts, 0);
      await bad({ email: 'unknown@example.test' });
      // Fail after updating counter; real transaction must rollback.
      const failingDb = { transaction: work => db.transaction(client => work({ query: async (...args) => {
        const result = await client.query(...args);
        if (args[0].startsWith('UPDATE akun SET login_failed_attempts')) throw new Error('Injected database failure');
        return result;
      } })) };
      await assert.rejects(run(a, 'wrong', failingDb), /Injected database failure/);
      assert.equal((await state(a)).login_failed_attempts, 0);
    });
    await t.test('UI role choice is enforced by server, without changing account role or issuing a session', async () => {
      const before = (await db.query('SELECT count(*)::integer AS total FROM sesi_login WHERE akun_id=$1', [a.id])).rows[0].total;
      const wrongRole = await request({ email: a.email, password, peran: 'pengelola' });
      assert.equal(wrongRole.res.status, 401); assert.equal(wrongRole.json.error.code, 'LOGIN_GAGAL');
      assert.equal((await db.query('SELECT count(*)::integer AS total FROM sesi_login WHERE akun_id=$1', [a.id])).rows[0].total, before);
      assert.equal((await state(a)).login_failed_attempts, 0);
      const correctRole = await request({ email: a.email, password, peran: 'nasabah' });
      assert.equal(correctRole.res.status, 200); assert.equal(correctRole.json.data.akun.peran, 'nasabah');
      const oldClient = await request({ email: a.email, password });
      assert.equal(oldClient.res.status, 200);
      const invalidRole = await request({ email: a.email, password, peran: 'ketua' });
      assert.equal(invalidRole.res.status, 400);
    });
    await t.test('IP rate limit remains distinct from account lockout', async () => {
      let result;
      for (let i = 0; i < 31; i++) result = await request({ email: 'invalid', password });
      assert.equal(result.res.status, 429); assert.equal(result.json.error.code, 'TERLALU_BANYAK_PERMINTAAN');
      assert.ok(Number(result.res.headers.get('retry-after')) > 0);
      assert.equal((await state(a)).login_failed_attempts, 0);
    });
  } finally { await new Promise(resolve => server.close(resolve)); await fixture.cleanup(); }
});
