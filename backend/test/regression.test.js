import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import ExcelJS from 'exceljs';
import { isolatedDatabase } from './helpers/isolated-db.js';
import { createManager } from '../src/services/account-service.js';
import { createApp } from '../src/app.js';
import { todayJakarta, shiftDays } from '../src/utils/dates.js';

test('Regresi tarif, retry legacy, dan ekspor setelah pembaruan dependensi', { timeout: 180000 }, async t => {
  const fixture = await isolatedDatabase();
  const { db } = fixture;
  let server;
  try {
    const manager = await createManager(db, { nama: 'Pengelola Regresi', email: 'regresi-p@example.test', password: 'Sandi-Regresi-12345' });
    server = createApp(db, { origins: ['http://localhost:5173'], sessionHours: 24 }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api`;
    let token;
    const request = async (path, { body, key, expected = 200, binary = false } = {}) => {
      const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: {
        'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(key ? { 'Idempotency-Key': key } : {}),
      }, ...(body ? { body: JSON.stringify(body) } : {}) });
      assert.equal(response.status, expected, path);
      return binary ? Buffer.from(await response.arrayBuffer()) : response.json();
    };
    const customer = (await request('/auth/register', { body: { nama: '=2+2', email: 'regresi-n@example.test', password: 'Sandi-Regresi-12345' }, expected: 201 })).data;
    token = (await request('/auth/login', { body: { email: manager.email, password: 'Sandi-Regresi-12345' } })).data.token;
    const today = todayJakarta();
    const body = { nasabah_id: customer.id, tanggal_setoran: today, rincian: [{ jenis_sampah_id: 1, berat_kg: '1' }, { jenis_sampah_id: 3, berat_kg: '2' }] };
    const key = randomUUID();
    const original = (await request('/setoran', { body, key, expected: 201 })).data;
    assert.equal(original.nilai_setoran_rp, '9800');

    await t.test('Tarif baru dan fingerprint NULL tidak menggandakan atau mengubah setoran lama', async () => {
      await request('/harga-sampah', { body: { jenis_sampah_id: 1, berlaku_mulai: today, harga_per_kg: 5500 }, expected: 201 });
      let retried = await request('/setoran', { body: { ...body, rincian: [...body.rincian].reverse() }, key });
      assert.equal(retried.data.nilai_setoran_rp, '9800');
      assert.equal(retried.meta.replayed, true);
      await db.query('UPDATE setoran SET payload_hash=NULL WHERE id=$1', [original.setoran_id]);
      retried = await request('/setoran', { body, key });
      assert.equal(retried.data.setoran_id, original.setoran_id);
      assert.equal((await db.query('SELECT count(*) FROM setoran')).rows[0].count, '1');
      await request('/setoran', { body: { ...body, rincian: [{ jenis_sampah_id: 1, berat_kg: '1' }] }, key: randomUUID(), expected: 201 });
    });
    await t.test('XLSX pascapembaruan uuid tetap memuat seluruh transaksi dan rincian, bukan formula', async () => {
      const buffer = await request('/setoran/export.xlsx?limit=1&page=2', { binary: true });
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      assert.equal(workbook.getWorksheet('Riwayat').rowCount, 3);
      assert.equal(workbook.getWorksheet('Rincian').rowCount, 4);
      assert.equal(workbook.getWorksheet('Riwayat').getCell('D2').type, ExcelJS.ValueType.String);
      assert.equal(workbook.getWorksheet('Riwayat').getCell('G2').value, 5500);
      assert.equal(workbook.getWorksheet('Riwayat').getCell('G3').value, 9800);
    });
    await t.test('Minyak Jelantah baru bisa ditransaksikan setelah harga per kg ditetapkan', async () => {
      await request('/harga-sampah', { body: { jenis_sampah_id: 8, berlaku_mulai: today, harga_per_kg: 6000 }, expected: 201 });
      assert.equal((await request(`/jenis-sampah/8/harga?tanggal=${shiftDays(today, -1)}`)).data.harga_per_kg, null);
      const oil = await request('/setoran', { body: { ...body, rincian: [{ jenis_sampah_id: 8, berat_kg: '1.25' }] }, key: randomUUID(), expected: 201 });
      assert.equal(oil.data.nilai_setoran_rp, '7500');
      assert.equal(oil.data.rincian[0].berat_kg, '1.250');
    });
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await fixture.cleanup();
  }
});
