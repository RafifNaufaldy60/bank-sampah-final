// Verifikasi artefak Postman secara lokal. Tidak mengakses HTTP, Neon, atau npm.
// Fixture respons menguji skrip collection, bukan menggantikan uji backend/Newman.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script, createContext } from 'node:vm';
import { randomUUID } from 'node:crypto';
import * as validation from '../src/utils/validation.js';

const collection = JSON.parse(await readFile(new URL('../postman/Bank-Sampah.postman_collection.json', import.meta.url), 'utf8'));
const environment = JSON.parse(await readFile(new URL('../postman/Bank-Sampah-Local.postman_environment.json', import.meta.url), 'utf8'));
const requests = collection.item.flatMap(folder => folder.item);
const routeSource = await readFile(new URL('../src/routes/api.js', import.meta.url), 'utf8');
const routes = [...routeSource.matchAll(/router\.(get|post|patch)\('([^']+)'/g)].map(match => ({ method: match[1].toUpperCase(), path: match[2] }));
const variableNames = new Set(environment.values.map(item => item.key));

test('Collection v2.1 memiliki 55 request berurutan yang sesuai routes backend', () => {
  assert.equal(collection.info.schema, 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json');
  assert.equal(collection.item.length, 9);
  assert.equal(requests.length, 55);
  requests.forEach((item, index) => {
    assert.ok(item.name.startsWith(String(index + 1).padStart(2, '0')));
    const requestPath = item.request.url.replace('{{base_url}}', '').split('?')[0].replace(/\{\{[^}]+\}\}/g, ':id');
    assert.ok(routes.some(route => route.method === item.request.method && route.path === requestPath), item.name);
    assert.ok(item.request.description.includes('Hasil yang diharapkan: HTTP'));
    assert.deepEqual(item.event.map(event => event.listen), ['prerequest', 'test']);
    assert.ok(['bearer', 'noauth'].includes(item.request.auth.type));
  });
  assert.equal(requests[1].request.auth.type, 'noauth');
  assert.equal(requests[28].request.auth.bearer[0].value, '{{token_nasabah_lain}}');
  assert.equal(requests[28].request.url, requests[27].request.url);
});

test('JSON, variabel, dan 111 skrip valid; file ekspor hanya berisi placeholder rahasia', () => {
  assert.equal(variableNames.size, environment.values.length);
  assert.equal(environment.values.find(item => item.key === 'base_url').value, 'http://localhost:3000/api');
  assert.equal(environment._postman_variable_scope, 'environment');
  for (const item of environment.values) {
    if (item.key.endsWith('_password') || item.key.startsWith('token_')) {
      assert.equal(item.type, 'secret');
      assert.match(item.value, /^<[^>]+>$/);
    }
  }
  let count = 0;
  for (const item of [collection, ...requests]) {
    for (const event of item.event) {
      new Script(event.script.exec.join('\n'), { filename: item.name || 'collection' });
      count++;
    }
  }
  assert.equal(count, 111);
  const source = JSON.stringify(collection);
  for (const match of source.matchAll(/\{\{([^}]+)\}\}/g)) assert.ok(variableNames.has(match[1]) || ['$guid', 'request_body'].includes(match[1]), match[1]);
  assert.equal(source.includes('console.log'), false);
  assert.equal(source.includes('pm.request.body.update'), false); // Body immutable menurut API Postman.
});

