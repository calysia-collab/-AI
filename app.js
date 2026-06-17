const icons = {
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10"/></svg>',
  newspaper: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h13v15H5a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z"/><path d="M17 8h3a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2h-2M7 9h6M7 13h6M7 17h3"/></svg>',
  compare: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 7h13M17 3l4 4-4 4M16 17H3M7 13l-4 4 4 4"/></svg>',
  folder: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3ZM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m9 18 6-6-6-6"/></svg>',
  'chevron-left': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m15 18-6-6 6-6"/></svg>',
  location: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 11a8 8 0 1 0-2 5M20 4v7h-7"/></svg>',
  gift: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M20 12v9H4v-9M2 7h20v5H2zM12 7v14M12 7H7.5a2.5 2.5 0 1 1 2.2-3.7L12 7Zm0 0h4.5a2.5 2.5 0 1 0-2.2-3.7L12 7Z"/></svg>',
  briefcase: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18M10 12v2h4v-2"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3h5Z"/><circle cx="12" cy="13" r="4"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m5 12 4 4L19 6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  'check-circle': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M5 3h12l3 3v15H4V4a1 1 0 0 1 1-1Z"/><path d="M8 3v6h8V3M8 21v-8h8v8"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/></svg>',
  globe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M4 5h16M7 12h10M10 19h4"/></svg>',
  message: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 3h7v7M10 14 21 3M21 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h6"/></svg>'
};

if (!window.SashaCore) {
  throw new Error('SashaCore failed to load.');
}

const {
  asArray,
  escapeHTML,
  normalizeCustomer,
  normalizeEvent,
  normalizePolicy,
  readStorage,
  removeStorage,
  safeExternalUrl,
  writeStorage
} = window.SashaCore;

function loadCollection(storageKey, legacyKey, defaults, normalizer = (item) => item) {
  removeStorage(localStorage, storageKey);
  if (legacyKey) removeStorage(localStorage, legacyKey);
  return asArray(defaults).map(normalizer);
}

function idsMatch(left, right) {
  return left !== null && left !== undefined
    && right !== null && right !== undefined
    && String(left) === String(right);
}

function sourceButtonMarkup(url, label) {
  const safeUrl = safeExternalUrl(url);
  return safeUrl
    ? `<button data-open-source="${escapeHTML(safeUrl)}">${escapeHTML(label)}</button>`
    : `<button disabled title="來源網址格式不安全">${escapeHTML(label)}</button>`;
}

document.querySelectorAll('[data-icon]').forEach((element) => {
  const iconName = element.dataset.icon;
  if (icons[iconName]) element.innerHTML = icons[iconName];
});

const appToday = new Date();
const toLocalISO = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const addDays = (date, days) => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return toLocalISO(nextDate);
};
const todayISO = toLocalISO(appToday);
const weekdayNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
const dashboardDateLabel = `${appToday.getFullYear()} 年 ${appToday.getMonth() + 1} 月 ${appToday.getDate()} 日・${weekdayNames[appToday.getDay()]}`;

const pageMeta = {
  dashboard: { eyebrow: dashboardDateLabel, title: '早安，張經理' },
  calendar: { eyebrow: '行程與提醒', title: '智慧行事曆' },
  policy: { eyebrow: '客戶保障整理', title: '保單辨識' },
  insights: { eyebrow: '每週一自動整理', title: '情報週報' },
  products: { eyebrow: '市場商品資訊', title: '商品比較' },
  team: { eyebrow: '成員、目標與協作', title: '團隊管理' },
  customers: { eyebrow: '客戶關係與服務進度', title: '客戶系統' },
  documents: { eyebrow: '常用官方入口', title: '文件中心' }
};

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const sidebar = document.getElementById('sidebar');
const mobileOverlay = document.getElementById('mobileOverlay');
const reviewStorageKey = 'sasha-review-state';
let reviewState = readStorage(sessionStorage, reviewStorageKey, {});

function getCalendarReviewSignature() {
  const todayEvents = events
    .filter((event) => event.date === todayISO)
    .sort((a, b) => `${a.time}${a.title}`.localeCompare(`${b.time}${b.title}`))
    .map((event) => `${event.id}:${event.time}:${event.status}`);
  return `${todayISO}|${todayEvents.join('|')}`;
}

function getInsightsReviewSignature() {
  return window.WEEKLY_INSIGHTS?.lastUpdated || 'weekly-insights-default';
}

function getNotificationReviewSignature() {
  return `${getCalendarReviewSignature()}|${getInsightsReviewSignature()}`;
}

function saveReviewState() {
  writeStorage(sessionStorage, reviewStorageKey, reviewState);
}

function updateReviewIndicators() {
  const todayEventCount = events.filter((event) => event.date === todayISO && event.status === 'scheduled').length;
  const calendarReviewed = reviewState.calendar === getCalendarReviewSignature();
  const insightsReviewed = reviewState.insights === getInsightsReviewSignature();
  const notificationReviewed = reviewState.notification === getNotificationReviewSignature();
  const calendarBadge = document.getElementById('todayEventCount');
  const insightsDot = document.getElementById('insightsUnreadDot');
  const notificationDot = document.getElementById('notificationUnreadDot');
  const notificationButton = document.getElementById('notificationButton');

  calendarBadge.textContent = todayEventCount;
  calendarBadge.classList.toggle('is-reviewed', calendarReviewed || todayEventCount === 0);
  insightsDot.classList.toggle('is-reviewed', insightsReviewed);
  notificationDot.classList.toggle('is-reviewed', notificationReviewed);
  notificationButton.classList.toggle('is-reviewed', notificationReviewed);
  notificationButton.setAttribute('aria-label', notificationReviewed ? '通知，已檢閱' : '通知，有未讀內容');
  notificationButton.title = notificationReviewed ? '通知已檢閱' : '查看未讀通知';
}

function markReviewed(type) {
  if (type === 'calendar') reviewState.calendar = getCalendarReviewSignature();
  if (type === 'insights') reviewState.insights = getInsightsReviewSignature();
  if (type === 'notification') reviewState.notification = getNotificationReviewSignature();
  saveReviewState();
  updateReviewIndicators();
}

function goToPage(pageName) {
  pages.forEach((page) => page.classList.toggle('active', page.id === `${pageName}-page`));
  navItems.forEach((item) => item.classList.toggle('active', item.dataset.page === pageName));
  document.getElementById('pageEyebrow').textContent = pageMeta[pageName].eyebrow;
  document.getElementById('pageTitle').textContent = pageMeta[pageName].title;
  sidebar.classList.remove('open');
  mobileOverlay.classList.remove('show');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (pageName === 'calendar' || pageName === 'insights') markReviewed(pageName);
}

navItems.forEach((item) => item.addEventListener('click', () => goToPage(item.dataset.page)));
document.querySelectorAll('[data-go-page]').forEach((button) => button.addEventListener('click', () => goToPage(button.dataset.goPage)));
document.getElementById('menuButton').addEventListener('click', () => {
  sidebar.classList.add('open');
  mobileOverlay.classList.add('show');
});
mobileOverlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  mobileOverlay.classList.remove('show');
});

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = icons['check-circle'];
  const messageElement = document.createElement('span');
  messageElement.textContent = String(message);
  toast.appendChild(messageElement);
  document.getElementById('toastContainer').appendChild(toast);
  window.setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    window.setTimeout(() => toast.remove(), 250);
  }, 3200);
}

let csrfToken = null;
let currentUser = null;

function setAuthMessage(message = '') {
  document.getElementById('authMessage').textContent = String(message);
}

function showAuthenticationGate({ setupRequired = false, message = '' } = {}) {
  backendReady = false;
  csrfToken = null;
  currentUser = null;
  document.body.classList.add('auth-pending');
  document.getElementById('authGate').classList.remove('hidden');
  document.getElementById('setupForm').classList.toggle('hidden', !setupRequired);
  document.getElementById('loginForm').classList.toggle('hidden', setupRequired);
  resetMfaLoginField();
  document.getElementById('authTitle').textContent = setupRequired
    ? '建立張經理主人帳號'
    : '歡迎回到莎莎保險助理工作台';
  document.getElementById('authDescription').textContent = setupRequired
    ? '這是第一次啟動。請先建立唯一的主人帳號，完成後才會開放客戶與保單資料。'
    : '請先安全登入，再繼續使用客戶、保單與團隊資料。';
  setAuthMessage(message);
}

function applyAuthenticatedUser(result) {
  csrfToken = result.csrfToken;
  currentUser = result.user;
  const profile = document.querySelector('.profile');
  const roleNames = {
    owner: '工作台主人',
    manager: '管理者',
    advisor: '保險顧問',
    viewer: '唯讀成員'
  };
  if (profile && currentUser) {
    const avatar = profile.querySelector('.avatar');
    const name = profile.querySelector('strong');
    const role = profile.querySelector('span');
    if (avatar) avatar.textContent = currentUser.displayName.slice(0, 1);
    if (name) name.textContent = currentUser.displayName;
    if (role) role.textContent = roleNames[currentUser.role] || currentUser.role;
  }
  const accountPanel = document.getElementById('accountManagementPanel');
  const accountCreateButton = document.getElementById('openAccountModal');
  const canViewAccounts = ['owner', 'manager'].includes(currentUser?.role);
  const canManageTeam = ['owner', 'manager'].includes(currentUser?.role);
  if (accountPanel) accountPanel.classList.toggle('hidden', !canViewAccounts);
  if (accountCreateButton) accountCreateButton.classList.toggle('hidden', currentUser?.role !== 'owner');
  ['openMemberModal', 'editTeamGoal', 'addTeamTask'].forEach((id) => {
    document.getElementById(id)?.classList.toggle('hidden', !canManageTeam);
  });
  document.getElementById('openCustomerModal')?.classList.toggle(
    'hidden',
    currentUser?.role === 'viewer'
  );
  document.getElementById('openCustomerImport')?.classList.toggle(
    'hidden',
    !['owner', 'manager'].includes(currentUser?.role)
  );
  setAuthMessage('');
}

function revealAuthenticatedApplication() {
  document.getElementById('authGate').classList.add('hidden');
  document.body.classList.remove('auth-pending');
}

async function apiFetch(url, options = {}) {
  const method = String(options.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || {});
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrfToken) {
    headers.set('X-CSRF-Token', csrfToken);
  }
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    headers
  });
  if (response.status === 401) {
    showAuthenticationGate({ message: '登入已逾時，請重新登入。' });
  }
  return response;
}

async function submitAuthenticationForm(path, form) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  setAuthMessage('');
  try {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(form)))
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 428 && result.error === 'MFA_REQUIRED') {
        const field = document.getElementById('mfaLoginField');
        const input = field.querySelector('input');
        field.classList.remove('hidden');
        input.disabled = false;
        input.focus();
        setAuthMessage('此帳號已啟用 MFA，請輸入驗證器代碼或一次性復原碼。');
        return;
      }
      const messages = {
        ACCOUNT_TEMPORARILY_LOCKED: '登入失敗次數過多，帳號已暫時鎖定 15 分鐘。',
        INVALID_CREDENTIALS: '帳號或密碼不正確。',
        INVALID_MFA_CODE: '驗證碼或復原碼不正確，請重新確認。',
        SETUP_ALREADY_COMPLETED: '主人帳號已建立，請改用登入。',
        FIRST_SETUP_REQUIRES_LOCAL_ACCESS: '首次建立帳號必須在這台電腦上進行。'
      };
      setAuthMessage(result.details?.join('；') || messages[result.error] || '無法完成驗證，請稍後再試。');
      return;
    }
    applyAuthenticatedUser(result);
    prepareLocalOrganization(result.user.organizationId);
    form.reset();
    resetMfaLoginField();
    await initializeBackendSync();
    await loadOrganizationUsers();
    revealAuthenticatedApplication();
  } catch (error) {
    console.warn('Authentication service unavailable.', error);
    setAuthMessage('無法連接安全登入服務，請確認工作台伺服器已啟動。');
  } finally {
    button.disabled = false;
  }
}

function resetMfaLoginField() {
  const field = document.getElementById('mfaLoginField');
  const input = field?.querySelector('input');
  field?.classList.add('hidden');
  if (input) {
    input.value = '';
    input.disabled = true;
  }
}

async function initializeAuthentication() {
  if (!window.location.protocol.startsWith('http')) {
    showAuthenticationGate({ message: '正式版必須透過工作台伺服器開啟，不能直接點開 HTML 檔案。' });
    return;
  }
  try {
    const response = await fetch('/api/auth/status', {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' }
    });
    const result = await response.json();
    if (result.authenticated) {
      applyAuthenticatedUser(result);
      prepareLocalOrganization(result.user.organizationId);
      await initializeBackendSync();
      await loadOrganizationUsers();
      revealAuthenticatedApplication();
      return;
    }
    showAuthenticationGate({ setupRequired: result.setupRequired });
  } catch (error) {
    console.warn('Authentication status unavailable.', error);
    showAuthenticationGate({ message: '無法連接安全登入服務，請確認工作台伺服器已啟動。' });
  }
}

function clearSensitiveLocalData() {
  [
    'sasha-customers',
    'sasha-policies',
    'sasha-events',
    'sasha-team-members',
    'sasha-team-tasks',
    'sasha-team-goal',
    'sasha-event-outbox',
    'sasha-local-state-dirty',
    'sasha-backend-revision',
    'sasha-active-organization'
  ].forEach((key) => {
    removeStorage(localStorage, key);
    removeStorage(sessionStorage, key);
  });
  removeStorage(sessionStorage, reviewStorageKey);
}

document.getElementById('setupForm').addEventListener('submit', (event) => {
  event.preventDefault();
  submitAuthenticationForm('/api/auth/setup', event.currentTarget);
});

document.getElementById('loginForm').addEventListener('submit', (event) => {
  event.preventDefault();
  submitAuthenticationForm('/api/auth/login', event.currentTarget);
});

document.getElementById('logoutButton').addEventListener('click', async () => {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' });
  } finally {
    clearSensitiveLocalData();
    window.location.reload();
  }
});

const defaultEvents = [
  { id: 1, title: '王先生家庭保障檢視', date: todayISO, time: '10:00', category: 'meeting', detail: '台北信義・客戶會談', note: '確認家庭責任與醫療保障缺口' },
  { id: 2, title: '陳美玲醫療險續保', date: todayISO, time: '14:30', category: 'renewal', detail: '電話聯繫', note: '確認續保資料' },
  { id: 3, title: '團隊策略會議', date: todayISO, time: '16:30', category: 'team', detail: '第二會議室', note: '本月進度與下週活動' },
  { id: 4, title: '張家豪新生兒規劃', date: addDays(appToday, 2), time: '11:00', category: 'meeting', detail: '線上會議', note: '' },
  { id: 5, title: '李雅雯生日關懷', date: addDays(appToday, 6), time: '09:00', category: 'care', detail: '傳送祝福與關懷', note: '' },
  { id: 6, title: '林先生車險續保', date: addDays(appToday, 11), time: '15:00', category: 'renewal', detail: '電話聯繫', note: '' },
  { id: 7, title: '新人陪訪訓練', date: addDays(appToday, 14), time: '13:30', category: 'team', detail: '台北辦公室', note: '' }
];

let events = loadCollection('sasha-events', 'obsidian-events', defaultEvents, normalizeEvent);
let calendarDate = new Date(appToday.getFullYear(), appToday.getMonth(), 1);
const categoryNames = { meeting: '客戶會談', renewal: '續保提醒', care: '客戶關懷', team: '團隊事項' };
const eventStatusNames = { scheduled: '待進行', completed: '已完成', cancelled: '已取消' };

function saveEvents({ sync = true } = {}) {
  if (sync && backendReady) scheduleBackendSync();
  return backendReady;
}

