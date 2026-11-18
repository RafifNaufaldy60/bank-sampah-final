import { readdir, readFile } from 'node:fs/promises';
import { digest } from './utils/security.js';

export async function migrate(db) {
  const directory = new URL('../migrations/', import.meta.url);
  const files = (await readdir(directory)).filter(name => /^\d+_.+\.sql$/.test(name)).sort();
  return db.transaction(async client => {
    await client.query("SELECT pg_advisory_xact_lock(hashtextextended(current_schema() || ':migrations', 0))");
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      nama text PRIMARY KEY, checksum text NOT NULL, diterapkan_pada timestamptz NOT NULL DEFAULT now())`);
    const applied = [];
    for (const file of files) {
      const sql = await readFile(new URL(file, directory), 'utf8');
      const checksum = digest(sql.replace(/\r\n/g, '\n'));
      const previous = (await client.query('SELECT checksum FROM schema_migrations WHERE nama=$1', [file])).rows[0];
      if (previous) {
        if (previous.checksum !== checksum) throw new Error('Migrasi yang telah diterapkan berubah; buat migrasi baru.');
        continue;
      }
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations(nama,checksum) VALUES($1,$2)', [file, checksum]);
      applied.push(file);
    }
    return applied;
  });
}
