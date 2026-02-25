const db = require('../database');

class RelatoriosService {
  /**
   * Obter dados mensais de um ano para relatórios
   */
  async obterDadosAnuais(utilizadorId, ano) {
    const mesesNomes = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];

    // Buscar todos os totais mensais numa única query
    const [receitasMensais] = await db.query(`
      SELECT MONTH(data) as mes, COALESCE(SUM(valor), 0) as total
      FROM transacoes
      WHERE tipo = 'receita' AND YEAR(data) = ? AND utilizador_id = ?
      GROUP BY MONTH(data)
    `, [ano, utilizadorId]);

    const [despesasMensais] = await db.query(`
      SELECT MONTH(data) as mes, COALESCE(SUM(valor), 0) as total
      FROM transacoes
      WHERE tipo = 'despesa' AND YEAR(data) = ? AND utilizador_id = ?
      GROUP BY MONTH(data)
    `, [ano, utilizadorId]);

    // Mapear receitas e despesas por mês
    const receitasMap = {};
    receitasMensais.forEach(r => { receitasMap[r.mes] = parseFloat(r.total) || 0; });
    const despesasMap = {};
    despesasMensais.forEach(d => { despesasMap[d.mes] = parseFloat(d.total) || 0; });

    const dadosMensais = [];
    for (let mes = 1; mes <= 12; mes++) {
      const receitas = receitasMap[mes] || 0;
      const despesas = despesasMap[mes] || 0;
      dadosMensais.push({
        mes: mesesNomes[mes - 1],
        receitas,
        despesas,
        saldo: receitas - despesas
      });
    }

    // Totais anuais
    const totalReceitasAno = dadosMensais.reduce((acc, m) => acc + m.receitas, 0);
    const totalDespesasAno = dadosMensais.reduce((acc, m) => acc + m.despesas, 0);
    const saldoAno = totalReceitasAno - totalDespesasAno;

    // Top categorias de despesa (em paralelo)
    const [[topDespesas], [anosRows]] = await Promise.all([
      db.query(`
        SELECT c.nome, c.cor, SUM(t.valor) as total
        FROM transacoes t
        JOIN categorias c ON t.categoria_id = c.id
        WHERE t.tipo = 'despesa' AND YEAR(t.data) = ? AND t.utilizador_id = ?
        GROUP BY c.id, c.nome, c.cor
        ORDER BY total DESC
        LIMIT 5
      `, [ano, utilizadorId]),
      db.query(
        'SELECT DISTINCT YEAR(data) as ano FROM transacoes WHERE utilizador_id = ? ORDER BY ano DESC',
        [utilizadorId]
      )
    ]);

    let anosDisponiveis = anosRows.map(r => r.ano);
    if (!anosDisponiveis.includes(ano)) {
      anosDisponiveis.push(ano);
      anosDisponiveis.sort((a, b) => b - a);
    }

    return {
      dadosMensais,
      totalReceitasAno,
      totalDespesasAno,
      saldoAno,
      topDespesas,
      anosDisponiveis
    };
  }

  /**
   * Exportar transações de um ano em formato CSV
   */
  async exportarCSV(utilizadorId, ano) {
    const [transacoes] = await db.query(
      `SELECT t.descricao, t.valor, t.tipo, t.data, c.nome as categoria
       FROM transacoes t
       LEFT JOIN categorias c ON t.categoria_id = c.id
       WHERE t.utilizador_id = ? AND YEAR(t.data) = ?
       ORDER BY t.data DESC`,
      [utilizadorId, ano]
    );

    let csv = 'Data;Descrição;Tipo;Categoria;Valor\n';
    transacoes.forEach(t => {
      const data = new Date(t.data).toLocaleDateString('pt-PT');
      const descricao = t.descricao.replace(/;/g, ','); // Escapar separadores
      const categoria = t.categoria || 'Sem categoria';
      const valor = parseFloat(t.valor).toFixed(2).replace('.', ',');
      csv += `${data};${descricao};${t.tipo};${categoria};${valor}\n`;
    });

    return csv;
  }
}

module.exports = new RelatoriosService();