function getVisibleCategories() {
  return [...document.querySelectorAll('[data-calendar-filter]:checked')].map((input) => input.dataset.calendarFilter);
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  document.getElementById('calendarMonthTitle').textContent = `${year} 年 ${month + 1} 月`;
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const grid = document.getElementById('calendarGrid');
  const visibleCategories = getVisibleCategories();
  grid.innerHTML = '';

  for (let index = 0; index < 42; index += 1) {
    let day;
    let cellMonth = month;
    let cellYear = year;
    let otherMonth = false;

    if (index < firstDay) {
      day = daysInPrevMonth - firstDay + index + 1;
      cellMonth -= 1;
      otherMonth = true;
    } else if (index >= firstDay + daysInMonth) {
      day = index - firstDay - daysInMonth + 1;
      cellMonth += 1;
      otherMonth = true;
    } else {
      day = index - firstDay + 1;
    }

    if (cellMonth < 0) { cellMonth = 11; cellYear -= 1; }
    if (cellMonth > 11) { cellMonth = 0; cellYear += 1; }
    const dateString = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.className = `calendar-day${otherMonth ? ' other-month' : ''}${dateString === todayISO ? ' today' : ''}`;
    cell.dataset.date = dateString;
    cell.tabIndex = 0;
    cell.setAttribute('role', 'button');
    cell.setAttribute('aria-label', `${cellYear} 年 ${cellMonth + 1} 月 ${day} 日，新增行程`);
    cell.innerHTML = `<span class="day-number">${day}</span>`;

    events
      .filter((event) => event.date === dateString && visibleCategories.includes(event.category))
      .sort((a, b) => a.time.localeCompare(b.time))
      .slice(0, 3)
      .forEach((event) => {
        const eventButton = document.createElement('button');
        eventButton.className = `calendar-event ${event.category} ${event.status}`;
        eventButton.title = `${event.time} ${event.title}・${eventStatusNames[event.status]}`;
        eventButton.textContent = `${event.time} ${event.title}`;
        eventButton.addEventListener('click', (clickEvent) => {
          clickEvent.stopPropagation();
          openEventModal({ eventId: event.id });
        });
        cell.appendChild(eventButton);
      });

    cell.addEventListener('click', () => openEventModal({ date: dateString }));
    cell.addEventListener('keydown', (keyboardEvent) => {
      if (keyboardEvent.key !== 'Enter' && keyboardEvent.key !== ' ') return;
      keyboardEvent.preventDefault();
      openEventModal({ date: dateString });
    });
    grid.appendChild(cell);
  }
}

function renderTodayTimeline() {
  const todayEvents = events
    .filter((event) => event.date === todayISO)
    .sort((a, b) => a.time.localeCompare(b.time));
  const timeline = document.getElementById('dashboardTimeline');
  timeline.innerHTML = todayEvents.length
    ? todayEvents.map((event) => {
      const [hour, minute] = event.time.split(':');
      const numericHour = Number(hour);
      const period = numericHour >= 12 ? '下午' : '上午';
      const displayHour = numericHour > 12 ? numericHour - 12 : numericHour;
      return `<button class="timeline-item timeline-event-button ${event.status}" data-edit-event="${escapeHTML(event.id)}">
        <div class="timeline-time"><strong>${displayHour}:${minute}</strong><span>${period}</span></div>
        <div class="timeline-axis"><span class="timeline-dot ${event.category}"></span></div>
        <div class="timeline-copy"><strong>${escapeHTML(event.title)}</strong><span>${icons.location}${escapeHTML(event.detail || categoryNames[event.category])}・${escapeHTML(eventStatusNames[event.status])}</span></div>
      </button>`;
    }).join('')
    : '<p class="empty-message">今天尚無行程。</p>';
  const pendingCount = todayEvents.filter((event) => event.status === 'scheduled').length;
  document.getElementById('todayEventCount').textContent = pendingCount;
  document.getElementById('metricTodayEvents').textContent = pendingCount;
  timeline.querySelectorAll('[data-edit-event]').forEach((button) => {
    button.addEventListener('click', () => openEventModal({ eventId: button.dataset.editEvent }));
  });
  updateReviewIndicators();
}

document.getElementById('prevMonth').addEventListener('click', () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  renderCalendar();
});
document.getElementById('nextMonth').addEventListener('click', () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
  renderCalendar();
});
document.getElementById('todayButton').addEventListener('click', () => {
  calendarDate = new Date(appToday.getFullYear(), appToday.getMonth(), 1);
  renderCalendar();
});
document.querySelectorAll('[data-calendar-filter]').forEach((input) => input.addEventListener('change', renderCalendar));

const eventModal = document.getElementById('eventModal');
const eventForm = document.getElementById('eventForm');
const deleteEventButton = document.getElementById('deleteEvent');

function openEventModal(prefill = {}) {
  eventForm.reset();
  refreshCustomerRelationshipOptions();
  const existingEvent = prefill.eventId
    ? events.find((item) => idsMatch(item.id, prefill.eventId))
    : null;
  const values = existingEvent || prefill;
  document.getElementById('eventModalTitle').textContent = existingEvent ? '編輯行程' : '新增行程';
  document.getElementById('eventId').value = existingEvent?.id || '';
  document.getElementById('eventVersion').value = existingEvent?.version || '';
  document.getElementById('eventDate').value = values.date || todayISO;
  document.getElementById('eventTime').value = values.time || '10:00';
  document.getElementById('eventTitle').value = values.title || '';
  document.getElementById('eventCategory').value = values.category || 'meeting';
  document.getElementById('eventCustomerSelect').value = values.customerId ? String(values.customerId) : '';
  document.getElementById('eventStatus').value = values.status || 'scheduled';
  eventForm.elements.reminder.value = values.reminder || '15 分鐘前';
  eventForm.elements.detail.value = values.detail || '';
  eventForm.elements.note.value = values.note || '';
  deleteEventButton.classList.toggle('hidden', !existingEvent);
  eventModal.classList.add('open');
  eventModal.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => document.getElementById('eventTitle').focus(), 100);
}

function closeEventModal() {
  eventModal.classList.remove('open');
  eventModal.setAttribute('aria-hidden', 'true');
}

document.querySelectorAll('[data-open-event]').forEach((button) => button.addEventListener('click', () => openEventModal()));
document.querySelectorAll('[data-close-modal]').forEach((button) => button.addEventListener('click', closeEventModal));
eventModal.addEventListener('click', (event) => { if (event.target === eventModal) closeEventModal(); });
document.querySelectorAll('.quick-template').forEach((button) => {
  button.addEventListener('click', () => {
    const templateMap = {
      '客戶會談': { title: '客戶保障檢視', category: 'meeting' },
      '續保提醒': { title: '客戶續保提醒', category: 'renewal' },
      '生日關懷': { title: '客戶生日關懷', category: 'care', time: '09:00' },
      '團隊會議': { title: '團隊會議', category: 'team' }
    };
    openEventModal(templateMap[button.dataset.template]);
  });
});

eventForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveEventForm().catch((error) => {
    console.error('Unable to save event.', error);
    showToast('行程暫時無法儲存，請稍後再試');
  });
});

deleteEventButton.addEventListener('click', () => {
  deleteCurrentEvent().catch((error) => {
    console.error('Unable to delete event.', error);
    showToast('行程暫時無法刪除，請稍後再試');
  });
});

const defaultPolicies = [
  { customer: '陳美玲', company: '國泰人壽', type: '醫療險', coverage: '住院 3,000／日', premium: '36,800', updated: '2026/06/09' },
  { customer: '張家豪', company: '富邦人壽', type: '終身壽險', coverage: '3,000,000', premium: '52,400', updated: '2026/06/06' },
  { customer: '李雅雯', company: '南山人壽', type: '重大傷病險', coverage: '1,000,000', premium: '28,600', updated: '2026/06/03' }
];
let savedPolicies = loadCollection('sasha-policies', 'obsidian-policies', defaultPolicies, normalizePolicy);

function savePolicies({ sync = true } = {}) {
  if (sync && backendReady) scheduleBackendSync();
  return backendReady;
}

function renderPolicies() {
  const body = document.getElementById('policyTableBody');
  body.innerHTML = savedPolicies.map((policy) => {
    const customerName = getCustomerName(policy.customerId) || policy.customer || '未指定客戶';
    return `<tr>
      <td><span class="table-client"><span class="mini-avatar">${escapeHTML(customerName.slice(0, 1))}</span>${escapeHTML(customerName)}</span></td>
      <td>${escapeHTML(policy.company)}</td><td>${escapeHTML(policy.type)}</td><td>${escapeHTML(policy.coverage)}</td><td>NT$ ${escapeHTML(policy.premium)}</td><td>${escapeHTML(policy.updated)}</td>
    </tr>`;
  }).join('');
  document.getElementById('policyCountLabel').textContent = `${savedPolicies.length} 份資料`;
}

const policyFile = document.getElementById('policyFile');
const dropZone = document.getElementById('dropZone');
let scanTimer;
let currentPolicyAttachment = null;
let currentOcrJob = null;
let ocrPollTimer = null;

async function uploadPolicyAttachment(file) {
  if (!backendReady) throw new Error('DATABASE_UNAVAILABLE');
  const customerId = document.getElementById('policyCustomerSelect').value;
  const headers = {
    'Content-Type': 'application/octet-stream',
    'X-File-Name': encodeURIComponent(file.name || 'policy-image')
  };
  if (customerId) headers['X-Customer-Id'] = encodeURIComponent(customerId);
  const response = await apiFetch('/api/attachments', {
    method: 'POST',
    headers,
    body: file
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 202) {
    const messages = {
      ATTACHMENT_TOO_LARGE: '圖片超過安全上傳限制',
      UNSUPPORTED_ATTACHMENT_TYPE: '檔案內容不是支援的 JPG、PNG 或 WebP 圖片',
      ATTACHMENT_SCOPE_DENIED: '這份附件不能連結到目前選擇的客戶'
    };
    throw new Error(messages[result.error] || '圖片安全上傳失敗');
  }
  return result.item;
}

async function handlePolicyFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    showToast('請選擇 JPG、PNG 或 WebP 圖片');
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('圖片超過 10 MB，請先縮小後再上傳');
    return;
  }
  if (!document.getElementById('policyCustomerSelect').value) {
    showToast('請先選擇這份保單所屬的客戶');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('policyPreview').src = reader.result;
    document.getElementById('emptyScan').classList.add('hidden');
    document.getElementById('scanContent').classList.remove('hidden');
    document.getElementById('resultPanel').classList.add('hidden');
  };
  reader.readAsDataURL(file);
  const status = document.getElementById('scanStatusText');
  const hint = document.getElementById('scanHint');
  status.textContent = '正在進行安全上傳';
  hint.textContent = '檢查真實檔案格式、移除圖片中繼資料並執行惡意程式掃描…';
  try {
    currentPolicyAttachment = await uploadPolicyAttachment(file);
  } catch (error) {
    currentPolicyAttachment = null;
    status.textContent = '安全上傳失敗';
    hint.textContent = error.message === 'DATABASE_UNAVAILABLE'
      ? '目前無法連接正式資料庫，檔案沒有保存在瀏覽器中。'
      : error.message;
    showToast(hint.textContent);
    return;
  }
  if (currentPolicyAttachment.status !== 'clean') {
    status.textContent = currentPolicyAttachment.status === 'infected'
      ? '檔案未通過安全掃描'
      : '檔案已進入安全隔離區';
    hint.textContent = currentPolicyAttachment.status === 'infected'
      ? '系統已阻止這個檔案進入辨識流程。'
      : '病毒掃描服務尚未完成，掃描通過前不會進行 OCR 或提供下載。';
    showToast(hint.textContent);
    return;
  }
  await startScan();
}

function updateOcrProgress(value, statusText, hintText) {
  document.getElementById('scanProgress').style.width = `${value}%`;
  document.getElementById('scanPercent').textContent = `${value}%`;
  document.getElementById('scanStatusText').textContent = statusText;
  document.getElementById('scanHint').textContent = hintText;
}

function renderOcrJob(job) {
  currentOcrJob = job;
  const fieldByName = new Map(job.fields.map((field) => [field.name, field]));
  for (const name of [
    'company',
    'policyNumber',
    'type',
    'startDate',
    'paymentYears',
    'coverage',
    'premium',
    'summary'
  ]) {
    const control = document.getElementById('policyForm').elements[name];
    const field = fieldByName.get(name);
    if (!control || !field) continue;
    control.value = field.value;
    control.dataset.ocrFieldId = field.id;
    control.dataset.ocrVersion = field.version;
    control.dataset.ocrOriginal = field.value;
    control.classList.toggle('ocr-corrected', field.corrected);
    const label = control.closest('label');
    label?.querySelector('.ocr-field-confidence')?.remove();
    const confidence = document.createElement('span');
    confidence.className = `ocr-field-confidence${field.confidence < 0.85 ? ' low' : ''}`;
    confidence.textContent = `可信度 ${Math.round(field.confidence * 100)}%${field.corrected ? '・已人工修正' : ''}`;
    label?.append(confidence);
  }
  const average = job.fields.length
    ? Math.round(job.fields.reduce((total, field) => total + field.confidence, 0) / job.fields.length * 100)
    : 0;
  document.getElementById('ocrJobId').value = job.id;
  document.getElementById('ocrConfidence').textContent = `${average}%`;
  document.getElementById('ocrProviderChip').textContent = `辨識服務：${job.provider}`;
  document.getElementById('resultPanel').classList.remove('hidden');
  document.getElementById('resultPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function pollOcrJob(jobId) {
  window.clearTimeout(ocrPollTimer);
  const response = await apiFetch(`/api/v1/ocr/jobs/${encodeURIComponent(jobId)}`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'OCR_STATUS_UNAVAILABLE');
  const job = result.item;
  currentOcrJob = job;
  if (job.status === 'queued') {
    updateOcrProgress(25, '等待辨識服務', '圖片已安全保存，正在安排辨識工作…');
  } else if (job.status === 'processing') {
    updateOcrProgress(68, '正在辨識保單欄位', '讀取保險公司、保單號碼與保障內容…');
  } else if (job.status === 'review_required') {
    document.getElementById('scanLine').classList.remove('scanning');
    updateOcrProgress(100, '辨識完成，等待人工核對', '請逐欄確認；修改過的內容會留下修正紀錄。');
    renderOcrJob(job);
    return;
  } else if (job.status === 'failed') {
    document.getElementById('scanLine').classList.remove('scanning');
    updateOcrProgress(100, '辨識失敗', `辨識服務回報：${job.errorCode || '未知錯誤'}`);
    showToast('保單辨識未完成，請確認服務設定後重新上傳');
    return;
  } else if (job.status === 'approved') {
    return;
  }
  ocrPollTimer = window.setTimeout(() => {
    pollOcrJob(jobId).catch((error) => {
      console.error('OCR status polling failed.', error);
      showToast('暫時無法取得辨識進度');
    });
  }, 700);
}

async function startScan() {
  window.clearInterval(scanTimer);
  window.clearTimeout(ocrPollTimer);
  const scanLine = document.getElementById('scanLine');
  scanLine.classList.add('scanning');
  updateOcrProgress(12, '正在建立辨識工作', '圖片已通過安全掃描，正在送入辨識流程…');
  const response = await apiFetch('/api/v1/ocr/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachmentId: currentPolicyAttachment.id,
      customerId: document.getElementById('policyCustomerSelect').value
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    scanLine.classList.remove('scanning');
    throw new Error(result.error || 'OCR_JOB_CREATE_FAILED');
  }
  currentOcrJob = result.item;
  await pollOcrJob(result.item.id);
}

policyFile.addEventListener('change', () => {
  handlePolicyFile(policyFile.files[0]).catch((error) => {
    console.error('Policy attachment upload failed.', error);
    showToast('圖片安全上傳失敗');
  });
});
['dragenter', 'dragover'].forEach((name) => dropZone.addEventListener(name, (event) => {
  event.preventDefault();
  dropZone.classList.add('dragging');
}));
['dragleave', 'drop'].forEach((name) => dropZone.addEventListener(name, (event) => {
  event.preventDefault();
  dropZone.classList.remove('dragging');
}));
dropZone.addEventListener('drop', (event) => {
  handlePolicyFile(event.dataTransfer.files[0]).catch((error) => {
    console.error('Policy attachment upload failed.', error);
    showToast('圖片安全上傳失敗');
  });
});

function resetPolicyUpload() {
  window.clearInterval(scanTimer);
  window.clearTimeout(ocrPollTimer);
  currentPolicyAttachment = null;
  currentOcrJob = null;
  policyFile.value = '';
  document.getElementById('ocrJobId').value = '';
  document.getElementById('ocrConfidence').textContent = '--';
  document.querySelectorAll('.ocr-field-confidence').forEach((item) => item.remove());
  document.querySelectorAll('#policyForm [data-ocr-field-id]').forEach((control) => {
    delete control.dataset.ocrFieldId;
    delete control.dataset.ocrVersion;
    delete control.dataset.ocrOriginal;
    control.classList.remove('ocr-corrected');
  });
  document.getElementById('emptyScan').classList.remove('hidden');
  document.getElementById('scanContent').classList.add('hidden');
  document.getElementById('resultPanel').classList.add('hidden');
}
document.getElementById('resetPolicy').addEventListener('click', resetPolicyUpload);

document.getElementById('policyForm').addEventListener('submit', (event) => {
  event.preventDefault();
  savePolicyForm(event.currentTarget).catch((error) => {
    console.error('Unable to save policy.', error);
    showToast('保單暫時無法儲存，請稍後再試');
  });
});

document.querySelectorAll('[data-insight-tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('[data-insight-tab]').forEach((item) => item.classList.toggle('active', item === tab));
    document.querySelectorAll('[data-insight-content]').forEach((content) => content.classList.toggle('active', content.dataset.insightContent === tab.dataset.insightTab));
  });
});

