// Keep PostgreSQL NUMERIC / BIGINT as strings: never round through Number.
export function decimalID(value) {
  const text = String(value)
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new Error('Format angka Ringkasan tidak valid.')
  const [integer, fraction = ''] = text.split('.')
  const decimal = fraction.replace(/0+$/, '')
  return `${BigInt(integer).toLocaleString('id-ID')}${decimal ? `,${decimal}` : ''}`
}
export const rupiah = value => `Rp ${decimalID(value)}`
export const weight = value => `${decimalID(value)} kg`
export const initials = name => name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase()
export const dateID = date => new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${date}T00:00:00+07:00`))
export const timeID = time => time.slice(0, 5).replace(':', '.')
