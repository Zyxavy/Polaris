CREATE TABLE instances (
  id                  TEXT PRIMARY KEY,
  system_id           TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  date                TEXT NOT NULL,
  state               TEXT NOT NULL DEFAULT 'pending'
                        CHECK (state IN ('full', 'floor', 'missed', 'pending')),
  notes               TEXT,
  workspace_snapshot  TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  UNIQUE (system_id, date)
);

CREATE INDEX idx_instances_date ON instances(date);