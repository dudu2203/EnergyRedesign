/**
 * ENERGY SURVEYS SYSTEM - MAIN APP v1.1
 * Fully rewired for stability
 */

'use strict';

// ============================================================
// APP STATE
// ============================================================
const App = {
  currentUser: null,
  surveys: [],
  currentSurvey: null,
  editingId: null,
  currentStep: 1,
  autosaveTimer: null,
  debounceTimer: null,
  isOnline: navigator.onLine,
  transformerRows: [],
  energySources: {}
};

// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  initOnlineStatus();
  bindLoginForm();
  bindLogout();
  bindSidebarToggle();
  bindSurveyListButtons();
  bindFormButtons();
  bindSectionToggles();
  buildEnergyCards();
  bindTransformers();
  initSystemsModule();   // Step 3 systems module
  checkSession();
});

// ============================================================
// SESSION CHECK
// ============================================================
function checkSession() {
  const saved = lsGetCurrentUser();
  if (saved) {
    const user = USERS.find(u => u.id === saved.id);
    if (user) {
      App.currentUser = user;
      doEnterApp();
      return;
    }
  }
  showLoginScreen();
}

// ============================================================
// SCREEN MANAGEMENT
// ============================================================
function showLoginScreen() {
  document.getElementById('screen-login').style.display = 'flex';
  document.getElementById('screen-main').style.display = 'none';
}

function showMainScreen() {
  document.getElementById('screen-login').style.display = 'none';
  document.getElementById('screen-main').style.display = 'block';
}

// ============================================================
// VIEW MANAGEMENT
// ============================================================
const VIEWS = ['surveys', 'survey-form', 'survey-detail', 'admin-users'];

function showView(name) {
  VIEWS.forEach(v => {
    const el = document.getElementById('view-' + v);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById('view-' + name);
  if (target) target.style.display = 'block';
}

// ============================================================
// LOGIN
// ============================================================
function bindLoginForm() {
  const form = document.getElementById('login-form');
  if (!form) return;

  // Toggle password visibility
  document.getElementById('toggle-pwd')?.addEventListener('click', () => {
    const pwd = document.getElementById('login-password');
    const icon = document.querySelector('#toggle-pwd i');
    if (pwd.type === 'password') {
      pwd.type = 'text';
      icon.className = 'fas fa-eye-slash';
    } else {
      pwd.type = 'password';
      icon.className = 'fas fa-eye';
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = (document.getElementById('login-username')?.value || '').trim();
    const password = document.getElementById('login-password')?.value || '';
    const errorEl = document.getElementById('login-error');

    const user = USERS.find(u => u.username === username && u.password === password);
    if (!user) {
      errorEl.textContent = 'שם משתמש או סיסמה שגויים';
      errorEl.style.display = 'block';
      return;
    }
    errorEl.style.display = 'none';
    App.currentUser = user;
    lsSaveCurrentUser({ id: user.id });
    doEnterApp();
  });
}

function doEnterApp() {
  showMainScreen();
  applyUserUI();
  loadSurveys();
  navigateTo('surveys');
}

function applyUserUI() {
  const u = App.currentUser;
  if (!u) return;
  setText('user-avatar-sidebar', u.avatar);
  setText('user-name-sidebar', u.name);
  setText('user-role-sidebar', u.role === 'admin' ? 'מנהל מערכת' : 'סוקר');
  setText('user-avatar-top', u.avatar);
  setText('user-name-top', u.name);
  // Admin-only elements
  const adminNav = document.getElementById('admin-nav');
  if (adminNav) adminNav.style.display = u.role === 'admin' ? 'block' : 'none';
  const fSurveyorWrap = document.getElementById('filter-surveyor-wrap');
  if (fSurveyorWrap) fSurveyorWrap.style.display = u.role === 'admin' ? 'flex' : 'none';
}

// ============================================================
// LOGOUT
// ============================================================
function bindLogout() {
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    showConfirm('יציאה מהמערכת', 'האם אתה בטוח שברצונך להתנתק?', () => {
      lsClearCurrentUser();
      App.currentUser = null;
      App.surveys = [];
      App.currentSurvey = null;
      clearInterval(App.autosaveTimer);
      document.getElementById('login-form')?.reset();
      document.getElementById('login-error').style.display = 'none';
      showLoginScreen();
    });
  });
}

// ============================================================
// SIDEBAR TOGGLE (mobile)
// ============================================================
function bindSidebarToggle() {
  document.getElementById('sidebar-open')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.add('open');
  });
  document.getElementById('sidebar-close')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
  });

  // Nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      if (!view) return;
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.getElementById('sidebar')?.classList.remove('open');
      if (view === 'new-survey') {
        openNewSurvey();
      } else if (view === 'surveys') {
        navigateTo('surveys');
      } else if (view === 'admin-users') {
        openAdminUsers();
      }
    });
  });
}

// ============================================================
// NAVIGATION
// ============================================================
function navigateTo(view, title) {
  const titles = {
    surveys: 'רשימת סקרים',
    'survey-form': 'סקר חדש',
    'survey-detail': 'פרטי סקר',
    'admin-users': 'ניהול משתמשים'
  };
  setTopbarTitle(title || titles[view] || '');
  showView(view);

  // Set active nav
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.view === view || (view === 'survey-form' && n.dataset.view === 'new-survey'));
  });
}

function setTopbarTitle(t) {
  const el = document.getElementById('topbar-title');
  if (el) el.textContent = t;
}

// ============================================================
// LOAD SURVEYS FROM API + LOCAL
// ============================================================
async function loadSurveys() {
  const local = lsGetSurveys();
  try {
    const res = await fetch('tables/energy_surveys?limit=200');
    if (res.ok) {
      const data = await res.json();
      const serverRows = (data.data || []).map(s => ({
        ...s,
        sync_status: 'synced',
        energy_sources: parseField(s.energy_sources, []),
        transformers: parseField(s.transformers, [])
      }));
      const pendingLocal = local.filter(l => l.sync_status !== 'synced');
      App.surveys = mergeSurveys(pendingLocal, serverRows);
    } else {
      App.surveys = local;
    }
  } catch {
    App.surveys = local;
  }
  lsSaveSurveys(App.surveys);
  renderSurveyList();
  populateSurveyorFilter();
}

function mergeSurveys(local, server) {
  const map = {};
  server.forEach(s => { map[s.id] = s; });
  local.forEach(s => { map[s.id] = s; }); // local overwrites if pending
  return Object.values(map);
}

function parseField(val, fallback) {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return fallback; } }
  return fallback;
}

