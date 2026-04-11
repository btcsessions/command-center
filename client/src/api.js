const API_BASE = '/api';

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('nextaction_token');
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return headers;
}

async function request(method, path, body) {
  const opts = { method, headers: getHeaders() };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(API_BASE + path, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${method} ${path}: ${res.status} ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  getTasks: () => request('GET', '/tasks'),
  createTask: (task) => request('POST', '/tasks', task),
  updateTask: (id, updates) => request('PUT', '/tasks/' + id, updates),
  deleteTask: (id) => request('DELETE', '/tasks/' + id),
  completeTask: (id, date) => request('POST', '/tasks/' + id + '/complete', { date }),
  reorder: (category, orderedIds) => request('POST', '/tasks/reorder', { category, orderedIds }),

  syncPush: (operations) => request('POST', '/sync/push', { operations }),
  syncPull: (since) => request('POST', '/sync/pull', { since }),

  exportBackup: () => request('GET', '/backup/export'),
  importBackup: (data) => request('POST', '/backup/import', data),

  health: () => request('GET', '/health'),
};
