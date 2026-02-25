/**
 * Middleware de validação centralizada
 * Evita duplicação de validações nas rotas
 */

/**
 * Validar dados de transação (para formulários HTML com redirect)
 */
function validarTransacao(req, res, next) {
  const erros = [];
  const { descricao, valor, tipo, data } = req.body;

  if (!descricao || !descricao.trim()) {
    erros.push('A descrição é obrigatória.');
  } else if (descricao.trim().length > 255) {
    erros.push('A descrição não pode exceder 255 caracteres.');
  }

  const valorNumerico = parseFloat(valor);
  if (isNaN(valorNumerico) || valorNumerico <= 0) {
    erros.push('O valor deve ser um número positivo.');
  } else if (valorNumerico > 99999999.99) {
    erros.push('O valor excede o máximo permitido.');
  }

  if (!['receita', 'despesa'].includes(tipo)) {
    erros.push('Tipo de transação inválido.');
  }

  if (!data) {
    erros.push('A data é obrigatória.');
  } else if (isNaN(Date.parse(data))) {
    erros.push('Data inválida.');
  }

  if (erros.length > 0) {
    req.session.erro = erros.join(' ');
    const redirectUrl = req.params.id 
      ? `/transacoes/${req.params.id}/editar` 
      : '/transacoes/nova';
    return res.redirect(redirectUrl);
  }

  // Sanitizar dados
  req.body.descricao = descricao.trim();
  req.body.valor = valorNumerico;
  next();
}

/**
 * Validar dados de transação (para API/AJAX com JSON)
 */
function validarTransacaoAPI(req, res, next) {
  const erros = [];
  const { descricao, valor, tipo, data } = req.body;

  if (!descricao || !descricao.trim()) {
    erros.push('A descrição é obrigatória.');
  } else if (descricao.trim().length > 255) {
    erros.push('A descrição não pode exceder 255 caracteres.');
  }

  const valorNumerico = parseFloat(valor);
  if (isNaN(valorNumerico) || valorNumerico <= 0) {
    erros.push('O valor deve ser um número positivo.');
  } else if (valorNumerico > 99999999.99) {
    erros.push('O valor excede o máximo permitido.');
  }

  if (!['receita', 'despesa'].includes(tipo)) {
    erros.push('Tipo de transação inválido.');
  }

  if (!data) {
    erros.push('A data é obrigatória.');
  } else if (isNaN(Date.parse(data))) {
    erros.push('Data inválida.');
  }

  if (erros.length > 0) {
    return res.status(400).json({ success: false, message: erros.join(' ') });
  }

  // Sanitizar
  req.body.descricao = descricao.trim();
  req.body.valor = valorNumerico;
  next();
}

/**
 * Validar dados de categoria (para formulários HTML)
 */
function validarCategoria(req, res, next) {
  const erros = [];
  const { nome, tipo, cor } = req.body;

  if (!nome || !nome.trim()) {
    erros.push('O nome da categoria é obrigatório.');
  } else if (nome.trim().length > 255) {
    erros.push('O nome não pode exceder 255 caracteres.');
  }

  if (!['receita', 'despesa'].includes(tipo)) {
    erros.push('Tipo de categoria inválido.');
  }

  if (cor && !/^#[0-9A-Fa-f]{6}$/.test(cor)) {
    erros.push('Cor inválida. Use formato hexadecimal (ex: #FF0000).');
  }

  if (erros.length > 0) {
    req.session.erro = erros.join(' ');
    const redirectUrl = req.params.id 
      ? `/categorias/${req.params.id}/editar` 
      : '/categorias/nova';
    return res.redirect(redirectUrl);
  }

  req.body.nome = nome.trim();
  next();
}

/**
 * Validar dados de categoria (para API/AJAX)
 */
function validarCategoriaAPI(req, res, next) {
  const erros = [];
  const { nome, tipo, cor } = req.body;

  if (!nome || !nome.trim()) {
    erros.push('O nome da categoria é obrigatório.');
  }

  if (!['receita', 'despesa'].includes(tipo)) {
    erros.push('Tipo de categoria inválido.');
  }

  if (cor && !/^#[0-9A-Fa-f]{6}$/.test(cor)) {
    erros.push('Cor inválida.');
  }

  if (erros.length > 0) {
    return res.status(400).json({ success: false, message: erros.join(' ') });
  }

  req.body.nome = nome.trim();
  next();
}

module.exports = {
  validarTransacao,
  validarTransacaoAPI,
  validarCategoria,
  validarCategoriaAPI
};
