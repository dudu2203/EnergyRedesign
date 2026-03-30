/**
 * SYSTEMS MODULE - Step 3
 * Equipment systems: add, edit, delete, calculate, chart
 */

'use strict';

// ============================================================
// CATEGORY CONFIG
// ============================================================
const SYSTEM_CATEGORIES = {
  lighting:    { label: 'תאורה',              icon: 'fa-lightbulb',           bg: '#fff9c4', color: '#f57f17' },
  hvac:        { label: 'מיזוג אוויר',         icon: 'fa-wind',                bg: '#e3f2fd', color: '#1565c0' },
  chiller:     { label: "צ'ילר / מקרר",       icon: 'fa-snowflake',           bg: '#e0f7fa', color: '#00838f' },
  compressor:  { label: 'מדחס אוויר',          icon: 'fa-compress-arrows-alt', bg: '#fce4ec', color: '#c2185b' },
  pump:        { label: 'משאבה',              icon: 'fa-tint',                bg: '#e8f5e9', color: '#2e7d32' },
  motor:       { label: 'מנוע חשמלי',          icon: 'fa-circle-notch',        bg: '#ede7f6', color: '#6a1b9a' },
  production:  { label: 'קו ייצור',            icon: 'fa-industry',            bg: '#fff3e0', color: '#e65100' },
  other:       { label: 'אחר',                icon: 'fa-ellipsis-h',          bg: '#f5f5f5', color: '#616161' }
};

// Default electricity tariff (₪/kWh) — can be overridden
const DEFAULT_TARIFF = 0.55;

// Active chart instance
let systemsChartInstance = null;
let activeCategory = 'all';
let editingSystemId = null;

// ============================================================
// INIT SYSTEMS MODULE
// ============================================================
function initSystemsModule() {
  bindSystemModal();
  bindCategoryTabs();
  bindChartToggle();
  bindStep3Nav();
  renderSystemsList();
}

// ============================================================
// BIND STEP 3 NAV BUTTONS
// ============================================================
function bindStep3Nav() {
  document.getElementById('btn-add-system')?.addEventListener('click', () => openSystemModal(null));
  document.getElementById('btn-add-system-2')?.addEventListener('click', () => openSystemModal(null));
  document.getElementById('btn-to-step4')?.addEventListener('click', () => {
    goToStep(4);
  });
  document.getElementById('btn-to-step3-back')?.addEventListener('click', () => goToStep(3));
}

// ============================================================
// CATEGORY TABS
// ============================================================
function bindCategoryTabs() {
  document.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.cat;
      renderSystemsList();
    });
  });
}

