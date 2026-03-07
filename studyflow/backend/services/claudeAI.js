// services/claudeAI.js
// Centralised wrapper around the Anthropic Claude API
// All AI calls go through here — easy to swap model or add caching later

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';
const API_URL = 'https://api.anthropic.com/v1/messages';

// ── Low-level fetch wrapper ───────────────────────────────────────────────────

async function callClaude(userPrompt, systemPrompt = '', maxTokens = 1200) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set in environment.');

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
    const err  = new Error(`Claude API error ${res.status}: ${text}`);
    err.statusCode = res.status === 429 ? 429 : 502;
    throw err;
  }

  const data = await res.json();
  return data.content?.map(c => c.text || '').join('') || '';
}

// ── JSON guard ────────────────────────────────────────────────────────────────

function parseJSON(raw) {
  const clean = raw.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
}

// ── AI Features ───────────────────────────────────────────────────────────────

/**
 * Summarise student notes.
 * Returns: { title, summary, keyPoints[], topics[], difficulty }
 */
async function summariseNotes(content) {
  const system = 'You are an expert academic assistant. Return ONLY valid JSON — no markdown fences, no explanation.';
  const prompt = `
Summarise the following student notes. Return a JSON object with exactly these keys:
- "title"      : short descriptive title (string)
- "summary"    : 2–3 sentence overview (string)
- "keyPoints"  : array of exactly 5 key-point strings
- "topics"     : array of 3–5 topic tag strings
- "difficulty" : one of "Beginner" | "Intermediate" | "Advanced"

Notes:
${content.slice(0, 6000)}
`.trim();

  const raw  = await callClaude(prompt, system, 1000);
  const data = parseJSON(raw);

  if (!data.title || !data.summary || !Array.isArray(data.keyPoints)) {
    throw new Error('Unexpected AI response structure.');
  }
  return data;
}

/**
 * Generate a day-by-day study plan.
 * Returns: { title, totalDays, dailyHours, plan[] }
 */
async function generateStudyPlan(subject, examDate, topics, level) {
  const daysLeft = Math.ceil((new Date(examDate) - Date.now()) / 86_400_000);
  if (daysLeft < 1) throw Object.assign(new Error('Exam date must be in the future.'), { statusCode: 422 });

  const system = 'You are an expert academic planner. Return ONLY valid JSON — no markdown, no preamble.';
  const prompt = `
Create a realistic study plan for:
- Subject: ${subject}
- Level: ${level}
- Days until exam: ${daysLeft}
- Topics: ${topics}

Return JSON with keys:
- "title"      : plan title string
- "totalDays"  : number (max ${daysLeft})
- "dailyHours" : recommended hours per day (number)
- "plan"       : array of up to ${Math.min(daysLeft, 21)} objects, each with:
    "day"      : day number
    "focus"    : main topic/focus for the day
    "tasks"    : array of 3 specific task strings
    "duration" : e.g. "3 hours"
`.trim();

  const raw  = await callClaude(prompt, system, 2000);
  const data = parseJSON(raw);

  if (!data.plan || !Array.isArray(data.plan)) throw new Error('AI returned invalid plan structure.');
  return data;
}

/**
 * Extract deadlines from syllabus text.
 * Returns: array of { title, dueDate, type, priority }
 */
async function extractDeadlines(syllabusText) {
  const system = 'You are an academic assistant. Return ONLY a valid JSON array — no markdown, no extra text.';
  const prompt = `
Extract all deadlines, exams, assignments, projects, and quizzes from this syllabus.
Return a JSON array where each element has:
- "title"    : descriptive name (string)
- "dueDate"  : ISO date string YYYY-MM-DD (estimate if approximate)
- "type"     : one of "exam" | "assignment" | "project" | "quiz"
- "priority" : one of "high" | "medium" | "low"

If no dates are found, return an empty array [].

Syllabus:
${syllabusText.slice(0, 6000)}
`.trim();

  const raw  = await callClaude(prompt, system, 1500);
  const data = parseJSON(raw);

  if (!Array.isArray(data)) throw new Error('AI did not return an array.');
  return data;
}

/**
 * Recommend learning resources for a topic.
 * Returns: { resources[] }
 */
async function getResources(topic, level) {
  const system = 'You are an educational resource curator. Return ONLY valid JSON.';
  const prompt = `
Recommend 6 high-quality learning resources for "${topic}" at ${level} level.
Return JSON with a "resources" array. Each element must have:
- "title"         : resource title
- "type"          : "video" | "article" | "practice" | "book"
- "platform"      : e.g. YouTube, Coursera, GeeksforGeeks, Khan Academy…
- "description"   : one-sentence description
- "estimatedTime" : e.g. "20 min", "2 hours"
- "link"          : realistic, plausible URL (https://...)
`.trim();

  const raw  = await callClaude(prompt, system, 1200);
  const data = parseJSON(raw);

  if (!data.resources || !Array.isArray(data.resources)) throw new Error('AI returned invalid resource structure.');
  return data;
}

module.exports = {
  callClaude,
  summariseNotes,
  generateStudyPlan,
  extractDeadlines,
  getResources,
};
