const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const hoje = new Date();
    const ano = parseInt(req.query.ano) || hoje.getFullYear();
    
    // Dados mensais do ano
    const dadosMensais = [];
    const meses = [
      'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
      'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
    ];
    
    for (let mes = 1; mes <= 12; mes++) {
      // Calcular o último dia do mês corretamente
      const ultimoDia = new Date(ano, mes, 0).getDate();
      const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
      const fimMes = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
      
      const [receitasRows] = await db.query(
        'SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND data BETWEEN ? AND ? AND utilizador_id = ?',
        ['receita', inicioMes, fimMes, utilizadorId]
      );
      
      const [despesasRows] = await db.query(
        'SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND data BETWEEN ? AND ? AND utilizador_id = ?',
        ['despesa', inicioMes, fimMes, utilizadorId]
      );
      
      const receitas = parseFloat(receitasRows[0].total) || 0;
      const despesas = parseFloat(despesasRows[0].total) || 0;
      
      dadosMensais.push({
        mes: meses[mes - 1],
        receitas,
        despesas,
        saldo: receitas - despesas
      });
    }
    
    // Totais anuais
    const totalReceitasAno = dadosMensais.reduce((acc, m) => acc + m.receitas, 0);
    const totalDespesasAno = dadosMensais.reduce((acc, m) => acc + m.despesas, 0);
    const saldoAno = totalReceitasAno - totalDespesasAno;
    
    // Top categorias de despesa
    const [topDespesas] = await db.query(`
      SELECT c.nome, c.cor, SUM(t.valor) as total
      FROM transacoes t
      JOIN categorias c ON t.categoria_id = c.id
      WHERE t.tipo = 'despesa' AND YEAR(t.data) = ? AND t.utilizador_id = ?
      GROUP BY c.id, c.nome, c.cor
      ORDER BY total DESC
      LIMIT 5
    `, [ano, utilizadorId]);
    
    // Anos disponíveis
    const [anosRows] = await db.query(
      'SELECT DISTINCT YEAR(data) as ano FROM transacoes WHERE utilizador_id = ? ORDER BY ano DESC',
      [utilizadorId]
    );
    let anosDisponiveis = anosRows.map(r => r.ano);
    
    if (!anosDisponiveis.includes(ano)) {
      anosDisponiveis.push(ano);
      anosDisponiveis.sort((a, b) => b - a);
    }
    
    res.render('relatorios/index', {
      titulo: 'Relatórios',
      ano,
      dadosMensais,
      totalReceitasAno,
      totalDespesasAno,
      saldoAno,
      topDespesas,
      anosDisponiveis
    });
  } catch (err) {
    console.error('Erro nos relatórios:', err);
    res.status(500).send('Erro ao carregar relatórios');
  }
});

module.exports = router;
