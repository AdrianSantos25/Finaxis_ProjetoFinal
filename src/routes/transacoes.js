const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const transacoesService = require('../services/transacoesService');
const categoriasService = require('../services/categoriasService');
const { validarTransacao, validarTransacaoAPI } = require('../middlewares/validacao');

// Configurar pasta de uploads
const uploadsDir = path.join(__dirname, '../../public/uploads/comprovativos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configurar multer para upload de comprovativos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'comprovativo-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas imagens (JPEG, PNG) e PDF são permitidos!'));
    }
  }
});

// Listar transações (com paginação)
router.get('/', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const tipo = req.query.tipo || '';
    const categoria = req.query.categoria || '';
    const pesquisa = req.query.pesquisa || '';
    const dataInicio = req.query.dataInicio || '';
    const dataFim = req.query.dataFim || '';
    const pagina = parseInt(req.query.pagina) || 1;
    const limite = 20;

    const { transacoes, paginacao } = await transacoesService.listar(utilizadorId, {
      tipo,
      categoria,
      pesquisa,
      dataInicio,
      dataFim,
      pagina,
      limite
    });

    const categorias = await categoriasService.listarSimples(utilizadorId);

    res.render('transacoes/lista', {
      titulo: 'Transações',
      transacoes,
      categorias,
      filtroTipo: tipo,
      filtroCategoria: categoria,
      filtroPesquisa: pesquisa,
      filtroDataInicio: dataInicio,
      filtroDataFim: dataFim,
      paginacao
    });
  } catch (err) {
    next(err);
  }
});

// Formulário nova transação
router.get('/nova', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const categorias = await categoriasService.listarSimples(utilizadorId);
    const hoje = new Date().toISOString().split('T')[0];

    res.render('transacoes/form', {
      titulo: 'Nova Transação',
      transacao: { data: hoje },
      categorias,
      acao: 'criar'
    });
  } catch (err) {
    next(err);
  }
});

// Criar transação (formulário)
router.post('/', upload.single('comprovativo'), validarTransacao, async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const dados = { ...req.body };
    
    // Adicionar caminho do arquivo se foi feito upload
    if (req.file) {
      dados.comprovativo = req.file.filename;
    }
    
    await transacoesService.criar(utilizadorId, dados);
    req.session.sucesso = 'Transação criada com sucesso!';
    res.redirect('/transacoes');
  } catch (err) {
    // Se houver erro, apagar o arquivo enviado
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    next(err);
  }
});

// API para criar transação via AJAX (modal)
router.post('/api/criar', validarTransacaoAPI, async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    await transacoesService.criar(utilizadorId, req.body);
    res.json({ success: true, message: 'Transação criada com sucesso!' });
  } catch (err) {
    next(err);
  }
});

// Formulário editar transação
router.get('/:id/editar', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const transacao = await transacoesService.buscarPorId(req.params.id, utilizadorId);

    if (!transacao) {
      return res.redirect('/transacoes');
    }

    const categorias = await categoriasService.listarSimples(utilizadorId);

    res.render('transacoes/form', {
      titulo: 'Editar Transação',
      transacao,
      categorias,
      acao: 'editar'
    });
  } catch (err) {
    next(err);
  }
});

// Atualizar transação
router.post('/:id', upload.single('comprovativo'), validarTransacao, async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const transacaoId = req.params.id;

    // Verificar se a transação existe e pertence ao utilizador
    const transacao = await transacoesService.buscarPorId(transacaoId, utilizadorId);
    if (!transacao) {
      if (req.file) {
        fs.unlink(req.file.path, () => {});
      }
      req.session.erro = 'Transação não encontrada.';
      return res.redirect('/transacoes');
    }

    const dados = { ...req.body };
    
    // Se foi enviado novo comprovativo
    if (req.file) {
      dados.comprovativo = req.file.filename;
      // Apagar comprovativo antigo se existir
      if (transacao.comprovativo) {
        const oldPath = path.join(uploadsDir, transacao.comprovativo);
        fs.unlink(oldPath, () => {});
      }
    } else {
      // Manter comprovativo existente
      dados.comprovativo = transacao.comprovativo;
    }

    await transacoesService.atualizar(transacaoId, utilizadorId, dados);
    req.session.sucesso = 'Transação atualizada com sucesso!';
    res.redirect('/transacoes');
  } catch (err) {
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }
    next(err);
  }
});

// Eliminar transação
router.post('/:id/eliminar', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    
    // Buscar transação antes de eliminar para apagar o comprovativo
    const transacao = await transacoesService.buscarPorId(req.params.id, utilizadorId);
    
    const resultado = await transacoesService.eliminar(req.params.id, utilizadorId);

    if (resultado.affectedRows === 0) {
      req.session.erro = 'Transação não encontrada.';
    } else {
      // Apagar comprovativo se existir
      if (transacao && transacao.comprovativo) {
        const filePath = path.join(uploadsDir, transacao.comprovativo);
        fs.unlink(filePath, () => {});
      }
      req.session.sucesso = 'Transação eliminada com sucesso!';
    }

    res.redirect('/transacoes');
  } catch (err) {
    next(err);
  }
});

// Remover comprovativo de uma transação
router.post('/:id/remover-comprovativo', async (req, res, next) => {
  try {
    const utilizadorId = req.session.utilizador.id;
    const transacaoId = req.params.id;

    const transacao = await transacoesService.buscarPorId(transacaoId, utilizadorId);
    
    if (!transacao) {
      req.session.erro = 'Transação não encontrada.';
      return res.redirect('/transacoes');
    }

    if (transacao.comprovativo) {
      // Apagar arquivo físico
      const filePath = path.join(uploadsDir, transacao.comprovativo);
      fs.unlink(filePath, () => {});
      
      // Atualizar banco de dados
      const dados = {
        descricao: transacao.descricao,
        valor: transacao.valor,
        tipo: transacao.tipo,
        categoria_id: transacao.categoria_id,
        data: transacao.data,
        recorrente: transacao.recorrente,
        frequencia: transacao.frequencia,
        notas: transacao.notas,
        comprovativo: null
      };
      
      await transacoesService.atualizar(transacaoId, utilizadorId, dados);
      req.session.sucesso = 'Comprovativo removido com sucesso!';
    }

    res.redirect(`/transacoes/${transacaoId}/editar`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
