# FINAXIS - Gestor Financeiro

Sistema de gestão financeira pessoal desenvolvido com Node.js, Express, Pug e MySQL.

## 🚀 Tecnologias

- **Backend:** Node.js com Express
- **Templates:** Pug (Jade)
- **Banco de Dados:** MySQL com mysql2
- **Autenticação:** express-session + bcryptjs
- **Estilos:** Bootstrap 5 + CSS personalizado
- **Gráficos:** Chart.js
- **Tipografia:** Google Fonts (Plus Jakarta Sans)

## 📁 Estrutura do Projeto

```
├── src/
│   ├── app.js              # Servidor Express principal
│   ├── database.js         # Configuração do banco de dados MySQL
│   ├── routes/             # Rotas da aplicação
│   │   ├── auth.js         # Autenticação (login/registo)
│   │   ├── dashboard.js    # Painel principal
│   │   ├── transacoes.js   # CRUD de transações
│   │   ├── categorias.js   # CRUD de categorias
│   │   └── relatorios.js   # Relatórios e gráficos
│   └── views/              # Templates Pug
│       ├── layout.pug      # Template base
│       ├── home.pug        # Página inicial
│       ├── dashboard.pug   # Dashboard
│       ├── auth/           # Login e registo
│       ├── transacoes/     # Listagem e formulários
│       ├── categorias/     # Listagem e formulários
│       └── relatorios/     # Página de relatórios
├── public/                 # Arquivos estáticos
│   ├── css/style.css       # Estilos personalizados
│   └── images/             # Logotipo e imagens
├── docs/
│   ├── SPRINTS_90_DIAS.md          # Plano operacional semana a semana
│   └── BACKLOG_TECNICO_90_DIAS.md  # Backlog técnico para execução
├── package.json
└── README.md
```

## 📦 Instalação

### Pré-requisitos
- Node.js (versão 14 ou superior)
- MySQL (versão 5.7 ou superior)

### Passos de Instalação

1. **Clone o repositório ou navegue até a pasta do projeto**

2. **Instale as dependências:**
```bash
npm install
```

3. **Configure o MySQL:**
   - Crie uma base de dados chamada `gestor_financeiro`
   - Verifique as credenciais em `src/database.js`

4. **Inicie o servidor:**
```bash
npm start
```

5. **Acesse no navegador:**
```
http://localhost:3001
```

---

## 📖 Tutorial de Utilização

### 1. Criar uma Conta

1. Acesse `http://localhost:3001`
2. Clique em **"Criar Conta Grátis"** ou **"Criar Conta"** no menu
3. Preencha os dados:
   - **Nome:** O seu nome completo
   - **Email:** Um email válido (será usado para login)
   - **Palavra-passe:** Mínimo 6 caracteres
   - **Confirmar Palavra-passe:** Repita a palavra-passe
4. Clique em **"Criar Conta"**
5. Será automaticamente redirecionado para o Dashboard

### 2. Fazer Login

1. Acesse `http://localhost:3001`
2. Clique em **"Entrar"** no menu
3. Insira o seu **Email** e **Palavra-passe**
4. Clique em **"Entrar"**

### 3. Dashboard

O Dashboard é a página principal onde pode ver:

- **Receitas do Mês:** Total de receitas do mês selecionado
- **Despesas do Mês:** Total de despesas do mês selecionado
- **Saldo Atual:** Saldo acumulado (receitas - despesas até ao mês selecionado)
- **Últimas Transações:** Lista das transações mais recentes
- **Gráfico de Despesas:** Distribuição das despesas por categoria

**Navegação por Mês:**
- Use as setas **◀** e **▶** para navegar entre meses
- Clique em **"Hoje"** para voltar ao mês atual

### 4. Gerir Transações

#### Adicionar uma Transação
1. Vá a **Transações** no menu
2. Clique em **"Nova Transação"**
3. Preencha:
   - **Descrição:** Ex: "Salário", "Supermercado"
   - **Valor:** O valor em euros
   - **Tipo:** Receita ou Despesa
   - **Categoria:** Escolha uma categoria existente
   - **Data:** Data da transação
4. Clique em **"Guardar"**

#### Editar uma Transação
1. Na lista de transações, clique no ícone de **lápis** ✏️
2. Altere os dados desejados
3. Clique em **"Guardar"**

#### Eliminar uma Transação
1. Na lista de transações, clique no ícone de **lixo** 🗑️
2. Confirme a eliminação

### 5. Gerir Categorias

As categorias ajudam a organizar as suas transações.

#### Adicionar uma Categoria
1. Vá a **Categorias** no menu
2. Clique em **"Nova Categoria"**
3. Preencha:
   - **Nome:** Ex: "Alimentação", "Transportes"
   - **Tipo:** Receita ou Despesa
   - **Cor:** Escolha uma cor para identificação
4. Clique em **"Guardar"**

#### Categorias Pré-definidas
O sistema já vem com categorias padrão:
- **Receitas:** Salário, Freelance, Investimentos, Outros
- **Despesas:** Alimentação, Transportes, Habitação, Lazer, Saúde, Educação, Outros

### 6. Relatórios

Os relatórios permitem analisar as suas finanças ao longo do tempo.

