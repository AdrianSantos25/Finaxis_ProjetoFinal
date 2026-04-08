const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuração da conexão com o MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'gestor_financeiro',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Função para criar o banco de dados, se não existir
async function createDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT) || 3306
  });

  await connection.query('CREATE DATABASE IF NOT EXISTS gestor_financeiro');
  await connection.end();
}

// Função auxiliar para verificar se uma coluna existe
async function columnExists(connection, tableName, columnName) {
  const [rows] = await connection.query(`
    SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'gestor_financeiro' 
    AND TABLE_NAME = ? AND COLUMN_NAME = ?
  `, [tableName, columnName]);
  return rows[0].count > 0;
}

// Função para criar tabelas, se não existirem
async function setupDatabase() {
  const connection = await pool.getConnection();
  try {
    // Criar tabela de contas (tenant)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS contas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        slug VARCHAR(255) DEFAULT NULL,
        stripe_customer_id VARCHAR(255) DEFAULT NULL,
        moeda VARCHAR(10) DEFAULT 'EUR',
        timezone VARCHAR(64) DEFAULT 'Europe/Lisbon',
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    if (!await columnExists(connection, 'contas', 'stripe_customer_id')) {
      await connection.query(`
        ALTER TABLE contas
        ADD COLUMN stripe_customer_id VARCHAR(255) DEFAULT NULL
      `);
      console.log('✅ Coluna stripe_customer_id adicionada à tabela contas');
    }

    if (!await columnExists(connection, 'contas', 'moeda')) {
      await connection.query('ALTER TABLE contas ADD COLUMN moeda VARCHAR(10) DEFAULT \'EUR\'');
    }

    if (!await columnExists(connection, 'contas', 'timezone')) {
      await connection.query('ALTER TABLE contas ADD COLUMN timezone VARCHAR(64) DEFAULT \'Europe/Lisbon\'');
    }

    // Criar tabela de utilizadores
    await connection.query(`
      CREATE TABLE IF NOT EXISTS utilizadores (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Adicionar conta_id aos utilizadores para suportar multi-tenant
    if (!await columnExists(connection, 'utilizadores', 'conta_id')) {
      await connection.query(`
        ALTER TABLE utilizadores
        ADD COLUMN conta_id INT DEFAULT NULL,
        ADD FOREIGN KEY (conta_id) REFERENCES contas(id)
      `);
      console.log('✅ Coluna conta_id adicionada à tabela utilizadores');
    }

    if (!await columnExists(connection, 'utilizadores', 'papel')) {
      await connection.query(`
        ALTER TABLE utilizadores
        ADD COLUMN papel ENUM('admin', 'membro') NOT NULL DEFAULT 'admin'
      `);
      console.log('✅ Coluna papel adicionada à tabela utilizadores');
    }

    // Criar tabela de subscrições por conta
    await connection.query(`
      CREATE TABLE IF NOT EXISTS subscricoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conta_id INT NOT NULL,
        plano ENUM('free', 'pro', 'business') NOT NULL DEFAULT 'free',
        status ENUM('trialing', 'active', 'past_due', 'canceled') NOT NULL DEFAULT 'active',
        fornecedor ENUM('manual', 'stripe') NOT NULL DEFAULT 'manual',
        stripe_subscription_id VARCHAR(255) DEFAULT NULL,
        stripe_price_id VARCHAR(255) DEFAULT NULL,
        trial_inicio DATETIME DEFAULT NULL,
        trial_fim DATETIME DEFAULT NULL,
        cancel_at_period_end TINYINT(1) DEFAULT 0,
        inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
        fim DATETIME DEFAULT NULL,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE CASCADE
      )
    `);

    if (!await columnExists(connection, 'subscricoes', 'fornecedor')) {
      await connection.query(`
        ALTER TABLE subscricoes
        ADD COLUMN fornecedor ENUM('manual', 'stripe') NOT NULL DEFAULT 'manual'
      `);
    }

    if (!await columnExists(connection, 'subscricoes', 'stripe_subscription_id')) {
      await connection.query(`
        ALTER TABLE subscricoes
        ADD COLUMN stripe_subscription_id VARCHAR(255) DEFAULT NULL
      `);
    }

    if (!await columnExists(connection, 'subscricoes', 'stripe_price_id')) {
      await connection.query(`
        ALTER TABLE subscricoes
        ADD COLUMN stripe_price_id VARCHAR(255) DEFAULT NULL
      `);
    }

    if (!await columnExists(connection, 'subscricoes', 'trial_inicio')) {
      await connection.query(`
        ALTER TABLE subscricoes
        ADD COLUMN trial_inicio DATETIME DEFAULT NULL
      `);
    }

    if (!await columnExists(connection, 'subscricoes', 'trial_fim')) {
      await connection.query(`
        ALTER TABLE subscricoes
        ADD COLUMN trial_fim DATETIME DEFAULT NULL
      `);
    }

    if (!await columnExists(connection, 'subscricoes', 'cancel_at_period_end')) {
      await connection.query(`
        ALTER TABLE subscricoes
        ADD COLUMN cancel_at_period_end TINYINT(1) DEFAULT 0
      `);
    }

    if (!await columnExists(connection, 'subscricoes', 'atualizado_em')) {
      await connection.query(`
        ALTER TABLE subscricoes
        ADD COLUMN atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      `);
    }

    // Criar tabela categorias
    await connection.query(`
      CREATE TABLE IF NOT EXISTS categorias (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        tipo ENUM('receita', 'despesa') NOT NULL,
        cor VARCHAR(7) DEFAULT '#6c757d',
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Adicionar coluna utilizador_id se não existir
    if (!await columnExists(connection, 'categorias', 'utilizador_id')) {
      await connection.query(`
        ALTER TABLE categorias ADD COLUMN utilizador_id INT DEFAULT NULL,
        ADD FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id)
      `);
      console.log('✅ Coluna utilizador_id adicionada à tabela categorias');
    }

    if (!await columnExists(connection, 'categorias', 'conta_id')) {
      await connection.query(`
        ALTER TABLE categorias
        ADD COLUMN conta_id INT DEFAULT NULL,
        ADD FOREIGN KEY (conta_id) REFERENCES contas(id)
      `);
    }

    // Criar tabela transacoes
    await connection.query(`
      CREATE TABLE IF NOT EXISTS transacoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        descricao VARCHAR(255) NOT NULL,
        valor DECIMAL(10, 2) NOT NULL,
        tipo ENUM('receita', 'despesa') NOT NULL,
        categoria_id INT,
        data DATE NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id)
      )
    `);

    // Adicionar coluna utilizador_id se não existir
    if (!await columnExists(connection, 'transacoes', 'utilizador_id')) {
      await connection.query(`
        ALTER TABLE transacoes ADD COLUMN utilizador_id INT DEFAULT NULL,
        ADD FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id)
      `);
      console.log('✅ Coluna utilizador_id adicionada à tabela transacoes');
    }

    if (!await columnExists(connection, 'transacoes', 'conta_id')) {
      await connection.query(`
        ALTER TABLE transacoes
        ADD COLUMN conta_id INT DEFAULT NULL,
        ADD FOREIGN KEY (conta_id) REFERENCES contas(id)
      `);
    }

    // Adicionar colunas para recuperação de senha
    if (!await columnExists(connection, 'utilizadores', 'reset_token')) {
      await connection.query(`
        ALTER TABLE utilizadores 
        ADD COLUMN reset_token VARCHAR(64) DEFAULT NULL,
        ADD COLUMN reset_token_expira DATETIME DEFAULT NULL
      `);
      console.log('✅ Colunas de recuperação de senha adicionadas');
    }

    // Criar tabela de orçamentos/metas mensais
    await connection.query(`
      CREATE TABLE IF NOT EXISTS orcamentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        utilizador_id INT NOT NULL,
        conta_id INT DEFAULT NULL,
        categoria_id INT NOT NULL,
        limite DECIMAL(10, 2) NOT NULL,
        mes INT NOT NULL,
        ano INT NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id) ON DELETE CASCADE,
        FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE CASCADE,
        FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE CASCADE,
        UNIQUE KEY unique_orcamento (utilizador_id, categoria_id, mes, ano)
      )
    `);

    // Criar tabela de metas financeiras (objetivos)
    await connection.query(`
      CREATE TABLE IF NOT EXISTS metas_financeiras (
        id INT AUTO_INCREMENT PRIMARY KEY,
        utilizador_id INT NOT NULL,
        conta_id INT NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        tipo ENUM('poupanca', 'quitacao') NOT NULL DEFAULT 'poupanca',
        valor_objetivo DECIMAL(12, 2) NOT NULL,
        valor_atual DECIMAL(12, 2) NOT NULL DEFAULT 0,
        data_objetivo DATE DEFAULT NULL,
        status ENUM('ativa', 'concluida', 'arquivada') NOT NULL DEFAULT 'ativa',
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id) ON DELETE CASCADE,
        FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE CASCADE
      )
    `);

    if (!await columnExists(connection, 'orcamentos', 'conta_id')) {
      await connection.query(`
        ALTER TABLE orcamentos
        ADD COLUMN conta_id INT DEFAULT NULL,
        ADD FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE CASCADE
      `);
    }

    try {
      await connection.query('CREATE UNIQUE INDEX unique_orcamento_conta ON orcamentos(conta_id, categoria_id, mes, ano)');
    } catch (e) { /* Índice já existe */ }

    // Tabela de convites de equipa
    await connection.query(`
      CREATE TABLE IF NOT EXISTS convites_conta (
        id INT AUTO_INCREMENT PRIMARY KEY,
        conta_id INT NOT NULL,
        convidado_por INT NOT NULL,
        email VARCHAR(255) NOT NULL,
        papel ENUM('admin', 'membro') NOT NULL DEFAULT 'membro',
        token VARCHAR(64) NOT NULL UNIQUE,
        status ENUM('pendente', 'aceite', 'cancelado', 'expirado') NOT NULL DEFAULT 'pendente',
        expira_em DATETIME NOT NULL,
        aceite_em DATETIME DEFAULT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE CASCADE,
        FOREIGN KEY (convidado_por) REFERENCES utilizadores(id) ON DELETE CASCADE
      )
    `);

    // Tabela de auditoria
    await connection.query(`
      CREATE TABLE IF NOT EXISTS auditoria_logs (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        conta_id INT DEFAULT NULL,
        utilizador_id INT DEFAULT NULL,
        recurso VARCHAR(100) NOT NULL,
        acao VARCHAR(50) NOT NULL,
        recurso_id VARCHAR(100) DEFAULT NULL,
        detalhes JSON DEFAULT NULL,
        ip VARCHAR(64) DEFAULT NULL,
        user_agent VARCHAR(255) DEFAULT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE SET NULL,
        FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id) ON DELETE SET NULL
      )
    `);

    // Tabela de eventos de analytics para funil SaaS
    await connection.query(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        conta_id INT DEFAULT NULL,
        utilizador_id INT DEFAULT NULL,
        event_name VARCHAR(100) NOT NULL,
        source VARCHAR(50) DEFAULT 'app',
        event_data JSON DEFAULT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conta_id) REFERENCES contas(id) ON DELETE SET NULL,
        FOREIGN KEY (utilizador_id) REFERENCES utilizadores(id) ON DELETE SET NULL
      )
    `);

    try {
      await connection.query('CREATE INDEX idx_analytics_event_name_data ON analytics_events(event_name, criado_em)');
    } catch (e) { /* Índice já existe */ }

    try {
      await connection.query('CREATE INDEX idx_analytics_conta_data ON analytics_events(conta_id, criado_em)');
    } catch (e) { /* Índice já existe */ }

    // Adicionar colunas de recorrência às transações
    if (!await columnExists(connection, 'transacoes', 'recorrente')) {
      await connection.query(`
        ALTER TABLE transacoes 
        ADD COLUMN recorrente TINYINT(1) DEFAULT 0,
        ADD COLUMN frequencia ENUM('semanal', 'mensal', 'anual') DEFAULT NULL,
        ADD COLUMN ultima_geracao DATE DEFAULT NULL
      `);
      console.log('✅ Colunas de recorrência adicionadas à tabela transacoes');
    }

    // Adicionar coluna de notas às transações
    if (!await columnExists(connection, 'transacoes', 'notas')) {
      await connection.query(`
        ALTER TABLE transacoes 
        ADD COLUMN notas TEXT DEFAULT NULL
      `);
      console.log('✅ Coluna notas adicionada à tabela transacoes');
    }

    // Adicionar coluna de comprovativo às transações
    if (!await columnExists(connection, 'transacoes', 'comprovativo')) {
      await connection.query(`
        ALTER TABLE transacoes 
        ADD COLUMN comprovativo VARCHAR(255) DEFAULT NULL
      `);
      console.log('✅ Coluna comprovativo adicionada à tabela transacoes');
    }

    // Garantir que todos os utilizadores têm uma conta associada
    const [utilizadoresSemConta] = await connection.query(`
      SELECT id, nome FROM utilizadores WHERE conta_id IS NULL
    `);

    for (const utilizador of utilizadoresSemConta) {
      const slugBase = (utilizador.nome || 'conta')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'conta';
      const slug = `${slugBase}-${utilizador.id}`;

      const [contaResult] = await connection.query(
        'INSERT INTO contas (nome, slug) VALUES (?, ?)',
        [utilizador.nome || `Conta ${utilizador.id}`, slug]
      );

      await connection.query(
        'UPDATE utilizadores SET conta_id = ? WHERE id = ?',
        [contaResult.insertId, utilizador.id]
      );
    }

    // Sincronizar conta_id das tabelas partilhadas
    await connection.query(`
      UPDATE categorias c
      JOIN utilizadores u ON u.id = c.utilizador_id
      SET c.conta_id = u.conta_id
      WHERE c.utilizador_id IS NOT NULL AND c.conta_id IS NULL
    `);

    await connection.query(`
      UPDATE transacoes t
      JOIN utilizadores u ON u.id = t.utilizador_id
      SET t.conta_id = u.conta_id
      WHERE t.utilizador_id IS NOT NULL AND t.conta_id IS NULL
    `);

    await connection.query(`
      UPDATE orcamentos o
      JOIN utilizadores u ON u.id = o.utilizador_id
      SET o.conta_id = u.conta_id
      WHERE o.conta_id IS NULL
    `);

    // Garantir subscrição inicial para todas as contas
    const [contasSemSubscricao] = await connection.query(`
      SELECT c.id
      FROM contas c
      LEFT JOIN subscricoes s ON s.conta_id = c.id
      WHERE s.id IS NULL
    `);

    for (const conta of contasSemSubscricao) {
      await connection.query(
        'INSERT INTO subscricoes (conta_id, plano, status) VALUES (?, ?, ?)',
        [conta.id, 'free', 'active']
      );
    }

    // Criar índices para melhor performance
    try {
      await connection.query('CREATE INDEX idx_transacoes_utilizador ON transacoes(utilizador_id)');
    } catch (e) { /* Índice já existe */ }
    
    try {
      await connection.query('CREATE INDEX idx_transacoes_data ON transacoes(data)');
    } catch (e) { /* Índice já existe */ }
    
    try {
      await connection.query('CREATE INDEX idx_transacoes_tipo ON transacoes(tipo)');
    } catch (e) { /* Índice já existe */ }

    try {
      await connection.query('CREATE INDEX idx_transacoes_conta ON transacoes(conta_id)');
    } catch (e) { /* Índice já existe */ }
    
    try {
      await connection.query('CREATE INDEX idx_categorias_utilizador ON categorias(utilizador_id)');
    } catch (e) { /* Índice já existe */ }

    try {
      await connection.query('CREATE INDEX idx_categorias_conta ON categorias(conta_id)');
    } catch (e) { /* Índice já existe */ }

    try {
      await connection.query('CREATE INDEX idx_utilizadores_conta ON utilizadores(conta_id)');
    } catch (e) { /* Índice já existe */ }

    try {
      await connection.query('CREATE INDEX idx_subscricoes_conta ON subscricoes(conta_id)');
    } catch (e) { /* Índice já existe */ }

    try {
      await connection.query('CREATE UNIQUE INDEX idx_subscricoes_stripe_subscription ON subscricoes(stripe_subscription_id)');
    } catch (e) { /* Índice já existe */ }

    try {
      await connection.query('CREATE UNIQUE INDEX idx_contas_stripe_customer ON contas(stripe_customer_id)');
    } catch (e) { /* Índice já existe */ }

    try {
      await connection.query('CREATE INDEX idx_convites_conta ON convites_conta(conta_id, status)');
    } catch (e) { /* Índice já existe */ }

    try {
      await connection.query('CREATE INDEX idx_auditoria_conta ON auditoria_logs(conta_id, criado_em)');
    } catch (e) { /* Índice já existe */ }

    // Verificar se já existem categorias padrão (sem utilizador)
    const [rows] = await connection.query('SELECT COUNT(*) as count FROM categorias WHERE utilizador_id IS NULL');
    
    if (rows[0].count === 0) {
      // Inserir categorias padrão (disponíveis para todos)
      const categoriasPadrao = [
        ['Salário', 'receita', '#28a745'],
        ['Freelance', 'receita', '#20c997'],
        ['Investimentos', 'receita', '#17a2b8'],
        ['Outros', 'receita', '#6c757d'],
        ['Alimentação', 'despesa', '#dc3545'],
        ['Transporte', 'despesa', '#fd7e14'],
        ['Habitação', 'despesa', '#ffc107'],
        ['Lazer', 'despesa', '#e83e8c'],
        ['Saúde', 'despesa', '#6f42c1'],
        ['Educação', 'despesa', '#007bff'],
        ['Outros', 'despesa', '#6c757d'],
      ];

      for (const cat of categoriasPadrao) {
        await connection.query(
          'INSERT INTO categorias (nome, tipo, cor, utilizador_id) VALUES (?, ?, ?, NULL)',
          cat
        );
      }
      console.log('✅ Categorias padrão inseridas com sucesso!');
    }

    console.log('✅ Base de dados e tabelas configuradas com sucesso!');
  } finally {
    connection.release();
  }
}

// Inicializar base de dados
async function initDatabase() {
  try {
    await createDatabase();
    await setupDatabase();
  } catch (err) {
    console.error('❌ Erro ao configurar a base de dados:', err.message);
  }
}

initDatabase();

module.exports = pool;
