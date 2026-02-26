const db = require('../database');

class TransacoesService {
  /**
   * Listar transações com filtros e paginação
   */
  async listar(utilizadorId, { tipo, categoria, pesquisa, dataInicio, dataFim, pagina = 1, limite = 20 }) {
    let queryCount = 'SELECT COUNT(*) as total FROM transacoes t WHERE t.utilizador_id = ?';
    let query = `
      SELECT t.*, c.nome as categoria_nome, c.cor as categoria_cor
      FROM transacoes t
      LEFT JOIN categorias c ON t.categoria_id = c.id
      WHERE t.utilizador_id = ?
    `;
    const params = [utilizadorId];
    const countParams = [utilizadorId];

    if (tipo) {
      query += ' AND t.tipo = ?';
      queryCount += ' AND t.tipo = ?';
      params.push(tipo);
      countParams.push(tipo);
    }

    if (categoria) {
      query += ' AND t.categoria_id = ?';
      queryCount += ' AND t.categoria_id = ?';
      params.push(categoria);
      countParams.push(categoria);
    }

    if (pesquisa && pesquisa.trim()) {
      query += ' AND t.descricao LIKE ?';
      queryCount += ' AND t.descricao LIKE ?';
      const termoPesquisa = `%${pesquisa.trim()}%`;
      params.push(termoPesquisa);
      countParams.push(termoPesquisa);
    }

    if (dataInicio) {
      query += ' AND t.data >= ?';
      queryCount += ' AND t.data >= ?';
      params.push(dataInicio);
      countParams.push(dataInicio);
    }

    if (dataFim) {
      query += ' AND t.data <= ?';
      queryCount += ' AND t.data <= ?';
      params.push(dataFim);
      countParams.push(dataFim);
    }

    // Contar total para paginação
    const [countRows] = await db.query(queryCount, countParams);
    const total = countRows[0].total;
    const totalPaginas = Math.ceil(total / limite);

    // Buscar registos com paginação
    query += ' ORDER BY t.data DESC, t.id DESC';
    query += ' LIMIT ? OFFSET ?';
    params.push(limite, (pagina - 1) * limite);

    const [transacoes] = await db.query(query, params);

    return {
      transacoes,
      paginacao: {
        pagina,
        limite,
        total,
        totalPaginas
      }
    };
  }

  /**
   * Buscar transação por ID
   */
  async buscarPorId(transacaoId, utilizadorId) {
    const [transacoes] = await db.query(
      'SELECT * FROM transacoes WHERE id = ? AND utilizador_id = ?',
      [transacaoId, utilizadorId]
    );
    return transacoes[0] || null;
  }

  /**
   * Criar nova transação
   */
  async criar(utilizadorId, { descricao, valor, tipo, categoria_id, data, recorrente, frequencia }) {
    const [resultado] = await db.query(
      'INSERT INTO transacoes (descricao, valor, tipo, categoria_id, data, utilizador_id, recorrente, frequencia, ultima_geracao) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [descricao.trim(), parseFloat(valor), tipo, categoria_id || null, data, utilizadorId, recorrente ? 1 : 0, recorrente ? frequencia : null, recorrente ? data : null]
    );
    return resultado;
  }

  /**
   * Atualizar transação existente
   */
  async atualizar(transacaoId, utilizadorId, { descricao, valor, tipo, categoria_id, data, recorrente, frequencia }) {
    const [resultado] = await db.query(
      'UPDATE transacoes SET descricao = ?, valor = ?, tipo = ?, categoria_id = ?, data = ?, recorrente = ?, frequencia = ? WHERE id = ? AND utilizador_id = ?',
      [descricao.trim(), parseFloat(valor), tipo, categoria_id || null, data, recorrente ? 1 : 0, recorrente ? frequencia : null, transacaoId, utilizadorId]
    );
    return resultado;
  }

  /**
   * Eliminar transação
   */
  async eliminar(transacaoId, utilizadorId) {
    const [resultado] = await db.query(
      'DELETE FROM transacoes WHERE id = ? AND utilizador_id = ?',
      [transacaoId, utilizadorId]
    );
    return resultado;
  }

  /**
   * Processar transações recorrentes - gerar novas transações pendentes
   */
  async processarRecorrentes(utilizadorId) {
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];

    // Buscar transações recorrentes do utilizador
    const [recorrentes] = await db.query(
      'SELECT * FROM transacoes WHERE recorrente = 1 AND utilizador_id = ? AND ultima_geracao IS NOT NULL',
      [utilizadorId]
    );

    for (const trans of recorrentes) {
      let ultimaGeracao = new Date(trans.ultima_geracao);
      let proximaData = this._calcularProximaData(ultimaGeracao, trans.frequencia);

      // Gerar todas as transações pendentes até hoje
      while (proximaData <= hoje) {
        const proximaDataStr = proximaData.toISOString().split('T')[0];
        
        // Verificar se já existe transação para esta data
        const [existente] = await db.query(
          'SELECT id FROM transacoes WHERE descricao = ? AND valor = ? AND tipo = ? AND data = ? AND utilizador_id = ? AND id != ?',
          [trans.descricao, trans.valor, trans.tipo, proximaDataStr, utilizadorId, trans.id]
        );

        if (existente.length === 0) {
          await db.query(
            'INSERT INTO transacoes (descricao, valor, tipo, categoria_id, data, utilizador_id, recorrente, frequencia, ultima_geracao) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, NULL)',
            [trans.descricao, trans.valor, trans.tipo, trans.categoria_id, proximaDataStr, utilizadorId]
          );
        }

        // Atualizar ultima_geracao na transação original
        await db.query(
          'UPDATE transacoes SET ultima_geracao = ? WHERE id = ?',
          [proximaDataStr, trans.id]
        );

        ultimaGeracao = proximaData;
        proximaData = this._calcularProximaData(ultimaGeracao, trans.frequencia);
      }
    }
  }

  /**
   * Calcular próxima data baseada na frequência
   */
  _calcularProximaData(data, frequencia) {
    const novaData = new Date(data);
    switch (frequencia) {
      case 'semanal':
        novaData.setDate(novaData.getDate() + 7);
        break;
      case 'mensal':
        novaData.setMonth(novaData.getMonth() + 1);
        break;
      case 'anual':
        novaData.setFullYear(novaData.getFullYear() + 1);
        break;
    }
    return novaData;
  }
}

module.exports = new TransacoesService();
