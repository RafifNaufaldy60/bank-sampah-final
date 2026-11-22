// READ ONLY, tidak membaca nama/email/password/token. Snapshot lama fixture tidak ditimpa.
import { writeFile, readFile } from 'node:fs/promises';
import { createDatabase } from '../src/db.js';
import { digest } from '../src/utils/security.js';

const db = createDatabase();
try {
  const report = await db.transaction(async client => {
    const result = { inspected_at: new Date().toISOString(), mode: 'READ ONLY' };
    const queries = {
      target: 'SELECT current_database() AS database,current_schema() AS schema,current_setting(\'server_version\') AS version',
      columns: "SELECT column_name,data_type,udt_name,is_nullable,column_default,is_identity,identity_generation,is_generated,generation_expression FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='akun' ORDER BY ordinal_position",
      constraints: "SELECT conname,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid='akun'::regclass ORDER BY conname",
      indexes: "SELECT indexname,indexdef FROM pg_indexes WHERE schemaname=current_schema() AND tablename='akun' ORDER BY indexname",
      triggers: "SELECT pg_get_triggerdef(oid) AS definition FROM pg_trigger WHERE tgrelid='akun'::regclass AND NOT tgisinternal",
      tables: 'SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() ORDER BY table_name',
      legacy_status_counts: 'SELECT peran,aktif,count(*)::int AS count FROM akun GROUP BY peran,aktif ORDER BY peran,aktif',
    };
    for (const [name, sql] of Object.entries(queries)) result[name] = (await client.query(sql)).rows;
    result.migrations = [];
    if (result.tables.some(row => row.table_name === 'schema_migrations')) {
      for (const row of (await client.query('SELECT nama,checksum FROM schema_migrations ORDER BY nama')).rows) {
        if (!/^\d+_[a-z0-9_]+\.sql$/.test(row.nama)) throw new Error('Nama migration tidak valid.');
        const sql = await readFile(new URL(`../migrations/${row.nama}`, import.meta.url), 'utf8');
        result.migrations.push({ name: row.nama, checksum_matches_repository: digest(sql.replace(/\r\n/g, '\n')) === row.checksum });
      }
    }
    return result;
  }, { readOnly: true, repeatableRead: true });
  if (process.argv.includes('--save')) {
    await writeFile(new URL('../docs/account-inspection.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
    console.log('Snapshot read-only akun tersimpan; tanpa identitas akun atau kredensial.');
  } else console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error('Inspeksi akun gagal. Kode:', /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'INSPECTION_ERROR');
  process.exitCode = 1;
} finally { await db.close(); }
