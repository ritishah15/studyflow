// frontend/js/backend.js
// Auth + Data → localStorage
// AI calls → Express backend at localhost:5000 (backend holds the API key safely)

const BACKEND = 'http://localhost:5000';

// ── LOCAL STORAGE DB ──────────────────────────────────────────────────────────
const DB = {
  get: (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
  del: (key) => localStorage.removeItem(key)
};

// ── AUTH (localStorage — no backend needed) ───────────────────────────────────
const Auth = {
  register(name, email, password, course) {
    const users = DB.get('sf_users') || {};
    if (users[email]) return { error: 'Email already registered.' };
    const user = {
      id: 'u_' + Date.now(),
      name, email, course,
      password: btoa(password),
      plan: 'free',
      createdAt: new Date().toISOString(),
      summariesUsed: 0,
      studyPlansCreated: 0,
      deadlines: [],
      notes: [],
      studyPlans: []
    };
    users[email] = user;
    DB.set('sf_users', users);
    const { password: _, ...safeUser } = user;
    DB.set('sf_session', safeUser);
    return { user: safeUser };
  },

  login(email, password) {
    const users = DB.get('sf_users') || {};
    const user = users[email];
    if (!user) return { error: 'No account found with this email.' };
    if (user.password !== btoa(password)) return { error: 'Incorrect password.' };
    const { password: _, ...safeUser } = user;
    DB.set('sf_session', safeUser);
    return { user: safeUser };
  },

  logout() { DB.del('sf_session'); window.location.href = 'index.html'; },
  getSession() { return DB.get('sf_session'); },

  requireAuth() {
    const user = Auth.getSession();
    if (!user) { window.location.href = 'login.html'; return null; }
    return user;
  },

  updateUser(data) {
    const session = Auth.getSession();
    if (!session) return;
    const users = DB.get('sf_users') || {};
    if (users[session.email]) {
      Object.assign(users[session.email], data);
      DB.set('sf_users', users);
      Object.assign(session, data);
      DB.set('sf_session', session);
    }
    return session;
  }
};

// ── AI — all calls go through the Express backend ────────────────────────────
const AI = {

  // Generic call to backend AI proxy
  async _post(endpoint, body) {
    const res = await fetch(`${BACKEND}/api/ai/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `AI request failed (${res.status})`);
    }
    const data = await res.json();
    // Return raw JSON string so dashboard.js can parse it the same way as before
    return JSON.stringify(data.result);
  },

  async summarizeNotes(text) {
    return AI._post('summarize', { content: text });
  },

  async generateStudyPlan(subject, examDate, topics) {
    return AI._post('study-plan', { subject, examDate, topics });
  },

  async extractDeadlines(syllabusText) {
    return AI._post('extract-deadlines', { text: syllabusText });
  },

  async getResourceRecommendations(topic, level) {
    return AI._post('resources', { topic, level });
  }
};

// ── UI UTILITIES ──────────────────────────────────────────────────────────────
const UI = {
  toast(msg, type = 'default', duration = 3500) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast'; el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.className = `toast ${type}`;
    setTimeout(() => el.classList.add('show'), 10);
    setTimeout(() => el.classList.remove('show'), duration);
  },

  loading(btn, isLoading, originalText) {
    if (isLoading) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Processing...`;
    } else {
      btn.disabled = false;
      btn.innerHTML = originalText;
    }
  },

  parseJSON(str) {
    try {
      const clean = str.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch { return null; }
  },

  formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  daysUntil(dateStr) {
    return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
  }
};

// ── DEADLINES DATA ────────────────────────────────────────────────────────────
const DeadlineDB = {
  getAll() {
    const user = Auth.getSession();
    if (!user) return [];
    const users = DB.get('sf_users') || {};
    return users[user.email]?.deadlines || [];
  },
  add(deadline) {
    const user = Auth.getSession();
    if (!user) return;
    const deadlines = DeadlineDB.getAll();
    deadline.id = 'd_' + Date.now();
    deadlines.push(deadline);
    Auth.updateUser({ deadlines });
    return deadline;
  },
  remove(id) {
    const deadlines = DeadlineDB.getAll().filter(d => d.id !== id);
    Auth.updateUser({ deadlines });
  }
};

// ── NOTES DATA ────────────────────────────────────────────────────────────────
const NotesDB = {
  getAll() {
    const user = Auth.getSession();
    if (!user) return [];
    const users = DB.get('sf_users') || {};
    return users[user.email]?.notes || [];
  },
  add(note) {
    const user = Auth.getSession();
    if (!user) return;
    const notes = NotesDB.getAll();
    note.id = 'n_' + Date.now();
    note.createdAt = new Date().toISOString();
    notes.unshift(note);
    Auth.updateUser({ notes });
    return note;
  }
};

window.SF = { DB, Auth, AI, UI, DeadlineDB, NotesDB };