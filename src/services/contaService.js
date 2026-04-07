const crypto = require('crypto');
const db = require('../database');
const { AppError } = require('../middlewares/errorHandler');
const { enviarEmailConvite } = require('../email');

class ContaService {
  async obterConta(contaId) {
    const [rows] = await db.query('SELECT * FROM contas WHERE id = ?', [contaId]);
    return rows[0] || null;
  }

  async listarMembros(contaId) {
    const [rows] = await db.query(
      `SELECT id, nome, email, papel, criado_em
       FROM utilizadores
       WHERE conta_id = ?
       ORDER BY CASE WHEN papel = 'admin' THEN 0 ELSE 1 END, criado_em ASC`,
      [contaId]
    );
    return rows;
  }

  async _obterMembro(contaId, membroId) {
    const [rows] = await db.query(
      'SELECT id, nome, email, papel FROM utilizadores WHERE id = ? AND conta_id = ? LIMIT 1',
      [membroId, contaId]
    );
    return rows[0] || null;
  }

  async _contarAdmins(contaId) {
    const [rows] = await db.query(
      "SELECT COUNT(*) as total FROM utilizadores WHERE conta_id = ? AND papel = 'admin'",
      [contaId]
    );
    return rows[0].total || 0;
  }

  async listarConvites(contaId) {
    const [rows] = await db.query(
      `SELECT c.*, u.nome as convidado_por_nome
       FROM convites_conta c
       JOIN utilizadores u ON u.id = c.convidado_por
       WHERE c.conta_id = ?
       ORDER BY c.criado_em DESC`,
      [contaId]
    );
    return rows;
  }

  async atualizarConfiguracoes(contaId, { nome, moeda, timezone }) {
    await db.query(
      'UPDATE contas SET nome = ?, moeda = ?, timezone = ? WHERE id = ?',
      [nome.trim(), moeda || 'EUR', timezone || 'Europe/Lisbon', contaId]
    );
  }

  async criarConvite({ contaId, convidadoPor, email, papel, host }) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [existente] = await db.query(
      'SELECT id FROM utilizadores WHERE conta_id = ? AND email = ?',
      [contaId, email]
    );

    if (existente.length > 0) {
      throw new AppError('Este email já pertence à sua equipa.', 409);
    }

    await db.query(
      `INSERT INTO convites_conta (conta_id, convidado_por, email, papel, token, status, expira_em)
       VALUES (?, ?, ?, ?, ?, 'pendente', ?)`,
      [contaId, convidadoPor, email.toLowerCase(), papel || 'membro', token, expiraEm]
    );

    try {
      await enviarEmailConvite(email, token, host);
    } catch (err) {
      console.warn('Aviso ao enviar convite:', err.message);
      console.log(`Convite dev: ${host}/conta/convites/aceitar/${token}`);
    }
  }

  async cancelarConvite(contaId, conviteId) {
    const [resultado] = await db.query(
      `UPDATE convites_conta
       SET status = 'cancelado'
       WHERE id = ? AND conta_id = ? AND status = 'pendente'`,
      [conviteId, contaId]
    );
    return resultado.affectedRows > 0;
  }

  async atualizarPapelMembro({ contaId, membroId, novoPapel, atorId }) {
    const papel = novoPapel === 'admin' ? 'admin' : 'membro';
    const membro = await this._obterMembro(contaId, membroId);

    if (!membro) {
      throw new AppError('Membro não encontrado nesta conta.', 404);
    }

    if (membro.id === atorId && papel !== 'admin') {
      throw new AppError('Não pode remover os seus próprios privilégios de administrador.', 400);
    }

    if (membro.papel === 'admin' && papel === 'membro') {
      const totalAdmins = await this._contarAdmins(contaId);
      if (totalAdmins <= 1) {
        throw new AppError('A conta precisa de pelo menos um administrador.', 400);
      }
    }

    await db.query('UPDATE utilizadores SET papel = ? WHERE id = ? AND conta_id = ?', [papel, membroId, contaId]);

    return {
      id: membro.id,
      nome: membro.nome,
      papelAnterior: membro.papel,
      papelNovo: papel
    };
  }

  async removerMembro({ contaId, membroId, atorId }) {
    if (membroId === atorId) {
      throw new AppError('Não pode remover a sua própria conta por esta área.', 400);
    }

    const membro = await this._obterMembro(contaId, membroId);
    if (!membro) {
      throw new AppError('Membro não encontrado nesta conta.', 404);
    }

    if (membro.papel === 'admin') {
      const totalAdmins = await this._contarAdmins(contaId);
      if (totalAdmins <= 1) {
        throw new AppError('Não é possível remover o último administrador da conta.', 400);
      }
    }

    await db.query('DELETE FROM utilizadores WHERE id = ? AND conta_id = ?', [membroId, contaId]);

    return membro;
  }

  async obterConvitePorToken(token) {
    const [rows] = await db.query(
      'SELECT * FROM convites_conta WHERE token = ? LIMIT 1',
      [token]
    );
    return rows[0] || null;
  }

  async aceitarConvite(token, utilizadorId, emailUtilizador) {
    const convite = await this.obterConvitePorToken(token);

    if (!convite) throw new AppError('Convite inválido.', 404);
    if (convite.status !== 'pendente') throw new AppError('Este convite já não está disponível.', 400);
    if (new Date(convite.expira_em) < new Date()) {
      await db.query('UPDATE convites_conta SET status = ? WHERE id = ?', ['expirado', convite.id]);
      throw new AppError('Convite expirado.', 400);
    }

    if (convite.email.toLowerCase() !== String(emailUtilizador || '').toLowerCase()) {
      throw new AppError('Este convite foi enviado para outro email.', 403);
    }

    await db.query(
      'UPDATE utilizadores SET conta_id = ?, papel = ? WHERE id = ?',
      [convite.conta_id, convite.papel, utilizadorId]
    );

    await db.query(
      'UPDATE convites_conta SET status = ?, aceite_em = NOW() WHERE id = ?',
      ['aceite', convite.id]
    );

    return convite;
  }
}

module.exports = new ContaService();
