// ---------- Firebase (shared cloud storage, no login) ----------
const DEFAULT_ROSTER = ['Evan', 'Mason', 'Ellen', 'Eric', 'Stanley', 'Anya', 'Aiden'];
const ACTIVITIES = ['Robot', 'Project', 'Community'];
const SEASON_START = new Date('2026-07-20T00:00:00'); // Week 1 = 7/20–7/26

function computeWeek(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  const diffDays = Math.floor((d - SEASON_START) / 86400000);
  const week = Math.floor(diffDays / 7) + 1;
  return week < 1 ? 1 : week;
}

const db = firebase.firestore();
try { db.enablePersistence({ synchronizeTabs: true }); } catch (e) { /* offline cache unavailable, non-fatal */ }

let entries = [];
let roster = [...DEFAULT_ROSTER];

let editingId = null;
let sortKey = 'date';
let sortDir = 'desc';

// ---------- Elements: single entry form ----------
const form = document.getElementById('entryForm');
const fName = document.getElementById('fName');
const fDate = document.getElementById('fDate');
const fActivity = document.getElementById('fActivity');
const fDuration = document.getElementById('fDuration');
const fWeek = document.getElementById('fWeek');
const fComments = document.getElementById('fComments');
const nameList = document.getElementById('nameList');
const submitBtn = document.getElementById('submitBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// ---------- Elements: entries table ----------
const entriesBody = document.getElementById('entriesBody');
const emptyMsg = document.getElementById('emptyMsg');
const statsGrid = document.getElementById('statsGrid');
const filterWeek = document.getElementById('filterWeek');
const filterActivity = document.getElementById('filterActivity');
const filterName = document.getElementById('filterName');
const statusEl = document.getElementById('status');

// ---------- Elements: matrix ----------
const mDate = document.getElementById('mDate');
const mWeek = document.getElementById('mWeek');
const mComments = document.getElementById('mComments');
const matrixBody = document.getElementById('matrixBody');
const newRowName = document.getElementById('newRowName');
const addRowBtn = document.getElementById('addRowBtn');
const commitMatrixBtn = document.getElementById('commitMatrixBtn');
const clearMatrixBtn = document.getElementById('clearMatrixBtn');

// ---------- Elements: summary ----------
const memberBars = document.getElementById('memberBars');
const memberLegend = document.getElementById('memberLegend');
const activityPie = document.getElementById('activityPie');
const weeklyChart = document.getElementById('weeklyChart');
const cumulativeChart = document.getElementById('cumulativeChart');
const cumulativeBody = document.getElementById('cumulativeBody');

// defaults
const todayStr = new Date().toISOString().slice(0, 10);
fDate.value = todayStr;
mDate.value = todayStr;

function refreshWeekDisplays() {
  fWeek.value = computeWeek(fDate.value);
  mWeek.value = computeWeek(mDate.value);
}
fDate.addEventListener('input', refreshWeekDisplays);
mDate.addEventListener('input', refreshWeekDisplays);
refreshWeekDisplays();

// ---------- Helpers ----------
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

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ---------- Live data from Firestore ----------
statusEl.textContent = 'Connecting…';

db.collection('entries').onSnapshot(snapshot => {
  entries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  render();
}, err => toast('Sync error: ' + err.message));

db.collection('meta').doc('roster').onSnapshot(doc => {
  if (doc.exists && Array.isArray(doc.data().names) && doc.data().names.length) {
    roster = doc.data().names;
  } else {
    // first time anyone's opened this — seed the shared roster
    roster = [...DEFAULT_ROSTER];
    db.collection('meta').doc('roster').set({ names: roster }).catch(() => {});
  }
  renderMatrix();
  render();
}, err => toast('Sync error: ' + err.message));

// ---------- Top-level tabs (Entry / Summary) ----------
document.querySelectorAll('.maintab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.maintab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.mainpanel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.maintab).classList.add('active');
  });
});

// ---------- Tabs (Matrix / Single Entry, within the Entry panel) ----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
  });
});

// ---------- Matrix ----------
function renderMatrix() {
  matrixBody.innerHTML = roster.map(name => `
    <tr data-name="${escapeHtml(name)}">
      <td class="namecell">${escapeHtml(name)}</td>
      ${ACTIVITIES.map(a => `<td><input type="number" class="hourcell" step="0.25" min="0" data-activity="${a}" placeholder="0"></td>`).join('')}
      <td><input type="text" class="commentcell" placeholder="optional"></td>
      <td class="rmcell"><button class="btn btn-danger btn-sm" onclick="removeRosterRow('${escapeHtml(name)}')">✕</button></td>
    </tr>
  `).join('');
}

