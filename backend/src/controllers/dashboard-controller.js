import { fields } from '../utils/validation.js';
import { weekRange } from '../utils/dates.js';

export function dashboardController(db) {
  return {
    summary: async (req, res) => {
      fields(req.query, []);
      const data = await db.transaction(async client => {
        const metrik = (await client.query('SELECT * FROM v_ringkasan_pengelola')).rows[0];
        const transaksi_terbaru = (await client.query(`SELECT * FROM v_riwayat_setoran ORDER BY tanggal_setoran DESC,setoran_id DESC LIMIT 5`)).rows;
        const jadwal_hari_ini = (await client.query(`SELECT j.id,j.layanan_kode,l.nama AS nama_layanan,j.tanggal,j.jam_mulai,j.jam_selesai,
          j.tersedia,j.catatan,CASE WHEN j.tersedia THEN 'tersedia' ELSE 'tutup' END AS status
          FROM jadwal_layanan j JOIN layanan l ON l.kode=j.layanan_kode WHERE j.tanggal=$1 ORDER BY j.jam_mulai,j.id`, [metrik.hari_ini])).rows;
        return { pengelola: { id: req.user.id, nama: req.user.nama, peran: req.user.peran }, metrik, transaksi_terbaru, jadwal_hari_ini,
          periode: { hari: metrik.hari_ini, minggu: weekRange(metrik.hari_ini), zona_waktu: 'Asia/Jakarta' } };
      }, { readOnly: true, repeatableRead: true });
      res.json({ data });
    },
    balance: async (req, res) => {
      fields(req.query, []);
      const { rows } = await db.query('SELECT * FROM v_saldo_nasabah WHERE nasabah_id=$1', [req.user.id]);
      res.json({ data: rows[0], meta: { periode_saldo: 'sepanjang_waktu', periode_total_kg: 'sepanjang_waktu', zona_waktu: 'Asia/Jakarta' } });
    },
  };
}
