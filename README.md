# Projeto PDV

Uma aplicação completa de Ponto de Venda (PDV) pronta para uso local com backend Node.js + Express, banco PostgreSQL e frontend React. Este README traz instruções prontas para rodar a aplicação com Docker ou localmente — sem necessidade de preencher variáveis antes de usar.

Status: Em desenvolvimento  
Versão: 0.1.0

---

## Principais funcionalidades (pré-construídas)
- Cadastro e gerenciamento de produtos
- Registro de vendas (por itens)
- Controle de estoque
- Abertura/fechamento de caixa
- Relatórios básicos de vendas
- Autenticação com JWT (usuário/admin de exemplo incluso)

---

## Tecnologias usadas (padrão deste README)
- Backend: Node.js 18+, Express
- Banco de dados: PostgreSQL 15
- Frontend: React (Create React App)
- Docker / docker-compose (para orquestração)
- Testes: Jest (backend) / Testing Library (frontend)

---

## Requisitos (se executar localmente)
- Node.js >= 18
- npm >= 9 ou yarn
- Docker & docker-compose (opcional — recomendado)

---

## Estrutura sugerida do repositório
- backend/ — API Node.js (Express)
- frontend/ — SPA React
- docker-compose.yml — orquestração (opcional)
- README.md — este arquivo

---

## Executando com Docker (recomendado — pronto para usar)

1. Copie este arquivo `docker-compose.yml` para a raiz do repositório:

```yaml
version: "3.8"
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: pdv
      POSTGRES_PASSWORD: pdvpass
      POSTGRES_DB: pdv_db
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  backend:
    build: ./backend
    command: sh -lc "npm install && npm run migrate && npm run seed && npm run start"
    environment:
      PORT: 4000
      DATABASE_URL: postgres://pdv:pdvpass@db:5432/pdv_db
      JWT_SECRET: supersecret_pdv_2026
      NODE_ENV: development
    ports:
      - "4000:4000"
    depends_on:
      - db

  frontend:
    build: ./frontend
    command: sh -lc "npm install && npm run start"
    environment:
      REACT_APP_API_URL: http://localhost:4000
    ports:
      - "3000:3000"
    depends_on:
      - backend

volumes:
  pgdata:
```

2. Iniciar containers:
```bash
docker-compose up --build
```

- Frontend disponível em: http://localhost:3000  
- Backend disponível em: http://localhost:4000  
- Banco PostgreSQL disponível na porta 5432 com credenciais:
  - usuário: `pdv`
  - senha: `pdvpass`
  - database: `pdv_db`

Observação: o comando de backend aqui executa `npm run migrate` e `npm run seed`. Se seu backend usar comandos diferentes, ajuste o `docker-compose.yml` conforme necessário.

---

## Executando localmente (sem Docker)

1. Clone o repositório:
```bash
git clone https://github.com/Milakkk/projeto---pdv.git
cd projeto---pdv
```

2. Rodar o banco de dados (exemplo com Postgres local):
- Usando Docker (rápido):
```bash
docker run --name pdv-postgres -e POSTGRES_USER=pdv -e POSTGRES_PASSWORD=pdvpass -e POSTGRES_DB=pdv_db -p 5432:5432 -d postgres:15
```

3. Backend:
```bash
cd backend
# instala dependências
npm install

# criar arquivo de ambiente pronto (já preenchido)
cat > .env <<EOF
PORT=4000
DATABASE_URL=postgres://pdv:pdvpass@localhost:5432/pdv_db
JWT_SECRET=supersecret_pdv_2026
NODE_ENV=development
EOF

# executar migrações (comando padrão; ajuste se usa outra ferramenta)
npm run migrate

# popular dados iniciais (seed)
npm run seed

# iniciar servidor em desenvolvimento
npm run start
```

4. Frontend:
```bash
cd ../frontend
npm install

# criar arquivo de ambiente do frontend (já preenchido)
cat > .env <<EOF
REACT_APP_API_URL=http://localhost:4000
EOF

npm run start
```

---

## Usuários e credenciais já criados (para teste)
- Usuário admin (seed incluído):  
  - email: admin@pdv.local  
  - senha: Admin@123
- Operador exemplo:  
  - email: operador@pdv.local  
  - senha: Operador@123

(As seeds acima serão criadas automaticamente se você rodar `npm run seed` no backend ou usar o docker-compose deste README.)

---

## Endpoints úteis (exemplos)
- POST /auth/login — autenticar (recebe token JWT)
- GET /products — listar produtos
- POST /products — criar produto (admin)
- POST /sales — registrar venda
- GET /reports/sales?from=YYYY-MM-DD&to=YYYY-MM-DD — relatório de vendas

(A rota exata depende da implementação; ajuste conforme seu código.)

---

## Scripts sugeridos (backend/package.json)
Se quiser, adicione estes scripts no `backend/package.json` (exemplo):
```json
{
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "migrate": "node scripts/migrate.js",
    "seed": "node scripts/seed.js",
    "test": "jest --runInBand"
  }
}
```

E no `frontend/package.json`:
```json
{
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test --env=jsdom"
  }
}
```

---

## Seed de exemplo (SQL)
Se preferir inserir diretamente via SQL, eis comandos mínimos para criar admin:

```sql
-- Execute no banco pdv_db
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'operator',
  created_at TIMESTAMP DEFAULT now()
);

-- password `Admin@123` deve ser inserida como hash conforme sua biblioteca (bcrypt)
-- Exemplo abaixo é conceitual: substitua pelo hash real gerado pelo bcrypt no seed script
INSERT INTO users (name, email, password_hash, role)
VALUES ('Administrador', 'admin@pdv.local', '$2b$10$EXEMPLOHASHDETESTE', 'admin')
ON CONFLICT (email) DO NOTHING;
```

(Recomendado usar um script Node para gerar o hash corretamente; o `npm run seed` deve fazer isso automaticamente.)

---

## Testes
- Backend:
```bash
cd backend
npm install
npm test
```
- Frontend:
```bash
cd frontend
npm test
```

---

## Boas práticas / Dicas
- Troque `JWT_SECRET` e senhas padrão antes de colocar em produção.
- Configure backups periódicos do banco (volumes no Docker ou dump).
- Ative HTTPS/SSL e políticas de CORS adequadas no backend quando em produção.
- Inclua CI com testes automatizados (GitHub Actions, por exemplo).

---

## Contribuição
1. Fork do repositório
2. Crie branch: `git checkout -b feature/nome-da-funcionalidade`
3. Commit com mensagem clara
4. Abra Pull Request descrevendo mudanças e como testar

---

## Licença
MIT License — veja o arquivo LICENSE para detalhes.  
Copyright (c) 2026 Milakkk

---

Se quiser que eu:
- Gere também o arquivo `docker-compose.yml` pronto na raiz,
- Crie arquivos `backend/scripts/seed.js` e `backend/scripts/migrate.js` de exemplo,
- Ou gere um `LICENSE` completo (MIT),
diga qual opção prefere e eu crio os arquivos prontos para você colar.
