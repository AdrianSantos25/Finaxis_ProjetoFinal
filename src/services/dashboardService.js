const db = require('../database');
const transacoesService = require('./transacoesService');
const metasService = require('./metasService');

class DashboardService {
  /**
   * Obter dados completos do dashboard para um mês/ano
   */
  async obterDados(contaId, mes, ano) {
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
      [categorias],
      metasResumo,
      alertasInteligentes
    ] = await Promise.all([
      // Total de receitas do mês
      db.query(
        'SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND data BETWEEN ? AND ? AND conta_id = ?',
        ['receita', inicioMes, fimMes, contaId]
      ),
      // Total de despesas do mês
      db.query(
        'SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND data BETWEEN ? AND ? AND conta_id = ?',
        ['despesa', inicioMes, fimMes, contaId]
      ),
      // Receitas acumuladas até o fim do mês
      db.query(
        'SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND data <= ? AND conta_id = ?',
        ['receita', fimMes, contaId]
      ),
      // Despesas acumuladas até o fim do mês
      db.query(
        'SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND data <= ? AND conta_id = ?',
        ['despesa', fimMes, contaId]
      ),
      // Últimas transações
      db.query(`
        SELECT t.*, c.nome as categoria_nome, c.cor as categoria_cor
        FROM transacoes t
        LEFT JOIN categorias c ON t.categoria_id = c.id
        WHERE t.conta_id = ?
        ORDER BY t.data DESC, t.id DESC
        LIMIT 10
      `, [contaId]),
      // Despesas por categoria
      db.query(`
        SELECT c.nome, c.cor, COALESCE(SUM(t.valor), 0) as total
        FROM categorias c
        LEFT JOIN transacoes t ON c.id = t.categoria_id AND t.data BETWEEN ? AND ? AND t.conta_id = ?
        WHERE c.tipo = 'despesa' AND (c.conta_id = ? OR c.utilizador_id IS NULL)
        GROUP BY c.id, c.nome, c.cor
        HAVING total > 0
        ORDER BY total DESC
      `, [inicioMes, fimMes, contaId, contaId]),
      // Categorias para o modal
      db.query(
        'SELECT * FROM categorias WHERE conta_id = ? OR utilizador_id IS NULL ORDER BY tipo, nome',
        [contaId]
      ),
      metasService.obterResumoDashboard(contaId),
      this.obterAlertasInteligentes(contaId)
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
      categorias,
      metasResumo,
      alertasInteligentes
    };
  }

  async obterAlertasInteligentes(contaId) {
    const alertas = [];
    const hoje = new Date();
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    const hojeStr = hoje.toISOString().split('T')[0];
    const fimMesStr = fimMes.toISOString().split('T')[0];

    const [[saldoAteHojeRows], [saldoMesRows], recorrentesProximos] = await Promise.all([
      db.query(
        `SELECT
            COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END), 0) as receitas,
            COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END), 0) as despesas
         FROM transacoes
         WHERE conta_id = ? AND data <= ?`,
        [contaId, hojeStr]
      ),
      db.query(
        `SELECT
            COALESCE(SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END), 0) as receitas,
            COALESCE(SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END), 0) as despesas
         FROM transacoes
         WHERE conta_id = ? AND data BETWEEN ? AND ?`,
        [contaId, hojeStr, fimMesStr]
      ),
      transacoesService.listarRecorrentesProximas(contaId, 30)
    ]);

    const saldoAteHoje = (parseFloat(saldoAteHojeRows[0].receitas) || 0) - (parseFloat(saldoAteHojeRows[0].despesas) || 0);
    const saldoMesRestante = (parseFloat(saldoMesRows[0].receitas) || 0) - (parseFloat(saldoMesRows[0].despesas) || 0);

    const receitasPrevistas = recorrentesProximos
      .filter((r) => r.tipo === 'receita')
      .reduce((acc, r) => acc + r.valor, 0);
    const despesasPrevistas = recorrentesProximos
      .filter((r) => r.tipo === 'despesa')
      .reduce((acc, r) => acc + r.valor, 0);

    const saldoProjetado = saldoAteHoje + saldoMesRestante + receitasPrevistas - despesasPrevistas;
    if (saldoProjetado < 0) {
      alertas.push({
        tipo: 'saldo_negativo',
        nivel: 'danger',
        titulo: 'Saldo projetado negativo',
        mensagem: `O saldo projetado para os proximos 30 dias e ${saldoProjetado.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}.`
      });
    }

    const proximos7dias = recorrentesProximos.filter((r) => {
      const data = new Date(r.data);
      const limite7 = new Date();
      limite7.setDate(limite7.getDate() + 7);
      return r.tipo === 'despesa' && data <= limite7;
    });

    if (proximos7dias.length > 0) {
      const total7dias = proximos7dias.reduce((acc, r) => acc + r.valor, 0);
      alertas.push({
        tipo: 'despesas_proximas',
        nivel: 'warning',
        titulo: 'Contas recorrentes proximas do vencimento',
        mensagem: `${proximos7dias.length} lancamento(s) recorrente(s) de despesa nos proximos 7 dias (${total7dias.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}).`
      });
    }

    return alertas;
  }
}

module.exports = new DashboardService();