// ============================================================
// RENDER SYSTEMS LIST
// ============================================================
function renderSystemsList() {
  const container = document.getElementById('systems-list');
  const emptyEl   = document.getElementById('systems-empty');
  const totalsEl  = document.getElementById('systems-totals');
  const chartEl   = document.getElementById('chart-section');
  const countEl   = document.getElementById('systems-count');
  if (!container) return;

  const systems = App.currentSurvey?.systems || [];
  const filtered = activeCategory === 'all'
    ? systems
    : systems.filter(s => s.category === activeCategory);

  // Update count badge
  if (countEl) countEl.textContent = systems.length + ' מערכות';

  if (systems.length === 0) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    if (totalsEl) totalsEl.style.display = 'none';
    if (chartEl) chartEl.style.display = 'none';
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (totalsEl) totalsEl.style.display = '';
  if (chartEl) chartEl.style.display = '';

  // Header row
  const header = `
    <div class="system-row-header">
      <div></div>
      <div>שם המערכת</div>
      <div style="text-align:center;">יחידות × kW</div>
      <div style="text-align:center;">שעות/יום</div>
      <div style="text-align:center;">ימים/שנה</div>
      <div style="text-align:center;">עומס</div>
      <div style="text-align:center;">kWh/שנה</div>
      <div></div>
    </div>`;

  const rows = filtered.map(s => {
    const cat = SYSTEM_CATEGORIES[s.category] || SYSTEM_CATEGORIES.other;
    const kwh = calcKwh(s);
    const cost = kwh * DEFAULT_TARIFF;
    return `
      <div class="system-row" data-sys-id="${s.id}">
        <div class="sys-icon" style="background:${cat.bg};color:${cat.color};">
          <i class="fas ${cat.icon}"></i>
        </div>
        <div class="sys-info">
          <div class="sys-name" title="${escHtml(s.name)}">${escHtml(s.name)}</div>
          <span class="sys-cat-badge"><i class="fas ${cat.icon}"></i> ${cat.label}</span>
        </div>
        <div class="sys-stat">
          <div class="sys-stat-val">${s.units} × ${s.power}</div>
          <div class="sys-stat-label">יחידות × kW</div>
        </div>
        <div class="sys-stat">
          <div class="sys-stat-val">${s.hours}</div>
          <div class="sys-stat-label">שעות/יום</div>
        </div>
        <div class="sys-stat">
          <div class="sys-stat-val">${s.days}</div>
          <div class="sys-stat-label">ימים/שנה</div>
        </div>
        <div class="sys-stat">
          <div class="sys-stat-val">${s.load}</div>
          <div class="sys-stat-label">מקדם עומס</div>
        </div>
        <div class="sys-stat">
          <div class="sys-stat-val" style="color:var(--secondary);">${fmtNum(Math.round(kwh))}</div>
          <div class="sys-stat-label">kWh/שנה</div>
        </div>
        <div class="sys-actions">
          <button class="btn btn-outline btn-sm" data-sys-edit="${s.id}" title="עריכה"><i class="fas fa-edit"></i></button>
          <button class="btn btn-danger btn-sm" data-sys-del="${s.id}" title="מחיקה"><i class="fas fa-trash"></i></button>
        </div>
      </div>`;
  }).join('');

  container.innerHTML = header + rows;

  // Bind actions
  container.querySelectorAll('[data-sys-edit]').forEach(btn => {
    btn.addEventListener('click', () => openSystemModal(btn.dataset.sysEdit));
  });
  container.querySelectorAll('[data-sys-del]').forEach(btn => {
    btn.addEventListener('click', () => deleteSystem(btn.dataset.sysDel));
  });

  renderTotals(systems);
  renderChart(systems);
}

// ============================================================
// CALCULATE kWh
// ============================================================
function calcKwh(s) {
  const units = parseFloat(s.units) || 0;
  const power = parseFloat(s.power) || 0;
  const hours = parseFloat(s.hours) || 0;
  const days  = parseFloat(s.days)  || 0;
  const load  = parseFloat(s.load)  || 1;
  return units * power * hours * days * load;
}

// ============================================================
// RENDER TOTALS BAR
// ============================================================
function renderTotals(systems) {
  const grid = document.getElementById('totals-grid');
  if (!grid) return;

  const totalKwh  = systems.reduce((acc, s) => acc + calcKwh(s), 0);
  const totalKw   = systems.reduce((acc, s) => acc + (parseFloat(s.units) || 0) * (parseFloat(s.power) || 0), 0);
  const totalCost = totalKwh * DEFAULT_TARIFF;

  // By category
  const byCat = {};
  systems.forEach(s => {
    if (!byCat[s.category]) byCat[s.category] = 0;
    byCat[s.category] += calcKwh(s);
  });
  const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  const topCatInfo = topCat ? SYSTEM_CATEGORIES[topCat[0]] : null;
  const topPct = totalKwh > 0 && topCat ? Math.round((topCat[1] / totalKwh) * 100) : 0;

  grid.innerHTML = `
    <div class="total-item">
      <div class="t-label">סה"כ מערכות</div>
      <div class="t-val">${systems.length}</div>
      <div class="t-unit">מערכות</div>
    </div>
    <div class="total-item">
      <div class="t-label">צריכה שנתית כוללת</div>
      <div class="t-val">${fmtNum(Math.round(totalKwh / 1000))}</div>
      <div class="t-unit">MWh/שנה</div>
    </div>
    <div class="total-item">
      <div class="t-label">עלות שנתית משוערת</div>
      <div class="t-val">₪${fmtNum(Math.round(totalCost / 1000))}K</div>
      <div class="t-unit">בשנה (תעריף ${DEFAULT_TARIFF} ₪/kWh)</div>
    </div>
    <div class="total-item">
      <div class="t-label">הספק מותקן כולל</div>
      <div class="t-val">${fmtNum(Math.round(totalKw))}</div>
      <div class="t-unit">kW</div>
    </div>
    ${topCatInfo ? `
    <div class="total-item">
      <div class="t-label">צורכן גדול ביותר</div>
      <div class="t-val" style="font-size:14px;">${topCatInfo.label}</div>
      <div class="t-unit">${topPct}% מהצריכה</div>
    </div>` : ''}
  `;
}

