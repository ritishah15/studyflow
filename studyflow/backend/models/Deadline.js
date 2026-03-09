// models/Deadline.js
const db  = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Deadline = {
  async create({ user_id, title, due_date, type, priority, notes }) {
    const id = uuidv4();
    await db.run_(
      `INSERT INTO deadlines (id, user_id, title, due_date, type, priority, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, user_id, title, due_date, type || 'assignment', priority || 'medium', notes || null]
    );
    return Deadline.findById(id);
  },

  async bulkCreate(userId, items) {
    const created = [];
    for (const item of items) {
      const dl = await Deadline.create({
        user_id:  userId,
        title:    item.title,
        due_date: item.dueDate || item.due_date,
        type:     item.type     || 'assignment',
        priority: item.priority || 'medium',
      });
      created.push(dl);
    }
    return created;
  },

  findById(id) {
    return db.get_('SELECT * FROM deadlines WHERE id = ?', [id]);
  },

  findAllByUser(userId, { includeDone = false } = {}) {
    const sql = includeDone
      ? 'SELECT * FROM deadlines WHERE user_id = ? ORDER BY due_date ASC'
      : 'SELECT * FROM deadlines WHERE user_id = ? AND is_done = 0 ORDER BY due_date ASC';
    return db.all_(sql, [userId]);
  },

  findUpcoming(userId, days = 7) {
    return db.all_(
      `SELECT * FROM deadlines WHERE user_id = ? AND is_done = 0
       AND due_date BETWEEN date('now') AND date('now', '+${days} days')
       ORDER BY due_date ASC`,
      [userId]
    );
  },

  async countByUser(userId) {
    const row = await db.get_('SELECT COUNT(*) as c FROM deadlines WHERE user_id = ? AND is_done = 0', [userId]);
    return row.c;
  },

  async update(id, userId, fields) {
    const allowed = ['title', 'due_date', 'type', 'priority', 'is_done', 'notes'];
    const sets = []; const vals = [];
    for (const key of allowed) {
      if (fields[key] !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(fields[key] === true ? 1 : fields[key] === false ? 0 : fields[key]);
      }
    }
    if (!sets.length) return Deadline.findById(id);
    vals.push(id, userId);
    await db.run_(`UPDATE deadlines SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`, vals);
    return Deadline.findById(id);
  },

  async toggleDone(id, userId) {
    await db.run_(
      `UPDATE deadlines SET is_done = CASE WHEN is_done = 0 THEN 1 ELSE 0 END WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    return Deadline.findById(id);
  },

  async delete(id, userId) {
    const r = await db.run_('DELETE FROM deadlines WHERE id = ? AND user_id = ?', [id, userId]);
    return r.changes > 0;
  },
};

module.exports = Deadline;
