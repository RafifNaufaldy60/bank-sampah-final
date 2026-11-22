import { date, choice } from './validation.js';
import { ensure } from './errors.js';

export function todayJakarta(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function shiftDays(value, days) {
  const result = new Date(`${value}T00:00:00Z`);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}
export function weekRange(today = todayJakarta()) {
  const day = new Date(`${today}T00:00:00Z`).getUTCDay();
  const dari = shiftDays(today, -((day + 6) % 7));
  return { dari, sampai: shiftDays(dari, 6) };
}
export function dateRange(query, today = todayJakarta()) {
  ensure(!(query.periode && (query.dari || query.sampai)), 400, 'VALIDASI_GAGAL', 'Gunakan periode atau dari/sampai, jangan keduanya.');
  let dari = query.dari === undefined ? null : date(query.dari, 'dari');
  let sampai = query.sampai === undefined ? null : date(query.sampai, 'sampai');
  if (query.periode !== undefined) {
    choice(query.periode, ['tiga_bulan', 'bulan_ini', 'tahun_ini'], 'periode');
    sampai = today;
    dari = query.periode === 'tahun_ini' ? `${today.slice(0, 4)}-01-01` : `${today.slice(0, 7)}-01`;
    if (query.periode === 'tiga_bulan') {
      const start = new Date(`${dari}T00:00:00Z`);
      start.setUTCMonth(start.getUTCMonth() - 2);
      dari = start.toISOString().slice(0, 10);
    }
  }
  ensure(!dari || !sampai || dari <= sampai, 400, 'VALIDASI_GAGAL', 'dari tidak boleh melewati sampai.');
  return { dari, sampai };
}
