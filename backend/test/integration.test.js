import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import ExcelJS from 'exceljs';
import { isolatedDatabase } from './helpers/isolated-db.js';
import { createApp } from '../src/app.js';
import { createManager } from '../src/services/account-service.js';
import { bootstrapChairs } from '../src/services/chair-bootstrap.js';
import { migrate } from '../src/migrate.js';
import { todayJakarta, shiftDays, dateRange } from '../src/utils/dates.js';
import { digest } from '../src/utils/security.js';

let fixture, db, server, base, a, b, manager, manager2, direct, regularSchedule, pickupSchedule, pickupId, legacyId;
let tokenA, tokenB, tokenM, tokenM2;
const password = 'Sandi-Uji-Terisolasi-123';
const today = todayJakarta();
const customerInput = suffix => ({ nama: `Nasabah Uji ${suffix}`, email: `nasabah-${suffix}@example.test`, password, nomor_whatsapp: '081234567890' });
const depositBody = (rincian = [{ jenis_sampah_id: 1, berat_kg: '1' }], extra = {}) => ({ nasabah_id: a.id, tanggal_setoran: today, rincian, ...extra });
const pickupBody = () => ({ alamat_penjemputan: 'Alamat fiktif pengujian terisolasi', nomor_whatsapp: '081234567890', tanggal_diminta: today, perkiraan_berat_kg: '10', catatan_nasabah: 'Data uji' });

