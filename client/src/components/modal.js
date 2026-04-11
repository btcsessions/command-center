import { createTask, updateTask, deleteTask, expandedCategories, expandedProjects, editingTaskId, setEditingTaskId, modalParentId, setModalParentId, getTasks, getCategories, addCategory, updateCategoryById, deleteCategoryById, CATEGORY_COLORS, CATEGORY_EMOJIS } from '../state.js';
import { render } from '../render.js';

let editingCatId = null;

function setActiveType(type) {
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === type);
  });
  const isProject = (type === 'project');
  const recurrenceGroup = document.getElementById('input-recurrence').closest('.form-group');
  recurrenceGroup.classList.toggle('hidden', isProject);
  if (isProject) {
    document.getElementById('weekly-group').classList.add('hidden');
    document.getElementById('custom-group').classList.add('hidden');
  }
}

function getActiveType() {
  const active = document.querySelector('.type-btn.active');
  return active ? active.dataset.type : 'task';
}

function setActiveUrgency(level) {
  document.querySelectorAll('.urgency-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.urgency === level);
  });
}

function getActiveUrgency() {
  const active = document.querySelector('.urgency-btn.active');
  return active ? active.dataset.urgency : 'medium';
}

function clearDayToggles() {
  document.querySelectorAll('.day-toggle').forEach(btn => btn.classList.remove('active'));
}

function getSelectedDays() {
  const days = [];
  document.querySelectorAll('.day-toggle.active').forEach(btn => {
    days.push(parseInt(btn.dataset.day, 10));
  });
  return days.sort();
}

function updateRecurrenceUI() {
  const type = document.getElementById('input-recurrence').value;
  document.getElementById('weekly-group').classList.toggle('hidden', type !== 'weekly');
  document.getElementById('custom-group').classList.toggle('hidden', type !== 'custom');
}

function buildRecurring() {
  const type = document.getElementById('input-recurrence').value;
  if (type === 'none') return null;
  if (type === 'daily') return { type: 'daily', days: [], interval: 1 };
  if (type === 'weekly') {
    const days = getSelectedDays();
    if (days.length === 0) return null;
    return { type: 'weekly', days, interval: 0 };
  }
  if (type === 'custom') {
    const interval = parseInt(document.getElementById('input-interval').value, 10);
    if (!interval || interval < 2) return null;
    return { type: 'custom', days: [], interval };
  }
  return null;
}

export function openModal(mode, task, defaultCategory, parentId) {
  setEditingTaskId((mode === 'edit' && task) ? task.id : null);
  setModalParentId(parentId || null);
  const overlay = document.getElementById('modal-overlay');
  const titleEl = document.getElementById('modal-title');
  const form = document.getElementById('task-form');
  const deleteBtn = document.getElementById('btn-delete');
  const categoryGroup = document.getElementById('category-group');
  const projectGroup = document.getElementById('project-group');
  const recurrenceGroup = document.getElementById('input-recurrence').closest('.form-group');

  // Reset visibility
  categoryGroup.classList.remove('hidden');
  projectGroup.classList.remove('hidden');
  recurrenceGroup.classList.remove('hidden');

  form.reset();
  clearDayToggles();
  setActiveUrgency('medium');
  setActiveType('task');
  document.getElementById('input-due-date').value = '';
  document.getElementById('input-notes').value = '';

  if (parentId) {
    // Sub-task mode
    titleEl.textContent = mode === 'edit' ? 'Edit Sub-task' : 'Add Sub-task';
    categoryGroup.classList.add('hidden');
    projectGroup.classList.add('hidden');
  } else if (mode === 'edit') {
    titleEl.textContent = task && task.parentId ? 'Edit Sub-task' : 'Edit Task';
    if (task && task.parentId) {
      categoryGroup.classList.add('hidden');
      projectGroup.classList.add('hidden');
      setModalParentId(task.parentId);
    }
  } else {
    titleEl.textContent = 'Add Task';
  }

  deleteBtn.classList.toggle('hidden', mode !== 'edit');

  if (mode === 'edit' && task) {
    document.getElementById('input-title').value = task.title;
    document.getElementById('input-category').value = task.category;
    setActiveUrgency(task.urgency || 'medium');
    document.getElementById('input-due-date').value = task.dueDate || '';
    document.getElementById('input-notes').value = task.notes || '';
    if (task.isProject) {
      setActiveType('project');
    }
    if (task.recurring) {
      document.getElementById('input-recurrence').value = task.recurring.type;
      if (task.recurring.type === 'weekly') {
        task.recurring.days.forEach(d => {
          const btn = document.querySelector('.day-toggle[data-day="' + d + '"]');
          if (btn) btn.classList.add('active');
        });
      } else if (task.recurring.type === 'custom') {
        document.getElementById('input-interval').value = task.recurring.interval;
      }
    } else {
      document.getElementById('input-recurrence').value = 'none';
    }
  } else if (defaultCategory) {
    document.getElementById('input-category').value = defaultCategory;
  }

  if (!parentId) updateRecurrenceUI();
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('input-title').focus(), 100);
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  setEditingTaskId(null);
  setModalParentId(null);
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('input-title').value.trim();
  if (!title) return;
  const urgency = getActiveUrgency();
  const dueDate = document.getElementById('input-due-date').value || null;
  const notes = document.getElementById('input-notes').value.trim();
  const isProject = getActiveType() === 'project';
  const recurring = isProject ? null : buildRecurring();

  if (editingTaskId) {
    const editTask = getTasks().find(t => t.id === editingTaskId);
    const updates = { title, urgency, dueDate, notes };
    if (!editTask.parentId && !modalParentId) {
      updates.category = document.getElementById('input-category').value;
      updates.isProject = isProject;
      updates.recurring = recurring;
      if (isProject) updates.recurring = null;
    } else {
      updates.recurring = recurring;
    }
    await updateTask(editingTaskId, updates);
  } else if (modalParentId) {
    // Creating a subtask
    const parentTask = getTasks().find(t => t.id === modalParentId);
    const category = parentTask ? parentTask.category : document.getElementById('input-category').value;
    await createTask(title, category, recurring, urgency, dueDate, notes, false, modalParentId);
    expandedProjects.add(modalParentId);
  } else {
    const category = document.getElementById('input-category').value;
    await createTask(title, category, recurring, urgency, dueDate, notes, isProject);
    if (!expandedCategories.has(category)) {
      expandedCategories.add(category);
    }
  }
  closeModal();
  render();
}

