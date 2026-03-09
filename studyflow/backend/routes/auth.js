// routes/auth.js
// POST /api/auth/register
// POST /api/auth/login
// POST /api/auth/refresh
// POST /api/auth/logout
// GET  /api/auth/me

const express = require('express');
const router  = express.Router();

const User             = require('../models/User');
const { issueTokenPair, validateRefreshToken, revokeRefreshToken, revokeAllUserTokens } = require('../config/auth');
const { authenticate } = require('../middleware/auth');
const { registerRules, loginRules } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');

// ── Register ──────────────────────────────────────────────────────────────────
router.post('/register', registerRules, asyncHandler(async (req, res) => {
  const { name, email, password, course } = req.body;
  const user = await User.create({ name, email, password, course });

  const { accessToken, refreshToken } = issueTokenPair(user);

  res.status(201).json({
    message: 'Account created successfully.',
    user: sanitise(user),
    accessToken,
    refreshToken,
  });
}));

// ── Login ─────────────────────────────────────────────────────────────────────
router.post('/login', loginRules, asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = User.findByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid email or password.' });
  if (!user.is_active) return res.status(401).json({ error: 'Account is deactivated.' });

  const valid = await User.verifyPassword(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password.' });

  const { accessToken, refreshToken } = issueTokenPair(user);

  res.json({
    message: 'Logged in successfully.',
    user: sanitise(user),
    accessToken,
    refreshToken,
  });
}));

// ── Refresh Access Token ──────────────────────────────────────────────────────
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token required.' });

  const stored = validateRefreshToken(refreshToken);
  if (!stored) return res.status(401).json({ error: 'Invalid or expired refresh token.' });

  const user = User.findById(stored.user_id);
  if (!user || !user.is_active) return res.status(401).json({ error: 'User not found.' });

  // Rotate token
  revokeRefreshToken(refreshToken);
  const { accessToken, refreshToken: newRefresh } = issueTokenPair(user);

  res.json({ accessToken, refreshToken: newRefresh });
}));

// ── Logout ────────────────────────────────────────────────────────────────────
router.post('/logout', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) revokeRefreshToken(refreshToken);
  res.json({ message: 'Logged out.' });
}));

// ── Logout All Devices ────────────────────────────────────────────────────────
router.post('/logout-all', authenticate, asyncHandler(async (req, res) => {
  revokeAllUserTokens(req.user.id);
  res.json({ message: 'All sessions revoked.' });
}));

// ── Get Current User ──────────────────────────────────────────────────────────
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({ user: sanitise(req.user) });
}));

// ── Update Profile ─────────────────────────────────────────────────────────────
router.put('/me', authenticate, asyncHandler(async (req, res) => {
  const { name, course } = req.body;
  const updated = User.updateProfile(req.user.id, { name, course });
  res.json({ user: sanitise(updated) });
}));

// ── Change Password ────────────────────────────────────────────────────────────
router.put('/me/password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required.' });
  if (newPassword.length < 8) return res.status(422).json({ error: 'New password must be at least 8 characters.' });

  const user = User.findByEmail(req.user.email);
  const valid = await User.verifyPassword(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect.' });

  await User.changePassword(req.user.id, newPassword);
  revokeAllUserTokens(req.user.id);

  res.json({ message: 'Password changed. Please log in again.' });
}));

// ── Delete Account ─────────────────────────────────────────────────────────────
router.delete('/me', authenticate, asyncHandler(async (req, res) => {
  User.deactivate(req.user.id);
  revokeAllUserTokens(req.user.id);
  res.json({ message: 'Account deactivated.' });
}));

// ── Sanitise user object (remove internal fields) ─────────────────────────────
function sanitise(user) {
  const { password_hash, is_active, ...safe } = user;
  return safe;
}

module.exports = router;
