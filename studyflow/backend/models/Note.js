// models/Note.js
const db  = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const Note = {
  async create({ user_id, title, raw_text, summary, key_points, topics, difficulty }) {
    const id = uuidv4();
    await db.run_(
      `INSERT INTO notes (id, user_id, title, raw_text, summary, key_points, topics, difficulty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user_id, title || 'Untitled Note', raw_text || null, summary || null,
       JSON.stringify(key_points || []), JSON.stringify(topics || []), difficulty || null]
    );
    return Note.findById(id);
  },

  async findById(id) {
    const row = await db.get_('SELECT * FROM notes WHERE id = ?', [id]);
    return row ? Note._parse(row) : null;
  },

  async findAllByUser(userId, { limit = 50, offset = 0 } = {}) {
    const rows = await db.all_(
      'SELECT * FROM notes WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [userId, limit, offset]
    );
    return rows.map(Note._parse);
  },

  async countByUser(userId) {
    const row = await db.get_('SELECT COUNT(*) as c FROM notes WHERE user_id = ?', [userId]);
    return row.c;
  },

  async update(id, userId, { title }) {
    await db.run_(
      `UPDATE notes SET title = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
      [title, id, userId]
    );
    return Note.findById(id);
  },

  async delete(id, userId) {
    const r = await db.run_('DELETE FROM notes WHERE id = ? AND user_id = ?', [id, userId]);
    return r.changes > 0;
  },

  _parse(row) {
    return {
      ...row,
      key_points: JSON.parse(row.key_points || '[]'),
      topics:     JSON.parse(row.topics     || '[]'),
    };
  },
};

module.exports = Note;
