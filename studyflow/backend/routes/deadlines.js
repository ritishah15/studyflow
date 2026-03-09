// routes/deadlines.js
// GET    /api/deadlines           — list all deadlines
// GET    /api/deadlines/upcoming  — deadlines in next N days
// POST   /api/deadlines           — add single deadline
// POST   /api/deadlines/extract   — AI extract from syllabus
// PUT    /api/deadlines/:id       — update deadline
// PATCH  /api/deadlines/:id/done  — toggle done status
// DELETE /api/deadlines/:id       — delete deadline

const express  = require('express');
const router   = express.Router();

const Deadline  = require('../models/Deadline');
const claude    = require('../services/claudeAI');
const { authenticate, requirePro } = require('../middleware/auth');
const { deadlineCreateRules, deadlineUpdateRules, syllabusRules } = require('../middleware/validate');
const { asyncHandler, createError } = require('../middleware/errorHandler');

router.use(authenticate);

// ── List ──────────────────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const includeDone = req.query.include_done === 'true';
  const deadlines   = Deadline.findAllByUser(req.user.id, { includeDone });
  const total       = Deadline.countByUser(req.user.id);
  res.json({ deadlines, total });
}));

// ── Upcoming ──────────────────────────────────────────────────────────────────
router.get('/upcoming', asyncHandler(async (req, res) => {
  const days = Math.min(parseInt(req.query.days || 7), 90);
  const deadlines = Deadline.findUpcoming(req.user.id, days);
  res.json({ deadlines, days });
}));

// ── Add Single ────────────────────────────────────────────────────────────────
router.post('/', deadlineCreateRules, asyncHandler(async (req, res) => {
  const { title, due_date, type, priority, notes } = req.body;
  const deadline = Deadline.create({ user_id: req.user.id, title, due_date, type, priority, notes });
  res.status(201).json({ deadline });
}));

// ── AI Extract from Syllabus ──────────────────────────────────────────────────
// Free users can use this but Pro gets better extraction (more tokens)
router.post('/extract', syllabusRules, asyncHandler(async (req, res) => {
  const { text } = req.body;

  const extracted = await claude.extractDeadlines(text);

  if (!extracted.length) {
    return res.json({
      message: 'No deadlines found in the provided text.',
      deadlines: [],
      saved: 0,
    });
  }

  // Bulk-insert into DB
  const saved = Deadline.bulkCreate(req.user.id, extracted);

  res.status(201).json({
    message: `${saved.length} deadline(s) extracted and saved.`,
    deadlines: saved,
    saved: saved.length,
  });
}));

// ── Update ────────────────────────────────────────────────────────────────────
router.put('/:id', deadlineUpdateRules, asyncHandler(async (req, res) => {
  const dl = Deadline.findById(req.params.id);
  if (!dl || dl.user_id !== req.user.id) throw createError(404, 'Deadline not found.');
  const updated = Deadline.update(req.params.id, req.user.id, req.body);
  res.json({ deadline: updated });
}));

// ── Toggle Done ───────────────────────────────────────────────────────────────
router.patch('/:id/done', asyncHandler(async (req, res) => {
  const dl = Deadline.findById(req.params.id);
  if (!dl || dl.user_id !== req.user.id) throw createError(404, 'Deadline not found.');
  const updated = Deadline.toggleDone(req.params.id, req.user.id);
  res.json({ deadline: updated });
}));

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = Deadline.delete(req.params.id, req.user.id);
  if (!deleted) throw createError(404, 'Deadline not found.');
  res.json({ message: 'Deadline deleted.' });
}));

module.exports = router;
