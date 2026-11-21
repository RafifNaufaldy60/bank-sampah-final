import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { isolatedDatabase } from './helpers/isolated-db.js';
import { bootstrapChairs } from '../src/services/chair-bootstrap.js';
import { createManager } from '../src/services/account-service.js';
import { createApp } from '../src/app.js';
import { migrate } from '../src/migrate.js';
import { newToken, digest } from '../src/utils/security.js';

test('Persetujuan pengelola, bootstrap, migration, dan otorisasi terbaru di PostgreSQL', { timeout: 180000 }, async t => {
  const fixture = await isolatedDatabase({ beforeMigration: async db => {
    await db.query(`INSERT INTO akun(peran,nama,email,password_hash,aktif) VALUES
      ('pengelola','Lama aktif','lama@example.test','fixture',true),
      ('pengelola','Lama diblokir','blokir@example.test','fixture',false)`);
  } });
  const { db } = fixture;
  const server = createApp(db, { origins: [], sessionHours: 24 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const password = 'Sandi-Tes-Persetujuan-123';
  const input = (name, peran = 'pengelola') => ({ nama: name, email: `${name}@example.test`, password, peran });
  const chairsInput = [1, 2].map(n => ({ mode: 'create', nama: `Ketua ${n}`, email: `ketua${n}@example.test`, password }));
  let chairs, tokens, customer, customerToken, approved, rejected, managerToken;
  async function api(path, { method = 'GET', body, token, expected = 200 } = {}) {
    const response = await fetch(base + path, { method, headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    const result = await response.json();
    if (expected !== null) assert.equal(response.status, expected, `${path}: ${result.error?.code}`);
    assert.equal(JSON.stringify(result).includes('password_hash'), false);
    return { ...result, status: response.status };
  }
  const login = (account, expected = 200, pass = password) => api('/auth/login', { method: 'POST', body: { email: account.email, password: pass }, expected });
  const register = (name, peran) => api('/auth/register', { method: 'POST', body: input(name, peran), expected: 201 });
  const decide = (id, action, token = tokens[0], expected = 200) => api(`/pengajuan-pengelola/${id}/${action}`, {
    method: 'POST', token, body: action === 'tolak' ? { alasan_penolakan: 'Dokumen belum sesuai.' } : {}, expected,
  });
  try {
    await t.test('Migration mempertahankan blokir lama, default aman, constraint dan tracking', async () => {
      const old = (await db.query('SELECT email,aktif,is_ketua,status_akun FROM akun ORDER BY id')).rows;
      assert.deepEqual(old.map(a => [a.aktif, a.is_ketua, a.status_akun]), [[true, false, 'active'], [false, false, 'ditolak']]);
      assert.deepEqual(await migrate(db), []);
      const inserted = (await db.query("INSERT INTO akun(peran,nama,email,password_hash) VALUES('nasabah','Default','default@example.test','fixture') RETURNING status_akun,is_ketua")).rows[0];
      assert.deepEqual(inserted, { status_akun: 'pending', is_ketua: false });
      await assert.rejects(db.query("UPDATE akun SET is_ketua=true WHERE email='default@example.test'"), { code: '23514' });
      await assert.rejects(db.query("UPDATE akun SET status_akun='unknown'"), { code: '23514' });
    });
    await t.test('Bootstrap tepat dua, idempoten, tanpa reset password atau promosi sembarang', async () => {
      await assert.rejects(bootstrapChairs(db, chairsInput.slice(0, 1)), { code: 'BOOTSTRAP_INVALID' });
      await assert.rejects(bootstrapChairs(db, [chairsInput[0], chairsInput[0]]), { code: 'BOOTSTRAP_INVALID' });
      await assert.rejects(bootstrapChairs(db, [chairsInput[0], { mode: 'existing', email: 'default@example.test' }]), { code: 'BOOTSTRAP_CONFLICT' });
      assert.equal((await db.query('SELECT count(*) FROM akun WHERE is_ketua')).rows[0].count, '0');
      chairs = await bootstrapChairs(db, chairsInput);
      const before = (await db.query('SELECT password_hash FROM akun WHERE is_ketua ORDER BY id')).rows;
      assert.deepEqual((await bootstrapChairs(db, chairsInput.map(a => ({ ...a, password: 'Password-Berbeda-123' })))).map(a => a.id), chairs.map(a => a.id));
      assert.deepEqual((await db.query('SELECT password_hash FROM akun WHERE is_ketua ORDER BY id')).rows, before);
      await assert.rejects(bootstrapChairs(db, [chairsInput[0], { ...chairsInput[1], email: 'ketua3@example.test' }]), { code: 'BOOTSTRAP_CONFLICT' });
      tokens = await Promise.all(chairs.map(async a => (await login(a)).data.token));
    });
    await t.test('Nasabah aktif dapat login, pengelola pending tidak mendapat sesi', async () => {
      customer = (await register('nasabah', 'nasabah')).data;
      assert.equal(customer.status_akun, 'active'); assert.equal(customer.is_ketua, false);
      customerToken = (await login(customer)).data.token;
      const result = await register('setuju');
      approved = result.data;
      rejected = (await register('tolak')).data;
      assert.equal(approved.status_akun, 'pending'); assert.equal(approved.is_ketua, false);
      assert.equal('token' in result.data, false);
      assert.equal((await db.query('SELECT count(*) FROM sesi_login WHERE akun_id=$1', [approved.id])).rows[0].count, '0');
      assert.equal((await login(approved, 403)).error.code, 'ACCOUNT_PENDING');
      assert.equal((await login(approved, 401, 'Sandi-Salah-123')).error.code, 'LOGIN_GAGAL');
      assert.equal((await login(approved, 401, 'salah')).error.code, 'LOGIN_GAGAL');
      assert.equal((await login({ email: 'absen@example.test' }, 401)).error.code, 'LOGIN_GAGAL');
      assert.equal((await createManager(db, { nama: 'CLI', email: 'cli@example.test', password })).status_akun, 'pending');
    });
    await t.test('Allowlist registrasi/profil menolak manipulasi dan role ketiga', async () => {
      for (const extra of [{ is_ketua: true }, { status_akun: 'active' }, { aktif: true }, { peran: 'ketua' }, { peran: null }]) {
        await api('/auth/register', { method: 'POST', body: { ...input('jahat'), ...extra }, expected: 400 });
      }
      for (const body of [{ is_ketua: true }, { status_akun: 'active' }, { peran: 'pengelola' }, { aktif: true }]) {
        await api('/auth/me', { method: 'PATCH', token: customerToken, body, expected: 400 });
      }
      const result = await api('/auth/me', { method: 'PATCH', token: customerToken, body: { nama: 'Nama baru' } });
      assert.equal(result.data.nama, 'Nama baru'); assert.equal(result.data.peran, 'nasabah');
    });
    await t.test('Daftar, detail, filter dan pagination ketua; keputusan menyimpan metadata', async () => {
      const list = await api('/pengajuan-pengelola?status=pending&limit=1&page=2', { token: tokens[0] });
      assert.equal(list.data.length, 1); assert.equal(list.meta.total, 3); assert.equal(list.meta.page, 2);
      assert.equal((await api(`/pengajuan-pengelola/${approved.id}`, { token: tokens[1] })).data.id, approved.id);
      await api('/pengajuan-pengelola?status=unknown', { token: tokens[0], expected: 400 });
      const result = await decide(approved.id, 'setujui');
      assert.equal(result.data.status_akun, 'active'); assert.equal(result.data.diperiksa_oleh, chairs[0].id); assert.ok(result.data.diputuskan_pada);
      managerToken = (await login(approved)).data.token;
      await api(`/pengajuan-pengelola/${rejected.id}/tolak`, { method: 'POST', token: tokens[0], body: { alasan_penolakan: ' ' }, expected: 400 });
      const no = await decide(rejected.id, 'tolak', tokens[1]);
      assert.equal(no.data.status_akun, 'ditolak'); assert.equal(no.data.alasan_penolakan, 'Dokumen belum sesuai.');
      assert.equal((await login(rejected, 403)).error.code, 'ACCOUNT_REJECTED');
      assert.equal((await login(rejected, 401, 'Sandi-Salah-123')).error.code, 'LOGIN_GAGAL');
      assert.equal((await api('/pengajuan-pengelola?status=ditolak', { token: tokens[1] })).data.some(a => a.id === rejected.id), true);
    });
    await t.test('Seluruh endpoint persetujuan memerlukan ketua, nasabah/pengelola mendapat 403', async () => {
      for (const token of [undefined, customerToken, managerToken]) {
        const expected = token ? 403 : 401;
        await api('/pengajuan-pengelola', { token, expected });
        await api(`/pengajuan-pengelola/${approved.id}`, { token, expected });
        for (const action of ['setujui', 'tolak']) await decide(approved.id, action, token || '', expected);
      }
    });
    await t.test('Tidak ditemukan 404; keputusan ulang/nasabah/ketua ditolak 409', async () => {
      await decide('9223372036854775807', 'setujui', tokens[0], 404);
      for (const id of [approved.id, rejected.id, customer.id, chairs[0].id]) {
        for (const action of ['setujui', 'tolak']) await decide(id, action, tokens[0], 409);
      }
    });
    await t.test('Dua keputusan bersamaan hanya satu menang, metadata tidak ditimpa', async () => {
      const race = (await register('bersamaan')).data;
      const results = await Promise.all([decide(race.id, 'setujui', tokens[0], null), decide(race.id, 'tolak', tokens[1], null)]);
      assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
      const winner = results.find(r => r.status === 200).data;
      const saved = (await api(`/pengajuan-pengelola/${race.id}`, { token: tokens[0] })).data;
      for (const key of ['status_akun', 'diperiksa_oleh', 'diputuskan_pada', 'alasan_penolakan']) assert.equal(saved[key], winner[key]);
    });
    await t.test('Token lama gagal pada pending/ditolak/nonaktif; pencabutan ketua langsung berlaku', async () => {
      const old = newToken();
      await db.query("INSERT INTO sesi_login(token_hash,akun_id,kedaluwarsa_pada) VALUES($1,$2,now()+interval '1 hour')", [digest(old), rejected.id]);
      await api('/auth/me', { token: old, expected: 401 });
      await db.query("UPDATE akun SET status_akun='pending' WHERE id=$1", [customer.id]);
      await api('/saldo', { token: customerToken, expected: 401 });
      await db.query("UPDATE akun SET status_akun='active',aktif=false WHERE id=$1", [customer.id]);
      await api('/auth/me', { token: customerToken, expected: 401 });
      await db.query('UPDATE akun SET is_ketua=false WHERE id=$1', [chairs[0].id]);
      await api('/pengajuan-pengelola', { token: tokens[0], expected: 403 });
      await decide(approved.id, 'setujui', tokens[0], 403);
      await db.query("UPDATE akun SET status_akun='pending' WHERE id=$1", [chairs[1].id]);
      await api('/pengajuan-pengelola', { token: tokens[1], expected: 401 });
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fixture.cleanup();
  }
});

test('Bootstrap akun existing membutuhkan pilihan eksplisit dan menolak akun diblokir/pending/nasabah', async () => {
  const fixture = await isolatedDatabase({ beforeMigration: async db => {
    await db.query(`INSERT INTO akun(peran,nama,email,password_hash,aktif) VALUES
      ('pengelola','Satu','satu@example.test','hash-existing-1',true),
      ('pengelola','Dua','dua@example.test','hash-existing-2',true),
      ('pengelola','Blokir','blokir@example.test','hash-existing-3',false),
      ('nasabah','Nasabah','nasabah@example.test','hash-existing-4',true)`);
  } });
  try {
    const { db } = fixture;
    const one = { mode: 'existing', email: 'satu@example.test' };
    const two = { mode: 'existing', email: 'dua@example.test' };
    for (const email of ['blokir@example.test', 'nasabah@example.test', 'absen@example.test']) {
      await assert.rejects(bootstrapChairs(db, [one, { mode: 'existing', email }]), { code: 'BOOTSTRAP_CONFLICT' });
      assert.equal((await db.query('SELECT count(*) FROM akun WHERE is_ketua')).rows[0].count, '0');
    }
    await createManager(db, { nama: 'Pending', email: 'pending@example.test', password: 'Sandi-Pending-123' });
    await assert.rejects(bootstrapChairs(db, [one, { mode: 'existing', email: 'pending@example.test' }]), { code: 'BOOTSTRAP_CONFLICT' });
    await assert.rejects(bootstrapChairs(db, [one, { ...two, mode: 'create', nama: 'Dua', password: 'Sandi-Baru-123' }]), { code: 'BOOTSTRAP_CONFLICT' });
    await bootstrapChairs(db, [one, two]);
    await bootstrapChairs(db, [one, two]);
    assert.deepEqual((await db.query('SELECT password_hash FROM akun WHERE is_ketua ORDER BY id')).rows.map(r => r.password_hash), ['hash-existing-1', 'hash-existing-2']);
  } finally { await fixture.cleanup(); }
});

test('Migration membatalkan transaksi ketika kolom status lama konflik', async () => {
  await assert.rejects(isolatedDatabase({ beforeMigration: db => db.query("ALTER TABLE akun ADD COLUMN status text DEFAULT 'blocked'") }),
    error => error.code === 'P0001' && error.message.includes('Konflik schema status akun'));
});
