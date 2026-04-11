import { openDB } from 'idb';

const DB_NAME = 'nextaction';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('tasks')) {
          db.createObjectStore('tasks', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('opQueue')) {
          db.createObjectStore('opQueue', { keyPath: 'opId', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      }
    });
  }
  return dbPromise;
}

export async function getAllTasks() {
  const db = await getDB();
  return db.getAll('tasks');
}

export async function putTask(task) {
  const db = await getDB();
  await db.put('tasks', task);
}

export async function putAllTasks(tasks) {
  const db = await getDB();
  const tx = db.transaction('tasks', 'readwrite');
  await Promise.all([
    ...tasks.map(t => tx.store.put(t)),
    tx.done
  ]);
}

export async function deleteTaskLocal(id) {
  const db = await getDB();
  await db.delete('tasks', id);
}

export async function clearTasks() {
  const db = await getDB();
  await db.clear('tasks');
}

// Operation queue for offline sync
export async function enqueueOp(op) {
  const db = await getDB();
  await db.add('opQueue', { ...op, timestamp: new Date().toISOString() });
}

export async function getAllOps() {
  const db = await getDB();
  return db.getAll('opQueue');
}

export async function clearOps(upToId) {
  const db = await getDB();
  const tx = db.transaction('opQueue', 'readwrite');
  const store = tx.store;
  const keys = await store.getAllKeys();
  for (const key of keys) {
    if (key <= upToId) await store.delete(key);
  }
  await tx.done;
}

export async function clearAllOps() {
  const db = await getDB();
  await db.clear('opQueue');
}

// Meta store for sync cursor etc.
export async function getMeta(key) {
  const db = await getDB();
  const row = await db.get('meta', key);
  return row ? row.value : null;
}

export async function setMeta(key, value) {
  const db = await getDB();
  await db.put('meta', { key, value });
}
