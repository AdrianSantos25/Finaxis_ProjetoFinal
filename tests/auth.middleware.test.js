jest.mock('../src/services/saasService', () => ({
  obterContextoUtilizador: jest.fn()
}));

const { verificarAutenticacao, verificarAdminConta } = require('../src/middlewares/auth');

describe('Auth middleware', () => {
  test('verificarAutenticacao permite utilizador autenticado', () => {
    const req = { session: { utilizador: { id: 1 } } };
    const res = { redirect: jest.fn() };
    const next = jest.fn();

    verificarAutenticacao(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  test('verificarAutenticacao redireciona para login quando nao autenticado', () => {
    const req = { session: {}, originalUrl: '/dashboard' };
    const res = { redirect: jest.fn() };
    const next = jest.fn();

    verificarAutenticacao(req, res, next);

    expect(req.session.returnTo).toBe('/dashboard');
    expect(res.redirect).toHaveBeenCalledWith('/auth/login');
    expect(next).not.toHaveBeenCalled();
  });

  test('verificarAdminConta bloqueia membro', () => {
    const req = { session: { utilizador: { id: 1, papel: 'membro' } } };
    const res = { redirect: jest.fn() };
    const next = jest.fn();

    verificarAdminConta(req, res, next);

    expect(req.session.erro).toContain('Acesso restrito');
    expect(res.redirect).toHaveBeenCalledWith('/dashboard');
    expect(next).not.toHaveBeenCalled();
  });

  test('verificarAdminConta permite admin', () => {
    const req = { session: { utilizador: { id: 1, papel: 'admin' } } };
    const res = { redirect: jest.fn() };
    const next = jest.fn();

    verificarAdminConta(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.redirect).not.toHaveBeenCalled();
  });
});
