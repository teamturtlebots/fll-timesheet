// ---------- Firebase (shared cloud storage, no login) ----------
const DEFAULT_ROSTER = ['Evan', 'Mason', 'Ellen', 'Eric', 'Stanley', 'Anya', 'Aiden'];
const VOLUNTEER_ROSTER = ['Liang Xue', 'Sheng Yin', 'Bin Lu'];

// Change this to whatever you want — only people who know it can bulk-delete records.
const ADMIN_PASSCODE = 'ttb';

function requireAdminPasscode(actionLabel) {
  const entered = prompt(`Enter the admin passcode to ${actionLabel}:`);
  if (entered === null) return false; // cancelled
  if (entered !== ADMIN_PASSCODE) { toast('Incorrect passcode'); return false; }
  return true;
}
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

let volunteerEntries = [];
let vEditingId = null;
let vSortKey = 'date';
let vSortDir = 'desc';

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
const commitMatrixBtn = document.getElementById('commitMatrixBtn');
const clearMatrixBtn = document.getElementById('clearMatrixBtn');

// ---------- Elements: summary ----------
const memberBars = document.getElementById('memberBars');
const memberLegend = document.getElementById('memberLegend');
const activityPie = document.getElementById('activityPie');
const weeklyChart = document.getElementById('weeklyChart');
const cumulativeChart = document.getElementById('cumulativeChart');
const cumulativeBody = document.getElementById('cumulativeBody');
const summaryRangeButtons = document.getElementById('summaryRangeButtons');
const summaryCustomRange = document.getElementById('summaryCustomRange');
const summaryRangeStart = document.getElementById('summaryRangeStart');
const summaryRangeEnd = document.getElementById('summaryRangeEnd');
const summaryRangeLabel = document.getElementById('summaryRangeLabel');

// defaults
// ---------- Elements: volunteers ----------
const volunteerForm = document.getElementById('volunteerForm');
const vDate = document.getElementById('vDate');
const vVolunteer = document.getElementById('vVolunteer');
const vBegin = document.getElementById('vBegin');
const vEnd = document.getElementById('vEnd');
const vHours = document.getElementById('vHours');
const vDescription = document.getElementById('vDescription');
const vSubmitBtn = document.getElementById('vSubmitBtn');
const vCancelEditBtn = document.getElementById('vCancelEditBtn');
const volunteerEntriesBody = document.getElementById('volunteerEntriesBody');
const vEmptyMsg = document.getElementById('vEmptyMsg');
const vFilterVolunteer = document.getElementById('vFilterVolunteer');
const vFilterMonth = document.getElementById('vFilterMonth');
const volunteerMonthlyHead = document.getElementById('volunteerMonthlyHead');
const vFilteredTotal = document.getElementById('vFilteredTotal');
const volunteerMonthlyBody = document.getElementById('volunteerMonthlyBody');
const vMonthlyEmpty = document.getElementById('vMonthlyEmpty');
const volunteerMonthlyChart = document.getElementById('volunteerMonthlyChart');
const volunteerMonthlyLegend = document.getElementById('volunteerMonthlyLegend');
const vmDate = document.getElementById('vmDate');
const vmComments = document.getElementById('vmComments');
const volunteerMatrixBody = document.getElementById('volunteerMatrixBody');
const vCopyLastBtn = document.getElementById('vCopyLastBtn');
const vCommitMatrixBtn = document.getElementById('vCommitMatrixBtn');
const vClearMatrixBtn = document.getElementById('vClearMatrixBtn');

function localDateStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const todayStr = localDateStr();
fDate.value = todayStr;
mDate.value = todayStr;
vDate.value = todayStr;
vmDate.value = todayStr;

function refreshWeekDisplays() {
  fWeek.value = computeWeek(fDate.value);
  mWeek.value = computeWeek(mDate.value);
}
fDate.addEventListener('input', refreshWeekDisplays);
mDate.addEventListener('input', refreshWeekDisplays);
refreshWeekDisplays();

