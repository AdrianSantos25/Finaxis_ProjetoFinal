const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../database');
const { enviarEmailRecuperacao } = require('../email');
const saasService = require('../services/saasService');
const contaService = require('../services/contaService');
const auditService = require('../services/auditService');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.render('auth/login', {
      titulo: 'Entrar',
      erro: 'Demasiadas tentativas de login. Tente novamente em 15 minutos.',
      hideFooter: true
    });
  }
});

const registoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.render('auth/registar', {
      titulo: 'Criar Conta',
      erro: 'Demasiados registos. Tente novamente mais tarde.',
      hideFooter: true
    });
  }
});

const recuperarLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.render('auth/recuperar-senha', {
      titulo: 'Recuperar Palavra-passe',
      erro: 'Demasiados pedidos de recuperação. Tente novamente mais tarde.',
      sucesso: null,
      hideFooter: true
    });
  }
});

function renderRegistar(res, { erro = null, convite = null, conviteToken = '' } = {}) {
  return res.render('auth/registar', {
    titulo: 'Criar Conta',
    erro,
    convite,
    conviteToken,
    hideFooter: true
  });
}

router.get('/login', (req, res) => {
  if (req.session.utilizador) return res.redirect('/dashboard');
  res.render('auth/login', { titulo: 'Entrar', erro: null, hideFooter: true });
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    const [utilizadores] = await db.query('SELECT * FROM utilizadores WHERE email = ?', [email]);

    if (utilizadores.length === 0) {
      return res.render('auth/login', { titulo: 'Entrar', erro: 'Email ou palavra-passe incorretos', hideFooter: true });
    }

    const utilizador = utilizadores[0];
    const passwordValida = await bcrypt.compare(password, utilizador.password);

    if (!passwordValida) {
      return res.render('auth/login', { titulo: 'Entrar', erro: 'Email ou palavra-passe incorretos', hideFooter: true });
    }

    const contexto = await saasService.obterContextoUtilizador(utilizador.id);
    req.session.utilizador = {
      id: utilizador.id,
      nome: utilizador.nome,
      email: utilizador.email,
      conta_id: contexto?.utilizador?.conta_id || utilizador.conta_id || null,
      conta_nome: contexto?.utilizador?.conta_nome || null,
      papel: contexto?.utilizador?.papel || utilizador.papel || 'membro',
      plano: contexto?.subscricao?.plano || 'free',
      subscricao_status: contexto?.subscricao?.status || 'active'
    };

    const returnTo = req.session.returnTo;
    delete req.session.returnTo;
    res.redirect(returnTo || '/dashboard');
  } catch (err) {
    console.error('Erro no login:', err);
    res.render('auth/login', { titulo: 'Entrar', erro: 'Erro ao processar o login. Tente novamente.', hideFooter: true });
  }
});

router.get('/registar', async (req, res) => {
  if (req.session.utilizador) return res.redirect('/dashboard');

  const conviteToken = req.query.convite || '';
  if (!conviteToken) return renderRegistar(res);

  const convite = await contaService.obterConvitePorToken(conviteToken);
  if (!convite || convite.status !== 'pendente' || new Date(convite.expira_em) < new Date()) {
    return renderRegistar(res, { erro: 'Convite inválido ou expirado.' });
  }

  return renderRegistar(res, { convite, conviteToken });
});

