import { Router } from 'express';
import { getDb } from '../db.js';

const router = Router();

// POST /api/sync/push - client pushes local operations
router.post('/push', (req, res) => {
  const db = getDb();
  const { operations } = req.body;
  if (!operations || !Array.isArray(operations)) {
    return res.status(400).json({ error: 'operations array required' });
  }

  const now = new Date().toISOString();
  const results = [];

  const process = db.transaction(() => {
    for (const op of operations) {
      const deviceId = op.deviceId || 'unknown';
      const ts = op.timestamp || now;

      switch (op.type) {
        case 'create': {
          const task = op.task;
          if (!task || !task.id) break;
          const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(task.id);
          if (existing) break; // Already exists, skip

          db.prepare(`
            INSERT INTO tasks (id, category, title, recurring_type, recurring_days, recurring_interval, sort_order, urgency, due_date, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            task.id,
            task.category,
            task.title,
            task.recurring?.type || null,
            task.recurring?.days ? JSON.stringify(task.recurring.days) : null,
            task.recurring?.interval || null,
            task.sortOrder || 0,
            task.urgency || 'medium',
            task.dueDate || null,
            task.notes || '',
            task.createdAt || ts,
            ts
          );

          db.prepare(`INSERT INTO sync_log (task_id, op_type, field, value, timestamp, device_id) VALUES (?, 'create', '*', NULL, ?, ?)`).run(task.id, ts, deviceId);
          results.push({ op: 'create', taskId: task.id, ok: true });
          break;
        }

        case 'update': {
          const { taskId, updates } = op;
          if (!taskId || !updates) break;
          const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
          if (!existing) break;

          const fields = {};
          if (updates.title !== undefined) fields.title = updates.title;
          if (updates.category !== undefined) fields.category = updates.category;
          if (updates.urgency !== undefined) fields.urgency = updates.urgency;
          if (updates.dueDate !== undefined) fields.due_date = updates.dueDate;
          if (updates.notes !== undefined) fields.notes = updates.notes;
          if (updates.sortOrder !== undefined) fields.sort_order = updates.sortOrder;
          if (updates.recurring !== undefined) {
            fields.recurring_type = updates.recurring?.type || null;
            fields.recurring_days = updates.recurring?.days ? JSON.stringify(updates.recurring.days) : null;
            fields.recurring_interval = updates.recurring?.interval || null;
          }

          if (Object.keys(fields).length > 0) {
            fields.updated_at = ts;
            const sets = Object.keys(fields).map(k => `${k} = ?`).join(', ');
            const values = Object.values(fields);
            db.prepare(`UPDATE tasks SET ${sets} WHERE id = ?`).run(...values, taskId);

            for (const [field, value] of Object.entries(fields)) {
              if (field === 'updated_at') continue;
              db.prepare(`INSERT INTO sync_log (task_id, op_type, field, value, timestamp, device_id) VALUES (?, 'update', ?, ?, ?, ?)`).run(taskId, field, String(value), ts, deviceId);
            }
          }
          results.push({ op: 'update', taskId, ok: true });
          break;
        }

        case 'delete': {
          const { taskId } = op;
          if (!taskId) break;
          db.prepare('UPDATE tasks SET deleted = 1, updated_at = ? WHERE id = ?').run(ts, taskId);
          db.prepare(`INSERT INTO sync_log (task_id, op_type, field, value, timestamp, device_id) VALUES (?, 'delete', '*', NULL, ?, ?)`).run(taskId, ts, deviceId);
          results.push({ op: 'delete', taskId, ok: true });
          break;
        }

        case 'complete': {
          const { taskId, date } = op;
          if (!taskId || !date) break;
          db.prepare('INSERT OR IGNORE INTO completions (task_id, completed_date, created_at) VALUES (?, ?, ?)').run(taskId, date, ts);
          db.prepare('UPDATE tasks SET updated_at = ? WHERE id = ?').run(ts, taskId);
          db.prepare(`INSERT INTO sync_log (task_id, op_type, field, value, timestamp, device_id) VALUES (?, 'complete', 'completion', ?, ?, ?)`).run(taskId, date, ts, deviceId);
          results.push({ op: 'complete', taskId, ok: true });
          break;
        }

        case 'reorder': {
          const { category, orderedIds } = op;
          if (!category || !orderedIds) break;
          const stmt = db.prepare('UPDATE tasks SET sort_order = ?, updated_at = ? WHERE id = ?');
          orderedIds.forEach((id, i) => stmt.run(i, ts, id));
          db.prepare(`INSERT INTO sync_log (task_id, op_type, field, value, timestamp, device_id) VALUES (?, 'reorder', 'sort_order', ?, ?, ?)`).run(category, JSON.stringify(orderedIds), ts, deviceId);
          results.push({ op: 'reorder', category, ok: true });
          break;
        }
      }
    }
  });

  process();
  res.json({ ok: true, results });
});

// POST /api/sync/pull - client pulls changes since a sequence number
router.post('/pull', (req, res) => {
  const db = getDb();
  const { since } = req.body;
  const sinceSeq = since || 0;

  const logs = db.prepare('SELECT * FROM sync_log WHERE sequence > ? ORDER BY sequence ASC').all(sinceSeq);

  if (logs.length === 0) {
    return res.json({ changes: [], sequence: sinceSeq });
  }

  // Determine which tasks were affected
  const affectedTaskIds = new Set(logs.map(l => l.task_id));
  const changes = [];

  for (const taskId of affectedTaskIds) {
    // Check if this is a category ID from a reorder operation
    const hasDelete = logs.some(l => l.task_id === taskId && l.op_type === 'delete');

    if (hasDelete) {
      changes.push({ type: 'delete', taskId });
      continue;
    }

    const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!row) continue; // Could be a reorder category reference

    if (row.deleted) {
      changes.push({ type: 'delete', taskId });
      continue;
    }

    const completions = db.prepare('SELECT completed_date FROM completions WHERE task_id = ?').all(taskId).map(r => r.completed_date);
    changes.push({
      type: 'full',
      taskId,
      task: {
        id: row.id,
        category: row.category,
        title: row.title,
        recurring: row.recurring_type ? {
          type: row.recurring_type,
          days: row.recurring_days ? JSON.parse(row.recurring_days) : [],
          interval: row.recurring_interval || 0
        } : null,
        completions,
        createdAt: row.created_at,
        sortOrder: row.sort_order,
        urgency: row.urgency,
        dueDate: row.due_date,
        notes: row.notes || ''
      }
    });
  }

  const maxSeq = logs[logs.length - 1].sequence;
  res.json({ changes, sequence: maxSeq });
});

export default router;
