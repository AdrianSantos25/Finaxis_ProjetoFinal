const db = require('../database');

class DashboardService {
  /**
   * Obter dados completos do dashboard para um mês/ano
   */
  async obterDados(utilizadorId, mes, ano) {
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const fimMes = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

    // Executar todas as queries em paralelo (Promise.all)
    const [
      [receitasRows],
      [despesasRows],
      [receitasAcumuladasRows],
      [despesasAcumuladasRows],
      [ultimasTransacoes],
      [despesasPorCategoria],
      [categorias]
    ] = await Promise.all([
      // Total de receitas do mês
      db.query(
        'SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND data BETWEEN ? AND ? AND utilizador_id = ?',
        ['receita', inicioMes, fimMes, utilizadorId]
      ),
      // Total de despesas do mês
      db.query(
        'SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND data BETWEEN ? AND ? AND utilizador_id = ?',
        ['despesa', inicioMes, fimMes, utilizadorId]
      ),
      // Receitas acumuladas até o fim do mês
      db.query(
        'SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND data <= ? AND utilizador_id = ?',
        ['receita', fimMes, utilizadorId]
      ),
      // Despesas acumuladas até o fim do mês
      db.query(
        'SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND data <= ? AND utilizador_id = ?',
        ['despesa', fimMes, utilizadorId]
      ),
      // Últimas transações
      db.query(`
        SELECT t.*, c.nome as categoria_nome, c.cor as categoria_cor
        FROM transacoes t
        LEFT JOIN categorias c ON t.categoria_id = c.id
        WHERE t.utilizador_id = ?
        ORDER BY t.data DESC, t.id DESC
        LIMIT 10
      `, [utilizadorId]),
      // Despesas por categoria
      db.query(`
        SELECT c.nome, c.cor, COALESCE(SUM(t.valor), 0) as total
        FROM categorias c
        LEFT JOIN transacoes t ON c.id = t.categoria_id AND t.data BETWEEN ? AND ? AND t.utilizador_id = ?
        WHERE c.tipo = 'despesa' AND (c.utilizador_id = ? OR c.utilizador_id IS NULL)
        GROUP BY c.id, c.nome, c.cor
        HAVING total > 0
        ORDER BY total DESC
      `, [inicioMes, fimMes, utilizadorId, utilizadorId]),
      // Categorias para o modal
      db.query(
        'SELECT * FROM categorias WHERE utilizador_id = ? OR utilizador_id IS NULL ORDER BY tipo, nome',
        [utilizadorId]
      )
    ]);

    const totalReceitas = parseFloat(receitasRows[0].total) || 0;
    const totalDespesas = parseFloat(despesasRows[0].total) || 0;
    const receitasAcumuladas = parseFloat(receitasAcumuladasRows[0].total) || 0;
    const despesasAcumuladas = parseFloat(despesasAcumuladasRows[0].total) || 0;
    const saldo = receitasAcumuladas - despesasAcumuladas;

    return {
      totalReceitas,
      totalDespesas,
      saldo,
      ultimasTransacoes,
      despesasPorCategoria,
      categorias
    };
  }
}

module.exports = new DashboardService();
