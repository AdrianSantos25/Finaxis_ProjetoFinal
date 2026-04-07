const request = require('supertest');
const express = require('express');

jest.mock('../src/services/billingService', () => ({
  processarWebhookStripe: jest.fn()
}));

const billingService = require('../src/services/billingService');
const webhookRoutes = require('../src/routes/webhooks');

describe('Webhooks Stripe', () => {
  test('deve retornar 400 quando assinatura ausente', async () => {
    const app = express();
    app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ id: 'evt_1' })));

    expect(res.status).toBe(400);
    expect(res.text).toContain('assinatura ausente');
  });

  test('deve aceitar webhook valido', async () => {
    billingService.processarWebhookStripe.mockResolvedValue('customer.subscription.updated');

    const app = express();
    app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

    const res = await request(app)
      .post('/webhooks/stripe')
      .set('stripe-signature', 'sig_test')
      .set('Content-Type', 'application/json')
      .send(Buffer.from(JSON.stringify({ id: 'evt_1' })));

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});