// ============================================================
// SURVEYS LIST
// ============================================================
function bindSurveyListButtons() {
  document.getElementById('btn-new-survey')?.addEventListener('click', openNewSurvey);
  document.getElementById('btn-new-survey-2')?.addEventListener('click', openNewSurvey);
  document.getElementById('search-surveys')?.addEventListener('input', renderSurveyList);
  document.getElementById('filter-date-from')?.addEventListener('change', renderSurveyList);
  document.getElementById('filter-date-to')?.addEventListener('change', renderSurveyList);
  document.getElementById('filter-status')?.addEventListener('change', renderSurveyList);
  document.getElementById('filter-surveyor')?.addEventListener('change', renderSurveyList);
  document.getElementById('btn-clear-filters')?.addEventListener('click', clearFilters);
}

function clearFilters() {
  setVal('search-surveys', '');
  setVal('filter-date-from', '');
  setVal('filter-date-to', '');
  setVal('filter-status', '');
  setVal('filter-surveyor', '');
  renderSurveyList();
}

function populateSurveyorFilter() {
  const select = document.getElementById('filter-surveyor');
  if (!select) return;
  const names = [...new Set(App.surveys.map(s => s.surveyor_name || s.created_by).filter(Boolean))];
  select.innerHTML = '<option value="">הכל</option>' + names.map(n =>
    `<option value="${escHtml(n)}">${escHtml(n)}</option>`).join('');
}

function getFilteredSurveys() {
  const search = (getVal('search-surveys')).toLowerCase();
  const dateFrom = getVal('filter-date-from');
  const dateTo = getVal('filter-date-to');
  const status = getVal('filter-status');
  const surveyor = getVal('filter-surveyor');
  const isAdmin = App.currentUser?.role === 'admin';
  const uid = App.currentUser?.id;
  const uname = App.currentUser?.username;

  return App.surveys.filter(s => {
    if (!isAdmin && s.created_by !== uid && s.created_by !== uname) return false;
    if (search && !(s.site_name || '').toLowerCase().includes(search)) return false;
    if (dateFrom && s.survey_date < dateFrom) return false;
    if (dateTo && s.survey_date > dateTo) return false;
    if (status && s.status !== status) return false;
    if (surveyor && s.surveyor_name !== surveyor && s.created_by !== surveyor) return false;
    return true;
  });
}

function renderSurveyList() {
  const container = document.getElementById('surveys-container');
  const emptyEl = document.getElementById('surveys-empty');
  if (!container) return;

  renderStatsBar();

  const filtered = getFilteredSurveys();
  if (filtered.length === 0) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';
  container.innerHTML = filtered.map(renderSurveyCard).join('');

  // Card click → detail
  container.querySelectorAll('.survey-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('[data-action]')) return;
      openSurveyDetail(card.dataset.id);
    });
  });
  container.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openEditSurvey(btn.dataset.id); });
  });
  container.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteSurvey(btn.dataset.id); });
  });
}

function renderStatsBar() {
  const el = document.getElementById('surveys-stats');
  if (!el) return;
  const isAdmin = App.currentUser?.role === 'admin';
  const uid = App.currentUser?.id;
  const uname = App.currentUser?.username;
  const mine = App.surveys.filter(s => isAdmin || s.created_by === uid || s.created_by === uname);
  const counts = { draft: 0, ready: 0, submitted: 0 };
  mine.forEach(s => { if (counts[s.status] !== undefined) counts[s.status]++; });
  el.innerHTML = `
    <div class="stat-chip total"><i class="fas fa-list"></i> סה"כ: ${mine.length}</div>
    <div class="stat-chip draft"><i class="fas fa-edit"></i> טיוטות: ${counts.draft}</div>
    <div class="stat-chip ready"><i class="fas fa-check-circle"></i> מוכן: ${counts.ready}</div>
    <div class="stat-chip submitted"><i class="fas fa-paper-plane"></i> הוגש: ${counts.submitted}</div>
  `;
}

function renderSurveyCard(s) {
  const energySources = parseField(s.energy_sources, []);
  const active = energySources.filter(e => e.exists).slice(0, 3);
  const chips = active.map(e => {
    const t = ENERGY_TYPES.find(x => x.key === e.type);
    return `<span class="energy-chip"><i class="fas ${t?.icon || 'fa-bolt'}"></i> ${(t?.label || e.type).split(' ')[0]}</span>`;
  }).join('');

  const isAdmin = App.currentUser?.role === 'admin';
  const canEdit = isAdmin || s.created_by === App.currentUser?.id || s.created_by === App.currentUser?.username;

  return `
    <div class="survey-card" data-id="${s.id}">
      <div class="card-top">
        <div class="card-icon ${s.site_type || 'industry'}">
          <i class="fas ${s.site_type === 'office' ? 'fa-building' : 'fa-industry'}"></i>
        </div>
        <span class="card-status ${s.status || 'draft'}">${STATUS_LABELS[s.status] || 'טיוטה'}</span>
      </div>
      <div class="card-name">${escHtml(s.site_name || '—')}</div>
      <div class="card-meta">
        <span><i class="fas fa-map-marker-alt"></i> ${escHtml(s.city || '—')}</span>
        <span><i class="fas fa-tag"></i> ${SITE_TYPE_LABELS[s.site_type] || '—'}</span>
        <span><i class="fas fa-users"></i> ${fmtNum(s.employees_count)}</span>
      </div>
      ${chips ? `<div class="card-energy-summary">${chips}</div>` : ''}
      <div class="card-footer">
        <span class="card-date"><i class="fas fa-calendar-alt"></i> ${fmtDate(s.survey_date)}</span>
        <div class="card-actions">
          ${canEdit ? `<button class="btn btn-outline btn-sm" data-action="edit" data-id="${s.id}"><i class="fas fa-edit"></i></button>` : ''}
          ${isAdmin ? `<button class="btn btn-danger btn-sm" data-action="delete" data-id="${s.id}"><i class="fas fa-trash"></i></button>` : ''}
        </div>
      </div>
    </div>`;
}

// ============================================================
// OPEN / EDIT SURVEY
// ============================================================
function openNewSurvey() {
  App.editingId = null;
  App.currentSurvey = createEmptySurvey();
  App.transformerRows = [];
  initEnergySources();
  populateFormFields(App.currentSurvey);
  renderTransformerRows();
  updateEnergyCardsUI();
  goToStep(1);
  navigateTo('survey-form', 'סקר חדש');
  setText('form-title', 'סקר חדש');
  updateCompletion();
  startAutosave();
  window.scrollTo(0, 0);
  if (typeof renderSystemsList === 'function') renderSystemsList();
}

function openEditSurvey(id) {
  const s = App.surveys.find(x => x.id === id);
  if (!s) { toast('הסקר לא נמצא', 'error'); return; }
  App.editingId = id;
  App.currentSurvey = deepClone(s);
  // Parse JSON fields
  App.currentSurvey.systems = parseField(s.systems, []);
  App.currentSurvey.energy_sources = parseField(s.energy_sources, []);
  App.currentSurvey.transformers = parseField(s.transformers, []);
  App.transformerRows = deepClone(App.currentSurvey.transformers);
  App.energySources = {};
  initEnergySources();
  App.currentSurvey.energy_sources.forEach(e => {
    if (e.type) App.energySources[e.type] = { ...e };
  });
  populateFormFields(App.currentSurvey);
  renderTransformerRows();
  updateEnergyCardsUI();
  goToStep(1);
  navigateTo('survey-form', 'עריכת סקר');
  setText('form-title', 'עריכת סקר: ' + (s.site_name || ''));
  updateCompletion();
  startAutosave();
  window.scrollTo(0, 0);
}

