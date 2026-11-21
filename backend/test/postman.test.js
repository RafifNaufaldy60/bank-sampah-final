// Validasi lokal YAML/scripts; runner resmi tersedia lewat test:postman:integration.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { Script } from 'node:vm';
import YAML from 'yaml';

const root = new URL('../postman/Bank Sampah — Pengujian Backend Lokal/', import.meta.url);
const environment = YAML.parse(await readFile(new URL('../postman/Bank-Sampah-Local.environment.yaml', import.meta.url), 'utf8'));
const documents = [];
async function read(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const url = new URL(entry.name + (entry.isDirectory() ? '/' : ''), directory);
    if (entry.isDirectory()) await read(url);
    else if (entry.name.endsWith('.yaml')) documents.push({ name: entry.name, value: YAML.parse(await readFile(url, 'utf8')) });
  }
}
await read(root);
const requests = documents.filter(d => d.name.endsWith('.request.yaml'));
const routeSource = await readFile(new URL('../src/routes/api.js', import.meta.url), 'utf8');
const routes = [...routeSource.matchAll(/router\.(get|post|patch)\('([^']+)'/g)].map(m => ({ method: m[1].toUpperCase(), path: m[2] }));
const names = new Set(environment.values.map(v => v.key));

test('79 request YAML v3 sesuai routes; 55 request fitur lama tetap tersedia', () => {
  assert.equal(requests.length, 79);
  assert.equal(requests.filter(r => /^\d\d —/.test(r.name)).length, 55);
  for (const { name, value } of requests) {
    assert.equal(value.$kind, 'http-request');
    const path = value.url.replace('{{base_url}}', '').split('?')[0].replace(/\{\{[^}]+\}\}/g, ':id').replace('/9223372036854775807', '/:id');
    assert.ok(routes.some(r => r.method === value.method && r.path === path), name);
    assert.ok(['noauth', 'bearer'].includes(value.auth.type));
    assert.deepEqual(value.scripts.map(s => s.type), ['beforeRequest', 'afterResponse']);
    assert.ok(value.scripts[1].code.includes('pm.response.to.have.status('), name);
  }
});

test('YAML dan JavaScript valid, seluruh variabel tersedia, tidak ada kredensial nyata', () => {
  assert.equal(names.size, environment.values.length);
  for (const { value } of documents) {
    for (const script of value.scripts || []) new Script(script.code);
    for (const match of JSON.stringify(value).matchAll(/\{\{([^}]+)\}\}/g)) {
      assert.ok(names.has(match[1]) || ['$guid', 'request_body'].includes(match[1]), match[1]);
    }
  }
  for (const item of environment.values) {
    if (item.key.endsWith('_password') || item.key.startsWith('token_')) assert.ok(item.value === '' || /^<[^>]+>$/.test(item.value), item.key);
  }
  for (const key of ['token_ketua_1', 'token_ketua_2', 'token_pengelola', 'token_nasabah']) assert.ok(names.has(key));
  assert.equal(environment.values.find(v => v.key === 'test_database_confirmed').value, 'false');
});
