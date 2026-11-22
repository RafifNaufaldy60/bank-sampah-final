-- Additive: existing accounts start unlocked. Applied only by the migration runner.
ALTER TABLE akun
  ADD COLUMN login_failed_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN login_locked_until timestamptz,
  ADD CONSTRAINT akun_login_attempts_check CHECK (login_failed_attempts BETWEEN 0 AND 5),
  ADD CONSTRAINT akun_login_lock_check CHECK (
    (login_failed_attempts < 5 AND login_locked_until IS NULL)
    OR (login_failed_attempts = 5 AND login_locked_until IS NOT NULL)
  );
