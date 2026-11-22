-- Schema akun diverifikasi read-only di Neon pada 2026-11-21.
-- aktif tetap menjadi sakelar blokir lama; tidak diubah oleh migration ini.
-- Runner src/migrate.js membungkus SQL dan tracking checksum dalam satu transaksi.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name='akun'
      AND column_name IN ('status', 'status_akun', 'is_active', 'nonaktif', 'is_ketua')) THEN
    RAISE EXCEPTION 'Konflik schema status akun: lakukan inspeksi dan pemetaan manual sebelum migration 002';
  END IF;
  IF EXISTS (SELECT 1 FROM akun WHERE aktif IS NULL OR peran NOT IN ('nasabah','pengelola')) THEN
    RAISE EXCEPTION 'Status/peran akun lama tidak dapat dipetakan secara aman';
  END IF;
END $$;

ALTER TABLE akun
  ADD COLUMN is_ketua boolean NOT NULL DEFAULT false,
  ADD COLUMN status_akun text,
  ADD COLUMN diperiksa_oleh bigint REFERENCES akun(id),
  ADD COLUMN diputuskan_pada timestamptz,
  ADD COLUMN alasan_penolakan text;

UPDATE akun SET status_akun=CASE WHEN aktif THEN 'active' ELSE 'ditolak' END;
ALTER TABLE akun
  ALTER COLUMN status_akun SET DEFAULT 'pending',
  ALTER COLUMN status_akun SET NOT NULL,
  ADD CONSTRAINT akun_status_akun_check CHECK (status_akun IN ('active','pending','ditolak')),
  ADD CONSTRAINT akun_ketua_peran_check CHECK (NOT is_ketua OR peran='pengelola'),
  ADD CONSTRAINT akun_keputusan_check CHECK (
    (diperiksa_oleh IS NULL AND diputuskan_pada IS NULL AND alasan_penolakan IS NULL)
    OR (diperiksa_oleh IS NOT NULL AND diputuskan_pada IS NOT NULL AND
      ((status_akun='active' AND alasan_penolakan IS NULL)
        OR (status_akun='ditolak' AND alasan_penolakan IS NOT NULL
          AND length(btrim(alasan_penolakan)) BETWEEN 1 AND 1000)))
  );
CREATE INDEX akun_pengajuan_pengelola ON akun(status_akun,id) WHERE peran='pengelola' AND NOT is_ketua;
