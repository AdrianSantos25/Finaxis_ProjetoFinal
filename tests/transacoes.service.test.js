jest.mock('../src/database', () => ({
  query: jest.fn()
}));

const db = require('../src/database');
const transacoesService = require('../src/services/transacoesService');

describe('TransacoesService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('criar inclui conta_id no insert', async () => {
    db.query.mockResolvedValueOnce([{ insertId: 10 }]);

    await transacoesService.criar(7, 3, {
      descricao: 'Teste',
      valor: '12.50',
      tipo: 'despesa',
      categoria_id: 2,
      data: '2026-04-07',
      recorrente: false,
      frequencia: null,
      notas: null,
      comprovativo: null
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    const args = db.query.mock.calls[0][1];
    expect(args[5]).toBe(3);
    expect(args[6]).toBe(7);
  });

  test('atualizar usa filtro por conta_id', async () => {
    db.query.mockResolvedValueOnce([{ affectedRows: 1 }]);

    await transacoesService.atualizar(99, 7, {
      descricao: 'Atualizada',
      valor: '22.00',
      tipo: 'receita',
      categoria_id: 1,
      data: '2026-04-07',
      recorrente: false,
      frequencia: null,
      notas: null,
      comprovativo: null
    });

    expect(db.query.mock.calls[0][0]).toContain('conta_id = ?');
    const args = db.query.mock.calls[0][1];
    expect(args[args.length - 1]).toBe(7);
  });
});
