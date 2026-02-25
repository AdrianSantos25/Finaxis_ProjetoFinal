const db = require('../database');

class CategoriasService {
  /**
   * Listar categorias do utilizador (incluindo padrão)
   */
  async listar(utilizadorId) {
    const [categorias] = await db.query(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM transacoes WHERE categoria_id = c.id AND utilizador_id = ?) as total_transacoes
      FROM categorias c
      WHERE c.utilizador_id = ? OR c.utilizador_id IS NULL
      ORDER BY c.tipo, c.nome
    `, [utilizadorId, utilizadorId]);
    return categorias;
  }

  /**
   * Listar categorias simples (para selects)
   */
  async listarSimples(utilizadorId) {
    const [categorias] = await db.query(
      'SELECT * FROM categorias WHERE utilizador_id = ? OR utilizador_id IS NULL ORDER BY tipo, nome',
      [utilizadorId]
    );
    return categorias;
  }

  /**
   * Buscar categoria por ID
   */
  async buscarPorId(categoriaId, utilizadorId) {
    const [categorias] = await db.query(
      'SELECT * FROM categorias WHERE id = ? AND (utilizador_id = ? OR utilizador_id IS NULL)',
      [categoriaId, utilizadorId]
    );
    return categorias[0] || null;
  }

  /**
   * Criar nova categoria
   */
  async criar(utilizadorId, { nome, tipo, cor }) {
    const [resultado] = await db.query(
      'INSERT INTO categorias (nome, tipo, cor, utilizador_id) VALUES (?, ?, ?, ?)',
      [nome.trim(), tipo, cor || '#6c757d', utilizadorId]
    );
    return resultado;
  }

  /**
   * Atualizar categoria
   */
  async atualizar(categoriaId, utilizadorId, { nome, tipo, cor }) {
    const [resultado] = await db.query(
      'UPDATE categorias SET nome = ?, tipo = ?, cor = ? WHERE id = ? AND utilizador_id = ?',
      [nome.trim(), tipo, cor || '#6c757d', categoriaId, utilizadorId]
    );
    return resultado;
  }

  /**
   * Verificar se categoria pertence ao utilizador
   */
  async pertenceAoUtilizador(categoriaId, utilizadorId) {
    const [categorias] = await db.query(
      'SELECT id FROM categorias WHERE id = ? AND utilizador_id = ?',
      [categoriaId, utilizadorId]
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
  async eliminar(categoriaId, utilizadorId) {
    const [resultado] = await db.query(
      'DELETE FROM categorias WHERE id = ? AND utilizador_id = ?',
      [categoriaId, utilizadorId]
    );
    return resultado;
  }
}

module.exports = new CategoriasService();
