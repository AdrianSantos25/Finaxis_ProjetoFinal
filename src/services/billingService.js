const Stripe = require('stripe');
const db = require('../database');
const { AppError } = require('../middlewares/errorHandler');
const analyticsService = require('./analyticsService');

class BillingService {
  constructor() {
    this.stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
  }

  _garantirStripeConfigurado() {
    if (!this.stripe) {
      throw new AppError('Stripe não configurado. Defina STRIPE_SECRET_KEY no ambiente.', 500);
    }
  }

  _obterDominioBase() {
    return process.env.APP_BASE_URL || 'http://localhost:3001';
  }

  _obterPlanoPorPriceId(priceId) {
    if (!priceId) return 'free';
    if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';
    if (priceId === process.env.STRIPE_PRICE_BUSINESS) return 'business';
    return 'free';
  }

  _obterPriceIdPorPlano(plano) {
    if (plano === 'pro') return process.env.STRIPE_PRICE_PRO;
    if (plano === 'business') return process.env.STRIPE_PRICE_BUSINESS;
    return null;
  }

  _mapearStatusStripe(status) {
    if (status === 'trialing') return 'trialing';
    if (status === 'active') return 'active';
    if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'past_due';
    return 'canceled';
  }

  async _contaJaUsouTrial(contaId) {
    const [rows] = await db.query(
      `SELECT COUNT(*) as total
       FROM subscricoes
       WHERE conta_id = ?
         AND plano IN ('pro', 'business')
         AND trial_inicio IS NOT NULL`,
      [contaId]
    );
    return (rows[0].total || 0) > 0;
  }

  async _obterConta(contaId) {
    const [rows] = await db.query('SELECT * FROM contas WHERE id = ?', [contaId]);
    return rows[0] || null;
  }

  async _obterOuCriarStripeCustomer(contaId, nome, email) {
    const conta = await this._obterConta(contaId);
    if (!conta) throw new AppError('Conta não encontrada.', 404);

    if (conta.stripe_customer_id) {
      return conta.stripe_customer_id;
    }

    const customer = await this.stripe.customers.create({
      name: nome,
      email,
      metadata: {
        conta_id: String(contaId)
      }
    });

    await db.query(
      'UPDATE contas SET stripe_customer_id = ? WHERE id = ?',
      [customer.id, contaId]
    );

    return customer.id;
  }

