// routes/notes.js
// GET    /api/notes           — list all notes for the user
// POST   /api/notes/summarise — AI summarise + optionally save
// POST   /api/notes           — save a note
// GET    /api/notes/:id       — get single note
// PUT    /api/notes/:id       — rename note
// DELETE /api/notes/:id       — delete note

const express = require('express');
const router  = express.Router();

const Note      = require('../models/Note');
const User      = require('../models/User');
const claude    = require('../services/claudeAI');
const { authenticate, checkSummaryLimit } = require('../middleware/auth');
const { noteCreateRules } = require('../middleware/validate');
const { asyncHandler, createError } = require('../middleware/errorHandler');

// All notes routes require authentication
router.use(authenticate);

// ── List ──────────────────────────────────────────────────────────────────────
router.get('/', asyncHandler(async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit  || 50), 100);
  const offset = parseInt(req.query.offset || 0);
  const notes  = Note.findAllByUser(req.user.id, { limit, offset });
  const total  = Note.countByUser(req.user.id);
  res.json({ notes, total, limit, offset });
}));

// ── AI Summarise (does NOT auto-save — client decides) ────────────────────────
router.post('/summarise', checkSummaryLimit, noteCreateRules, asyncHandler(async (req, res) => {
  const { content, title } = req.body;

  const aiResult = await claude.summariseNotes(content);

  // Increment counter after successful AI call
  User.incrementSummaries(req.user.id);

  res.json({
    title:      aiResult.title  || title || 'Untitled',
    summary:    aiResult.summary,
    keyPoints:  aiResult.keyPoints,
    topics:     aiResult.topics,
    difficulty: aiResult.difficulty,
    // Include usage info
    usage: {
      used:  req.user.summaries_used + 1,
      limit: req.user.plan === 'pro' ? null : 5,
      plan:  req.user.plan,
    },
  });
}));

// ── Save note (after AI summary or manually) ──────────────────────────────────
router.post('/', asyncHandler(async (req, res) => {
  const { title, raw_text, summary, key_points, topics, difficulty } = req.body;
  if (!title && !summary) throw createError(422, 'Title or summary is required.');

  const note = Note.create({
    user_id: req.user.id,
    title, raw_text, summary,
    key_points, topics, difficulty,
  });

  res.status(201).json({ note });
}));

// ── Get single ────────────────────────────────────────────────────────────────
router.get('/:id', asyncHandler(async (req, res) => {
  const note = Note.findById(req.params.id);
  if (!note || note.user_id !== req.user.id) throw createError(404, 'Note not found.');
  res.json({ note });
}));

// ── Rename ────────────────────────────────────────────────────────────────────
router.put('/:id', asyncHandler(async (req, res) => {
  const { title } = req.body;
  if (!title) throw createError(422, 'Title required.');
  const note = Note.findById(req.params.id);
  if (!note || note.user_id !== req.user.id) throw createError(404, 'Note not found.');
  const updated = Note.update(req.params.id, req.user.id, { title });
  res.json({ note: updated });
}));

// ── Delete ────────────────────────────────────────────────────────────────────
router.delete('/:id', asyncHandler(async (req, res) => {
  const deleted = Note.delete(req.params.id, req.user.id);
  if (!deleted) throw createError(404, 'Note not found.');
  res.json({ message: 'Note deleted.' });
}));

module.exports = router;
