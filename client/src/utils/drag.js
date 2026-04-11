import { getTasks, getVisibleTasks, getVisibleSubtasks, getCategories, expandedProjects, reorderCategory, reorderSubtasks, reorderCategories, moveTask } from '../state.js';
import { render } from '../render.js';

let draggedId = null;
let catDragActive = false;
let dropIndicator = null;

function clearAllDropIndicators() {
  document.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });
  if (dropIndicator && dropIndicator.parentNode) {
    dropIndicator.parentNode.removeChild(dropIndicator);
  }
  dropIndicator = null;
}

function showDropIndicatorLine(targetItem, insertBefore) {
  const listEl = targetItem.closest('.task-list');
  if (!listEl) return;
  const wrapper = targetItem.closest('.task-wrapper');
  if (!wrapper) return;

  if (!dropIndicator) {
    dropIndicator = document.createElement('div');
    dropIndicator.className = 'drop-indicator';
  }

  if (dropIndicator.parentNode !== listEl) {
    listEl.style.position = 'relative';
    listEl.appendChild(dropIndicator);
  }

  const listRect = listEl.getBoundingClientRect();
  const wrapperRect = wrapper.getBoundingClientRect();
  let y;
  if (insertBefore) {
    y = wrapperRect.top - listRect.top - 1;
  } else {
    y = wrapperRect.bottom - listRect.top - 1;
  }
  dropIndicator.style.top = y + 'px';
}

function getListContext(listEl) {
  if (!listEl) return null;
  if (listEl.dataset.projectId) return { type: 'project', projectId: listEl.dataset.projectId, category: listEl.dataset.category };
  if (listEl.dataset.category) return { type: 'category', category: listEl.dataset.category };
  return null;
}

function resolveDropTarget(el, clientY) {
  const tasks = getTasks();
  // 1. Dropped on a task-item
  const taskItem = el.closest('.task-item');
  if (taskItem && taskItem.dataset.id !== draggedId) {
    const listEl = taskItem.closest('.task-list');
    if (listEl) {
      const rect = taskItem.getBoundingClientRect();
      return { listEl, targetId: taskItem.dataset.id, insertBefore: clientY < rect.top + rect.height / 2 };
    }
  }
  // 2. Dropped on subtask area
  const subtaskList = el.closest('.subtask-list');
  if (subtaskList && subtaskList.dataset.projectId) {
    return { moveOnly: true, destCategory: subtaskList.dataset.category, destProjectId: subtaskList.dataset.projectId };
  }
  const addSubBtn = el.closest('.add-subtask-btn');
  if (addSubBtn && addSubBtn.dataset.projectId) {
    const proj = tasks.find(t => t.id === addSubBtn.dataset.projectId);
    return { moveOnly: true, destCategory: proj ? proj.category : null, destProjectId: addSubBtn.dataset.projectId };
  }
  // 3. Dropped on a project row — add as subtask
  if (taskItem && taskItem.dataset.id) {
    const droppedOnTask = tasks.find(t => t.id === taskItem.dataset.id);
    if (droppedOnTask && droppedOnTask.isProject && taskItem.dataset.id !== draggedId) {
      return { moveOnly: true, destCategory: droppedOnTask.category, destProjectId: droppedOnTask.id };
    }
  }
  // 4. Dropped on category header or body — move to that category
  const catSection = el.closest('.category');
  if (catSection) {
    return { moveOnly: true, destCategory: catSection.dataset.category, destProjectId: null };
  }
  return null;
}

function executeDrop(dropInfo) {
  if (!draggedId) return;
  const tasks = getTasks();
  const movedTask = tasks.find(t => t.id === draggedId);
  if (!movedTask) return;

  if (dropInfo.moveOnly) {
    if (movedTask.isProject && dropInfo.destProjectId) return;
    const srcProjectId = movedTask.parentId || null;
    const srcCategory = movedTask.category;
    if (srcProjectId !== dropInfo.destProjectId || srcCategory !== dropInfo.destCategory) {
      moveTask(draggedId, dropInfo.destCategory, dropInfo.destProjectId);
      if (dropInfo.destProjectId) expandedProjects.add(dropInfo.destProjectId);
    }
    render();
  } else {
    finalizeDrag(dropInfo.listEl, draggedId, dropInfo.targetId, dropInfo.insertBefore);
  }
}

