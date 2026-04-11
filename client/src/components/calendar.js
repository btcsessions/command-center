const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

let viewYear, viewMonth;

function getToday() {
  const d = new Date();
  return { y: d.getFullYear(), m: d.getMonth(), d: d.getDate() };
}

function pad(n) { return n < 10 ? '0' + n : '' + n; }
function toStr(y, m, d) { return y + '-' + pad(m + 1) + '-' + pad(d); }

function formatDisplay(str) {
  if (!str) return null;
  const p = str.split('-');
  const d = new Date(+p[0], +p[1] - 1, +p[2]);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

let hiddenInput, displayText, clearBtn, dropdown, grid, monthLabel;

function renderCal() {
  const t = getToday();
  const sel = hiddenInput.value || '';
  monthLabel.textContent = MONTHS[viewMonth] + ' ' + viewYear;

  grid.textContent = '';

  for (let i = 0; i < 7; i++) {
    const dow = document.createElement('span');
    dow.className = 'cal-dow';
    dow.textContent = DAYS[i];
    grid.appendChild(dow);
  }

  const first = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const prevDays = new Date(viewYear, viewMonth, 0).getDate();

  // Previous month padding
  for (let i = 0; i < first; i++) {
    const d = prevDays - first + 1 + i;
    const pm = viewMonth === 0 ? 11 : viewMonth - 1;
    const py = viewMonth === 0 ? viewYear - 1 : viewYear;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day other-month';
    btn.dataset.date = toStr(py, pm, d);
    btn.textContent = d;
    grid.appendChild(btn);
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    const s = toStr(viewYear, viewMonth, d);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day';
    if (d === t.d && viewMonth === t.m && viewYear === t.y) btn.classList.add('today');
    if (s === sel) btn.classList.add('selected');
    btn.dataset.date = s;
    btn.textContent = d;
    grid.appendChild(btn);
  }

  // Next month padding
  const total = first + daysInMonth;
  const rem = total % 7 === 0 ? 0 : 7 - (total % 7);
  for (let i = 1; i <= rem; i++) {
    const nm = viewMonth === 11 ? 0 : viewMonth + 1;
    const ny = viewMonth === 11 ? viewYear + 1 : viewYear;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cal-day other-month';
    btn.dataset.date = toStr(ny, nm, i);
    btn.textContent = i;
    grid.appendChild(btn);
  }
}

function openCal() {
  const val = hiddenInput.value;
  if (val) {
    const p = val.split('-');
    viewYear = +p[0]; viewMonth = +p[1] - 1;
  } else {
    const t = getToday();
    viewYear = t.y; viewMonth = t.m;
  }
  renderCal();
  dropdown.classList.add('open');
}

function closeCal() { dropdown.classList.remove('open'); }

function selectDate(str) {
  hiddenInput.value = str;
  displayText.textContent = formatDisplay(str);
  displayText.classList.remove('empty');
  clearBtn.classList.remove('hidden');
  closeCal();
}

function clearDate() {
  hiddenInput.value = '';
  displayText.textContent = 'Select a date';
  displayText.classList.add('empty');
  clearBtn.classList.add('hidden');
}

export function setCalendarDate(str) {
  if (str) { selectDate(str); } else { clearDate(); }
}

export function initCalendar() {
  hiddenInput = document.getElementById('input-due-date');
  displayText = document.getElementById('cal-display-text');
  clearBtn = document.getElementById('cal-clear');
  dropdown = document.getElementById('cal-dropdown');
  grid = document.getElementById('cal-grid');
  monthLabel = document.getElementById('cal-month');
  const display = document.getElementById('cal-display');

  display.addEventListener('click', e => {
    if (e.target === clearBtn || e.target.closest('.cal-clear')) return;
    dropdown.classList.contains('open') ? closeCal() : openCal();
  });

  clearBtn.addEventListener('click', e => {
    e.stopPropagation();
    clearDate();
  });

  document.getElementById('cal-prev').addEventListener('click', () => {
    viewMonth--;
    if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    renderCal();
  });

  document.getElementById('cal-next').addEventListener('click', () => {
    viewMonth++;
    if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    renderCal();
  });

  grid.addEventListener('click', e => {
    const btn = e.target.closest('.cal-day');
    if (!btn) return;
    selectDate(btn.dataset.date);
  });

  // Close calendar when clicking outside
  document.addEventListener('click', e => {
    if (!e.target.closest('#cal-wrap')) closeCal();
  });
}