function removeRosterRow(name) {
  const updated = roster.filter(n => n !== name);
  db.collection('meta').doc('roster').set({ names: updated }).catch(err => toast('Error: ' + err.message));
}
window.removeRosterRow = removeRosterRow;

addRowBtn.addEventListener('click', () => {
  const name = newRowName.value.trim();
  if (!name) return;
  if (roster.includes(name)) { toast('Already in the list'); return; }
  const updated = [...roster, name];
  db.collection('meta').doc('roster').set({ names: updated })
    .then(() => { newRowName.value = ''; })
    .catch(err => toast('Error: ' + err.message));
});
newRowName.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addRowBtn.click(); } });

clearMatrixBtn.addEventListener('click', () => {
  matrixBody.querySelectorAll('input.hourcell').forEach(inp => inp.value = '');
});

commitMatrixBtn.addEventListener('click', () => {
  const date = mDate.value;
  const week = computeWeek(date);
  const overallComment = mComments.value.trim();

  if (!date) { toast('Pick a date first'); return; }

  const newEntries = [];
  matrixBody.querySelectorAll('tr').forEach(tr => {
    const name = tr.dataset.name;
    const rowComment = tr.querySelector('input.commentcell').value.trim();
    const comments = rowComment && overallComment ? `${rowComment} | ${overallComment}`
                      : (rowComment || overallComment);
    tr.querySelectorAll('input.hourcell').forEach(inp => {
      const val = parseFloat(inp.value);
      if (!isNaN(val) && val > 0) {
        newEntries.push({
          name,
          date,
          activity: inp.dataset.activity,
          duration: val,
          comments,
          week
        });
      }
    });
  });

  if (!newEntries.length) { toast('No hours entered'); return; }

  const batch = db.batch();
  newEntries.forEach(e => batch.set(db.collection('entries').doc(), e));
  batch.commit()
    .then(() => {
      matrixBody.querySelectorAll('input.hourcell').forEach(inp => inp.value = '');
      matrixBody.querySelectorAll('input.commentcell').forEach(inp => inp.value = '');
      mComments.value = '';
      toast(`Added ${newEntries.length} entr${newEntries.length === 1 ? 'y' : 'ies'}`);
    })
    .catch(err => toast('Error: ' + err.message));
});

// ---------- Render entries table ----------
function render() {
  const names = [...new Set([...roster, ...entries.map(e => e.name)])].sort();
  nameList.innerHTML = names.map(n => `<option value="${escapeHtml(n)}">`).join('');

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

  let rows = entries.filter(e => {
    if (filterWeek.value && String(e.week) !== filterWeek.value) return false;
    if (filterActivity.value && e.activity !== filterActivity.value) return false;
    if (filterName.value && !e.name.toLowerCase().includes(filterName.value.toLowerCase())) return false;
    return true;
  });

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
  renderStats(entries);
  renderMemberBars(entries);
  renderActivityPie(entries);
  renderWeeklyChart(entries);
  statusEl.textContent = `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} · synced live`;
}

function renderMemberBars(rows) {
  memberLegend.innerHTML = ACTIVITIES.map(a =>
    `<span class="legend-item"><span class="swatch" style="background:${ACTIVITY_COLORS[a]}"></span>${a}</span>`
  ).join('');

  const byPerson = {};
  rows.forEach(e => {
    if (!byPerson[e.name]) byPerson[e.name] = { Robot: 0, Project: 0, Community: 0, total: 0 };
    byPerson[e.name][e.activity] = (byPerson[e.name][e.activity] || 0) + Number(e.duration);
    byPerson[e.name].total += Number(e.duration);
  });
  const list = Object.entries(byPerson).sort((a, b) => b[1].total - a[1].total);
  if (!list.length) { memberBars.innerHTML = '<div class="empty">No data yet</div>'; return; }
  const max = Math.max(...list.map(([, v]) => v.total));

  memberBars.innerHTML = list.map(([name, v]) => {
    const outerWidth = max > 0 ? (v.total / max * 100) : 0;
    const segments = ACTIVITIES.map(a => {
      if (v[a] <= 0) return '';
      const segWidth = v.total > 0 ? (v[a] / v.total * 100) : 0;
      return `<span style="width:${segWidth}%;background:${ACTIVITY_COLORS[a]};" title="${a}: ${v[a].toFixed(1)}h"></span>`;
    }).join('');
    const breakdown = ACTIVITIES.filter(a => v[a] > 0).map(a => `${a} ${v[a].toFixed(1)}h`).join(' · ');
    return `
      <div class="barrow">
        <div>${escapeHtml(name)}</div>
        <div class="bartrack"><div class="barfill-stack" style="width:${outerWidth}%;">${segments}</div></div>
        <div class="barval">${v.total.toFixed(1)}h</div>
      </div>
      <div class="barbreakdown">${escapeHtml(breakdown)}</div>
    `;
  }).join('');
}

