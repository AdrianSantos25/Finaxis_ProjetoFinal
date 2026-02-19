const mysql = require('mysql2/promise');

// Configuração da conexão com o MySQL
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'gestor_financeiro',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Função para criar o banco de dados, se não existir
async function createDatabase() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'root',
    port: 3306
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

    // Adicionar colunas para recuperação de senha
    if (!await columnExists(connection, 'utilizadores', 'reset_token')) {
      await connection.query(`
        ALTER TABLE utilizadores 
        ADD COLUMN reset_token VARCHAR(64) DEFAULT NULL,
        ADD COLUMN reset_token_expira DATETIME DEFAULT NULL
      `);
      console.log('✅ Colunas de recuperação de senha adicionadas');
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
      await connection.query('CREATE INDEX idx_categorias_utilizador ON categorias(utilizador_id)');
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
