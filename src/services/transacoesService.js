const db = require('../database');

class TransacoesService {
  /**
   * Listar transações com filtros e paginação
   */
  async listar(utilizadorId, { tipo, categoria, pagina = 1, limite = 20 }) {
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
  async criar(utilizadorId, { descricao, valor, tipo, categoria_id, data }) {
    const [resultado] = await db.query(
      'INSERT INTO transacoes (descricao, valor, tipo, categoria_id, data, utilizador_id) VALUES (?, ?, ?, ?, ?, ?)',
      [descricao.trim(), parseFloat(valor), tipo, categoria_id || null, data, utilizadorId]
    );
    return resultado;
  }

  /**
   * Atualizar transação existente
   */
  async atualizar(transacaoId, utilizadorId, { descricao, valor, tipo, categoria_id, data }) {
    const [resultado] = await db.query(
      'UPDATE transacoes SET descricao = ?, valor = ?, tipo = ?, categoria_id = ?, data = ? WHERE id = ? AND utilizador_id = ?',
      [descricao.trim(), parseFloat(valor), tipo, categoria_id || null, data, transacaoId, utilizadorId]
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
}

module.exports = new TransacoesService();
