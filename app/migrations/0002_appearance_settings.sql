CREATE TABLE IF NOT EXISTS appearance_settings (
  owner_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  primary_color TEXT NOT NULL CHECK(length(primary_color) = 7 AND substr(primary_color, 1, 1) = '#'),
  accent_color TEXT NOT NULL CHECK(length(accent_color) = 7 AND substr(accent_color, 1, 1) = '#'),
  background_color TEXT NOT NULL CHECK(length(background_color) = 7 AND substr(background_color, 1, 1) = '#'),
  updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