// Shim kecil untuk metode pm yang benar-benar digunakan oleh skrip ini.
function expectation(actual, negated = false) {
  const check = (condition, label) => assert.ok(negated ? !condition : condition, label);
  const include = expected => check(actual.includes(expected), 'include');
  include.members = expected => check(expected.every(value => actual.includes(value)), 'include.members');
  return new Proxy({}, { get(target, key) {
    if (['to', 'be', 'have'].includes(key)) return expectation(actual, negated);
    if (key === 'not') return expectation(actual, !negated);
    if (key === 'eql') return expected => check(actual === expected, 'eql');
    if (key === 'match') return regex => check(regex.test(actual), 'match');
    if (key === 'property') return name => check(Object.hasOwn(actual, name), 'property');
    if (key === 'a' || key === 'an') return type => check(type === 'array' ? Array.isArray(actual) : typeof actual === type, 'type');
    if (key === 'include') return include;
    throw new Error(`Metode assertion belum didukung: ${String(key)}`);
  } });
}
function session() {
  const values = new Map(environment.values.map(item => [item.key, item.value]));
  const locals = new Map();
  const credentials = 'Sandi-Uji-"kutip"-\\-123\nbaris';
  for (const key of ['pengelola_password', 'nasabah_password', 'nasabah_lain_password']) values.set(key, credentials);
  const state = { values, locals, credentials, assertions: 0 };
  state.replace = value => value.replace(/\{\{([^}]+)\}\}/g, (original, key) => {
    if (key === '$guid') return randomUUID();
    return locals.has(key) ? locals.get(key) : values.has(key) ? values.get(key) : original;
  });
  return state;
}
function runScript(event, state, response) {
  const failures = [];
  let skipped = false;
  const pm = {
    environment: { get: key => state.values.get(key), set: (key, value) => state.values.set(key, value) },
    variables: { get: key => state.locals.get(key) ?? state.values.get(key), set: (key, value) => state.locals.set(key, value), replaceIn: state.replace },
    execution: { skipRequest: () => { skipped = true; } },
    expect: value => expectation(value),
    test: (name, callback) => { state.assertions++; try { callback(); } catch (error) { failures.push(`${name}: ${error.message} (${error.stack?.split('\n').find(line => line.includes('evalmachine'))?.trim() || 'assertion'})`); } },
    response: response ? {
      code: response.code,
      json: () => structuredClone(response.json),
      text: () => response.text || JSON.stringify(response.json),
      responseSize: response.text?.length || 100,
      headers: { get: name => response.headers?.[name] || (name === 'Content-Type' ? 'application/json; charset=utf-8' : null) },
      to: { have: { status: expected => assert.equal(response.code, expected) } },
    } : undefined,
  };
  new Script(event.script.exec.join('\n')).runInContext(createContext({ pm }), { timeout: 1000 });
  return { failures, skipped };
}
function pre(item, state) {
  runScript(collection.event[0], state);
  runScript(item.event[0], state);
  return item.request.body ? JSON.parse(state.replace(item.request.body.raw)) : undefined;
}
function post(number, state, data, code = 200, extra = {}) {
  const response = { code, json: { data, ...extra } };
  const result = runScript(requests[number - 1].event[1], state, response);
  assert.deepEqual(result.failures, [], `Post-response ${number} gagal: ${result.failures.join(', ')}`);
  return response;
}

test('Skrip prasyarat menolak placeholder dan JSON password karakter khusus tetap valid', () => {
  const state = session();
  pre(requests[0], state);
  const body = pre(requests[2], state);
  assert.equal(body.password, state.credentials);
  validation.password(body.password);
  validation.email(body.email);
  assert.ok(body.nama.startsWith('POSTMAN UJI A '));
  state.values.set('nasabah_password', '<BELUM_DIISI>');
  assert.throws(() => pre(requests[2], state), /nasabah_password/);
});

