# StudyFlow AI — Backend API

Node.js + Express + SQLite backend for the StudyFlow AI student platform.

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Framework | Express 4 |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (access + refresh tokens) |
| Password hashing | bcryptjs (12 rounds) |
| AI | Anthropic Claude API |
| Payments | Razorpay (sandbox) |
| Validation | express-validator |
| Security | helmet, cors, express-rate-limit |

---

## Project Structure

```
studyflow-backend/
├── server.js                  ← Entry point
├── .env.example               ← Copy to .env and fill in
├── config/
│   ├── database.js            ← SQLite init + schema migrations
│   └── auth.js                ← JWT helpers + refresh token store
├── middleware/
│   ├── auth.js                ← authenticate, requirePro, checkLimits
│   ├── validate.js            ← express-validator rule sets
│   └── errorHandler.js        ← Centralised error handler + asyncHandler
├── models/
│   ├── User.js                ← User CRUD + password + plan management
│   ├── Note.js                ← Note CRUD
│   ├── Deadline.js            ← Deadline CRUD + bulk insert
│   └── StudyPlan.js           ← StudyPlan + Payment models
├── services/
│   └── claudeAI.js            ← All Claude API calls
└── routes/
    ├── auth.js                ← /api/auth/*
    ├── notes.js               ← /api/notes/*
    ├── deadlines.js           ← /api/deadlines/*
    ├── studyPlans.js          ← /api/study-plans/* + /api/resources/*
    └── payments.js            ← /api/payments/*
```

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — set ANTHROPIC_API_KEY, RAZORPAY keys, JWT secrets

# 3. Start dev server (auto-restarts on changes)
npm run dev

# 4. Start production server
npm start
```

SQLite database is created automatically at `./data/studyflow.db` on first run.

---

## API Reference

All endpoints are prefixed with `/api`.

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/register` | ✗ | Create account |
| POST | `/login` | ✗ | Login → tokens |
| POST | `/refresh` | ✗ | Refresh access token |
| POST | `/logout` | ✗ | Revoke refresh token |
| POST | `/logout-all` | ✓ | Revoke all sessions |
| GET  | `/me` | ✓ | Get current user |
| PUT  | `/me` | ✓ | Update profile |
| PUT  | `/me/password` | ✓ | Change password |
| DELETE | `/me` | ✓ | Deactivate account |

**Register body:**
```json
{
  "name": "Arjun Mehta",
  "email": "arjun@bits.edu",
  "password": "SecurePass1",
  "course": "B.Tech CSE"
}
```

**Login response:**
```json
{
  "user": { "id": "...", "name": "...", "email": "...", "plan": "free" },
  "accessToken": "eyJ...",
  "refreshToken": "eyJ..."
}
```

---

### Notes — `/api/notes` 🔒

| Method | Endpoint | Plan | Description |
|--------|----------|------|-------------|
| GET | `/` | Free | List all notes |
| POST | `/summarise` | Free (5/mo) | AI summarise text |
| POST | `/` | Free | Save a note |
| GET | `/:id` | Free | Get single note |
| PUT | `/:id` | Free | Rename note |
| DELETE | `/:id` | Free | Delete note |

**Summarise body:**
```json
{ "content": "...your notes...", "title": "Chapter 5" }
```

**Summarise response:**
```json
{
  "title": "Thermodynamics — Laws & Applications",
  "summary": "Two-sentence overview...",
  "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
  "topics": ["Thermodynamics", "Entropy", "Heat Transfer"],
  "difficulty": "Intermediate",
  "usage": { "used": 3, "limit": 5, "plan": "free" }
}
```

---

### Deadlines — `/api/deadlines` 🔒

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all deadlines |
| GET | `/upcoming?days=7` | Deadlines in next N days |
| POST | `/` | Add single deadline |
| POST | `/extract` | AI extract from syllabus |
| PUT | `/:id` | Update deadline |
| PATCH | `/:id/done` | Toggle done status |
| DELETE | `/:id` | Delete deadline |

**Add deadline body:**
```json
{
  "title": "Physics Mid-Term",
  "due_date": "2026-04-15",
  "type": "exam",
  "priority": "high"
}
```

---

### Study Plans — `/api/study-plans` 🔒

| Method | Endpoint | Plan | Description |
|--------|----------|------|-------------|
| POST | `/generate` | Free (3 total) | AI generate + save |
| GET | `/` | Free | List plans |
| GET | `/:id` | Free | Get single plan |
| DELETE | `/:id` | Free | Delete plan |

**Generate body:**
```json
{
  "subject": "Organic Chemistry",
  "exam_date": "2026-05-01",
  "topics": "Alkanes, Alkenes, Reaction Mechanisms, Functional Groups",
  "level": "Intermediate"
}
```

---

### Resources — `/api/resources` 🔒

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/recommend` | AI recommend resources |
| GET | `/history` | Past searches |
| GET | `/history/:id` | Get search results |

**Recommend body:**
```json
{ "topic": "Binary Search Trees", "level": "Beginner" }
```

---

### Payments — `/api/payments` 🔒

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create-order` | Create Razorpay order |
| POST | `/verify` | Verify payment + upgrade |
| POST | `/webhook` | Razorpay webhook (no auth) |
| GET | `/history` | Payment history |

**Razorpay flow:**
1. Frontend calls `POST /create-order` → gets `orderId` + `keyId`
2. Open Razorpay checkout with those details
3. On success, call `POST /verify` with the three Razorpay fields
4. Backend verifies HMAC signature → upgrades plan to `pro`

---

## Authentication

Include the access token in all protected requests:
```
Authorization: Bearer <accessToken>
```

When the access token expires (401 + `"code": "TOKEN_EXPIRED"`), call:
```
POST /api/auth/refresh
Body: { "refreshToken": "..." }
```

---

## Rate Limits

| Endpoint group | Window | Max requests |
|---|---|---|
| All `/api/*` | 15 min | 100 |
| AI endpoints | 15 min | 20 |

---

## Plan Limits

| Feature | Free | Pro |
|---|---|---|
| AI Summaries | 5/month | Unlimited |
| Study Plans | 3 total | Unlimited |
| Deadline extraction | ✓ | ✓ |
| Resource recommendations | ✓ | ✓ |

---

## Environment Variables

See `.env.example` for the full list. Required variables:
- `JWT_SECRET` — min 32 chars, random
- `JWT_REFRESH_SECRET` — different from above
- `ANTHROPIC_API_KEY` — from console.anthropic.com
- `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET` — from Razorpay dashboard (use test keys)

---

## Deployment (Production)

```bash
# Build frontend and copy to public/
cp -r ../studyflow-frontend/dist ./public

# Set NODE_ENV
export NODE_ENV=production

# Start
npm start
```

For production, consider:
- Using `pm2` for process management
- Setting up a reverse proxy (nginx) in front of Express
- Moving SQLite to PostgreSQL for multi-instance deployments
- Adding Redis for refresh token storage
