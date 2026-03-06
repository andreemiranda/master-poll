/**
 * routes/enquete.ts
 * Rotas da enquete: votos públicos + gestão protegida
 */

import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getState,
  updateVotos,
  updateCandidatos,
  updateConfig,
  checarDuplicidade,
  registrarVotoDuplicidade,
} from '../store.js';
import type { Candidato, EnqueteConfig } from '../types/index.js';

const router = Router();

// ════════════════════════════════════════════════
// ROTAS PÚBLICAS (aba Votar)
// ════════════════════════════════════════════════

/** GET /api/enquete/public — dados necessários para a aba Votar */
router.get('/public', (_req: Request, res: Response): void => {
  const { votos, candidatos, config } = getState();
  res.json({ votos, candidatos, config });
});

/**
 * POST /api/enquete/checar — Verifica duplicidade SEM registrar voto
 * Usado no init da sessão para saber se o votante já votou.
 */
router.post('/checar', (req: Request, res: Response): void => {
  const { uuid, waCredId, ip } = req.body as {
    uuid?: string;
    waCredId?: string;
    ip?: string;
  };
  const dup = checarDuplicidade(uuid ?? null, waCredId ?? null, ip ?? null);
  res.json(dup); // { duplicado: boolean; motivo?: string }
});

/** POST /api/enquete/voto — registrar voto */
router.post('/voto', (req: Request, res: Response): void => {
  const { numero, uuid, waCredId, ip } = req.body as {
    numero: number;
    uuid?: string;
    waCredId?: string;
    ip?: string;
  };

  if (typeof numero !== 'number' || numero < 0) {
    res.status(400).json({ error: 'numero é obrigatório e deve ser >= 0' });
    return;
  }

  const dup = checarDuplicidade(uuid ?? null, waCredId ?? null, ip ?? null);
  if (dup.duplicado) {
    res.status(409).json({ error: 'Voto duplicado', motivo: dup.motivo });
    return;
  }

  const state = getState();
  const novos = { ...state.votos, [String(numero)]: (state.votos[String(numero)] ?? 0) + 1 };
  updateVotos(novos);
  registrarVotoDuplicidade(uuid ?? null, waCredId ?? null, ip ?? null);

  res.json({ ok: true, votos: novos });
});

// ════════════════════════════════════════════════
// ROTAS PROTEGIDAS (abas: Resultado, Candidatos, Avatares, Config)
// ════════════════════════════════════════════════

/** GET /api/enquete/state — estado completo (admin/superuser) */
router.get('/state', requireAuth, (_req: Request, res: Response): void => {
  res.json(getState());
});

/** GET /api/enquete/votos — contagem de votos */
router.get('/votos', requireAuth, (_req: Request, res: Response): void => {
  res.json({ votos: getState().votos });
});

/** PUT /api/enquete/candidatos — substituir lista completa */
router.put('/candidatos', requireAuth, (req: Request, res: Response): void => {
  const { candidatos } = req.body as { candidatos: Candidato[] };
  if (!Array.isArray(candidatos)) {
    res.status(400).json({ error: 'candidatos deve ser um array' });
    return;
  }
  updateCandidatos(candidatos);
  res.json({ ok: true });
});

/** PATCH /api/enquete/candidatos/:id — atualizar um candidato */
router.patch('/candidatos/:id', requireAuth, (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const state = getState();
  const idx = state.candidatos.findIndex(c => c.id === id);
  if (idx === -1) { res.status(404).json({ error: 'Candidato não encontrado' }); return; }
  const updated = { ...state.candidatos[idx], ...req.body } as Candidato;
  const lista = [...state.candidatos];
  lista[idx] = updated;
  updateCandidatos(lista);
  res.json({ ok: true, candidato: updated });
});

/** POST /api/enquete/candidatos — adicionar candidato */
router.post('/candidatos', requireAuth, (req: Request, res: Response): void => {
  const state = getState();
  const novo = req.body as Omit<Candidato, 'id'>;
  if (!novo.nome || !novo.numero || !novo.partido) {
    res.status(400).json({ error: 'nome, numero e partido são obrigatórios' });
    return;
  }
  if (state.candidatos.some(c => c.numero === novo.numero)) {
    res.status(409).json({ error: `Número ${novo.numero} já está em uso` });
    return;
  }
  const maxId = state.candidatos.reduce((m, c) => Math.max(m, c.id), 0);
  const candidato: Candidato = { ...novo, id: maxId + 1, avatar: novo.avatar ?? null };
  updateCandidatos([...state.candidatos, candidato]);
  res.status(201).json({ ok: true, candidato });
});

/** DELETE /api/enquete/candidatos/:id — remover candidato */
router.delete('/candidatos/:id', requireAuth, (req: Request, res: Response): void => {
  const id = Number(req.params.id);
  const state = getState();
  const lista = state.candidatos.filter(c => c.id !== id);
  if (lista.length === state.candidatos.length) {
    res.status(404).json({ error: 'Candidato não encontrado' });
    return;
  }
  updateCandidatos(lista);
  res.json({ ok: true });
});

/** PUT /api/enquete/config — atualizar configuração da enquete */
router.put('/config', requireAuth, (req: Request, res: Response): void => {
  const config = req.body as EnqueteConfig;
  if (!config.cargoId) { res.status(400).json({ error: 'cargoId é obrigatório' }); return; }
  updateConfig(config);
  res.json({ ok: true });
});

/** DELETE /api/enquete/votos — zerar todos os votos (somente superuser) */
router.delete('/votos', requireAuth, (req: Request, res: Response): void => {
  if (req.user!.role !== 'superuser') {
    res.status(403).json({ error: 'Apenas superuser pode zerar os votos' });
    return;
  }
  updateVotos({});
  res.json({ ok: true });
});

export default router;