1. Vá a **Relatórios** no menu
2. Selecione o **Ano** desejado
3. Visualize:
   - **Resumo Anual:** Total de receitas, despesas e saldo
   - **Gráfico de Evolução:** Receitas vs Despesas por mês
   - **Top 5 Categorias:** Categorias com mais despesas
   - **Tabela Mensal:** Detalhes mês a mês

### 7. Terminar Sessão

1. Clique no seu **nome** no canto superior direito
2. Clique em **"Sair"**

---

## ✨ Funcionalidades

### SaaS e Faturação
- Planos: Free, Pro e Business
- Checkout Stripe para upgrade de plano
- Downgrade para Free diretamente na área de faturação
- Trial de 14 dias (uma vez por conta)
- Webhook Stripe para sincronizar plano/status automaticamente
- Downgrade automático para Free no fim do trial

### KPI e Conversão
- Instrumentação de eventos do funil (`signup`, `onboarding_complete`, `first_5_transactions`, `trial_started`, `subscribed`, `canceled`)
- Painel de KPIs em `/conta/configuracoes` (apenas admin) com janela móvel de 7 e 30 dias
- Endpoint interno para relatórios semanais/mensais: `/conta/kpis/funil?periodo=7|30`
- Taxas de conversão automáticas entre etapas do funil

### Equipas e Governança
- Multi-utilizador por conta com perfis `admin` e `membro`
- Convites por email para entrada na conta partilhada
- Página de configurações da conta (`/conta/configuracoes`)
- Auditoria de ações críticas (criar/editar/eliminar)
- Logs estruturados JSON por pedido HTTP
- Script de backup da base de dados

### Dashboard
- Resumo financeiro mensal (receitas, despesas, saldo acumulado)
- Últimas transações
- Gráfico de despesas por categoria
- Navegação por mês/ano

### Transações
- Listagem com filtros (tipo, categoria)
- Adicionar/editar/excluir transações
- Categorização de transações

### Categorias
- Gerenciamento de categorias de receita e despesa
- Cores personalizadas
- Contagem de transações por categoria

### Relatórios
- Visão anual de receitas e despesas
- Gráfico de evolução mensal
- Top 5 categorias de despesa
- Tabela de resumo mensal

## 🔐 Segurança

- Palavras-passe encriptadas com bcrypt
- Sessões seguras com express-session
- Dados isolados por utilizador

## 💳 Stripe (Billing)

### Variáveis necessárias
Configure no ficheiro .env:

- STRIPE_SECRET_KEY
- STRIPE_PUBLISHABLE_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_PRICE_PRO
- STRIPE_PRICE_BUSINESS
- APP_BASE_URL (ex: http://localhost:3001)

### Fluxo implementado
- A página Plano e Faturação está em /billing
- Upgrade para Pro/Business via checkout Stripe
- Webhook em /webhooks/stripe atualiza automaticamente plano e status na tabela subscricoes
- Trial de 14 dias aplicado na primeira subscrição paga da conta

### Teste local do webhook
Com Stripe CLI:

1. stripe login
2. stripe listen --forward-to localhost:3001/webhooks/stripe
3. Copie o signing secret gerado para STRIPE_WEBHOOK_SECRET

## 🧰 Operação

### Backup da base de dados
Executar:

```bash
npm run backup:db
```

O ficheiro é gerado em `data/backups/`.
Backups com mais de 14 dias são removidos automaticamente.

### Validação e testes

```bash
npm run check
npm test
```

- `npm run check`: valida sintaxe de ficheiros JS e templates Pug
- `npm test`: executa testes automáticos (auth, permissões, transações, convite e webhook)

## ⚙️ CI/CD

- Workflow de CI em `.github/workflows/ci.yml`
   - `npm ci`
   - `npm run check`
   - `npm test`
- Workflow de deploy em `.github/workflows/deploy.yml` (opcional por SSH)

### Secrets para deploy

Configure os seguintes secrets no GitHub para ativar deploy automático:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_APP_PATH`

## 🚀 Produção (Passo a Passo)

### 1) Preparar variáveis

1. Copie `.env.production.example` para `.env` no servidor.
2. Gere um secret forte:

```bash
npm run generate:secret
```

3. Cole o valor em `SESSION_SECRET`.
4. Preencha SMTP, Stripe e `APP_BASE_URL` com valores reais.

### 2) Validar ambiente antes do deploy

```bash
npm run prod:check
```

Se algum campo obrigatório estiver em falta ou inválido, o comando falha e indica o que corrigir.

### 3) Deploy automático no GitHub

Configure os secrets no repositório:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_APP_PATH`

### 4) Backup em produção

```bash
npm run backup:db
```

Se `mysqldump` não estiver no PATH, defina `MYSQLDUMP_PATH` no `.env`.

## 🎨 Interface

O sistema possui uma interface moderna e responsiva com:
- Design inspirado em aplicações bancárias profissionais
- Paleta de cores azul elegante
- Navegação intuitiva
- Cards informativos com animações
- Gráficos interativos
- Totalmente responsivo (mobile-friendly)

## 👨‍💻 Desenvolvedor

**Adrian Santos** - 2024019 (DS)


