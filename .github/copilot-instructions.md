# Gestor Financeiro - Node.js

## Descrição
Sistema de gestão financeira pessoal desenvolvido com Node.js, Express, Pug e MySQL.

## Tecnologias
- **Backend:** Node.js com Express
- **Templates:** Pug (Jade)
- **Banco de Dados:** MySQL com mysql2
- **Estilos:** Bootstrap 5

## Estrutura do Projeto
```
├── src/
│   ├── app.js              # Servidor Express principal
│   ├── database.js         # Configuração do banco de dados
│   ├── routes/             # Rotas da aplicação
│   └── views/              # Templates Pug
├── public/                 # Arquivos estáticos (CSS, JS)
├── package.json
└── README.md
```

## Como Executar
1. Instalar dependências: `npm install`
2. Iniciar servidor: `npm start`
3. Acessar: http://localhost:3000

## Funcionalidades
- Dashboard com resumo financeiro
- Gerenciamento de receitas e despesas
- Categorização de transações
- Relatórios e gráficos
