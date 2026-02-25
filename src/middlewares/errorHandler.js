/**
 * Classe de erro operacional personalizada
 * Permite distinguir erros esperados (operacionais) de erros inesperados
 */
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Middleware de tratamento de erros global
 * Trata diferentes tipos de erro e retorna respostas apropriadas
 */
function errorHandler(err, req, res, next) {
  console.error('Erro:', err);

  // Definir status code
  const statusCode = err.statusCode || 500;

  // Erros operacionais (esperados)
  if (err.isOperational) {
    // Se for requisição AJAX/API, retornar JSON
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(statusCode).json({
        success: false,
        message: err.message
      });
    }

    return res.status(statusCode).render('erro', {
      titulo: 'Erro',
      mensagem: err.message,
      codigo: statusCode
    });
  }

  // Erros de base de dados
  if (err.code === 'ER_DUP_ENTRY') {
    const message = 'O registo já existe.';
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(409).json({ success: false, message });
    }
    return res.status(409).render('erro', {
      titulo: 'Conflito',
      mensagem: message,
      codigo: 409
    });
  }

  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    const message = 'Referência inválida. O registo associado não existe.';
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(400).json({ success: false, message });
    }
    return res.status(400).render('erro', {
      titulo: 'Erro de referência',
      mensagem: message,
      codigo: 400
    });
  }

  // Erro genérico (não mostrar detalhes em produção)
  const mensagem = process.env.NODE_ENV === 'production'
    ? 'Ocorreu um erro no servidor. Tente novamente mais tarde.'
    : err.message || 'Erro interno do servidor';

  if (req.xhr || req.headers.accept?.includes('application/json')) {
    return res.status(500).json({ success: false, message: mensagem });
  }

  res.status(500).render('erro', {
    titulo: 'Erro interno',
    mensagem,
    codigo: 500
  });
}

module.exports = { AppError, errorHandler };