function openSurveyDetail(id) {
  App.editingId = id;
  const s = App.surveys.find(x => x.id === id);
  if (!s) return;
  renderDetailView(s);
  navigateTo('survey-detail', 'פרטי סקר: ' + (s.site_name || ''));
}

function createEmptySurvey() {
  const today = new Date().toISOString().split('T')[0];
  return {
    id: genId(), status: 'draft', sync_status: 'local',
    created_by: App.currentUser?.id || App.currentUser?.username || '',
    surveyor_name: App.currentUser?.name || '',
    survey_date: today, site_name: '', site_type: '', address_full: '',
    city: '', location_link: '', employees_count: '', building_area_m2: '',
    conditioned_area_m2: '', weekday_start: '08:00', weekday_end: '17:00',
    working_days_per_week: '5', active_friday: false, active_saturday: false,
    active_holidays: false, site_activity_description: '', production_description: '',
    energy_manager_name: '', energy_manager_phone: '',
    maintenance_manager_name: '', maintenance_manager_phone: '',
    finance_contact_name: '', finance_contact_phone: '',
    electricity_supplier: '', voltage_level: '',
    transformers_count: 0, has_on_site_generation: false,
    energy_sources: [], transformers: [], systems: []
  };
}

function initEnergySources() {
  ENERGY_TYPES.forEach(t => {
    if (!App.energySources[t.key]) {
      App.energySources[t.key] = { type: t.key, exists: false, quantity: '', unit: t.defaultUnit, cost: '', source: '', notes: '' };
    }
  });
}

// ============================================================
// FORM POPULATION
// ============================================================
function populateFormFields(s) {
  setVal('f-survey-date', s.survey_date);
  setVal('f-site-type', s.site_type);
  setVal('f-site-name', s.site_name);
  setVal('f-address', s.address_full);
  setVal('f-city', s.city);
  setVal('f-location-link', s.location_link);
  setVal('f-employees', s.employees_count);
  setVal('f-building-area', s.building_area_m2);
  setVal('f-conditioned-area', s.conditioned_area_m2);
  setVal('f-working-days', s.working_days_per_week);
  setVal('f-start-time', s.weekday_start);
  setVal('f-end-time', s.weekday_end);
  setChecked('f-friday', s.active_friday);
  setChecked('f-saturday', s.active_saturday);
  setChecked('f-holidays', s.active_holidays);
  setVal('f-activity-desc', s.site_activity_description);
  setVal('f-production-desc', s.production_description);
  setVal('f-em-name', s.energy_manager_name);
  setVal('f-em-phone', s.energy_manager_phone);
  setVal('f-mm-name', s.maintenance_manager_name);
  setVal('f-mm-phone', s.maintenance_manager_phone);
  setVal('f-fc-name', s.finance_contact_name);
  setVal('f-fc-phone', s.finance_contact_phone);
  setVal('f-elec-supplier', s.electricity_supplier);
  setVal('f-transformers-count', s.transformers_count);
  setChecked('f-generation', s.has_on_site_generation);
  // Voltage radio
  document.querySelectorAll('input[name="voltage_level"]').forEach(r => {
    r.checked = r.value === s.voltage_level;
  });
  // Conditional fields
  toggleProductionWrap(s.site_type);
  toggleTransformersSection(s.transformers_count);
}

// ============================================================
// SECTION TOGGLES
// ============================================================
function bindSectionToggles() {
  document.querySelectorAll('.card-section-header[data-toggle], .section-header[data-toggle]').forEach(header => {
    const bodyId = header.dataset.toggle;
    const body = document.getElementById(bodyId);
    if (!body) return;
    header.classList.add('open');

    header.addEventListener('click', () => {
      const open = header.classList.contains('open');
      if (open) {
        header.classList.remove('open');
        body.style.display = 'none';
      } else {
        header.classList.add('open');
        body.style.display = '';
      }
    });
  });
}

// ============================================================
// FORM BUTTONS BINDING
// ============================================================
function bindFormButtons() {
  // Back to list
  document.getElementById('btn-back-to-list')?.addEventListener('click', () => {
    clearInterval(App.autosaveTimer);
    App.currentSurvey = null;
    App.editingId = null;
    navigateTo('surveys');
  });

  // Step navigation
  document.getElementById('btn-to-step2')?.addEventListener('click', () => {
    if (validateStep1()) goToStep(2);
  });
  document.getElementById('btn-to-step1')?.addEventListener('click', () => goToStep(1));
  document.getElementById('btn-to-step3')?.addEventListener('click', () => {
    if (validateStep2()) goToStep(3);
  });
  document.getElementById('btn-to-step2-back')?.addEventListener('click', () => goToStep(2));

  // Save draft
  document.getElementById('btn-save-draft')?.addEventListener('click', () => {
    saveDraft();
    toast('הסקר נשמר כטיוטה', 'success');
  });
  document.getElementById('btn-save-draft-final')?.addEventListener('click', () => {
    saveDraft();
    toast('הסקר נשמר כטיוטה', 'success');
  });

  // Submit
  document.getElementById('btn-submit-survey')?.addEventListener('click', () => {
    if (!validateStep1()) return;
    if (!validateStep2()) { goToStep(2); return; }
    goToStep(3);
  });
  document.getElementById('btn-submit-final')?.addEventListener('click', submitSurvey);

  // Detail back
  document.getElementById('btn-back-from-detail')?.addEventListener('click', () => {
    navigateTo('surveys');
  });
  document.getElementById('btn-edit-survey')?.addEventListener('click', () => {
    if (App.editingId) openEditSurvey(App.editingId);
  });

  // Field watchers for completion
  bindFieldWatchers();
}

function bindFieldWatchers() {
  document.getElementById('f-site-type')?.addEventListener('change', e => {
    toggleProductionWrap(e.target.value);
    scheduleAutosave();
    updateCompletion();
  });
  document.getElementById('f-transformers-count')?.addEventListener('input', e => {
    const n = parseInt(e.target.value) || 0;
    toggleTransformersSection(n);
    syncTransformerCount(n);
    scheduleAutosave();
  });
  document.getElementById('f-generation')?.addEventListener('change', e => {
    if (e.target.checked) {
      const toggle = document.querySelector('[data-energy-key="electricity_generation"] .toggle-switch input');
      if (toggle && !toggle.checked) {
        toggle.checked = true;
        onEnergyToggle('electricity_generation', true);
      }
    }
    scheduleAutosave();
  });

  // Generic autosave on all form inputs
  ['site-form'].forEach(fid => {
    const f = document.getElementById(fid);
    if (f) {
      f.addEventListener('input', () => { updateCompletion(); scheduleAutosave(); });
      f.addEventListener('change', () => { updateCompletion(); scheduleAutosave(); });
    }
  });
}

