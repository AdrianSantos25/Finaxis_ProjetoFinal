const db = require('../database');

const ALLOWED_EVENTS = new Set([
  'signup',
  'onboarding_complete',
  'first_5_transactions',
  'trial_started',
  'subscribed',
  'canceled'
]);

class AnalyticsService {
  async registarEvento({ contaId = null, utilizadorId = null, eventName, source = 'app', eventData = null }) {
    if (!eventName || !ALLOWED_EVENTS.has(eventName)) {
      return;
    }

    await db.query(
      `INSERT INTO analytics_events (conta_id, utilizador_id, event_name, source, event_data)
       VALUES (?, ?, ?, ?, ?)`,
      [contaId, utilizadorId, eventName, source, eventData ? JSON.stringify(eventData) : null]
    );
  }

  async eventoExiste({ contaId = null, utilizadorId = null, eventName }) {
    const [rows] = await db.query(
      `SELECT id
       FROM analytics_events
       WHERE event_name = ?
         AND (? IS NULL OR conta_id = ?)
         AND (? IS NULL OR utilizador_id = ?)
       LIMIT 1`,
      [eventName, contaId, contaId, utilizadorId, utilizadorId]
    );

    return rows.length > 0;
  }

  async obterResumoFunnel({ inicio, fim }) {
    const [rows] = await db.query(
      `SELECT event_name, COUNT(*) as total
       FROM analytics_events
       WHERE criado_em BETWEEN ? AND ?
       GROUP BY event_name`,
      [inicio, fim]
    );

    const resumo = {
      signup: 0,
      onboarding_complete: 0,
      first_5_transactions: 0,
      trial_started: 0,
      subscribed: 0,
      canceled: 0
    };

    for (const row of rows) {
      if (Object.prototype.hasOwnProperty.call(resumo, row.event_name)) {
        resumo[row.event_name] = Number(row.total) || 0;
      }
    }

    return resumo;
  }

  async obterResumoFunnelPorPeriodo({ dias = 7 }) {
    const diasNormalizados = Number.isFinite(Number(dias)) ? Math.max(1, Number(dias)) : 7;
    const fim = new Date();
    const inicio = new Date(fim.getTime() - diasNormalizados * 24 * 60 * 60 * 1000);

    const resumo = await this.obterResumoFunnel({ inicio, fim });

    const taxa = (base, alvo) => {
      if (!base) {
        return 0;
      }
      return Number(((alvo / base) * 100).toFixed(1));
    };

    return {
      periodoDias: diasNormalizados,
      intervalo: {
        inicio,
        fim
      },
      eventos: resumo,
      taxas: {
        signupParaOnboarding: taxa(resumo.signup, resumo.onboarding_complete),
        onboardingParaCincoTransacoes: taxa(resumo.onboarding_complete, resumo.first_5_transactions),
        cincoTransacoesParaTrial: taxa(resumo.first_5_transactions, resumo.trial_started),
        trialParaAssinatura: taxa(resumo.trial_started, resumo.subscribed),
        churnSobreAssinaturas: taxa(resumo.subscribed, resumo.canceled)
      }
    };
  }
}

module.exports = new AnalyticsService();
