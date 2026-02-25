const express = require('express');
const router = express.Router();
const relatoriosService = require('../services/relatoriosService');

router.get('/', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const hoje = new Date();
    const ano = parseInt(req.query.ano) || hoje.getFullYear();

    const dados = await relatoriosService.obterDadosAnuais(utilizadorId, ano);

    res.render('relatorios/index', {
      titulo: 'Relatórios',
      ano,
      ...dados
    });
  } catch (err) {
    next(err);
  }
});

// Exportar relatório em CSV
router.get('/exportar/csv', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const ano = parseInt(req.query.ano) || new Date().getFullYear();

    const csv = await relatoriosService.exportarCSV(utilizadorId, ano);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio_${ano}.csv`);
    // BOM para Excel reconhecer UTF-8
    res.send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
