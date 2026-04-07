const db = require('../database');

class CategoriasService {
  /**
   * Listar categorias do utilizador (incluindo padrão)
   */
  async listar(contaId) {
    const [categorias] = await db.query(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM transacoes WHERE categoria_id = c.id AND conta_id = ?) as total_transacoes
      FROM categorias c
      WHERE c.conta_id = ? OR c.utilizador_id IS NULL
      ORDER BY c.tipo, c.nome
    `, [contaId, contaId]);
    return categorias;
  }

  /**
   * Listar categorias simples (para selects)
   */
  async listarSimples(contaId) {
    const [categorias] = await db.query(
      'SELECT * FROM categorias WHERE conta_id = ? OR utilizador_id IS NULL ORDER BY tipo, nome',
      [contaId]
    );
    return categorias;
  }

  /**
   * Buscar categoria por ID
   */
  async buscarPorId(categoriaId, contaId) {
    const [categorias] = await db.query(
      'SELECT * FROM categorias WHERE id = ? AND (conta_id = ? OR utilizador_id IS NULL)',
      [categoriaId, contaId]
    );
    return categorias[0] || null;
  }

  /**
   * Criar nova categoria
   */
  async criar(contaId, utilizadorId, { nome, tipo, cor }) {
    const [resultado] = await db.query(
      'INSERT INTO categorias (nome, tipo, cor, utilizador_id, conta_id) VALUES (?, ?, ?, ?, ?)',
      [nome.trim(), tipo, cor || '#6c757d', utilizadorId, contaId]
    );
    return resultado;
  }

  /**
   * Atualizar categoria
   */
  async atualizar(categoriaId, contaId, { nome, tipo, cor }) {
    const [resultado] = await db.query(
      'UPDATE categorias SET nome = ?, tipo = ?, cor = ? WHERE id = ? AND conta_id = ?',
      [nome.trim(), tipo, cor || '#6c757d', categoriaId, contaId]
    );
    return resultado;
  }

  /**
   * Verificar se categoria pertence ao utilizador
   */
  async pertenceAoUtilizador(categoriaId, contaId) {
    const [categorias] = await db.query(
      'SELECT id FROM categorias WHERE id = ? AND conta_id = ?',
      [categoriaId, contaId]
    );
    return categorias.length > 0;
  }

  /**
   * Contar transações vinculadas a uma categoria
   */
  async contarTransacoes(categoriaId) {
    const [rows] = await db.query(
      'SELECT COUNT(*) as count FROM transacoes WHERE categoria_id = ?',
      [categoriaId]
    );
    return rows[0].count;
  }

  /**
   * Eliminar categoria
   */
  async eliminar(categoriaId, contaId) {
    const [resultado] = await db.query(
      'DELETE FROM categorias WHERE id = ? AND conta_id = ?',
      [categoriaId, contaId]
    );
    return resultado;
  }
}

module.exports = new CategoriasService();
