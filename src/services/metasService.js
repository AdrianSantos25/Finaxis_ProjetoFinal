const db = require('../database');

class MetasService {
  async listar(contaId) {
    const [metas] = await db.query(
      `SELECT *
       FROM metas_financeiras
       WHERE conta_id = ?
       ORDER BY status = 'ativa' DESC, data_objetivo IS NULL, data_objetivo ASC, id DESC`,
      [contaId]
    );

    const mediaPoupancaMensal = await this._calcularMediaPoupancaMensal(contaId);

    return metas.map((meta) => this._normalizarMeta(meta, mediaPoupancaMensal));
  }

  async criar(contaId, utilizadorId, { titulo, tipo, valor_objetivo, valor_atual, data_objetivo }) {
    const tituloNormalizado = (titulo || '').trim();
    const tipoNormalizado = ['poupanca', 'quitacao'].includes(tipo) ? tipo : 'poupanca';
    const objetivo = parseFloat(valor_objetivo);
    const atual = Math.max(0, parseFloat(valor_atual || 0));

    const [resultado] = await db.query(
      `INSERT INTO metas_financeiras (utilizador_id, conta_id, titulo, tipo, valor_objetivo, valor_atual, data_objetivo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [utilizadorId, contaId, tituloNormalizado, tipoNormalizado, objetivo, atual, data_objetivo || null]
    );

    return resultado;
  }

  async atualizarProgresso(metaId, contaId, valorAtual) {
    const valor = Math.max(0, parseFloat(valorAtual || 0));

    const [resultado] = await db.query(
      `UPDATE metas_financeiras
       SET valor_atual = ?,
           status = CASE WHEN ? >= valor_objetivo THEN 'concluida' ELSE status END
       WHERE id = ? AND conta_id = ?`,
      [valor, valor, metaId, contaId]
    );

    return resultado;
  }

  async atualizarEstado(metaId, contaId, status) {
    const novoStatus = ['ativa', 'concluida', 'arquivada'].includes(status) ? status : 'ativa';
    const [resultado] = await db.query(
      'UPDATE metas_financeiras SET status = ? WHERE id = ? AND conta_id = ?',
      [novoStatus, metaId, contaId]
    );
    return resultado;
  }

  async eliminar(metaId, contaId) {
    const [resultado] = await db.query(
      'DELETE FROM metas_financeiras WHERE id = ? AND conta_id = ?',
      [metaId, contaId]
    );
    return resultado;
  }

  async obterResumoDashboard(contaId) {
    const metas = await this.listar(contaId);
    const metasAtivas = metas.filter((m) => m.status === 'ativa');
    return {
      metasAtivas,
      totalAtivas: metasAtivas.length,
      concluidas: metas.filter((m) => m.status === 'concluida').length
    };
  }

  _normalizarMeta(meta, mediaPoupancaMensal) {
    const valorObjetivo = parseFloat(meta.valor_objetivo) || 0;
    const valorAtual = parseFloat(meta.valor_atual) || 0;
    const progressoRaw = valorObjetivo > 0 ? (valorAtual / valorObjetivo) * 100 : 0;
    const progresso = Math.max(0, Math.min(100, Math.round(progressoRaw)));
    const falta = Math.max(0, valorObjetivo - valorAtual);

    let previsaoConclusao = null;
    if (meta.status === 'ativa' && falta > 0 && mediaPoupancaMensal > 0) {
      const mesesParaConcluir = Math.ceil(falta / mediaPoupancaMensal);
      const data = new Date();
      data.setDate(1);
      data.setMonth(data.getMonth() + mesesParaConcluir);
      previsaoConclusao = data.toISOString().split('T')[0];
    }

    return {
      ...meta,
      valor_objetivo: valorObjetivo,
      valor_atual: valorAtual,
      progresso,
      falta,
      previsao_conclusao: previsaoConclusao,
      media_poupanca_mensal: mediaPoupancaMensal
    };
  }

  async _calcularMediaPoupancaMensal(contaId) {
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(data, '%Y-%m') as ym,
              SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) as receitas,
              SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) as despesas
       FROM transacoes
       WHERE conta_id = ? AND data >= DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
       GROUP BY ym
       ORDER BY ym DESC`,
      [contaId]
    );

    if (!rows.length) return 0;

    const poupancas = rows.map((r) => {
      const receitas = parseFloat(r.receitas) || 0;
      const despesas = parseFloat(r.despesas) || 0;
      return Math.max(0, receitas - despesas);
    });

    const soma = poupancas.reduce((acc, v) => acc + v, 0);
    return soma > 0 ? (soma / poupancas.length) : 0;
  }
}

module.exports = new MetasService();
