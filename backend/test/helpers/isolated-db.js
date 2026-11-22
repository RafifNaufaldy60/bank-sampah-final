import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createDatabase, connectionString } from '../../src/db.js';
import { config } from '../../src/config.js';
import { migrate } from '../../src/migrate.js';

// Menyalin DEFINISI dari inspeksi, bukan data akun/transaksi, bukan LIKE INCLUDING DEFAULTS
// (yang bisa menyimpan referensi sequence public). Tidak ada fallback search_path ke public.
export async function isolatedDatabase({ beforeMigration } = {}) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error('TEST_DATABASE_URL wajib: tidak ada fallback ke DATABASE_URL.');
  const target = new URL(connectionString(url));
  const production = config.databaseUrl ? new URL(connectionString(config.databaseUrl)) : null;
  const host = value => value.hostname.replace('-pooler.', '.');
  if (production && host(target) === host(production) && target.port === production.port && target.pathname === production.pathname) {
    throw new Error('Database pengujian harus terpisah dari DATABASE_URL proyek.');
  }
  const admin = new pg.Client({ connectionString: connectionString(url), connectionTimeoutMillis: 15000 });
  const schema = `bs_test_${Date.now()}_${randomBytes(6).toString('hex')}`;
  let created = false;
  let db;
  const cleanup = async () => {
    if (db) await db.close();
    if (created && /^bs_test_\d+_[a-f0-9]{12}$/.test(schema)) {
      await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      created = false;
    }
    await admin.end();
  };
  try {
    await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    created = true;
    db = createDatabase({ url, schema });
    const snapshot = JSON.parse(await readFile(new URL('../../docs/database-inspection.json', import.meta.url), 'utf8'));
    const tables = [...new Set(snapshot.table_columns.map(column => column.table_name))];
    const statements = [];
    for (const table of tables) {
      const columns = snapshot.table_columns.filter(column => column.table_name === table).map(column => {
        let sql = `"${column.column_name}" ${column.sql_type}`;
        if (column.identity) sql += ` GENERATED ${column.identity === 'a' ? 'ALWAYS' : 'BY DEFAULT'} AS IDENTITY`;
        else if (column.generated) sql += ` GENERATED ALWAYS AS (${column.expression}) STORED`;
        else if (column.expression) sql += ` DEFAULT ${column.expression}`;
        if (column.not_null) sql += ' NOT NULL';
        return sql;
      });
      statements.push(`CREATE TABLE "${table}" (${columns.join(',')})`);
    }
    const constraints = snapshot.constraints.filter(row => !row.definition.startsWith('NOT NULL'));
    constraints.sort((a, b) => Number(a.definition.startsWith('FOREIGN KEY')) - Number(b.definition.startsWith('FOREIGN KEY')));
    for (const row of constraints) statements.push(`ALTER TABLE "${row.table_name}" ADD CONSTRAINT "${row.name}" ${row.definition}`);
    const constraintNames = new Set(constraints.map(row => row.name));
    for (const row of snapshot.indexes) if (!constraintNames.has(row.indexname)) statements.push(row.indexdef.replaceAll('public.', `"${schema}".`));
    for (const row of snapshot.functions) statements.push(row.definition.replaceAll('public.', `"${schema}".`).replace("TO 'public', 'pg_temp'", `TO '${schema}', 'pg_temp'`));
    for (const name of ['v_harga_terkini', 'v_riwayat_setoran', 'v_saldo_nasabah', 'v_ringkasan_pengelola']) {
      const view = snapshot.views.find(row => row.viewname === name);
      statements.push(`CREATE VIEW "${name}" AS ${view.definition}`);
    }
    const sql = statements.join(';\n');
    if (/\bpublic[.']/.test(sql)) throw new Error('Fixture tidak boleh merujuk schema public.');
    await db.transaction(async client => {
      await client.query(sql);
      for (const row of snapshot.jenis_sampah) await client.query('INSERT INTO jenis_sampah(id,nama,kategori,panduan) OVERRIDING SYSTEM VALUE VALUES($1,$2,$3,$4)', [row.id, row.nama, row.kategori, row.panduan]);
      for (const row of snapshot.layanan) await client.query('INSERT INTO layanan(kode,nama,lokasi_atau_area,hari_rutin,syarat) VALUES($1,$2,$3,$4,$5)', [row.kode, row.nama, row.lokasi_atau_area, row.hari_rutin, row.syarat]);
      for (const row of snapshot.harga_sampah) await client.query("INSERT INTO harga_sampah VALUES($1,'2020-01-01',$2)", [row.jenis_sampah_id, row.harga_per_kg]);
    });
    if (beforeMigration) await beforeMigration(db);
    await migrate(db);
    const crossReferences = (await db.query(`SELECT count(*) FROM pg_constraint c JOIN pg_class referenced ON referenced.oid=c.confrelid
      WHERE c.connamespace=$1::regnamespace AND referenced.relnamespace <> $1::regnamespace`, [schema])).rows[0].count;
    if (crossReferences !== '0') throw new Error('Fixture memiliki foreign key di luar schema uji.');
    return { db, cleanup, schema };
  } catch (error) { await cleanup(); throw error; }
}