router.post('/registar', registoLimiter, async (req, res) => {
  try {
    const conviteToken = req.body.conviteToken || '';
    const { nome, email, password, confirmarPassword } = req.body;

    if (!nome || !email || !password) {
      return renderRegistar(res, { erro: 'Todos os campos são obrigatórios', conviteToken });
    }
    if (password !== confirmarPassword) {
      return renderRegistar(res, { erro: 'As palavras-passe não coincidem', conviteToken });
    }
    if (password.length < 6) {
      return renderRegistar(res, { erro: 'A palavra-passe deve ter pelo menos 6 caracteres', conviteToken });
    }

    const [existente] = await db.query('SELECT id FROM utilizadores WHERE email = ?', [email]);
    if (existente.length > 0) {
      return renderRegistar(res, { erro: 'Este email já está registado', conviteToken });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let contaId;
    let papel = 'admin';

    if (conviteToken) {
      const convite = await contaService.obterConvitePorToken(conviteToken);
      if (!convite || convite.status !== 'pendente' || new Date(convite.expira_em) < new Date()) {
        return renderRegistar(res, { erro: 'Convite inválido ou expirado.' });
      }

      if (convite.email.toLowerCase() !== email.toLowerCase()) {
        return renderRegistar(res, { erro: 'Use o mesmo email do convite.', convite, conviteToken });
      }

      contaId = convite.conta_id;
      papel = convite.papel;
    } else {
      const slugBase = nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'conta';
      const slug = `${slugBase}-${Date.now()}`;

      const [contaResultado] = await db.query('INSERT INTO contas (nome, slug) VALUES (?, ?)', [nome, slug]);
      contaId = contaResultado.insertId;

      await db.query(
        'INSERT INTO subscricoes (conta_id, plano, status, fornecedor) VALUES (?, ?, ?, ?)',
        [contaId, 'free', 'active', 'manual']
      );
    }

    const [resultado] = await db.query(
      'INSERT INTO utilizadores (nome, email, password, conta_id, papel) VALUES (?, ?, ?, ?, ?)',
      [nome, email, hashedPassword, contaId, papel]
    );

    if (conviteToken) {
      await db.query('UPDATE convites_conta SET status = ?, aceite_em = NOW() WHERE token = ?', ['aceite', conviteToken]);
    }

    const contexto = await saasService.obterContextoUtilizador(resultado.insertId);
    req.session.utilizador = {
      id: resultado.insertId,
      nome,
      email,
      conta_id: contaId,
      conta_nome: contexto?.utilizador?.conta_nome || nome,
      papel: contexto?.utilizador?.papel || papel,
      plano: contexto?.subscricao?.plano || 'free',
      subscricao_status: contexto?.subscricao?.status || 'active'
    };

    await auditService.registar({
      contaId,
      utilizadorId: resultado.insertId,
      recurso: 'utilizadores',
      acao: conviteToken ? 'aceite_convite' : 'registo',
      recursoId: resultado.insertId,
      detalhes: { email, papel },
      ip: req.ip,
      userAgent: req.get('user-agent')
    });

    res.redirect('/dashboard');
  } catch (err) {
    console.error('Erro no registo:', err);
    renderRegistar(res, { erro: 'Erro ao criar conta. Tente novamente.' });
  }
});

router.get('/sair', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

router.get('/recuperar-senha', (req, res) => {
  if (req.session.utilizador) return res.redirect('/dashboard');
  res.render('auth/recuperar-senha', {
    titulo: 'Recuperar Palavra-passe',
    erro: null,
    sucesso: null,
    hideFooter: true
  });
});

router.post('/recuperar-senha', recuperarLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    const [utilizadores] = await db.query('SELECT id, nome, email FROM utilizadores WHERE email = ?', [email]);
    const mensagemSucesso = 'Se o email estiver registado, receberá instruções para recuperar a sua palavra-passe.';

    if (utilizadores.length === 0) {
      return res.render('auth/recuperar-senha', {
        titulo: 'Recuperar Palavra-passe',
        erro: null,
        sucesso: mensagemSucesso,
        hideFooter: true
      });
    }

    const utilizador = utilizadores[0];
    const token = crypto.randomBytes(32).toString('hex');
    const expiracao = new Date(Date.now() + 60 * 60 * 1000);

    await db.query(
      'UPDATE utilizadores SET reset_token = ?, reset_token_expira = ? WHERE id = ?',
      [token, expiracao, utilizador.id]
    );

    const protocol = req.protocol;
    const host = `${protocol}://${req.get('host')}`;

    try {
      await enviarEmailRecuperacao(utilizador.email, utilizador.nome, token, host);
    } catch (emailError) {
      console.error('⚠️ Erro ao enviar email:', emailError.message);
      console.log(`🔗 Link de recuperação (dev): ${host}/auth/redefinir-senha/${token}`);
    }

    res.render('auth/recuperar-senha', {
      titulo: 'Recuperar Palavra-passe',
      erro: null,
      sucesso: mensagemSucesso,
      hideFooter: true
    });
  } catch (err) {
    console.error('Erro na recuperação de senha:', err);
    res.render('auth/recuperar-senha', {
      titulo: 'Recuperar Palavra-passe',
      erro: 'Erro ao processar o pedido. Tente novamente.',
      sucesso: null,
      hideFooter: true
    });
  }
});

