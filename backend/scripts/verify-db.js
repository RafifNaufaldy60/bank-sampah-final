// Pemeriksaan akhir hanya membaca database; tidak membuat akun/transaksi.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { createDatabase } from '../src/db.js';
import { createApp } from '../src/app.js';

const db = createDatabase();
let server;
try {
  const baseline = JSON.parse(await readFile(new URL('../docs/database-inspection.json', import.meta.url), 'utf8'));
  const result = await db.transaction(async client => {
    const migration = (await client.query('SELECT nama FROM schema_migrations ORDER BY nama')).rows;
    const columns = (await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='setoran'")).rows;
    assert.ok(columns.some(row => row.column_name === 'payload_hash'));
    await client.query('SELECT token_hash FROM sesi_login LIMIT 0');
    const functions = (await client.query("SELECT pg_get_functiondef('public.catat_setoran(bigint,bigint,date,uuid,jsonb)'::regprocedure) AS definition")).rows;
    assert.equal(functions[0].definition, baseline.functions.find(row => row.proname === 'catat_setoran').definition);
    const views = (await client.query("SELECT viewname,definition FROM pg_views WHERE schemaname='public'")).rows;
    for (const view of baseline.views) assert.equal(views.find(row => row.viewname === view.viewname)?.definition, view.definition);
    const counts = (await client.query(`SELECT (SELECT count(*) FROM akun) AS akun,(SELECT count(*) FROM setoran) AS setoran,
      (SELECT count(*) FROM pengajuan_penjemputan) AS pengajuan,(SELECT count(*) FROM jadwal_layanan) AS jadwal,
      (SELECT count(*) FROM jenis_sampah) AS jenis_sampah,(SELECT count(*) FROM harga_sampah) AS harga`)).rows[0];
    const testsLeft = (await client.query("SELECT count(*) FROM pg_namespace WHERE nspname ~ '^bs_test_[0-9]+_[a-f0-9]{12}$'")).rows[0].count;
    return { migrasi: migration.map(row => row.nama), fungsi_dan_view_existing: 'tidak berubah', jumlah_data: counts, schema_uji_tersisa: testsLeft };
  }, { readOnly: true, repeatableRead: true });
  server = createApp(db).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/api`;
  for (const path of ['/health', '/jenis-sampah', '/layanan', '/jadwal']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200);
    await response.json();
  }
  assert.equal((await fetch(base + '/saldo')).status, 401);
  console.log(JSON.stringify({ ...result, pemeriksaan_http: 'health, katalog, layanan, jadwal 200; saldo tanpa login 401' }, null, 2));
} catch (error) {
  console.error('Verifikasi gagal. Kode:', /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'VERIFICATION_ERROR');
  process.exitCode = 1;
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  await db.close();
}