document.getElementById('refreshInsights').addEventListener('click', (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.innerHTML = `${icons.refresh} 正在整理來源…`;
  window.setTimeout(() => {
    button.disabled = false;
    button.innerHTML = `${icons.sparkle} 立即更新`;
    showToast('目前仍為本機資料，尚未連接正式情報來源服務');
  }, 700);
});

document.addEventListener('click', (event) => {
  const sourceButton = event.target.closest('[data-open-source]');
  if (!sourceButton) return;
  const safeUrl = safeExternalUrl(sourceButton.dataset.openSource);
  if (!safeUrl) {
    showToast('這個來源網址未通過安全檢查');
    return;
  }
  window.open(safeUrl, '_blank', 'noopener,noreferrer');
});

const products = [
  { id: 1, company: '國泰人壽', logo: '國', name: '實支實付醫療保障示範', type: '醫療險', features: ['住院與門診手術保障', '依條款限額內核實給付', '可搭配自負額規劃'], age: '0–65 歲', term: '一年期', updated: '2026/06/08' },
  { id: 2, company: '富邦人壽', logo: '富', name: '重大傷病定期保障示範', type: '重大傷病險', features: ['符合重大傷病資格一次給付', '涵蓋多項重大疾病風險', '適合家庭責任期配置'], age: '15–60 歲', term: '20 年期', updated: '2026/06/08' },
  { id: 3, company: '南山人壽', logo: '南', name: '終身壽險保障示範', type: '壽險', features: ['終身身故保障', '可搭配多元附約', '適合長期家庭責任規劃'], age: '0–70 歲', term: '終身', updated: '2026/06/07' },
  { id: 4, company: '新光人壽', logo: '新', name: '意外傷害保障示範', type: '意外險', features: ['意外身故與失能保障', '特定事故增額設計', '可依職業等級評估'], age: '15–65 歲', term: '一年期', updated: '2026/06/06' },
  { id: 5, company: '台灣人壽', logo: '台', name: '住院日額醫療示範', type: '醫療險', features: ['住院期間按日給付', '加護病房額外保障', '保費預算容易掌握'], age: '0–60 歲', term: '定期', updated: '2026/06/05' },
  { id: 6, company: '全球人壽', logo: '全', name: '退休年金規劃示範', type: '年金險', features: ['退休現金流規劃', '年金給付期間可選', '適合長期資金準備'], age: '20–70 歲', term: '年金', updated: '2026/06/04' }
];
const selectedProducts = new Set();

function renderProducts() {
  const search = document.getElementById('productSearch').value.trim().toLowerCase();
  const type = document.getElementById('productTypeFilter').value;
  const company = document.getElementById('productCompanyFilter').value;
  const filtered = products.filter((product) =>
    (type === 'all' || product.type === type) &&
    (company === 'all' || product.company === company) &&
    (!search || `${product.company}${product.name}${product.features.join('')}`.toLowerCase().includes(search))
  );
  document.getElementById('productResultCount').textContent = filtered.length;
  document.getElementById('productGrid').innerHTML = filtered.map((product) => `<article class="product-card panel">
    <div class="product-card-head">
      <div class="company-line"><span class="company-logo">${escapeHTML(product.logo)}</span><strong>${escapeHTML(product.company)}</strong></div>
      <label class="compare-check"><input type="checkbox" data-product-select="${product.id}" ${selectedProducts.has(product.id) ? 'checked' : ''}> 加入比較</label>
      <h3>${escapeHTML(product.name)}</h3><span class="product-type">${escapeHTML(product.type)}</span>
    </div>
    <div class="product-body">
      <ul class="feature-list">${product.features.map((feature) => `<li>${icons.check}<span>${escapeHTML(feature)}</span></li>`).join('')}</ul>
      <div class="product-data"><div><span>投保年齡</span><strong>${escapeHTML(product.age)}</strong></div><div><span>保障期間</span><strong>${escapeHTML(product.term)}</strong></div></div>
      <div class="product-card-footer"><span>更新 ${escapeHTML(product.updated)}</span><button data-product-detail="${product.id}">查看整理 →</button></div>
    </div>
  </article>`).join('');

  document.querySelectorAll('[data-product-select]').forEach((checkbox) => {
    checkbox.addEventListener('change', () => {
      const id = Number(checkbox.dataset.productSelect);
      if (checkbox.checked) selectedProducts.add(id); else selectedProducts.delete(id);
      document.getElementById('compareCount').textContent = selectedProducts.size;
    });
  });
  document.querySelectorAll('[data-product-detail]').forEach((button) => button.addEventListener('click', () => {
    const product = products.find((item) => item.id === Number(button.dataset.productDetail));
    showToast(`${product.company}・${product.name}：此為欄位結構示範，請查閱官方條款`);
  }));
}

['productSearch', 'productTypeFilter', 'productCompanyFilter'].forEach((id) => {
  document.getElementById(id).addEventListener(id === 'productSearch' ? 'input' : 'change', renderProducts);
});
document.getElementById('resetProductFilters').addEventListener('click', () => {
  document.getElementById('productSearch').value = '';
  document.getElementById('productTypeFilter').value = 'all';
  document.getElementById('productCompanyFilter').value = 'all';
  renderProducts();
});

const defaultTeamMembers = [
  { id: 1, name: '張經理', role: '團隊經理', specialty: '團隊經營', target: 12, closed: 9, owner: true },
  { id: 2, name: '陳怡君', role: '業務主任', specialty: '家庭保障', target: 10, closed: 8 },
  { id: 3, name: '王志明', role: '資深顧問', specialty: '退休規劃', target: 9, closed: 6 },
  { id: 4, name: '林雅婷', role: '保險顧問', specialty: '醫療保障', target: 8, closed: 5 },
  { id: 5, name: '周品妤', role: '新人顧問', specialty: '客戶開發', target: 5, closed: 2 }
];
const defaultTeamTasks = [
  { id: 1, title: '完成本月高保障缺口客戶名單', owner: '陳怡君', due: '6/14', done: false },
  { id: 2, title: '整理醫療險案例研討資料', owner: '王志明', due: '6/12', done: true },
  { id: 3, title: '安排新人聯合陪訪名單', owner: '張經理', due: '6/16', done: false },
  { id: 4, title: '回顧本月續保客戶進度', owner: '全體成員', due: '6/20', done: false }
];
let teamMembers = loadCollection('sasha-team-members', null, defaultTeamMembers);
let teamTasks = loadCollection('sasha-team-tasks', null, defaultTeamTasks);
let customTeamGoal = 0;

function saveTeamData() {
  if (backendReady) {
    scheduleBackendSync();
    return true;
  }
  showToast('目前無法連接正式資料庫，這次團隊變更尚未儲存');
  return false;
}

function renderTeam() {
  const canManageTeam = ['owner', 'manager'].includes(currentUser?.role);
  const closed = teamMembers.reduce((total, member) => total + Number(member.closed || 0), 0);
  const memberTargets = teamMembers.reduce((total, member) => total + Number(member.target || 0), 0);
  const target = customTeamGoal || memberTargets;
  const percent = target ? Math.min(Math.round((closed / target) * 100), 100) : 0;
  const pending = teamTasks.filter((task) => !task.done).length;

  document.getElementById('teamMemberCount').textContent = teamMembers.length;
  document.getElementById('activeMemberLabel').textContent = `${teamMembers.length} 位成員`;
  document.getElementById('teamAchievementRate').textContent = `${percent}%`;
  document.getElementById('teamAchievementNote').textContent = percent >= 80 ? '距離目標很接近' : '持續穩定推進';
  document.getElementById('teamClosedCount').textContent = closed;
  document.getElementById('teamTargetNote').textContent = `團隊目標 ${target} 件`;
  document.getElementById('teamPendingCount').textContent = pending;
  document.getElementById('teamGoalPercent').textContent = `${percent}%`;
  document.getElementById('teamGoalCurrent').textContent = `${closed} 件`;
  document.getElementById('teamGoalTarget').textContent = `${target} 件`;
  document.getElementById('teamGoalRing').style.setProperty('--team-progress', percent);
  document.getElementById('teamEncouragement').textContent = percent >= 100
    ? '本月共同目標已達成，別忘了肯定每一位夥伴的努力。'
    : `距離目標還有 ${Math.max(target - closed, 0)} 件，聚焦高優先客戶並保持服務品質。`;

  document.getElementById('teamMemberList').innerHTML = teamMembers.length
    ? teamMembers.map((member) => {
      const memberClosed = Number(member.closed || 0);
      const memberTarget = Number(member.target || 0);
      const memberPercent = memberTarget ? Math.min(Math.round((memberClosed / memberTarget) * 100), 100) : 0;
      return `<div class="team-member-row">
        <span class="member-avatar">${escapeHTML(member.name.slice(0, 1))}</span>
        <span class="member-identity"><strong>${escapeHTML(member.name)}</strong><span>${escapeHTML(member.role)}</span></span>
        <span class="member-progress">
          <span class="member-progress-head"><span>本月進度</span><strong>${memberClosed} / ${memberTarget} 件・${memberPercent}%</strong></span>
          <span class="member-progress-track"><span style="width:${memberPercent}%"></span></span>
        </span>
        <span class="member-specialty">${escapeHTML(member.specialty || '一般保障')}</span>
        ${member.owner || !canManageTeam ? '<span></span>' : `<button class="icon-button small member-remove" data-remove-member="${escapeHTML(member.id)}" aria-label="移除 ${escapeHTML(member.name)}" data-icon="close">${icons.close}</button>`}
      </div>`;
    }).join('')
    : '<div class="empty-team-state">尚未建立團隊成員。</div>';

  document.getElementById('teamTaskList').innerHTML = teamTasks.length
    ? teamTasks.map((task) => `<div class="team-task${task.done ? ' done' : ''}">
      <button class="team-task-check" data-toggle-task="${escapeHTML(task.id)}" aria-label="${task.done ? '標記為未完成' : '標記完成'}" ${canManageTeam ? '' : 'disabled'}>${icons.check}</button>
      <span class="team-task-copy"><strong>${escapeHTML(task.title)}</strong><small>負責：${escapeHTML(task.owner)}</small></span>
      <span class="task-due">${escapeHTML(task.due)}</span>
    </div>`).join('')
    : '<div class="empty-team-state">目前沒有團隊任務。</div>';

  document.querySelectorAll('[data-toggle-task]').forEach((button) => {
    button.addEventListener('click', () => {
      const task = teamTasks.find((item) => idsMatch(item.id, button.dataset.toggleTask));
      if (!task) return;
      task.done = !task.done;
      saveTeamData();
      renderTeam();
      showToast(task.done ? `已完成「${task.title}」` : `已將「${task.title}」恢復為待辦`);
    });
  });

  document.querySelectorAll('[data-remove-member]').forEach((button) => {
    button.addEventListener('click', () => {
      const member = teamMembers.find((item) => idsMatch(item.id, button.dataset.removeMember));
      if (!member) return;
      const assignedCustomerCount = customers.filter((customer) => customer.owner === member.name).length;
      const assignedTaskCount = teamTasks.filter((task) => task.owner === member.name).length;
      if (assignedCustomerCount || assignedTaskCount) {
        showToast(`${member.name} 仍負責 ${assignedCustomerCount} 位客戶與 ${assignedTaskCount} 項任務，請先完成轉派`);
        return;
      }
      if (!window.confirm(`確定要將 ${member.name} 移出團隊嗎？`)) return;
      teamMembers = teamMembers.filter((item) => item.id !== member.id);
      saveTeamData();
      renderTeam();
      showToast(`${member.name} 已移出團隊`);
    });
  });

  refreshCustomerOwnerOptions();
}

const memberModal = document.getElementById('memberModal');
const memberForm = document.getElementById('memberForm');

function openMemberModal() {
  memberForm.reset();
  memberModal.classList.add('open');
  memberModal.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => memberForm.elements.name.focus(), 100);
}

function closeMemberModal() {
  memberModal.classList.remove('open');
  memberModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('openMemberModal').addEventListener('click', openMemberModal);
document.querySelectorAll('[data-close-member]').forEach((button) => button.addEventListener('click', closeMemberModal));
memberModal.addEventListener('click', (event) => { if (event.target === memberModal) closeMemberModal(); });
memberForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(memberForm));
  teamMembers.push({
    id: Date.now(),
    name: data.name.trim(),
    role: data.role,
    specialty: data.specialty.trim() || '一般保障',
    target: Number(data.target),
    closed: Number(data.closed)
  });
  saveTeamData();
  renderTeam();
  closeMemberModal();
  showToast(`${data.name} 已加入團隊`);
});

let organizationUsers = [];
const accountModal = document.getElementById('accountModal');
const accountForm = document.getElementById('accountForm');
const accountRoleNames = {
  owner: '工作台主人',
  manager: '管理者',
  advisor: '保險顧問',
  viewer: '唯讀成員'
};

