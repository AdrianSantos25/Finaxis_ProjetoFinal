/**
 * Middleware de autenticação centralizado
 * Evita duplicação de código nos routers
 */

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

/**
 * Middleware para adicionar variáveis locais aos templates
 */
function adicionarVariaveisLocais(req, res, next) {
  res.locals.utilizador = req.session.utilizador || null;
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
  adicionarVariaveisLocais
};
