import * as v from '../utils/validation.js';
import { todayJakarta } from '../utils/dates.js';
import { ensure } from '../utils/errors.js';

export function catalogController(db) {
  async function prices(query, itemId = null) {
    v.fields(query, ['tanggal', 'search', 'kategori', 'jenis_sampah_id']);
    const tanggal = query.tanggal === undefined ? todayJakarta() : v.date(query.tanggal);
    const id = itemId || (query.jenis_sampah_id === undefined ? null : v.id(query.jenis_sampah_id, 'jenis_sampah_id', 2147483647n));
    const search = v.search(query.search);
    const kategori = query.kategori === undefined ? null : v.choice(query.kategori, ['Plastik', 'Kertas', 'Logam', 'Kaca', 'Lainnya'], 'kategori');
    const source = query.tanggal === undefined ? 'v_harga_terkini' : `(SELECT j.*,h.harga_per_kg,h.berlaku_mulai FROM jenis_sampah j
      LEFT JOIN LATERAL (SELECT harga_per_kg,berlaku_mulai FROM harga_sampah
        WHERE jenis_sampah_id=j.id AND berlaku_mulai <= $4::date ORDER BY berlaku_mulai DESC LIMIT 1) h ON true)`;
    const params = [id, search, kategori];
    if (query.tanggal !== undefined) params.push(tanggal);
    const { rows } = await db.query(`SELECT id,nama,kategori,panduan,harga_per_kg::text,berlaku_mulai,
      'kg' AS satuan, CASE WHEN harga_per_kg IS NULL THEN 'belum_ditetapkan' ELSE 'tersedia' END AS status_tarif
      FROM ${source} j WHERE ($1::integer IS NULL OR id=$1)
      AND ($2::text IS NULL OR nama ILIKE $2) AND ($3::text IS NULL OR kategori=$3) ORDER BY id`, params);
    return { data: rows, meta: { tanggal, zona_waktu: 'Asia/Jakarta' } };
  }
  return {
    list: async (req, res) => res.json(await prices(req.query)),
    price: async (req, res) => {
      const result = await prices(req.query, v.id(req.params.id, 'jenis_sampah_id', 2147483647n));
      ensure(result.data[0], 404, 'TIDAK_DITEMUKAN', 'Jenis sampah tidak ditemukan.');
      res.json({ data: result.data[0], meta: result.meta });
    },
    addPrice: async (req, res) => {
      const body = v.fields(req.body, ['jenis_sampah_id', 'berlaku_mulai', 'harga_per_kg']);
      const params = [v.id(body.jenis_sampah_id, 'jenis_sampah_id', 2147483647n), v.date(body.berlaku_mulai, 'berlaku_mulai'), v.id(body.harga_per_kg, 'harga_per_kg', 2147483647n)];
      const { rows } = await db.query(`INSERT INTO harga_sampah(jenis_sampah_id,berlaku_mulai,harga_per_kg)
        VALUES($1,$2,$3) RETURNING jenis_sampah_id,berlaku_mulai,harga_per_kg::text`, params);
      res.status(201).json({ data: rows[0] });
    },
    services: async (req, res) => {
      v.fields(req.query, []);
      res.json({ data: (await db.query('SELECT kode,nama,lokasi_atau_area,hari_rutin,syarat FROM layanan ORDER BY kode')).rows });
    },
    customers: async (req, res) => {
      v.fields(req.query, ['search', 'page', 'limit']);
      const { page, limit, offset } = v.pagination(req.query);
      const term = v.search(req.query.search);
      const result = await db.transaction(async client => {
        const where = "peran='nasabah' AND aktif AND ($1::text IS NULL OR nama ILIKE $1 OR kode_akun ILIKE $1)";
        const count = (await client.query(`SELECT count(*) FROM akun WHERE ${where}`, [term])).rows[0].count;
        const rows = (await client.query(`SELECT id,kode_akun,nama,email,nomor_whatsapp FROM akun
          WHERE ${where} ORDER BY nama,id LIMIT $2 OFFSET $3`, [term, limit, offset])).rows;
        return { data: rows, meta: v.pageMeta(count, page, limit) };
      }, { readOnly: true, repeatableRead: true });
      res.json(result);
    },
  };
}