function renderOrganizationUsers() {
  const list = document.getElementById('accountList');
  if (!list) return;
  const canManage = currentUser?.role === 'owner';
  list.innerHTML = organizationUsers.length
    ? organizationUsers.map((user) => {
      const isOwner = user.role === 'owner';
      const roleControl = canManage && !isOwner
        ? `<select class="account-role-select" data-user-role="${escapeHTML(user.id)}">
            <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>管理者</option>
            <option value="advisor" ${user.role === 'advisor' ? 'selected' : ''}>保險顧問</option>
            <option value="viewer" ${user.role === 'viewer' ? 'selected' : ''}>唯讀成員</option>
          </select>`
        : `<span class="account-role ${isOwner ? 'owner' : ''}">${escapeHTML(accountRoleNames[user.role] || user.role)}</span>`;
      const actions = canManage && !isOwner
        ? `<span class="account-actions">
            <button class="secondary-button" data-reset-user="${escapeHTML(user.id)}">重設密碼</button>
            <button class="${user.active ? 'danger-button' : 'secondary-button'}" data-toggle-user="${escapeHTML(user.id)}">
              ${user.active ? '停用' : '啟用'}
            </button>
          </span>`
        : '<span class="account-actions"></span>';
      return `<div class="account-row">
        <span class="member-avatar">${escapeHTML(user.displayName.slice(0, 1))}</span>
        <span class="account-identity">
          <strong>${escapeHTML(user.displayName)}</strong>
          <small>${user.lastLoginAt ? `最近登入 ${escapeHTML(new Date(user.lastLoginAt).toLocaleDateString('zh-TW'))}` : '尚未登入'}</small>
        </span>
        <span class="account-username">${escapeHTML(user.username)}</span>
        ${roleControl}
        <span>
          <span class="account-status ${user.active ? '' : 'inactive'}">${user.active ? '啟用中' : '已停用'}</span>
          ${actions}
        </span>
      </div>`;
    }).join('')
    : '<div class="empty-team-state">尚未建立其他登入帳號。</div>';

  document.querySelectorAll('[data-toggle-user]').forEach((button) => {
    button.addEventListener('click', async () => {
      const user = organizationUsers.find((item) => idsMatch(item.id, button.dataset.toggleUser));
      if (!user) return;
      const action = user.active ? '停用' : '啟用';
      if (!window.confirm(`確定要${action} ${user.displayName} 的登入帳號嗎？`)) return;
      const response = await apiFetch(`/api/users/${encodeURIComponent(user.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: user.displayName,
          role: user.role,
          active: !user.active
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(result.error === 'CANNOT_CHANGE_CURRENT_OWNER'
          ? '不可停用目前登入的主人帳號。'
          : '帳號狀態更新失敗。');
        return;
      }
      await loadOrganizationUsers();
      showToast(`${user.displayName} 已${action}`);
    });
  });

  document.querySelectorAll('[data-reset-user]').forEach((button) => {
    button.addEventListener('click', async () => {
      const user = organizationUsers.find((item) => idsMatch(item.id, button.dataset.resetUser));
      if (!user) return;
      const password = window.prompt(`請為 ${user.displayName} 設定新的臨時密碼\n至少 12 個字元，包含英文大小寫與數字。`);
      if (password === null) return;
      const response = await apiFetch(`/api/users/${encodeURIComponent(user.id)}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(result.details?.[0] || '密碼重設失敗。');
        return;
      }
      showToast(`${user.displayName} 的密碼已重設，既有登入工作階段已登出。`);
    });
  });

  document.querySelectorAll('[data-user-role]').forEach((select) => {
    select.addEventListener('change', async () => {
      const user = organizationUsers.find((item) => idsMatch(item.id, select.dataset.userRole));
      if (!user) return;
      const previousRole = user.role;
      const nextRole = select.value;
      const response = await apiFetch(`/api/users/${encodeURIComponent(user.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: user.displayName,
          role: nextRole,
          active: user.active
        })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        select.value = previousRole;
        showToast(result.details?.[0] || '角色更新失敗。');
        return;
      }
      await loadOrganizationUsers();
      showToast(`${user.displayName} 已調整為${accountRoleNames[nextRole]}。`);
    });
  });
}

async function loadOrganizationUsers() {
  if (!currentUser) return;
  if (!['owner', 'manager'].includes(currentUser.role)) {
    organizationUsers = [currentUser];
    refreshCustomerOwnerOptions();
    return;
  }
  try {
    const response = await apiFetch('/api/users', { headers: { Accept: 'application/json' } });
    if (!response.ok) return;
    const result = await response.json();
    organizationUsers = asArray(result.items);
    renderOrganizationUsers();
    refreshCustomerOwnerOptions();
  } catch (error) {
    console.warn('Unable to load organization users.', error);
  }
}

function openAccountModal() {
  if (currentUser?.role !== 'owner') return;
  accountForm.reset();
  accountModal.classList.add('open');
  accountModal.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => accountForm.elements.displayName.focus(), 100);
}

function closeAccountModal() {
  accountModal.classList.remove('open');
  accountModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('openAccountModal').addEventListener('click', openAccountModal);
document.querySelectorAll('[data-close-account]').forEach((button) => {
  button.addEventListener('click', closeAccountModal);
});
accountModal.addEventListener('click', (event) => {
  if (event.target === accountModal) closeAccountModal();
});
accountForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitButton = accountForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const response = await apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(accountForm)))
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      showToast(result.error === 'USERNAME_ALREADY_EXISTS'
        ? '這個登入帳號已經有人使用。'
        : result.details?.[0] || '無法建立登入帳號。');
      return;
    }
    closeAccountModal();
    await loadOrganizationUsers();
    showToast(`${result.item.displayName} 的登入帳號已建立。`);
  } finally {
    submitButton.disabled = false;
  }
});

document.getElementById('editTeamGoal').addEventListener('click', () => {
  const currentTarget = customTeamGoal || teamMembers.reduce((total, member) => total + Number(member.target || 0), 0);
  const nextTarget = window.prompt('請輸入本月團隊目標件數：', String(currentTarget));
  if (nextTarget === null) return;
  const parsedTarget = Number(nextTarget);
  if (!Number.isInteger(parsedTarget) || parsedTarget < 1) {
    showToast('請輸入大於 0 的整數目標');
    return;
  }
  customTeamGoal = parsedTarget;
  saveTeamData();
  renderTeam();
  showToast(`本月團隊目標已調整為 ${parsedTarget} 件`);
});

document.getElementById('addTeamTask').addEventListener('click', () => {
  const title = window.prompt('請輸入團隊任務：');
  if (!title?.trim()) return;
  const owner = window.prompt('請輸入負責人：', '全體成員');
  if (owner === null) return;
  const due = window.prompt('請輸入期限，例如 6/20：', `${appToday.getMonth() + 1}/${appToday.getDate()}`);
  if (due === null) return;
  teamTasks.unshift({ id: Date.now(), title: title.trim(), owner: owner.trim() || '全體成員', due: due.trim() || '待安排', done: false });
  saveTeamData();
  renderTeam();
  showToast(`已新增團隊任務「${title.trim()}」`);
});

const birthdayInCurrentMonth = (year, day) =>
  `${year}-${String(appToday.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const defaultCustomers = [
  { id: 1, name: '王大明', phone: '0912-345-678', email: 'daming@example.com', birthday: birthdayInCurrentMonth(1982, 21), owner: '陳怡君', stage: '需求訪談', nextFollowUp: addDays(appToday, 1), policyCount: 2, needs: '家庭保障與醫療缺口', note: '下午聯繫較方便，需準備家庭責任摘要。' },
  { id: 2, name: '陳美玲', phone: '0922-567-890', email: 'meiling@example.com', birthday: '1978-09-08', owner: '王志明', stage: '持續服務', nextFollowUp: addDays(appToday, 3), policyCount: 3, needs: '醫療險續保', note: '確認續保文件與保費安排。' },
  { id: 3, name: '張家豪', phone: '0933-246-810', email: 'jiahao@example.com', birthday: birthdayInCurrentMonth(1990, 28), owner: '林雅婷', stage: '規劃中', nextFollowUp: addDays(appToday, 5), policyCount: 1, needs: '新生兒與家庭保障', note: '偏好線上會談，夫妻共同決策。' },
  { id: 4, name: '李雅雯', phone: '0955-135-790', email: 'yawen@example.com', birthday: '1985-11-16', owner: '張經理', stage: '已成交', nextFollowUp: addDays(appToday, 18), policyCount: 4, needs: '家庭責任額度調整', note: '年底前安排完整保單健檢。' },
  { id: 5, name: '林志宏', phone: '0966-802-468', email: 'zhihong@example.com', birthday: '1975-03-12', owner: '周品妤', stage: '新名單', nextFollowUp: addDays(appToday, -1), policyCount: 0, needs: '退休現金流規劃', note: '由既有客戶轉介紹，首次聯繫。' },
  { id: 6, name: '周淑芬', phone: '0977-420-135', email: 'shufen@example.com', birthday: birthdayInCurrentMonth(1968, 15), owner: '張經理', stage: '持續服務', nextFollowUp: addDays(appToday, 7), policyCount: 5, needs: '退休與傳承需求', note: '服務時需以簡明書面資料說明。' }
];
let customers = loadCollection('sasha-customers', null, defaultCustomers, normalizeCustomer);

function saveCustomers({ sync = true } = {}) {
  if (sync && backendReady) scheduleBackendSync();
  return backendReady;
}

function getCustomerName(customerId) {
  return customers.find((customer) => idsMatch(customer.id, customerId))?.name || '';
}

function getCustomerPolicyCount(customer) {
  return savedPolicies.filter((policy) =>
    idsMatch(policy.customerId, customer.id)
    || (!policy.customerId && policy.customer === customer.name)
  ).length;
}

function refreshCustomerRelationshipOptions() {
  const policySelect = document.getElementById('policyCustomerSelect');
  const eventSelect = document.getElementById('eventCustomerSelect');
  if (!policySelect || !eventSelect) return;

  const currentPolicyCustomer = policySelect.value;
  const currentEventCustomer = eventSelect.value;
  const options = customers
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'))
    .map((customer) => `<option value="${escapeHTML(customer.id)}">${escapeHTML(customer.name)}</option>`)
    .join('');

  policySelect.innerHTML = options || '<option value="">請先建立客戶</option>';
  eventSelect.innerHTML = `<option value="">不指定客戶</option>${options}`;
  if (customers.some((customer) => String(customer.id) === currentPolicyCustomer)) {
    policySelect.value = currentPolicyCustomer;
  }
  if (customers.some((customer) => String(customer.id) === currentEventCustomer)) {
    eventSelect.value = currentEventCustomer;
  }
}

function migrateLegacyRelationships() {
  let policiesChanged = false;
  let eventsChanged = false;
  let customersChanged = false;

  savedPolicies = savedPolicies.map((policy, index) => {
    if (policy.customerId) return policy;
    const customerName = policy.customer || `待確認客戶 ${index + 1}`;
    let customer = customers.find((item) => item.name === customerName);
    if (!customer) {
      customer = normalizeCustomer({
        name: customerName,
        owner: teamMembers.find((member) => member.owner)?.name || '張經理',
        stage: '持續服務',
        needs: '由既有保單資料建立，請補齊客戶資料',
        note: '系統由舊版保單資料自動建立。'
      });
      customers.push(customer);
      customersChanged = true;
    }
    policiesChanged = true;
    return normalizePolicy({ ...policy, customer: customer.name, customerId: customer.id });
  });

  events = events.map((event) => {
    if (event.customerId) return event;
    const customer = customers.find((item) =>
      event.title.includes(item.name)
      || event.detail.includes(item.name)
    );
    if (!customer) return event;
    eventsChanged = true;
    return normalizeEvent({ ...event, customerId: customer.id });
  });

  if (customersChanged) saveCustomers();
  if (policiesChanged) savePolicies();
  if (eventsChanged) saveEvents();
}

function refreshCustomerOwnerOptions() {
  const ownerFilter = document.getElementById('customerOwnerFilter');
  const ownerSelect = document.getElementById('customerOwnerSelect');
  if (!ownerFilter || !ownerSelect) return;
  const currentFilter = ownerFilter.value;
  const currentSelect = ownerSelect.value;
  const owners = [...new Set([
    ...teamMembers.map((member) => member.name),
    ...customers.map((customer) => customer.owner)
  ].filter(Boolean))].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  ownerFilter.innerHTML = `<option value="all">所有負責顧問</option>${owners.map((owner) => `<option value="${escapeHTML(owner)}">${escapeHTML(owner)}</option>`).join('')}`;
  const eligibleUsers = organizationUsers.filter((user) =>
    user.active !== false && user.role !== 'viewer'
  );
  ownerSelect.innerHTML = eligibleUsers.length
    ? eligibleUsers.map((user) => (
      `<option value="${escapeHTML(user.id)}" data-display-name="${escapeHTML(user.displayName)}">${escapeHTML(user.displayName)}</option>`
    )).join('')
    : '<option value="">尚無可指派帳號</option>';
  ownerFilter.value = owners.includes(currentFilter) ? currentFilter : 'all';
  ownerSelect.value = eligibleUsers.some((user) => idsMatch(user.id, currentSelect))
    ? currentSelect
    : (currentUser?.id || eligibleUsers[0]?.id || '');
}

function getFollowUpInfo(dateString) {
  if (!dateString) return { className: '', label: '尚未安排', detail: '待設定' };
  const followUpDate = new Date(`${dateString}T00:00:00`);
  const todayDate = new Date(`${todayISO}T00:00:00`);
  const diff = Math.round((followUpDate - todayDate) / 86400000);
  if (diff < 0) return { className: 'overdue', label: dateString.replaceAll('-', '/'), detail: `逾期 ${Math.abs(diff)} 天` };
  if (diff === 0) return { className: 'upcoming', label: dateString.replaceAll('-', '/'), detail: '今天' };
  if (diff <= 7) return { className: 'upcoming', label: dateString.replaceAll('-', '/'), detail: `${diff} 天後` };
  return { className: '', label: dateString.replaceAll('-', '/'), detail: `${diff} 天後` };
}

function renderCustomers() {
  refreshCustomerOwnerOptions();
  const search = document.getElementById('customerSearch').value.trim().toLowerCase();
  const stage = document.getElementById('customerStageFilter').value;
  const owner = document.getElementById('customerOwnerFilter').value;
  const todayDate = new Date(`${todayISO}T00:00:00`);
  const filtered = customers
    .filter((customer) =>
      (stage === 'all' || customer.stage === stage) &&
      (owner === 'all' || customer.owner === owner) &&
      (!search || `${customer.name}${customer.phone}${customer.email}${customer.needs}${customer.owner}${customer.note}`.toLowerCase().includes(search))
    )
    .sort((a, b) => (a.nextFollowUp || '9999-12-31').localeCompare(b.nextFollowUp || '9999-12-31'));

  const priorityCount = customers.filter((customer) => {
    if (!customer.nextFollowUp) return false;
    const diff = Math.round((new Date(`${customer.nextFollowUp}T00:00:00`) - todayDate) / 86400000);
    return diff <= 2;
  }).length;
  const upcomingCount = customers.filter((customer) => {
    if (!customer.nextFollowUp) return false;
    const diff = Math.round((new Date(`${customer.nextFollowUp}T00:00:00`) - todayDate) / 86400000);
    return diff >= 0 && diff <= 7;
  }).length;
  const birthdayCount = customers.filter((customer) => {
    if (!customer.birthday) return false;
    return Number(customer.birthday.slice(5, 7)) === appToday.getMonth() + 1;
  }).length;

  document.getElementById('customerTotalCount').textContent = customers.length;
  document.getElementById('customerPriorityCount').textContent = priorityCount;
  document.getElementById('customerUpcomingCount').textContent = upcomingCount;
  document.getElementById('customerBirthdayCount').textContent = birthdayCount;
  document.getElementById('customerResultCount').textContent = filtered.length;

  const tableRows = filtered.map((customer) => {
    const followUp = getFollowUpInfo(customer.nextFollowUp);
    return `<tr>
      <td><span class="customer-person"><span class="customer-avatar">${escapeHTML(customer.name.slice(0, 1))}</span><span><strong>${escapeHTML(customer.name)}</strong><small>${escapeHTML(customer.phone || '未留電話')}</small></span></span></td>
      <td><span class="customer-need" title="${escapeHTML(customer.needs || '尚未整理')}">${escapeHTML(customer.needs || '尚未整理')}</span></td>
      <td><span class="customer-owner">${escapeHTML(customer.owner || '未指派')}</span></td>
      <td><select class="customer-stage-select" data-customer-stage="${escapeHTML(customer.id)}"${currentUser?.role === 'viewer' ? ' disabled' : ''}>${['新名單', '需求訪談', '規劃中', '已成交', '持續服務'].map((item) => `<option${item === customer.stage ? ' selected' : ''}>${item}</option>`).join('')}</select></td>
      <td><span class="followup-date ${followUp.className}"><strong>${followUp.label}</strong><small>${followUp.detail}</small></span></td>
      <td><span class="policy-count-chip">${getCustomerPolicyCount(customer)} 份</span></td>
      <td><span class="customer-row-actions">
        <button class="secondary-button customer-360-button" data-open-workspace="${escapeHTML(customer.id)}">360 檢視</button>
        ${currentUser?.role === 'viewer' ? '' : `<button class="icon-button small customer-edit" data-edit-customer="${escapeHTML(customer.id)}" aria-label="編輯 ${escapeHTML(customer.name)}" data-icon="more">${icons.more}</button>`}
      </span></td>
    </tr>`;
  }).join('');
  document.getElementById('customerTableBody').innerHTML = tableRows || '<tr><td colspan="7">找不到符合條件的客戶。</td></tr>';

  document.getElementById('customerCardList').innerHTML = filtered.length
    ? filtered.map((customer) => {
      const followUp = getFollowUpInfo(customer.nextFollowUp);
      return `<article class="customer-card">
        <div class="customer-card-head">
          <span class="customer-person"><span class="customer-avatar">${escapeHTML(customer.name.slice(0, 1))}</span><span><strong>${escapeHTML(customer.name)}</strong><small>${escapeHTML(customer.phone || '未留電話')}</small></span></span>
          <span class="customer-row-actions">
            <button class="secondary-button customer-360-button" data-open-workspace="${escapeHTML(customer.id)}">360 檢視</button>
            ${currentUser?.role === 'viewer' ? '' : `<button class="icon-button small customer-edit" data-edit-customer="${escapeHTML(customer.id)}" aria-label="編輯 ${escapeHTML(customer.name)}">${icons.more}</button>`}
          </span>
        </div>
        <div class="customer-card-body">
          <span class="customer-card-field"><span>保障需求</span><strong>${escapeHTML(customer.needs || '尚未整理')}</strong></span>
          <span class="customer-card-field"><span>負責顧問</span><strong>${escapeHTML(customer.owner || '未指派')}</strong></span>
          <span class="customer-card-field"><span>服務階段</span><strong>${escapeHTML(customer.stage)}</strong></span>
          <span class="customer-card-field"><span>現有保單</span><strong>${getCustomerPolicyCount(customer)} 份</strong></span>
        </div>
        <div class="customer-card-footer"><span class="followup-date ${followUp.className}"><strong>${followUp.label}</strong><small>${followUp.detail}</small></span><span class="customer-need">${escapeHTML(customer.stage)}</span></div>
      </article>`;
    }).join('')
    : '<div class="empty-team-state">找不到符合條件的客戶。</div>';

  document.querySelectorAll('[data-customer-stage]').forEach((select) => {
    select.addEventListener('change', async () => {
      const customer = customers.find((item) => idsMatch(item.id, select.dataset.customerStage));
      if (!customer) return;
      const previousStage = customer.stage;
      const updatedCustomer = normalizeCustomer({
        ...customer,
        stage: select.value,
        updatedAt: new Date().toISOString()
      });
      if (backendReady) {
        try {
          const { response, result } = await requestResourceMutation(
            'customers',
            'PUT',
            customer.id,
            { ...updatedCustomer, expectedVersion: customer.version }
          );
          if (!response.ok) {
            select.value = previousStage;
            showToast(response.status === 409
              ? '這筆客戶資料已在其他裝置更新，請重新開啟'
              : result.details?.[0] || '服務階段更新失敗');
            return;
          }
          backendRevision = Number(result.revision || backendRevision);
          rememberBackendRevision();
          replaceLocalCustomer(result.item);
        } catch (error) {
          backendReady = false;
          replaceLocalCustomer(updatedCustomer);
          markLocalStateDirty();
          console.warn('Customer stage saved locally while offline.', error);
        }
      } else {
        replaceLocalCustomer(updatedCustomer);
        markLocalStateDirty();
      }
      showToast(`${customer.name} 已更新為「${select.value}」`);
    });
  });
  document.querySelectorAll('[data-edit-customer]').forEach((button) => {
    button.addEventListener('click', () => openCustomerModal(button.dataset.editCustomer));
  });
  document.querySelectorAll('[data-open-workspace]').forEach((button) => {
    button.addEventListener('click', () => {
      openCustomerWorkspace(button.dataset.openWorkspace).catch((error) => {
        console.error('Customer workspace failed to open.', error);
        showToast('客戶 360 資料暫時無法載入');
      });
    });
  });
}

const customerModal = document.getElementById('customerModal');
const customerForm = document.getElementById('customerForm');
const deleteCustomerButton = document.getElementById('deleteCustomer');

function openCustomerModal(customerId = null) {
  customerForm.reset();
  refreshCustomerOwnerOptions();
  const customer = customers.find((item) => idsMatch(item.id, customerId));
  document.getElementById('customerModalTitle').textContent = customer ? '編輯客戶資料' : '新增客戶';
  deleteCustomerButton.classList.toggle('hidden', !customer);
  document.getElementById('customerId').value = customer?.id || '';
  document.getElementById('customerVersion').value = customer?.version || '';
  if (customer) {
    Object.entries(customer).forEach(([key, value]) => {
      if (customerForm.elements[key]) customerForm.elements[key].value = value ?? '';
    });
    if (!customer.ownerUserId && customer.owner) {
      const matchingUsers = organizationUsers.filter((user) =>
        user.active !== false
        && user.role !== 'viewer'
        && user.displayName === customer.owner
      );
      if (matchingUsers.length === 1) {
        customerForm.elements.ownerUserId.value = matchingUsers[0].id;
      }
    }
    customerForm.elements.policyCount.value = getCustomerPolicyCount(customer);
  } else {
    customerForm.elements.ownerUserId.value = currentUser?.id
      || organizationUsers.find((user) => user.active !== false && user.role !== 'viewer')?.id
      || '';
    customerForm.elements.stage.value = '新名單';
    customerForm.elements.nextFollowUp.value = addDays(appToday, 3);
    customerForm.elements.policyCount.value = 0;
  }
  customerModal.classList.add('open');
  customerModal.setAttribute('aria-hidden', 'false');
  window.setTimeout(() => customerForm.elements.name.focus(), 100);
}

function closeCustomerModal() {
  customerModal.classList.remove('open');
  customerModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('openCustomerModal').addEventListener('click', () => openCustomerModal());
document.querySelectorAll('[data-close-customer]').forEach((button) => button.addEventListener('click', closeCustomerModal));
customerModal.addEventListener('click', (event) => { if (event.target === customerModal) closeCustomerModal(); });
customerForm.addEventListener('submit', (event) => {
  event.preventDefault();
  saveCustomerForm().catch((error) => {
    console.error('Unable to save customer.', error);
    showToast('客戶資料暫時無法儲存，請稍後再試');
  });
});
deleteCustomerButton.addEventListener('click', () => {
  deleteCurrentCustomer().catch((error) => {
    console.error('Unable to delete customer.', error);
    showToast('客戶資料暫時無法刪除，請稍後再試');
  });
});

const customerWorkspaceModal = document.getElementById('customerWorkspaceModal');
const customerWorkspaceForm = document.getElementById('customerWorkspaceForm');
let customerWorkspace = null;
let activeWorkspaceResource = 'contacts';

const workspaceConfigurations = {
  contacts: {
    title: '聯絡方式',
    fields: [
      { name: 'contactType', label: '類型', type: 'select', options: [['phone', '電話'], ['email', 'Email'], ['address', '地址'], ['other', '其他']] },
      { name: 'label', label: '標籤', placeholder: '例如：手機、公司、住家' },
      { name: 'value', label: '聯絡內容', required: true },
      { name: 'isPrimary', label: '設為主要聯絡方式', type: 'checkbox' }
    ],
    summary: (item) => [item.label || item.contactType, item.value]
  },
  relationships: {
    title: '家庭關係',
    fields: [
      { name: 'relationshipType', label: '關係', placeholder: '例如：配偶、子女、父母', required: true },
      { name: 'displayName', label: '姓名', required: true },
      { name: 'relatedCustomerId', label: '關聯既有客戶', type: 'customers' },
      { name: 'note', label: '補充說明', type: 'textarea' }
    ],
    summary: (item) => [`${item.relationshipType}・${item.displayName}`, item.note || '尚無補充說明']
  },
  interactions: {
    title: '互動紀錄',
    fields: [
      { name: 'interactionType', label: '互動類型', type: 'select', options: [['meeting', '面談'], ['phone', '電話'], ['line', 'LINE'], ['email', 'Email'], ['service', '保戶服務']] },
      { name: 'occurredAt', label: '發生時間', type: 'datetime-local', required: true },
      { name: 'subject', label: '主題', required: true },
      { name: 'summary', label: '互動摘要', type: 'textarea' }
    ],
    summary: (item) => [item.subject, `${new Date(item.occurredAt).toLocaleString('zh-TW')}・${item.summary || '尚無摘要'}`]
  },
  tasks: {
    title: '服務待辦',
    fields: [
      { name: 'title', label: '待辦內容', required: true },
      { name: 'detail', label: '執行說明', type: 'textarea' },
      { name: 'assignedUserId', label: '負責帳號', type: 'users' },
      { name: 'dueAt', label: '到期時間', type: 'datetime-local' },
      { name: 'status', label: '狀態', type: 'select', options: [['open', '待完成'], ['completed', '已完成'], ['cancelled', '已取消']] },
      { name: 'priority', label: '優先度', type: 'select', options: [['low', '低'], ['normal', '一般'], ['high', '高'], ['urgent', '緊急']] }
    ],
    summary: (item) => [item.title, `${item.status}・${item.dueAt ? new Date(item.dueAt).toLocaleString('zh-TW') : '未設定期限'}`]
  },
  documents: {
    title: '客戶文件',
    fields: [
      { name: 'documentType', label: '文件類型', type: 'select', options: [['policy', '保單'], ['consent', '同意書'], ['proposal', '建議書'], ['identity', '身分文件'], ['other', '其他']] },
      { name: 'title', label: '文件名稱', required: true },
      { name: 'policyId', label: '關聯保單', type: 'policies' },
      { name: 'attachmentId', label: '安全附件編號' },
      { name: 'processingStatus', label: '處理狀態', type: 'select', options: [['pending', '待處理'], ['processing', '處理中'], ['ready', '已完成'], ['failed', '失敗']] },
      { name: 'extractedData', label: '文件摘要', type: 'textarea' }
    ],
    summary: (item) => [item.title, `${item.documentType}・${item.processingStatus}`]
  },
  consents: {
    title: '同意紀錄',
    fields: [
      { name: 'consentType', label: '同意類型', placeholder: '例如：個資蒐集、電子通知', required: true },
      { name: 'status', label: '狀態', type: 'select', options: [['granted', '已同意'], ['withdrawn', '已撤回'], ['expired', '已到期']] },
      { name: 'grantedAt', label: '同意時間', type: 'datetime-local' },
      { name: 'withdrawnAt', label: '撤回時間', type: 'datetime-local' },
      { name: 'expiresAt', label: '到期時間', type: 'datetime-local' },
      { name: 'evidenceDocumentId', label: '佐證文件編號' },
      { name: 'note', label: '備註', type: 'textarea' }
    ],
    summary: (item) => [item.consentType, `${item.status}・${item.expiresAt ? `到期 ${new Date(item.expiresAt).toLocaleDateString('zh-TW')}` : '未設定到期日'}`]
  }
};

function workspaceOptionsMarkup(field) {
  if (field.type === 'customers') {
    return [['', '不關聯'], ...customers.map((item) => [item.id, item.name])];
  }
  if (field.type === 'users') {
    return [['', '未指派'], ...organizationUsers
      .filter((item) => item.active !== false && item.role !== 'viewer')
      .map((item) => [item.id, item.displayName])];
  }
  if (field.type === 'policies') {
    return [['', '不關聯'], ...savedPolicies.map((item) => [
      item.id,
      `${getCustomerName(item.customerId) || item.customer}・${item.company} ${item.type}`
    ])];
  }
  return field.options || [];
}

function workspaceFieldMarkup(field) {
  if (field.type === 'checkbox') {
    return `<label class="workspace-checkbox"><input name="${field.name}" type="checkbox"> ${field.label}</label>`;
  }
  if (['select', 'customers', 'users', 'policies'].includes(field.type)) {
    return `<label>${field.label}<select name="${field.name}"${field.required ? ' required' : ''}>${workspaceOptionsMarkup(field).map(([value, label]) => `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`).join('')}</select></label>`;
  }
  if (field.type === 'textarea') {
    return `<label>${field.label}<textarea name="${field.name}" rows="3"${field.required ? ' required' : ''} placeholder="${escapeHTML(field.placeholder || '')}"></textarea></label>`;
  }
  return `<label>${field.label}<input name="${field.name}" type="${field.type || 'text'}"${field.required ? ' required' : ''} placeholder="${escapeHTML(field.placeholder || '')}"></label>`;
}

function resetCustomerWorkspaceForm() {
  customerWorkspaceForm.reset();
  customerWorkspaceForm.elements.recordId.value = '';
  customerWorkspaceForm.elements.version.value = '';
  document.getElementById('resetWorkspaceForm').classList.add('hidden');
  document.getElementById('workspaceFormTitle').textContent = `新增${workspaceConfigurations[activeWorkspaceResource].title}`;
  if (activeWorkspaceResource === 'interactions') {
    customerWorkspaceForm.elements.occurredAt.value = new Date().toISOString().slice(0, 16);
  }
  if (activeWorkspaceResource === 'tasks') {
    customerWorkspaceForm.elements.status.value = 'open';
    customerWorkspaceForm.elements.priority.value = 'normal';
  }
  if (activeWorkspaceResource === 'documents') {
    customerWorkspaceForm.elements.processingStatus.value = 'pending';
  }
  if (activeWorkspaceResource === 'consents') {
    customerWorkspaceForm.elements.status.value = 'granted';
    customerWorkspaceForm.elements.grantedAt.value = new Date().toISOString().slice(0, 16);
  }
}

function renderCustomerWorkspace() {
  const configuration = workspaceConfigurations[activeWorkspaceResource];
  const items = customerWorkspace?.[activeWorkspaceResource] || [];
  document.getElementById('customerWorkspaceTabs').querySelectorAll('button').forEach((button) => {
    button.classList.toggle('active', button.dataset.workspaceTab === activeWorkspaceResource);
  });
  document.getElementById('customerWorkspaceFields').innerHTML = configuration.fields
    .map(workspaceFieldMarkup)
    .join('');
  customerWorkspaceForm.classList.toggle('hidden', currentUser?.role === 'viewer');
  document.getElementById('customerWorkspaceList').innerHTML = items.length
    ? items.map((item) => {
      const [title, detail] = configuration.summary(item);
      return `<article class="workspace-record">
        <div><strong>${escapeHTML(title || '未命名紀錄')}</strong><small>${escapeHTML(detail || '')}</small></div>
        ${currentUser?.role === 'viewer' ? '' : `<div class="workspace-record-actions">
          <button class="icon-button small" data-edit-workspace="${escapeHTML(item.id)}" aria-label="編輯">${icons.more}</button>
          <button class="icon-button small" data-delete-workspace="${escapeHTML(item.id)}" aria-label="刪除">${icons.close}</button>
        </div>`}
      </article>`;
    }).join('')
    : '<div class="workspace-empty">這個分類目前沒有紀錄。</div>';
  resetCustomerWorkspaceForm();

  document.querySelectorAll('[data-edit-workspace]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = items.find((record) => idsMatch(record.id, button.dataset.editWorkspace));
      if (!item) return;
      customerWorkspaceForm.elements.recordId.value = item.id;
      customerWorkspaceForm.elements.version.value = item.version;
      for (const field of configuration.fields) {
        const control = customerWorkspaceForm.elements[field.name];
        if (!control) continue;
        if (field.type === 'checkbox') {
          control.checked = Boolean(item[field.name]);
        } else if (field.type === 'datetime-local' && item[field.name]) {
          control.value = String(item[field.name]).slice(0, 16);
        } else {
          control.value = item[field.name] ?? '';
        }
      }
      document.getElementById('workspaceFormTitle').textContent = `編輯${configuration.title}`;
      document.getElementById('resetWorkspaceForm').classList.remove('hidden');
    });
  });

  document.querySelectorAll('[data-delete-workspace]').forEach((button) => {
    button.addEventListener('click', async () => {
      const item = items.find((record) => idsMatch(record.id, button.dataset.deleteWorkspace));
      if (!item || !window.confirm('確定要刪除這筆服務紀錄嗎？')) return;
      const response = await apiFetch(
        `/api/v1/customers/${encodeURIComponent(customerWorkspace.customer.id)}/${activeWorkspaceResource}/${encodeURIComponent(item.id)}`,
        { method: 'DELETE', headers: { 'If-Match': String(item.version) } }
      );
      if (!response.ok) {
        showToast(response.status === 409 ? '紀錄已被其他裝置更新' : '紀錄刪除失敗');
        return;
      }
      customerWorkspace[activeWorkspaceResource] = items.filter((record) => !idsMatch(record.id, item.id));
      renderCustomerWorkspace();
      showToast('服務紀錄已刪除');
    });
  });
}

async function openCustomerWorkspace(customerId) {
  const response = await apiFetch(`/api/v1/customers/${encodeURIComponent(customerId)}/workspace`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'WORKSPACE_UNAVAILABLE');
  customerWorkspace = result.workspace;
  activeWorkspaceResource = 'contacts';
  document.getElementById('customerWorkspaceTitle').textContent = `${customerWorkspace.customer.name}・客戶 360`;
  document.getElementById('customerWorkspaceSubtitle').textContent = `${customerWorkspace.customer.stage}・${customerWorkspace.policies.length} 份保單・所有紀錄均保存至正式資料庫`;
  renderCustomerWorkspace();
  customerWorkspaceModal.classList.add('open');
  customerWorkspaceModal.setAttribute('aria-hidden', 'false');
}

function closeCustomerWorkspace() {
  customerWorkspaceModal.classList.remove('open');
  customerWorkspaceModal.setAttribute('aria-hidden', 'true');
  customerWorkspace = null;
}

document.querySelectorAll('[data-close-workspace]').forEach((button) => button.addEventListener('click', closeCustomerWorkspace));
customerWorkspaceModal.addEventListener('click', (event) => {
  if (event.target === customerWorkspaceModal) closeCustomerWorkspace();
});
document.querySelectorAll('[data-workspace-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    activeWorkspaceResource = button.dataset.workspaceTab;
    renderCustomerWorkspace();
  });
});
document.getElementById('resetWorkspaceForm').addEventListener('click', resetCustomerWorkspaceForm);
customerWorkspaceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!customerWorkspace) return;
  const data = Object.fromEntries(new FormData(customerWorkspaceForm));
  for (const field of workspaceConfigurations[activeWorkspaceResource].fields) {
    if (field.type === 'checkbox') data[field.name] = customerWorkspaceForm.elements[field.name].checked;
  }
  delete data.recordId;
  delete data.version;
  const recordId = customerWorkspaceForm.elements.recordId.value;
  const version = customerWorkspaceForm.elements.version.value;
  const path = `/api/v1/customers/${encodeURIComponent(customerWorkspace.customer.id)}/${activeWorkspaceResource}${recordId ? `/${encodeURIComponent(recordId)}` : ''}`;
  const response = await apiFetch(path, {
    method: recordId ? 'PATCH' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(recordId ? { 'If-Match': version } : {})
    },
    body: JSON.stringify(data)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    showToast(response.status === 409
      ? '這筆紀錄已被其他裝置修改，請重新開啟'
      : result.details?.[0] || '服務紀錄未通過檢查');
    return;
  }
  const items = customerWorkspace[activeWorkspaceResource];
  const existingIndex = items.findIndex((item) => idsMatch(item.id, result.item.id));
  if (existingIndex >= 0) items[existingIndex] = result.item;
  else items.unshift(result.item);
  renderCustomerWorkspace();
  showToast(`${workspaceConfigurations[activeWorkspaceResource].title}已儲存`);
});