function showDropZoneIndicator(el) {
  clearAllDropIndicators();
  const taskItem = el.closest('.task-item');
  if (taskItem && taskItem.dataset.id !== draggedId) {
    taskItem.classList.add('drag-over-bottom');
    return;
  }
  const subtaskList = el.closest('.subtask-list');
  if (subtaskList) { subtaskList.classList.add('drag-over-bottom'); return; }
  const addSubBtn = el.closest('.add-subtask-btn');
  if (addSubBtn) { addSubBtn.classList.add('drag-over-bottom'); return; }
  const catHeader = el.closest('.category-header');
  if (catHeader) { catHeader.classList.add('drag-over-bottom'); return; }
}

function finalizeDrag(targetListEl, movedId, targetId, insertBefore) {
  const tasks = getTasks();
  const movedTask = tasks.find(t => t.id === movedId);
  if (!movedTask) return;
  const targetTask = tasks.find(t => t.id === targetId);
  if (!targetTask) return;

  const destCtx = getListContext(targetListEl);
  if (!destCtx) return;

  if (movedTask.isProject && destCtx.type === 'project') return;

  const srcProjectId = movedTask.parentId || null;
  const srcCategory = movedTask.category;
  const destProjectId = destCtx.type === 'project' ? destCtx.projectId : null;
  const destCategory = destCtx.category;

  if (srcProjectId !== destProjectId || srcCategory !== destCategory) {
    moveTask(movedId, destCategory, destProjectId);
  }

  let visible;
  if (destProjectId) {
    visible = getVisibleSubtasks(destProjectId);
  } else {
    visible = getVisibleTasks(destCategory);
  }
  const ids = visible.map(t => t.id);
  const fromIdx = ids.indexOf(movedId);
  if (fromIdx !== -1) ids.splice(fromIdx, 1);
  let toIdx = ids.indexOf(targetId);
  if (toIdx === -1) {
    ids.push(movedId);
  } else {
    if (!insertBefore) toIdx++;
    ids.splice(toIdx, 0, movedId);
  }
  if (destProjectId) {
    reorderSubtasks(destProjectId, ids);
  } else {
    reorderCategory(destCategory, ids);
  }
  render();
}

// --- Global init (called once from main.js) ---

