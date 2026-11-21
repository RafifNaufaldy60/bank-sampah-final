// Menjalankan CLI resmi hanya terhadap fixture PostgreSQL terpisah dan server sementara.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import YAML from 'yaml';
import { isolatedDatabase } from '../test/helpers/isolated-db.js';
import { bootstrapChairs } from '../src/services/chair-bootstrap.js';
import { createApp } from '../src/app.js';

const cli = process.env.POSTMAN_CLI_PATH;
if (!cli) throw new Error('POSTMAN_CLI_PATH wajib menunjuk executable CLI resmi atau postman.bundled.js, bukan aplikasi GUI.');
let fixture, server, directory;
try {
  fixture = await isolatedDatabase();
  const password = randomBytes(24).toString('base64url');
  await bootstrapChairs(fixture.db, [1,2].map(n => ({ mode: 'create', nama: `Ketua Uji ${n}`, email: `ketua${n}@example.test`, password })));
  server = createApp(fixture.db, { origins: [], sessionHours: 24 }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const env = YAML.parse(await readFile(new URL('../postman/Bank-Sampah-Local.environment.yaml', import.meta.url), 'utf8'));
  for (const variable of env.values) {
    if (variable.key.endsWith('_password')) variable.value = password;
    if (/^ketua_[12]_email$/.test(variable.key)) variable.value = `ketua${variable.key[6]}@example.test`;
    if (variable.key === 'base_url') variable.value = `http://127.0.0.1:${server.address().port}/api`;
    if (variable.key === 'test_database_confirmed') variable.value = 'true';
  }
  directory = await mkdtemp(join(tmpdir(), 'bs-postman-test-'));
  const envPath = join(directory, 'test.environment.yaml');
  await writeFile(envPath, YAML.stringify(env));
  const collection = fileURLToPath(new URL('../postman/Bank Sampah — Pengujian Backend Lokal/', import.meta.url));
  const command = cli.endsWith('.js') ? process.execPath : cli;
  const args = [...(cli.endsWith('.js') ? [cli] : []), 'collection', 'run', collection, '-e', envPath, '--no-report-events', '--bail'];
  const child = spawn(command, args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  // CLI default hanya menampilkan request/assertion, bukan header autentikasi/body.
  child.stdout.on('data', chunk => process.stdout.write(chunk.toString().replaceAll(password, '[REDACTED]')));
  child.stderr.on('data', chunk => process.stderr.write(chunk.toString().replaceAll(password, '[REDACTED]')));
  const [code] = await once(child, 'close');
  process.exitCode = code ?? 1;
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (fixture) await fixture.cleanup();
  if (directory && dirname(resolve(directory)) === resolve(tmpdir()) && basename(directory).startsWith('bs-postman-test-')) {
    await rm(directory, { recursive: true, force: true });
  }
}