const customerImportModal = document.getElementById('customerImportModal');
const customerImportFile = document.getElementById('customerImportFile');
let activeImportJobId = null;
let importPollTimer = null;

function closeCustomerImport() {
  customerImportModal.classList.remove('open');
  customerImportModal.setAttribute('aria-hidden', 'true');
}

function renderImportJob(job) {
  const percent = job.total ? Math.round(job.processed / job.total * 100) : 0;
  const statusNames = {
    queued: '等待開始',
    processing: '正在背景匯入',
    completed: '匯入完成',
    completed_with_errors: '匯入完成，部分資料需修正',
    cancelled: '匯入已取消',
    failed: '匯入失敗'
  };
  document.getElementById('importStatusLabel').textContent = statusNames[job.status] || job.status;
  document.getElementById('importProgressDetail').textContent = `${job.processed} / ${job.total}・成功 ${job.imported}・失敗 ${job.failed}`;
  document.getElementById('customerImportProgressBar').style.width = `${percent}%`;
  document.getElementById('cancelCustomerImport').classList.toggle(
    'hidden',
    !['queued', 'processing'].includes(job.status)
  );
  document.getElementById('downloadImportErrors').classList.toggle('hidden', !job.failed);
}

async function pollImportJob(jobId) {
  window.clearTimeout(importPollTimer);
  const response = await apiFetch(`/api/v1/import-jobs/${encodeURIComponent(jobId)}`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'IMPORT_STATUS_UNAVAILABLE');
  renderImportJob(result.item);
  if (['queued', 'processing'].includes(result.item.status)) {
    importPollTimer = window.setTimeout(() => {
      pollImportJob(jobId).catch((error) => {
        console.error('Import status polling failed.', error);
        showToast('暫時無法取得匯入進度');
      });
    }, 700);
  } else {
    await initializeBackendSync();
    showToast(`客戶匯入工作已完成：成功 ${result.item.imported} 筆`);
  }
}