test('Seluruh 55 request menjalankan skrip dengan fixture lokal sesuai bentuk JSON backend', () => {
  const state = session();
  const env = key => state.values.get(key);
  const tokens = { pengelola: 'm'.repeat(43), nasabah: 'a'.repeat(43), nasabah_lain: 'b'.repeat(43) };
  let accounts, direct, pickup, application, rejection, currentSchedule;
  const initial = '9007199254740993'; // Memastikan saldo di atas batas Number aman tetap tepat.
  const baseKg = '10.125';
  const balances = value => ({ nasabah_id: env('nasabah_id'), saldo_rp: (BigInt(initial) + BigInt(value)).toString(), total_kg: value === 0 ? baseKg : value === 14500 ? '13.875' : '23.875' });
  const metaBalance = { meta: { periode_saldo: 'sepanjang_waktu' } };
  const deposit = (body, pickupResult = false) => ({
    setoran_id: pickupResult ? '102' : '101', kode_setoran: pickupResult ? 'TRX-UJI-102' : 'TRX-UJI-101',
    nasabah_id: env('nasabah_id'), pengelola_id: env('pengelola_id'), tanggal_setoran: body.tanggal_setoran,
    status: 'Terverifikasi', pengajuan_penjemputan_id: body.pengajuan_penjemputan_id,
    nilai_setoran_rp: pickupResult ? '42000' : '14500', berat_kg: pickupResult ? '10.000' : '3.750',
    rincian: body.rincian.map(item => ({ jenis_sampah_id: Number(item.jenis_sampah_id), berat_kg: item.berat_kg,
      harga_per_kg: item.jenis_sampah_id === '1' ? '4200' : '3200', subtotal_rp: pickupResult ? '42000' : item.jenis_sampah_id === '1' ? '10500' : '4000' })),
  });
  const errors = { 2: [401,'BELUM_LOGIN'],10: [403,'AKSES_DITOLAK'],22: [400,'VALIDASI_GAGAL'],25: [409,'KUNCI_BERBEDA_ISI'],29: [404,'TIDAK_DITEMUKAN'],34: [422,'JADWAL_TIDAK_VALID'],44: [404,'TIDAK_DITEMUKAN'],49: [403,'AKSES_DITOLAK'],51: [401,'SESI_TIDAK_VALID'],53: [401,'SESI_TIDAK_VALID'],55: [401,'SESI_TIDAK_VALID'] };
  for (const [index, item] of requests.entries()) {
    const n = index + 1;
    const body = pre(item, state);
    if (item.request.auth.type === 'bearer') assert.match(state.replace(item.request.auth.bearer[0].value), /^[A-Za-z0-9_-]{43}$/);
    if (errors[n]) {
      const [code, error] = errors[n];
      if (n === 22) assert.throws(() => validation.weight(body.rincian[0].berat_kg));
      if (n === 25) assert.notEqual(body.rincian[0].berat_kg, JSON.parse(env('body_setoran')).rincian[0].berat_kg);
      post(n, state, undefined, code, { error: { code: error, message: 'Pesan error fixture' }, request_id: randomUUID() });
      continue;
    }
    switch (n) {
      case 1:
        post(n, state, undefined, 200, { status: 'ok', message: 'Terhubung ke PostgreSQL.' });
        accounts = {
          pengelola: { id: '1', peran: 'pengelola', email: env('pengelola_email'), nama: 'POSTMAN UJI PENGELOLA', aktif: true },
          nasabah: { id: '9007199254740993', kode_akun: 'NSB-9007199254740993', peran: 'nasabah', email: env('nasabah_email'), nama: env('nasabah_nama'), aktif: true },
          nasabah_lain: { id: '9007199254740994', kode_akun: 'NSB-9007199254740994', peran: 'nasabah', email: env('nasabah_lain_email'), nama: env('nasabah_lain_nama'), aktif: true },
        };
        break;
      case 3: case 4: post(n, state, n === 3 ? accounts.nasabah : accounts.nasabah_lain, 201); break;
      case 5: case 6: case 7: {
        const role = ['pengelola','nasabah','nasabah_lain'][n - 5];
        assert.equal(body.password, state.credentials);
        post(n, state, { akun: accounts[role], token: tokens[role], token_type: 'Bearer', expires_at: new Date(Date.now() + 86400000).toISOString() });
        break;
      }
      case 8: case 9: post(n, state, n === 8 ? accounts.pengelola : accounts.nasabah); break;
      case 11: post(n, state, [
        { id:1, harga_per_kg:'4200', satuan:'kg', panduan:'Bersihkan', status_tarif:'tersedia' },
        { id:2, harga_per_kg:'3200', satuan:'kg', panduan:'Pisahkan', status_tarif:'tersedia' },
        { id:8, harga_per_kg:null, satuan:'kg', panduan:'Tutup botol', status_tarif:'belum_ditetapkan' },
      ], 200, { meta: { tanggal: env('tanggal_uji'), zona_waktu:'Asia/Jakarta' } }); break;
      case 12: case 13: post(n, state, { id: n === 12 ? 1 : 2, harga_per_kg: n === 12 ? '4200' : '3200', status_tarif:'tersedia' }, 200, { meta: { tanggal:env('tanggal_uji') } }); break;
      case 14: post(n, state, ['setoran_umum','penimbangan','penjemputan'].map(kode => ({ kode }))); break;
      case 15: post(n, state, [], 200, { meta: { total:0 } }); break;
      case 16: case 19:
        currentSchedule = { ...body, id: n === 16 ? '10' : '11', pengelola_id: env('pengelola_id'), status:'tersedia' };
        post(n, state, currentSchedule, 201); break;
      case 17: currentSchedule = { ...currentSchedule, ...body, status:'tutup' }; post(n, state, currentSchedule); break;
      case 18: post(n, state, [currentSchedule], 200, { meta:{total:1} }); break;
      case 20: post(n, state, [accounts.nasabah]); break;
      case 21: post(n, state, balances(0), 200, metaBalance); break;
      case 23:
        for (const line of body.rincian) { validation.weight(line.berat_kg); validation.id(line.jenis_sampah_id); }
        assert.equal(body.nasabah_id, accounts.nasabah.id);
        direct = deposit(body);
        post(n, state, direct, 201, { meta: { replayed:false } });
        // Saldo awal tidak tertimpa saat request snapshot dikirim ulang setelah ada transaksi.
        post(21, state, balances(14500), 200, metaBalance);
        assert.equal(env('saldo_awal'), initial);
        // Perubahan form tidak boleh mengubah body request retry yang telah dibekukan.
        state.values.set('berat_1_kg', '999.000');
        break;
      case 24:
        assert.deepEqual(body, JSON.parse(env('body_setoran')));
        assert.equal(body.rincian[0].berat_kg, '2.500');
        post(n, state, direct, 200, { meta: { replayed:true } }); break;
      case 26: case 37: post(n, state, balances(14500), 200, metaBalance); break;
      case 27: post(n, state, [direct], 200, { meta:{zona_waktu:'Asia/Jakarta'} }); break;
      case 28: post(n, state, direct); break;
      case 30: post(n, state, [], 200, { meta:{total:0} }); break;
      case 31:
        application = { ...body, id:'20', nasabah_id:env('nasabah_id'), status:'menunggu', jadwal_layanan_id:null, pengelola_id:null, setoran_id:null };
        post(n, state, application, 201); break;
      case 32: post(n, state, [application]); break;
      case 33: post(n, state, application); break;
      case 35:
        application = { ...application, ...body, status:'disetujui', tanggal_dijadwalkan:env('tanggal_uji'), pengelola_id:env('pengelola_id'), diproses_pada:new Date().toISOString() };
        post(n, state, application); break;
      case 36: post(n, state, application); break;
      case 38: pickup = deposit(body, true); post(n, state, pickup, 201, { meta:{replayed:false} }); break;
      case 39: post(n, state, { ...application, status:'selesai', setoran_id:pickup.setoran_id }); break;
      case 40: post(n, state, balances(56500), 200, metaBalance); break;
      case 41:
        rejection = { ...body, id:'21', nasabah_id:env('nasabah_lain_id'), status:'menunggu', jadwal_layanan_id:null, pengelola_id:null, setoran_id:null };
        post(n, state, rejection, 201); break;
      case 42: rejection = { ...rejection, ...body, status:'ditolak', pengelola_id:env('pengelola_id'), diproses_pada:new Date().toISOString() }; post(n, state, rejection); break;
      case 43: post(n, state, rejection); break;
      case 45: case 46: post(n, state, [n === 45 ? pickup : direct], 200, { meta:{page:n - 44,limit:1,total:2,total_pages:2} }); break;
      case 47: post(n, state, { pengelola:accounts.pengelola, periode:{zona_waktu:'Asia/Jakarta'}, metrik:{hari_ini:env('tanggal_uji'),nilai_hari_ini_rp:'56500',nasabah_aktif:'2'}, transaksi_terbaru:[pickup,direct], jadwal_hari_ini:[] }); break;
      case 48: {
        const result = runScript(item.event[1], state, { code:200,text:'PK\x03\x04fixture',headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="uji.xlsx"'} });
        assert.deepEqual(result.failures, []); break;
      }
      case 50: case 52: case 54: post(n, state, { message:'Logout berhasil.' }); break;
      default: assert.fail(`Fixture request ${n} belum tersedia.`);
    }
  }
  for (const role of ['pengelola','nasabah','nasabah_lain']) {
    assert.equal(env(`token_${role}`), '');
    assert.equal(env(`token_${role}_dicabut`), '');
  }
  assert.equal(env('nilai_setoran'), '14500');
  assert.equal(env('nilai_setoran_penjemputan'), '42000');
  assert.notEqual(env('pengajuan_id'), env('pengajuan_tolak_id'));
  assert.notEqual(env('kunci_permintaan'), env('kunci_permintaan_penjemputan'));
  assert.equal(env('jumlah_ekspor_diharapkan'), '2');
  assert.ok(state.assertions >= 160);
});

test('Test saldo menangkap kredit duplikat dan respons milik pengguna lain', () => {
  const state = session();
  for (const [key,value] of Object.entries({nasabah_id:'12',saldo_awal:'9007199254740993',berat_awal:'0',nilai_setoran:'14500',berat_setoran:'3.750'})) state.values.set(key,value);
  const bad = { code:200, json:{data:{nasabah_id:'12',saldo_rp:(9007199254740993n + 29000n).toString(),total_kg:'3.750'},meta:{periode_saldo:'sepanjang_waktu'}} };
  assert.equal(runScript(requests[25].event[1], state, bad).failures.length, 1);
  bad.json.data.saldo_rp = (9007199254740993n + 14500n).toString();
  bad.json.data.nasabah_id = '13';
  assert.equal(runScript(requests[25].event[1], state, bad).failures.length, 1);
});
