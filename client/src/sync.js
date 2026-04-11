import { api } from './api.js';
import * as db from './db.js';

let syncStatus = 'offline'; // 'synced' | 'pending' | 'offline' | 'error'
let syncTimer = null;
let onStatusChange = null;
let onDataChange = null;
const SYNC_INTERVAL = 30000;
const DEVICE_ID = getOrCreateDeviceId();

function getOrCreateDeviceId() {
  let id = localStorage.getItem('nextaction_device_id');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
    localStorage.setItem('nextaction_device_id', id);
  }
  return id;
}

function setStatus(s) {
  if (s !== syncStatus) {
    syncStatus = s;
    if (onStatusChange) onStatusChange(s);
  }
}

export function getSyncStatus() { return syncStatus; }

export function initSync(opts) {
  onStatusChange = opts.onStatusChange || null;
  onDataChange = opts.onDataChange || null;
  startSyncLoop();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) doSync();
  });
  window.addEventListener('online', () => doSync());
  window.addEventListener('offline', () => setStatus('offline'));
}

function startSyncLoop() {
  if (syncTimer) clearInterval(syncTimer);
  syncTimer = setInterval(doSync, SYNC_INTERVAL);
  doSync();
}

export async function doSync() {
  if (!navigator.onLine) {
    setStatus('offline');
    return;
  }

  try {
    // Push local operations
    const ops = await db.getAllOps();
    if (ops.length > 0) {
      setStatus('pending');
      const pushOps = ops.map(op => ({
        ...op,
        deviceId: DEVICE_ID
      }));
      await api.syncPush(pushOps);
      const maxId = Math.max(...ops.map(o => o.opId));
      await db.clearOps(maxId);
    }

    // Pull remote changes
    const lastSeq = (await db.getMeta('lastSyncSequence')) || 0;
    const result = await api.syncPull(lastSeq);

    if (result && result.changes && result.changes.length > 0) {
      for (const change of result.changes) {
        if (change.type === 'delete') {
          await db.deleteTaskLocal(change.taskId);
        } else if (change.type === 'full') {
          await db.putTask(change.task);
        }
      }
      await db.setMeta('lastSyncSequence', result.sequence);
      if (onDataChange) onDataChange();
    }

    setStatus('synced');
  } catch (err) {
    console.error('Sync error:', err);
    const pending = await db.getAllOps();
    setStatus(pending.length > 0 ? 'pending' : 'error');
  }
}

// Queue a local operation and trigger sync
export async function queueOperation(op) {
  await db.enqueueOp(op);
  setStatus('pending');
  // Don't await -- fire and forget
  doSync().catch(() => {});
}

export async function fullRefresh() {
  if (!navigator.onLine) return;
  try {
    const tasks = await api.getTasks();
    await db.clearTasks();
    if (tasks && tasks.length > 0) {
      await db.putAllTasks(tasks);
    }
    const lastSeq = tasks._sequence || 0;
    if (lastSeq) await db.setMeta('lastSyncSequence', lastSeq);
    setStatus('synced');
    if (onDataChange) onDataChange();
  } catch (err) {
    console.error('Full refresh failed:', err);
    setStatus('error');
  }
}
