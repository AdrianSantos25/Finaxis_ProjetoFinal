const express = require('express');
const router = express.Router();

// Página inicial (apresentação)
router.get('/', (req, res) => {
  res.render('home', {
    titulo: 'Início'
  });
});

router.get('/termos', (req, res) => {
  res.render('legal/termos', {
    titulo: 'Termos de Utilização'
  });
});

router.get('/privacidade', (req, res) => {
  res.render('legal/privacidade', {
    titulo: 'Política de Privacidade'
  });
});

router.get('/cookies', (req, res) => {
  res.render('legal/cookies', {
    titulo: 'Política de Cookies'
  });
});

module.exports = router;
