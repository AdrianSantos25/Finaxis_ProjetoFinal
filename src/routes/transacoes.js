const express = require('express');
const router = express.Router();
const transacoesService = require('../services/transacoesService');
const categoriasService = require('../services/categoriasService');
const { validarTransacao, validarTransacaoAPI } = require('../middlewares/validacao');

// Listar transações (com paginação)
router.get('/', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const tipo = req.query.tipo || '';
    const categoria = req.query.categoria || '';
    const pesquisa = req.query.pesquisa || '';
    const dataInicio = req.query.dataInicio || '';
    const dataFim = req.query.dataFim || '';
    const pagina = parseInt(req.query.pagina) || 1;
    const limite = 20;

    const { transacoes, paginacao } = await transacoesService.listar(utilizadorId, {
      tipo,
      categoria,
      pesquisa,
      dataInicio,
      dataFim,
      pagina,
      limite
    });

    const categorias = await categoriasService.listarSimples(utilizadorId);

    res.render('transacoes/lista', {
      titulo: 'Transações',
      transacoes,
      categorias,
      filtroTipo: tipo,
      filtroCategoria: categoria,
      filtroPesquisa: pesquisa,
      filtroDataInicio: dataInicio,
      filtroDataFim: dataFim,
      paginacao
    });
  } catch (err) {
    next(err);
  }
});

// Formulário nova transação
router.get('/nova', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const categorias = await categoriasService.listarSimples(utilizadorId);
    const hoje = new Date().toISOString().split('T')[0];

    res.render('transacoes/form', {
      titulo: 'Nova Transação',
      transacao: { data: hoje },
      categorias,
      acao: 'criar'
    });
  } catch (err) {
    next(err);
  }
});

// Criar transação (formulário)
router.post('/', validarTransacao, async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    await transacoesService.criar(utilizadorId, req.body);
    req.session.sucesso = 'Transação criada com sucesso!';
    res.redirect('/transacoes');
  } catch (err) {
    next(err);
  }
});

// API para criar transação via AJAX (modal)
router.post('/api/criar', validarTransacaoAPI, async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    await transacoesService.criar(utilizadorId, req.body);
    res.json({ success: true, message: 'Transação criada com sucesso!' });
  } catch (err) {
    next(err);
  }
});

// Formulário editar transação
router.get('/:id/editar', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const transacao = await transacoesService.buscarPorId(req.params.id, utilizadorId);

    if (!transacao) {
      return res.redirect('/transacoes');
    }

    const categorias = await categoriasService.listarSimples(utilizadorId);

    res.render('transacoes/form', {
      titulo: 'Editar Transação',
      transacao,
      categorias,
      acao: 'editar'
    });
  } catch (err) {
    next(err);
  }
});

// Atualizar transação
router.post('/:id', validarTransacao, async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const transacaoId = req.params.id;

    // Verificar se a transação existe e pertence ao utilizador
    const transacao = await transacoesService.buscarPorId(transacaoId, utilizadorId);
    if (!transacao) {
      req.session.erro = 'Transação não encontrada.';
      return res.redirect('/transacoes');
    }

    await transacoesService.atualizar(transacaoId, utilizadorId, req.body);
    req.session.sucesso = 'Transação atualizada com sucesso!';
    res.redirect('/transacoes');
  } catch (err) {
    next(err);
  }
});

// Eliminar transação
router.post('/:id/eliminar', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const resultado = await transacoesService.eliminar(req.params.id, utilizadorId);

    if (resultado.affectedRows === 0) {
      req.session.erro = 'Transação não encontrada.';
    } else {
      req.session.sucesso = 'Transação eliminada com sucesso!';
    }

    res.redirect('/transacoes');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
