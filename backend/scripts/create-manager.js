import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { createDatabase } from '../src/db.js';
import { createManager } from '../src/services/account-service.js';

// Kata sandi diminta secara interaktif, tidak masuk argumen shell atau riwayat perintah.
if (!process.stdin.isTTY) {
  console.error('Jalankan perintah ini langsung di terminal interaktif.');
  process.exitCode = 1;
} else {
  let muted = false;
  const output = new Writable({ write(chunk, encoding, done) { if (!muted) process.stdout.write(chunk, encoding); done(); } });
  const prompt = createInterface({ input: process.stdin, output, terminal: true });
  const db = createDatabase();
  try {
    const nama = await prompt.question('Nama pengelola: ');
    const email = await prompt.question('Email: ');
    const nomor_whatsapp = await prompt.question('WhatsApp (boleh kosong): ');
    process.stdout.write('Kata sandi (10–128 karakter; disembunyikan): ');
    muted = true;
    const password = await prompt.question('');
    muted = false;
    process.stdout.write('\n');
    const account = await createManager(db, { nama, email, nomor_whatsapp, password });
    console.log(`Akun pengelola berhasil dibuat. ID: ${account.id}`);
  } catch (error) {
    muted = false;
    console.error(error.code === 'VALIDASI_GAGAL' ? error.message : 'Akun tidak dibuat. Periksa koneksi, migrasi, dan pastikan email belum digunakan.');
    process.exitCode = 1;
  } finally { muted = false; prompt.close(); await db.close(); }
}