export function initGlobalDrag() {
  const app = document.getElementById('app');

  // Desktop task drag
  let lastMousedownTarget = null;
  app.addEventListener('mousedown', e => {
    lastMousedownTarget = e.target;
    const item = e.target.closest('.task-item');
    if (item) {
      item.setAttribute('draggable', !!e.target.closest('.drag-handle'));
    }
  }, true);

  app.addEventListener('dragstart', e => {
    if (catDragActive) return;
    if (!lastMousedownTarget || !lastMousedownTarget.closest('.drag-handle')) { e.preventDefault(); return; }
    const li = e.target.closest('.task-item');
    if (!li) return;
    draggedId = li.dataset.id;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', li.dataset.id);
  });

  app.addEventListener('dragover', e => {
    if (catDragActive) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    clearAllDropIndicators();
    const target = e.target.closest('.task-item');
    if (target && target.dataset.id !== draggedId) {
      const rect = target.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const above = e.clientY < mid;
      target.classList.add(above ? 'drag-over-top' : 'drag-over-bottom');
      showDropIndicatorLine(target, above);
    } else {
      showDropZoneIndicator(e.target);
    }
  });

  app.addEventListener('dragleave', e => {
    if (catDragActive) return;
    const target = e.target.closest('.task-item');
    if (target) {
      target.classList.remove('drag-over-top', 'drag-over-bottom');
    }
  });

  app.addEventListener('drop', e => {
    if (catDragActive) return;
    e.preventDefault();
    clearAllDropIndicators();
    if (!draggedId) return;
    const dropInfo = resolveDropTarget(e.target, e.clientY);
    if (dropInfo) executeDrop(dropInfo);
  });

  app.addEventListener('dragend', () => {
    clearAllDropIndicators();
    const dragging = document.querySelector('.dragging');
    if (dragging) dragging.classList.remove('dragging');
    draggedId = null;
  });

  // Touch task drag
  let touchId = null;
  let ghost = null;
  let lastTouchEl = null;

  app.addEventListener('touchstart', e => {
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    const li = handle.closest('.task-item');
    if (!li) return;

    touchId = li.dataset.id;
    draggedId = touchId;
    li.classList.add('dragging');

    ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    const cat = li.closest('.category');
    if (cat) ghost.style.setProperty('--cat-color', getComputedStyle(cat).getPropertyValue('--cat-color'));
    const titleEl = li.querySelector('.task-title');
    ghost.textContent = titleEl ? titleEl.textContent : '';
    ghost.style.left = '16px';
    ghost.style.top = (e.touches[0].clientY - 20) + 'px';
    document.body.appendChild(ghost);
  }, { passive: true });

  app.addEventListener('touchmove', e => {
    if (!touchId || !ghost) return;
    e.preventDefault();

    const touch = e.touches[0];
    ghost.style.top = (touch.clientY - 20) + 'px';

    ghost.style.display = 'none';
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    ghost.style.display = '';

    clearAllDropIndicators();
    lastTouchEl = el;
    if (el) {
      const target = el.closest('.task-item');
      if (target && target.dataset.id !== touchId) {
        const rect = target.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const above = touch.clientY < mid;
        target.classList.add(above ? 'drag-over-top' : 'drag-over-bottom');
        showDropIndicatorLine(target, above);
      } else {
        showDropZoneIndicator(el);
      }
    }
  }, { passive: false });

  app.addEventListener('touchend', e => {
    if (!touchId) return;
    clearAllDropIndicators();
    const dragging = document.querySelector('.dragging');
    if (dragging) dragging.classList.remove('dragging');

    if (lastTouchEl) {
      const touch = e.changedTouches && e.changedTouches[0];
      const clientY = touch ? touch.clientY : 0;
      const dropInfo = resolveDropTarget(lastTouchEl, clientY);
      if (dropInfo) executeDrop(dropInfo);
    }

    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    ghost = null;
    touchId = null;
    draggedId = null;
    lastTouchEl = null;
  });

  app.addEventListener('touchcancel', () => {
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    clearAllDropIndicators();
    const dragging = document.querySelector('.dragging');
    if (dragging) dragging.classList.remove('dragging');
    ghost = null;
    touchId = null;
    draggedId = null;
    lastTouchEl = null;
  });

  // --- Desktop category drag ---
  let catDragId = null;

  app.addEventListener('mousedown', e => {
    const handle = e.target.closest('.cat-drag-handle');
    if (!handle) return;
    const section = handle.closest('.category');
    if (section) section.setAttribute('draggable', 'true');
  });
  document.addEventListener('mouseup', () => {
    document.querySelectorAll('.category[draggable="true"]').forEach(s => {
      s.setAttribute('draggable', 'false');
    });
  });

  app.addEventListener('dragstart', e => {
    const handle = e.target.closest('.cat-drag-handle');
    if (!handle) return;
    const section = e.target.closest('.category');
    if (!section) return;
    catDragId = section.dataset.category;
    catDragActive = true;
    section.classList.add('cat-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/x-cat-id', catDragId);
    e.stopPropagation();
  });

  app.addEventListener('dragover', e => {
    if (!catDragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('.category').forEach(s => {
      s.classList.remove('cat-drag-over-left', 'cat-drag-over-right');
    });
    const section = e.target.closest('.category');
    if (section && section.dataset.category !== catDragId) {
      const rect = section.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      section.classList.add(e.clientX < mid ? 'cat-drag-over-left' : 'cat-drag-over-right');
    }
  });

  app.addEventListener('drop', e => {
    if (!catDragId) return;
    e.preventDefault();
    e.stopPropagation();
    const section = e.target.closest('.category');
    if (section && section.dataset.category !== catDragId) {
      const rect = section.getBoundingClientRect();
      const mid = rect.left + rect.width / 2;
      const insertBefore = e.clientX < mid;
      const categories = getCategories();
      const orderedIds = categories.map(c => c.id);
      const fromIdx = orderedIds.indexOf(catDragId);
      if (fromIdx > -1) orderedIds.splice(fromIdx, 1);
      let toIdx = orderedIds.indexOf(section.dataset.category);
      if (!insertBefore) toIdx++;
      orderedIds.splice(toIdx, 0, catDragId);
      reorderCategories(orderedIds);
      render();
    }
    catDragId = null;
    catDragActive = false;
  });

  app.addEventListener('dragend', () => {
    if (!catDragId) return;
    document.querySelectorAll('.category').forEach(s => {
      s.classList.remove('cat-dragging', 'cat-drag-over-left', 'cat-drag-over-right');
      s.setAttribute('draggable', 'false');
    });
    catDragId = null;
    catDragActive = false;
  });

  // --- Touch category drag ---
  let catTouchId = null;
  let catGhost = null;
  let catLastEl = null;

  app.addEventListener('touchstart', e => {
    const handle = e.target.closest('.cat-drag-handle');
    if (!handle) return;
    const section = handle.closest('.category');
    if (!section) return;
    catTouchId = section.dataset.category;
    section.classList.add('cat-dragging');
    catGhost = document.createElement('div');
    catGhost.className = 'drag-ghost';
    catGhost.style.setProperty('--cat-color', getComputedStyle(section).getPropertyValue('--cat-color'));
    const categories = getCategories();
    const cat = categories.find(c => c.id === catTouchId);
    catGhost.textContent = cat ? cat.icon + ' ' + cat.name : '';
    catGhost.style.left = '16px';
    catGhost.style.top = (e.touches[0].clientY - 20) + 'px';
    document.body.appendChild(catGhost);
    e.preventDefault();
  }, { passive: false });

  app.addEventListener('touchmove', e => {
    if (!catTouchId || !catGhost) return;
    e.preventDefault();
    const touch = e.touches[0];
    catGhost.style.top = (touch.clientY - 20) + 'px';
    catGhost.style.display = 'none';
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    catGhost.style.display = '';
    document.querySelectorAll('.category').forEach(s => {
      s.classList.remove('cat-drag-over-left', 'cat-drag-over-right');
    });
    catLastEl = el;
    if (el) {
      const section = el.closest('.category');
      if (section && section.dataset.category !== catTouchId) {
        const rect = section.getBoundingClientRect();
        const mid = rect.left + rect.width / 2;
        section.classList.add(touch.clientX < mid ? 'cat-drag-over-left' : 'cat-drag-over-right');
      }
    }
  }, { passive: false });

  app.addEventListener('touchend', e => {
    if (!catTouchId) return;
    if (catLastEl) {
      const section = catLastEl.closest('.category');
      if (section && section.dataset.category !== catTouchId) {
        const rect = section.getBoundingClientRect();
        const touch = e.changedTouches && e.changedTouches[0];
        const clientX = touch ? touch.clientX : rect.left;
        const mid = rect.left + rect.width / 2;
        const insertBefore = clientX < mid;
        const categories = getCategories();
        const orderedIds = categories.map(c => c.id);
        const fromIdx = orderedIds.indexOf(catTouchId);
        if (fromIdx > -1) orderedIds.splice(fromIdx, 1);
        let toIdx = orderedIds.indexOf(section.dataset.category);
        if (!insertBefore) toIdx++;
        orderedIds.splice(toIdx, 0, catTouchId);
        reorderCategories(orderedIds);
        render();
      }
    }
    document.querySelectorAll('.category').forEach(s => {
      s.classList.remove('cat-dragging', 'cat-drag-over-left', 'cat-drag-over-right');
    });
    if (catGhost && catGhost.parentNode) catGhost.parentNode.removeChild(catGhost);
    catGhost = null;
    catTouchId = null;
    catLastEl = null;
  });
}
