// js/api.js
// Frontend API client — replaces the localStorage-based backend.js
// Talks to the Express backend at /api
//
// Usage:  const user = await API.auth.login(email, password);
//         const note = await API.notes.summarise(content, title);

const BASE = (window.API_BASE_URL || '') + '/api';

// ── Token Management ──────────────────────────────────────────────────────────
const TokenStore = {
  get access()  { return localStorage.getItem('sf_access'); },
  get refresh() { return localStorage.getItem('sf_refresh'); },
  set(access, refresh) {
    localStorage.setItem('sf_access', access);
    if (refresh) localStorage.setItem('sf_refresh', refresh);
  },
  clear() {
    localStorage.removeItem('sf_access');
    localStorage.removeItem('sf_refresh');
    localStorage.removeItem('sf_user');
  },
};

// ── HTTP Client ───────────────────────────────────────────────────────────────
async function request(method, path, body, retry = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (TokenStore.access) headers['Authorization'] = `Bearer ${TokenStore.access}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);

  // Token expired — try refresh once
  if (res.status === 401 && retry) {
    const refreshed = await tryRefresh();
    if (refreshed) return request(method, path, body, false);
    TokenStore.clear();
    window.location.href = '/login.html';
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'Request failed'), { status: res.status, data });
  return data;
}

async function tryRefresh() {
  const rt = TokenStore.refresh;
  if (!rt) return false;
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    TokenStore.set(data.accessToken, data.refreshToken);
    return true;
  } catch { return false; }
}

const get    = (path)        => request('GET',    path);
const post   = (path, body)  => request('POST',   path, body);
const put    = (path, body)  => request('PUT',    path, body);
const patch  = (path, body)  => request('PATCH',  path, body);
const del    = (path)        => request('DELETE', path);

// ── Auth API ──────────────────────────────────────────────────────────────────
const auth = {
  async register(name, email, password, course) {
    const data = await post('/auth/register', { name, email, password, course });
    TokenStore.set(data.accessToken, data.refreshToken);
    localStorage.setItem('sf_user', JSON.stringify(data.user));
    return data;
  },

  async login(email, password) {
    const data = await post('/auth/login', { email, password });
    TokenStore.set(data.accessToken, data.refreshToken);
    localStorage.setItem('sf_user', JSON.stringify(data.user));
    return data;
  },

  async logout() {
    try { await post('/auth/logout', { refreshToken: TokenStore.refresh }); } catch {}
    TokenStore.clear();
    window.location.href = '/index.html';
  },

  async me() {
    const data = await get('/auth/me');
    localStorage.setItem('sf_user', JSON.stringify(data.user));
    return data.user;
  },

  async updateProfile(name, course) {
    const data = await put('/auth/me', { name, course });
    localStorage.setItem('sf_user', JSON.stringify(data.user));
    return data.user;
  },

  async changePassword(currentPassword, newPassword) {
    return put('/auth/me/password', { currentPassword, newPassword });
  },

  getSession() {
    try { return JSON.parse(localStorage.getItem('sf_user')); } catch { return null; }
  },

  isLoggedIn() { return !!TokenStore.access && !!auth.getSession(); },

  requireAuth() {
    if (!auth.isLoggedIn()) { window.location.href = '/login.html'; return null; }
    return auth.getSession();
  },
};

// ── Notes API ─────────────────────────────────────────────────────────────────
const notes = {
  list: (limit = 50, offset = 0)   => get(`/notes?limit=${limit}&offset=${offset}`),
  summarise: (content, title = '') => post('/notes/summarise', { content, title }),
  save: (noteData)                  => post('/notes', noteData),
  get: (id)                         => get(`/notes/${id}`),
  rename: (id, title)              => put(`/notes/${id}`, { title }),
  delete: (id)                      => del(`/notes/${id}`),
};

// ── Deadlines API ─────────────────────────────────────────────────────────────
const deadlines = {
  list: (includeDone = false)   => get(`/deadlines?include_done=${includeDone}`),
  upcoming: (days = 7)          => get(`/deadlines/upcoming?days=${days}`),
  add: (data)                   => post('/deadlines', data),
  extract: (text)               => post('/deadlines/extract', { text }),
  update: (id, data)            => put(`/deadlines/${id}`, data),
  toggleDone: (id)              => patch(`/deadlines/${id}/done`),
  delete: (id)                  => del(`/deadlines/${id}`),
};

// ── Study Plans API ───────────────────────────────────────────────────────────
const studyPlans = {
  generate: (subject, exam_date, topics, level) =>
    post('/study-plans/generate', { subject, exam_date, topics, level }),
  list: ()    => get('/study-plans'),
  get: (id)   => get(`/study-plans/${id}`),
  delete: (id) => del(`/study-plans/${id}`),
};

// ── Resources API ─────────────────────────────────────────────────────────────
const resources = {
  recommend: (topic, level)  => post('/resources/recommend', { topic, level }),
  history: ()                => get('/resources/history'),
  getSearch: (id)            => get(`/resources/history/${id}`),
};

// ── Payments API ──────────────────────────────────────────────────────────────
const payments = {
  createOrder: ()                                  => post('/payments/create-order'),
  verify: (order_id, payment_id, signature)        =>
    post('/payments/verify', {
      razorpay_order_id:    order_id,
      razorpay_payment_id:  payment_id,
      razorpay_signature:   signature,
    }),
  history: () => get('/payments/history'),

  // Open Razorpay checkout — returns promise that resolves with payment details
  openCheckout(orderData) {
    return new Promise((resolve, reject) => {
      const options = {
        key:         orderData.keyId,
        amount:      orderData.amount,
        currency:    orderData.currency,
        name:        orderData.name,
        description: orderData.description,
        order_id:    orderData.orderId,
        prefill:     orderData.prefill || {},
        theme:       { color: '#f97316' },
        handler: async (response) => {
          try {
            const result = await payments.verify(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
            );
            resolve(result);
          } catch (err) {
            reject(err);
          }
        },
        modal: { ondismiss: () => reject(new Error('Payment cancelled.')) },
      };
      const rzp = new window.Razorpay(options);
      rzp.open();
    });
  },
};

// ── UI Utilities (kept for compatibility) ─────────────────────────────────────
const UI = {
  toast(msg, type = 'default', duration = 3500) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div'); el.id = 'toast'; el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = `toast ${type}`;
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => el.classList.remove('show'), duration);
  },
  loading(btn, isLoading, originalText = '') {
    btn.disabled = isLoading;
    btn.innerHTML = isLoading ? `<span class="spinner"></span> Processing...` : originalText;
  },
  formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },
  daysUntil(dateStr) {
    return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  },
};

// ── Export as global SF object (matches existing frontend code) ───────────────
window.SF = { auth, notes, deadlines, studyPlans, resources, payments, UI, TokenStore };
// Also export as API for new code
window.API = window.SF;
