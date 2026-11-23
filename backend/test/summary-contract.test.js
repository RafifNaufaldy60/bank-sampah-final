import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../src/app.js';

// HTTP contract fixture: no PostgreSQL / Neon connection or bootstrap.
test('Ringkasan HTTP authorization and response contract', async t => {
  let user;
  let privateReads = 0;
  let transactionOptions;
  const metric = { hari_ini: '2026-11-23', nilai_hari_ini_rp: '9007199254740993.25', berat_hari_ini_kg: '3.625', transaksi_hari_ini: '1', nasabah_aktif: '12', hari_tersedia_minggu_ini: '2' };
  const db = {
    async query(sql) {
      assert.match(sql, /sesi_login/);
      assert.match(sql, /kedaluwarsa_pada > now\(\)/);
      assert.match(sql, /a\.aktif AND a\.status_akun='active'/);
      return { rows: user?.aktif === true && user.status_akun === 'active' ? [user] : [] };
    },
    async transaction(work, options) {
      privateReads++;
      transactionOptions = options;
      return await work({ async query(sql, parameters) {
        if (sql.includes('v_ringkasan_pengelola')) return { rows: [metric] };
        if (sql.includes('v_riwayat_setoran')) { assert.match(sql, /LIMIT 5/); return { rows: [] }; }
        assert.deepEqual(parameters, [metric.hari_ini]);
        return { rows: [] };
      } });
    },
  };
  const server = createApp(db, { origins: [], sessionHours: 24 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const headers = { Authorization: `Bearer ${'a'.repeat(43)}` };
  const active = { id: '9007199254740993', nama: 'Pengelola Fixture', peran: 'pengelola', aktif: true, status_akun: 'active', is_ketua: false };
  try {
    await t.test('unauthenticated request cannot read summary', async () => {
      assert.equal((await fetch(`${base}/ringkasan`)).status, 401);
      assert.equal(privateReads, 0);
    });
    await t.test('nasabah, pending, rejected and inactive accounts never run aggregate', async () => {
      for (const [changes, status] of [[{ peran: 'nasabah' }, 403], [{ status_akun: 'pending' }, 401], [{ status_akun: 'ditolak' }, 401], [{ aktif: false }, 401]]) {
        user = { ...active, ...changes };
        assert.equal((await fetch(`${base}/ringkasan`, { headers })).status, status);
      }
      assert.equal(privateReads, 0);
    });
    await t.test('both manager types receive identical summary data with exact numeric strings', async () => {
      const results = [];
      for (const is_ketua of [true, false]) {
        user = { ...active, is_ketua };
        const response = await fetch(`${base}/ringkasan`, { headers });
        assert.equal(response.status, 200);
        results.push(await response.json());
      }
      assert.deepEqual(results[0], results[1]);
      assert.equal(results[0].data.metrik.nilai_hari_ini_rp, '9007199254740993.25');
      assert.equal(results[0].data.pengelola.id, '9007199254740993');
      assert.deepEqual(results[0].data.transaksi_terbaru, []);
      assert.deepEqual(results[0].data.jadwal_hari_ini, []);
      assert.equal(results[0].data.periode.zona_waktu, 'Asia/Jakarta');
      assert.deepEqual(results[0].data.periode.minggu, { dari: '2026-11-23', sampai: '2026-11-29' });
      assert.deepEqual(transactionOptions, { readOnly: true, repeatableRead: true });
    });
    await t.test('regular manager cannot use approval API even with direct URL', async () => {
      user = active;
      assert.equal((await fetch(`${base}/pengajuan-pengelola`, { headers })).status, 403);
    });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
