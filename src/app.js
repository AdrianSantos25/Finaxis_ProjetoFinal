const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
const crypto = require('crypto');
require('dotenv').config();

const db = require('./database');
const { verificarAutenticacao, adicionarContextoSaaS, adicionarVariaveisLocais } = require('./middlewares/auth');
const { errorHandler } = require('./middlewares/errorHandler');
const { validateEnvironment, getSessionCookieSettings } = require('./config/env');

validateEnvironment();

const app = express();
const PORT = process.env.PORT || 3001;

app.set('trust proxy', 1);

// Segurança - Headers HTTP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      fontSrc: ["'self'", "cdn.jsdelivr.net", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"]
    }
  }
}));

// Compression de respostas
app.use(compression());

// Configurar Pug
app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// Webhook Stripe precisa do corpo raw para validar assinatura
const webhookRoutes = require('./routes/webhooks');
app.use('/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Logs estruturados para observabilidade
app.use((req, res, next) => {
  const requestId = crypto.randomUUID();
  const inicio = Date.now();
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    const log = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - inicio,
      ip: req.ip,
      userId: req.session?.utilizador?.id || null,
      contaId: req.session?.utilizador?.conta_id || null,
      timestamp: new Date().toISOString()
    };
    console.log(JSON.stringify(log));
  });

  next();
});

// Configurar sessões
app.use(session({
  name: 'finanxis.sid',
  secret: process.env.SESSION_SECRET || 'gestor-financeiro-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: getSessionCookieSettings()
}));

// Middleware para disponibilizar variáveis em todas as views
app.use(adicionarContextoSaaS);
app.use(adicionarVariaveisLocais);

// Rotas públicas
const homeRoutes = require('./routes/home');
const authRoutes = require('./routes/auth');

app.use('/', homeRoutes);
app.use('/auth', authRoutes);

// Rotas protegidas (requerem autenticação)
const dashboardRoutes = require('./routes/dashboard');
const transacoesRoutes = require('./routes/transacoes');
const categoriasRoutes = require('./routes/categorias');
const relatoriosRoutes = require('./routes/relatorios');
const orcamentosRoutes = require('./routes/orcamentos');
const metasRoutes = require('./routes/metas');
const billingRoutes = require('./routes/billing');
const contaRoutes = require('./routes/conta');

app.use('/dashboard', verificarAutenticacao, dashboardRoutes);
app.use('/transacoes', verificarAutenticacao, transacoesRoutes);
app.use('/categorias', verificarAutenticacao, categoriasRoutes);
app.use('/relatorios', verificarAutenticacao, relatoriosRoutes);
app.use('/orcamentos', verificarAutenticacao, orcamentosRoutes);
app.use('/metas', verificarAutenticacao, metasRoutes);
app.use('/billing', verificarAutenticacao, billingRoutes);
app.use('/conta', verificarAutenticacao, contaRoutes);

// Middleware de erro 404
app.use((req, res) => {
  res.status(404).render('erro', {
    titulo: 'Página não encontrada',
    mensagem: 'A página que procura não existe.',
    codigo: 404
  });
});

// Middleware de erro global robusto
app.use(errorHandler);

// Iniciar servidor (com fallback automático de porta)
function iniciarServidor(porta) {
  const server = app.listen(porta, () => {
    console.log(`🚀 Servidor a correr em http://localhost:${porta}`);
  });

  server.on('error', (erro) => {
    if (erro.code === 'EADDRINUSE') {
      const proximaPorta = Number(porta) + 1;
      console.warn(`⚠️ Porta ${porta} ocupada. A tentar ${proximaPorta}...`);
      iniciarServidor(proximaPorta);
      return;
    }

    throw erro;
  });
}

iniciarServidor(Number(PORT));
