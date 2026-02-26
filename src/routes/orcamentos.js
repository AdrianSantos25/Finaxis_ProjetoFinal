const express = require('express');
const router = express.Router();
const orcamentosService = require('../services/orcamentosService');
const categoriasService = require('../services/categoriasService');

// Listar orçamentos
router.get('/', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const hoje = new Date();
    const mes = parseInt(req.query.mes) || (hoje.getMonth() + 1);
    const ano = parseInt(req.query.ano) || hoje.getFullYear();

    const orcamentos = await orcamentosService.listar(utilizadorId, mes, ano);
    const categorias = await categoriasService.listarSimples(utilizadorId);
    const categoriasDespesa = categorias.filter(c => c.tipo === 'despesa');

    const meses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    // Calcular totais
    const totalLimite = orcamentos.reduce((acc, o) => acc + o.limite, 0);
    const totalGasto = orcamentos.reduce((acc, o) => acc + o.gasto_atual, 0);

    res.render('orcamentos/lista', {
      titulo: 'Orçamentos',
      orcamentos,
      categoriasDespesa,
      mesAtual: mes,
      anoAtual: ano,
      meses,
      nomeMes: meses[mes - 1],
      totalLimite,
      totalGasto
    });
  } catch (err) {
    next(err);
  }
});

// Criar orçamento (API para modal)
router.post('/api/criar', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const { categoria_id, limite, mes, ano } = req.body;

    if (!categoria_id || !limite || !mes || !ano) {
      return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios.' });
    }

    if (parseFloat(limite) <= 0) {
      return res.status(400).json({ success: false, message: 'O limite deve ser um valor positivo.' });
    }

    await orcamentosService.criar(utilizadorId, { categoria_id, limite, mes, ano });
    res.json({ success: true, message: 'Orçamento criado com sucesso!' });
  } catch (err) {
    next(err);
  }
});

// Atualizar orçamento (API)
router.post('/api/:id/atualizar', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const { limite } = req.body;

    if (!limite || parseFloat(limite) <= 0) {
      return res.status(400).json({ success: false, message: 'O limite deve ser um valor positivo.' });
    }

    const resultado = await orcamentosService.atualizar(req.params.id, utilizadorId, { limite });
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Orçamento não encontrado.' });
    }

    res.json({ success: true, message: 'Orçamento atualizado com sucesso!' });
  } catch (err) {
    next(err);
  }
});

// Eliminar orçamento
router.post('/:id/eliminar', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const resultado = await orcamentosService.eliminar(req.params.id, utilizadorId);

    if (resultado.affectedRows === 0) {
      req.session.erro = 'Orçamento não encontrado.';
    } else {
      req.session.sucesso = 'Orçamento eliminado com sucesso!';
    }

    const mes = req.query.mes || new Date().getMonth() + 1;
    const ano = req.query.ano || new Date().getFullYear();
    res.redirect(`/orcamentos?mes=${mes}&ano=${ano}`);
  } catch (err) {
    next(err);
  }
});

// Copiar orçamentos do mês anterior
router.post('/copiar-mes', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const { mesDestino, anoDestino, mesOrigem, anoOrigem } = req.body;

    const total = await orcamentosService.copiarMes(
      utilizadorId, 
      parseInt(mesOrigem), parseInt(anoOrigem),
      parseInt(mesDestino), parseInt(anoDestino)
    );

    req.session.sucesso = `${total} orçamento(s) copiado(s) com sucesso!`;
    res.redirect(`/orcamentos?mes=${mesDestino}&ano=${anoDestino}`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
