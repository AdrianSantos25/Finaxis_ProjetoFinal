const db = require('../database');

class AuditService {
  async registar({ contaId = null, utilizadorId = null, recurso, acao, recursoId = null, detalhes = null, ip = null, userAgent = null }) {
    try {
      await db.query(
        `INSERT INTO auditoria_logs (conta_id, utilizador_id, recurso, acao, recurso_id, detalhes, ip, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [contaId, utilizadorId, recurso, acao, recursoId ? String(recursoId) : null, detalhes ? JSON.stringify(detalhes) : null, ip, userAgent]
      );
    } catch (err) {
      console.error('Erro ao registar auditoria:', err.message);
    }
  }

  async listarPorConta(contaId, limite = 50) {
    const [rows] = await db.query(
      `SELECT a.*, u.nome as utilizador_nome
       FROM auditoria_logs a
       LEFT JOIN utilizadores u ON u.id = a.utilizador_id
       WHERE a.conta_id = ?
       ORDER BY a.criado_em DESC, a.id DESC
       LIMIT ?`,
      [contaId, limite]
    );
    return rows;
  }
}

module.exports = new AuditService();