const ACTIVITY_COLORS = { Robot: '#4f8ef7', Project: '#3ddc97', Community: '#f5b93d' };

function renderActivityPie(rows) {
  const totals = {}; ACTIVITIES.forEach(a => totals[a] = 0);
  rows.forEach(e => { totals[e.activity] = (totals[e.activity] || 0) + Number(e.duration); });
  const total = Object.values(totals).reduce((a, b) => a + b, 0);

  if (total === 0) { activityPie.innerHTML = '<div class="empty">No data yet</div>'; return; }

  const r = 60, circ = 2 * Math.PI * r;
  let offset = 0;
  let circles = '';
  Object.entries(totals).forEach(([act, val]) => {
    if (val <= 0) return;
    const frac = val / total;
    const dash = frac * circ;
    circles += `<circle r="${r}" cx="90" cy="90" fill="transparent" stroke="${ACTIVITY_COLORS[act]}" stroke-width="26" stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 90 90)"></circle>`;
    offset += dash;
  });
  const svg = `<svg viewBox="0 0 180 180" width="180" height="180">${circles}</svg>`;
  const legend = Object.entries(totals).map(([act, val]) => {
    const pct = total > 0 ? (val / total * 100).toFixed(1) : '0.0';
    return `<div class="legend-item"><span class="swatch" style="background:${ACTIVITY_COLORS[act]}"></span>${act}: ${val.toFixed(1)}h (${pct}%)</div>`;
  }).join('');
  activityPie.innerHTML = `<div class="pie-flex">${svg}<div class="legend">${legend}</div></div>`;
}

