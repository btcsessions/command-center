import { getCategories, URGENCY_COLORS, expandedCategories, expandedNotes, getVisibleTasks, reorderCategory } from './state.js';
import { getTodayStr, formatDateDisplay, getRecurrenceLabel, formatDueDate } from './utils/dates.js';
import { linkifyText } from './utils/linkify.js';
import { initDragDesktop, initDragTouch } from './utils/drag.js';

let lastDateStr = '';

export function render() {
  const app = document.getElementById('app');
  app.textContent = '';
  const todayStr = getTodayStr();
  document.getElementById('today-date').textContent = formatDateDisplay(todayStr);
  lastDateStr = todayStr;

  const categories = getCategories();

  // Populate category select in task modal
  const catSelect = document.getElementById('input-category');
  if (catSelect) {
    catSelect.textContent = '';
    categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      catSelect.appendChild(opt);
    });
  }

  categories.forEach(cat => {
    const section = document.createElement('section');
    section.className = 'category' + (expandedCategories.has(cat.id) ? ' expanded' : '');
    section.dataset.category = cat.id;
    section.style.setProperty('--cat-color', cat.color);

    const visible = getVisibleTasks(cat.id);
    const nextTask = visible[0] || null;

    // Header
    const header = document.createElement('div');
    header.className = 'category-header';
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-expanded', expandedCategories.has(cat.id) ? 'true' : 'false');

    const icon = document.createElement('span');
    icon.className = 'category-icon';
    icon.textContent = cat.icon;

    const name = document.createElement('span');
    name.className = 'category-name';
    name.textContent = cat.name;

    const preview = document.createElement('span');
    preview.className = 'next-preview';
    if (nextTask) {
      const dot = document.createElement('span');
      dot.className = 'preview-dot';
      dot.style.background = URGENCY_COLORS[nextTask.urgency] || URGENCY_COLORS.medium;
      preview.appendChild(dot);
      preview.appendChild(document.createTextNode(nextTask.title));
    } else if (!expandedCategories.has(cat.id)) {
      preview.textContent = 'No tasks';
    }

    const arrow = document.createElement('span');
    arrow.className = 'expand-arrow';
    arrow.textContent = '\u25BC';

    const catEditBtn = document.createElement('button');
    catEditBtn.className = 'cat-edit-btn';
    catEditBtn.dataset.catId = cat.id;
    catEditBtn.textContent = '\u22EF';
    catEditBtn.setAttribute('aria-label', 'Edit category');

    const headerTop = document.createElement('div');
    headerTop.className = 'category-header-top';
    headerTop.appendChild(icon);
    headerTop.appendChild(name);
    headerTop.appendChild(catEditBtn);
    headerTop.appendChild(arrow);
    header.appendChild(headerTop);
    header.appendChild(preview);

    // Body
    const body = document.createElement('div');
    body.className = 'category-body';

    const list = document.createElement('div');
    list.className = 'task-list';
    list.dataset.category = cat.id;

    if (visible.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'empty-msg';
      empty.textContent = 'No tasks scheduled for today';
      list.appendChild(empty);
    } else {
      visible.forEach((task, idx) => {
        list.appendChild(renderTaskItem(task, idx === 0, todayStr));
      });
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'add-task-btn';
    addBtn.dataset.category = cat.id;
    addBtn.textContent = '+ Add Task';

    body.appendChild(list);
    body.appendChild(addBtn);
    section.appendChild(header);
    section.appendChild(body);
    app.appendChild(section);

    initDragDesktop(list, getVisibleTasks, reorderCategory, render);
    initDragTouch(list, getVisibleTasks, reorderCategory, render);
  });

  // Add category card
  const addCatCard = document.createElement('div');
  addCatCard.className = 'add-category-card';
  addCatCard.id = 'add-category-btn';
  addCatCard.textContent = '+ Category';
  app.appendChild(addCatCard);
}

function renderTaskItem(task, isFirst, todayStr) {
  const wrapper = document.createElement('div');
  wrapper.className = 'task-wrapper';
  wrapper.dataset.id = task.id;

  const li = document.createElement('div');
  li.className = 'task-item' + (isFirst ? ' first-task' : '');
  li.dataset.id = task.id;
  li.setAttribute('draggable', 'true');

  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.textContent = '\u2630';

  const urgDot = document.createElement('span');
  urgDot.className = 'urgency-dot ' + (task.urgency || 'medium');

  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'task-check';
  check.setAttribute('aria-label', 'Complete ' + task.title);

  const title = document.createElement('span');
  title.className = 'task-title';
  title.textContent = task.title;

  li.appendChild(handle);
  li.appendChild(urgDot);
  li.appendChild(check);
  li.appendChild(title);

  const label = getRecurrenceLabel(task);
  if (label) {
    const badge = document.createElement('span');
    badge.className = 'recurrence-badge';
    badge.textContent = label;
    li.appendChild(badge);
  }

  const dueInfo = formatDueDate(task.dueDate, todayStr);
  if (dueInfo) {
    const dueBadge = document.createElement('span');
    dueBadge.className = 'due-badge ' + dueInfo.cls;
    dueBadge.textContent = dueInfo.text;
    li.appendChild(dueBadge);
  }

  if (task.notes) {
    const notesBtn = document.createElement('button');
    notesBtn.className = 'notes-icon';
    notesBtn.setAttribute('aria-label', 'Toggle notes');
    notesBtn.textContent = '\uD83D\uDCDD';
    notesBtn.dataset.id = task.id;
    li.appendChild(notesBtn);
  }

  const editBtn = document.createElement('button');
  editBtn.className = 'task-edit-btn';
  editBtn.setAttribute('aria-label', 'Edit task');
  editBtn.textContent = '\u270E';
  li.appendChild(editBtn);

  wrapper.appendChild(li);

  if (task.notes) {
    const notesWrap = document.createElement('div');
    notesWrap.className = 'task-notes-wrap' + (expandedNotes.has(task.id) ? ' open' : '');
    notesWrap.dataset.notesFor = task.id;
    const notesDiv = document.createElement('div');
    notesDiv.className = 'task-notes';
    linkifyText(task.notes, notesDiv);
    notesWrap.appendChild(notesDiv);
    wrapper.appendChild(notesWrap);
  }

  return wrapper;
}

export function startMidnightChecker() {
  setInterval(() => {
    const now = getTodayStr();
    if (now !== lastDateStr) render();
  }, 60000);
}

export function updateSyncIndicator(status) {
  const dot = document.getElementById('sync-indicator');
  if (!dot) return;
  dot.className = 'sync-dot ' + status;
  const labels = { synced: 'Synced', pending: 'Syncing...', offline: 'Offline', error: 'Sync error' };
  dot.title = labels[status] || status;
}