function toggleProductionWrap(siteType) {
  const wrap = document.getElementById('production-desc-wrap');
  if (wrap) wrap.style.display = (siteType === 'industry') ? '' : 'none';
}

function toggleTransformersSection(count) {
  const sec = document.getElementById('transformers-section');
  if (sec) sec.style.display = (count > 0) ? '' : 'none';
}

// ============================================================
// TRANSFORMERS
// ============================================================
function bindTransformers() {
  document.getElementById('btn-add-transformer')?.addEventListener('click', () => {
    addTransformerRow({});
  });
}

function addTransformerRow(data) {
  App.transformerRows.push({
    id: 'tr-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
    name: data.name || '',
    capacity: data.capacity || '',
    load: data.load || ''
  });
  renderTransformerRows();
}

function syncTransformerCount(count) {
  while (App.transformerRows.length < count) addTransformerRow({});
  if (App.transformerRows.length > count) App.transformerRows = App.transformerRows.slice(0, count);
  renderTransformerRows();
}

function renderTransformerRows() {
  const tbody = document.getElementById('transformers-body');
  if (!tbody) return;
  if (App.transformerRows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-hint);padding:12px;">לחץ "הוסף שנאי" להוספת שורה</td></tr>';
    return;
  }
  tbody.innerHTML = App.transformerRows.map((row, idx) => `
    <tr>
      <td><input type="text" value="${escHtml(row.name)}" data-tr="${idx}" data-field="name" placeholder="T${idx + 1}" style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;" /></td>
      <td><input type="number" value="${row.capacity}" data-tr="${idx}" data-field="capacity" placeholder="630" min="0" style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;" /></td>
      <td><input type="number" value="${row.load}" data-tr="${idx}" data-field="load" placeholder="75" min="0" max="100" style="width:100%;padding:6px 8px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;" /></td>
      <td style="text-align:center;"><button type="button" class="btn btn-danger btn-sm" data-tr-del="${idx}"><i class="fas fa-times"></i></button></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-tr][data-field]').forEach(input => {
    input.addEventListener('input', () => {
      const idx = parseInt(input.dataset.tr);
      const field = input.dataset.field;
      if (App.transformerRows[idx]) App.transformerRows[idx][field] = input.value;
      scheduleAutosave();
    });
  });
  tbody.querySelectorAll('[data-tr-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      App.transformerRows.splice(parseInt(btn.dataset.trDel), 1);
      renderTransformerRows();
      scheduleAutosave();
    });
  });
}

// ============================================================
// ENERGY CARDS
// ============================================================
function buildEnergyCards() {
  const container = document.getElementById('energy-cards-container');
  if (!container) return;
  initEnergySources();
  container.innerHTML = ENERGY_TYPES.map(t => buildOneEnergyCard(t)).join('');
  rebindEnergyCards();
}

function rebindEnergyCards() {
  const container = document.getElementById('energy-cards-container');
  if (!container) return;

  container.querySelectorAll('.toggle-switch input[type="checkbox"]').forEach(toggle => {
    toggle.addEventListener('change', (e) => {
      const key = e.target.closest('.energy-card')?.dataset.energyKey;
      if (key) onEnergyToggle(key, e.target.checked);
    });
  });

  container.querySelectorAll('.energy-field-input').forEach(input => {
    input.addEventListener('input', () => {
      const card = input.closest('.energy-card');
      if (!card) return;
      const key = card.dataset.energyKey;
      const field = input.dataset.field;
      if (!App.energySources[key]) App.energySources[key] = {};
      App.energySources[key][field] = input.value;
      updateEnergySummary();
      scheduleAutosave();
    });
    input.addEventListener('change', () => {
      const card = input.closest('.energy-card');
      if (!card) return;
      const key = card.dataset.energyKey;
      const field = input.dataset.field;
      if (!App.energySources[key]) App.energySources[key] = {};
      App.energySources[key][field] = input.value;
      scheduleAutosave();
    });
  });
}

function buildOneEnergyCard(t) {
  const src = App.energySources[t.key] || {};
  const isOn = !!src.exists;
  const bodyDisplay = isOn ? 'block' : 'none';
  const activeClass = isOn ? t.colorClass : '';
  const unitOpts = t.units.map(u =>
    `<option value="${u}" ${(src.unit || t.defaultUnit) === u ? 'selected' : ''}>${u}</option>`
  ).join('');
  const srcOpts = ['', 'invoice', 'meter', 'estimate', 'client_report']
    .map((v, i) => {
      const labels = ['בחר...', 'חשבון', 'מד', 'אומדן', 'דיווח לקוח'];
      return `<option value="${v}" ${src.source === v ? 'selected' : ''}>${labels[i]}</option>`;
    }).join('');

  return `
    <div class="energy-card ${activeClass}" data-energy-key="${t.key}">
      <div class="energy-card-header">
        <div class="energy-card-title">
          <div class="energy-icon" style="background:${t.iconBg};color:${t.iconColor};">
            <i class="fas ${t.icon}"></i>
          </div>
          <span>${t.label}</span>
        </div>
        <label class="toggle-switch">
          <input type="checkbox" ${isOn ? 'checked' : ''} />
          <span class="toggle-slider"></span>
        </label>
      </div>
      <div class="energy-card-body" style="display:${bodyDisplay};">
        <div class="energy-fields">
          <div class="form-group">
            <label>כמות שנתית</label>
            <input type="number" class="energy-field-input" data-field="quantity" value="${src.quantity || ''}" placeholder="0" min="0" />
          </div>
          <div class="form-group">
            <label>יחידה</label>
            <select class="energy-field-input" data-field="unit">${unitOpts}</select>
          </div>
          <div class="form-group">
            <label>עלות שנתית (₪)</label>
            <input type="number" class="energy-field-input" data-field="cost" value="${src.cost || ''}" placeholder="0" min="0" />
          </div>
          <div class="form-group">
            <label>מקור נתון</label>
            <select class="energy-field-input" data-field="source">${srcOpts}</select>
          </div>
        </div>
      </div>
    </div>`;
}

function onEnergyToggle(key, isOn) {
  if (!App.energySources[key]) App.energySources[key] = { type: key };
  App.energySources[key].exists = isOn;
  const card = document.querySelector(`[data-energy-key="${key}"]`);
  if (!card) return;
  const body = card.querySelector('.energy-card-body');
  const t = ENERGY_TYPES.find(x => x.key === key);
  if (isOn) {
    if (t) card.classList.add(t.colorClass);
    if (body) body.style.display = 'block';
  } else {
    card.classList.remove('active', 'active-green');
    if (body) body.style.display = 'none';
  }
  updateEnergySummary();
  scheduleAutosave();
}

function updateEnergyCardsUI() {
  const container = document.getElementById('energy-cards-container');
  if (!container) return;
  // Rebuild cards fully with current state
  container.innerHTML = ENERGY_TYPES.map(t => buildOneEnergyCard(t)).join('');
  rebindEnergyCards();
  updateEnergySummary();
}

function updateEnergySummary() {
  const grid = document.getElementById('summary-grid');
  if (!grid) return;
  const active = ENERGY_TYPES.filter(t => App.energySources[t.key]?.exists);
  if (active.length === 0) {
    grid.innerHTML = '<div style="color:var(--text-hint);font-size:13px;grid-column:1/-1;">לא הוזנו מקורות אנרגיה</div>';
    return;
  }
  let totalCost = 0;
  active.forEach(t => { totalCost += parseFloat(App.energySources[t.key]?.cost || 0); });
  grid.innerHTML = active.map(t => {
    const s = App.energySources[t.key] || {};
    return `<div class="summary-item">
      <div class="label">${t.label}</div>
      <div class="value" style="color:${t.iconColor}">${s.quantity ? fmtNum(s.quantity) : '—'}</div>
      <div class="unit">${s.unit || ''}</div>
    </div>`;
  }).join('') + `<div class="summary-item">
    <div class="label">סה"כ עלות שנתית</div>
    <div class="value" style="color:var(--primary)">${totalCost > 0 ? '₪' + fmtNum(totalCost) : '—'}</div>
    <div class="unit">₪/שנה</div>
  </div>`;
}

// ============================================================
// STEP WIZARD
// ============================================================
function goToStep(step) {
  App.currentStep = step;
  // Show/hide step content (now 4 steps)
  [1, 2, 3, 4].forEach(n => {
    const el = document.getElementById('step-' + n);
    if (el) el.style.display = (n === step) ? 'block' : 'none';
  });
  // Update wizard progress circles (supports both .wstep and .wizard-step)
  document.querySelectorAll('.wstep, .wizard-step').forEach(el => {
    const n = parseInt(el.dataset.step);
    el.classList.remove('active', 'completed');
    if (n < step) el.classList.add('completed');
    else if (n === step) el.classList.add('active');
  });
  // Update connecting lines (supports both .wstep-line and .wizard-line)
  document.querySelectorAll('.wstep-line, .wizard-line').forEach((line, i) => {
    line.classList.toggle('completed', step > i + 1);
  });
  // Step-specific init
  if (step === 3 && typeof renderSystemsList === 'function') renderSystemsList();
  if (step === 4) buildStep3Summary(); // step 4 is now the summary
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================
// STEP 1 VALIDATION
// ============================================================
function validateStep1() {
  let ok = true;
  const required = [
    { id: 'f-survey-date', msg: 'נדרש תאריך סקר' },
    { id: 'f-site-type', msg: 'נדרש סוג אתר' },
    { id: 'f-site-name', msg: 'נדרש שם אתר' },
    { id: 'f-address', msg: 'נדרשת כתובת' },
    { id: 'f-employees', msg: 'נדרש מספר עובדים' },
    { id: 'f-building-area', msg: 'נדרש שטח מבנה' },
    { id: 'f-working-days', msg: 'נדרשים ימי עבודה' },
    { id: 'f-activity-desc', msg: 'נדרש תיאור פעילות' }
  ];
  required.forEach(({ id, msg }) => {
    const el = document.getElementById(id);
    if (!el) return;
    const err = el.closest('.form-group')?.querySelector('.field-error');
    if (!el.value.trim()) {
      el.classList.add('invalid');
      if (err) err.textContent = msg;
      ok = false;
    } else {
      el.classList.remove('invalid');
      if (err) err.textContent = '';
    }
  });
  const area = parseFloat(getVal('f-building-area')) || 0;
  const cArea = parseFloat(getVal('f-conditioned-area')) || 0;
  if (cArea > area && area > 0) {
    const el = document.getElementById('f-conditioned-area');
    el?.classList.add('invalid');
    const err = el?.closest('.form-group')?.querySelector('.field-error');
    if (err) err.textContent = 'לא יכול לעלות על השטח הכולל';
    ok = false;
  }
  if (!ok) toast('נא למלא את כל שדות החובה', 'error');
  return ok;
}

// ============================================================
// STEP 2 VALIDATION
// ============================================================
function validateStep2() {
  let ok = true;
  const supplier = document.getElementById('f-elec-supplier');
  if (supplier && !supplier.value.trim()) {
    supplier.classList.add('invalid');
    ok = false;
  } else {
    supplier?.classList.remove('invalid');
  }
  const voltage = document.querySelector('input[name="voltage_level"]:checked');
  const voltErr = document.getElementById('voltage-error');
  if (!voltage) {
    if (voltErr) voltErr.textContent = 'נדרשת בחירת סוג מתח';
    ok = false;
  } else {
    if (voltErr) voltErr.textContent = '';
  }
  if (!ok) toast('נא להשלים את פרטי תשתית החשמל', 'error');
  return ok;
}

// ============================================================
// COLLECT ALL FORM DATA
// ============================================================
function collectData() {
  return {
    survey_date: getVal('f-survey-date'),
    site_type: getVal('f-site-type'),
    site_name: getVal('f-site-name'),
    address_full: getVal('f-address'),
    city: getVal('f-city'),
    location_link: getVal('f-location-link'),
    employees_count: parseInt(getVal('f-employees')) || 0,
    building_area_m2: parseFloat(getVal('f-building-area')) || 0,
    conditioned_area_m2: parseFloat(getVal('f-conditioned-area')) || 0,
    working_days_per_week: parseInt(getVal('f-working-days')) || 5,
    weekday_start: getVal('f-start-time'),
    weekday_end: getVal('f-end-time'),
    active_friday: isChecked('f-friday'),
    active_saturday: isChecked('f-saturday'),
    active_holidays: isChecked('f-holidays'),
    site_activity_description: getVal('f-activity-desc'),
    production_description: getVal('f-production-desc'),
    energy_manager_name: getVal('f-em-name'),
    energy_manager_phone: getVal('f-em-phone'),
    maintenance_manager_name: getVal('f-mm-name'),
    maintenance_manager_phone: getVal('f-mm-phone'),
    finance_contact_name: getVal('f-fc-name'),
    finance_contact_phone: getVal('f-fc-phone'),
    electricity_supplier: getVal('f-elec-supplier'),
    voltage_level: document.querySelector('input[name="voltage_level"]:checked')?.value || '',
    transformers_count: parseInt(getVal('f-transformers-count')) || 0,
    has_on_site_generation: isChecked('f-generation'),
    transformers: App.transformerRows.map(r => ({ name: r.name, capacity: parseFloat(r.capacity) || 0, load: parseFloat(r.load) || 0 })),
    energy_sources: ENERGY_TYPES.map(t => App.energySources[t.key] || { type: t.key, exists: false }),
    systems: App.currentSurvey?.systems || []
  };
}

// ============================================================
// COMPLETION %
// ============================================================
function updateCompletion() {
  const fields = ['f-survey-date', 'f-site-type', 'f-site-name', 'f-address', 'f-employees', 'f-building-area', 'f-working-days', 'f-activity-desc', 'f-elec-supplier'];
  const filled = fields.filter(id => (document.getElementById(id)?.value || '').trim() !== '');
  const pct = Math.round((filled.length / fields.length) * 100);
  const fill = document.getElementById('progress-fill');
  const label = document.getElementById('completion-pct');
  if (fill) fill.style.width = pct + '%';
  if (label) label.textContent = pct + '%';
}

// ============================================================
// AUTOSAVE
// ============================================================
function startAutosave() {
  clearInterval(App.autosaveTimer);
  App.autosaveTimer = setInterval(() => saveDraft(true), 20000);
}

function scheduleAutosave() {
  clearTimeout(App.debounceTimer);
  App.debounceTimer = setTimeout(() => saveDraft(true), 2500);
}

function saveDraft(silent = false) {
  if (!App.currentSurvey) return;
  const data = collectData();
  const survey = {
    ...App.currentSurvey,
    ...data,
    status: (App.currentSurvey.status === 'submitted') ? 'submitted' : 'draft',
    sync_status: App.isOnline ? 'pending' : 'local',
    energy_sources: JSON.stringify(data.energy_sources),
    transformers: JSON.stringify(data.transformers),
    systems: JSON.stringify(data.systems),
    updated_at: new Date().toISOString()
  };

  const surveyId = App.editingId || survey.id;
  App.editingId = surveyId;
  survey.id = surveyId;

  const idx = App.surveys.findIndex(s => s.id === surveyId);
  if (idx > -1) App.surveys[idx] = { ...App.surveys[idx], ...survey };
  else App.surveys.push(survey);

  lsSaveSurveys(App.surveys);

  if (!silent) {
    const ind = document.getElementById('autosave-indicator');
    if (ind) { ind.innerHTML = '<i class="fas fa-check-circle" style="color:var(--secondary)"></i> נשמר'; setTimeout(() => { if (ind) ind.innerHTML = ''; }, 3000); }
  }
  if (App.isOnline) syncToServer(survey);
}

// ============================================================
// SUBMIT
// ============================================================
async function submitSurvey() {
  if (!validateStep1()) { goToStep(1); return; }
  if (!validateStep2()) { goToStep(2); return; }

  const data = collectData();
  const survey = {
    ...App.currentSurvey,
    ...data,
    status: 'submitted',
    sync_status: App.isOnline ? 'pending' : 'local',
    energy_sources: JSON.stringify(data.energy_sources),
    transformers: JSON.stringify(data.transformers),
    systems: JSON.stringify(data.systems),
    updated_at: new Date().toISOString()
  };

  const surveyId = App.editingId || survey.id;
  survey.id = surveyId;
  const idx = App.surveys.findIndex(s => s.id === surveyId);
  if (idx > -1) App.surveys[idx] = { ...App.surveys[idx], ...survey };
  else App.surveys.push(survey);

  lsSaveSurveys(App.surveys);
  clearInterval(App.autosaveTimer);
  if (App.isOnline) syncToServer(survey);

  App.currentSurvey = null;
  App.editingId = null;

  toast('הסקר הוגש בהצלחה! 🎉', 'success');
  renderSurveyList();
  navigateTo('surveys');
}

// ============================================================
// DELETE
// ============================================================
function deleteSurvey(id) {
  const s = App.surveys.find(x => x.id === id);
  if (!s) return;
  showConfirm('מחיקת סקר', `האם אתה בטוח שברצונך למחוק את הסקר "${s.site_name || id}"?`, async () => {
    App.surveys = App.surveys.filter(x => x.id !== id);
    lsSaveSurveys(App.surveys);
    if (App.isOnline) { try { await fetch(`tables/energy_surveys/${id}`, { method: 'DELETE' }); } catch {} }
    renderSurveyList();
    toast('הסקר נמחק', 'success');
  });
}

// ============================================================
// SERVER SYNC
// ============================================================
async function syncToServer(survey) {
  const payload = {
    ...survey,
    energy_sources: typeof survey.energy_sources === 'string' ? survey.energy_sources : JSON.stringify(survey.energy_sources),
    transformers: typeof survey.transformers === 'string' ? survey.transformers : JSON.stringify(survey.transformers)
  };
  try {
    const checkRes = await fetch(`tables/energy_surveys/${survey.id}`);
    let res;
    if (checkRes.ok) {
      res = await fetch(`tables/energy_surveys/${survey.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      res = await fetch('tables/energy_surveys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    if (res?.ok) {
      const idx = App.surveys.findIndex(s => s.id === survey.id);
      if (idx > -1) App.surveys[idx].sync_status = 'synced';
      lsSaveSurveys(App.surveys);
    }
  } catch { /* offline - silently fail */ }
}

