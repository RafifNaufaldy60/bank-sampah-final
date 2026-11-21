import { createDatabase } from '../src/db.js';
import { bootstrapChairs } from '../src/services/chair-bootstrap.js';

const db = createDatabase();
try {
  const input = [1, 2].map(n => ({
    email: process.env[`KETUA_${n}_EMAIL`], mode: process.env[`KETUA_${n}_MODE`],
    ...(process.env[`KETUA_${n}_MODE`] === 'create' ? {
      nama: process.env[`KETUA_${n}_NAMA`], password: process.env[`KETUA_${n}_PASSWORD`],
      nomor_whatsapp: process.env[`KETUA_${n}_WHATSAPP`],
    } : {}),
  }));
  await bootstrapChairs(db, input);
  console.log('Bootstrap selesai: tepat dua ketua pilihan aktif; password existing tidak diubah.');
} catch (error) {
  console.error(['BOOTSTRAP_INVALID', 'BOOTSTRAP_CONFLICT', 'VALIDASI_GAGAL'].includes(error.code)
    ? error.message : 'Bootstrap gagal; transaksi dibatalkan. Periksa konfigurasi dan migration.');
  process.exitCode = 1;
} finally { await db.close(); }
