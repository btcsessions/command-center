import { getCategories } from '../state.js';

const HABITS_KEY = 'commandcenter_habits';

let habits = [];
let editingHabitId = null;

function loadHabits() {
  try {
    const raw = localStorage.getItem(HABITS_KEY);
    habits = raw ? JSON.parse(raw) : [];
  } catch (e) { habits = []; }
}

function saveHabits() {
  localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
}

export function renderHabits() {
  const section = document.getElementById('habits-section');
  section.textContent = '';

  const header = document.createElement('div');
  header.className = 'habits-header';
  const title = document.createElement('span');
  title.className = 'habits-title';
  title.textContent = 'Ongoing Habits';
  header.appendChild(title);
  section.appendChild(header);

  const row = document.createElement('div');
  row.className = 'habits-row';

  if (habits.length > 0) {
    const categories = getCategories();
    const catOrder = {};
    categories.forEach((c, i) => { catOrder[c.id] = i; });

    const sorted = habits.slice().sort((a, b) => {
      const ao = catOrder[a.category] !== undefined ? catOrder[a.category] : 999;
      const bo = catOrder[b.category] !== undefined ? catOrder[b.category] : 999;
      if (ao !== bo) return ao - bo;
      return (a.sortOrder || 0) - (b.sortOrder || 0);
    });

    sorted.forEach(h => {
      const cat = categories.find(c => c.id === h.category);
      const card = document.createElement('div');
      card.className = 'habit-card';
      card.dataset.habitId = h.id;

      const emoji = document.createElement('span');
      emoji.className = 'habit-card-emoji';
      emoji.textContent = cat ? cat.icon : '';
      card.appendChild(emoji);

      const text = document.createElement('span');
      text.className = 'habit-card-text';
      text.textContent = h.title;
      card.appendChild(text);

      row.appendChild(card);
    });
  }

  const addCard = document.createElement('div');
  addCard.className = 'habit-add-card';
  addCard.id = 'habit-add-trigger';
  addCard.textContent = habits.length > 0 ? '+' : '+ Add Habit';
  row.appendChild(addCard);

  section.appendChild(row);
}

function populateHabitCategories() {
  const sel = document.getElementById('habit-input-category');
  sel.textContent = '';
  getCategories().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.icon + ' ' + c.name;
    sel.appendChild(opt);
  });
}

function openAddHabit() {
  editingHabitId = null;
  document.getElementById('habit-modal-title').textContent = 'Add Habit';
  document.getElementById('habit-input-title').value = '';
  document.getElementById('habit-btn-delete').classList.add('hidden');
  populateHabitCategories();
  document.getElementById('habit-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function openEditHabit(id) {
  const h = habits.find(x => x.id === id);
  if (!h) return;
  editingHabitId = id;
  document.getElementById('habit-modal-title').textContent = 'Edit Habit';
  document.getElementById('habit-input-title').value = h.title;
  document.getElementById('habit-btn-delete').classList.remove('hidden');
  populateHabitCategories();
  document.getElementById('habit-input-category').value = h.category;
  document.getElementById('habit-modal-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeHabitModal() {
  document.getElementById('habit-modal-overlay').classList.remove('open');
  document.body.style.overflow = '';
  editingHabitId = null;
}

export function initHabits() {
  loadHabits();

  // Event delegation for habit cards and add trigger
  document.getElementById('habits-section').addEventListener('click', e => {
    const addTrigger = e.target.closest('#habit-add-trigger');
    if (addTrigger) {
      openAddHabit();
      return;
    }
    const card = e.target.closest('.habit-card');
    if (card) {
      openEditHabit(card.dataset.habitId);
      return;
    }
  });

  // Form submit
  document.getElementById('habit-form').addEventListener('submit', e => {
    e.preventDefault();
    const title = document.getElementById('habit-input-title').value.trim();
    const category = document.getElementById('habit-input-category').value;
    if (!title) return;

    if (editingHabitId) {
      const h = habits.find(x => x.id === editingHabitId);
      if (h) {
        h.title = title;
        h.category = category;
      }
    } else {
      habits.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        title,
        category,
        sortOrder: habits.length
      });
    }
    saveHabits();
    renderHabits();
    closeHabitModal();
  });

  // Cancel
  document.getElementById('habit-btn-cancel').addEventListener('click', closeHabitModal);

  // Delete
  document.getElementById('habit-btn-delete').addEventListener('click', () => {
    if (!editingHabitId) return;
    if (confirm('Delete this habit?')) {
      habits = habits.filter(h => h.id !== editingHabitId);
      saveHabits();
      renderHabits();
      closeHabitModal();
    }
  });

  // Close on overlay click
  document.getElementById('habit-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('habit-modal-overlay')) closeHabitModal();
  });
}
