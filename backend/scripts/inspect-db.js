// Hanya metadata dan data referensi publik. Tidak membaca identitas atau sandi akun.
import pg from 'pg';
import { mkdir, writeFile } from 'node:fs/promises';
import { config } from '../src/config.js';
import { connectionString } from '../src/db.js';
const client = new pg.Client({ connectionString: connectionString(config.databaseUrl), connectionTimeoutMillis: 15000 });
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const queries = {
    server: "SELECT current_setting('server_version') AS version, current_setting('TimeZone') AS timezone",
    columns: "SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default,character_maximum_length,numeric_precision,numeric_scale,is_identity,identity_generation,is_generated,generation_expression FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position",
    table_columns: "SELECT c.relname AS table_name,a.attname AS column_name,format_type(a.atttypid,a.atttypmod) AS sql_type,a.attnotnull AS not_null,a.attidentity AS identity,a.attgenerated AS generated,pg_get_expr(d.adbin,d.adrelid) AS expression FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum",
    constraints: "SELECT c.relname AS table_name, con.conname AS name,pg_get_constraintdef(con.oid) AS definition FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' ORDER BY c.relname,con.conname",
    indexes: "SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public'",
    enums: "SELECT t.typname,e.enumlabel,e.enumsortorder FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder",
    functions: "SELECT p.proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid=p.oid AND d.deptype='e') ORDER BY p.proname",
    views: "SELECT viewname,definition FROM pg_views WHERE schemaname='public' ORDER BY viewname",
    triggers: "SELECT c.relname AS table_name,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal",
    jenis_sampah: 'SELECT * FROM jenis_sampah ORDER BY 1',
    layanan: 'SELECT * FROM layanan ORDER BY 1',
    harga_sampah: 'SELECT jenis_sampah_id,berlaku_mulai::text,harga_per_kg FROM harga_sampah ORDER BY 1,2',
    counts: 'SELECT (SELECT count(*) FROM akun) AS akun,(SELECT count(*) FROM setoran) AS setoran,(SELECT count(*) FROM pengajuan_penjemputan) AS pengajuan,(SELECT count(*) FROM jadwal_layanan) AS jadwal,(SELECT count(*) FROM harga_sampah) AS harga',
  };
  const report = {};
  for (const [name, sql] of Object.entries(queries)) report[name] = (await client.query(sql)).rows;
  await client.query('ROLLBACK');
  if (process.argv.includes('--save')) {
    const directory = new URL('../docs/', import.meta.url);
    await mkdir(directory, { recursive: true });
    await writeFile(new URL('database-inspection.json', directory), JSON.stringify(report, null, 2) + '\n');
    console.log('Metadata tersimpan di docs/database-inspection.json; tanpa data pribadi akun.');
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
} catch (error) {
  console.error('Pemeriksaan database gagal. Kode:', /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'CONNECTION_ERROR');
  process.exitCode = 1;
} finally { await client.end(); }
