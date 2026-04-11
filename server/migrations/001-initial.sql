CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  recurring_type TEXT,
  recurring_days TEXT,
  recurring_interval INTEGER,
  sort_order INTEGER DEFAULT 0,
  urgency TEXT DEFAULT 'medium',
  due_date TEXT,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  completed_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(task_id, completed_date)
);

CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted ON tasks(deleted);
CREATE INDEX IF NOT EXISTS idx_completions_task ON completions(task_id);
