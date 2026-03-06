/**
 * server.ts — Ponto de entrada do backend
 * Deploy: https://master-poll.onrender.com
 */

import express from 'express';
import cors    from 'cors';
import helmet  from 'helmet';
import rateLimit from 'express-rate-limit';
import { initStore }    from './store.js';
import authRouter       from './routes/auth.js';
import enqueteRouter    from './routes/enquete.js';

const PORT    = Number(process.env.PORT ?? 3001);
const IS_PROD = process.env.NODE_ENV === 'production';

// Origins permitidas — separadas por vírgula em CORS_ORIGIN
const ALLOWED_ORIGINS: string[] = IS_PROD
  ? (process.env.CORS_ORIGIN ?? 'https://master-poll.netlify.app')
      .split(',').map(o => o.trim()).filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173'];

// ── Rate limiters ────────────────────────────
/** Login: máx 10 tentativas por IP em 15 min */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
});

/** Votos: máx 5 votos por IP em 1 hora (proteção extra além da dedup) */
const voterLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Limite de requisições atingido.' },
});

async function bootstrap(): Promise<void> {
  await initStore();

  const app = express();

  // Render coloca o app atrás de proxy — necessário para req.ip correto
  if (IS_PROD) app.set('trust proxy', 1);

  // ── Segurança ────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }));

  // ── CORS ─────────────────────────────────────
  app.use(cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // curl/health-checks
      if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
      callback(new Error(`CORS bloqueado para: ${origin}`));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  }));

  app.use(express.json({ limit: '10mb' }));

  // ── Rotas ────────────────────────────────────
  app.use('/api/auth/login',  loginLimiter); // rate-limit antes do router
  app.use('/api/auth',        authRouter);
  app.use('/api/enquete/voto', voterLimiter);
  app.use('/api/enquete',     enqueteRouter);

  // ── Health check (Render usa /health para liveness probe) ────
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', env: process.env.NODE_ENV ?? 'dev', ts: new Date().toISOString() });
  });

  // ── 404 ──────────────────────────────────────
  app.use((_req, res) => res.status(404).json({ error: 'Rota não encontrada' }));

  // ── Error handler global ──────────────────────
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err.message.startsWith('CORS') ? 403 : 500;
    res.status(status).json({ error: IS_PROD ? 'Erro interno' : err.message });
  });

  // Render exige 0.0.0.0
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🗳️  Enquete Eleitoral — Backend`);
    console.log(`   Porta   : ${PORT}`);
    console.log(`   Modo    : ${process.env.NODE_ENV ?? 'development'}`);
    console.log(`   CORS    : ${ALLOWED_ORIGINS.join(', ')}\n`);
  });
}

bootstrap().catch(err => { console.error('[Fatal]', err); process.exit(1); });
