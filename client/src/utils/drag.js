let draggedId = null;

function clearDropIndicators(listEl) {
  listEl.querySelectorAll('.drag-over-top, .drag-over-bottom').forEach(el => {
    el.classList.remove('drag-over-top', 'drag-over-bottom');
  });
}

function finalizeDrag(listEl, movedId, targetId, insertBefore, getVisibleTasks, reorderCategory, render) {
  const category = listEl.dataset.category;
  const visible = getVisibleTasks(category);
  const ids = visible.map(t => t.id);
  const fromIdx = ids.indexOf(movedId);
  if (fromIdx === -1) return;
  ids.splice(fromIdx, 1);
  let toIdx = ids.indexOf(targetId);
  if (toIdx === -1) return;
  if (!insertBefore) toIdx++;
  ids.splice(toIdx, 0, movedId);
  reorderCategory(category, ids);
  render();
}

export function initDragDesktop(listEl, getVisibleTasks, reorderCategory, render) {
  listEl.addEventListener('dragstart', e => {
    const li = e.target.closest('.task-item');
    if (!li) return;
    draggedId = li.dataset.id;
    li.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', li.dataset.id);
  });

  listEl.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.target.closest('.task-item');
    clearDropIndicators(listEl);
    if (target && target.dataset.id !== draggedId) {
      const rect = target.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      if (e.clientY < mid) {
        target.classList.add('drag-over-top');
      } else {
        target.classList.add('drag-over-bottom');
      }
    }
  });

  listEl.addEventListener('dragleave', e => {
    const target = e.target.closest('.task-item');
    if (target) target.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  listEl.addEventListener('drop', e => {
    e.preventDefault();
    clearDropIndicators(listEl);
    const target = e.target.closest('.task-item');
    if (!target || !draggedId || target.dataset.id === draggedId) return;
    const rect = target.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const insertBefore = e.clientY < mid;
    finalizeDrag(listEl, draggedId, target.dataset.id, insertBefore, getVisibleTasks, reorderCategory, render);
  });

  listEl.addEventListener('dragend', () => {
    clearDropIndicators(listEl);
    const dragging = listEl.querySelector('.dragging');
    if (dragging) dragging.classList.remove('dragging');
    draggedId = null;
  });
}

export function initDragTouch(listEl, getVisibleTasks, reorderCategory, render) {
  let touchId = null;
  let ghost = null;
  let currentTarget = null;

  listEl.addEventListener('touchstart', e => {
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    const li = handle.closest('.task-item');
    if (!li) return;

    touchId = li.dataset.id;
    li.classList.add('dragging');

    ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.setProperty('--cat-color', getComputedStyle(listEl.closest('.category')).getPropertyValue('--cat-color'));
    const titleEl = li.querySelector('.task-title');
    ghost.textContent = titleEl ? titleEl.textContent : '';
    ghost.style.left = '16px';
    ghost.style.top = (e.touches[0].clientY - 20) + 'px';
    document.body.appendChild(ghost);
  }, { passive: true });

  listEl.addEventListener('touchmove', e => {
    if (!touchId || !ghost) return;
    e.preventDefault();

    const touch = e.touches[0];
    ghost.style.top = (touch.clientY - 20) + 'px';

    ghost.style.display = 'none';
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    ghost.style.display = '';

    clearDropIndicators(listEl);
    if (el) {
      const target = el.closest('.task-item');
      if (target && target.dataset.id !== touchId) {
        currentTarget = target;
        const rect = target.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        if (touch.clientY < mid) {
          target.classList.add('drag-over-top');
        } else {
          target.classList.add('drag-over-bottom');
        }
      }
    }
  }, { passive: false });

  listEl.addEventListener('touchend', () => {
    if (!touchId) return;
    clearDropIndicators(listEl);
    const dragging = listEl.querySelector('.dragging');
    if (dragging) dragging.classList.remove('dragging');

    if (currentTarget && currentTarget.dataset.id !== touchId) {
      const hasTop = currentTarget.classList.contains('drag-over-top');
      finalizeDrag(listEl, touchId, currentTarget.dataset.id, hasTop, getVisibleTasks, reorderCategory, render);
    }

    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    ghost = null;
    touchId = null;
    currentTarget = null;
  });

  listEl.addEventListener('touchcancel', () => {
    if (ghost && ghost.parentNode) ghost.parentNode.removeChild(ghost);
    clearDropIndicators(listEl);
    const dragging = listEl.querySelector('.dragging');
    if (dragging) dragging.classList.remove('dragging');
    ghost = null;
    touchId = null;
    currentTarget = null;
  });
}