function computeHoursFromTimes(begin, end) {
  if (!begin || !end) return null;
  const [bh, bm] = begin.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startMinutes = bh * 60 + bm;
  let endMinutes = eh * 60 + em;
  if (endMinutes < startMinutes) endMinutes += 24 * 60; // crosses midnight
  return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
}
function refreshVHours() {
  const h = computeHoursFromTimes(vBegin.value, vEnd.value);
  vHours.value = h === null ? '' : h;
}
vBegin.addEventListener('input', refreshVHours);
vEnd.addEventListener('input', refreshVHours);

// ---------- Volunteer matrix entry ----------
function renderVolunteerMatrix() {
  volunteerMatrixBody.innerHTML = VOLUNTEER_ROSTER.map(name => `
    <tr data-volunteer="${escapeHtml(name)}">
      <td class="namecell">${escapeHtml(name)}</td>
      <td><input type="time" class="vm-begin"></td>
      <td><input type="time" class="vm-end"></td>
      <td><input type="text" class="vm-hours" readonly></td>
      <td><input type="text" class="vm-desc" placeholder="optional"></td>
    </tr>
  `).join('');

  volunteerMatrixBody.querySelectorAll('tr').forEach(tr => {
    const begin = tr.querySelector('.vm-begin');
    const end = tr.querySelector('.vm-end');
    const hoursField = tr.querySelector('.vm-hours');
    const updateRowHours = () => {
      const h = computeHoursFromTimes(begin.value, end.value);
      hoursField.value = h === null ? '' : h;
    };
    begin.addEventListener('input', updateRowHours);
    end.addEventListener('input', updateRowHours);
  });
}

vClearMatrixBtn.addEventListener('click', () => {
  volunteerMatrixBody.querySelectorAll('.vm-begin, .vm-end, .vm-desc, .vm-hours').forEach(inp => inp.value = '');
  vmComments.value = '';
});

vCopyLastBtn.addEventListener('click', () => {
  let copied = 0;
  volunteerMatrixBody.querySelectorAll('tr').forEach(tr => {
    const name = tr.dataset.volunteer;
    const matches = volunteerEntries.filter(e => e.volunteer === name);
    if (!matches.length) return;
    const last = matches.reduce((a, b) => (b.date > a.date ? b : a));
    tr.querySelector('.vm-begin').value = last.beginTime || '';
    tr.querySelector('.vm-end').value = last.endTime || '';
    tr.querySelector('.vm-desc').value = last.description || '';
    const h = computeHoursFromTimes(last.beginTime, last.endTime);
    tr.querySelector('.vm-hours').value = h === null ? '' : h;
    copied++;
  });
  toast(copied ? `Copied last entry for ${copied} volunteer${copied === 1 ? '' : 's'} — just update the date` : 'No previous entries to copy yet');
});

vCommitMatrixBtn.addEventListener('click', () => {
  const date = vmDate.value;
  const overallDesc = vmComments.value.trim();
  if (!date) { toast('Pick a date first'); return; }

  const newEntries = [];
  volunteerMatrixBody.querySelectorAll('tr').forEach(tr => {
    const name = tr.dataset.volunteer;
    const begin = tr.querySelector('.vm-begin').value;
    const end = tr.querySelector('.vm-end').value;
    if (!begin || !end) return;
    const hours = computeHoursFromTimes(begin, end);
    if (hours === null) return;
    const rowDesc = tr.querySelector('.vm-desc').value.trim();
    const description = rowDesc && overallDesc ? `${rowDesc} | ${overallDesc}` : (rowDesc || overallDesc);
    newEntries.push({ date, beginTime: begin, endTime: end, hours, volunteer: name, description });
  });

  if (!newEntries.length) { toast('No times entered'); return; }

  const batch = db.batch();
  newEntries.forEach(e => batch.set(db.collection('volunteerEntries').doc(), e));
  batch.commit()
    .then(() => {
      volunteerMatrixBody.querySelectorAll('.vm-begin, .vm-end, .vm-desc, .vm-hours').forEach(inp => inp.value = '');
      vmComments.value = '';
      toast(`Added ${newEntries.length} entr${newEntries.length === 1 ? 'y' : 'ies'}`);
    })
    .catch(err => toast('Error: ' + err.message));
});

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

