const express = require('express');
const router = express.Router();
const dashboardService = require('../services/dashboardService');
const orcamentosService = require('../services/orcamentosService');
const transacoesService = require('../services/transacoesService');

router.get('/', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    
    // Pegar mês e ano atual ou dos parâmetros
    const hoje = new Date();
    const mes = parseInt(req.query.mes) || (hoje.getMonth() + 1);
    const ano = parseInt(req.query.ano) || hoje.getFullYear();
    
    // Obter dados do dashboard e orçamentos em paralelo
    const [dados, orcamentosDados] = await Promise.all([
      dashboardService.obterDados(utilizadorId, mes, ano),
      orcamentosService.obterResumoDashboard(utilizadorId, mes, ano)
    ]);

    // Processar transações recorrentes
    await transacoesService.processarRecorrentes(utilizadorId);
    
    // Meses para navegação
    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    res.render('dashboard', {
      titulo: 'Dashboard',
      ...dados,
      orcamentos: orcamentosDados.orcamentos,
      alertasOrcamento: orcamentosDados.alertas,
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