  async criarCheckoutSessao({ contaId, nome, email, plano }) {
    this._garantirStripeConfigurado();

    if (!['pro', 'business'].includes(plano)) {
      throw new AppError('Plano inválido para checkout.', 400);
    }

    const priceId = this._obterPriceIdPorPlano(plano);
    if (!priceId) {
      throw new AppError(`Price ID não configurado para o plano ${plano}.`, 500);
    }

    const stripeCustomerId = await this._obterOuCriarStripeCustomer(contaId, nome, email);
    const jaUsouTrial = await this._contaJaUsouTrial(contaId);
    const dominio = this._obterDominioBase();

    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: jaUsouTrial ? undefined : 14,
        metadata: {
          conta_id: String(contaId),
          plano
        }
      },
      success_url: `${dominio}/billing?checkout=success`,
      cancel_url: `${dominio}/billing?checkout=cancel`
    });

    return session;
  }

  async cancelarSubscricaoStripeAtiva(contaId) {
    this._garantirStripeConfigurado();

    const [rows] = await db.query(
      `SELECT stripe_subscription_id
       FROM subscricoes
       WHERE conta_id = ?
         AND fornecedor = 'stripe'
         AND stripe_subscription_id IS NOT NULL
         AND status IN ('trialing', 'active', 'past_due')
       ORDER BY atualizado_em DESC, id DESC
       LIMIT 1`,
      [contaId]
    );

    if (rows.length === 0) {
      return;
    }

    await this.stripe.subscriptions.cancel(rows[0].stripe_subscription_id);
  }

  async gravarSubscricaoStripe(subscription) {
    const stripeCustomerId = subscription.customer;
    const stripeSubscriptionId = subscription.id;

    const [contas] = await db.query(
      'SELECT id FROM contas WHERE stripe_customer_id = ? LIMIT 1',
      [stripeCustomerId]
    );

    if (contas.length === 0) {
      return;
    }

    const contaId = contas[0].id;
    const item = subscription.items?.data?.[0];
    const stripePriceId = item?.price?.id || null;
    const plano = this._obterPlanoPorPriceId(stripePriceId);
    const status = this._mapearStatusStripe(subscription.status);
    const trialInicio = subscription.trial_start ? new Date(subscription.trial_start * 1000) : null;
    const trialFim = subscription.trial_end ? new Date(subscription.trial_end * 1000) : null;
    const inicio = subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : new Date();
    const fim = subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null;
    const cancelAtPeriodEnd = subscription.cancel_at_period_end ? 1 : 0;

    await db.query(
      `INSERT INTO subscricoes
        (conta_id, plano, status, fornecedor, stripe_subscription_id, stripe_price_id, trial_inicio, trial_fim, cancel_at_period_end, inicio, fim)
       VALUES (?, ?, ?, 'stripe', ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         plano = VALUES(plano),
         status = VALUES(status),
         stripe_price_id = VALUES(stripe_price_id),
         trial_inicio = VALUES(trial_inicio),
         trial_fim = VALUES(trial_fim),
         cancel_at_period_end = VALUES(cancel_at_period_end),
         inicio = VALUES(inicio),
         fim = VALUES(fim),
         atualizado_em = CURRENT_TIMESTAMP`,
      [
        contaId,
        plano,
        status,
        stripeSubscriptionId,
        stripePriceId,
        trialInicio,
        trialFim,
        cancelAtPeriodEnd,
        inicio,
        fim
      ]
    );

    if (['active', 'trialing'].includes(status) && ['pro', 'business'].includes(plano)) {
      await analyticsService.registarEvento({
        contaId,
        eventName: 'subscribed',
        source: 'stripe_webhook',
        eventData: { plano, status, stripeSubscriptionId }
      });
    }

    if (status === 'canceled') {
      await analyticsService.registarEvento({
        contaId,
        eventName: 'canceled',
        source: 'stripe_webhook',
        eventData: { plano, stripeSubscriptionId }
      });
    }

    if (status === 'canceled') {
      await this.downgradeContaParaFree(contaId, false);
    }
  }

  async downgradeContaParaFree(contaId, cancelarStripe = true) {
    if (cancelarStripe) {
      await this.cancelarSubscricaoStripeAtiva(contaId);
    }

    await db.query(
      `UPDATE subscricoes
       SET status = 'canceled', fim = COALESCE(fim, NOW())
       WHERE conta_id = ?
         AND plano IN ('pro', 'business')
         AND status IN ('trialing', 'active', 'past_due')`,
      [contaId]
    );

    const [ultima] = await db.query(
      `SELECT plano, status
       FROM subscricoes
       WHERE conta_id = ?
       ORDER BY atualizado_em DESC, id DESC
       LIMIT 1`,
      [contaId]
    );

    if (ultima.length > 0 && ultima[0].plano === 'free' && ultima[0].status === 'active') {
      return;
    }

    await db.query(
      `INSERT INTO subscricoes (conta_id, plano, status, fornecedor, inicio, fim)
       VALUES (?, 'free', 'active', 'manual', NOW(), NULL)`,
      [contaId]
    );
  }

  async processarWebhookStripe(payloadBuffer, signature) {
    this._garantirStripeConfigurado();

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      throw new AppError('Webhook secret Stripe não configurado.', 500);
    }

    const event = this.stripe.webhooks.constructEvent(
      payloadBuffer,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      if (session.subscription) {
        const subscription = await this.stripe.subscriptions.retrieve(session.subscription);
        await this.gravarSubscricaoStripe(subscription);
      }
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated') {
      await this.gravarSubscricaoStripe(event.data.object);
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      await this.gravarSubscricaoStripe(subscription);
    }

    return event.type;
  }

  async obterHistoricoSubscricoes(contaId) {
    const [rows] = await db.query(
      `SELECT *
       FROM subscricoes
       WHERE conta_id = ?
       ORDER BY atualizado_em DESC, id DESC
       LIMIT 10`,
      [contaId]
    );

    return rows;
  }
}

module.exports = new BillingService();