db.collection('volunteerEntries').onSnapshot(snapshot => {
  volunteerEntries = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
  renderVolunteers();
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

// ---------- Tabs (Matrix / Single Entry sub-tabs, scoped per card) ----------
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const scope = tab.closest('.card') || document;
    scope.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    scope.querySelectorAll('.tabpanel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    scope.querySelector('#tab-' + tab.dataset.tab).classList.add('active');
  });
});

// ---------- Matrix ----------
function renderMatrix() {
  matrixBody.innerHTML = roster.map(name => `
    <tr data-name="${escapeHtml(name)}">
      <td class="namecell">${escapeHtml(name)}</td>
      ${ACTIVITIES.map(a => `<td><input type="number" class="hourcell" step="0.25" min="0" data-activity="${a}" placeholder="0"></td>`).join('')}
      <td><input type="text" class="commentcell" placeholder="optional"></td>
    </tr>
  `).join('');
}

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

// ---------- Summary date-range filter (Hours by Member / Hours by Activity only) ----------
let summaryRange = '7D';

function getSummaryFilteredRows() {
  if (summaryRange === 'lifetime') return entries;

  if (summaryRange === 'custom') {
    const start = summaryRangeStart.value;
    const end = summaryRangeEnd.value;
    if (!start && !end) return entries;
    return entries.filter(e => {
      if (start && e.date < start) return false;
      if (end && e.date > end) return false;
      return true;
    });
  }

  const days = summaryRange === '1D' ? 1 : summaryRange === '3D' ? 3 : 7;
  const end = localDateStr();
  const startDate = new Date(end + 'T00:00:00');
  startDate.setDate(startDate.getDate() - (days - 1));
  const start = localDateStr(startDate);
  return entries.filter(e => e.date >= start && e.date <= end);
}

function summaryRangeLabelText() {
  if (summaryRange === 'lifetime') return '(lifetime)';
  if (summaryRange === 'custom') {
    const start = summaryRangeStart.value;
    const end = summaryRangeEnd.value;
    if (!start && !end) return '(custom — pick dates)';
    return `(${start ? fmtDate(start) : '…'} – ${end ? fmtDate(end) : '…'})`;
  }
  return `(last ${summaryRange})`;
}

function renderSummaryFiltered() {
  const rows = getSummaryFilteredRows();
  summaryRangeLabel.textContent = summaryRangeLabelText();
  renderMemberBars(rows);
  renderActivityPie(rows);
}

summaryRangeButtons.querySelectorAll('.vmtab').forEach(btn => {
  btn.addEventListener('click', () => {
    summaryRangeButtons.querySelectorAll('.vmtab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    summaryRange = btn.dataset.range;
    summaryCustomRange.style.display = summaryRange === 'custom' ? 'grid' : 'none';
    renderSummaryFiltered();
  });
});
summaryRangeStart.addEventListener('input', renderSummaryFiltered);
summaryRangeEnd.addEventListener('input', renderSummaryFiltered);

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
  renderSummaryFiltered();
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
  fDate.value = localDateStr();
  submitBtn.textContent = 'Add Entry';
  cancelEditBtn.style.display = 'none';
}
cancelEditBtn.addEventListener('click', resetForm);

document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (!requireAdminPasscode("delete ALL kids' hour entries")) return;
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

