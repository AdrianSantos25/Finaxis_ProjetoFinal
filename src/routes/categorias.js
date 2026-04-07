const express = require('express');
const router = express.Router();
const categoriasService = require('../services/categoriasService');
const auditService = require('../services/auditService');
const { validarCategoria, validarCategoriaAPI } = require('../middlewares/validacao');

// Listar categorias
router.get('/', async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const categorias = await categoriasService.listar(contaId);

    res.render('categorias/lista', {
      titulo: 'Categorias',
      categorias
    });
  } catch (err) {
    next(err);
  }
});

// Formulário nova categoria
router.get('/nova', (req, res) => {
  res.render('categorias/form', {
    titulo: 'Nova Categoria',
    categoria: { cor: '#6c757d' },
    acao: 'criar'
  });
});

// Criar categoria (formulário)
router.post('/', validarCategoria, async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const utilizadorId = req.session.utilizador.id;
    await categoriasService.criar(contaId, utilizadorId, req.body);
    await auditService.registar({
      contaId,
      utilizadorId,
      recurso: 'categorias',
      acao: 'criar',
      detalhes: { nome: req.body.nome, tipo: req.body.tipo },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    req.session.sucesso = 'Categoria criada com sucesso!';
    res.redirect('/categorias');
  } catch (err) {
    next(err);
  }
});

// API para criar categoria via AJAX (modal)
router.post('/api/criar', validarCategoriaAPI, async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const utilizadorId = req.session.utilizador.id;
    const { nome, tipo, cor } = req.body;

    const resultado = await categoriasService.criar(contaId, utilizadorId, req.body);

    res.json({
      success: true,
      message: 'Categoria criada com sucesso!',
      categoria: {
        id: resultado.insertId,
        nome: nome.trim(),
        tipo,
        cor: cor || '#6c757d'
      }
    });
  } catch (err) {
    next(err);
  }
});

// Formulário editar categoria
router.get('/:id/editar', async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const categoria = await categoriasService.buscarPorId(req.params.id, contaId);

    if (!categoria) {
      return res.redirect('/categorias');
    }

    res.render('categorias/form', {
      titulo: 'Editar Categoria',
      categoria,
      acao: 'editar'
    });
  } catch (err) {
    next(err);
  }
});

// Atualizar categoria
router.post('/:id', validarCategoria, async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const categoriaId = req.params.id;

    // Verificar se pertence ao utilizador
    const pertence = await categoriasService.pertenceAoUtilizador(categoriaId, contaId);
    if (!pertence) {
      req.session.erro = 'Categoria não encontrada ou não pode ser editada.';
      return res.redirect('/categorias');
    }

    await categoriasService.atualizar(categoriaId, contaId, req.body);
    await auditService.registar({
      contaId,
      utilizadorId: req.session.utilizador.id,
      recurso: 'categorias',
      acao: 'editar',
      recursoId: categoriaId,
      detalhes: { nome: req.body.nome, tipo: req.body.tipo },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    req.session.sucesso = 'Categoria atualizada com sucesso!';
    res.redirect('/categorias');
  } catch (err) {
    next(err);
  }
});

// Eliminar categoria
router.post('/:id/eliminar', async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const categoriaId = req.params.id;

    // Verificar se pertence ao utilizador
    const pertence = await categoriasService.pertenceAoUtilizador(categoriaId, contaId);
    if (!pertence) {
      req.session.erro = 'Categoria não encontrada ou não pode ser eliminada.';
      return res.redirect('/categorias');
    }

    // Verificar transações vinculadas
    const totalTransacoes = await categoriasService.contarTransacoes(categoriaId);
    if (totalTransacoes > 0) {
      req.session.erro = `Não é possível eliminar. Existem ${totalTransacoes} transação(ões) vinculada(s) a esta categoria.`;
      return res.redirect('/categorias');
    }

    await categoriasService.eliminar(categoriaId, contaId);
    await auditService.registar({
      contaId,
      utilizadorId: req.session.utilizador.id,
      recurso: 'categorias',
      acao: 'eliminar',
      recursoId: categoriaId,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });
    req.session.sucesso = 'Categoria eliminada com sucesso!';
    res.redirect('/categorias');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
