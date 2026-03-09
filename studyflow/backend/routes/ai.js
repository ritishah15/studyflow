// routes/ai.js
// Simple AI proxy — frontend calls these, backend calls Claude API with the secret key
// No auth required so it works with the localStorage-based frontend auth too

const express = require('express');
const router  = express.Router();
const { asyncHandler, createError } = require('../middleware/errorHandler');

const MODEL   = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const API_URL = 'https://api.anthropic.com/v1/messages';

// ── Core Claude caller ────────────────────────────────────────────────────────
async function callClaude(userPrompt, systemPrompt, maxTokens = 1200) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw createError(503, 'ANTHROPIC_API_KEY is not set in the .env file.');

  const body = {
    model: MODEL,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: userPrompt }],
  };
  if (systemPrompt) body.system = systemPrompt;

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('[Claude API Error]', res.status, text);
    if (res.status === 401) throw createError(401, 'Invalid Anthropic API key. Check ANTHROPIC_API_KEY in your .env file.');
    if (res.status === 429) throw createError(429, 'Claude API rate limit reached. Please wait a moment and try again.');
    throw createError(502, 'Claude API returned an error. Please try again.');
  }

  const data  = await res.json();
  const raw   = data.content?.map(c => c.text || '').join('') || '';
  const clean = raw.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(clean);
  } catch {
    throw createError(502, 'AI returned an unexpected response format. Please try again.');
  }
}

// ── POST /api/ai/summarize ────────────────────────────────────────────────────
router.post('/summarize', asyncHandler(async (req, res) => {
  const { content } = req.body;
  if (!content || content.trim().length < 30) {
    throw createError(422, 'Please provide at least 30 characters of notes to summarize.');
  }

  const result = await callClaude(
    `Summarize these student notes. Return ONLY a JSON object with keys:
     "title" (string), "summary" (2-3 sentence overview string),
     "keyPoints" (array of exactly 5 bullet point strings),
     "topics" (array of 3-5 topic tag strings),
     "difficulty" (one of: "Beginner", "Intermediate", "Advanced").
     Notes:\n\n${content.slice(0, 6000)}`,
    'You are an expert academic assistant. Return ONLY valid JSON with no markdown fences, no explanation, no extra text.',
    1000
  );

  res.json({ result });
}));

// ── POST /api/ai/study-plan ───────────────────────────────────────────────────
router.post('/study-plan', asyncHandler(async (req, res) => {
  const { subject, examDate, topics } = req.body;
  if (!subject || !examDate || !topics) {
    throw createError(422, 'subject, examDate, and topics are all required.');
  }

  const daysLeft = Math.ceil((new Date(examDate) - Date.now()) / 86_400_000);
  if (daysLeft < 1) throw createError(422, 'Exam date must be in the future.');

  const result = await callClaude(
    `Create a realistic study plan for a student.
     Subject: ${subject}
     Days until exam: ${daysLeft}
     Topics to cover: ${topics}

     Return ONLY a JSON object with keys:
     "title" (string), "totalDays" (number), "dailyHours" (number 1-8),
     "plan" (array of up to ${Math.min(daysLeft, 21)} objects each with:
       "day" number, "focus" string, "tasks" array of 3 strings, "duration" string like "3 hours").`,
    'You are an expert academic planner. Return ONLY valid JSON with no markdown fences.',
    2000
  );

  res.json({ result });
}));

// ── POST /api/ai/extract-deadlines ───────────────────────────────────────────
router.post('/extract-deadlines', asyncHandler(async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length < 30) {
    throw createError(422, 'Please provide syllabus text (at least 30 characters).');
  }

  const result = await callClaude(
    `Extract all deadlines, exams, assignments, projects, and quizzes from this syllabus text.
     Return ONLY a JSON array. Each item must have:
     "title" (string), "dueDate" (YYYY-MM-DD string, estimate if vague),
     "type" (one of: "exam", "assignment", "project", "quiz"),
     "priority" (one of: "high", "medium", "low").
     If nothing is found return an empty array [].
     Syllabus:\n\n${text.slice(0, 6000)}`,
    'You are an academic assistant. Return ONLY a valid JSON array with no markdown fences.',
    1500
  );

  // result should be an array
  const arr = Array.isArray(result) ? result : (result.deadlines || []);
  res.json({ result: arr });
}));

// ── POST /api/ai/resources ────────────────────────────────────────────────────
router.post('/resources', asyncHandler(async (req, res) => {
  const { topic, level } = req.body;
  if (!topic) throw createError(422, 'topic is required.');

  const result = await callClaude(
    `Recommend 6 high-quality learning resources for the topic: "${topic}" at ${level || 'Intermediate'} level.
     Return ONLY a JSON object with a "resources" key containing an array of 6 items.
     Each item must have:
     "title" (string), "type" (one of: "video","article","practice","book"),
     "platform" (e.g. YouTube, Coursera, GeeksforGeeks),
     "description" (1 sentence), "estimatedTime" (e.g. "20 min"),
     "link" (a realistic plausible URL starting with https://).`,
    'You are an educational resource curator. Return ONLY valid JSON with no markdown fences.',
    1200
  );

  res.json({ result });
}));

module.exports = router;