CREATE TABLE workspaces (
  id          TEXT PRIMARY KEY,
  system_id   TEXT NOT NULL UNIQUE REFERENCES systems(id) ON DELETE CASCADE,
  layout      TEXT NOT NULL DEFAULT '{"v":1,"widgets":[]}',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);