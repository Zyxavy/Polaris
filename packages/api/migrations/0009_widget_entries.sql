CREATE TABLE widget_entries (
  id           TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  widget_id    TEXT NOT NULL,
  instance_id  TEXT REFERENCES instances(id) ON DELETE CASCADE,
  entry_type   TEXT NOT NULL CHECK (entry_type IN ('checklist_state', 'log_meta', 'link_list', 'notes')),
  data         TEXT NOT NULL,
  created_at   TEXT NOT NULL
);

CREATE INDEX idx_widget_entries_instance_id        ON widget_entries(instance_id);
CREATE INDEX idx_widget_entries_workspace_widget    ON widget_entries(workspace_id, widget_id);