const express = require('express');
const router = express.Router();

// Página inicial (apresentação)
router.get('/', (req, res) => {
  // Se já estiver autenticado, redireciona para o dashboard
  if (req.session.utilizador) {
    return res.redirect('/dashboard');
  }
  
  res.render('home', {
    titulo: 'Bem-vindo'
  });
});

module.exports = router;