document.getElementById('openCustomerImport').addEventListener('click', () => {
  customerImportFile.value = '';
  activeImportJobId = null;
  document.getElementById('startCustomerImport').disabled = true;
  document.getElementById('customerImportProgress').classList.add('hidden');
  customerImportModal.classList.add('open');
  customerImportModal.setAttribute('aria-hidden', 'false');
});
document.querySelectorAll('[data-close-import]').forEach((button) => button.addEventListener('click', closeCustomerImport));
customerImportModal.addEventListener('click', (event) => {
  if (event.target === customerImportModal) closeCustomerImport();
});
customerImportFile.addEventListener('change', () => {
  document.getElementById('startCustomerImport').disabled = !customerImportFile.files[0];
});
document.getElementById('startCustomerImport').addEventListener('click', async () => {
  const file = customerImportFile.files[0];
  if (!file) return;
  const extension = file.name.split('.').pop()?.toLowerCase();
  const contentType = extension === 'xlsx'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : extension === 'csv'
      ? 'text/csv'
      : '';
  if (!contentType) {
    showToast('只支援 CSV 或 XLSX 檔案');
    return;
  }
  const response = await apiFetch('/api/v1/import-jobs', {
    method: 'POST',
    headers: {
      'Content-Type': contentType,
      'X-File-Name': encodeURIComponent(file.name)
    },
    body: file
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    showToast(result.error === 'IMPORT_NAME_COLUMN_REQUIRED'
      ? '匯入檔第一列必須包含「客戶姓名」'
      : '匯入檔無法讀取，請確認格式');
    return;
  }
  activeImportJobId = result.item.id;
  document.getElementById('customerImportProgress').classList.remove('hidden');
  renderImportJob(result.item);
  await pollImportJob(activeImportJobId);
});
document.getElementById('cancelCustomerImport').addEventListener('click', async () => {
  if (!activeImportJobId) return;
  const response = await apiFetch(`/api/v1/import-jobs/${encodeURIComponent(activeImportJobId)}`, {
    method: 'DELETE'
  });
  const result = await response.json().catch(() => ({}));
  if (response.ok) renderImportJob(result.item);
});
document.getElementById('downloadImportErrors').addEventListener('click', async () => {
  if (!activeImportJobId) return;
  const response = await apiFetch(`/api/v1/import-jobs/${encodeURIComponent(activeImportJobId)}/errors`);
  if (!response.ok) {
    showToast('目前沒有可下載的錯誤明細');
    return;
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = `客戶匯入錯誤-${activeImportJobId}.csv`;
  link.click();
  URL.revokeObjectURL(url);
});

['customerSearch', 'customerStageFilter', 'customerOwnerFilter'].forEach((id) => {
  document.getElementById(id).addEventListener(id === 'customerSearch' ? 'input' : 'change', renderCustomers);
});
document.getElementById('resetCustomerFilters').addEventListener('click', () => {
  document.getElementById('customerSearch').value = '';
  document.getElementById('customerStageFilter').value = 'all';
  document.getElementById('customerOwnerFilter').value = 'all';
  renderCustomers();
});

const compareModal = document.getElementById('compareModal');
function closeCompareModal() {
  compareModal.classList.remove('open');
  compareModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('compareSelected').addEventListener('click', () => {
  const selected = products.filter((product) => selectedProducts.has(product.id));
  if (selected.length < 2) {
    showToast('請至少選擇 2 項商品進行比較');
    return;
  }
  document.getElementById('comparisonTable').innerHTML = `<table>
    <thead><tr><th>比較欄位</th>${selected.map((product) => `<th><span class="compare-product-title">${escapeHTML(product.name)}</span><br><small>${escapeHTML(product.company)}</small></th>`).join('')}</tr></thead>
    <tbody>
      <tr><td>險種</td>${selected.map((product) => `<td>${escapeHTML(product.type)}</td>`).join('')}</tr>
      <tr><td>投保年齡</td>${selected.map((product) => `<td>${escapeHTML(product.age)}</td>`).join('')}</tr>
      <tr><td>保障期間</td>${selected.map((product) => `<td>${escapeHTML(product.term)}</td>`).join('')}</tr>
      <tr><td>特色一</td>${selected.map((product) => `<td>${escapeHTML(product.features[0])}</td>`).join('')}</tr>
      <tr><td>特色二</td>${selected.map((product) => `<td>${escapeHTML(product.features[1])}</td>`).join('')}</tr>
      <tr><td>資料日期</td>${selected.map((product) => `<td>${escapeHTML(product.updated)}</td>`).join('')}</tr>
    </tbody>
  </table><div class="disclaimer">${icons.info}示範比較僅呈現資料結構，不可取代各公司最新商品說明書、條款與核保規則。</div>`;
  compareModal.classList.add('open');
  compareModal.setAttribute('aria-hidden', 'false');
});
document.querySelectorAll('[data-close-compare]').forEach((button) => button.addEventListener('click', () => {
  closeCompareModal();
}));
compareModal.addEventListener('click', (event) => {
  if (event.target === compareModal) closeCompareModal();
});

const companies = [
  { name: '國泰人壽', logo: '國', url: 'https://www.cathaylife.com.tw/', links: [
    { type: 'news', label: '最新消息', note: '公司公告與活動' }, { type: 'proposal', label: '建議書入口', note: '需依公司權限登入' }, { type: 'application', label: '要保文件', note: '表單與填寫說明' }, { type: 'product', label: '商品專區', note: '商品與條款查詢' }
  ]},
  { name: '富邦人壽', logo: '富', url: 'https://www.fubon.com/life/', links: [
    { type: 'news', label: '最新消息', note: '公司公告與活動' }, { type: 'proposal', label: '建議書入口', note: '需依公司權限登入' }, { type: 'application', label: '要保文件', note: '表單與填寫說明' }, { type: 'product', label: '商品專區', note: '商品與條款查詢' }
  ]},
  { name: '南山人壽', logo: '南', url: 'https://www.nanshanlife.com.tw/', links: [
    { type: 'news', label: '最新消息', note: '公司公告與活動' }, { type: 'proposal', label: '建議書入口', note: '需依公司權限登入' }, { type: 'application', label: '要保文件', note: '表單與填寫說明' }, { type: 'product', label: '商品專區', note: '商品與條款查詢' }
  ]},
  { name: '新光人壽', logo: '新', url: 'https://www.skl.com.tw/', links: [
    { type: 'news', label: '最新消息', note: '公司公告與活動' }, { type: 'proposal', label: '建議書入口', note: '需依公司權限登入' }, { type: 'application', label: '要保文件', note: '表單與填寫說明' }, { type: 'product', label: '商品專區', note: '商品與條款查詢' }
  ]},
  { name: '台灣人壽', logo: '台', url: 'https://www.taiwanlife.com/', links: [
    { type: 'news', label: '最新消息', note: '公司公告與活動' }, { type: 'proposal', label: '建議書入口', note: '需依公司權限登入' }, { type: 'application', label: '要保文件', note: '表單與填寫說明' }, { type: 'product', label: '商品專區', note: '商品與條款查詢' }
  ]},
  { name: '全球人壽', logo: '全', url: 'https://www.transglobe.com.tw/', links: [
    { type: 'news', label: '最新消息', note: '公司公告與活動' }, { type: 'proposal', label: '建議書入口', note: '需依公司權限登入' }, { type: 'application', label: '要保文件', note: '表單與填寫說明' }, { type: 'product', label: '商品專區', note: '商品與條款查詢' }
  ]}
];
let documentFilter = 'all';

function renderCompanies() {
  const search = document.getElementById('documentSearch').value.trim().toLowerCase();
  const directory = document.getElementById('companyDirectory');
  const filteredCompanies = companies.filter((company) =>
    !search || `${company.name}${company.links.map((link) => link.label).join('')}`.toLowerCase().includes(search)
  );
  directory.innerHTML = filteredCompanies.map((company) => {
    const links = company.links.filter((link) => documentFilter === 'all' || link.type === documentFilter);
    return `<article class="company-card panel">
      <div class="company-card-header"><span class="company-logo">${escapeHTML(company.logo)}</span><div><strong>${escapeHTML(company.name)}</strong><span>官方公開網站</span></div><span class="link-status">官方入口</span></div>
      <div class="document-links">${links.map((link) => `<button class="document-link" data-company-url="${escapeHTML(safeExternalUrl(company.url) || '')}"><span class="document-link-icon">${icons.folder}</span><span><strong>${escapeHTML(link.label)}</strong><small>${escapeHTML(link.note)}</small></span>${icons.external}</button>`).join('')}</div>
    </article>`;
  }).join('') || '<article class="panel"><p>找不到符合條件的公司或文件。</p></article>';

  document.querySelectorAll('[data-company-url]').forEach((button) => {
    button.addEventListener('click', () => {
      const safeUrl = safeExternalUrl(button.dataset.companyUrl);
      if (!safeUrl) {
        showToast('這個公司網址未通過安全檢查');
        return;
      }
      window.open(safeUrl, '_blank', 'noopener,noreferrer');
    });
  });
}

document.getElementById('documentSearch').addEventListener('input', renderCompanies);
document.querySelectorAll('[data-doc-filter]').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('[data-doc-filter]').forEach((item) => item.classList.toggle('active', item === button));
    documentFilter = button.dataset.docFilter;
    renderCompanies();
  });
});
document.getElementById('checkLinks').addEventListener('click', (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  button.innerHTML = `${icons.refresh} 檢查中…`;
  window.setTimeout(() => {
    button.disabled = false;
    button.innerHTML = `${icons.refresh} 檢查連結狀態`;
    showToast('目前僅提供官方首頁；深層下載頁將由正式資料服務檢查');
  }, 700);
});