// ---------- Volunteer time tracking ----------
const VOLUNTEER_SEED_DATA = [
  { date: '2025-02-07', beginTime: '19:00', endTime: '21:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-02-09', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-02-14', beginTime: '19:00', endTime: '21:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-02-15', beginTime: '08:00', endTime: '14:00', hours: 6.0, volunteer: 'Sheng Yin', description: 'FLL Competition' },
  { date: '2025-02-23', beginTime: '19:00', endTime: '21:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-02-28', beginTime: '19:00', endTime: '21:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-03-02', beginTime: '19:00', endTime: '21:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-03-09', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-03-16', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-03-23', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-03-28', beginTime: '19:00', endTime: '21:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-03-30', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-04-13', beginTime: '19:00', endTime: '21:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'Competition Prep class' },
  { date: '2025-04-19', beginTime: '07:00', endTime: '11:00', hours: 4.0, volunteer: 'Sheng Yin', description: 'World Festival Competiton' },
  { date: '2025-08-10', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-08-17', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-08-24', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-08-31', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-09-07', beginTime: '09:00', endTime: '14:00', hours: 5.0, volunteer: 'Sheng Yin', description: 'supervise market event' },
  { date: '2025-09-14', beginTime: '16:00', endTime: '18:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'supervise autism kids STEM event' },
  { date: '2025-09-28', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-10-05', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-10-19', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-10-24', beginTime: '19:00', endTime: '21:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-10-26', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-11-02', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-11-09', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-11-16', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-11-22', beginTime: '10:00', endTime: '14:00', hours: 4.0, volunteer: 'Sheng Yin', description: 'FLL scrimmage' },
  { date: '2025-11-30', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-12-07', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2025-12-12', beginTime: '18:00', endTime: '20:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'Competition Prep class' },
  { date: '2025-12-13', beginTime: '09:00', endTime: '01:00', hours: 4.0, volunteer: 'Sheng Yin', description: 'FLL Competition' },
  { date: '2025-12-28', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-01-11', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-01-23', beginTime: '18:00', endTime: '20:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'Competition Prep class' },
  { date: '2026-01-24', beginTime: '09:00', endTime: '13:00', hours: 4.0, volunteer: 'Sheng Yin', description: 'FLL Competition' },
  { date: '2026-02-07', beginTime: '08:30', endTime: '15:30', hours: 7.0, volunteer: 'Sheng Yin', description: 'FLL Competition' },
  { date: '2026-03-01', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-03-06', beginTime: '19:00', endTime: '21:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-03-08', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-03-22', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-03-29', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-04-13', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-04-18', beginTime: '19:00', endTime: '21:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-04-24', beginTime: '19:00', endTime: '21:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-04-26', beginTime: '10:00', endTime: '12:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-04-29', beginTime: '09:00', endTime: '11:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-04-30', beginTime: '09:00', endTime: '11:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-05-01', beginTime: '09:00', endTime: '11:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-05-02', beginTime: '09:00', endTime: '11:00', hours: 2.0, volunteer: 'Sheng Yin', description: 'FLL class' },
  { date: '2026-08-04', beginTime: '18:30', endTime: '20:30', hours: 2.0, volunteer: 'Liang Xue', description: 'FLL class, guide team build mission models' },
  { date: '2026-08-07', beginTime: '21:00', endTime: '22:00', hours: 1.0, volunteer: 'Liang Xue', description: 'Coach/Mentor Meeting' },
  { date: '2026-08-07', beginTime: '21:00', endTime: '22:00', hours: 1.0, volunteer: 'Sheng Yin', description: 'Coach/Mentor Meeting' }
];


function fmtTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}
function fmtHours(h) {
  return String(Math.round(Number(h) * 100) / 100);
}
function monthKey(dateStr) {
  return dateStr ? dateStr.slice(0, 7) : ''; // YYYY-MM
}
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-US', { month: 'short', year: 'numeric' });
}
function monthLabelShort(key) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString('en-US', { month: 'short' }) + " '" + String(y).slice(2);
}

volunteerForm.addEventListener('submit', ev => {
  ev.preventDefault();
  const hours = computeHoursFromTimes(vBegin.value, vEnd.value);
  const entry = {
    date: vDate.value,
    beginTime: vBegin.value,
    endTime: vEnd.value,
    hours,
    volunteer: vVolunteer.value.trim(),
    description: vDescription.value.trim()
  };
  if (!entry.date || !entry.volunteer || !entry.beginTime || !entry.endTime || hours === null) {
    toast('Fill in date, times, and name');
    return;
  }

  const savePromise = vEditingId
    ? db.collection('volunteerEntries').doc(vEditingId).set(entry)
    : db.collection('volunteerEntries').add(entry);

  savePromise
    .then(() => {
      toast(vEditingId ? 'Volunteer entry updated' : 'Volunteer entry added');
      resetVolunteerForm();
    })
    .catch(err => toast('Error: ' + err.message));
});

function startVolunteerEdit(id) {
  const e = volunteerEntries.find(x => x.id === id);
  if (!e) return;
  document.querySelector('#tab-vsingle').closest('.card').querySelector('.tab[data-tab="vsingle"]').click();
  vEditingId = id;
  vDate.value = e.date;
  vBegin.value = e.beginTime;
  vEnd.value = e.endTime;
  refreshVHours();
  vVolunteer.value = e.volunteer;
  vDescription.value = e.description || '';
  vSubmitBtn.textContent = 'Save Changes';
  vCancelEditBtn.style.display = 'inline-block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.startVolunteerEdit = startVolunteerEdit;

function deleteVolunteerEntry(id) {
  if (!confirm('Delete this volunteer entry?')) return;
  db.collection('volunteerEntries').doc(id).delete()
    .then(() => toast('Entry deleted'))
    .catch(err => toast('Error: ' + err.message));
}
window.deleteVolunteerEntry = deleteVolunteerEntry;

function resetVolunteerForm() {
  vEditingId = null;
  volunteerForm.reset();
  vDate.value = localDateStr();
  vHours.value = '';
  vSubmitBtn.textContent = 'Add Entry';
  vCancelEditBtn.style.display = 'none';
}
vCancelEditBtn.addEventListener('click', resetVolunteerForm);

document.getElementById('vClearAllBtn').addEventListener('click', () => {
  if (!requireAdminPasscode('delete ALL volunteer entries')) return;
  if (!confirm('Delete ALL volunteer entries for everyone? This cannot be undone.')) return;
  db.collection('volunteerEntries').get().then(snapshot => {
    const batch = db.batch();
    snapshot.docs.forEach(d => batch.delete(d.ref));
    return batch.commit();
  })
    .then(() => toast('All volunteer entries cleared'))
    .catch(err => toast('Error: ' + err.message));
});

document.getElementById('vImportBtn').addEventListener('click', () => {
  if (!confirm(`Import ${VOLUNTEER_SEED_DATA.length} historical records? Only do this once — running it again will create duplicates.`)) return;
  const batch = db.batch();
  VOLUNTEER_SEED_DATA.forEach(rec => batch.set(db.collection('volunteerEntries').doc(), rec));
  batch.set(db.collection('meta').doc('volunteerImportStatus'), { imported: true, importedAt: new Date().toISOString() });
  batch.commit()
    .then(() => toast(`Imported ${VOLUNTEER_SEED_DATA.length} records`))
    .catch(err => toast('Error: ' + err.message));
});

db.collection('meta').doc('volunteerImportStatus').onSnapshot(doc => {
  const done = doc.exists && doc.data().imported;
  document.getElementById('vImportRow').style.display = done ? 'none' : 'flex';
  document.getElementById('vImportHint').style.display = done ? 'none' : 'block';
});

function renderVolunteers() {
  const names = [...new Set(volunteerEntries.map(e => e.volunteer))].sort();

  const curVolFilter = vFilterVolunteer.value;
  vFilterVolunteer.innerHTML = '<option value="">All volunteers</option>' +
    names.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join('');
  vFilterVolunteer.value = curVolFilter;

  const months = [...new Set(volunteerEntries.map(e => monthKey(e.date)))].filter(Boolean).sort();
  const curMonthFilter = vFilterMonth.value;
  vFilterMonth.innerHTML = '<option value="">All months</option>' +
    months.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
  vFilterMonth.value = curMonthFilter;

  let rows = volunteerEntries.filter(e => {
    if (vFilterVolunteer.value && e.volunteer !== vFilterVolunteer.value) return false;
    if (vFilterMonth.value && monthKey(e.date) !== vFilterMonth.value) return false;
    return true;
  });

  rows.sort((a, b) => {
    let av = a[vSortKey], bv = b[vSortKey];
    if (vSortKey === 'hours') { av = Number(av); bv = Number(bv); }
    if (av < bv) return vSortDir === 'asc' ? -1 : 1;
    if (av > bv) return vSortDir === 'asc' ? 1 : -1;
    return 0;
  });

  volunteerEntriesBody.innerHTML = rows.map(e => `
    <tr>
      <td>${fmtDate(e.date)}</td>
      <td>${fmtTime(e.beginTime)}</td>
      <td>${fmtTime(e.endTime)}</td>
      <td>${fmtHours(e.hours)}</td>
      <td>${escapeHtml(e.volunteer)}</td>
      <td>${escapeHtml(e.description || '')}</td>
      <td>
        <div class="row-actions">
          <button class="btn btn-secondary btn-sm" onclick="startVolunteerEdit('${e.id}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteVolunteerEntry('${e.id}')">Del</button>
        </div>
      </td>
    </tr>
  `).join('');

  vEmptyMsg.style.display = rows.length === 0 ? 'block' : 'none';

  const filteredTotal = rows.reduce((s, e) => s + Number(e.hours), 0);
  const filterLabel = [
    vFilterVolunteer.value || 'All volunteers',
    vFilterMonth.value ? monthLabel(vFilterMonth.value) : 'All months'
  ].join(' · ');
  vFilteredTotal.textContent = rows.length
    ? `Total: ${fmtHours(filteredTotal)} hours (${filterLabel})`
    : 'Total: 0 hours';

  renderVolunteerMonthly(volunteerEntries);
}

const VOLUNTEER_COLORS = { 'Liang Xue': '#4f8ef7', 'Sheng Yin': '#3ddc97', 'Bin Lu': '#f5b93d' };
let volunteerMonthlyView = 'chart';

document.querySelectorAll('.vmtab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.vmtab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    volunteerMonthlyView = tab.dataset.vmview;
    document.getElementById('volunteerMonthlyChartWrap').style.display = volunteerMonthlyView === 'chart' ? 'block' : 'none';
    document.getElementById('volunteerMonthlyTableWrap').style.display = volunteerMonthlyView === 'table' ? 'block' : 'none';
    renderVolunteerMonthly(volunteerEntries);
  });
});

function renderVolunteerMonthly(rows) {
  const months = [...new Set(rows.map(e => monthKey(e.date)))].filter(Boolean).sort();
  const volunteers = [...new Set(rows.map(e => e.volunteer))].sort();

  if (!months.length || !volunteers.length) {
    volunteerMonthlyHead.innerHTML = '';
    volunteerMonthlyBody.innerHTML = '';
    volunteerMonthlyChart.innerHTML = '';
    volunteerMonthlyLegend.innerHTML = '';
    vMonthlyEmpty.style.display = 'block';
    return;
  }
  vMonthlyEmpty.style.display = 'none';

  const totals = {};
  volunteers.forEach(v => { totals[v] = { total: 0 }; months.forEach(m => totals[v][m] = 0); });
  rows.forEach(e => {
    const mk = monthKey(e.date);
    if (!mk || !totals[e.volunteer]) return;
    totals[e.volunteer][mk] = (totals[e.volunteer][mk] || 0) + Number(e.hours);
    totals[e.volunteer].total += Number(e.hours);
  });

  if (volunteerMonthlyView === 'chart') {
    renderVolunteerMonthlyChart(months, volunteers, totals);
  } else {
    renderVolunteerMonthlyTable(months, volunteers, totals);
  }
}

function renderVolunteerMonthlyChart(months, volunteers, totals) {
  volunteerMonthlyLegend.innerHTML = volunteers.map(v =>
    `<span class="legend-item"><span class="swatch" style="background:${VOLUNTEER_COLORS[v] || 'var(--accent)'}"></span>${escapeHtml(v)}</span>`
  ).join('');

  const monthTotals = {};
  months.forEach(m => {
    monthTotals[m] = volunteers.reduce((s, v) => s + totals[v][m], 0);
  });
  const maxVal = Math.max(...Object.values(monthTotals), 1);

  const barW = 40, gap = 18, chartH = 160, topPad = 16, bottomPad = 22;
  const chartW = months.length * (barW + gap) + gap;
  const scale = v => (v / maxVal) * chartH;

  let bars = '';
  months.forEach((m, i) => {
    const x = gap + i * (barW + gap);
    let yCursor = topPad + chartH;
    let segs = '';
    volunteers.forEach(v => {
      const val = totals[v][m];
      if (val <= 0) return;
      const h = scale(val);
      yCursor -= h;
      segs += `<rect x="${x}" y="${yCursor}" width="${barW}" height="${h}" fill="${VOLUNTEER_COLORS[v] || 'var(--accent)'}"></rect>`;
    });
    const total = monthTotals[m];
    bars += segs + `
      <text x="${x + barW / 2}" y="${topPad + chartH + 16}" text-anchor="middle" font-size="10" fill="var(--muted)">${monthLabelShort(m)}</text>
      <text x="${x + barW / 2}" y="${topPad + chartH - scale(total) - 4}" text-anchor="middle" font-size="10" fill="var(--text)">${fmtHours(total)}</text>`;
  });

  volunteerMonthlyChart.innerHTML = `
    <svg viewBox="0 0 ${chartW} ${topPad + chartH + bottomPad}" style="width:100%;height:${topPad + chartH + bottomPad}px;">
      ${bars}
    </svg>`;
}

function renderVolunteerMonthlyTable(months, volunteers, totals) {
  volunteerMonthlyHead.innerHTML = `<tr><th>Volunteer</th>${months.map(m => `<th>${monthLabel(m)}</th>`).join('')}<th>Total</th></tr>`;

  const monthTotals = {};
  months.forEach(m => monthTotals[m] = 0);
  let grandTotal = 0;

  const bodyRows = volunteers.map(v => {
    const cells = months.map(m => {
      const h = totals[v][m];
      monthTotals[m] += h;
      return `<td>${h > 0 ? fmtHours(h) : '—'}</td>`;
    }).join('');
    grandTotal += totals[v].total;
    return `<tr><td>${escapeHtml(v)}</td>${cells}<td><b>${fmtHours(totals[v].total)}</b></td></tr>`;
  }).join('');

  const totalRow = `<tr style="font-weight:700;border-top:2px solid var(--border);">
    <td>Total</td>${months.map(m => `<td>${fmtHours(monthTotals[m])}</td>`).join('')}<td>${fmtHours(grandTotal)}</td>
  </tr>`;

  volunteerMonthlyBody.innerHTML = bodyRows + totalRow;
}

[vFilterVolunteer, vFilterMonth].forEach(el => el.addEventListener('input', renderVolunteers));

document.querySelectorAll('th[data-vsort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.vsort;
    if (vSortKey === key) vSortDir = vSortDir === 'asc' ? 'desc' : 'asc';
    else { vSortKey = key; vSortDir = 'asc'; }
    renderVolunteers();
  });
});

