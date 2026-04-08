const express = require('express');
const router = express.Router();
const metasService = require('../services/metasService');
const auditService = require('../services/auditService');

router.get('/', async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const metas = await metasService.listar(contaId);

    res.render('metas/lista', {
      titulo: 'Metas',
      metas
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const utilizadorId = req.session.utilizador.id;
    const { titulo, tipo, valor_objetivo, valor_atual, data_objetivo } = req.body;

    if (!titulo || !titulo.trim()) {
      req.session.erro = 'Título da meta é obrigatório.';
      return res.redirect('/metas');
    }

    const valorObjetivo = parseFloat(valor_objetivo);
    if (Number.isNaN(valorObjetivo) || valorObjetivo <= 0) {
      req.session.erro = 'Valor objetivo inválido.';
      return res.redirect('/metas');
    }

    await metasService.criar(contaId, utilizadorId, {
      titulo,
      tipo,
      valor_objetivo: valorObjetivo,
      valor_atual,
      data_objetivo
    });

    await auditService.registar({
      contaId,
      utilizadorId,
      recurso: 'metas',
      acao: 'criar',
      detalhes: { titulo, tipo, valor_objetivo: valorObjetivo },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    req.session.sucesso = 'Meta criada com sucesso.';
    res.redirect('/metas');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/progresso', async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const utilizadorId = req.session.utilizador.id;
    const valorAtual = parseFloat(req.body.valor_atual);

    if (Number.isNaN(valorAtual) || valorAtual < 0) {
      req.session.erro = 'Valor atual inválido.';
      return res.redirect('/metas');
    }

    const resultado = await metasService.atualizarProgresso(req.params.id, contaId, valorAtual);
    if (resultado.affectedRows === 0) {
      req.session.erro = 'Meta não encontrada.';
      return res.redirect('/metas');
    }

    await auditService.registar({
      contaId,
      utilizadorId,
      recurso: 'metas',
      acao: 'atualizar_progresso',
      recursoId: req.params.id,
      detalhes: { valor_atual: valorAtual },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    req.session.sucesso = 'Progresso da meta atualizado.';
    res.redirect('/metas');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/estado', async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const utilizadorId = req.session.utilizador.id;
    const { status } = req.body;

    const resultado = await metasService.atualizarEstado(req.params.id, contaId, status);
    if (resultado.affectedRows === 0) {
      req.session.erro = 'Meta não encontrada.';
      return res.redirect('/metas');
    }

    await auditService.registar({
      contaId,
      utilizadorId,
      recurso: 'metas',
      acao: 'alterar_estado',
      recursoId: req.params.id,
      detalhes: { status },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    req.session.sucesso = 'Estado da meta atualizado.';
    res.redirect('/metas');
  } catch (err) {
    next(err);
  }
});

router.post('/:id/eliminar', async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const utilizadorId = req.session.utilizador.id;

    const resultado = await metasService.eliminar(req.params.id, contaId);
    if (resultado.affectedRows === 0) {
      req.session.erro = 'Meta não encontrada.';
      return res.redirect('/metas');
    }

    await auditService.registar({
      contaId,
      utilizadorId,
      recurso: 'metas',
      acao: 'eliminar',
      recursoId: req.params.id,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    req.session.sucesso = 'Meta eliminada.';
    res.redirect('/metas');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
