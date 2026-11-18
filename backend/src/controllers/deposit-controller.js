import ExcelJS from 'exceljs';
import * as v from '../utils/validation.js';
import { dateRange, todayJakarta } from '../utils/dates.js';
import { saveDeposit, transactionDetail } from '../services/deposit-service.js';

function historyFilter(req) {
  v.fields(req.query, ['search', 'dari', 'sampai', 'periode', 'page', 'limit']);
  const range = dateRange(req.query);
  return { range, params: [req.nasabahScope, v.search(req.query.search), range.dari, range.sampai],
    where: `($1::bigint IS NULL OR r.nasabah_id=$1)
      AND ($2::text IS NULL OR r.nama_nasabah ILIKE $2 OR r.kode_nasabah ILIKE $2 OR r.kode_setoran ILIKE $2)
      AND ($3::date IS NULL OR r.tanggal_setoran >= $3) AND ($4::date IS NULL OR r.tanggal_setoran <= $4)` };
}
// Excel hanya menyimpan 15 digit signifikan. Nilai lebih besar tetap teks.
function excelNumeric(value) {
  return String(value).replace(/[-.]/g, '').length <= 15 ? Number(value) : String(value);
}

export function depositController(db) {
  return {
    create: async (req, res) => {
      const { data, replayed } = await saveDeposit(db, req.body, req.get('Idempotency-Key'), req.user);
      res.status(replayed ? 200 : 201).json({ data, meta: { replayed } });
    },
    detail: async (req, res) => {
      const id = v.id(req.params.id);
      const data = await db.transaction(client => transactionDetail(client, id, req.nasabahScope), { readOnly: true, repeatableRead: true });
      res.json({ data });
    },
    list: async (req, res) => {
      const filter = historyFilter(req);
      const { page, limit, offset } = v.pagination(req.query);
      const result = await db.transaction(async client => {
        const count = (await client.query(`SELECT count(*) FROM v_riwayat_setoran r WHERE ${filter.where}`, filter.params)).rows[0].count;
        const rows = (await client.query(`SELECT r.* FROM v_riwayat_setoran r WHERE ${filter.where}
          ORDER BY r.tanggal_setoran DESC,r.setoran_id DESC LIMIT $5 OFFSET $6`, [...filter.params, limit, offset])).rows;
        return { data: rows, meta: { ...v.pageMeta(count, page, limit), ...filter.range, zona_waktu: 'Asia/Jakarta' } };
      }, { readOnly: true, repeatableRead: true });
      res.json(result);
    },
    export: async (req, res) => {
      const filter = historyFilter(req);
      v.pagination(req.query); // Divalidasi tetapi tidak membatasi ekspor.
      const result = await db.transaction(async client => {
        const history = (await client.query(`SELECT r.* FROM v_riwayat_setoran r WHERE ${filter.where}
          ORDER BY r.tanggal_setoran DESC,r.setoran_id DESC`, filter.params)).rows;
        const details = (await client.query(`SELECT r.kode_setoran,r.tanggal_setoran,r.kode_nasabah,r.nama_nasabah,j.nama AS jenis_sampah,
          d.berat_kg,d.harga_per_kg::text,d.subtotal_rp FROM v_riwayat_setoran r
          JOIN detail_setoran d ON d.setoran_id=r.setoran_id JOIN jenis_sampah j ON j.id=d.jenis_sampah_id
          WHERE ${filter.where} ORDER BY r.tanggal_setoran DESC,r.setoran_id DESC,d.jenis_sampah_id`, filter.params)).rows;
        return { history, details };
      }, { readOnly: true, repeatableRead: true });
      const book = new ExcelJS.Workbook();
      book.creator = 'Bank Sampah Digital';
      const history = book.addWorksheet('Riwayat');
      history.addRow(['Tanggal (WIB)', 'Kode transaksi', 'Kode nasabah', 'Nama nasabah', 'Jenis sampah', 'Berat (kg)', 'Nilai (Rp)', 'Status', 'Pengelola']);
      for (const row of result.history) history.addRow([row.tanggal_setoran, row.kode_setoran, row.kode_nasabah, row.nama_nasabah,
        row.jenis_sampah, excelNumeric(row.berat_kg), excelNumeric(row.nilai_setoran_rp), row.status, row.nama_pengelola]);
      const details = book.addWorksheet('Rincian');
      details.addRow(['Tanggal (WIB)', 'Kode transaksi', 'Kode nasabah', 'Nama nasabah', 'Jenis sampah', 'Berat (kg)', 'Harga per kg (Rp)', 'Subtotal (Rp)']);
      for (const row of result.details) details.addRow([row.tanggal_setoran, row.kode_setoran, row.kode_nasabah, row.nama_nasabah,
        row.jenis_sampah, excelNumeric(row.berat_kg), excelNumeric(row.harga_per_kg), excelNumeric(row.subtotal_rp)]);
      for (const sheet of [history, details]) {
        sheet.getRow(1).font = { bold: true };
        sheet.views = [{ state: 'frozen', ySplit: 1 }];
        sheet.columns.forEach(column => { column.width = 24; });
        sheet.getColumn(6).numFmt = '0.000';
      }
      const buffer = await book.xlsx.writeBuffer();
      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('Content-Disposition', `attachment; filename="riwayat-setoran-${todayJakarta()}.xlsx"`);
      res.send(Buffer.from(buffer));
    },
  };
}
