import { getTodayStr, isTaskVisible } from './utils/dates.js';
import { api } from './api.js';
import * as db from './db.js';
import { queueOperation, doSync } from './sync.js';

const CATEGORIES_KEY = 'commandcenter_categories';

const DEFAULT_CATEGORIES = [
  { id: 'fitness',   name: 'Fitness',          icon: '\uD83D\uDCAA', color: '#22c55e', sortOrder: 0 },
  { id: 'work',      name: 'Work',             icon: '\uD83D\uDCBC', color: '#00d4aa', sortOrder: 1 },
  { id: 'personal',  name: 'Personal Errands', icon: '\uD83C\uDFE0', color: '#38bdf8', sortOrder: 2 },
  { id: 'education', name: 'Education',        icon: '\uD83D\uDCDA', color: '#a78bfa', sortOrder: 3 }
];

export const CATEGORY_COLORS = [
  '#22c55e', '#00d4aa', '#38bdf8', '#a78bfa', '#f59e0b',
  '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4', '#84cc16',
  '#f97316', '#14b8a6', '#6366f1', '#e879f9', '#facc15'
];

export const CATEGORY_EMOJIS = [
  '\uD83D\uDCAA', '\uD83D\uDCBC', '\uD83C\uDFE0', '\uD83D\uDCDA', '\uD83C\uDFAF', '\uD83C\uDFC3', '\uD83E\uDDD8', '\uD83C\uDFA8', '\uD83C\uDFB5', '\uD83C\uDFAE',
  '\uD83D\uDCB0', '\uD83D\uDED2', '\uD83C\uDF73', '\uD83E\uDDF9', '\u2708\uFE0F', '\uD83C\uDFCB\uFE0F', '\u2764\uFE0F', '\uD83E\uDDE0', '\uD83D\uDCBB', '\uD83D\uDCF1',
  '\uD83D\uDCDD', '\uD83D\uDD27', '\uD83C\uDF31', '\u2B50', '\uD83D\uDE80', '\uD83C\uDFAC', '\uD83D\uDCF7', '\uD83D\uDC3E', '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67\u200D\uD83D\uDC66', '\uD83C\uDFE1',
  '\uD83D\uDE97', '\uD83D\uDC8A', '\uD83D\uDCE6', '\uD83C\uDF81', '\uD83D\uDD14', '\uD83D\uDCC5', '\uD83D\uDDC2\uFE0F', '\uD83D\uDCC1', '\uD83C\uDFC6', '\uD83D\uDCA1'
];

let categories = [];

function loadCategories() {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    categories = raw ? JSON.parse(raw) : [];
  } catch (e) {
    categories = [];
  }
  if (categories.length === 0) {
    categories = JSON.parse(JSON.stringify(DEFAULT_CATEGORIES));
    saveCategories();
  }
  categories.sort((a, b) => a.sortOrder - b.sortOrder);
}

function saveCategories() {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
}

export function getCategories() { return categories; }

export function addCategory(name, icon, color) {
  const id = 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const maxOrder = categories.length > 0 ? Math.max(...categories.map(c => c.sortOrder)) : -1;
  categories.push({ id, name: name.trim(), icon, color, sortOrder: maxOrder + 1 });
  saveCategories();
  return id;
}

export function updateCategoryById(id, updates) {
  const cat = categories.find(c => c.id === id);
  if (cat) {
    Object.assign(cat, updates);
    saveCategories();
  }
}

export function deleteCategoryById(id) {
  const catTasks = tasks.filter(t => t.category === id);
  if (catTasks.length > 0) {
    if (!confirm('This category has ' + catTasks.length + ' task(s). Delete them too?')) return false;
    catTasks.forEach(t => {
      tasks = tasks.filter(tt => tt.id !== t.id);
      db.deleteTaskLocal(t.id);
      queueOperation({ type: 'delete', taskId: t.id });
    });
  }
  categories = categories.filter(c => c.id !== id);
  saveCategories();
  return true;
}

export function reorderCategories(orderedIds) {
  orderedIds.forEach((id, i) => {
    const cat = categories.find(c => c.id === id);
    if (cat) cat.sortOrder = i;
  });
  categories.sort((a, b) => a.sortOrder - b.sortOrder);
  saveCategories();
}

const URGENCY_WEIGHTS = { critical: 0, high: 1, medium: 2, low: 3 };
export const URGENCY_COLORS = { low: '#64748b', medium: '#00d4aa', high: '#f59e0b', critical: '#f43f5e' };

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
  loadCategories();
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
