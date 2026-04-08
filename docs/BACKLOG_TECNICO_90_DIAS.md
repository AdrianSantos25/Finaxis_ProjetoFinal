# Backlog Tecnico 90 Dias

## Prioridade Alta (Dias 1-30)

- [ ] Onboarding em 3 passos com estado persistente por utilizador.
- [ ] Empty states de dashboard e transacoes com CTA claro.
- [x] Eventos analytics basicos: signup, onboarding_complete, first_5_transactions, trial_started, subscribed, canceled.
- [ ] Endpoint interno de resumo de funil (7/30 dias).
- [ ] Painel admin simples para visualizar KPIs semanais.

## Prioridade Media (Dias 31-60)

- [ ] Checklist in-app com progresso da ativacao.
- [ ] Lembretes de email 24h e 72h sem transacoes.
- [ ] Pagina de upgrade com prova social e objecoes.
- [ ] Instrumentacao de abandono do onboarding por etapa.

## Prioridade Media-Alta (Dias 61-90)

- [ ] Sequencia de retencao semanal (email/alertas).
- [ ] Medicao de churn por coorte mensal.
- [ ] A/B testing basico de headline e trial.
- [ ] Dashboard de suporte com SLA e tempo medio de resposta.

## Eventos instrumentados

- signup
- onboarding_complete
- first_5_transactions
- trial_started
- subscribed
- canceled

## SQL util para funil semanal

```sql
SELECT event_name, COUNT(*) AS total
FROM analytics_events
WHERE criado_em >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY event_name
ORDER BY total DESC;
```

## Definicao de pronto (DoD)

- Funcionalidade com telemetria minima.
- Cobertura por check + testes existentes sem regressao.
- Copy validada para PT-PT.
- KPI alvo associado a cada entrega.