// ============================================================
// CHART
// ============================================================
function bindChartToggle() {
  document.getElementById('chart-pie-btn')?.addEventListener('click', () => {
    document.getElementById('chart-pie-btn')?.classList.add('active');
    document.getElementById('chart-bar-btn')?.classList.remove('active');
    updateChart('pie');
  });
  document.getElementById('chart-bar-btn')?.addEventListener('click', () => {
    document.getElementById('chart-bar-btn')?.classList.add('active');
    document.getElementById('chart-pie-btn')?.classList.remove('active');
    updateChart('bar');
  });
}

function renderChart(systems) {
  if (systems.length === 0) return;
  // Group by category
  const byCat = {};
  systems.forEach(s => {
    const kwh = calcKwh(s);
    if (!byCat[s.category]) byCat[s.category] = 0;
    byCat[s.category] += kwh;
  });
  const labels = Object.keys(byCat).map(k => SYSTEM_CATEGORIES[k]?.label || k);
  const data   = Object.values(byCat).map(v => Math.round(v));
  const colors = Object.keys(byCat).map(k => SYSTEM_CATEGORIES[k]?.color || '#999');

  const canvas = document.getElementById('systems-chart');
  if (!canvas) return;

  if (systemsChartInstance) {
    systemsChartInstance.destroy();
    systemsChartInstance = null;
  }

  const isPie = document.getElementById('chart-pie-btn')?.classList.contains('active');
  buildChart(canvas, isPie ? 'pie' : 'bar', labels, data, colors);
}

function updateChart(type) {
  const systems = App.currentSurvey?.systems || [];
  renderChart(systems);
  // Force rebuild with correct type
  const canvas = document.getElementById('systems-chart');
  if (!canvas || systems.length === 0) return;
  const byCat = {};
  systems.forEach(s => {
    if (!byCat[s.category]) byCat[s.category] = 0;
    byCat[s.category] += calcKwh(s);
  });
  const labels = Object.keys(byCat).map(k => SYSTEM_CATEGORIES[k]?.label || k);
  const data   = Object.values(byCat).map(v => Math.round(v));
  const colors = Object.keys(byCat).map(k => SYSTEM_CATEGORIES[k]?.color || '#999');
  if (systemsChartInstance) { systemsChartInstance.destroy(); systemsChartInstance = null; }
  buildChart(canvas, type, labels, data, colors);
}

function buildChart(canvas, type, labels, data, colors) {
  const total = data.reduce((a, b) => a + b, 0);
  systemsChartInstance = new Chart(canvas, {
    type: type,
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors.map(c => c + '33'),
        borderColor: colors,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: type === 'pie' ? 'right' : 'bottom', rtl: true, labels: { font: { family: 'Heebo', size: 13 }, padding: 16 } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const val = ctx.raw;
              const pct = total > 0 ? Math.round((val / total) * 100) : 0;
              return ` ${fmtNum(val)} kWh (${pct}%)`;
            }
          }
        }
      },
      scales: type === 'bar' ? {
        y: { beginAtZero: true, ticks: { callback: v => fmtNum(v) + ' kWh' } },
        x: { ticks: { font: { family: 'Heebo' } } }
      } : {}
    }
  });
}

