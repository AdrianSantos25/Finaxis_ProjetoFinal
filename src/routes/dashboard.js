const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboardService');

router.get('/', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    
    // Pegar mês e ano atual ou dos parâmetros
    const hoje = new Date();
    const mes = parseInt(req.query.mes) || (hoje.getMonth() + 1);
    const ano = parseInt(req.query.ano) || hoje.getFullYear();
    
    // Obter dados do dashboard (queries executadas em paralelo)
    const dados = await dashboardService.obterDados(utilizadorId, mes, ano);
    
    // Meses para navegação
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    res.render('dashboard', {
      titulo: 'Dashboard',
      ...dados,
      mesAtual: mes,
      anoAtual: ano,
      meses,
      nomeMes: meses[mes - 1]
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