async function syncPendingSurveys() {
  const pending = App.surveys.filter(s => s.sync_status === 'pending' || s.sync_status === 'local');
  for (const s of pending) await syncToServer(s);
}

// ============================================================
// STEP 3 SUMMARY
// ============================================================
function buildStep3Summary() {
  const container = document.getElementById('summary-view');
  if (!container) return;
  const d = collectData();
  const activeEnergy = d.energy_sources.filter(e => e.exists);
  const systems = d.systems || [];
  const totalKwh = systems.reduce((acc, s) => {
    return acc + (parseFloat(s.units)||0)*(parseFloat(s.power)||0)*(parseFloat(s.hours)||0)*(parseFloat(s.days)||0)*(parseFloat(s.load)||1);
  }, 0);

  container.innerHTML = `
    <div class="summary-section">
      <h4><i class="fas fa-building"></i> פרטי אתר</h4>
      ${sRow('שם האתר', d.site_name)}
      ${sRow('סוג אתר', SITE_TYPE_LABELS[d.site_type] || '—')}
      ${sRow('כתובת', d.address_full)}
      ${sRow('עיר', d.city)}
      ${sRow('תאריך סקר', fmtDate(d.survey_date))}
      ${sRow('עובדים', fmtNum(d.employees_count))}
      ${sRow('שטח כולל', fmtNum(d.building_area_m2) + ' מ"ר')}
      ${sRow('שטח ממוזג', d.conditioned_area_m2 ? fmtNum(d.conditioned_area_m2) + ' מ"ר' : '—')}
      ${sRow('שעות', (d.weekday_start || '—') + ' – ' + (d.weekday_end || '—') + ', ' + d.working_days_per_week + ' ימים')}
    </div>
    <div class="summary-section">
      <h4><i class="fas fa-plug"></i> תשתית אנרגיה</h4>
      ${sRow('ספק חשמל', d.electricity_supplier)}
      ${sRow('סוג מתח', VOLTAGE_LABELS[d.voltage_level] || '—')}
      ${sRow('שנאים', d.transformers_count || 0)}
      ${sRow('ייצור חשמל', d.has_on_site_generation ? 'כן' : 'לא')}
      ${sRow('מקורות פעילים', activeEnergy.length)}
      ${activeEnergy.map(e => {
        const t = ENERGY_TYPES.find(x => x.key === e.type);
        return sRow('<i class="fas ' + (t?.icon || 'fa-bolt') + '"></i> ' + (t?.label || e.type), fmtNum(e.quantity) + ' ' + (e.unit || '') + (e.cost ? ' | ₪' + fmtNum(e.cost) : ''));
      }).join('')}
    </div>
    <div class="summary-section">
      <h4><i class="fas fa-cogs"></i> מערכות ציוד</h4>
      ${sRow('מספר מערכות', systems.length)}
      ${systems.length > 0 ? sRow('צריכה שנתית מחושבת', fmtNum(Math.round(totalKwh)) + ' kWh') : ''}
      ${systems.length > 0 ? sRow('עלות שנתית משוערת', '₪' + fmtNum(Math.round(totalKwh * 0.55))) : ''}
      ${systems.map(s => {
        const cat = typeof SYSTEM_CATEGORIES !== 'undefined' ? (SYSTEM_CATEGORIES[s.category] || {}) : {};
        const kwh = (parseFloat(s.units)||0)*(parseFloat(s.power)||0)*(parseFloat(s.hours)||0)*(parseFloat(s.days)||0)*(parseFloat(s.load)||1);
        return sRow('<i class="fas ' + (cat.icon || 'fa-cog') + '"></i> ' + escHtml(s.name), fmtNum(Math.round(kwh)) + ' kWh/שנה');
      }).join('')}
      ${systems.length === 0 ? '<div style="color:var(--text-hint);font-size:13px;">לא הוזנו מערכות ציוד</div>' : ''}
    </div>
    <div class="summary-section">
      <h4><i class="fas fa-address-book"></i> אנשי קשר</h4>
      ${d.energy_manager_name ? sRow('ממונה אנרגיה', d.energy_manager_name + (d.energy_manager_phone ? ' | ' + d.energy_manager_phone : '')) : ''}
      ${d.maintenance_manager_name ? sRow('מנהל אחזקה', d.maintenance_manager_name + (d.maintenance_manager_phone ? ' | ' + d.maintenance_manager_phone : '')) : ''}
      ${d.finance_contact_name ? sRow('אחראי חשבונות', d.finance_contact_name + (d.finance_contact_phone ? ' | ' + d.finance_contact_phone : '')) : ''}
      ${!d.energy_manager_name && !d.maintenance_manager_name && !d.finance_contact_name ? '<div style="color:var(--text-hint);font-size:13px;">לא הוזנו אנשי קשר</div>' : ''}
    </div>
    <div class="summary-section">
      <h4><i class="fas fa-user"></i> פרטי סוקר</h4>
      ${sRow('שם הסוקר', App.currentUser?.name || '—')}
      ${sRow('תאריך הזנה', fmtDate(new Date().toISOString().split('T')[0]))}
    </div>
  `;

  buildChecklist(d);
}