router.get('/redefinir-senha/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const [utilizadores] = await db.query(
      'SELECT id FROM utilizadores WHERE reset_token = ? AND reset_token_expira > NOW()',
      [token]
    );

    if (utilizadores.length === 0) {
      return res.render('auth/redefinir-senha', {
        titulo: 'Redefinir Palavra-passe',
        erro: 'O link de recuperação é inválido ou expirou. Solicite um novo.',
        sucesso: null,
        token: null,
        hideFooter: true
      });
    }

    res.render('auth/redefinir-senha', {
      titulo: 'Redefinir Palavra-passe',
      erro: null,
      sucesso: null,
      token,
      hideFooter: true
    });
  } catch (err) {
    console.error('Erro ao verificar token:', err);
    res.render('auth/redefinir-senha', {
      titulo: 'Redefinir Palavra-passe',
      erro: 'Erro ao processar o pedido. Tente novamente.',
      sucesso: null,
      token: null,
      hideFooter: true
    });
  }
});

router.post('/redefinir-senha/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmarPassword } = req.body;

    if (!password || !confirmarPassword) {
      return res.render('auth/redefinir-senha', {
        titulo: 'Redefinir Palavra-passe',
        erro: 'Todos os campos são obrigatórios',
        sucesso: null,
        token,
        hideFooter: true
      });
    }
    if (password !== confirmarPassword) {
      return res.render('auth/redefinir-senha', {
        titulo: 'Redefinir Palavra-passe',
        erro: 'As palavras-passe não coincidem',
        sucesso: null,
        token,
        hideFooter: true
      });
    }

    const [utilizadores] = await db.query(
      'SELECT id FROM utilizadores WHERE reset_token = ? AND reset_token_expira > NOW()',
      [token]
    );

    if (utilizadores.length === 0) {
      return res.render('auth/redefinir-senha', {
        titulo: 'Redefinir Palavra-passe',
        erro: 'O link de recuperação é inválido ou expirou. Solicite um novo.',
        sucesso: null,
        token: null,
        hideFooter: true
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.query(
      'UPDATE utilizadores SET password = ?, reset_token = NULL, reset_token_expira = NULL WHERE id = ?',
      [hashedPassword, utilizadores[0].id]
    );

    res.render('auth/redefinir-senha', {
      titulo: 'Redefinir Palavra-passe',
      erro: null,
      sucesso: 'Palavra-passe redefinida com sucesso! Já pode fazer login.',
      token: null,
      hideFooter: true
    });
  } catch (err) {
    console.error('Erro ao redefinir senha:', err);
    res.render('auth/redefinir-senha', {
      titulo: 'Redefinir Palavra-passe',
      erro: 'Erro ao redefinir palavra-passe. Tente novamente.',
      sucesso: null,
      token: req.params.token,
      hideFooter: true
    });
  }
});

router.post('/eliminar-conta', async (req, res, next) => {
  try {
    if (!req.session.utilizador) {
      return res.status(401).json({ success: false, message: 'Não autenticado.' });
    }

    const utilizadorId = req.session.utilizador.id;
    const contaId = req.session.utilizador.conta_id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ success: false, message: 'A palavra-passe é obrigatória.' });
    }

    const [rows] = await db.query('SELECT password FROM utilizadores WHERE id = ?', [utilizadorId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
    }

    const passwordCorreta = await bcrypt.compare(password, rows[0].password);
    if (!passwordCorreta) {
      return res.status(401).json({ success: false, message: 'Palavra-passe incorreta.' });
    }

    await db.query('DELETE FROM transacoes WHERE utilizador_id = ?', [utilizadorId]);
    await db.query('DELETE FROM categorias WHERE utilizador_id = ?', [utilizadorId]);
    await db.query('DELETE FROM orcamentos WHERE utilizador_id = ?', [utilizadorId]);
    await db.query('DELETE FROM utilizadores WHERE id = ?', [utilizadorId]);

    if (contaId) {
      const [restantes] = await db.query('SELECT COUNT(*) as total FROM utilizadores WHERE conta_id = ?', [contaId]);
      if ((restantes[0].total || 0) === 0) {
        await db.query('DELETE FROM subscricoes WHERE conta_id = ?', [contaId]);
        await db.query('DELETE FROM contas WHERE id = ?', [contaId]);
      }
    }

    req.session.destroy(() => {
      res.json({ success: true, message: 'Conta eliminada com sucesso.' });
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
