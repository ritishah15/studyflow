// routes/payments.js
// POST /api/payments/create-order   — create Razorpay order
// POST /api/payments/verify         — verify payment & upgrade plan
// POST /api/payments/webhook        — Razorpay webhook handler
// GET  /api/payments/history        — user payment history

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');

const { Payment }  = require('../models/StudyPlan');
const User         = require('../models/User');
const { authenticate }          = require('../middleware/auth');
const { paymentVerifyRules }    = require('../middleware/validate');
const { asyncHandler, createError } = require('../middleware/errorHandler');

// ── Razorpay SDK (conditional — only if keys are set) ─────────────────────────
let razorpay = null;
function getRazorpay() {
  if (razorpay) return razorpay;
  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw createError(503, 'Payment service not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }
  const Razorpay = require('razorpay');
  razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  return razorpay;
}

// PRO plan price in paise (₹299 = 29900 paise)
const PRO_PRICE_PAISE = 29900;

// ── Create Order ──────────────────────────────────────────────────────────────
router.post('/create-order', authenticate, asyncHandler(async (req, res) => {
  if (req.user.plan === 'pro') {
    return res.status(409).json({ error: 'You are already on the Pro plan.' });
  }

  const rp = getRazorpay();

  const order = await rp.orders.create({
    amount:          PRO_PRICE_PAISE,
    currency:        'INR',
    receipt:         `sf_${req.user.id.slice(0, 8)}_${Date.now()}`,
    notes:           { userId: req.user.id, plan: 'pro' },
    payment_capture: 1,
  });

  // Record pending payment
  Payment.create({
    user_id:           req.user.id,
    razorpay_order_id: order.id,
    amount:            PRO_PRICE_PAISE,
    currency:          'INR',
    plan:              'pro',
  });

  res.json({
    orderId:     order.id,
    amount:      order.amount,
    currency:    order.currency,
    keyId:       process.env.RAZORPAY_KEY_ID,
    name:        'StudyFlow AI',
    description: 'Pro Plan — Monthly Subscription',
    prefill: {
      name:  req.user.name,
      email: req.user.email,
    },
  });
}));

// ── Verify Payment ────────────────────────────────────────────────────────────
router.post('/verify', authenticate, paymentVerifyRules, asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  // Signature verification
  const hmac = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || '');
  hmac.update(`${razorpay_order_id}|${razorpay_payment_id}`);
  const expectedSig = hmac.digest('hex');

  if (expectedSig !== razorpay_signature) {
    Payment.markFailed(razorpay_order_id);
    throw createError(400, 'Payment verification failed — signature mismatch.');
  }

  // Ensure payment belongs to this user
  const payment = Payment.findByOrderId(razorpay_order_id);
  if (!payment || payment.user_id !== req.user.id) {
    throw createError(403, 'Payment not found or does not belong to this account.');
  }

  // Mark paid and upgrade user
  Payment.markPaid(razorpay_order_id, { razorpay_payment_id, razorpay_signature });
  const updatedUser = User.upgradePlan(req.user.id, 'pro');

  res.json({
    message: 'Payment verified. Welcome to Pro!',
    user:    updatedUser,
  });
}));

// ── Webhook (called by Razorpay — no auth header) ────────────────────────────
// Must be registered in Razorpay Dashboard → Webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), asyncHandler(async (req, res) => {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return res.status(200).json({ status: 'webhook secret not set' });

  const signature = req.headers['x-razorpay-signature'];
  const body      = req.body; // raw buffer

  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(body)
    .digest('hex');

  if (expected !== signature) {
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }

  const event = JSON.parse(body.toString());

  if (event.event === 'payment.captured') {
    const { order_id, id: payment_id } = event.payload.payment.entity;
    const payment = Payment.findByOrderId(order_id);
    if (payment && payment.status !== 'paid') {
      Payment.markPaid(order_id, {
        razorpay_payment_id: payment_id,
        razorpay_signature:  signature,
      });
      User.upgradePlan(payment.user_id, 'pro');
      console.log(`[Webhook] Upgraded user ${payment.user_id} to Pro.`);
    }
  }

  if (event.event === 'payment.failed') {
    const { order_id } = event.payload.payment.entity;
    Payment.markFailed(order_id);
    console.log(`[Webhook] Payment failed for order ${order_id}.`);
  }

  res.json({ status: 'ok' });
}));

// ── Payment History ───────────────────────────────────────────────────────────
router.get('/history', authenticate, asyncHandler(async (req, res) => {
  const payments = Payment.findAllByUser(req.user.id);
  res.json({ payments });
}));

module.exports = router;
