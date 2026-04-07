const express = require('express');
const router = express.Router();
const billingService = require('../services/billingService');

router.post('/stripe', async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const eventType = await billingService.processarWebhookStripe(req.body, signature);
    return res.status(200).json({ received: true, event: eventType });
  } catch (err) {
    console.error('Erro no webhook Stripe:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

module.exports = router;
