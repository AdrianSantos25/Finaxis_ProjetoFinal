const express = require('express');
const router = express.Router();
const saasService = require('../services/saasService');
const billingService = require('../services/billingService');

router.get('/', async (req, res, next) => {
  try {
    const utilizador = req.session.utilizador;
    const contexto = await saasService.obterContextoUtilizador(utilizador.id);
    const historico = await billingService.obterHistoricoSubscricoes(utilizador.conta_id);

    res.render('billing/index', {
      titulo: 'Plano e Faturação',
      contexto,
      historico,
      stripePublicKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
      checkoutStatus: req.query.checkout || null
    });
  } catch (err) {
    next(err);
  }
});

router.post('/checkout', async (req, res, next) => {
  try {
    const utilizador = req.session.utilizador;
    const { plano } = req.body;

    const session = await billingService.criarCheckoutSessao({
      contaId: utilizador.conta_id,
      nome: utilizador.nome,
      email: utilizador.email,
      plano
    });

    return res.redirect(303, session.url);
  } catch (err) {
    req.session.erro = err.message || 'Erro ao iniciar checkout.';
    return res.redirect('/billing');
  }
});

router.post('/downgrade', async (req, res, next) => {
  try {
    const contaId = req.session.utilizador.conta_id;
    await billingService.downgradeContaParaFree(contaId, true);
    req.session.sucesso = 'Plano alterado para Free com sucesso.';
    res.redirect('/billing');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
