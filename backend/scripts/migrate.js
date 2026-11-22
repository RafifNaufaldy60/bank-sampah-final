import { createDatabase } from '../src/db.js';
import { migrate } from '../src/migrate.js';
const db = createDatabase();
try {
  const applied = await migrate(db);
  console.log(applied.length ? `Migrasi diterapkan: ${applied.join(', ')}` : 'Database sudah memakai migrasi terbaru.');
} catch (error) {
  console.error('Migrasi gagal; semua perubahan di-rollback. Kode:', /^[A-Z0-9_]+$/.test(error.code || '') ? error.code : 'MIGRATION_ERROR');
  process.exitCode = 1;
} finally { await db.close(); }