// ============================================================
// SYSTEM MODAL - OPEN
// ============================================================
function openSystemModal(id) {
  editingSystemId = id;
  const modal = document.getElementById('system-modal');
  const title = document.getElementById('system-modal-title');
  if (!modal) return;

  // Clear errors
  ['sys-name-err', 'sys-cat-err', 'sys-units-err', 'sys-power-err', 'sys-hours-err', 'sys-days-err'].forEach(e => {
    const el = document.getElementById(e);
    if (el) el.textContent = '';
  });

  if (id) {
    // Editing existing
    const sys = (App.currentSurvey?.systems || []).find(s => s.id === id);
    if (!sys) return;
    if (title) title.textContent = 'עריכת מערכת';
    setVal('sys-name', sys.name);
    setVal('sys-category', sys.category);
    setVal('sys-units', sys.units);
    setVal('sys-power', sys.power);
    setVal('sys-hours', sys.hours);
    setVal('sys-days', sys.days);
    setVal('sys-load', sys.load);
    setVal('sys-age', sys.age || '');
    setVal('sys-notes', sys.notes || '');
  } else {
    // New system - set smart defaults from survey data
    if (title) title.textContent = 'הוספת מערכת חדשה';
    setVal('sys-name', '');
    setVal('sys-category', '');
    setVal('sys-units', '1');
    setVal('sys-power', '');
    setVal('sys-hours', App.currentSurvey?.working_days_per_week ? getDefaultHours() : '8');
    setVal('sys-days', getDefaultDays());
    setVal('sys-load', '1');
    setVal('sys-age', '');
    setVal('sys-notes', '');
  }

  updateCalcPreview();
  modal.style.display = 'flex';

  // Focus name
  setTimeout(() => document.getElementById('sys-name')?.focus(), 100);
}

function getDefaultHours() {
  const start = App.currentSurvey?.weekday_start || '08:00';
  const end   = App.currentSurvey?.weekday_end   || '17:00';
  try {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const diff = (eh * 60 + em - sh * 60 - sm) / 60;
    return diff > 0 ? diff.toString() : '8';
  } catch { return '8'; }
}

function getDefaultDays() {
  const daysPerWeek = parseInt(App.currentSurvey?.working_days_per_week) || 5;
  let weeks = 50;
  if (App.currentSurvey?.active_friday) weeks = Math.ceil(weeks);
  return (daysPerWeek * weeks).toString();
}

// ============================================================
// SYSTEM MODAL - BIND
// ============================================================
function bindSystemModal() {
  document.getElementById('system-modal-close')?.addEventListener('click', closeSystemModal);
  document.getElementById('system-modal-cancel')?.addEventListener('click', closeSystemModal);
  document.getElementById('system-modal-save')?.addEventListener('click', saveSystem);

  // Close on overlay click
  document.getElementById('system-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('system-modal')) closeSystemModal();
  });

  // Live calculation on input change
  ['sys-units', 'sys-power', 'sys-hours', 'sys-days', 'sys-load'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateCalcPreview);
  });

  // Auto-suggest default name on category change
  document.getElementById('sys-category')?.addEventListener('change', (e) => {
    const nameEl = document.getElementById('sys-name');
    if (nameEl && !nameEl.value && e.target.value) {
      const cat = SYSTEM_CATEGORIES[e.target.value];
      if (cat) nameEl.value = 'מערכת ' + cat.label;
    }
    updateCalcPreview();
  });
}

function closeSystemModal() {
  document.getElementById('system-modal').style.display = 'none';
  editingSystemId = null;
}