function sRow(key, val) {
  return `<div class="summary-row"><span class="key">${key}</span><span class="val">${escHtml(String(val || '—'))}</span></div>`;
}

function buildChecklist(d) {
  const el = document.getElementById('validation-checklist');
  if (!el) return;
  const checks = [
    { pass: !!d.site_name, msg: 'שם האתר מולא' },
    { pass: !!d.site_type, msg: 'סוג האתר נבחר' },
    { pass: !!d.address_full, msg: 'כתובת מולאה' },
    { pass: d.employees_count > 0, msg: 'מספר עובדים מולא' },
    { pass: d.building_area_m2 > 0, msg: 'שטח המבנה מולא' },
    { pass: !!d.site_activity_description, msg: 'תיאור פעילות מולא' },
    { pass: !!d.electricity_supplier, msg: 'ספק חשמל נבחר' },
    { pass: !!d.voltage_level, msg: 'סוג מתח נבחר' },
    { pass: d.energy_sources.some(e => e.exists), msg: 'לפחות מקור אנרגיה אחד פעיל', warn: true },
    { pass: (d.systems || []).length > 0, msg: 'הוזנו מערכות ציוד', warn: true },
    { pass: !!(d.energy_manager_name || d.maintenance_manager_name), msg: 'אנשי קשר הוזנו', warn: true }
  ];
  const allReq = checks.filter(c => !c.warn).every(c => c.pass);
  el.innerHTML = '<h4><i class="fas fa-clipboard-check"></i> בדיקת שלמות טופס</h4>'
    + checks.map(c => {
      const cls = c.pass ? 'pass' : c.warn ? 'warn' : 'fail';
      const icon = c.pass ? 'fa-check-circle' : c.warn ? 'fa-exclamation-triangle' : 'fa-times-circle';
      return `<div class="check-item ${cls}"><i class="fas ${icon}"></i><span>${c.msg}</span></div>`;
    }).join('')
    + (allReq
      ? '<div style="margin-top:12px;color:var(--secondary);font-weight:600;"><i class="fas fa-check-circle"></i> הסקר מוכן להגשה</div>'
      : '<div style="margin-top:12px;color:var(--danger);font-weight:600;"><i class="fas fa-exclamation-circle"></i> יש שדות חובה חסרים – נא לחזור ולהשלים</div>');
}