export function initModalEvents() {
  document.getElementById('task-form').addEventListener('submit', handleFormSubmit);
  document.getElementById('btn-cancel').addEventListener('click', closeModal);
  document.getElementById('input-recurrence').addEventListener('change', updateRecurrenceUI);

  document.getElementById('btn-delete').addEventListener('click', async () => {
    if (editingTaskId) {
      await deleteTask(editingTaskId);
      closeModal();
      render();
    }
  });

  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeCatModal();
    }
  });

  document.getElementById('day-toggles').addEventListener('click', e => {
    const btn = e.target.closest('.day-toggle');
    if (btn) btn.classList.toggle('active');
  });

  document.getElementById('urgency-toggles').addEventListener('click', e => {
    const btn = e.target.closest('.urgency-btn');
    if (btn) setActiveUrgency(btn.dataset.urgency);
  });

  document.getElementById('type-toggles').addEventListener('click', e => {
    const btn = e.target.closest('.type-btn');
    if (btn) setActiveType(btn.dataset.type);
  });
}

// --- Category Modal ---

export function openCatModal(mode, catId) {
  editingCatId = (mode === 'edit') ? catId : null;
  const overlay = document.getElementById('cat-modal-overlay');
  const titleEl = document.getElementById('cat-modal-title');
  const deleteBtn = document.getElementById('cat-btn-delete');

  titleEl.textContent = mode === 'edit' ? 'Edit Category' : 'Add Category';
  deleteBtn.classList.toggle('hidden', mode !== 'edit');

  document.getElementById('cat-form').reset();

  let selectedIcon = CATEGORY_EMOJIS[0];
  let selectedColor = CATEGORY_COLORS[0];
  if (mode === 'edit') {
    const cat = getCategories().find(c => c.id === catId);
    if (cat) {
      document.getElementById('cat-input-name').value = cat.name;
      selectedIcon = cat.icon;
      selectedColor = cat.color;
    }
  }
  document.getElementById('cat-input-icon').value = selectedIcon;

  // Build emoji picker
  const emojiContainer = document.getElementById('emoji-picker');
  emojiContainer.textContent = '';
  CATEGORY_EMOJIS.forEach(emoji => {
    const em = document.createElement('span');
    em.className = 'emoji-option' + (emoji === selectedIcon ? ' active' : '');
    em.textContent = emoji;
    em.dataset.emoji = emoji;
    em.addEventListener('click', () => {
      emojiContainer.querySelectorAll('.emoji-option').forEach(s => s.classList.remove('active'));
      em.classList.add('active');
      document.getElementById('cat-input-icon').value = emoji;
    });
    emojiContainer.appendChild(em);
  });

  // Build color swatches
  const swatchContainer = document.getElementById('color-swatches');
  swatchContainer.textContent = '';
  CATEGORY_COLORS.forEach(color => {
    const sw = document.createElement('span');
    sw.className = 'color-swatch' + (color === selectedColor ? ' active' : '');
    sw.style.background = color;
    sw.dataset.color = color;
    sw.addEventListener('click', () => {
      swatchContainer.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
    });
    swatchContainer.appendChild(sw);
  });

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('cat-input-name').focus(), 100);
}

export function closeCatModal() {
  document.getElementById('cat-modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  editingCatId = null;
}

export function initCatModalEvents() {
  document.getElementById('cat-form').addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('cat-input-name').value.trim();
    if (!name) return;
    const icon = document.getElementById('cat-input-icon').value.trim() || '\uD83D\uDCC1';
    const activeSwatch = document.querySelector('.color-swatch.active');
    const color = activeSwatch ? activeSwatch.dataset.color : CATEGORY_COLORS[0];

    if (editingCatId) {
      updateCategoryById(editingCatId, { name, icon, color });
    } else {
      addCategory(name, icon, color);
    }
    closeCatModal();
    render();
  });

  document.getElementById('cat-btn-cancel').addEventListener('click', closeCatModal);

  document.getElementById('cat-btn-delete').addEventListener('click', () => {
    if (editingCatId) {
      if (deleteCategoryById(editingCatId)) {
        closeCatModal();
        render();
      }
    }
  });

  document.getElementById('cat-modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeCatModal();
  });
}
