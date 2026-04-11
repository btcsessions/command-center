import { getCategories, URGENCY_COLORS, expandedCategories, expandedNotes, expandedProjects, getVisibleTasks, getVisibleSubtasks, getSubtaskProgress, getRankedActions, nextActionIndex } from './state.js';
import { getTodayStr, formatDateDisplay, getRecurrenceLabel, formatDueDate } from './utils/dates.js';
import { linkifyText } from './utils/linkify.js';

let lastDateStr = '';

export function render() {
  const app = document.getElementById('app');
  app.textContent = '';
  const todayStr = getTodayStr();
  document.getElementById('today-date').textContent = formatDateDisplay(todayStr);
  lastDateStr = todayStr;

  // Next Action Bar
  const bar = document.getElementById('next-action-bar');
  bar.textContent = '';
  bar.classList.remove('visible');
  const ranked = getRankedActions();
  let naIdx = nextActionIndex;
  if (naIdx >= ranked.length) naIdx = 0;
  if (ranked.length > 0) {
    const current = ranked[naIdx];
    const t = current.task;

    const barLabel = document.createElement('span');
    barLabel.className = 'next-action-bar-label';
    barLabel.textContent = 'Next';
    bar.appendChild(barLabel);

    const barDot = document.createElement('span');
    barDot.className = 'urgency-dot ' + (t.urgency || 'medium');
    bar.appendChild(barDot);

    const barCheck = document.createElement('input');
    barCheck.type = 'checkbox';
    barCheck.className = 'next-action-bar-check';
    barCheck.dataset.id = t.id;
    barCheck.setAttribute('aria-label', 'Complete ' + t.title);
    bar.appendChild(barCheck);

    if (current.parentProject) {
      const barProj = document.createElement('span');
      barProj.className = 'next-action-bar-project';
      barProj.textContent = current.parentProject.title + ':';
      bar.appendChild(barProj);
    }

    const barTitle = document.createElement('span');
    barTitle.className = 'next-action-bar-title';
    barTitle.textContent = t.title;
    bar.appendChild(barTitle);

    const dueInfo = formatDueDate(t.dueDate, todayStr);
    if (dueInfo) {
      const barDue = document.createElement('span');
      barDue.className = 'due-badge ' + dueInfo.cls;
      barDue.textContent = dueInfo.text;
      bar.appendChild(barDue);
    }

    const allCats = getCategories();
    const barCatObj = allCats.find(c => c.id === t.category);
    if (barCatObj) {
      const barCat = document.createElement('span');
      barCat.className = 'next-action-bar-cat';
      barCat.textContent = barCatObj.icon;
      bar.appendChild(barCat);
    }

    if (ranked.length > 1) {
      const nav = document.createElement('span');
      nav.className = 'next-action-bar-nav';

      const prevBtn = document.createElement('button');
      prevBtn.className = 'next-action-bar-arrow';
      prevBtn.setAttribute('aria-label', 'Previous task');
      prevBtn.textContent = '\u25C0';
      prevBtn.dataset.dir = 'prev';
      if (naIdx === 0) prevBtn.disabled = true;
      nav.appendChild(prevBtn);

      const pos = document.createElement('span');
      pos.className = 'next-action-bar-pos';
      pos.textContent = (naIdx + 1) + '/' + ranked.length;
      nav.appendChild(pos);

      const nextBtn = document.createElement('button');
      nextBtn.className = 'next-action-bar-arrow';
      nextBtn.setAttribute('aria-label', 'Next task');
      nextBtn.textContent = '\u25B6';
      nextBtn.dataset.dir = 'next';
      if (naIdx === ranked.length - 1) nextBtn.disabled = true;
      nav.appendChild(nextBtn);

      bar.appendChild(nav);
    }

    bar.classList.add('visible');
  }

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

    const catDragHandle = document.createElement('span');
    catDragHandle.className = 'cat-drag-handle';
    catDragHandle.textContent = '\u2630';
    catDragHandle.setAttribute('aria-label', 'Drag to reorder category');

    const headerTop = document.createElement('div');
    headerTop.className = 'category-header-top';
    headerTop.appendChild(catDragHandle);
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
        // Render subtasks if this is an expanded project
        if (task.isProject && expandedProjects.has(task.id)) {
          const subtasks = getVisibleSubtasks(task.id);
          const subtaskList = document.createElement('div');
          subtaskList.className = 'subtask-list task-list';
          subtaskList.dataset.projectId = task.id;
          subtaskList.dataset.category = cat.id;
          if (subtasks.length === 0) {
            const emptyS = document.createElement('div');
            emptyS.className = 'empty-msg';
            emptyS.textContent = 'No sub-tasks yet';
            subtaskList.appendChild(emptyS);
          } else {
            subtasks.forEach(sub => {
              subtaskList.appendChild(renderTaskItem(sub, false, todayStr, true));
            });
          }
          list.appendChild(subtaskList);
          const addSubBtn = document.createElement('button');
          addSubBtn.className = 'add-subtask-btn';
          addSubBtn.dataset.projectId = task.id;
          addSubBtn.textContent = '+ Add Sub-task';
          list.appendChild(addSubBtn);
        }
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
  });

  // Add category card
  const addCatCard = document.createElement('div');
  addCatCard.className = 'add-category-card';
  addCatCard.id = 'add-category-btn';
  addCatCard.textContent = '+ Category';
  app.appendChild(addCatCard);
}

