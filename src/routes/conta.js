const express = require('express');
const rateLimit = require('express-rate-limit');
const contaService = require('../services/contaService');
const auditService = require('../services/auditService');
const { verificarAdminConta } = require('../middlewares/auth');

const router = express.Router();

const conviteLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Limite de convites por hora atingido.'
});

router.get('/configuracoes', async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const conta = await contaService.obterConta(contaId);
    const membros = await contaService.listarMembros(contaId);
    const convites = await contaService.listarConvites(contaId);
    const auditoria = await auditService.listarPorConta(contaId, 30);

    res.render('conta/configuracoes', {
      titulo: 'Configurações da Conta',
      conta,
      membros,
      convites,
      auditoria,
      isAdmin: req.session.utilizador.papel === 'admin'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/configuracoes', verificarAdminConta, async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const { nome, moeda, timezone } = req.body;

    if (!nome || !nome.trim()) {
      req.session.erro = 'O nome da conta é obrigatório.';
      return res.redirect('/conta/configuracoes');
    }

    await contaService.atualizarConfiguracoes(contaId, { nome, moeda, timezone });

    req.session.utilizador.conta_nome = nome.trim();

    await auditService.registar({
      contaId,
      utilizadorId: req.session.utilizador.id,
      recurso: 'conta',
      acao: 'atualizar_configuracoes',
      recursoId: contaId,
      detalhes: { nome, moeda, timezone },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    req.session.sucesso = 'Configurações da conta atualizadas com sucesso.';
    res.redirect('/conta/configuracoes');
  } catch (err) {
    next(err);
  }
});

router.post('/convites', verificarAdminConta, conviteLimiter, async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const { email, papel } = req.body;

    if (!email || !email.trim()) {
      req.session.erro = 'Email do convite é obrigatório.';
      return res.redirect('/conta/configuracoes');
    }

    const protocol = req.protocol;
    const host = `${protocol}://${req.get('host')}`;

    await contaService.criarConvite({
      contaId,
      convidadoPor: req.session.utilizador.id,
      email: email.trim().toLowerCase(),
      papel: papel === 'admin' ? 'admin' : 'membro',
      host
    });

    await auditService.registar({
      contaId,
      utilizadorId: req.session.utilizador.id,
      recurso: 'convites',
      acao: 'criar',
      detalhes: { email, papel },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    req.session.sucesso = 'Convite enviado com sucesso.';
    res.redirect('/conta/configuracoes');
  } catch (err) {
    req.session.erro = err.message || 'Erro ao enviar convite.';
    res.redirect('/conta/configuracoes');
  }
});

router.post('/convites/:id/cancelar', verificarAdminConta, async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const ok = await contaService.cancelarConvite(contaId, req.params.id);

    if (!ok) {
      req.session.erro = 'Convite não encontrado ou já encerrado.';
      return res.redirect('/conta/configuracoes');
    }

    await auditService.registar({
      contaId,
      utilizadorId: req.session.utilizador.id,
      recurso: 'convites',
      acao: 'cancelar',
      recursoId: req.params.id,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    req.session.sucesso = 'Convite cancelado.';
    res.redirect('/conta/configuracoes');
  } catch (err) {
    next(err);
  }
});

router.get('/convites/aceitar/:token', async (req, res) => {
  if (!req.session.utilizador) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }

  try {
    const convite = await contaService.aceitarConvite(req.params.token, req.session.utilizador.id, req.session.utilizador.email);

    await auditService.registar({
      contaId: convite.conta_id,
      utilizadorId: req.session.utilizador.id,
      recurso: 'convites',
      acao: 'aceitar',
      recursoId: convite.id,
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    req.session.sucesso = 'Convite aceite com sucesso!';
    res.redirect('/dashboard');
  } catch (err) {
    req.session.erro = err.message || 'Não foi possível aceitar o convite.';
    res.redirect('/dashboard');
  }
});

module.exports = router;
