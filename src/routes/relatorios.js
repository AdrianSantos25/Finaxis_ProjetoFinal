const express = require('express');
const router = express.Router();
const multer = require('multer');
const relatoriosService = require('../services/relatoriosService');

// Configurar multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB máx
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];
    const allowedExts = ['.csv', '.xls', '.xlsx'];
    const ext = '.' + file.originalname.split('.').pop().toLowerCase();
    if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Formato de ficheiro não suportado. Use CSV, XLS ou XLSX.'));
    }
  }
});

router.get('/', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const hoje = new Date();
    const ano = parseInt(req.query.ano) || hoje.getFullYear();
    const mes = parseInt(req.query.mes) || (hoje.getMonth() + 1);

    // Executar queries em paralelo
    const [dados, evolucao, comparacao] = await Promise.all([
      relatoriosService.obterDadosAnuais(utilizadorId, ano),
      relatoriosService.obterEvolucaoMensal(utilizadorId, mes, ano),
      relatoriosService.obterComparacaoMeses(utilizadorId, mes, ano)
    ]);

    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    res.render('relatorios/index', {
      titulo: 'Relatórios',
      ano,
      mesAtual: mes,
      nomeMes: meses[mes - 1],
      meses,
      evolucao,
      comparacao,
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

// Exportar relatório em Excel
router.get('/exportar/excel', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const ano = parseInt(req.query.ano) || new Date().getFullYear();

    const buffer = await relatoriosService.exportarExcel(utilizadorId, ano);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio_${ano}.xlsx`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// Exportar relatório em PDF
router.get('/exportar/pdf', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const ano = parseInt(req.query.ano) || new Date().getFullYear();

    const buffer = await relatoriosService.exportarPDF(utilizadorId, ano);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio_${ano}.pdf`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// Importar transações de ficheiro CSV/Excel
router.post('/importar', upload.single('ficheiro'), async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;

    if (!req.file) {
      req.session.erro = 'Nenhum ficheiro selecionado.';
      return res.redirect('/relatorios');
    }

    const resultado = await relatoriosService.importarDados(
      utilizadorId,
      req.file.buffer,
      req.file.originalname
    );

    if (resultado.sucesso > 0) {
      req.session.sucesso = `${resultado.sucesso} transação(ões) importada(s) com sucesso!`;
    }

    if (resultado.erros.length > 0) {
      const errosTexto = resultado.erros.slice(0, 5).join(' | ');
      const mais = resultado.erros.length > 5 ? ` ... e mais ${resultado.erros.length - 5} erro(s).` : '';
      req.session.erro = (req.session.erro ? req.session.erro + ' ' : '') + `Erros: ${errosTexto}${mais}`;
    }

    if (resultado.sucesso === 0 && resultado.erros.length === 0) {
      req.session.erro = 'Nenhum dado válido encontrado no ficheiro.';
    }

    res.redirect('/relatorios');
  } catch (err) {
    if (err.message && err.message.includes('Formato')) {
      req.session.erro = err.message;
      return res.redirect('/relatorios');
    }
    next(err);
  }
});

module.exports = router;
