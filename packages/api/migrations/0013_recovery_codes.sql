CREATE TABLE recovery_codes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  used_at     TEXT
);

CREATE INDEX idx_recovery_codes_user_id ON recovery_codes(user_id);