// ============================================================
// DETAIL VIEW
// ============================================================
function renderDetailView(s) {
  const container = document.getElementById('survey-detail-content');
  const titleEl = document.getElementById('detail-title');
  if (!container) return;
  if (titleEl) titleEl.textContent = s.site_name || 'פרטי סקר';

  const energySources = parseField(s.energy_sources, []);
  const transformers = parseField(s.transformers, []);
  const activeEnergy = energySources.filter(e => e.exists);

  container.innerHTML = `
    <div class="detail-grid">
      <div class="detail-card">
        <h4><i class="fas fa-building"></i> פרטי אתר</h4>
        ${dRow('שם', s.site_name)}
        ${dRow('סוג', SITE_TYPE_LABELS[s.site_type] || s.site_type)}
        ${dRow('כתובת', s.address_full)}
        ${dRow('עיר', s.city)}
        ${dRow('תאריך סקר', fmtDate(s.survey_date))}
        ${dRow('עובדים', fmtNum(s.employees_count))}
        ${dRow('שטח כולל', fmtNum(s.building_area_m2) + ' מ"ר')}
        ${s.conditioned_area_m2 ? dRow('שטח ממוזג', fmtNum(s.conditioned_area_m2) + ' מ"ר') : ''}
        ${dRow('שעות', (s.weekday_start || '—') + ' – ' + (s.weekday_end || '—'))}
        ${dRow('ימי עבודה', (s.working_days_per_week || '—') + ' ימים/שבוע')}
        ${dRow('שישי', s.active_friday ? 'כן' : 'לא')}
        ${dRow('שבת', s.active_saturday ? 'כן' : 'לא')}
        ${dRow('חגים', s.active_holidays ? 'כן' : 'לא')}
        ${dRow('פעילות', s.site_activity_description)}
      </div>
      <div class="detail-card">
        <h4><i class="fas fa-plug"></i> תשתית חשמל</h4>
        ${dRow('ספק', s.electricity_supplier)}
        ${dRow('מתח', VOLTAGE_LABELS[s.voltage_level] || '—')}
        ${dRow('שנאים', s.transformers_count || 0)}
        ${dRow('ייצור חשמל', s.has_on_site_generation ? 'כן' : 'לא')}
        ${transformers.length > 0 ? '<h4 style="margin-top:12px;font-size:13px;color:var(--text-secondary);">פרטי שנאים</h4>' + transformers.map(t => dRow(t.name || '—', fmtNum(t.capacity) + ' kVA' + (t.load ? ' | ' + t.load + '%' : ''))).join('') : ''}
        <h4 style="margin-top:12px;font-size:13px;color:var(--text-secondary);"><i class="fas fa-fire"></i> מקורות אנרגיה</h4>
        ${activeEnergy.length === 0 ? '<div style="color:var(--text-hint)">לא הוזנו</div>' : activeEnergy.map(e => {
          const t = ENERGY_TYPES.find(x => x.key === e.type);
          return dRow('<i class="fas ' + (t?.icon || 'fa-bolt') + '"></i> ' + (t?.label || e.type), fmtNum(e.quantity) + ' ' + (e.unit || '') + (e.cost ? ' | ₪' + fmtNum(e.cost) : ''));
        }).join('')}
      </div>
      <div class="detail-card">
        <h4><i class="fas fa-address-book"></i> אנשי קשר</h4>
        ${s.energy_manager_name ? dRow('ממונה אנרגיה', s.energy_manager_name + (s.energy_manager_phone ? ' | ' + s.energy_manager_phone : '')) : ''}
        ${s.maintenance_manager_name ? dRow('מנהל אחזקה', s.maintenance_manager_name + (s.maintenance_manager_phone ? ' | ' + s.maintenance_manager_phone : '')) : ''}
        ${s.finance_contact_name ? dRow('אחראי חשבונות', s.finance_contact_name + (s.finance_contact_phone ? ' | ' + s.finance_contact_phone : '')) : ''}
        ${!s.energy_manager_name && !s.maintenance_manager_name && !s.finance_contact_name ? '<div style="color:var(--text-hint)">לא הוזנו</div>' : ''}
      </div>
      <div class="detail-card">
        <h4><i class="fas fa-info-circle"></i> מידע כללי</h4>
        ${dRow('סוקר', s.surveyor_name || s.created_by)}
        ${dRow('סטטוס', '<span class="card-status ' + (s.status || 'draft') + '">' + (STATUS_LABELS[s.status] || 'טיוטה') + '</span>')}
        ${dRow('סנכרון', s.sync_status || '—')}
        ${dRow('עודכן', s.updated_at ? new Date(s.updated_at).toLocaleString('he-IL') : '—')}
      </div>
    </div>`;
}

