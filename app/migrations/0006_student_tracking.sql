CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
  grade INTEGER NOT NULL CHECK(grade IN (10,11,12)),
  group_name TEXT NOT NULL DEFAULT '' CHECK(length(group_name)<=60),
  note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=400),
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  updated_at TEXT NOT NULL DEFAULT(datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_students_owner_grade_name ON students(owner_id,grade,name);

CREATE TABLE IF NOT EXISTS student_receipts (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  worksheet_received INTEGER NOT NULL DEFAULT 0 CHECK(worksheet_received IN (0,1)),
  memo_received INTEGER NOT NULL DEFAULT 0 CHECK(memo_received IN (0,1)),
  received_at TEXT NOT NULL CHECK(length(received_at)=10),
  note TEXT NOT NULL DEFAULT '' CHECK(length(note)<=300),
  created_at TEXT NOT NULL DEFAULT(datetime('now')),
  updated_at TEXT NOT NULL DEFAULT(datetime('now')),
  UNIQUE(student_id,lesson_id),
  CHECK(worksheet_received=1 OR memo_received=1)
);
CREATE INDEX IF NOT EXISTS idx_receipts_owner_student ON student_receipts(owner_id,student_id,received_at DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_owner_lesson ON student_receipts(owner_id,lesson_id);
