/**
 * DATA MODULE
 * Mock users, energy types configuration, demo data
 */

// ============================================================
// USERS (mock authentication)
// ============================================================
const USERS = [
  {
    id: 'admin',
    username: 'admin',
    password: 'admin123',
    name: 'מנהל מערכת',
    role: 'admin',
    avatar: 'מ'
  },
  {
    id: 'surveyor1',
    username: 'surveyor1',
    password: 'survey123',
    name: 'ישראל ישראלי',
    role: 'surveyor',
    avatar: 'י'
  },
  {
    id: 'surveyor2',
    username: 'surveyor2',
    password: 'survey456',
    name: 'שרה כהן',
    role: 'surveyor',
    avatar: 'ש'
  }
];

// ============================================================
// ENERGY TYPES CONFIGURATION
// ============================================================
const ENERGY_TYPES = [
  {
    key: 'electricity_consumption',
    label: 'צריכת חשמל',
    icon: 'fa-bolt',
    iconBg: '#fff3e0',
    iconColor: '#e65100',
    units: ['kWh', 'MWh'],
    defaultUnit: 'kWh',
    colorClass: 'active'
  },
  {
    key: 'electricity_generation',
    label: 'ייצור חשמל (סולארי / גנרטור)',
    icon: 'fa-solar-panel',
    iconBg: '#e8f5e9',
    iconColor: '#2e7d32',
    units: ['kWh', 'MWh'],
    defaultUnit: 'kWh',
    colorClass: 'active-green'
  },
  {
    key: 'natural_gas',
    label: 'גז טבעי',
    icon: 'fa-fire',
    iconBg: '#e3f2fd',
    iconColor: '#1565c0',
    units: ['Nm³', 'kWh', 'TOE'],
    defaultUnit: 'Nm³',
    colorClass: 'active'
  },
  {
    key: 'lpg',
    label: 'גז נוזלי (גפ"מ)',
    icon: 'fa-fire-alt',
    iconBg: '#f3e5f5',
    iconColor: '#7b1fa2',
    units: ['kg', 'ליטר', 'טון'],
    defaultUnit: 'kg',
    colorClass: 'active'
  },
  {
    key: 'diesel',
    label: 'סולר',
    icon: 'fa-gas-pump',
    iconBg: '#fbe9e7',
    iconColor: '#bf360c',
    units: ['ליטר', 'טון'],
    defaultUnit: 'ליטר',
    colorClass: 'active'
  },
  {
    key: 'gasoline',
    label: 'בנזין',
    icon: 'fa-car',
    iconBg: '#fce4ec',
    iconColor: '#880e4f',
    units: ['ליטר'],
    defaultUnit: 'ליטר',
    colorClass: 'active'
  },
  {
    key: 'mazut',
    label: 'מזוט / שמן',
    icon: 'fa-oil-can',
    iconBg: '#f1f8e9',
    iconColor: '#33691e',
    units: ['ליטר', 'טון'],
    defaultUnit: 'ליטר',
    colorClass: 'active'
  },
  {
    key: 'water',
    label: 'מים (תהליכיים)',
    icon: 'fa-tint',
    iconBg: '#e1f5fe',
    iconColor: '#01579b',
    units: ['מ"ק', 'ליטר'],
    defaultUnit: 'מ"ק',
    colorClass: 'active'
  }
];

// ============================================================
// VOLTAGE LEVELS
// ============================================================
const VOLTAGE_LABELS = {
  low: 'מתח נמוך',
  high: 'מתח גבוה',
  upper: 'מתח עליון'
};

// ============================================================
// SITE TYPE LABELS
// ============================================================
const SITE_TYPE_LABELS = {
  industry: 'מפעל / תעשייה',
  office: 'משרדים / רשות'
};

// ============================================================
// STATUS LABELS & COLORS
// ============================================================
const STATUS_LABELS = {
  draft: 'טיוטה',
  ready: 'מוכן',
  submitted: 'הוגש'
};

// ============================================================
// FORMAT HELPERS
// ============================================================
function formatNumber(n) {
  if (n == null || n === '') return '—';
  return Number(n).toLocaleString('he-IL');
}

function formatDate(d) {
  if (!d) return '—';
  try {
    const parts = d.split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  } catch { return d; }
}

function generateId() {
  return 'survey-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
}

// ============================================================
// LOCAL STORAGE HELPERS
// ============================================================
const LS_KEY = 'energy_surveys_local';
const LS_USER_KEY = 'energy_surveys_current_user';

function lsGetSurveys() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function lsSaveSurveys(surveys) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(surveys));
  } catch (e) {
    console.warn('LocalStorage save failed:', e);
  }
}

function lsGetCurrentUser() {
  try {
    const raw = localStorage.getItem(LS_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function lsSaveCurrentUser(user) {
  localStorage.setItem(LS_USER_KEY, JSON.stringify(user));
}

function lsClearCurrentUser() {
  localStorage.removeItem(LS_USER_KEY);
}