function dRow(k, v) {
  return `<div class="detail-row"><span class="k">${k}</span><span class="v">${v != null ? String(v) : '—'}</span></div>`;
}

// ============================================================
// ADMIN USERS
// ============================================================
function openAdminUsers() {
  navigateTo('admin-users', 'ניהול משתמשים');
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;
  const counts = {};
  App.surveys.forEach(s => { counts[s.created_by] = (counts[s.created_by] || 0) + 1; });
  tbody.innerHTML = USERS.map(u => `
    <tr>
      <td><code>${u.username}</code></td>
      <td>${escHtml(u.name)}</td>
      <td><span class="card-status ${u.role === 'admin' ? 'submitted' : 'ready'}">${u.role === 'admin' ? 'מנהל' : 'סוקר'}</span></td>
      <td>${counts[u.id] || counts[u.username] || 0}</td>
      <td><span style="color:var(--text-hint);font-size:12px">ניהול משתמשים — שלב 2</span></td>
    </tr>`).join('');
}

// ============================================================
// ONLINE STATUS
// ============================================================
function initOnlineStatus() {
  updateSyncUI();
  window.addEventListener('online', () => { App.isOnline = true; updateSyncUI(); toast('החיבור חזר — מסנכרן נתונים', 'success'); syncPendingSurveys(); });
  window.addEventListener('offline', () => { App.isOnline = false; updateSyncUI(); toast('אין חיבור — הנתונים נשמרים מקומית', 'warning'); });
}

function updateSyncUI() {
  const el = document.getElementById('sync-indicator');
  const lb = document.getElementById('sync-label');
  if (!el || !lb) return;
  if (App.isOnline) {
    el.className = 'sync-indicator';
    el.querySelector('i').className = 'fas fa-cloud-upload-alt';
    lb.textContent = 'מסונכרן';
  } else {
    el.className = 'sync-indicator offline';
    el.querySelector('i').className = 'fas fa-cloud-download-alt';
    lb.textContent = 'אופליין';
  }
}

// ============================================================
// TOAST
// ============================================================
function toast(msg, type = 'info') {
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${escHtml(msg)}</span>`;
  document.getElementById('toast-container')?.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ============================================================
// CONFIRM MODAL
// ============================================================
function showConfirm(title, body, onOk, onCancel) {
  const overlay = document.getElementById('modal-overlay');
  if (!overlay) return;
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').textContent = body;
  overlay.style.display = 'flex';

  const ok = document.getElementById('modal-confirm');
  const cancel = document.getElementById('modal-cancel');
  // Clone to remove old listeners
  const newOk = ok.cloneNode(true);
  const newCancel = cancel.cloneNode(true);
  ok.replaceWith(newOk);
  cancel.replaceWith(newCancel);

  newOk.addEventListener('click', () => { overlay.style.display = 'none'; onOk?.(); }, { once: true });
  newCancel.addEventListener('click', () => { overlay.style.display = 'none'; onCancel?.(); }, { once: true });
}

// ============================================================
// HELPERS
// ============================================================
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val ?? ''; }
function setVal(id, val) { const el = document.getElementById(id); if (el) el.value = val ?? ''; }
function getVal(id) { return document.getElementById(id)?.value || ''; }
function setChecked(id, val) { const el = document.getElementById(id); if (el) el.checked = !!val; }
function isChecked(id) { return document.getElementById(id)?.checked || false; }
function escHtml(s) { return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function deepClone(o) { try { return JSON.parse(JSON.stringify(o)); } catch { return o; } }
function fmtNum(n) { if (n == null || n === '') return '—'; return Number(n).toLocaleString('he-IL'); }
function fmtDate(d) { if (!d) return '—'; try { const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; } catch { return d; } }
function genId() { return 'srv-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6); }
