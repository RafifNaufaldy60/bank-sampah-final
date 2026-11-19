import { config } from './src/config.js';
import { createDatabase } from './src/db.js';
import { createApp } from './src/app.js';

const db = createDatabase();
const server = createApp(db).listen(config.port, () => {
  console.log(`Backend berjalan di http://localhost:${config.port}`);
});
server.on('error', () => { console.error('Server gagal dijalankan. Periksa PORT.'); process.exitCode = 1; });
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(async () => { await db.close(); }));
}
