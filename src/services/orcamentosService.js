const db = require('../database');

class OrcamentosService {
  /**
   * Listar orçamentos de um mês/ano com gastos atuais
   */
  async listar(contaId, mes, ano) {
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const fimMes = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    const [orcamentos] = await db.query(`
      SELECT o.*, c.nome as categoria_nome, c.cor as categoria_cor, c.tipo as categoria_tipo,
             COALESCE((
               SELECT SUM(t.valor) FROM transacoes t 
               WHERE t.categoria_id = o.categoria_id 
               AND t.conta_id = o.conta_id
               AND t.tipo = 'despesa'
               AND t.data BETWEEN ? AND ?
             ), 0) as gasto_atual
      FROM orcamentos o
      JOIN categorias c ON o.categoria_id = c.id
      WHERE o.conta_id = ? AND o.mes = ? AND o.ano = ?
      ORDER BY c.nome
    `, [inicioMes, fimMes, contaId, mes, ano]);

    return orcamentos.map(o => {
      const gasto = parseFloat(o.gasto_atual) || 0;
      const limite = parseFloat(o.limite) || 0;
      const percentagem = limite > 0 ? Math.round((gasto / limite) * 100) : 0;
      const restante = limite - gasto;
      let estado = 'normal'; // verde
      if (percentagem >= 100) estado = 'ultrapassado'; // vermelho
      else if (percentagem >= 80) estado = 'alerta'; // amarelo

      return {
        ...o,
        gasto_atual: gasto,
        limite,
        percentagem: Math.min(percentagem, 100),
        percentagemReal: percentagem,
        restante,
        estado
      };
    });
  }

  /**
   * Obter resumo de orçamentos para o dashboard
   */
  async obterResumoDashboard(contaId, mes, ano) {
    const orcamentos = await this.listar(contaId, mes, ano);
    const alertas = orcamentos.filter(o => o.estado === 'alerta' || o.estado === 'ultrapassado');
    return { orcamentos, alertas };
  }

  /**
   * Buscar orçamento por ID
   */
  async buscarPorId(orcamentoId, contaId) {
    const [orcamentos] = await db.query(
      'SELECT o.*, c.nome as categoria_nome FROM orcamentos o JOIN categorias c ON o.categoria_id = c.id WHERE o.id = ? AND o.conta_id = ?',
      [orcamentoId, contaId]
    );
    return orcamentos[0] || null;
  }

  /**
   * Criar novo orçamento
   */
  async criar(contaId, utilizadorId, { categoria_id, limite, mes, ano }) {
    const [resultado] = await db.query(
      'INSERT INTO orcamentos (utilizador_id, conta_id, categoria_id, limite, mes, ano) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE limite = ?',
      [utilizadorId, contaId, categoria_id, parseFloat(limite), mes, ano, parseFloat(limite)]
    );
    return resultado;
  }

  /**
   * Atualizar orçamento
   */
  async atualizar(orcamentoId, contaId, { limite }) {
    const [resultado] = await db.query(
      'UPDATE orcamentos SET limite = ? WHERE id = ? AND conta_id = ?',
      [parseFloat(limite), orcamentoId, contaId]
    );
    return resultado;
  }

  /**
   * Eliminar orçamento
   */
  async eliminar(orcamentoId, contaId) {
    const [resultado] = await db.query(
      'DELETE FROM orcamentos WHERE id = ? AND conta_id = ?',
      [orcamentoId, contaId]
    );
    return resultado;
  }

  /**
   * Copiar orçamentos de um mês para outro
   */
  async copiarMes(contaId, utilizadorId, mesOrigem, anoOrigem, mesDestino, anoDestino) {
    const [orcamentosOrigem] = await db.query(
      'SELECT categoria_id, limite FROM orcamentos WHERE conta_id = ? AND mes = ? AND ano = ?',
      [contaId, mesOrigem, anoOrigem]
    );

    for (const orc of orcamentosOrigem) {
      await db.query(
        'INSERT INTO orcamentos (utilizador_id, conta_id, categoria_id, limite, mes, ano) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE limite = ?',
        [utilizadorId, contaId, orc.categoria_id, orc.limite, mesDestino, anoDestino, orc.limite]
      );
    }

    return orcamentosOrigem.length;
  }
}

module.exports = new OrcamentosService();
