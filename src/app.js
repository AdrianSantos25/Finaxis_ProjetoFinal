const express = require('express');
const path = require('path');
const session = require('express-session');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();

const db = require('./database');
const { verificarAutenticacao, adicionarVariaveisLocais } = require('./middlewares/auth');
const { errorHandler } = require('./middlewares/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

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

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Configurar sessões
app.use(session({
  secret: process.env.SESSION_SECRET || 'gestor-financeiro-secret-key-2025',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 horas
  }
}));

// Middleware para disponibilizar variáveis em todas as views
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

app.use('/dashboard', verificarAutenticacao, dashboardRoutes);
app.use('/transacoes', verificarAutenticacao, transacoesRoutes);
app.use('/categorias', verificarAutenticacao, categoriasRoutes);
app.use('/relatorios', verificarAutenticacao, relatoriosRoutes);
app.use('/orcamentos', verificarAutenticacao, orcamentosRoutes);

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

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor a correr em http://localhost:${PORT}`);
});
