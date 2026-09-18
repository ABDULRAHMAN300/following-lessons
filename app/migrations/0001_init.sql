CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY,singleton INTEGER NOT NULL UNIQUE DEFAULT 1 CHECK(singleton=1),email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,password_salt TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS lessons (id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,subject TEXT NOT NULL CHECK(subject IN ('chemistry','physics','integrated')),grade INTEGER NOT NULL CHECK(grade IN (10,11,12)),title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 140),completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0,1)),position INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT(datetime('now')),updated_at TEXT NOT NULL DEFAULT(datetime('now')));
CREATE INDEX IF NOT EXISTS idx_lessons_owner_scope ON lessons(owner_id,subject,grade,position);
CREATE INDEX IF NOT EXISTS idx_lessons_owner_updated ON lessons(owner_id,updated_at);
CREATE TABLE IF NOT EXISTS auth_attempts (attempt_key TEXT PRIMARY KEY,attempts INTEGER NOT NULL DEFAULT 0,window_start TEXT NOT NULL);