function renderWeeklyChart(rows) {
  const target = 8 * roster.length; // 8 hrs/kid/week
  const byWeek = {};
  rows.forEach(e => { byWeek[e.week] = (byWeek[e.week] || 0) + Number(e.duration); });
  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);

  if (!weeks.length) {
    weeklyChart.innerHTML = '<div class="empty">No data yet</div>';
    cumulativeChart.innerHTML = '';
    cumulativeBody.innerHTML = '';
    return;
  }

  // ---- weekly bar chart ----
  const maxVal = Math.max(target, ...weeks.map(w => byWeek[w]));
  const barW = 34, gap = 16, chartH = 150, topPad = 16, bottomPad = 20;
  const chartW = weeks.length * (barW + gap) + gap;
  const scale = v => (v / maxVal) * chartH;
  const targetY = topPad + chartH - scale(target);

  let bars = '';
  weeks.forEach((w, i) => {
    const val = byWeek[w];
    const h = scale(val);
    const x = gap + i * (barW + gap);
    const y = topPad + chartH - h;
    const color = val >= target ? 'var(--accent2)' : 'var(--accent)';
    bars += `
      <rect x="${x}" y="${y}" width="${barW}" height="${Math.max(h, 1)}" rx="4" fill="${color}"></rect>
      <text x="${x + barW / 2}" y="${topPad + chartH + 16}" text-anchor="middle" font-size="10" fill="var(--muted)">W${w}</text>
      <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="10" fill="var(--text)">${val.toFixed(1)}</text>`;
  });

  weeklyChart.innerHTML = `
    <svg viewBox="0 0 ${chartW} ${topPad + chartH + bottomPad}" style="width:100%;height:${topPad + chartH + bottomPad}px;">
      <line x1="0" y1="${targetY}" x2="${chartW}" y2="${targetY}" stroke="var(--warn)" stroke-width="1.5" stroke-dasharray="4 3"></line>
      <text x="4" y="${targetY - 4}" font-size="10" fill="var(--warn)">Target ${target}h</text>
      ${bars}
    </svg>`;

  // ---- cumulative actual vs target (one pass) ----
  let cumActual = 0, cumTarget = 0;
  const cumActualArr = [], cumTargetArr = [];
  weeks.forEach(w => {
    cumActual += byWeek[w];
    cumTarget += target;
    cumActualArr.push(cumActual);
    cumTargetArr.push(cumTarget);
  });

  const maxCum = Math.max(...cumActualArr, ...cumTargetArr, 1);
  const chartW2 = Math.max(320, weeks.length * 40);
  const chartH2 = 200, padL = 40, padR = 10, padT = 14, padB = 46;
  const plotW = chartW2 - padL - padR;
  const plotH = chartH2 - padT - padB;
  const xStep = weeks.length > 1 ? plotW / (weeks.length - 1) : 0;
  const xPos = i => padL + i * xStep;
  const yPos = v => padT + plotH - (v / maxCum) * plotH;

  const targetPoints = cumTargetArr.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
  const actualPoints = cumActualArr.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
  const targetDots = cumTargetArr.map((v, i) => `<circle cx="${xPos(i)}" cy="${yPos(v)}" r="3.5" fill="var(--accent)"></circle>`).join('');
  const actualDots = cumActualArr.map((v, i) => `<circle cx="${xPos(i)}" cy="${yPos(v)}" r="3.5" fill="var(--danger)"></circle>`).join('');
  const xLabels = weeks.map((w, i) =>
    `<text x="${xPos(i)}" y="${padT + plotH + 14}" font-size="9" fill="var(--muted)" text-anchor="end" transform="rotate(-40 ${xPos(i)} ${padT + plotH + 14})">W${w}</text>`
  ).join('');

  const ticks = 4;
  let gridLines = '';
  for (let t = 0; t <= ticks; t++) {
    const val = maxCum / ticks * t;
    const y = yPos(val);
    gridLines += `<line x1="${padL}" y1="${y}" x2="${padL + plotW}" y2="${y}" stroke="var(--border)" stroke-width="1"></line>
      <text x="${padL - 6}" y="${y + 3}" font-size="9" fill="var(--muted)" text-anchor="end">${Math.round(val)}</text>`;
  }

  cumulativeChart.innerHTML = `
    <div class="legend-row">
      <span class="legend-item"><span class="swatch" style="background:var(--accent)"></span>Cumulative Target</span>
      <span class="legend-item"><span class="swatch" style="background:var(--danger)"></span>Cumulative Actual</span>
    </div>
    <svg viewBox="0 0 ${chartW2} ${chartH2}" style="width:100%;height:${chartH2}px;">
      ${gridLines}
      <polyline points="${targetPoints}" fill="none" stroke="var(--accent)" stroke-width="2"></polyline>
      <polyline points="${actualPoints}" fill="none" stroke="var(--danger)" stroke-width="2"></polyline>
      ${targetDots}${actualDots}
      ${xLabels}
    </svg>`;

  // ---- table ----
  cumulativeBody.innerHTML = weeks.map((w, i) => {
    const val = byWeek[w];
    const diff = val - target;
    const cumDiff = cumActualArr[i] - cumTargetArr[i];
    const diffColor = diff >= 0 ? 'var(--accent2)' : 'var(--danger)';
    const cumColor = cumDiff >= 0 ? 'var(--accent2)' : 'var(--danger)';
    return `<tr>
      <td>Week ${w}</td>
      <td>${val.toFixed(1)}h</td>
      <td>${target}h</td>
      <td style="color:${diffColor}">${diff >= 0 ? '+' : ''}${diff.toFixed(1)}h</td>
      <td>${cumActualArr[i].toFixed(1)}h</td>
      <td>${cumTargetArr[i].toFixed(1)}h</td>
      <td style="color:${cumColor}">${cumDiff >= 0 ? '+' : ''}${cumDiff.toFixed(1)}h</td>
    </tr>`;
  }).join('');
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

// ---------- Single entry CRUD ----------
form.addEventListener('submit', (ev) => {
  ev.preventDefault();
  const entry = {
    name: fName.value.trim(),
    date: fDate.value,
    activity: fActivity.value,
    duration: parseFloat(fDuration.value),
    comments: fComments.value.trim(),
    week: parseInt(fWeek.value, 10)
  };
  if (!entry.name || isNaN(entry.duration) || isNaN(entry.week)) return;

  const savePromise = editingId
    ? db.collection('entries').doc(editingId).set(entry)
    : db.collection('entries').add(entry);

  savePromise
    .then(() => {
      toast(editingId ? 'Entry updated' : 'Entry added');
      resetForm();
    })
    .catch(err => toast('Error: ' + err.message));
});

function startEdit(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  document.querySelector('.tab[data-tab="single"]').click();
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
  db.collection('entries').doc(id).delete()
    .then(() => toast('Entry deleted'))
    .catch(err => toast('Error: ' + err.message));
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
  if (!confirm('Delete ALL entries for everyone? This cannot be undone.')) return;
  db.collection('entries').get().then(snapshot => {
    const batch = db.batch();
    snapshot.docs.forEach(d => batch.delete(d.ref));
    return batch.commit();
  })
    .then(() => toast('All entries cleared'))
    .catch(err => toast('Error: ' + err.message));
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
  ws['!cols'] = [{ wch: 14 }, { wch: 11 }, { wch: 14 }, { wch: 14 }, { wch: 30 }, { wch: 6 }];
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

window.startEdit = startEdit;
window.deleteEntry = deleteEntry;

// ---------- Init ----------
renderMatrix();
render();
