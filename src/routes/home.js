const express = require('express');
const router = express.Router();

// Página inicial (apresentação)
router.get('/', (req, res) => {
  res.render('home', {
    titulo: 'Início'
  });
});

module.exports = router;