function renderTaskItem(task, isFirst, todayStr, isSubtask) {
  const wrapper = document.createElement('div');
  wrapper.className = 'task-wrapper' + (isSubtask ? ' subtask-item' : '');
  wrapper.dataset.id = task.id;
  if (task.isProject) {
    wrapper.dataset.expanded = expandedProjects.has(task.id) ? 'true' : 'false';
  }

  const li = document.createElement('div');
  li.className = 'task-item' + (isFirst ? ' first-task' : '');
  li.dataset.id = task.id;
  li.setAttribute('draggable', 'true');

  const handle = document.createElement('span');
  handle.className = 'drag-handle';
  handle.textContent = '\u2630';

  const urgDot = document.createElement('span');
  urgDot.className = 'urgency-dot ' + (task.urgency || 'medium');

  li.appendChild(handle);
  li.appendChild(urgDot);

  if (task.isProject) {
    // Project: expand arrow instead of checkbox
    const projArrow = document.createElement('button');
    projArrow.className = 'project-expand-arrow';
    projArrow.setAttribute('aria-label', 'Expand project');
    projArrow.textContent = '\u25B6';
    li.appendChild(projArrow);

    // Two-row layout: title + progress bar
    const contentCol = document.createElement('div');
    contentCol.className = 'project-content';

    const titleRow = document.createElement('div');
    titleRow.className = 'project-title-row';
    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;
    titleRow.appendChild(title);

    const progress = getSubtaskProgress(task.id);
    const progressEl = document.createElement('span');
    progressEl.className = 'project-progress';
    const bar = document.createElement('span');
    bar.className = 'progress-bar';
    const fill = document.createElement('span');
    fill.className = 'progress-bar-fill';
    fill.style.width = (progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0) + '%';
    bar.appendChild(fill);
    const ptext = document.createElement('span');
    ptext.className = 'progress-text';
    ptext.textContent = progress.done + '/' + progress.total;
    progressEl.appendChild(bar);
    progressEl.appendChild(ptext);
    titleRow.appendChild(progressEl);
    contentCol.appendChild(titleRow);

    const metaRow = document.createElement('div');
    metaRow.className = 'project-meta-row';
    const dueInfo = formatDueDate(task.dueDate, todayStr);
    if (dueInfo) {
      const dueBadge = document.createElement('span');
      dueBadge.className = 'due-badge ' + dueInfo.cls;
      dueBadge.textContent = dueInfo.text;
      metaRow.appendChild(dueBadge);
    }
    if (task.notes) {
      const notesBtn = document.createElement('button');
      notesBtn.className = 'notes-icon';
      notesBtn.setAttribute('aria-label', 'Toggle notes');
      notesBtn.textContent = '\uD83D\uDCDD';
      notesBtn.dataset.id = task.id;
      metaRow.appendChild(notesBtn);
    }
    if (metaRow.children.length > 0) contentCol.appendChild(metaRow);
    li.appendChild(contentCol);

    const editBtn = document.createElement('button');
    editBtn.className = 'task-edit-btn';
    editBtn.setAttribute('aria-label', 'Edit task');
    editBtn.textContent = '\u270E';
    li.appendChild(editBtn);
  } else {
    // Regular task or subtask
    const check = document.createElement('input');
    check.type = 'checkbox';
    check.className = 'task-check';
    check.setAttribute('aria-label', 'Complete ' + task.title);
    li.appendChild(check);

    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;
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
  }

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