// ============================================================
// LIVE CALC PREVIEW
// ============================================================
function updateCalcPreview() {
  const units = parseFloat(document.getElementById('sys-units')?.value) || 0;
  const power = parseFloat(document.getElementById('sys-power')?.value) || 0;
  const hours = parseFloat(document.getElementById('sys-hours')?.value) || 0;
  const days  = parseFloat(document.getElementById('sys-days')?.value)  || 0;
  const load  = parseFloat(document.getElementById('sys-load')?.value)  || 1;

  const kwh  = units * power * hours * days * load;
  const kw   = units * power * load;
  const cost = kwh * DEFAULT_TARIFF;

  const kwhEl  = document.getElementById('calc-kwh');
  const costEl = document.getElementById('calc-cost');
  const kwEl   = document.getElementById('calc-kw');
  const frmEl  = document.getElementById('calc-formula');

  if (kwhEl) kwhEl.textContent = kwh > 0 ? fmtNum(Math.round(kwh)) : '—';
  if (costEl) costEl.textContent = cost > 0 ? '₪' + fmtNum(Math.round(cost)) : '—';
  if (kwEl) kwEl.textContent = kw > 0 ? fmtNum(Math.round(kw * 10) / 10) : '—';
  if (frmEl && kwh > 0) {
    frmEl.textContent = `${units} × ${power}kW × ${hours}h × ${days}d × ${load} = ${fmtNum(Math.round(kwh))} kWh`;
  } else if (frmEl) {
    frmEl.textContent = '';
  }
}

// ============================================================
// SAVE SYSTEM
// ============================================================
function saveSystem() {
  // Validate
  let ok = true;
  const name = document.getElementById('sys-name')?.value?.trim();
  const cat  = document.getElementById('sys-category')?.value;
  const units = parseFloat(document.getElementById('sys-units')?.value);
  const power = parseFloat(document.getElementById('sys-power')?.value);
  const hours = parseFloat(document.getElementById('sys-hours')?.value);
  const days  = parseFloat(document.getElementById('sys-days')?.value);

  const setErr = (id, msg) => { const e = document.getElementById(id); if (e) e.textContent = msg; };
  const clrErr = (id) => { const e = document.getElementById(id); if (e) e.textContent = ''; };

  if (!name) { setErr('sys-name-err', 'שם המערכת חובה'); ok = false; } else clrErr('sys-name-err');
  if (!cat)  { setErr('sys-cat-err', 'קטגוריה חובה'); ok = false; } else clrErr('sys-cat-err');
  if (!units || units < 1) { setErr('sys-units-err', 'נדרש מספר יחידות'); ok = false; } else clrErr('sys-units-err');
  if (!power || power <= 0) { setErr('sys-power-err', 'נדרש הספק'); ok = false; } else clrErr('sys-power-err');
  if (!hours || hours <= 0) { setErr('sys-hours-err', 'נדרשות שעות פעילות'); ok = false; } else clrErr('sys-hours-err');
  if (!days  || days  <= 0) { setErr('sys-days-err', 'נדרשים ימי פעילות'); ok = false; } else clrErr('sys-days-err');

  if (!ok) { toast('נא למלא את שדות החובה', 'error'); return; }

  const sysData = {
    id:       editingSystemId || 'sys-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    name,
    category: cat,
    units,
    power,
    hours,
    days,
    load:     parseFloat(document.getElementById('sys-load')?.value) || 1,
    age:      parseInt(document.getElementById('sys-age')?.value) || 0,
    notes:    document.getElementById('sys-notes')?.value?.trim() || '',
    kwh:      Math.round(units * power * hours * days * (parseFloat(document.getElementById('sys-load')?.value) || 1))
  };

  if (!App.currentSurvey) return;
  if (!App.currentSurvey.systems) App.currentSurvey.systems = [];

  if (editingSystemId) {
    const idx = App.currentSurvey.systems.findIndex(s => s.id === editingSystemId);
    if (idx > -1) App.currentSurvey.systems[idx] = sysData;
  } else {
    App.currentSurvey.systems.push(sysData);
  }

  closeSystemModal();
  renderSystemsList();
  scheduleAutosave();
  toast(editingSystemId ? 'המערכת עודכנה' : 'המערכת נוספה בהצלחה', 'success');
}

// ============================================================
// DELETE SYSTEM
// ============================================================
function deleteSystem(id) {
  const sys = (App.currentSurvey?.systems || []).find(s => s.id === id);
  if (!sys) return;
  showConfirm('מחיקת מערכת', `האם למחוק את המערכת "${sys.name}"?`, () => {
    if (!App.currentSurvey?.systems) return;
    App.currentSurvey.systems = App.currentSurvey.systems.filter(s => s.id !== id);
    renderSystemsList();
    scheduleAutosave();
    toast('המערכת נמחקה', 'success');
  });
}