document.getElementById('globalSearch').addEventListener('keydown', async (event) => {
  if (event.key === 'Enter') {
    const query = event.currentTarget.value.trim();
    if (!query) return;
    if (backendReady && query.length >= 2) {
      try {
        const response = await apiFetch(`/api/v1/search?q=${encodeURIComponent(query)}&limit=10`);
        const result = await response.json().catch(() => ({}));
        const match = result.items?.[0];
        if (response.ok && match) {
          if (match.type === 'customer') {
            goToPage('customers');
            document.getElementById('customerSearch').value = query;
            renderCustomers();
            showToast(`找到客戶：${match.display}`);
          } else {
            goToPage('policy');
            showToast(`找到保單：${match.display}`);
          }
          return;
        }
      } catch (error) {
        console.warn('Server search unavailable; using current page data.', error);
      }
    }
    const customerMatch = customers.find((customer) => `${customer.name}${customer.phone}${customer.email}${customer.needs}${customer.owner}`.includes(query));
    const policyMatch = savedPolicies.find((policy) => `${getCustomerName(policy.customerId) || policy.customer}${policy.company}${policy.type}${policy.policyNumber}`.includes(query));
    if (customerMatch) {
      goToPage('customers');
      document.getElementById('customerSearch').value = query;
      renderCustomers();
      showToast(`找到客戶 ${customerMatch.name}`);
    } else if (policyMatch) {
      goToPage('policy');
      showToast(`找到 ${getCustomerName(policyMatch.customerId) || policyMatch.customer} 的 ${policyMatch.type} 資料`);
    } else {
      goToPage('documents');
      document.getElementById('documentSearch').value = query;
      renderCompanies();
      showToast(`正在文件中心搜尋「${query}」`);
    }
  }
});

document.addEventListener('keydown', (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    document.getElementById('globalSearch').focus();
  }
  if (event.key === 'Escape') {
    closeEventModal();
    closeCompareModal();
    closeMemberModal();
    closeCustomerModal();
    closeCustomerWorkspace();
    closeCustomerImport();
    closeAccountModal();
    closeSettingsModal();
  }
});

document.getElementById('notificationButton').addEventListener('click', () => {
  const wasReviewed = reviewState.notification === getNotificationReviewSignature();
  markReviewed('notification');
  showToast(wasReviewed ? '目前沒有新的未讀通知' : '通知已檢閱，未讀提示已清除');
});
const settingsModal = document.getElementById('settingsModal');
const changePasswordForm = document.getElementById('changePasswordForm');
const mfaSetupForm = document.getElementById('mfaSetupForm');
const mfaConfirmForm = document.getElementById('mfaConfirmForm');
const mfaDisableForm = document.getElementById('mfaDisableForm');
const downloadRecoveryCodesButton = document.getElementById('downloadRecoveryCodes');
let pendingRecoveryCodes = [];

function clearMfaSetupSecrets() {
  pendingRecoveryCodes = [];
  document.getElementById('mfaSecret').value = '';
  document.getElementById('recoveryCodeList').replaceChildren();
  document.getElementById('mfaSetupResult').classList.add('hidden');
}

function updateMfaSettingsUi() {
  const enabled = Boolean(currentUser?.mfaEnabled);
  const chip = document.getElementById('mfaStatusChip');
  chip.textContent = enabled ? '已啟用' : '尚未啟用';
  chip.className = `status-chip ${enabled ? 'review' : 'info'}`;
  mfaSetupForm.classList.toggle('hidden', enabled);
  mfaDisableForm.classList.toggle('hidden', !enabled);
  if (enabled) document.getElementById('mfaSetupResult').classList.add('hidden');
}

function openSettingsModal() {
  changePasswordForm.reset();
  mfaSetupForm.reset();
  mfaConfirmForm.reset();
  mfaDisableForm.reset();
  clearMfaSetupSecrets();
  updateMfaSettingsUi();
  settingsModal.classList.add('open');
  settingsModal.setAttribute('aria-hidden', 'false');
}

function closeSettingsModal() {
  clearMfaSetupSecrets();
  settingsModal.classList.remove('open');
  settingsModal.setAttribute('aria-hidden', 'true');
}

document.getElementById('settingsButton').addEventListener('click', openSettingsModal);
document.querySelectorAll('[data-close-settings]').forEach((button) => {
  button.addEventListener('click', closeSettingsModal);
});
settingsModal.addEventListener('click', (event) => {
  if (event.target === settingsModal) closeSettingsModal();
});

changePasswordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(changePasswordForm));
  if (data.newPassword !== data.confirmPassword) {
    showToast('兩次輸入的新密碼不一致。');
    return;
  }
  const response = await apiFetch('/api/auth/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    showToast(result.error === 'CURRENT_PASSWORD_INVALID'
      ? '目前密碼不正確。'
      : result.details?.[0] || '密碼更新失敗。');
    return;
  }
  applyAuthenticatedUser(result);
  changePasswordForm.reset();
  showToast('密碼已更新，其他裝置的登入已失效。');
});

mfaSetupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const response = await apiFetch('/api/auth/mfa/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(new FormData(mfaSetupForm)))
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    showToast(result.error === 'CURRENT_PASSWORD_INVALID'
      ? '目前密碼不正確。'
      : '無法開始 MFA 設定。');
    return;
  }
  document.getElementById('mfaSecret').value = result.secret;
  pendingRecoveryCodes = [...result.recoveryCodes];
  document.getElementById('recoveryCodeList').replaceChildren(
    ...pendingRecoveryCodes.map((code) => {
      const element = document.createElement('code');
      element.textContent = code;
      return element;
    })
  );
  document.getElementById('mfaSetupResult').classList.remove('hidden');
  mfaSetupForm.classList.add('hidden');
  showToast('請先保存復原碼，再輸入驗證器代碼完成設定。');
});

downloadRecoveryCodesButton.addEventListener('click', () => {
  if (!pendingRecoveryCodes.length) return;
  const content = [
    '莎莎保險助理工作台 MFA 復原碼',
    `帳號：${currentUser?.username || ''}`,
    `建立時間：${new Date().toLocaleString('zh-TW')}`,
    '',
    ...pendingRecoveryCodes,
    '',
    '每組復原碼只能使用一次，請存放於安全位置。'
  ].join('\n');
  const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `莎莎保險助理工作台-MFA復原碼-${new Date().toISOString().slice(0, 10)}.txt`;
  link.click();
  URL.revokeObjectURL(url);
});

mfaConfirmForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const response = await apiFetch('/api/auth/mfa/confirm', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(new FormData(mfaConfirmForm)))
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    showToast(result.error === 'INVALID_MFA_CODE'
      ? '驗證碼不正確或已使用。'
      : 'MFA 啟用失敗。');
    return;
  }
  currentUser.mfaEnabled = true;
  clearMfaSetupSecrets();
  updateMfaSettingsUi();
  showToast('MFA 已啟用。下次登入需要驗證碼。');
});

mfaDisableForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!window.confirm('確定要停用 MFA 嗎？帳號將只剩密碼保護。')) return;
  const response = await apiFetch('/api/auth/mfa', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(Object.fromEntries(new FormData(mfaDisableForm)))
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    showToast(result.error === 'CURRENT_PASSWORD_INVALID'
      ? '目前密碼不正確。'
      : result.error === 'INVALID_MFA_CODE'
        ? '驗證碼或復原碼不正確。'
        : '無法停用 MFA。');
    return;
  }
  clearSensitiveLocalData();
  window.location.reload();
});
document.querySelectorAll('[data-client]').forEach((button) => button.addEventListener('click', () => {
  goToPage('customers');
  document.getElementById('customerSearch').value = button.dataset.client;
  renderCustomers();
  showToast(`已開啟 ${button.dataset.client} 的客戶資料`);
}));

let backendRevision = null;
let backendReady = false;
let backendSyncTimer = null;
let backendSyncInFlight = false;
let backendSyncQueued = false;
let backendConnectionWarningShown = false;
const backendRevisionStorageKey = 'sasha-backend-revision';
const localStateDirtyStorageKey = 'sasha-local-state-dirty';
const activeOrganizationStorageKey = 'sasha-active-organization';

function prepareLocalOrganization(organizationId) {
  const previousOrganizationId = readStorage(sessionStorage, activeOrganizationStorageKey, null);
  if (previousOrganizationId && previousOrganizationId !== organizationId) {
    clearSensitiveLocalData();
    customers = [];
    savedPolicies = [];
    events = [];
    teamMembers = [];
    teamTasks = [];
    customTeamGoal = 0;
    backendRevision = null;
  }
  writeStorage(sessionStorage, activeOrganizationStorageKey, organizationId);
}

function markLocalStateDirty() {
  return false;
}

function clearLocalStateDirty() {
  removeStorage(sessionStorage, localStateDirtyStorageKey);
}

function rememberBackendRevision() {
  writeStorage(sessionStorage, backendRevisionStorageKey, backendRevision);
}

function getBackendSnapshot() {
  return {
    expectedRevision: backendRevision,
    teamMembers,
    teamTasks,
    teamGoal: customTeamGoal
  };
}

function persistBackendStateLocally() {
  [
    'sasha-customers',
    'sasha-policies',
    'sasha-events',
    'sasha-team-members',
    'sasha-team-tasks',
    'sasha-team-goal',
    'sasha-event-outbox',
    'sasha-local-state-dirty'
  ].forEach((key) => removeStorage(localStorage, key));
}

function renderApplicationData() {
  refreshCustomerRelationshipOptions();
  renderCalendar();
  renderTodayTimeline();
  renderPolicies();
  renderTeam();
  renderCustomers();
}

function applyBackendState(state) {
  customers = asArray(state.customers).map(normalizeCustomer);
  savedPolicies = asArray(state.policies).map(normalizePolicy);
  events = asArray(state.events).map(normalizeEvent);
  teamMembers = asArray(state.teamMembers);
  teamTasks = asArray(state.teamTasks);
  customTeamGoal = Number(state.teamGoal || 0);
  backendRevision = Number(state.revision || 0);
  rememberBackendRevision();
  clearLocalStateDirty();
  persistBackendStateLocally();
  renderApplicationData();
}

async function pushStateToBackend() {
  if (!backendReady || backendSyncInFlight) {
    if (backendSyncInFlight) backendSyncQueued = true;
    return false;
  }

  backendSyncInFlight = true;
  try {
    const response = await apiFetch('/api/v1/team-state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getBackendSnapshot())
    });

    if (response.status === 409) {
      backendReady = false;
      showToast('偵測到其他裝置已有更新，請重新整理頁面後確認資料');
      return false;
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error('Backend sync failed.', error);
      if (!backendConnectionWarningShown) {
        backendConnectionWarningShown = true;
        showToast('正式資料庫暫時無法同步，請恢復連線後再儲存');
      }
      return false;
    }

    const result = await response.json();
    backendRevision = Number(result.revision);
    rememberBackendRevision();
    clearLocalStateDirty();
    backendConnectionWarningShown = false;
    return true;
  } catch (error) {
    console.warn('Backend connection unavailable.', error);
    if (!backendConnectionWarningShown) {
      backendConnectionWarningShown = true;
      showToast('目前無法連接正式資料庫，請恢復連線後再操作');
    }
    return false;
  } finally {
    backendSyncInFlight = false;
    if (backendSyncQueued && backendReady) {
      backendSyncQueued = false;
      window.setTimeout(pushStateToBackend, 0);
    }
  }
}

function scheduleBackendSync() {
  if (!backendReady) return;
  window.clearTimeout(backendSyncTimer);
  backendSyncTimer = window.setTimeout(pushStateToBackend, 450);
}

const eventOutboxStorageKey = 'sasha-event-outbox';
let eventOutbox = [];

function getEventOutbox() {
  return [...eventOutbox];
}

function setEventOutbox(operations) {
  eventOutbox = [...operations];
  removeStorage(localStorage, eventOutboxStorageKey);
}

function queueEventMutation(operation) {
  const operations = getEventOutbox();
  const existingIndex = operations.findIndex((item) => idsMatch(item.eventId, operation.eventId));
  if (existingIndex >= 0) {
    const previous = operations[existingIndex];
    if (previous.method === 'POST' && operation.method === 'PUT') {
      operations[existingIndex] = { ...previous, payload: operation.payload };
    } else if (previous.method === 'POST' && operation.method === 'DELETE') {
      operations.splice(existingIndex, 1);
    } else {
      operations[existingIndex] = operation;
    }
  } else {
    operations.push(operation);
  }
  setEventOutbox(operations);
}

