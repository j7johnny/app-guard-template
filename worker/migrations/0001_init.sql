CREATE TABLE IF NOT EXISTS guard_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  app_id TEXT NOT NULL,
  event TEXT NOT NULL,
  version TEXT NOT NULL,
  build_id TEXT NOT NULL DEFAULT '',
  batch_id TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT '',
  sdk_version TEXT NOT NULL DEFAULT '',
  runtime TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT '',
  install_id TEXT NOT NULL DEFAULT '',
  decision TEXT NOT NULL DEFAULT 'allow'
);

CREATE INDEX IF NOT EXISTS idx_guard_events_app_created
  ON guard_events (app_id, created_at);

CREATE INDEX IF NOT EXISTS idx_guard_events_app_version
  ON guard_events (app_id, version);

CREATE INDEX IF NOT EXISTS idx_guard_events_app_build
  ON guard_events (app_id, build_id, batch_id);
