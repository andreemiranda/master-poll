# Enquete Eleitoral

Aplicacao fullstack para enquetes eleitorais com autenticacao por roles, WebAuthn e conformidade LGPD.

- **Frontend**: https://master-poll.netlify.app
- **Backend**:  https://master-poll.onrender.com

---

## Stack

| Camada    | Tecnologia                              |
|-----------|-----------------------------------------|
| Frontend  | React 18 + TypeScript + Vite            |
| Backend   | Node.js 20 + Express + TypeScript       |
| Auth      | JWT (roles: admin / superuser)          |
| Seguranca | bcrypt, helmet, CORS, rate-limit        |
| Hardware  | WebAuthn/FIDO2 (Secure Enclave/TEE/TPM) |
| Privacidade | LGPD/GDPR com consentimento explícito |

---

## Estrutura

```
enquete-eleitoral/
├── render.yaml               # Blueprint Render.com (backend)
├── backend/
│   ├── src/
│   │   ├── server.ts         # Express + helmet + CORS + rate-limit
│   │   ├── store.ts          # Estado + persistência JSON (disco Render)
│   │   ├── middleware/
│   │   │   └── auth.ts       # JWT middleware + requireAuth + requireRole
│   │   ├── routes/
│   │   │   ├── auth.ts       # POST /login  POST /change-password  GET /verify
│   │   │   └── enquete.ts    # GET /public  POST /checar  POST /voto  CRUD
│   │   └── types/index.ts
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── netlify.toml           # Config Netlify + SPA + headers de segurança
    ├── public/_redirects      # Fallback SPA
    ├── .env.production        # VITE_API_URL=https://master-poll.onrender.com
    ├── .env.development       # VITE_API_URL=http://localhost:3001
    └── src/
        ├── vite-env.d.ts      # Tipos TypeScript para import.meta.env
        ├── utils/api.ts       # Axios centralizado com baseURL dinâmica
        ├── hooks/
        │   ├── useAuth.ts     # JWT: login, logout, troca de senha
        │   └── useEnquete.ts  # CRUD + checarDuplicidade + registrarVoto
        └── components/
            ├── ModalAuth.tsx  # Modal de login (admin/superuser)
            └── ...
```

---

## DEPLOY — RENDER.COM (Backend)

### Metodo 1: Blueprint via render.yaml (RECOMENDADO)

1. Suba o repositório completo para o GitHub
2. Acesse https://render.com e faça login
3. Clique em **New** → **Blueprint**
4. Conecte o repositório GitHub e selecione a branch `main`
5. O Render detecta o `render.yaml` e cria o serviço automaticamente
6. No painel do serviço → **Environment** → adicione:
   - `ADMIN_PASSWORD` = sua senha forte para admin
   - `SUPERUSER_PASSWORD` = sua senha forte para superuser
7. Clique em **Manual Deploy** para aplicar as senhas

### Metodo 2: Dashboard Manual

1. render.com → **New** → **Web Service**
2. Conecte o repositório GitHub
3. Configure:
   - **Name**: `master-poll`
   - **Root Directory**: `backend`
   - **Build Command**: `npm ci && npm run build`
   - **Start Command**: `npm start`
   - **Node Version**: `20`
4. Adicione as variáveis de ambiente:

```
NODE_ENV=production
CORS_ORIGIN=https://master-poll.netlify.app
DATA_DIR=/tmp/master-poll-data
JWT_SECRET=<gere com: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))">
ADMIN_PASSWORD=<sua-senha-forte>
SUPERUSER_PASSWORD=<sua-senha-forte>
```

5. Clique em **Create Web Service**

### Verificar deploy do backend

```bash
curl https://master-poll.onrender.com/health
# Resposta esperada: {"status":"ok","env":"production","ts":"..."}
```

> NOTA: O plano free do Render hiberna o servico apos 15 min de inatividade.
> O primeiro request pode levar ~30s para "acordar". Para produção real, use o plano pago.

### Disco persistente (opcional — plano pago)

