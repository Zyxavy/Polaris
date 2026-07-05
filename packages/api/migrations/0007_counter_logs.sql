CREATE TABLE counter_logs (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  widget_id    TEXT NOT NULL,
  instance_id  TEXT REFERENCES instances(id) ON DELETE CASCADE,
  value        INTEGER NOT NULL,
  unit_label   TEXT,
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_counter_logs_widget_date   ON counter_logs(widget_id, created_at);
CREATE INDEX idx_counter_logs_instance_id   ON counter_logs(instance_id);