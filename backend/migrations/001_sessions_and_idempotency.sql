-- Tambahan pada skema Neon yang diperiksa. Tidak mengganti fungsi/view atau menghapus data.
CREATE TABLE sesi_login (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  akun_id bigint NOT NULL REFERENCES akun(id) ON DELETE CASCADE,
  dibuat_pada timestamptz NOT NULL DEFAULT now(),
  kedaluwarsa_pada timestamptz NOT NULL,
  CHECK (kedaluwarsa_pada > dibuat_pada)
);
CREATE INDEX sesi_login_akun ON sesi_login(akun_id);
CREATE INDEX sesi_login_kedaluwarsa ON sesi_login(kedaluwarsa_pada);

-- NULL diperbolehkan untuk transaksi lama; retry lama dibandingkan dengan rincian tersimpan.
ALTER TABLE setoran ADD COLUMN payload_hash text CHECK (payload_hash ~ '^[a-f0-9]{64}$');
