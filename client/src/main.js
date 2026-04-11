import './styles/main.css';
import { initialLoad, completeTask, expandedCategories, expandedNotes, expandedProjects, getTasks } from './state.js';
import { render, startMidnightChecker, updateSyncIndicator } from './render.js';
import { openModal, closeModal, initModalEvents, openCatModal, initCatModalEvents } from './components/modal.js';
import { initSync } from './sync.js';
import { api } from './api.js';
import { getTodayStr } from './utils/dates.js';

// --- Event Delegation ---
function initEventDelegation() {
  document.getElementById('app').addEventListener('click', e => {
    // Expand/collapse
    const header = e.target.closest('.category-header');
    if (header) {
      const cat = header.closest('.category').dataset.category;
      if (expandedCategories.has(cat)) {
        expandedCategories.delete(cat);
      } else {
        expandedCategories.add(cat);
      }
      render();
      return;
    }

    // Project expand/collapse
    const projArrow = e.target.closest('.project-expand-arrow');
    if (projArrow) {
      const item = projArrow.closest('.task-item');
      if (item) {
        const id = item.dataset.id;
        if (expandedProjects.has(id)) {
          expandedProjects.delete(id);
        } else {
          expandedProjects.add(id);
        }
        render();
      }
      return;
    }

    // Add subtask
    const addSubBtn = e.target.closest('.add-subtask-btn');
    if (addSubBtn) {
      openModal('add', null, null, addSubBtn.dataset.projectId);
      return;
    }

    // Complete task
    const check = e.target.closest('.task-check');
    if (check) {
      const item = check.closest('.task-item');
      if (!item) return;
      item.classList.add('task-completing');
      setTimeout(async () => {
        await completeTask(item.dataset.id);
        render();
      }, 300);
      return;
    }

    // Toggle notes
    const notesBtn = e.target.closest('.notes-icon');
    if (notesBtn) {
      const nid = notesBtn.dataset.id;
      if (expandedNotes.has(nid)) {
        expandedNotes.delete(nid);
      } else {
        expandedNotes.add(nid);
      }
      const wrap = document.querySelector('.task-notes-wrap[data-notes-for="' + nid + '"]');
      if (wrap) wrap.classList.toggle('open', expandedNotes.has(nid));
      return;
    }

    // Edit task
    const editBtn = e.target.closest('.task-edit-btn');
    if (editBtn) {
      const item = editBtn.closest('.task-item');
      if (!item) return;
      const tasks = getTasks();
      const task = tasks.find(t => t.id === item.dataset.id);
      if (task) openModal('edit', task);
      return;
    }

    // Edit category
    const catEditBtn = e.target.closest('.cat-edit-btn');
    if (catEditBtn) {
      e.stopPropagation();
      openCatModal('edit', catEditBtn.dataset.catId);
      return;
    }

    // Add category
    const addCatBtn = e.target.closest('.add-category-card');
    if (addCatBtn) {
      openCatModal('add');
      return;
    }

    // Add task
    const addBtn = e.target.closest('.add-task-btn');
    if (addBtn) {
      openModal('add', null, addBtn.dataset.category);
      return;
    }
  });

  // Keyboard support for headers
  document.getElementById('app').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.category-header')) {
      e.preventDefault();
      e.target.closest('.category-header').click();
    }
  });
}

// --- Export / Import ---
function initBackup() {
  document.getElementById('btn-export').addEventListener('click', async () => {
    try {
      if (navigator.onLine) {
        const data = await api.exportBackup();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nextaction-backup-' + getTodayStr() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        // Offline export from local data
        const tasks = getTasks();
        const data = { version: 1, exportedAt: new Date().toISOString(), tasks };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'nextaction-backup-' + getTodayStr() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  });

  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  document.getElementById('import-file').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      try {
        const data = JSON.parse(ev.target.result);
        const imported = Array.isArray(data.tasks) ? data.tasks : (Array.isArray(data) ? data : null);
        if (!imported) { alert('Invalid backup file.'); return; }
        if (!confirm('Replace all current tasks with ' + imported.length + ' tasks from backup?')) return;
        await api.importBackup({ tasks: imported });
        await initialLoad();
        render();
      } catch (err) {
        alert('Could not read backup file: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

// --- PWA Update ---
function initPWAUpdate() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // New service worker activated
    });
  }
}

// --- Init ---
async function init() {
  await initialLoad();
  render();
  startMidnightChecker();
  initEventDelegation();
  initModalEvents();
  initCatModalEvents();
  initBackup();
  initPWAUpdate();

  initSync({
    onStatusChange: updateSyncIndicator,
    onDataChange: async () => {
      await initialLoad();
      render();
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
