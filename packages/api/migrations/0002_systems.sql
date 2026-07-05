CREATE TABLE systems (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  domain          TEXT,
  purpose         TEXT NOT NULL DEFAULT '',
  philosophy      TEXT NOT NULL DEFAULT '',
  protocol        TEXT NOT NULL DEFAULT '',
  floor_action    TEXT NOT NULL DEFAULT '',
  trigger         TEXT NOT NULL DEFAULT '',
  barrier_list    TEXT NOT NULL DEFAULT '[]',
  environment_cue TEXT NOT NULL DEFAULT '',
  template_origin TEXT REFERENCES templates(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'paused', 'archived')),
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE INDEX idx_systems_user_id       ON systems(user_id);
CREATE INDEX idx_systems_user_status   ON systems(user_id, status);
CREATE INDEX idx_systems_status        ON systems(status);