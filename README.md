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
http://localhost:3000
```

---

## 📖 Tutorial de Utilização

### 1. Criar uma Conta

1. Acesse `http://localhost:3000`
2. Clique em **"Criar Conta Grátis"** ou **"Criar Conta"** no menu
3. Preencha os dados:
   - **Nome:** O seu nome completo
   - **Email:** Um email válido (será usado para login)
   - **Palavra-passe:** Mínimo 6 caracteres
   - **Confirmar Palavra-passe:** Repita a palavra-passe
4. Clique em **"Criar Conta"**
5. Será automaticamente redirecionado para o Dashboard

### 2. Fazer Login

1. Acesse `http://localhost:3000`
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


