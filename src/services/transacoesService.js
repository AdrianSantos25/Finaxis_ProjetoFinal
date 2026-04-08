const db = require('../database');

class TransacoesService {
  /**
   * Listar transações com filtros e paginação
   */
  async listar(contaId, { tipo, categoria, pesquisa, dataInicio, dataFim, pagina = 1, limite = 20 }) {
    let queryCount = 'SELECT COUNT(*) as total FROM transacoes t WHERE t.conta_id = ?';
    let query = `
      SELECT t.*, c.nome as categoria_nome, c.cor as categoria_cor
      FROM transacoes t
      LEFT JOIN categorias c ON t.categoria_id = c.id
      WHERE t.conta_id = ?
    `;
    const params = [contaId];
    const countParams = [contaId];

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
  async buscarPorId(transacaoId, contaId) {
    const [transacoes] = await db.query(
      'SELECT * FROM transacoes WHERE id = ? AND conta_id = ?',
      [transacaoId, contaId]
    );
    return transacoes[0] || null;
  }

  /**
   * Criar nova transação
   */
  async criar(contaId, utilizadorId, { descricao, valor, tipo, categoria_id, data, recorrente, frequencia, notas, comprovativo }) {
    const [resultado] = await db.query(
      'INSERT INTO transacoes (descricao, valor, tipo, categoria_id, data, utilizador_id, conta_id, recorrente, frequencia, ultima_geracao, notas, comprovativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [descricao.trim(), parseFloat(valor), tipo, categoria_id || null, data, utilizadorId, contaId, recorrente ? 1 : 0, recorrente ? frequencia : null, recorrente ? data : null, notas || null, comprovativo || null]
    );
    return resultado;
  }

  async transacaoSemelhanteExiste(contaId, { descricao, valor, tipo, data }) {
    const [rows] = await db.query(
      `SELECT id
       FROM transacoes
       WHERE conta_id = ?
         AND descricao = ?
         AND valor = ?
         AND tipo = ?
         AND data = ?
       LIMIT 1`,
      [contaId, descricao.trim(), parseFloat(valor), tipo, data]
    );
    return rows.length > 0;
  }

  async sugerirCategoriaPorHistorico(contaId, tipo, descricao) {
    const descricaoNormalizada = (descricao || '').trim().toLowerCase();
    if (!descricaoNormalizada) return null;

    // Primeiro tenta match por descricao exata no historico.
    const [exatas] = await db.query(
      `SELECT categoria_id
       FROM transacoes
       WHERE conta_id = ?
         AND tipo = ?
         AND categoria_id IS NOT NULL
         AND LOWER(descricao) = ?
       ORDER BY data DESC, id DESC
       LIMIT 1`,
      [contaId, tipo, descricaoNormalizada]
    );

    if (exatas.length > 0) return exatas[0].categoria_id;

    const palavras = descricaoNormalizada
      .split(/[^a-zA-Z0-9]+/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 4)
      .slice(0, 5);

    if (!palavras.length) return null;

    const condicoes = palavras.map(() => 'LOWER(descricao) LIKE ?').join(' OR ');
    const params = palavras.map((p) => `%${p}%`);

    const [rows] = await db.query(
      `SELECT categoria_id, COUNT(*) as total
       FROM transacoes
       WHERE conta_id = ?
         AND tipo = ?
         AND categoria_id IS NOT NULL
         AND (${condicoes})
       GROUP BY categoria_id
       ORDER BY total DESC
       LIMIT 1`,
      [contaId, tipo, ...params]
    );

    return rows.length > 0 ? rows[0].categoria_id : null;
  }

  /**
   * Atualizar transação existente
   */
  async atualizar(transacaoId, contaId, { descricao, valor, tipo, categoria_id, data, recorrente, frequencia, notas, comprovativo }) {
    const [resultado] = await db.query(
      'UPDATE transacoes SET descricao = ?, valor = ?, tipo = ?, categoria_id = ?, data = ?, recorrente = ?, frequencia = ?, notas = ?, comprovativo = ? WHERE id = ? AND conta_id = ?',
      [descricao.trim(), parseFloat(valor), tipo, categoria_id || null, data, recorrente ? 1 : 0, recorrente ? frequencia : null, notas || null, comprovativo || null, transacaoId, contaId]
    );
    return resultado;
  }

  /**
   * Eliminar transação
   */
  async eliminar(transacaoId, contaId) {
    const [resultado] = await db.query(
      'DELETE FROM transacoes WHERE id = ? AND conta_id = ?',
      [transacaoId, contaId]
    );
    return resultado;
  }

  /**
   * Processar transações recorrentes - gerar novas transações pendentes
   */
  async processarRecorrentes(contaId, utilizadorId) {
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];

    // Buscar transações recorrentes do utilizador
    const [recorrentes] = await db.query(
      'SELECT * FROM transacoes WHERE recorrente = 1 AND conta_id = ? AND ultima_geracao IS NOT NULL',
      [contaId]
    );

    for (const trans of recorrentes) {
      let ultimaGeracao = new Date(trans.ultima_geracao);
      let proximaData = this._calcularProximaData(ultimaGeracao, trans.frequencia);

      // Gerar todas as transações pendentes até hoje
      while (proximaData <= hoje) {
        const proximaDataStr = proximaData.toISOString().split('T')[0];
        
        // Verificar se já existe transação para esta data
        const [existente] = await db.query(
          'SELECT id FROM transacoes WHERE descricao = ? AND valor = ? AND tipo = ? AND data = ? AND conta_id = ? AND id != ?',
          [trans.descricao, trans.valor, trans.tipo, proximaDataStr, contaId, trans.id]
        );

        if (existente.length === 0) {
          await db.query(
            'INSERT INTO transacoes (descricao, valor, tipo, categoria_id, data, utilizador_id, conta_id, recorrente, frequencia, ultima_geracao) VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL)',
            [trans.descricao, trans.valor, trans.tipo, trans.categoria_id, proximaDataStr, utilizadorId || trans.utilizador_id, contaId]
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

  async listarRecorrentesProximas(contaId, dias = 30) {
    const [recorrentes] = await db.query(
      'SELECT * FROM transacoes WHERE recorrente = 1 AND conta_id = ? AND ultima_geracao IS NOT NULL',
      [contaId]
    );

    const hoje = new Date();
    const limite = new Date();
    limite.setDate(limite.getDate() + dias);
    const previstas = [];

    for (const trans of recorrentes) {
      let cursor = new Date(trans.ultima_geracao);
      let proximaData = this._calcularProximaData(cursor, trans.frequencia);

      while (proximaData <= limite) {
        if (proximaData >= hoje) {
          previstas.push({
            idModelo: trans.id,
            descricao: trans.descricao,
            tipo: trans.tipo,
            valor: parseFloat(trans.valor),
            data: proximaData.toISOString().split('T')[0],
            frequencia: trans.frequencia
          });
        }
        cursor = proximaData;
        proximaData = this._calcularProximaData(cursor, trans.frequencia);
      }
    }

    return previstas.sort((a, b) => new Date(a.data) - new Date(b.data));
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
