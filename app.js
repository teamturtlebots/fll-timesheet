// ---------- Storage ----------
const STORAGE_KEY = 'hourtrack_entries_v1';

function loadEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load entries', e);
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

let entries = loadEntries();
let editingId = null;
let sortKey = 'date';
let sortDir = 'desc';

// ---------- Elements ----------
const form = document.getElementById('entryForm');
const fName = document.getElementById('fName');
const fDate = document.getElementById('fDate');
const fActivity = document.getElementById('fActivity');
const fDuration = document.getElementById('fDuration');
const fWeek = document.getElementById('fWeek');
const fComments = document.getElementById('fComments');
const nameList = document.getElementById('nameList');
const entriesBody = document.getElementById('entriesBody');
const emptyMsg = document.getElementById('emptyMsg');
const statsGrid = document.getElementById('statsGrid');
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const filterWeek = document.getElementById('filterWeek');
const filterActivity = document.getElementById('filterActivity');
const filterName = document.getElementById('filterName');
const statusEl = document.getElementById('status');

// default date = today
fDate.value = new Date().toISOString().slice(0, 10);

// ---------- Helpers ----------
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${m}/${day}/${y}`;
}

// ---------- Render ----------
function render() {
  // populate datalist of known names
  const names = [...new Set(entries.map(e => e.name))].sort();
  nameList.innerHTML = names.map(n => `<option value="${escapeHtml(n)}">`).join('');

  // populate filter dropdowns
  const weeks = [...new Set(entries.map(e => e.week))].sort((a, b) => a - b);
  const curWeekFilter = filterWeek.value;
  filterWeek.innerHTML = '<option value="">All weeks</option>' +
    weeks.map(w => `<option value="${w}">Week ${w}</option>`).join('');
  filterWeek.value = curWeekFilter;

  const activities = [...new Set(entries.map(e => e.activity))].sort();
  const curActFilter = filterActivity.value;
  filterActivity.innerHTML = '<option value="">All activities</option>' +
    activities.map(a => `<option value="${escapeHtml(a)}">${escapeHtml(a)}</option>`).join('');
  filterActivity.value = curActFilter;

  // filter
  let rows = entries.filter(e => {
    if (filterWeek.value && String(e.week) !== filterWeek.value) return false;
    if (filterActivity.value && e.activity !== filterActivity.value) return false;
    if (filterName.value && !e.name.toLowerCase().includes(filterName.value.toLowerCase())) return false;
    return true;
  });

  // sort
  rows.sort((a, b) => {
    let av = a[sortKey], bv = b[sortKey];
    if (sortKey === 'duration' || sortKey === 'week') { av = Number(av); bv = Number(bv); }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  entriesBody.innerHTML = rows.map(e => `
    <tr>
      <td>${escapeHtml(e.name)}</td>
      <td>${fmtDate(e.date)}</td>
      <td><span class="pill">${escapeHtml(e.activity)}</span></td>
      <td>${Number(e.duration).toFixed(2)}</td>
      <td>${escapeHtml(e.comments || '')}</td>
      <td>${escapeHtml(String(e.week))}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary btn-sm" onclick="startEdit('${e.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteEntry('${e.id}')">Del</button>
        </div>
      </td>
    </tr>
  `).join('');

  emptyMsg.style.display = rows.length === 0 ? 'block' : 'none';

  renderStats(rows.length ? rows : entries);
  statusEl.textContent = `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} · stored offline`;
}

function renderStats(rows) {
  const totalHours = rows.reduce((s, e) => s + Number(e.duration), 0);
  const byPerson = {};
  rows.forEach(e => { byPerson[e.name] = (byPerson[e.name] || 0) + Number(e.duration); });
  const people = Object.keys(byPerson).length;
  const weeks = new Set(rows.map(e => e.week)).size;

  let topPerson = '—';
  let topHours = 0;
  Object.entries(byPerson).forEach(([n, h]) => { if (h > topHours) { topHours = h; topPerson = n; } });

  statsGrid.innerHTML = `
    <div class="stat"><div class="val">${totalHours.toFixed(1)}</div><div class="lbl">Total hours</div></div>
    <div class="stat"><div class="val">${people}</div><div class="lbl">People logged</div></div>
    <div class="stat"><div class="val">${weeks}</div><div class="lbl">Weeks covered</div></div>
    <div class="stat"><div class="val">${topPerson}</div><div class="lbl">Top contributor (${topHours.toFixed(1)}h)</div></div>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- CRUD ----------
form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const entry = {
    id: editingId || uid(),
    name: fName.value.trim(),
    date: fDate.value,
    activity: fActivity.value,
    duration: parseFloat(fDuration.value),
    comments: fComments.value.trim(),
    week: parseInt(fWeek.value, 10)
  };
  if (!entry.name || isNaN(entry.duration) || isNaN(entry.week)) return;

  if (editingId) {
    const idx = entries.findIndex(e => e.id === editingId);
    if (idx > -1) entries[idx] = entry;
    toast('Entry updated');
  } else {
    entries.push(entry);
    toast('Entry added');
  }
  saveEntries(entries);
  resetForm();
  render();
});

function startEdit(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  editingId = id;
  fName.value = e.name;
  fDate.value = e.date;
  fActivity.value = e.activity;
  fDuration.value = e.duration;
  fWeek.value = e.week;
  fComments.value = e.comments || '';
  submitBtn.textContent = 'Save Changes';
  cancelEditBtn.style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteEntry(id) {
  if (!confirm('Delete this entry?')) return;
  entries = entries.filter(e => e.id !== id);
  saveEntries(entries);
  render();
  toast('Entry deleted');
}

function resetForm() {
  editingId = null;
  form.reset();
  fDate.value = new Date().toISOString().slice(0, 10);
  submitBtn.textContent = 'Add Entry';
  cancelEditBtn.style.display = 'none';
}

cancelEditBtn.addEventListener('click', resetForm);

document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (!confirm('Delete ALL entries? This cannot be undone.')) return;
  entries = [];
  saveEntries(entries);
  render();
  toast('All entries cleared');
});

// ---------- Filters / sort ----------
[filterWeek, filterActivity, filterName].forEach(el => el.addEventListener('input', render));

document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (sortKey === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortKey = key; sortDir = 'asc'; }
    render();
  });
});

// ---------- Export ----------
function getExportRows() {
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));
  return rows.map(e => ({
    Name: e.name,
    Date: fmtDate(e.date),
    Activity: e.activity,
    'Duration (hours)': Number(e.duration),
    'Comments (optional)': e.comments || '',
    Week: e.week
  }));
}

document.getElementById('exportXlsxBtn').addEventListener('click', () => {
  if (typeof XLSX === 'undefined') { toast('Export library not loaded — check connection'); return; }
  const rows = getExportRows();
  if (!rows.length) { toast('Nothing to export'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 11 }, { wch: 22 }, { wch: 14 }, { wch: 30 }, { wch: 6 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Hours');
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `fll-hours-${stamp}.xlsx`);
  toast('Exported .xlsx');
});

document.getElementById('exportCsvBtn').addEventListener('click', () => {
  const rows = getExportRows();
  if (!rows.length) { toast('Nothing to export'); return; }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(','),
    ...rows.map(r => headers.map(h => `"${String(r[h]).replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `fll-hours-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Exported .csv');
});

// ---------- Service worker ----------
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
  });
}

// expose for inline onclick handlers
window.startEdit = startEdit;
window.deleteEntry = deleteEntry;

// ---------- Init ----------
render();
