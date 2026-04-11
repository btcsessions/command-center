import { getTodayStr, isTaskVisible } from './utils/dates.js';
import { api } from './api.js';
import * as db from './db.js';
import { queueOperation, doSync } from './sync.js';

export const CATEGORIES = [
  { id: 'fitness',   name: 'Fitness',          icon: '\uD83D\uDCAA' },
  { id: 'work',      name: 'Work',             icon: '\uD83D\uDCBC' },
  { id: 'personal',  name: 'Personal Errands', icon: '\uD83C\uDFE0' },
  { id: 'education', name: 'Education',        icon: '\uD83D\uDCDA' }
];

const URGENCY_WEIGHTS = { critical: 0, high: 1, medium: 2, low: 3 };
export const URGENCY_COLORS = { low: '#64748b', medium: '#3b82f6', high: '#f59e0b', critical: '#ef4444' };

// In-memory state
let tasks = [];
export let expandedCategories = new Set();
export let expandedNotes = new Set();
export let editingTaskId = null;
export function setEditingTaskId(id) { editingTaskId = id; }

// Load tasks from IndexedDB (offline-first)
export async function loadTasks() {
  tasks = await db.getAllTasks();
}

// Get all tasks (in-memory)
export function getTasks() { return tasks; }

function getUrgencyWeight(task, todayStr) {
  let w = URGENCY_WEIGHTS[task.urgency] !== undefined ? URGENCY_WEIGHTS[task.urgency] : 2;
  if (task.dueDate && task.dueDate <= todayStr && w > 0) w--;
  return w;
}

export function getVisibleTasks(category) {
  const todayStr = getTodayStr();
  return tasks
    .filter(t => t.category === category && isTaskVisible(t, todayStr))
    .sort((a, b) => {
      const aDue = a.dueDate || '';
      const bDue = b.dueDate || '';
      if (aDue || bDue) {
        if (aDue && !bDue) return -1;
        if (!aDue && bDue) return 1;
        if (aDue < bDue) return -1;
        if (aDue > bDue) return 1;
      }
      const ua = getUrgencyWeight(a, todayStr);
      const ub = getUrgencyWeight(b, todayStr);
      if (ua !== ub) return ua - ub;
      return a.sortOrder - b.sortOrder;
    });
}

function nextSortOrder(category) {
  const catTasks = tasks.filter(t => t.category === category);
  if (catTasks.length === 0) return 0;
  return Math.max(...catTasks.map(t => t.sortOrder)) + 1;
}

export async function createTask(title, category, recurring, urgency, dueDate, notes) {
  const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const task = {
    id,
    category,
    title: title.trim(),
    recurring,
    completions: [],
    createdAt: new Date().toISOString(),
    sortOrder: nextSortOrder(category),
    urgency: urgency || 'medium',
    dueDate: dueDate || null,
    notes: notes || ''
  };

  // Optimistic local update
  tasks.push(task);
  await db.putTask(task);

  // Queue for sync
  await queueOperation({ type: 'create', task });
  return task;
}

export async function updateTask(id, updates) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  Object.assign(task, updates);
  await db.putTask(task);
  await queueOperation({ type: 'update', taskId: id, updates });
}

export async function deleteTask(id) {
  tasks = tasks.filter(t => t.id !== id);
  await db.deleteTaskLocal(id);
  await queueOperation({ type: 'delete', taskId: id });
}

export async function completeTask(id) {
  const task = tasks.find(t => t.id === id);
  if (!task) return;
  const todayStr = getTodayStr();
  if (!task.completions.includes(todayStr)) {
    task.completions.push(todayStr);
  }
  await db.putTask(task);
  await queueOperation({ type: 'complete', taskId: id, date: todayStr });
}

export async function reorderCategory(category, orderedIds) {
  orderedIds.forEach((id, i) => {
    const task = tasks.find(t => t.id === id);
    if (task) task.sortOrder = i;
  });
  // Batch update locally
  const updated = tasks.filter(t => t.category === category);
  for (const t of updated) await db.putTask(t);
  await queueOperation({ type: 'reorder', category, orderedIds });
}

// Initial data load: try server first, fall back to IndexedDB
export async function initialLoad() {
  try {
    if (navigator.onLine) {
      const serverTasks = await api.getTasks();
      tasks = serverTasks;
      await db.clearTasks();
      if (tasks.length > 0) await db.putAllTasks(tasks);
      return;
    }
  } catch (err) {
    console.warn('Server unavailable, loading from local cache:', err.message);
  }
  tasks = await db.getAllTasks();
}
