// routes/studyPlans.js
// POST /api/study-plans/generate — AI generate + save plan
// GET  /api/study-plans          — list user plans
// GET  /api/study-plans/:id      — get single plan
// DELETE /api/study-plans/:id   — delete plan

const express = require('express');
const router  = express.Router();

const { StudyPlan } = require('../models/StudyPlan');
const User          = require('../models/User');
const claude        = require('../services/claudeAI');
const { authenticate, checkPlanLimit } = require('../middleware/auth');
const { studyPlanRules }               = require('../middleware/validate');
const { asyncHandler, createError }    = require('../middleware/errorHandler');

router.use(authenticate);

// ── Generate + Save ───────────────────────────────────────────────────────────
router.post('/generate', checkPlanLimit, studyPlanRules, asyncHandler(async (req, res) => {
  const { subject, exam_date, topics, level } = req.body;

  const aiResult = await claude.generateStudyPlan(subject, exam_date, topics, level);

  const plan = StudyPlan.create({
    user_id:    req.user.id,
    title:      aiResult.title || `${subject} Study Plan`,
    subject,
    exam_date,
    total_days: aiResult.totalDays,
    daily_hours: aiResult.dailyHours,
    level,
    plan_json:  aiResult.plan,
  });

  User.incrementPlans(req.user.id);

  res.status(201).json({
    plan,
    usage: {
      created: req.user.plans_created + 1,
      limit:   req.user.plan === 'pro' ? null : 3,
      plan:    req.user.plan,
    },
  });
}));

// ── List ──────────────────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const plans = StudyPlan.findAllByUser(req.user.id);
  res.json({ plans, total: plans.length });
}));

// ── Get Single ────────────────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const plan = StudyPlan.findById(req.params.id);
  if (!plan || plan.user_id !== req.user.id) throw createError(404, 'Study plan not found.');
  res.json({ plan });
}));

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = StudyPlan.delete(req.params.id, req.user.id);
  if (!deleted) throw createError(404, 'Study plan not found.');
  res.json({ message: 'Study plan deleted.' });
}));

module.exports = router;


// ════════════════════════════════════════════════════════════════════════════
// routes/resources.js (exported separately below)
// POST /api/resources/recommend  — AI recommend resources
// GET  /api/resources/history    — past searches
// ════════════════════════════════════════════════════════════════════════════

const resourceRouter = express.Router();
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { resourceRules } = require('../middleware/validate');

resourceRouter.use(authenticate);

// ── Recommend ─────────────────────────────────────────────────────────────────
resourceRouter.post('/recommend', resourceRules, asyncHandler(async (req, res) => {
  const { topic, level } = req.body;

  const aiResult = await claude.getResources(topic, level);

  // Persist the search
  const id = uuidv4();
  db.prepare(`
    INSERT INTO resource_searches (id, user_id, topic, level, results_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.user.id, topic, level, JSON.stringify(aiResult.resources));

  res.json({ resources: aiResult.resources, searchId: id });
}));

// ── History ───────────────────────────────────────────────────────────────────
resourceRouter.get('/history', asyncHandler(async (req, res) => {
  const rows = db.prepare(
    'SELECT id, topic, level, created_at FROM resource_searches WHERE user_id = ? ORDER BY created_at DESC LIMIT 20'
  ).all(req.user.id);
  res.json({ searches: rows });
}));

// ── Get single search result ──────────────────────────────────────────────────
resourceRouter.get('/history/:id', asyncHandler(async (req, res) => {
  const row = db.prepare(
    'SELECT * FROM resource_searches WHERE id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);
  if (!row) throw createError(404, 'Search not found.');
  res.json({ search: { ...row, results_json: JSON.parse(row.results_json) } });
}));

module.exports = { studyPlansRouter: router, resourceRouter };