async function api(path, { method = 'GET', token, body, key, expected = 200, headers = {}, raw = false } = {}) {
  const response = await fetch(`${base}/api${path}`, { method, headers: {
    ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(key ? { 'Idempotency-Key': key } : {}), ...headers,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  if (raw) { assert.equal(response.status, expected); return response; }
  const result = await response.json();
  if (expected !== null) assert.equal(response.status, expected, `${method} ${path}: ${result.error?.code || 'status tidak sesuai'}`);
  return { ...result, statusCode: response.status, headers: response.headers };
}
async function save(body = depositBody(), options = {}) {
  return api('/setoran', { method: 'POST', token: tokenM, body, key: randomUUID(), expected: 201, ...options });
}
async function createPickup(token = tokenA) {
  return (await api('/pengajuan-penjemputan', { method: 'POST', token, body: pickupBody(), expected: 201 })).data;
}

before(async () => {
  fixture = await isolatedDatabase({ beforeMigration: async database => {
    // Memastikan migrasi mempertahankan akun, fungsi, dan transaksi yang SUDAH ada.
    const legacy = await database.query(`INSERT INTO akun(peran,nama,email,password_hash) VALUES
      ('pengelola','Pengelola lama uji','lama-p@example.test','hash-lama-uji'),
      ('nasabah','Nasabah lama uji','lama-n@example.test','hash-lama-uji') RETURNING id,peran`);
    const managerId = legacy.rows.find(row => row.peran === 'pengelola').id;
    const customerId = legacy.rows.find(row => row.peran === 'nasabah').id;
    legacyId = (await database.query("SELECT catat_setoran($1,$2,'2020-01-01',$3,$4) AS id", [managerId, customerId, randomUUID(), JSON.stringify([{ jenis_sampah_id: 1, berat_kg: 1 }])])).rows[0].id;
    await database.query('UPDATE akun SET aktif=false'); // Hanya schema uji baru ini.
  } });
  db = fixture.db;
  server = createApp(db, { origins: ['http://localhost:5173'], sessionHours: 24 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
}, { timeout: 120000 });
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (fixture) await fixture.cleanup();
});

test('Alur HTTP dan transaksi PostgreSQL pada schema terisolasi', { timeout: 600000 }, async t => {
  await t.test('Koneksi, CORS, dan migrasi tambahan mempertahankan data lama', async () => {
    assert.equal((await api('/health')).status, 'ok');
    const preflight = await api('/setoran', { method: 'OPTIONS', headers: { Origin: 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'authorization,idempotency-key' }, expected: 204, raw: true });
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    await api('/jenis-sampah', { headers: { Origin: 'https://tidak-diizinkan.example' }, expected: 403 });
    assert.deepEqual(await migrate(db), []);
    const old = (await db.query('SELECT r.nilai_setoran_rp,s.payload_hash FROM v_riwayat_setoran r JOIN setoran s ON s.id=r.setoran_id WHERE s.id=$1', [legacyId])).rows[0];
    assert.equal(old.nilai_setoran_rp, '4200');
    assert.equal(old.payload_hash, null);
  });
  await t.test('Registrasi nasabah dan pengelola melalui persetujuan ketua', async () => {
    await api('/auth/register', { method: 'POST', body: { ...customerInput('a'), peran: 'ketua' }, expected: 400 });
    a = (await api('/auth/register', { method: 'POST', body: customerInput('a'), expected: 201 })).data;
    b = (await api('/auth/register', { method: 'POST', body: customerInput('b'), expected: 201 })).data;
    assert.equal(a.peran, 'nasabah');
    assert.ok(a.kode_akun);
    assert.equal('password_hash' in a, false);
    await api('/auth/register', { method: 'POST', body: { ...customerInput('a'), email: 'NASABAH-A@EXAMPLE.TEST' }, expected: 409 });
    manager = await createManager(db, { nama: 'Pengelola Uji 1', email: 'pengelola1@example.test', password });
    manager2 = await createManager(db, { nama: 'Pengelola Uji 2', email: 'pengelola2@example.test', password });
    const chairs = await bootstrapChairs(db, [1,2].map(n => ({ mode: 'create', nama: `Ketua ${n}`, email: `ketua${n}@example.test`, password })));
    const chairToken = (await api('/auth/login', { method: 'POST', body: { email: chairs[0].email, password } })).data.token;
    for (const target of [manager, manager2]) {
      await api(`/pengajuan-pengelola/${target.id}/setujui`, { method: 'POST', token: chairToken, body: {} });
    }
    await assert.rejects(createManager(db, { nama: 'Tidak boleh promosi otomatis', email: a.email, password }), error => error.code === '23505');
    assert.equal((await db.query('SELECT peran FROM akun WHERE id=$1', [a.id])).rows[0].peran, 'nasabah');
    assert.match((await db.query('SELECT password_hash FROM akun WHERE id=$1', [a.id])).rows[0].password_hash, /^scrypt\$/);
  });
  await t.test('Login, identitas akun, kesalahan sandi, token palsu, dan hak akses', async () => {
    for (const account of [a, b, manager, manager2]) {
      const result = (await api('/auth/login', { method: 'POST', body: { email: account.email, password } })).data;
      assert.equal(result.akun.id, account.id);
      assert.equal(result.akun.peran, account.peran);
      account.token = result.token;
    }
    [tokenA, tokenB, tokenM, tokenM2] = [a, b, manager, manager2].map(account => account.token);
    const me = (await api('/auth/me', { token: tokenA })).data;
    assert.equal(me.nama, a.nama);
    assert.equal(me.id, a.id);
    await api('/auth/login', { method: 'POST', body: { email: a.email, password: 'Sandi-yang-salah' }, expected: 401 });
    await api('/auth/login', { method: 'POST', body: { email: 'tidak-ada@example.test', password }, expected: 401 });
    await api('/auth/me', { token: 'a'.repeat(43), expected: 401 });
    await api('/saldo', { expected: 401 });
    await api('/ringkasan', { token: tokenA, expected: 403 });
    await api('/nasabah', { token: tokenA, expected: 403 });
    await api('/saldo', { token: tokenM, expected: 403 });
    await save(depositBody(), { token: tokenA, expected: 403 });
    await api('/setoran/export.xlsx', { token: tokenA, expected: 403 });
  });
  await t.test('Katalog delapan jenis, pencarian, kategori, dan tarif historis kosong', async () => {
    const catalog = (await api('/jenis-sampah')).data;
    assert.equal(catalog.length, 8);
    assert.equal(catalog.find(row => row.id === 8).harga_per_kg, null);
    assert.equal(catalog.find(row => row.id === 8).status_tarif, 'belum_ditetapkan');
    assert.equal((await api('/jenis-sampah?search=Kardus&kategori=Kertas')).data.length, 1);
    assert.equal((await api('/jenis-sampah?jenis_sampah_id=7')).data[0].nama, 'Botol Kaca');
    assert.equal((await api('/jenis-sampah/1/harga?tanggal=2019-12-31')).data.harga_per_kg, null);
    assert.equal((await api('/jenis-sampah/1/harga')).data.harga_per_kg, '4200');
    assert.equal((await api('/layanan')).data.length, 3);
    await api('/jenis-sampah?tanggal=2026-02-30', { expected: 400 });
    await api('/jenis-sampah/999/harga', { expected: 404 });
    assert.equal((await api(`/nasabah?search=${a.kode_akun}`, { token: tokenM })).data[0].id, a.id);
    assert.equal((await api('/nasabah?search=Nasabah%20Uji', { token: tokenM })).meta.total, 2);
  });
  await t.test('Tiga layanan dapat dijadwalkan, diubah, dan ditutup tanpa menghilang', async () => {
    const make = layanan_kode => api('/jadwal', { method: 'POST', token: tokenM, body: { layanan_kode, tanggal: today, jam_mulai: '08:00', jam_selesai: '12:00' }, expected: 201 });
    regularSchedule = (await make('setoran_umum')).data;
    pickupSchedule = (await make('penjemputan')).data;
    const weighing = (await make('penimbangan')).data;
    await api(`/jadwal/${weighing.id}`, { method: 'PATCH', token: tokenM, body: { jam_mulai: '13:00', jam_selesai: '14:30' } });
    const closed = await api(`/jadwal/${weighing.id}`, { method: 'PATCH', token: tokenM, body: { tersedia: false } });
    assert.equal(closed.data.status, 'tutup');
    const publicRows = (await api(`/jadwal?dari=${today}&sampai=${today}`)).data;
    assert.equal(publicRows.length, 3);
    assert.equal(publicRows.find(row => row.id === weighing.id).status, 'tutup');
    await api('/jadwal', { method: 'POST', token: tokenA, body: {}, expected: 403 });
    await api(`/jadwal/${weighing.id}`, { method: 'PATCH', token: tokenM, body: { tersedia: true, jam_mulai: null, jam_selesai: null }, expected: 400 });
  });
  await t.test('Setoran multijenis menghitung harga, pembulatan Rupiah, dan saldo langsung', async () => {
    direct = (await save(depositBody([{ jenis_sampah_id: 1, berat_kg: '1.125' }, { jenis_sampah_id: 3, berat_kg: '2.5' }]))).data;
    assert.equal(direct.nilai_setoran_rp, '11725');
    assert.equal(direct.berat_kg, '3.625');
    assert.equal(direct.pengelola_id, manager.id);
    assert.equal(direct.pengajuan_penjemputan_id, null);
    assert.equal(direct.rincian[0].subtotal_rp, '4725');
    assert.equal(direct.rincian[1].subtotal_rp, '7000');
    const rounded = (await save(depositBody([{ jenis_sampah_id: 5, berat_kg: '0.001' }]))).data;
    assert.equal(rounded.nilai_setoran_rp, '11'); // 0.001 * 10500 = 10.5 => 11.
    const balance = (await api('/saldo', { token: tokenA })).data;
    assert.equal(balance.saldo_rp, '11736');
    assert.equal(balance.total_kg, '3.626');
    assert.equal((await api('/saldo', { token: tokenB })).data.saldo_rp, '0');
  });
  await t.test('Retry bersamaan hanya menyimpan satu transaksi; perubahan isi/pengelola ditolak', async () => {
    const key = randomUUID();
    const [first, second] = await Promise.all([save(depositBody(), { key, expected: null }), save(depositBody(), { key, expected: null })]);
    assert.deepEqual([first.statusCode, second.statusCode].sort(), [200, 201]);
    assert.equal(first.data.setoran_id, second.data.setoran_id);
    assert.equal((await db.query('SELECT count(*) FROM setoran WHERE kunci_permintaan=$1', [key])).rows[0].count, '1');
    await save(depositBody([{ jenis_sampah_id: 1, berat_kg: '2' }]), { key, expected: 409 });
    await save(depositBody(), { key, token: tokenM2, expected: 409 });
    const retry = await save(depositBody([{ jenis_sampah_id: '1', berat_kg: '1.000' }]), { key, expected: 200 });
    assert.equal(retry.meta.replayed, true);
    assert.equal((await api('/saldo', { token: tokenA })).data.saldo_rp, '15936');
  });
  await t.test('Validasi penimbangan dan rollback ketika salah satu tarif belum ada', async () => {
    const key = randomUUID();
    await save(depositBody([{ jenis_sampah_id: 1, berat_kg: '1' }, { jenis_sampah_id: 8, berat_kg: '1' }]), { key, expected: 422 });
    assert.equal((await db.query('SELECT count(*) FROM setoran WHERE kunci_permintaan=$1', [key])).rows[0].count, '0');
    for (const berat_kg of ['0', '-2', '1.0001', 'NaN']) await save(depositBody([{ jenis_sampah_id: 1, berat_kg }]), { expected: 400 });
    await save(depositBody([{ jenis_sampah_id: 1, berat_kg: '1', harga_per_kg: 999999 }]), { expected: 400 });
    await save({ ...depositBody(), pengelola_id: manager2.id }, { expected: 400 });
    await save(depositBody([{ jenis_sampah_id: 1, berat_kg: '1' }, { jenis_sampah_id: 1, berat_kg: '2' }]), { expected: 400 });
    await save(depositBody(), { key: null, expected: 400 });
    await save(depositBody(undefined, { tanggal_setoran: shiftDays(today, 1) }), { expected: 400 });
    await save(depositBody(undefined, { nasabah_id: manager.id }), { expected: 422 });
  });
  await t.test('Tarif berubah sesuai tanggal; harga transaksi lama tetap tersimpan', async () => {
    const historical = (await save(depositBody(undefined, { tanggal_setoran: shiftDays(today, -100) }))).data;
    assert.equal(historical.nilai_setoran_rp, '4200');
    await api('/harga-sampah', { method: 'POST', token: tokenM, body: { jenis_sampah_id: 1, berlaku_mulai: today, harga_per_kg: 5000 }, expected: 201 });
    assert.equal((await api(`/jenis-sampah/1/harga?tanggal=${today}`)).data.harga_per_kg, '5000');
    assert.equal((await api(`/jenis-sampah/1/harga?tanggal=${shiftDays(today, -1)}`)).data.harga_per_kg, '4200');
    assert.equal((await api(`/setoran/${direct.setoran_id}`, { token: tokenA })).data.rincian[0].harga_per_kg, '4200');
    assert.equal((await save(depositBody([{ jenis_sampah_id: 1, berat_kg: '2' }]))).data.nilai_setoran_rp, '10000');
    await save(depositBody(undefined, { tanggal_setoran: `${Number(today.slice(0, 4)) - 1}-12-31` }));
  });
  await t.test('Kepemilikan rincian, pagination, pencarian, periode, dan saldo keseluruhan', async () => {
    await api(`/setoran/${direct.setoran_id}`, { token: tokenB, expected: 404 });
    assert.equal((await api('/setoran', { token: tokenB })).meta.total, 0);
    const all = await api('/setoran?limit=1&page=2', { token: tokenA });
    assert.equal(all.data.length, 1);
    assert.equal(all.meta.total, 6);
    assert.equal((await api('/setoran?page=999', { token: tokenA })).meta.total, 6);
    assert.equal((await api(`/setoran?search=${direct.kode_setoran}`, { token: tokenM })).data[0].setoran_id, direct.setoran_id);
    const initialBalance = (await api('/saldo', { token: tokenA })).data;
    assert.equal(initialBalance.saldo_rp, '34336');
    for (const periode of ['tiga_bulan', 'bulan_ini', 'tahun_ini']) {
      const filtered = await api(`/setoran?periode=${periode}`, { token: tokenA });
      const range = dateRange({ periode }, today);
      assert.ok(filtered.data.every(row => row.nasabah_id === a.id && row.tanggal_setoran >= range.dari && row.tanggal_setoran <= range.sampai));
      assert.ok(filtered.meta.total < all.meta.total);
    }
    assert.deepEqual((await api('/saldo', { token: tokenA })).data, initialBalance);
    assert.equal((await api(`/setoran?dari=${today}&sampai=${today}`, { token: tokenA })).meta.total, 4);
    assert.equal((await api(`/setoran?search=${encodeURIComponent("' OR 1=1 --")}`, { token: tokenM })).data.length, 0);
    await api('/setoran?nasabah_id=1', { token: tokenA, expected: 400 });
  });
  await t.test('Ringkasan menggunakan hari ini, akun aktif, dan hari berbeda dalam minggu berjalan', async () => {
    const summary = (await api('/ringkasan', { token: tokenM })).data;
    assert.equal(summary.pengelola.id, manager.id);
    assert.equal(summary.metrik.nilai_hari_ini_rp, '25936');
    assert.equal(summary.metrik.berat_hari_ini_kg, '6.626');
    assert.equal(summary.metrik.nasabah_aktif, '2');
    assert.equal(summary.metrik.hari_tersedia_minggu_ini, '1');
    assert.equal(summary.jadwal_hari_ini.length, 3);
    assert.equal(summary.transaksi_terbaru.length, 5);
  });
  await t.test('Pengajuan baru milik sesi; rincian dan daftar orang lain tidak dapat dibaca', async () => {
    await api('/pengajuan-penjemputan', { method: 'POST', token: tokenA, body: { ...pickupBody(), nasabah_id: b.id }, expected: 400 });
    const pickup = await createPickup();
    pickupId = pickup.id;
    assert.equal(pickup.status, 'menunggu');
    assert.equal(pickup.nasabah_id, a.id);
    await api(`/pengajuan-penjemputan/${pickupId}`, { token: tokenB, expected: 404 });
    assert.equal((await api('/pengajuan-penjemputan', { token: tokenB })).meta.total, 0);
    assert.equal((await api('/pengajuan-penjemputan?status=menunggu', { token: tokenM })).meta.total, 1);
    await save(depositBody(undefined, { pengajuan_penjemputan_id: pickupId }), { expected: 409 });
    await api(`/pengajuan-penjemputan/${pickupId}/setujui`, { method: 'POST', token: tokenA, body: { jadwal_layanan_id: pickupSchedule.id }, expected: 403 });
  });
  await t.test('Persetujuan memerlukan jadwal penjemputan yang tersedia; keputusan bersamaan konsisten', async () => {
    await api(`/pengajuan-penjemputan/${pickupId}/setujui`, { method: 'POST', token: tokenM, body: { jadwal_layanan_id: regularSchedule.id }, expected: 422 });
    const closed = (await api('/jadwal', { method: 'POST', token: tokenM, body: { layanan_kode: 'penjemputan', tanggal: today, tersedia: false }, expected: 201 })).data;
    await api(`/pengajuan-penjemputan/${pickupId}/setujui`, { method: 'POST', token: tokenM, body: { jadwal_layanan_id: closed.id }, expected: 422 });
    const beforeBalance = (await api('/saldo', { token: tokenA })).data.saldo_rp;
    const responses = await Promise.all([tokenM, tokenM2].map(token => api(`/pengajuan-penjemputan/${pickupId}/setujui`, { method: 'POST', token, body: { jadwal_layanan_id: pickupSchedule.id, catatan_pengelola: 'Siap dijemput' }, expected: null })));
    assert.deepEqual(responses.map(result => result.statusCode).sort(), [200, 409]);
    const winner = responses.find(result => result.statusCode === 200).data;
    assert.equal(winner.status, 'disetujui');
    assert.ok(winner.diproses_pada);
    assert.ok([manager.id, manager2.id].includes(winner.pengelola_id));
    assert.equal((await api('/saldo', { token: tokenA })).data.saldo_rp, beforeBalance);
    await api(`/jadwal/${pickupSchedule.id}`, { method: 'PATCH', token: tokenM, body: { tersedia: false }, expected: 409 });
    await api(`/jadwal/${pickupSchedule.id}`, { method: 'PATCH', token: tokenM, body: { tanggal: shiftDays(today, 1) }, expected: 409 });
    await api(`/jadwal/${pickupSchedule.id}`, { method: 'PATCH', token: tokenM, body: { catatan: 'Catatan operasional boleh berubah' } });
  });
  await t.test('Setoran penjemputan rollback utuh saat gagal lalu selesai atomik, maksimal satu transaksi', async () => {
    const body = depositBody([{ jenis_sampah_id: 3, berat_kg: '10' }], { pengajuan_penjemputan_id: pickupId });
    await save({ ...body, nasabah_id: b.id }, { expected: 422 });
    await save({ ...body, tanggal_setoran: shiftDays(today, -1) }, { expected: 422 });
    await save({ ...body, rincian: [{ jenis_sampah_id: 8, berat_kg: '10' }] }, { expected: 422 });
    assert.equal((await api(`/pengajuan-penjemputan/${pickupId}`, { token: tokenA })).data.status, 'disetujui');
    assert.equal((await db.query('SELECT count(*) FROM setoran WHERE pengajuan_penjemputan_id=$1', [pickupId])).rows[0].count, '0');
    const keys = [randomUUID(), randomUUID()];
    const responses = await Promise.all(keys.map(key => save(body, { key, expected: null })));
    assert.deepEqual(responses.map(result => result.statusCode).sort(), [201, 409]);
    const winnerIndex = responses.findIndex(result => result.statusCode === 201);
    assert.equal(responses[winnerIndex].data.nilai_setoran_rp, '28000');
    const retry = await save(body, { key: keys[winnerIndex], expected: 200 });
    assert.equal(retry.meta.replayed, true);
    const pickup = (await api(`/pengajuan-penjemputan/${pickupId}`, { token: tokenA })).data;
    assert.equal(pickup.status, 'selesai');
    assert.equal(pickup.setoran_id, retry.data.setoran_id);
    assert.equal((await api('/saldo', { token: tokenA })).data.saldo_rp, '62336');
    await save(body, { expected: 409 });
  });
  await t.test('Penolakan menyimpan alasan dan audit; persetujuan versus penolakan hanya satu pemenang', async () => {
    const rejected = await createPickup(tokenB);
    await api(`/pengajuan-penjemputan/${rejected.id}/tolak`, { method: 'POST', token: tokenM, body: {}, expected: 400 });
    await api(`/pengajuan-penjemputan/${rejected.id}/tolak`, { method: 'POST', token: tokenM, body: { catatan_pengelola: 'Di luar area' } });
    const owned = (await api(`/pengajuan-penjemputan/${rejected.id}`, { token: tokenB })).data;
    assert.equal(owned.status, 'ditolak');
    assert.equal(owned.catatan_pengelola, 'Di luar area');
    assert.equal(owned.pengelola_id, manager.id);
    assert.ok(owned.diproses_pada);
    const racing = await createPickup();
    const results = await Promise.all([
      api(`/pengajuan-penjemputan/${racing.id}/setujui`, { method: 'POST', token: tokenM, body: { jadwal_layanan_id: pickupSchedule.id }, expected: null }),
      api(`/pengajuan-penjemputan/${racing.id}/tolak`, { method: 'POST', token: tokenM2, body: { catatan_pengelola: 'Tidak tersedia petugas' }, expected: null }),
    ]);
    assert.deepEqual(results.map(result => result.statusCode).sort(), [200, 409]);
    const winner = results.find(result => result.statusCode === 200).data;
    assert.equal((await api(`/pengajuan-penjemputan/${racing.id}`, { token: tokenA })).data.status, winner.status);
  });
  await t.test('Menutup jadwal bersamaan dengan persetujuan tidak menghasilkan pengajuan ke jadwal tutup', async () => {
    const schedule = (await api('/jadwal', { method: 'POST', token: tokenM, body: { layanan_kode: 'penjemputan', tanggal: today, jam_mulai: '13:00', jam_selesai: '16:00' }, expected: 201 })).data;
    const pickup = await createPickup();
    const results = await Promise.all([
      api(`/jadwal/${schedule.id}`, { method: 'PATCH', token: tokenM, body: { tersedia: false }, expected: null }),
      api(`/pengajuan-penjemputan/${pickup.id}/setujui`, { method: 'POST', token: tokenM2, body: { jadwal_layanan_id: schedule.id }, expected: null }),
    ]);
    assert.equal(results.filter(result => result.statusCode === 200).length, 1);
    assert.ok(results.every(result => [200, 409, 422].includes(result.statusCode)));
    const state = (await db.query('SELECT p.status,j.tersedia FROM pengajuan_penjemputan p CROSS JOIN jadwal_layanan j WHERE p.id=$1 AND j.id=$2', [pickup.id, schedule.id])).rows[0];
    assert.ok(state.status !== 'disetujui' || state.tersedia);
  });
  await t.test('Ekspor XLSX mencakup semua halaman/filter dan teks tidak menjadi formula', async () => {
    await db.query('UPDATE akun SET nama=$1 WHERE id=$2', ['=2+2', a.id]);
    const filters = `search=${a.kode_akun}&dari=${today}&sampai=${today}&limit=1&page=2`;
    const list = await api(`/setoran?${filters}`, { token: tokenM });
    const response = await api(`/setoran/export.xlsx?${filters}`, { token: tokenM, raw: true });
    assert.match(response.headers.get('content-disposition'), /\.xlsx/);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
    assert.equal(book.getWorksheet('Riwayat').rowCount, list.meta.total + 1);
    assert.ok(list.meta.total > list.data.length);
    assert.ok(book.getWorksheet('Rincian').rowCount > book.getWorksheet('Riwayat').rowCount);
    assert.equal(book.getWorksheet('Riwayat').getCell('D2').value, '=2+2');
    assert.equal(book.getWorksheet('Riwayat').getCell('D2').type, ExcelJS.ValueType.String);
    assert.equal(book.getWorksheet('Riwayat').getCell('A2').value, today);
  });
  await t.test('Logout mencabut token; sesi kedaluwarsa dan akun nonaktif ditolak', async () => {
    await api('/auth/logout', { method: 'POST', token: tokenB });
    await api('/auth/me', { token: tokenB, expected: 401 });
    await api('/auth/logout', { method: 'POST', token: tokenB, expected: 401 });
    const session = (await api('/auth/login', { method: 'POST', body: { email: b.email, password } })).data;
    await db.query("UPDATE sesi_login SET dibuat_pada=now()-interval '2 days',kedaluwarsa_pada=now()-interval '1 day' WHERE token_hash=$1", [digest(session.token)]);
    await api('/auth/me', { token: session.token, expected: 401 });
    await db.query('UPDATE akun SET aktif=false WHERE id=$1', [a.id]);
    await api('/saldo', { token: tokenA, expected: 401 });
    await api('/auth/login', { method: 'POST', body: { email: a.email, password }, expected: 401 });
    await api('/auth/logout', { method: 'POST', token: tokenM });
    await api('/ringkasan', { token: tokenM, expected: 401 });
  });
});