function getVolunteerExportRows() {
  const rows = [...volunteerEntries].sort((a, b) => a.date.localeCompare(b.date));
  return rows.map(e => ({
    Date: fmtDate(e.date),
    'Begin Time': fmtTime(e.beginTime),
    'End Time': fmtTime(e.endTime),
    Hours: Number(e.hours),
    Volunteer: e.volunteer,
    Description: e.description || ''
  }));
}

document.getElementById('vExportXlsxBtn').addEventListener('click', () => {
  if (typeof XLSX === 'undefined') { toast('Export library not loaded — check connection'); return; }
  const rows = getVolunteerExportRows();
  if (!rows.length) { toast('Nothing to export'); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [{ wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 8 }, { wch: 16 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Volunteer Hours');
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `volunteer-hours-${stamp}.xlsx`);
  toast('Exported .xlsx');
});

document.getElementById('vExportCsvBtn').addEventListener('click', () => {
  const rows = getVolunteerExportRows();
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
  a.download = `volunteer-hours-${stamp}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Exported .csv');
});

// ---------- Service worker ----------
// Beyond just registering, this actively checks for a newer sw.js/app version
// (on load, whenever the app is brought to the foreground, and periodically
// while left open) and reloads automatically once a new version takes over —
// important for the iPhone home-screen install, which is its own separate
// cache from the browser and won't otherwise notice updates on its own.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then(reg => {
      const checkForUpdate = () => reg.update().catch(() => {});
      checkForUpdate();
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkForUpdate();
      });
      setInterval(checkForUpdate, 30 * 60 * 1000); // every 30 min while app stays open
    }).catch(err => console.warn('SW registration failed', err));

    let reloadedForUpdate = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadedForUpdate) return;
      reloadedForUpdate = true;
      window.location.reload();
    });
  });
}

window.startEdit = startEdit;
window.deleteEntry = deleteEntry;

// ---------- Init ----------
renderMatrix();
render();
renderVolunteerMatrix();
renderVolunteers();
