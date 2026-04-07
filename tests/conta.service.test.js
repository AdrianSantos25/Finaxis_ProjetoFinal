jest.mock('../src/database', () => ({
  query: jest.fn()
}));

jest.mock('../src/email', () => ({
  enviarEmailConvite: jest.fn().mockResolvedValue(true)
}));

const db = require('../src/database');
const contaService = require('../src/services/contaService');

describe('ContaService convite', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('aceitarConvite atualiza utilizador e convite quando valido', async () => {
    jest.spyOn(contaService, 'obterConvitePorToken').mockResolvedValue({
      id: 5,
      conta_id: 9,
      papel: 'membro',
      status: 'pendente',
      email: 'user@example.com',
      expira_em: new Date(Date.now() + 3600000).toISOString()
    });

    db.query.mockResolvedValue([{ affectedRows: 1 }]);

    const convite = await contaService.aceitarConvite('token123', 7, 'user@example.com');

    expect(convite.conta_id).toBe(9);
    expect(db.query).toHaveBeenCalledWith(
      'UPDATE utilizadores SET conta_id = ?, papel = ? WHERE id = ?',
      [9, 'membro', 7]
    );
    expect(db.query).toHaveBeenCalledWith(
      'UPDATE convites_conta SET status = ?, aceite_em = NOW() WHERE id = ?',
      ['aceite', 5]
    );
  });
});

describe('ContaService permissoes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('nao permite remover ultimo admin', async () => {
    db.query
      .mockResolvedValueOnce([[{ id: 8, nome: 'Admin', email: 'admin@x.com', papel: 'admin' }]])
      .mockResolvedValueOnce([[{ total: 1 }]]);

    await expect(
      contaService.removerMembro({ contaId: 7, membroId: 8, atorId: 1 })
    ).rejects.toThrow('último administrador');
  });

  test('atualizar papel para membro bloqueia auto-democao', async () => {
    db.query.mockResolvedValueOnce([[{ id: 1, nome: 'Admin', email: 'admin@x.com', papel: 'admin' }]]);

    await expect(
      contaService.atualizarPapelMembro({ contaId: 7, membroId: 1, novoPapel: 'membro', atorId: 1 })
    ).rejects.toThrow('próprios privilégios');
  });
});
