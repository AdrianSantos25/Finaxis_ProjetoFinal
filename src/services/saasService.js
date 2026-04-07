const db = require('../database');
const { AppError } = require('../middlewares/errorHandler');
const billingService = require('./billingService');

const PLAN_LIMITS = {
  free: {
    maxTransacoesMes: 100,
    maxOrcamentosMes: 10,
    features: {
      exportCsv: true,
      exportExcel: false,
      exportPdf: false,
      importDados: false
    }
  },
  pro: {
    maxTransacoesMes: null,
    maxOrcamentosMes: null,
    features: {
      exportCsv: true,
      exportExcel: true,
      exportPdf: true,
      importDados: true
    }
  },
  business: {
    maxTransacoesMes: null,
    maxOrcamentosMes: null,
    features: {
      exportCsv: true,
      exportExcel: true,
      exportPdf: true,
      importDados: true
    }
  }
};

class SaaSService {
  obterLimites(plano = 'free') {
    return PLAN_LIMITS[plano] || PLAN_LIMITS.free;
  }

  async obterContextoUtilizador(utilizadorId) {
    await this.downgradeTrialExpirado(utilizadorId);

    const [rows] = await db.query(
      `SELECT u.id, u.nome, u.email, u.conta_id, u.papel, c.nome as conta_nome, c.moeda, c.timezone,
              s.plano, s.status as subscricao_status
       FROM utilizadores u
       LEFT JOIN contas c ON c.id = u.conta_id
       LEFT JOIN subscricoes s ON s.id = (
         SELECT s2.id
         FROM subscricoes s2
         WHERE s2.conta_id = u.conta_id
         ORDER BY s2.criado_em DESC, s2.id DESC
         LIMIT 1
       )
       WHERE u.id = ?`,
      [utilizadorId]
    );

    if (rows.length === 0) {
      return null;
    }

    const u = rows[0];
    const plano = u.plano || 'free';
    const status = u.subscricao_status || 'active';

    return {
      utilizador: {
        id: u.id,
        nome: u.nome,
        email: u.email,
        conta_id: u.conta_id,
        conta_nome: u.conta_nome,
        papel: u.papel,
        moeda: u.moeda,
        timezone: u.timezone
      },
      subscricao: {
        plano,
        status
      },
      limites: this.obterLimites(plano)
    };
  }

  async downgradeTrialExpirado(utilizadorId) {
    const [rows] = await db.query(
      `SELECT u.conta_id
       FROM utilizadores u
       JOIN subscricoes s ON s.conta_id = u.conta_id
       WHERE u.id = ?
         AND s.status = 'trialing'
         AND s.trial_fim IS NOT NULL
         AND s.trial_fim < NOW()
       ORDER BY s.atualizado_em DESC, s.id DESC
       LIMIT 1`,
      [utilizadorId]
    );

    if (rows.length === 0) {
      return;
    }

    await billingService.downgradeContaParaFree(rows[0].conta_id, false);
  }

  async verificarFuncionalidade(utilizadorId, featureKey) {
    const contexto = await this.obterContextoUtilizador(utilizadorId);
    if (!contexto) {
      throw new AppError('Utilizador não encontrado.', 404);
    }

    if (['past_due', 'canceled'].includes(contexto.subscricao.status)) {
      throw new AppError('A sua subscrição não está ativa. Atualize o plano para continuar.', 402);
    }

    const permitido = contexto.limites.features[featureKey];
    if (!permitido) {
      throw new AppError('Funcionalidade disponível apenas nos planos Pro e Business.', 403);
    }

    return contexto;
  }

  async verificarLimiteTransacoes(utilizadorId, data) {
    const contexto = await this.obterContextoUtilizador(utilizadorId);
    if (!contexto) {
      throw new AppError('Utilizador não encontrado.', 404);
    }

    const maxTransacoesMes = contexto.limites.maxTransacoesMes;
    if (!maxTransacoesMes) {
      return contexto;
    }

    const dataRef = data ? new Date(data) : new Date();
    const ano = dataRef.getFullYear();
    const mes = dataRef.getMonth() + 1;
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const fimMes = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const [rows] = await db.query(
      'SELECT COUNT(*) as total FROM transacoes WHERE conta_id = ? AND data BETWEEN ? AND ?',
      [contexto.utilizador.conta_id, inicioMes, fimMes]
    );

    const total = rows[0].total || 0;
    if (total >= maxTransacoesMes) {
      throw new AppError(`Limite do plano Free atingido (${maxTransacoesMes} transações/mês). Atualize para Pro para continuar.`, 403);
    }

    return contexto;
  }

  async verificarLimiteOrcamentos(utilizadorId, mes, ano) {
    const contexto = await this.obterContextoUtilizador(utilizadorId);
    if (!contexto) {
      throw new AppError('Utilizador não encontrado.', 404);
    }

    const maxOrcamentosMes = contexto.limites.maxOrcamentosMes;
    if (!maxOrcamentosMes) {
      return contexto;
    }

    const [rows] = await db.query(
      'SELECT COUNT(*) as total FROM orcamentos WHERE conta_id = ? AND mes = ? AND ano = ?',
      [contexto.utilizador.conta_id, mes, ano]
    );

    const total = rows[0].total || 0;
    if (total >= maxOrcamentosMes) {
      throw new AppError(`Limite do plano Free atingido (${maxOrcamentosMes} orçamentos por mês). Atualize para Pro para continuar.`, 403);
    }

    return contexto;
  }
}

module.exports = new SaaSService();
