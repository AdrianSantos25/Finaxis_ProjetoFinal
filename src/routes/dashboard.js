const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    
    // Pegar mês e ano atual ou dos parâmetros
    const hoje = new Date();
    const mes = parseInt(req.query.mes) || (hoje.getMonth() + 1);
    const ano = parseInt(req.query.ano) || hoje.getFullYear();
    
    // Calcular o último dia do mês corretamente
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const inicioMes = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const fimMes = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;
    
    // Total de receitas do mês
    const [receitasRows] = await db.query(
      'SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND data BETWEEN ? AND ? AND utilizador_id = ?',
      ['receita', inicioMes, fimMes, utilizadorId]
    );
    const totalReceitas = parseFloat(receitasRows[0].total) || 0;
    
    // Total de despesas do mês
    const [despesasRows] = await db.query(
      'SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND data BETWEEN ? AND ? AND utilizador_id = ?',
      ['despesa', inicioMes, fimMes, utilizadorId]
    );
    const totalDespesas = parseFloat(despesasRows[0].total) || 0;
    
    // Saldo acumulado (todas as transações até o fim do mês selecionado)
    const [receitasAcumuladasRows] = await db.query(
      'SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND data <= ? AND utilizador_id = ?',
      ['receita', fimMes, utilizadorId]
    );
    const receitasAcumuladas = parseFloat(receitasAcumuladasRows[0].total) || 0;
    
    const [despesasAcumuladasRows] = await db.query(
      'SELECT COALESCE(SUM(valor), 0) as total FROM transacoes WHERE tipo = ? AND data <= ? AND utilizador_id = ?',
      ['despesa', fimMes, utilizadorId]
    );
    const despesasAcumuladas = parseFloat(despesasAcumuladasRows[0].total) || 0;
    
    // Saldo = todas receitas até o mês - todas despesas até o mês
    const saldo = receitasAcumuladas - despesasAcumuladas;
    
    // Últimas transações
    const [ultimasTransacoes] = await db.query(`
      SELECT t.*, c.nome as categoria_nome, c.cor as categoria_cor
      FROM transacoes t
      LEFT JOIN categorias c ON t.categoria_id = c.id
      WHERE t.utilizador_id = ?
      ORDER BY t.data DESC, t.id DESC
      LIMIT 10
    `, [utilizadorId]);
    
    // Despesas por categoria
    const [despesasPorCategoria] = await db.query(`
      SELECT c.nome, c.cor, COALESCE(SUM(t.valor), 0) as total
      FROM categorias c
      LEFT JOIN transacoes t ON c.id = t.categoria_id AND t.data BETWEEN ? AND ? AND t.utilizador_id = ?
      WHERE c.tipo = 'despesa' AND (c.utilizador_id = ? OR c.utilizador_id IS NULL)
      GROUP BY c.id, c.nome, c.cor
      HAVING total > 0
      ORDER BY total DESC
    `, [inicioMes, fimMes, utilizadorId, utilizadorId]);
    
    // Categorias para o modal de nova transação
    const [categorias] = await db.query(
      'SELECT * FROM categorias WHERE utilizador_id = ? OR utilizador_id IS NULL ORDER BY tipo, nome',
      [utilizadorId]
    );
    
    // Meses para navegação
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    res.render('dashboard', {
      titulo: 'Dashboard',
      totalReceitas,
      totalDespesas,
      saldo,
      ultimasTransacoes,
      despesasPorCategoria,
      categorias,
      mesAtual: mes,
      anoAtual: ano,
      meses,
      nomeMes: meses[mes - 1]
    });
  } catch (err) {
    console.error('Erro no dashboard:', err);
    res.status(500).send('Erro ao carregar dashboard');
  }
});

module.exports = router;
