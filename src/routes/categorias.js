const express = require('express');
const router = express.Router();
const db = require('../database');

// Listar categorias
router.get('/', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const [categorias] = await db.query(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM transacoes WHERE categoria_id = c.id AND utilizador_id = ?) as total_transacoes
      FROM categorias c
      WHERE c.utilizador_id = ? OR c.utilizador_id IS NULL
      ORDER BY c.tipo, c.nome
    `, [utilizadorId, utilizadorId]);
    
    res.render('categorias/lista', {
      titulo: 'Categorias',
      categorias
    });
  } catch (err) {
    console.error('Erro ao listar categorias:', err);
    res.status(500).send('Erro ao carregar categorias');
  }
});

// Formulário nova categoria
router.get('/nova', (req, res) => {
  res.render('categorias/form', {
    titulo: 'Nova Categoria',
    categoria: { cor: '#6c757d' },
    acao: 'criar'
  });
});

// Criar categoria
router.post('/', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const { nome, tipo, cor } = req.body;
    
    // Validações
    if (!nome || !nome.trim()) {
      req.session.erro = 'O nome da categoria é obrigatório.';
      return res.redirect('/categorias/nova');
    }
    
    if (!['receita', 'despesa'].includes(tipo)) {
      req.session.erro = 'Tipo de categoria inválido.';
      return res.redirect('/categorias/nova');
    }
    
    await db.query(
      'INSERT INTO categorias (nome, tipo, cor, utilizador_id) VALUES (?, ?, ?, ?)',
      [nome.trim(), tipo, cor || '#6c757d', utilizadorId]
    );
    
    req.session.sucesso = 'Categoria criada com sucesso!';
    res.redirect('/categorias');
  } catch (err) {
    console.error('Erro ao criar categoria:', err);
    req.session.erro = 'Erro ao criar categoria.';
    res.redirect('/categorias/nova');
  }
});

// API para criar categoria via AJAX (modal)
router.post('/api/criar', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const { nome, tipo, cor } = req.body;
    
    // Validações
    if (!nome || !nome.trim()) {
      return res.status(400).json({ success: false, message: 'O nome da categoria é obrigatório.' });
    }
    
    if (!['receita', 'despesa'].includes(tipo)) {
      return res.status(400).json({ success: false, message: 'Tipo de categoria inválido.' });
    }
    
    const [result] = await db.query(
      'INSERT INTO categorias (nome, tipo, cor, utilizador_id) VALUES (?, ?, ?, ?)',
      [nome.trim(), tipo, cor || '#6c757d', utilizadorId]
    );
    
    res.json({ 
      success: true, 
      message: 'Categoria criada com sucesso!',
      categoria: {
        id: result.insertId,
        nome: nome.trim(),
        tipo,
        cor: cor || '#6c757d'
      }
    });
  } catch (err) {
    console.error('Erro ao criar categoria:', err);
    res.status(500).json({ success: false, message: 'Erro ao criar categoria.' });
  }
});

// Formulário editar categoria
router.get('/:id/editar', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const [categorias] = await db.query(
      'SELECT * FROM categorias WHERE id = ? AND (utilizador_id = ? OR utilizador_id IS NULL)',
      [req.params.id, utilizadorId]
    );
    
    if (categorias.length === 0) {
      return res.redirect('/categorias');
    }
    
    res.render('categorias/form', {
      titulo: 'Editar Categoria',
      categoria: categorias[0],
      acao: 'editar'
    });
  } catch (err) {
    console.error('Erro ao carregar categoria:', err);
    res.status(500).send('Erro ao carregar categoria');
  }
});

// Atualizar categoria
router.post('/:id', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const categoriaId = req.params.id;
    const { nome, tipo, cor } = req.body;
    
    // Verificar se a categoria existe e pertence ao utilizador
    const [categorias] = await db.query(
      'SELECT id FROM categorias WHERE id = ? AND utilizador_id = ?',
      [categoriaId, utilizadorId]
    );
    
    if (categorias.length === 0) {
      req.session.erro = 'Categoria não encontrada ou não pode ser editada.';
      return res.redirect('/categorias');
    }
    
    // Validações
    if (!nome || !nome.trim()) {
      req.session.erro = 'O nome da categoria é obrigatório.';
      return res.redirect(`/categorias/${categoriaId}/editar`);
    }
    
    if (!['receita', 'despesa'].includes(tipo)) {
      req.session.erro = 'Tipo de categoria inválido.';
      return res.redirect(`/categorias/${categoriaId}/editar`);
    }
    
    await db.query(
      'UPDATE categorias SET nome = ?, tipo = ?, cor = ? WHERE id = ? AND utilizador_id = ?',
      [nome.trim(), tipo, cor || '#6c757d', categoriaId, utilizadorId]
    );
    
    req.session.sucesso = 'Categoria atualizada com sucesso!';
    res.redirect('/categorias');
  } catch (err) {
    console.error('Erro ao atualizar categoria:', err);
    req.session.erro = 'Erro ao atualizar categoria.';
    res.redirect('/categorias');
  }
});

// Eliminar categoria
router.post('/:id/eliminar', async (req, res) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const categoriaId = req.params.id;
    
    // Verificar se a categoria existe e pertence ao utilizador
    const [categorias] = await db.query(
      'SELECT id FROM categorias WHERE id = ? AND utilizador_id = ?',
      [categoriaId, utilizadorId]
    );
    
    if (categorias.length === 0) {
      req.session.erro = 'Categoria não encontrada ou não pode ser eliminada.';
      return res.redirect('/categorias');
    }
    
    // Verificar se há transações vinculadas
    const [transacoes] = await db.query(
      'SELECT COUNT(*) as count FROM transacoes WHERE categoria_id = ?',
      [categoriaId]
    );
    
    if (transacoes[0].count > 0) {
      req.session.erro = `Não é possível eliminar. Existem ${transacoes[0].count} transação(ões) vinculada(s) a esta categoria.`;
      return res.redirect('/categorias');
    }
    
    await db.query(
      'DELETE FROM categorias WHERE id = ? AND utilizador_id = ?',
      [categoriaId, utilizadorId]
    );
    
    req.session.sucesso = 'Categoria eliminada com sucesso!';
    res.redirect('/categorias');
  } catch (err) {
    console.error('Erro ao eliminar categoria:', err);
    req.session.erro = 'Erro ao eliminar categoria.';
    res.redirect('/categorias');
  }
});

module.exports = router;
