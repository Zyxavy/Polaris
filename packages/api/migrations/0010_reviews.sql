CREATE TABLE reviews (
  id               TEXT PRIMARY KEY,
  system_id        TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  period_start     TEXT NOT NULL,
  period_end       TEXT NOT NULL,
  what_worked      TEXT NOT NULL DEFAULT '',
  what_broke       TEXT NOT NULL DEFAULT '',
  worst_day_check  INTEGER NOT NULL DEFAULT 0 CHECK (worst_day_check IN (0, 1)),
  change_applied   TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX idx_reviews_system_period ON reviews(system_id, period_start);