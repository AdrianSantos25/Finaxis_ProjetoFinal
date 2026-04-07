const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const billingService = require('../services/billingService');

const stripeWebhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Rate limit de webhook atingido.'
});

router.post('/stripe', stripeWebhookLimiter, async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    if (!signature) {
      return res.status(400).send('Webhook Error: assinatura ausente');
    }
    const eventType = await billingService.processarWebhookStripe(req.body, signature);
    return res.status(200).json({ received: true, event: eventType });
  } catch (err) {
    console.error('Erro no webhook Stripe:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

module.exports = router;
