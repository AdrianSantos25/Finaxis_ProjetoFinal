/**
 * Middleware de autenticação centralizado
 * Evita duplicação de código nos routers
 */
const saasService = require('../services/saasService');

/**
 * Verifica se o utilizador está autenticado
 * Redireciona para login se não estiver
 */
function verificarAutenticacao(req, res, next) {
  if (req.session && req.session.utilizador) {
    return next();
  }
  
  // Guardar URL original para redirecionar após login
  req.session.returnTo = req.originalUrl;
  res.redirect('/auth/login');
}

/**
 * Verifica se o utilizador NÃO está autenticado
 * Usado em páginas como login e registo
 */
function verificarNaoAutenticado(req, res, next) {
  if (req.session && req.session.utilizador) {
    return res.redirect('/dashboard');
  }
  next();
}

function verificarAdminConta(req, res, next) {
  if (!req.session || !req.session.utilizador) {
    return res.redirect('/auth/login');
  }

  if (req.session.utilizador.papel !== 'admin') {
    req.session.erro = 'Acesso restrito a administradores da conta.';
    return res.redirect('/dashboard');
  }

  next();
}

/**
 * Carrega contexto SaaS (conta e plano) para utilizadores autenticados
 */
async function adicionarContextoSaaS(req, res, next) {
  if (!req.session || !req.session.utilizador) {
    return next();
  }

  try {
    const contexto = await saasService.obterContextoUtilizador(req.session.utilizador.id);
    if (contexto) {
      req.session.utilizador = {
        ...req.session.utilizador,
        conta_id: contexto.utilizador.conta_id,
        conta_nome: contexto.utilizador.conta_nome,
        papel: contexto.utilizador.papel,
        plano: contexto.subscricao.plano,
        subscricao_status: contexto.subscricao.status
      };
      req.saas = contexto;
    }
  } catch (err) {
    console.error('Erro ao carregar contexto SaaS:', err.message);
  }

  next();
}

/**
 * Middleware para adicionar variáveis locais aos templates
 */
function adicionarVariaveisLocais(req, res, next) {
  res.locals.utilizador = req.session.utilizador || null;
  res.locals.planoAtual = req.session.utilizador?.plano || null;
  res.locals.subscricaoStatus = req.session.utilizador?.subscricao_status || null;
  res.locals.papelConta = req.session.utilizador?.papel || null;
  res.locals.sucesso = req.session.sucesso;
  res.locals.erro = req.session.erro;
  
  // Limpar mensagens flash após usar
  delete req.session.sucesso;
  delete req.session.erro;
  
  next();
}

module.exports = {
  verificarAutenticacao,
  verificarNaoAutenticado,
  verificarAdminConta,
  adicionarContextoSaaS,
  adicionarVariaveisLocais
};
