// models/StudyPlan.js
const db  = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const StudyPlan = {
  async create({ user_id, title, subject, exam_date, total_days, daily_hours, level, plan_json }) {
    const id = uuidv4();
    await db.run_(
      `INSERT INTO study_plans (id, user_id, title, subject, exam_date, total_days, daily_hours, level, plan_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, user_id, title, subject, exam_date, total_days || null, daily_hours || null, level || null,
       typeof plan_json === 'string' ? plan_json : JSON.stringify(plan_json)]
    );
    return StudyPlan.findById(id);
  },

  async findById(id) {
    const row = await db.get_('SELECT * FROM study_plans WHERE id = ?', [id]);
    return row ? StudyPlan._parse(row) : null;
  },

  async findAllByUser(userId) {
    const rows = await db.all_('SELECT * FROM study_plans WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return rows.map(StudyPlan._parse);
  },

  async countByUser(userId) {
    const row = await db.get_('SELECT COUNT(*) as c FROM study_plans WHERE user_id = ?', [userId]);
    return row.c;
  },

  async delete(id, userId) {
    const r = await db.run_('DELETE FROM study_plans WHERE id = ? AND user_id = ?', [id, userId]);
    return r.changes > 0;
  },

  _parse(row) {
    return { ...row, plan_json: JSON.parse(row.plan_json || '[]') };
  },
};


// ── Payment ───────────────────────────────────────────────────────────────────

const Payment = {
  async create({ user_id, razorpay_order_id, amount, currency, plan }) {
    const id = uuidv4();
    await db.run_(
      `INSERT INTO payments (id, user_id, razorpay_order_id, amount, currency, plan)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, user_id, razorpay_order_id || null, amount, currency || 'INR', plan || 'pro']
    );
    return Payment.findById(id);
  },

  findById(id) {
    return db.get_('SELECT * FROM payments WHERE id = ?', [id]);
  },

  findByOrderId(orderId) {
    return db.get_('SELECT * FROM payments WHERE razorpay_order_id = ?', [orderId]);
  },

  findAllByUser(userId) {
    return db.all_('SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  },

  async markPaid(orderId, { razorpay_payment_id, razorpay_signature }) {
    await db.run_(
      `UPDATE payments SET status = 'paid', razorpay_payment_id = ?, razorpay_signature = ?,
       updated_at = datetime('now') WHERE razorpay_order_id = ?`,
      [razorpay_payment_id, razorpay_signature, orderId]
    );
    return Payment.findByOrderId(orderId);
  },

  async markFailed(orderId) {
    await db.run_(
      `UPDATE payments SET status = 'failed', updated_at = datetime('now') WHERE razorpay_order_id = ?`,
      [orderId]
    );
  },
};

module.exports = { StudyPlan, Payment };
