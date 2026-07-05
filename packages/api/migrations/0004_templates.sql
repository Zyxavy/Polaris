CREATE TABLE templates (
  id                        TEXT PRIMARY KEY,
  user_id                   TEXT REFERENCES user(id) ON DELETE CASCADE,
  name                      TEXT NOT NULL,
  source                    TEXT NOT NULL CHECK (source IN ('built_in', 'user')),
  default_purpose           TEXT NOT NULL DEFAULT '',
  default_philosophy        TEXT NOT NULL DEFAULT '',
  default_protocol          TEXT NOT NULL DEFAULT '',
  default_floor_action      TEXT NOT NULL DEFAULT '',
  default_trigger_pattern   TEXT NOT NULL DEFAULT '',
  default_barrier_list      TEXT NOT NULL DEFAULT '[]',
  default_environment_cue   TEXT NOT NULL DEFAULT '',
  suggested_widgets         TEXT NOT NULL DEFAULT '[]',
  created_at                TEXT NOT NULL,
  updated_at                TEXT NOT NULL
);

CREATE INDEX idx_templates_source  ON templates(source);
CREATE INDEX idx_templates_user_id ON templates(user_id);