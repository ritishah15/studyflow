// models/User.js
const db     = require('../config/database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const SALT_ROUNDS = 12;

const User = {
  async create({ name, email, password, course }) {
    const existing = await db.get_('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      const err = new Error('An account with this email already exists.');
      err.statusCode = 409; throw err;
    }
    const id   = uuidv4();
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await db.run_(
      `INSERT INTO users (id, name, email, password_hash, course) VALUES (?, ?, ?, ?, ?)`,
      [id, name, email, hash, course || null]
    );
    return User.findById(id);
  },

  findById(id) {
    return db.get_(
      `SELECT id, name, email, course, plan, summaries_used, plans_created, avatar_url, is_active, created_at FROM users WHERE id = ?`,
      [id]
    );
  },

  findByEmail(email) {
    return db.get_(`SELECT * FROM users WHERE email = ?`, [email]);
  },

  async verifyPassword(plain, hash) {
    return bcrypt.compare(plain, hash);
  },

  async updateProfile(id, { name, course, avatar_url }) {
    const fields = []; const vals = [];
    if (name       !== undefined) { fields.push('name = ?');       vals.push(name); }
    if (course     !== undefined) { fields.push('course = ?');     vals.push(course); }
    if (avatar_url !== undefined) { fields.push('avatar_url = ?'); vals.push(avatar_url); }
    if (!fields.length) return User.findById(id);
    fields.push("updated_at = datetime('now')");
    vals.push(id);
    await db.run_(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, vals);
    return User.findById(id);
  },

  async upgradePlan(id, plan = 'pro') {
    await db.run_(`UPDATE users SET plan = ?, updated_at = datetime('now') WHERE id = ?`, [plan, id]);
    return User.findById(id);
  },

  async incrementSummaries(id) {
    await db.run_(`UPDATE users SET summaries_used = summaries_used + 1, updated_at = datetime('now') WHERE id = ?`, [id]);
  },

  async incrementPlans(id) {
    await db.run_(`UPDATE users SET plans_created = plans_created + 1, updated_at = datetime('now') WHERE id = ?`, [id]);
  },

  async changePassword(id, newPassword) {
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await db.run_(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, [hash, id]);
  },

  async deactivate(id) {
    await db.run_(`UPDATE users SET is_active = 0, updated_at = datetime('now') WHERE id = ?`, [id]);
  },
};

module.exports = User;
