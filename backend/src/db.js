import pg from 'pg';
import { config } from './config.js';

// DATE bukan waktu UTC. BIGINT dan NUMERIC tetap string agar presisi tidak hilang.
pg.types.setTypeParser(1082, value => value);

export function connectionString(value) {
  if (!value) throw new Error('Isi DATABASE_URL di backend/.env terlebih dahulu.');
  let url;
  try {
    url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error();
  } catch {
    // TypeError asli URL dapat memuat input (termasuk kredensial); jangan teruskan.
    throw new Error('DATABASE_URL harus berupa connection string PostgreSQL yang valid.');
  }
  if (['prefer', 'require', 'verify-ca'].includes(url.searchParams.get('sslmode'))) {
    url.searchParams.set('sslmode', 'verify-full');
  }
  return url.toString();
}

export function createDatabase({ url = config.databaseUrl, schema = 'public' } = {}) {
  // Schema tambahan hanya untuk pengujian. Jangan mengambil identifier SQL dari HTTP.
  if (!/^(public|bs_test_[a-z0-9_]+)$/.test(schema)) throw new Error('Schema tidak diizinkan.');
  const pool = new pg.Pool({
    connectionString: connectionString(url), max: 10,
    // Reuse TLS/database connections between menu visits; authorization still runs per request.
    connectionTimeoutMillis: 15000, idleTimeoutMillis: 60000,
  });
  pool.on('error', () => console.error('Koneksi database terputus.'));

  async function transaction(work, { readOnly = false, repeatableRead = false } = {}) {
    const client = await pool.connect();
    try {
      await client.query(`BEGIN${repeatableRead ? ' ISOLATION LEVEL REPEATABLE READ' : ''}${readOnly ? ' READ ONLY' : ''}`);
      // SET LOCAL juga aman untuk Neon dengan transaction pooling.
      await client.query(`SELECT set_config('search_path', $1, true),
        set_config('TimeZone', 'Asia/Jakarta', true),
        set_config('lock_timeout', '10s', true), set_config('statement_timeout', '60s', true)`, [`${schema}, pg_temp`]);
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }
  return {
    transaction,
    query: (sql, values) => transaction(client => client.query(sql, values)),
    close: () => pool.end(),
  };
}
