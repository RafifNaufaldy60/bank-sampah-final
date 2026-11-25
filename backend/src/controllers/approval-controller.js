import * as v from '../utils/validation.js';
import { ensure } from '../utils/errors.js';
import { accountColumns, ensureChair } from '../middleware/auth.js';

const columns = `${accountColumns}, dibuat_pada, diperiksa_oleh, diputuskan_pada, alasan_penolakan`;
export function approvalController(db) {
  const decide = status => async (req, res) => {
    const id = v.id(req.params.id);
    const body = v.fields(req.body ?? {}, status === 'ditolak' ? ['alasan_penolakan'] : []);
    const reason = status === 'ditolak' ? v.text(body.alasan_penolakan, 'alasan_penolakan', { max: 1000 }) : null;
    const data = await db.transaction(async client => {
      // Revalidasi dan tahan lock pemeriksa sampai keputusan commit.
      const actor = (await client.query(`SELECT ${accountColumns} FROM akun WHERE id=$1 FOR SHARE`, [req.user.id])).rows[0];
      ensureChair(actor);
      const updated = await client.query(`UPDATE akun SET status_akun=$2,diperiksa_oleh=$3,
        diputuskan_pada=now(),alasan_penolakan=$4
        WHERE id=$1 AND peran='pengelola' AND NOT is_ketua AND status_akun='pending' AND aktif
        RETURNING ${columns}`, [id, status, actor.id, reason]);
      if (updated.rows[0]) return updated.rows[0];
      const exists = (await client.query('SELECT id FROM akun WHERE id=$1', [id])).rows[0];
      ensure(exists, 404, 'TIDAK_DITEMUKAN', 'Akun tidak ditemukan.');
      ensure(false, 409, 'PENGAJUAN_TIDAK_DAPAT_DIPUTUSKAN', 'Target bukan pengelola pending yang dapat diputuskan.');
    });
    res.json({ data });
  };
  return {
    list: async (req, res) => {
      v.fields(req.query, ['page', 'limit', 'status']);
      const { page, limit, offset } = v.pagination(req.query);
      const status = v.choice(req.query.status ?? 'pending', ['all', 'active', 'pending', 'ditolak'], 'status');
      const result = await db.transaction(async client => {
        const counts = (await client.query(`SELECT count(*) AS total,
          count(*) FILTER (WHERE status_akun='pending') AS pending_total
          FROM akun WHERE peran='pengelola' AND NOT is_ketua AND ($1='all' OR status_akun=$1)`, [status])).rows[0];
        const data = (await client.query(`SELECT ${columns} FROM akun
          WHERE peran='pengelola' AND NOT is_ketua AND ($1='all' OR status_akun=$1)
          ORDER BY (status_akun='pending') DESC, id DESC LIMIT $2 OFFSET $3`, [status, limit, offset])).rows;
        return { data, meta: { ...v.pageMeta(counts.total, page, limit), pending_total: Number(counts.pending_total) } };
      }, { readOnly: true, repeatableRead: true });
      res.json(result);
    },
    detail: async (req, res) => {
      const data = (await db.query(`SELECT ${columns} FROM akun WHERE id=$1 AND peran='pengelola' AND NOT is_ketua`, [v.id(req.params.id)])).rows[0];
      ensure(data, 404, 'TIDAK_DITEMUKAN', 'Pengajuan pengelola tidak ditemukan.');
      res.json({ data });
    },
    approve: decide('active'),
    reject: decide('ditolak'),
  };
}
