const express = require('express');
const router = express.Router();
const db = require('../database');

// Listar transações
router.get('/', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const tipo = req.query.tipo || '';
    const categoria = req.query.categoria || '';
    
    let query = `
      SELECT t.*, c.nome as categoria_nome, c.cor as categoria_cor
      FROM transacoes t
      LEFT JOIN categorias c ON t.categoria_id = c.id
      WHERE t.utilizador_id = ?
    `;
    const params = [utilizadorId];
    
    if (tipo) {
      query += ' AND t.tipo = ?';
      params.push(tipo);
    }
    
    if (categoria) {
      query += ' AND t.categoria_id = ?';
      params.push(categoria);
    }
    
    query += ' ORDER BY t.data DESC, t.id DESC';
    
    const [transacoes] = await db.query(query, params);
    const [categorias] = await db.query(
      'SELECT * FROM categorias WHERE utilizador_id = ? OR utilizador_id IS NULL ORDER BY tipo, nome',
      [utilizadorId]
    );
    
    res.render('transacoes/lista', {
      titulo: 'Transações',
      transacoes,
      categorias,
      filtroTipo: tipo,
      filtroCategoria: categoria
    });
  } catch (err) {
    console.error('Erro ao listar transações:', err);
    res.status(500).send('Erro ao carregar transações');
  }
});

// Formulário nova transação
router.get('/nova', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const [categorias] = await db.query(
      'SELECT * FROM categorias WHERE utilizador_id = ? OR utilizador_id IS NULL ORDER BY tipo, nome',
      [utilizadorId]
    );
    const hoje = new Date().toISOString().split('T')[0];
    
    res.render('transacoes/form', {
      titulo: 'Nova Transação',
      transacao: { data: hoje },
      categorias,
      acao: 'criar'
    });
  } catch (err) {
    console.error('Erro ao carregar formulário:', err);
    res.status(500).send('Erro ao carregar formulário');
  }
});

// Criar transação
router.post('/', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const { descricao, valor, tipo, categoria_id, data } = req.body;
    
    // Validações
    if (!descricao || !descricao.trim()) {
      req.session.erro = 'A descrição é obrigatória.';
      return res.redirect('/transacoes/nova');
    }
    
    const valorNumerico = parseFloat(valor);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      req.session.erro = 'O valor deve ser um número positivo.';
      return res.redirect('/transacoes/nova');
    }
    
    if (!['receita', 'despesa'].includes(tipo)) {
      req.session.erro = 'Tipo de transação inválido.';
      return res.redirect('/transacoes/nova');
    }
    
    if (!data) {
      req.session.erro = 'A data é obrigatória.';
      return res.redirect('/transacoes/nova');
    }
    
    await db.query(
      'INSERT INTO transacoes (descricao, valor, tipo, categoria_id, data, utilizador_id) VALUES (?, ?, ?, ?, ?, ?)',
      [descricao.trim(), valorNumerico, tipo, categoria_id || null, data, utilizadorId]
    );
    
    req.session.sucesso = 'Transação criada com sucesso!';
    res.redirect('/transacoes');
  } catch (err) {
    console.error('Erro ao criar transação:', err);
    req.session.erro = 'Erro ao criar transação. Tente novamente.';
    res.redirect('/transacoes/nova');
  }
});

// API para criar transação via AJAX (modal)
router.post('/api/criar', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const { descricao, valor, tipo, categoria_id, data } = req.body;
    
    // Validações
    if (!descricao || !descricao.trim()) {
      return res.status(400).json({ success: false, message: 'A descrição é obrigatória.' });
    }
    
    const valorNumerico = parseFloat(valor);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      return res.status(400).json({ success: false, message: 'O valor deve ser um número positivo.' });
    }
    
    if (!['receita', 'despesa'].includes(tipo)) {
      return res.status(400).json({ success: false, message: 'Tipo de transação inválido.' });
    }
    
    if (!data) {
      return res.status(400).json({ success: false, message: 'A data é obrigatória.' });
    }
    
    await db.query(
      'INSERT INTO transacoes (descricao, valor, tipo, categoria_id, data, utilizador_id) VALUES (?, ?, ?, ?, ?, ?)',
      [descricao.trim(), valorNumerico, tipo, categoria_id || null, data, utilizadorId]
    );
    
    res.json({ success: true, message: 'Transação criada com sucesso!' });
  } catch (err) {
    console.error('Erro ao criar transação:', err);
    res.status(500).json({ success: false, message: 'Erro ao criar transação.' });
  }
});

// Formulário editar transação
router.get('/:id/editar', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const [transacoes] = await db.query(
      'SELECT * FROM transacoes WHERE id = ? AND utilizador_id = ?',
      [req.params.id, utilizadorId]
    );
    
    if (transacoes.length === 0) {
      return res.redirect('/transacoes');
    }
    
    const [categorias] = await db.query(
      'SELECT * FROM categorias WHERE utilizador_id = ? OR utilizador_id IS NULL ORDER BY tipo, nome',
      [utilizadorId]
    );
    
    res.render('transacoes/form', {
      titulo: 'Editar Transação',
      transacao: transacoes[0],
      categorias,
      acao: 'editar'
    });
  } catch (err) {
    console.error('Erro ao carregar transação:', err);
    res.status(500).send('Erro ao carregar transação');
  }
});

// Atualizar transação
router.post('/:id', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const transacaoId = req.params.id;
    const { descricao, valor, tipo, categoria_id, data } = req.body;
    
    // Verificar se a transação existe e pertence ao utilizador
    const [transacoes] = await db.query(
      'SELECT id FROM transacoes WHERE id = ? AND utilizador_id = ?',
      [transacaoId, utilizadorId]
    );
    
    if (transacoes.length === 0) {
      req.session.erro = 'Transação não encontrada.';
      return res.redirect('/transacoes');
    }
    
    // Validações
    if (!descricao || !descricao.trim()) {
      req.session.erro = 'A descrição é obrigatória.';
      return res.redirect(`/transacoes/${transacaoId}/editar`);
    }
    
    const valorNumerico = parseFloat(valor);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      req.session.erro = 'O valor deve ser um número positivo.';
      return res.redirect(`/transacoes/${transacaoId}/editar`);
    }
    
    if (!['receita', 'despesa'].includes(tipo)) {
      req.session.erro = 'Tipo de transação inválido.';
      return res.redirect(`/transacoes/${transacaoId}/editar`);
    }
    
    await db.query(
      'UPDATE transacoes SET descricao = ?, valor = ?, tipo = ?, categoria_id = ?, data = ? WHERE id = ? AND utilizador_id = ?',
      [descricao.trim(), valorNumerico, tipo, categoria_id || null, data, transacaoId, utilizadorId]
    );
    
    req.session.sucesso = 'Transação atualizada com sucesso!';
    res.redirect('/transacoes');
  } catch (err) {
    console.error('Erro ao atualizar transação:', err);
    req.session.erro = 'Erro ao atualizar transação.';
    res.redirect('/transacoes');
  }
});

// Eliminar transação
router.post('/:id/eliminar', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    
    const result = await db.query(
      'DELETE FROM transacoes WHERE id = ? AND utilizador_id = ?',
      [req.params.id, utilizadorId]
    );
    
    if (result[0].affectedRows === 0) {
      req.session.erro = 'Transação não encontrada.';
    } else {
      req.session.sucesso = 'Transação eliminada com sucesso!';
    }
    
    res.redirect('/transacoes');
  } catch (err) {
    console.error('Erro ao eliminar transação:', err);
    req.session.erro = 'Erro ao eliminar transação.';
    res.redirect('/transacoes');
  }
});

module.exports = router;
