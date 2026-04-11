const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function getTodayStr() {
  const d = new Date();
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

export function formatDateDisplay(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function isScheduledForToday(task, todayStr) {
  if (!task.recurring) return true;
  const today = new Date(todayStr + 'T00:00:00');
  switch (task.recurring.type) {
    case 'daily': return true;
    case 'weekly': return task.recurring.days.includes(today.getDay());
    case 'custom': {
      const created = new Date(task.createdAt.slice(0, 10) + 'T00:00:00');
      const diff = Math.round((today - created) / 86400000);
      return diff >= 0 && (diff % task.recurring.interval) === 0;
    }
    default: return true;
  }
}

export function isTaskVisible(task, todayStr) {
  if (task.deleted) return false;
  if (!task.recurring) return task.completions.length === 0;
  return !task.completions.includes(todayStr) && isScheduledForToday(task, todayStr);
}

export function getRecurrenceLabel(task) {
  if (!task.recurring) return '';
  switch (task.recurring.type) {
    case 'daily': return 'Daily';
    case 'weekly': {
      const days = task.recurring.days.map(d => DAY_NAMES[d]).join(', ');
      return days;
    }
    case 'custom': return 'Every ' + task.recurring.interval + 'd';
    default: return '';
  }
}

export function formatDueDate(dateStr, todayStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T00:00:00');
  const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (dateStr < todayStr) return { text: 'Overdue', cls: 'overdue' };
  if (dateStr === todayStr) return { text: 'Due today', cls: 'today' };
  return { text: 'Due ' + label, cls: 'upcoming' };
}
