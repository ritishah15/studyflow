// middleware/auth.js
// JWT authentication + plan-level authorization middleware

const { verifyAccessToken } = require('../config/auth');
const db = require('../config/database');

// ── Authenticate (required) ───────────────────────────────────────────────────
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token missing or malformed.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);

    // Fetch fresh user from DB to catch plan changes / deactivation
    const user = db.prepare(
      'SELECT id, name, email, course, plan, summaries_used, plans_created, avatar_url, is_active FROM users WHERE id = ?'
    ).get(decoded.id);

    if (!user || !user.is_active) {
      return res.status(401).json({ error: 'Account not found or deactivated.' });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Access token expired.', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid access token.' });
  }
}

// ── Authenticate (optional — does not block unauthenticated requests) ─────────
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  try {
    const decoded = verifyAccessToken(authHeader.split(' ')[1]);
    const user = db.prepare(
      'SELECT id, name, email, course, plan, summaries_used, plans_created FROM users WHERE id = ?'
    ).get(decoded.id);
    req.user = user || null;
  } catch {
    req.user = null;
  }
  next();
}

// ── Require Pro Plan ──────────────────────────────────────────────────────────
function requirePro(req, res, next) {
  if (req.user.plan !== 'pro') {
    return res.status(403).json({
      error: 'This feature requires a Pro plan.',
      code: 'PLAN_REQUIRED',
      upgradeUrl: '/billing',
    });
  }
  next();
}

// ── Check Free Plan Limits ────────────────────────────────────────────────────
function checkSummaryLimit(req, res, next) {
  const FREE_LIMIT = 5;
  if (req.user.plan === 'pro') return next();
  if (req.user.summaries_used >= FREE_LIMIT) {
    return res.status(403).json({
      error: `Free plan allows ${FREE_LIMIT} AI summaries per month. Upgrade to Pro for unlimited.`,
      code: 'LIMIT_REACHED',
      used: req.user.summaries_used,
      limit: FREE_LIMIT,
    });
  }
  next();
}

function checkPlanLimit(req, res, next) {
  const FREE_PLAN_LIMIT = 3;
  if (req.user.plan === 'pro') return next();
  if (req.user.plans_created >= FREE_PLAN_LIMIT) {
    return res.status(403).json({
      error: `Free plan allows ${FREE_PLAN_LIMIT} study plans. Upgrade to Pro for unlimited.`,
      code: 'LIMIT_REACHED',
    });
  }
  next();
}

module.exports = {
  authenticate,
  optionalAuth,
  requirePro,
  checkSummaryLimit,
  checkPlanLimit,
};
