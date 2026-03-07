// middleware/validate.js
// express-validator rule sets for every route

const { body, param, query, validationResult } = require('express-validator');

// ── Helper — run validations and return 422 on failure ────────────────────────
function validate(rules) {
  return async (req, res, next) => {
    await Promise.all(rules.map(rule => rule.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ error: 'Validation failed.', details: errors.array() });
    }
    next();
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────
const registerRules = validate([
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 chars.'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email required.'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain a number.'),
  body('course').optional().trim().isLength({ max: 120 }),
]);

const loginRules = validate([
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
]);

// ── Notes ─────────────────────────────────────────────────────────────────────
const noteCreateRules = validate([
  body('content').trim().isLength({ min: 50, max: 20000 }).withMessage('Notes must be 50–20,000 characters.'),
  body('title').optional().trim().isLength({ max: 200 }),
]);

// ── Deadlines ─────────────────────────────────────────────────────────────────
const deadlineCreateRules = validate([
  body('title').trim().isLength({ min: 2, max: 200 }).withMessage('Title required.'),
  body('due_date').isISO8601().withMessage('Valid date required (YYYY-MM-DD).'),
  body('type').isIn(['exam', 'assignment', 'project', 'quiz']).withMessage('Invalid type.'),
  body('priority').isIn(['high', 'medium', 'low']).withMessage('Invalid priority.'),
]);

const deadlineUpdateRules = validate([
  param('id').notEmpty(),
  body('title').optional().trim().isLength({ min: 2, max: 200 }),
  body('due_date').optional().isISO8601(),
  body('type').optional().isIn(['exam', 'assignment', 'project', 'quiz']),
  body('priority').optional().isIn(['high', 'medium', 'low']),
  body('is_done').optional().isBoolean(),
]);

// ── Study Plans ───────────────────────────────────────────────────────────────
const studyPlanRules = validate([
  body('subject').trim().isLength({ min: 2, max: 200 }).withMessage('Subject required.'),
  body('exam_date').isISO8601().withMessage('Valid exam date required.'),
  body('topics').trim().isLength({ min: 5, max: 3000 }).withMessage('Topics required.'),
  body('level').isIn(['Beginner', 'Intermediate', 'Advanced']).withMessage('Invalid level.'),
]);

// ── Resources ─────────────────────────────────────────────────────────────────
const resourceRules = validate([
  body('topic').trim().isLength({ min: 2, max: 200 }).withMessage('Topic required.'),
  body('level').isIn(['Beginner', 'Intermediate', 'Advanced']).withMessage('Invalid level.'),
]);

// ── Payments ──────────────────────────────────────────────────────────────────
const paymentVerifyRules = validate([
  body('razorpay_order_id').notEmpty(),
  body('razorpay_payment_id').notEmpty(),
  body('razorpay_signature').notEmpty(),
]);

// ── Syllabus Extract ──────────────────────────────────────────────────────────
const syllabusRules = validate([
  body('text').trim().isLength({ min: 50, max: 20000 }).withMessage('Syllabus text must be 50–20,000 characters.'),
]);

// ── Profile Update ────────────────────────────────────────────────────────────
const profileUpdateRules = validate([
  body('name').optional().trim().isLength({ min: 2, max: 80 }),
  body('course').optional().trim().isLength({ max: 120 }),
]);

module.exports = {
  validate,
  registerRules,
  loginRules,
  noteCreateRules,
  deadlineCreateRules,
  deadlineUpdateRules,
  studyPlanRules,
  resourceRules,
  paymentVerifyRules,
  syllabusRules,
  profileUpdateRules,
};
