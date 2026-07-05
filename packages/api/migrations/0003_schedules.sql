CREATE TABLE schedules (
  id                 TEXT PRIMARY KEY,
  system_id          TEXT NOT NULL REFERENCES systems(id) ON DELETE CASCADE,
  days_of_week       INTEGER NOT NULL,
  time_window_start  TEXT NOT NULL,
  time_window_end    TEXT NOT NULL,
  recurrence         TEXT NOT NULL DEFAULT 'weekly'
                        CHECK (recurrence IN ('weekly')),
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE INDEX idx_schedules_system_id ON schedules(system_id);