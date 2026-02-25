const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const db = require('../database');
const { enviarEmailRecuperacao } = require('../email');

// Rate limiter para login (máx 5 tentativas por 15 minutos)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Demasiadas tentativas de login. Tente novamente em 15 minutos.',
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

// Rate limiter para registo (máx 3 por hora)
const registoLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Demasiados registos. Tente novamente mais tarde.',
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

// Rate limiter para recuperação de senha (máx 3 por hora)
const recuperarLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: 'Demasiados pedidos de recuperação. Tente novamente mais tarde.',
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

// Página de login
router.get('/login', (req, res) => {
  if (req.session.utilizador) {
    return res.redirect('/dashboard');
  }
  
  res.render('auth/login', {
    titulo: 'Entrar',
    erro: null,
    hideFooter: true
  });
});

// Processar login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Buscar utilizador pelo email
    const [utilizadores] = await db.query(
      'SELECT * FROM utilizadores WHERE email = ?',
      [email]
    );
    
    if (utilizadores.length === 0) {
      return res.render('auth/login', {
        titulo: 'Entrar',
        erro: 'Email ou palavra-passe incorretos',
        hideFooter: true
      });
    }
    
    const utilizador = utilizadores[0];
    
    // Verificar password
    const passwordValida = await bcrypt.compare(password, utilizador.password);
    
    if (!passwordValida) {
      return res.render('auth/login', {
        titulo: 'Entrar',
        erro: 'Email ou palavra-passe incorretos',
        hideFooter: true
      });
    }
    
    // Criar sessão
    req.session.utilizador = {
      id: utilizador.id,
      nome: utilizador.nome,
      email: utilizador.email
    };
    
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Erro no login:', err);
    res.render('auth/login', {
      titulo: 'Entrar',
      erro: 'Erro ao processar o login. Tente novamente.',
      hideFooter: true
    });
  }
});

// Página de registo
router.get('/registar', (req, res) => {
  if (req.session.utilizador) {
    return res.redirect('/dashboard');
  }
  
  res.render('auth/registar', {
    titulo: 'Criar Conta',
    erro: null,
    hideFooter: true
  });
});

// Processar registo
router.post('/registar', registoLimiter, async (req, res) => {
  try {
    const { nome, email, password, confirmarPassword } = req.body;
    
    // Validações
    if (!nome || !email || !password) {
      return res.render('auth/registar', {
        titulo: 'Criar Conta',
        erro: 'Todos os campos são obrigatórios',
        hideFooter: true
      });
    }
    
    if (password !== confirmarPassword) {
      return res.render('auth/registar', {
        titulo: 'Criar Conta',
        erro: 'As palavras-passe não coincidem',
        hideFooter: true
      });
    }
    
    if (password.length < 6) {
      return res.render('auth/registar', {
        titulo: 'Criar Conta',
        erro: 'A palavra-passe deve ter pelo menos 6 caracteres',
        hideFooter: true
      });
    }
    
    // Verificar se email já existe
    const [existente] = await db.query(
      'SELECT id FROM utilizadores WHERE email = ?',
      [email]
    );
    
    if (existente.length > 0) {
      return res.render('auth/registar', {
        titulo: 'Criar Conta',
        erro: 'Este email já está registado',
        hideFooter: true
      });
    }
    
    // Hash da password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Criar utilizador
    const [resultado] = await db.query(
      'INSERT INTO utilizadores (nome, email, password) VALUES (?, ?, ?)',
      [nome, email, hashedPassword]
    );
    
    // Criar sessão automaticamente
    req.session.utilizador = {
      id: resultado.insertId,
      nome: nome,
      email: email
    };
    
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Erro no registo:', err);
    res.render('auth/registar', {
      titulo: 'Criar Conta',
      erro: 'Erro ao criar conta. Tente novamente.',
      hideFooter: true
    });
  }
});

// Logout
router.get('/sair', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Erro ao terminar sessão:', err);
    }
    res.redirect('/');
  });
});

// Página de recuperação de senha
router.get('/recuperar-senha', (req, res) => {
  if (req.session.utilizador) {
    return res.redirect('/dashboard');
  }
  
  res.render('auth/recuperar-senha', {
    titulo: 'Recuperar Palavra-passe',
    erro: null,
    sucesso: null,
    hideFooter: true
  });
});

// Processar pedido de recuperação
router.post('/recuperar-senha', recuperarLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    
    // Buscar utilizador pelo email
    const [utilizadores] = await db.query(
      'SELECT id, nome, email FROM utilizadores WHERE email = ?',
      [email]
    );
    
    // Mensagem genérica para evitar enumeração de emails
    const mensagemSucesso = 'Se o email estiver registado, receberá instruções para recuperar a sua palavra-passe.';
    
    if (utilizadores.length === 0) {
      // Retornamos sucesso mesmo se o email não existir (segurança)
      return res.render('auth/recuperar-senha', {
        titulo: 'Recuperar Palavra-passe',
        erro: null,
        sucesso: mensagemSucesso,
        hideFooter: true
      });
    }
    
    const utilizador = utilizadores[0];
    
    // Gerar token único
    const token = crypto.randomBytes(32).toString('hex');
    
    // Token expira em 1 hora
    const expiracao = new Date(Date.now() + 60 * 60 * 1000);
    
    // Salvar token no banco de dados
    await db.query(
      'UPDATE utilizadores SET reset_token = ?, reset_token_expira = ? WHERE id = ?',
      [token, expiracao, utilizador.id]
    );
    
    // Obter host completo para o link
    const protocol = req.protocol;
    const host = `${protocol}://${req.get('host')}`;
    
    // Enviar email
    try {
      await enviarEmailRecuperacao(utilizador.email, utilizador.nome, token, host);
      console.log(`✅ Email de recuperação enviado para: ${utilizador.email}`);
    } catch (emailError) {
      console.error('⚠️ Erro ao enviar email:', emailError.message);
      // Em desenvolvimento, mostrar o link no console
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

// Página de redefinição de senha (com token)
router.get('/redefinir-senha/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    // Verificar se token existe e não expirou
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
      token: token,
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

// Processar redefinição de senha
router.post('/redefinir-senha/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmarPassword } = req.body;
    
    // Validações
    if (!password || !confirmarPassword) {
      return res.render('auth/redefinir-senha', {
        titulo: 'Redefinir Palavra-passe',
        erro: 'Todos os campos são obrigatórios',
        sucesso: null,
        token: token,
        hideFooter: true
      });
    }
    
    if (password !== confirmarPassword) {
      return res.render('auth/redefinir-senha', {
        titulo: 'Redefinir Palavra-passe',
        erro: 'As palavras-passe não coincidem',
        sucesso: null,
        token: token,
        hideFooter: true
      });
    }
    
    if (password.length < 6) {
      return res.render('auth/redefinir-senha', {
        titulo: 'Redefinir Palavra-passe',
        erro: 'A palavra-passe deve ter pelo menos 6 caracteres',
        sucesso: null,
        token: token,
        hideFooter: true
      });
    }
    
    // Verificar token novamente
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
    
    const utilizador = utilizadores[0];
    
    // Hash da nova password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Atualizar password e limpar token
    await db.query(
      'UPDATE utilizadores SET password = ?, reset_token = NULL, reset_token_expira = NULL WHERE id = ?',
      [hashedPassword, utilizador.id]
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

module.exports = router;
