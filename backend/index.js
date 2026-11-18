import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error('Isi DATABASE_URL di server/.env terlebih dahulu.');
}

const app = express();
const port = Number(process.env.PORT || 3000);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (error) => {
  console.error('Koneksi database bermasalah:', error.code);
});

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
}));

app.use(express.json());

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.json({
      status: 'ok',
      message: 'Backend Bank Sampah terhubung ke PostgreSQL.',
    });
  } catch (error) {
    console.error('Pengecekan database gagal:', error.code);

    res.status(503).json({
      status: 'error',
      message: 'Koneksi database belum berhasil.',
    });
  }
});

app.listen(port, () => {
  console.log(`Backend berjalan di http://localhost:${port}`);
});