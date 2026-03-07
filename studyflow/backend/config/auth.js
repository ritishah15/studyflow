// config/auth.js
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const db     = require('./database');

const ACCESS_SECRET  = process.env.JWT_SECRET         || 'dev_secret_change_me';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev_refresh_secret';
const ACCESS_EXP     = process.env.JWT_EXPIRES_IN     || '7d';
const REFRESH_EXP    = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

function signAccessToken(payload)  { return jwt.sign(payload, ACCESS_SECRET,  { expiresIn: ACCESS_EXP }); }
function signRefreshToken(payload) { return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXP }); }
function verifyAccessToken(token)  { return jwt.verify(token, ACCESS_SECRET); }
function verifyRefreshToken(token) { return jwt.verify(token, REFRESH_SECRET); }

async function storeRefreshToken(userId, token) {
  const hash      = crypto.createHash('sha256').update(token).digest('hex');
  const id        = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await db.run_(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)`,
    [id, userId, hash, expiresAt]
  );
}

async function validateRefreshToken(token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return db.get_(
    `SELECT * FROM refresh_tokens WHERE token_hash = ? AND expires_at > datetime('now')`,
    [hash]
  );
}

async function revokeRefreshToken(token) {
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await db.run_(`DELETE FROM refresh_tokens WHERE token_hash = ?`, [hash]);
}

async function revokeAllUserTokens(userId) {
  await db.run_(`DELETE FROM refresh_tokens WHERE user_id = ?`, [userId]);
}

async function issueTokenPair(user) {
  const payload      = { id: user.id, email: user.email, plan: user.plan };
  const accessToken  = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  await storeRefreshToken(user.id, refreshToken);
  return { accessToken, refreshToken };
}

module.exports = {
  signAccessToken, signRefreshToken,
  verifyAccessToken, verifyRefreshToken,
  storeRefreshToken, validateRefreshToken,
  revokeRefreshToken, revokeAllUserTokens,
  issueTokenPair,
};