async function requestEventMutation(operation) {
  await waitForBackendSyncIdle();
  const isCreate = operation.method === 'POST';
  const path = isCreate
    ? '/api/v1/events'
    : `/api/v1/events/${encodeURIComponent(operation.eventId)}`;
  const headers = { 'Content-Type': 'application/json' };
  if (!isCreate && operation.payload?.expectedVersion) {
    headers['If-Match'] = String(operation.payload.expectedVersion);
  }
  const response = await apiFetch(path, {
    method: operation.method,
    headers,
    body: JSON.stringify(operation.payload)
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

async function requestResourceMutation(resource, method, itemId, payload) {
  await waitForBackendSyncIdle();
  const path = itemId
    ? `/api/v1/${resource}/${encodeURIComponent(itemId)}`
    : `/api/v1/${resource}`;
  const headers = { 'Content-Type': 'application/json' };
  if (itemId && payload?.expectedVersion) {
    headers['If-Match'] = String(payload.expectedVersion);
  }
  const response = await apiFetch(path, {
    method,
    headers,
    body: JSON.stringify(payload)
  });
  const result = await response.json().catch(() => ({}));
  return { response, result };
}

async function waitForBackendSyncIdle() {
  window.clearTimeout(backendSyncTimer);
  for (let attempt = 0; backendSyncInFlight && attempt < 40; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  if (backendSyncInFlight) throw new Error('Background synchronization is still running.');
}

function replaceLocalCustomer(customer) {
  const normalized = normalizeCustomer(customer);
  const index = customers.findIndex((item) => idsMatch(item.id, normalized.id));
  if (index >= 0) {
    customers[index] = normalized;
  } else {
    customers.unshift(normalized);
  }
  savedPolicies = savedPolicies.map((policy) =>
    idsMatch(policy.customerId, normalized.id)
      ? normalizePolicy({ ...policy, customer: normalized.name })
      : policy
  );
  saveCustomers({ sync: false });
  savePolicies({ sync: false });
  refreshCustomerRelationshipOptions();
  renderCustomers();
  renderPolicies();
  return normalized;
}

async function saveCustomerForm() {
  const data = Object.fromEntries(new FormData(customerForm));
  const selectedOwner = organizationUsers.find((user) => idsMatch(user.id, data.ownerUserId));
  const existingCustomer = data.id
    ? customers.find((customer) => idsMatch(customer.id, data.id))
    : null;
  const customerData = normalizeCustomer({
    ...existingCustomer,
    ...data,
    owner: selectedOwner?.displayName || existingCustomer?.owner || '',
    id: data.id || undefined,
    version: Number(data.version || existingCustomer?.version || 1),
    updatedAt: new Date().toISOString()
  });

  if (backendReady) {
    try {
      const { response, result } = await requestResourceMutation(
        'customers',
        existingCustomer ? 'PUT' : 'POST',
        existingCustomer?.id,
        existingCustomer
          ? { ...customerData, expectedVersion: existingCustomer.version }
          : customerData
      );
      if (response.status === 409) {
        showToast(result.error === 'RESOURCE_IN_USE'
          ? '客戶仍有關聯資料，無法修改'
          : '這筆客戶資料已被其他裝置修改，請重新開啟');
        return;
      }
      if (!response.ok) {
        showToast(result.details?.[0] || '客戶資料未通過檢查');
        return;
      }
      backendRevision = Number(result.revision || backendRevision);
      rememberBackendRevision();
      replaceLocalCustomer(result.item);
    } catch (error) {
      backendReady = false;
      console.warn('Customer save blocked while the database is unavailable.', error);
      showToast('連線中斷，客戶資料尚未儲存，請恢復連線後再試');
      return;
    }
  } else {
    showToast('目前無法連接正式資料庫，客戶資料尚未儲存');
    return;
  }

  closeCustomerModal();
  showToast(`${customerData.name} 的客戶資料已儲存`);
}

async function deleteCurrentCustomer() {
  const customerId = document.getElementById('customerId').value;
  const customer = customers.find((item) => idsMatch(item.id, customerId));
  if (!customer) return;
  const relatedPolicyCount = savedPolicies.filter((policy) => idsMatch(policy.customerId, customer.id)).length;
  const relatedEventCount = events.filter((event) => idsMatch(event.customerId, customer.id)).length;
  if (relatedPolicyCount || relatedEventCount) {
    showToast(`${customer.name} 尚有 ${relatedPolicyCount} 份保單與 ${relatedEventCount} 筆行程，請先完成資料移轉`);
    return;
  }
  if (!window.confirm(`確定要刪除 ${customer.name} 的客戶資料嗎？`)) return;

  if (backendReady) {
    try {
      const { response, result } = await requestResourceMutation(
        'customers',
        'DELETE',
        customer.id,
        { expectedVersion: customer.version }
      );
      if (response.status === 409) {
        showToast(result.error === 'RESOURCE_IN_USE'
          ? '客戶仍有關聯保單，無法刪除'
          : '這筆客戶資料已被其他裝置修改，請重新開啟');
        return;
      }
      if (!response.ok && response.status !== 404) {
        showToast('客戶資料暫時無法刪除');
        return;
      }
      backendRevision = Number(result.revision || backendRevision);
      rememberBackendRevision();
    } catch (error) {
      backendReady = false;
      console.warn('Customer deletion blocked while the database is unavailable.', error);
      showToast('連線中斷，客戶資料尚未刪除');
      return;
    }
  } else {
    showToast('目前無法連接正式資料庫，客戶資料尚未刪除');
    return;
  }

  customers = customers.filter((item) => !idsMatch(item.id, customer.id));
  saveCustomers({ sync: false });
  refreshCustomerRelationshipOptions();
  renderCustomers();
  closeCustomerModal();
  showToast(`${customer.name} 的客戶資料已刪除`);
}

async function savePolicyForm(form) {
  if (currentOcrJob) {
    const controls = [...form.querySelectorAll('[data-ocr-field-id]')];
    for (const control of controls) {
      if (control.value === control.dataset.ocrOriginal) continue;
      const response = await apiFetch(
        `/api/v1/ocr/jobs/${encodeURIComponent(currentOcrJob.id)}/fields/${encodeURIComponent(control.dataset.ocrFieldId)}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'If-Match': control.dataset.ocrVersion
          },
          body: JSON.stringify({ value: control.value })
        }
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        showToast(response.status === 409
          ? '辨識欄位已在其他裝置更新，請重新檢閱'
          : '人工修正尚未保存');
        return;
      }
      currentOcrJob = result.item;
    }
    const approvalResponse = await apiFetch(
      `/api/v1/ocr/jobs/${encodeURIComponent(currentOcrJob.id)}/approve`,
      { method: 'POST' }
    );
    const approval = await approvalResponse.json().catch(() => ({}));
    if (!approvalResponse.ok) {
      showToast(approvalResponse.status === 409
        ? '這份辨識工作目前不能核准，請重新檢閱狀態'
        : '保單核准建檔失敗');
      return;
    }
    backendRevision = Number(approval.revision || backendRevision);
    rememberBackendRevision();
    const existingIndex = savedPolicies.findIndex((item) => idsMatch(item.id, approval.policy.id));
    if (existingIndex >= 0) {
      savedPolicies[existingIndex] = normalizePolicy(approval.policy);
    } else {
      savedPolicies.unshift(normalizePolicy(approval.policy));
    }
    savePolicies({ sync: false });
    renderPolicies();
    renderCustomers();
    showToast('辨識內容已人工確認，保單與修正紀錄已正式保存');
    resetPolicyUpload();
    return;
  }

  const data = Object.fromEntries(new FormData(form));
  const customer = customers.find((item) => idsMatch(item.id, data.customerId));
  if (!customer) {
    showToast('請先選擇有效的客戶');
    return;
  }
  const policyData = normalizePolicy({
    customerId: customer.id,
    customer: customer.name,
    company: data.company,
    policyNumber: data.policyNumber,
    type: data.type,
    startDate: data.startDate,
    paymentYears: data.paymentYears,
    coverage: data.coverage,
    premium: data.premium,
    summary: data.summary,
    updated: todayISO.replaceAll('-', '/')
  });

  if (backendReady) {
    try {
      const { response, result } = await requestResourceMutation('policies', 'POST', null, policyData);
      if (!response.ok) {
        showToast(result.details?.[0] || '保單資料未通過檢查');
        return;
      }
      backendRevision = Number(result.revision || backendRevision);
      rememberBackendRevision();
      savedPolicies.unshift(normalizePolicy(result.item));
      savePolicies({ sync: false });
    } catch (error) {
      backendReady = false;
      console.warn('Policy save blocked while the database is unavailable.', error);
      showToast('連線中斷，保單資料尚未儲存，請恢復連線後再試');
      return;
    }
  } else {
    showToast('目前無法連接正式資料庫，保單資料尚未儲存');
    return;
  }

  renderPolicies();
  renderCustomers();
  showToast(`已將 ${customer.name} 的保單保存至客戶檔案`);
  resetPolicyUpload();
}

async function replayEventOutbox() {
  const operations = getEventOutbox();
  if (!operations.length) return true;
  const remaining = [...operations];

  for (const operation of operations) {
    try {
      const { response, result } = await requestEventMutation(operation);
      if (response.status === 404 && operation.method === 'DELETE') {
        remaining.shift();
        setEventOutbox(remaining);
        continue;
      }
      if (response.status === 409) {
        showToast('離線期間修改的行程與其他裝置衝突，請先重新檢視');
        return false;
      }
      if (!response.ok) return false;
      backendRevision = Number(result.revision || backendRevision);
      remaining.shift();
      setEventOutbox(remaining);
    } catch {
      return false;
    }
  }
  return true;
}

function replaceLocalEvent(event) {
  const normalized = normalizeEvent(event);
  const index = events.findIndex((item) => idsMatch(item.id, normalized.id));
  if (index >= 0) {
    events[index] = normalized;
  } else {
    events.push(normalized);
  }
  saveEvents({ sync: false });
  renderCalendar();
  renderTodayTimeline();
  return normalized;
}

async function saveEventForm() {
  const data = Object.fromEntries(new FormData(eventForm));
  const existingEvent = data.id ? events.find((item) => idsMatch(item.id, data.id)) : null;
  const eventData = normalizeEvent({
    ...existingEvent,
    ...data,
    id: data.id || undefined,
    customerId: data.customerId || null,
    version: Number(data.version || existingEvent?.version || 1)
  });
  const operation = {
    eventId: eventData.id,
    method: existingEvent ? 'PUT' : 'POST',
    payload: existingEvent
      ? { ...eventData, expectedVersion: existingEvent.version }
      : eventData
  };

  if (backendReady) {
    try {
      const { response, result } = await requestEventMutation(operation);
      if (response.status === 409) {
        showToast('這筆行程已被其他裝置修改，請重新開啟後再編輯');
        return;
      }
      if (!response.ok) {
        showToast(result.details?.[0] || '行程資料未通過檢查');
        return;
      }
      backendRevision = Number(result.revision || backendRevision);
      replaceLocalEvent(result.item);
    } catch (error) {
      backendReady = false;
      console.warn('Event save blocked while the database is unavailable.', error);
      showToast('連線中斷，行程尚未儲存，請恢復連線後再試');
      return;
    }
  } else {
    showToast('目前無法連接正式資料庫，行程尚未儲存');
    return;
  }

  if (document.getElementById('calendar-page').classList.contains('active')) markReviewed('calendar');
  closeEventModal();
  showToast(`${existingEvent ? '已更新' : '已新增'}「${eventData.title}」`);
}

async function deleteCurrentEvent() {
  const eventId = document.getElementById('eventId').value;
  const existingEvent = events.find((item) => idsMatch(item.id, eventId));
  if (!existingEvent || !window.confirm(`確定要刪除「${existingEvent.title}」嗎？`)) return;
  const operation = {
    eventId: existingEvent.id,
    method: 'DELETE',
    payload: { expectedVersion: existingEvent.version }
  };

  if (backendReady) {
    try {
      const { response, result } = await requestEventMutation(operation);
      if (response.status === 409) {
        showToast('這筆行程已被其他裝置修改，請重新開啟後再刪除');
        return;
      }
      if (!response.ok && response.status !== 404) {
        showToast('行程暫時無法刪除');
        return;
      }
      backendRevision = Number(result.revision || backendRevision);
    } catch (error) {
      backendReady = false;
      console.warn('Event deletion blocked while the database is unavailable.', error);
      showToast('連線中斷，行程尚未刪除');
      return;
    }
  } else {
    showToast('目前無法連接正式資料庫，行程尚未刪除');
    return;
  }

  events = events.filter((item) => !idsMatch(item.id, existingEvent.id));
  saveEvents({ sync: false });
  renderCalendar();
  renderTodayTimeline();
  closeEventModal();
  showToast(`已刪除「${existingEvent.title}」`);
}

async function initializeBackendSync() {
  if (!window.location.protocol.startsWith('http')) return;
  try {
    const response = await apiFetch('/api/state', { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`API returned ${response.status}`);
    const state = await response.json();
    backendRevision = Number(state.revision || 0);
    backendReady = true;

    if (getEventOutbox().length) {
      const replayed = await replayEventOutbox();
      if (!replayed) return;
      const refreshedResponse = await apiFetch('/api/state', { headers: { Accept: 'application/json' } });
      if (!refreshedResponse.ok) throw new Error(`API returned ${refreshedResponse.status}`);
      applyBackendState(await refreshedResponse.json());
    } else {
      applyBackendState(state);
    }
  } catch (error) {
    backendReady = false;
    console.warn('Starting in local-only mode.', error);
  }
}

function hydrateWeeklyInsights() {
  const data = window.WEEKLY_INSIGHTS;
  if (!data) return;

  const updated = new Date(data.lastUpdated);
  if (!Number.isNaN(updated.getTime())) {
    document.getElementById('lastUpdated').innerHTML = `${icons.refresh} 最後整理：${updated.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })} ${updated.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  }

  const tabCounts = { global: data.global?.length || 0, taiwan: data.taiwan?.length || 0, regulation: data.regulation?.length || 0 };
  document.querySelectorAll('[data-insight-tab]').forEach((tab) => {
    const count = tab.querySelector('span');
    if (count) count.textContent = tabCounts[tab.dataset.insightTab];
  });

  if (data.global?.length) {
    const lead = data.global[0];
    document.querySelector('.lead-copy h3').textContent = lead.title;
    document.querySelector('.lead-copy > p').textContent = lead.summary;
    document.querySelector('.advisor-note p').textContent = lead.advisorNote || '請依客戶需求與風險屬性進行說明。';
    const globalGrid = document.querySelector('[data-insight-content="global"] .story-grid');
    globalGrid.innerHTML = data.global.slice(0, 3).map((story, index) => `<article class="story-card panel">
      <div class="story-number">${String(index + 1).padStart(2, '0')}</div>
      <span class="news-category">${escapeHTML(story.category)}</span>
      <h4>${escapeHTML(story.title)}</h4>
      <p>${escapeHTML(story.summary)}</p>
      <div class="story-footer"><span>${escapeHTML(story.source)}</span>${sourceButtonMarkup(story.url, '來源')}</div>
    </article>`).join('');
  }

  if (data.taiwan?.length) {
    const taiwanGrid = document.querySelector('[data-insight-content="taiwan"] .story-grid');
    taiwanGrid.innerHTML = data.taiwan.slice(0, 6).map((story, index) => `<article class="story-card panel">
      <div class="story-number">${String(index + 1).padStart(2, '0')}</div>
      <span class="news-category">${escapeHTML(story.category)}</span>
      <h4>${escapeHTML(story.title)}</h4>
      <p>${escapeHTML(story.summary)}</p>
      <div class="story-footer"><span>${escapeHTML(story.source)}</span>${sourceButtonMarkup(story.url, '官方來源')}</div>
    </article>`).join('');
  }

  if (data.regulation?.length) {
    const statusClass = { '需檢視': 'review', '持續關注': 'watch', '資訊': 'info' };
    const regulationList = document.querySelector('.regulation-list');
    regulationList.innerHTML = data.regulation.slice(0, 6).map((item) => {
      const date = new Date(`${item.publishedDate}T00:00:00`);
      const day = Number.isNaN(date.getTime()) ? '--' : String(date.getDate()).padStart(2, '0');
      const month = Number.isNaN(date.getTime()) ? '---' : date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
      return `<article class="regulation-item panel">
        <div class="reg-date"><strong>${day}</strong><span>${month}</span></div>
        <div class="reg-copy">
          <div><span class="news-category">${escapeHTML(item.category)}</span><span class="status-chip ${statusClass[item.status] || 'info'}">${escapeHTML(item.status || '資訊')}</span></div>
          <h4>${escapeHTML(item.title)}</h4><p>${escapeHTML(item.summary)}</p>
          <div class="impact"><strong>可能影響：</strong>${escapeHTML(item.impact || '請依個案評估')}</div>
        </div>
        ${sourceButtonMarkup(item.url, item.source || '查看來源').replace('<button ', '<button class="secondary-button" ')}
      </article>`;
    }).join('');
  }
}

function hydrateDailyQuote() {
  const quote = window.DAILY_QUOTE;
  if (!quote) return;
  document.getElementById('dailyQuoteTranslation').textContent = quote.translation;
  document.getElementById('dailyQuoteOriginal').textContent = quote.original;
  document.getElementById('dailyQuoteSource').textContent = quote.source;
  document.getElementById('dailyQuoteWork').textContent = quote.work || quote.originalLanguage || '經典語錄';
  document.getElementById('dailyQuoteExplanation').textContent = quote.aiExplanation;
  const updated = new Date(quote.updatedAt);
  document.getElementById('dailyQuoteDate').textContent = Number.isNaN(updated.getTime())
    ? '今日'
    : `${updated.getMonth() + 1} 月 ${updated.getDate()} 日`;
}

document.getElementById('pageEyebrow').textContent = dashboardDateLabel;
document.getElementById('miniMonth').textContent = `${appToday.getMonth() + 1}月`;
document.getElementById('miniDay').textContent = appToday.getDate();
document.querySelector('.mini-date-card small').textContent = weekdayNames[appToday.getDay()];
migrateLegacyRelationships();
refreshCustomerRelationshipOptions();
hydrateDailyQuote();
hydrateWeeklyInsights();
renderCalendar();
renderTodayTimeline();
renderPolicies();
renderProducts();
renderTeam();
renderCustomers();
renderCompanies();
updateReviewIndicators();
initializeAuthentication();
window.addEventListener('online', () => {
  if (currentUser && !backendReady) initializeBackendSync();
});

if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((error) => {
      console.warn('Service worker registration failed.', error);
    });
  });
}
