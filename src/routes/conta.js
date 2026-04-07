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
    const utilizadorAtualId = req.session.utilizador.id;
    const conta = await contaService.obterConta(contaId);
    const membros = await contaService.listarMembros(contaId);
    const convites = await contaService.listarConvites(contaId);
    const auditoria = await auditService.listarPorConta(contaId, 30);

    const totalAdmins = membros.filter((m) => m.papel === 'admin').length;
    const totalMembros = membros.length;

    res.render('conta/configuracoes', {
      titulo: 'Configurações da Conta',
      conta,
      membros,
      convites,
      auditoria,
      isAdmin: req.session.utilizador.papel === 'admin',
      utilizadorAtualId,
      totalAdmins,
      totalMembros
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

    req.session.sucesso = 'Preferências da conta atualizadas com sucesso.';
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

    req.session.sucesso = 'Convite enviado com sucesso. Vamos avisar o membro por email.';
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

    req.session.sucesso = 'Convite cancelado com sucesso.';
    res.redirect('/conta/configuracoes');
  } catch (err) {
    next(err);
  }
});

router.post('/membros/:id/papel', verificarAdminConta, async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const atorId = req.session.utilizador.id;
    const membroId = Number(req.params.id);
    const papel = req.body.papel;

    const resultado = await contaService.atualizarPapelMembro({
      contaId,
      membroId,
      novoPapel: papel,
      atorId
    });

    await auditService.registar({
      contaId,
      utilizadorId: atorId,
      recurso: 'membros',
      acao: 'alterar_papel',
      recursoId: membroId,
      detalhes: {
        nome: resultado.nome,
        de: resultado.papelAnterior,
        para: resultado.papelNovo
      },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    req.session.sucesso = `Permissão de ${resultado.nome} atualizada para ${resultado.papelNovo}.`;
    res.redirect('/conta/configuracoes');
  } catch (err) {
    req.session.erro = err.message || 'Não foi possível atualizar a permissão deste membro.';
    res.redirect('/conta/configuracoes');
  }
});

router.post('/membros/:id/remover', verificarAdminConta, async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    const atorId = req.session.utilizador.id;
    const membroId = Number(req.params.id);

    const removido = await contaService.removerMembro({
      contaId,
      membroId,
      atorId
    });

    await auditService.registar({
      contaId,
      utilizadorId: atorId,
      recurso: 'membros',
      acao: 'remover',
      recursoId: membroId,
      detalhes: { nome: removido.nome, email: removido.email, papel: removido.papel },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    req.session.sucesso = `Acesso de ${removido.nome} removido com sucesso.`;
    res.redirect('/conta/configuracoes');
  } catch (err) {
    req.session.erro = err.message || 'Não foi possível remover o acesso deste membro.';
    res.redirect('/conta/configuracoes');
  }
});

router.get('/convites/aceitar/:token', async (req, res) => {
  if (!req.session.utilizador) {
    return res.redirect(`/auth/registar?convite=${req.params.token}`);
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