Sem disco, os dados (votos, candidatos, senhas) são resetados a cada deploy.
Para persistência total:
1. Painel do serviço → **Settings** → **Disks** → **Add Disk**
2. Mount Path: `/var/data` | Size: 1 GB
3. Altere a env var: `DATA_DIR=/var/data`

---

## DEPLOY — NETLIFY (Frontend)

### Metodo 1: Via netlify.toml (RECOMENDADO)

1. Acesse https://app.netlify.com e faça login
2. Clique em **Add new site** → **Import an existing project**
3. Conecte o GitHub e selecione o repositório
4. O Netlify detecta o `netlify.toml` automaticamente:
   - Base directory: `frontend`
   - Build command: `npm ci && npm run build`
   - Publish directory: `dist`
5. Clique em **Deploy site**
6. Após o deploy: **Site configuration** → **General** → **Site details** → **Change site name** → `master-poll`
7. A URL ficará: `https://master-poll.netlify.app`

### Variáveis de ambiente no Netlify (se necessário sobrescrever)

Site configuration → **Environment variables** → **Add a variable**:
```
VITE_API_URL=https://master-poll.onrender.com
```

> O arquivo `.env.production` já define essa variável. Use o painel Netlify
> apenas se precisar trocar a URL do backend sem fazer commit.

### Verificar deploy do frontend

Acesse https://master-poll.netlify.app — a aplicação deve carregar imediatamente.

---

## Desenvolvimento Local

```bash
# 1. Instalar todas as dependências
npm run install:all

# 2. Configurar backend
cp backend/.env.example backend/.env
# Edite backend/.env se necessário

# 3. Rodar backend + frontend simultaneamente
npm run dev
```

- Frontend: http://localhost:5173
- Backend:  http://localhost:3001
- Health:   http://localhost:3001/health

---

## Senhas e Roles

| Role       | Env Var              | Padrão (INSEGURO) | Permissões                              |
|------------|----------------------|-------------------|-----------------------------------------|
| admin      | ADMIN_PASSWORD       | admin123          | Resultado, Candidatos, Avatares, Config |
| superuser  | SUPERUSER_PASSWORD   | super123          | Tudo + zerar votos + alterar senhas     |

**IMPORTANTE**: Troque as senhas em produção via variáveis de ambiente no Render.

Para alterar sem redeploy: use a aba **Config** → seção **Alterar senha** na interface.

---

## Segurança Multicamada (Votos)

1. **WebAuthn/FIDO2** — credencial no hardware (Secure Enclave / TEE / TPM)
2. **Token UUID** — identificador por navegador (localStorage)  
3. **IP público** — bloqueio por endereço de rede
4. **Rate limiting** — máx 10 logins / 15min | máx 5 votos / hora por IP
5. **JWT** — autenticação das abas administrativas (8h de validade)

---

## Endpoints da API

| Método | Rota                        | Auth      | Descrição                    |
|--------|-----------------------------|-----------|------------------------------|
| GET    | /health                     | -         | Health check                 |
| POST   | /api/auth/login             | -         | Login (retorna JWT)          |
| GET    | /api/auth/verify            | JWT       | Verifica token               |
| POST   | /api/auth/change-password   | JWT       | Troca de senha               |
| GET    | /api/enquete/public         | -         | Dados públicos da enquete    |
| POST   | /api/enquete/checar         | -         | Verifica duplicidade de voto |
| POST   | /api/enquete/voto           | -         | Registra voto                |
| GET    | /api/enquete/state          | JWT       | Estado completo              |
| POST   | /api/enquete/candidatos     | JWT       | Adicionar candidato          |
| PATCH  | /api/enquete/candidatos/:id | JWT       | Editar candidato             |
| DELETE | /api/enquete/candidatos/:id | JWT       | Remover candidato            |
| PUT    | /api/enquete/config         | JWT       | Atualizar configuração       |
| DELETE | /api/enquete/votos          | superuser | Zerar todos os votos         |
