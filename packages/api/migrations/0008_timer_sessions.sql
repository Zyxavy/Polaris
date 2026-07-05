CREATE TABLE timer_sessions (
  id            TEXT PRIMARY KEY,
  workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  widget_id     TEXT NOT NULL,
  instance_id   TEXT REFERENCES instances(id) ON DELETE CASCADE,
  duration_secs INTEGER NOT NULL,
  started_at    TEXT NOT NULL,
  ended_at      TEXT NOT NULL,
  created_at    TEXT NOT NULL
);

CREATE INDEX idx_timer_sessions_widget_date ON timer_sessions(widget_id, created_at);
CREATE INDEX idx_timer_sessions_instance_id ON timer_sessions(instance_id);