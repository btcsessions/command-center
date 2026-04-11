ALTER TABLE tasks ADD COLUMN is_project INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN parent_id TEXT;
ALTER TABLE tasks ADD COLUMN subtask_order TEXT DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
