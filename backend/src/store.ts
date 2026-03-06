/**
 * store.ts
 * Estado global em memória com persistência em JSON.
 *
 * Render.com: attach a Disk em /var/data (mount path)
 * e defina DATA_DIR=/var/data na env do serviço.
 * Sem disco persistente, os dados são reiniciados a cada deploy.
 *
 * Suporte a senhas via env vars:
 *   ADMIN_PASSWORD     → senha inicial do admin    (default: admin123)
 *   SUPERUSER_PASSWORD → senha inicial do superuser (default: super123)
 */

import fs   from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, User, Role, Candidato, EnqueteConfig } from './types/index.js';

// ── Diretório de dados ───────────────────────
// Em produção no Render: DATA_DIR=/var/data (disco persistente)
// Em desenvolvimento:   DATA_DIR=./data (padrão)
const DATA_DIR   = process.env.DATA_DIR ?? path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// ── Candidatos iniciais ──────────────────────
const CANDIDATOS_BASE: Candidato[] = [
  { id:1, numero:13, nome:'João Silva',     partido:'PT',   cor:'#e53e3e', genero:'M', avatar:null },
  { id:2, numero:45, nome:'Maria Santos',   partido:'PSDB', cor:'#3182ce', genero:'F', avatar:null },
  { id:3, numero:22, nome:'Pedro Oliveira', partido:'PL',   cor:'#d69e2e', genero:'M', avatar:null },
  { id:4, numero:15, nome:'Ana Costa',      partido:'MDB',  cor:'#38a169', genero:'F', avatar:null },
  { id:5, numero:10, nome:'Carlos Souza',   partido:'PDT',  cor:'#805ad5', genero:'M', avatar:null },
];

const CONFIG_DEFAULT: EnqueteConfig = {
  cargoId: 'governador',
  perguntaCustom: '',
  localNome: '',
  subtitulo: '',
};

// ── Estado em memória ────────────────────────
let appState: AppState = {
  votos: {},
  candidatos: CANDIDATOS_BASE,
  config: CONFIG_DEFAULT,
  votosUUID: [],
  votosWA: [],
  votosIP: [],
};

let users: Map<Role, User> = new Map();

// ── Helpers de arquivo ───────────────────────
function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function persistState(): void {
  try {
    ensureDataDir();
    fs.writeFileSync(STATE_FILE, JSON.stringify(appState, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Store] Falha ao persistir estado:', (e as Error).message);
  }
}

function persistUsers(): void {
  try {
    ensureDataDir();
    const obj: Record<string, User> = {};
    users.forEach((u, role) => { obj[role] = u; });
    fs.writeFileSync(USERS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Store] Falha ao persistir usuários:', (e as Error).message);
  }
}

// ── Inicialização ────────────────────────────
export async function initStore(): Promise<void> {
  ensureDataDir();

  // ── Carrega estado ──────────────────────────
  if (fs.existsSync(STATE_FILE)) {
    try {
      const raw = fs.readFileSync(STATE_FILE, 'utf-8');
      const loaded = JSON.parse(raw) as Partial<AppState>;
      appState = { ...appState, ...loaded };
      console.log('[Store] Estado carregado de', STATE_FILE);
    } catch {
      console.warn('[Store] Falha ao carregar state.json — usando estado inicial');
    }
  } else {
    console.log('[Store] state.json não encontrado — iniciando com dados padrão');
    persistState();
  }

  // ── Carrega usuários ────────────────────────
  if (fs.existsSync(USERS_FILE)) {
    try {
      const raw = fs.readFileSync(USERS_FILE, 'utf-8');
      const obj = JSON.parse(raw) as Record<string, User>;
      Object.entries(obj).forEach(([role, user]) => {
        users.set(role as Role, user);
      });
      console.log('[Store] Usuários carregados de', USERS_FILE);

      // Verifica se deve trocar senha via env var (útil após redeploy)
      await syncEnvPasswords();
      return;
    } catch {
      console.warn('[Store] Falha ao carregar users.json — criando usuários padrão');
    }
  }

  await seedDefaultUsers();
}

/**
 * Se ADMIN_PASSWORD ou SUPERUSER_PASSWORD estiverem definidas nas envs
 * E o hash atual NÃO corresponde ao valor da env, regera o hash.
 * Isso permite trocar senhas via env vars sem perder o users.json.
 */
async function syncEnvPasswords(): Promise<void> {
  const pairs: Array<[Role, string | undefined]> = [
    ['admin',     process.env.ADMIN_PASSWORD],
    ['superuser', process.env.SUPERUSER_PASSWORD],
  ];
  let changed = false;
  for (const [role, plaintext] of pairs) {
    if (!plaintext) continue;
    const user = users.get(role);
    if (!user) continue;
    const match = await bcrypt.compare(plaintext, user.passwordHash);
    if (!match) {
      const hash = await bcrypt.hash(plaintext, 12);
      users.set(role, { ...user, passwordHash: hash, updatedAt: new Date().toISOString() });
      changed = true;
      console.log(`[Store] Senha de ${role} sincronizada a partir da env var`);
    }
  }
  if (changed) persistUsers();
}

async function seedDefaultUsers(): Promise<void> {
  const SALT_ROUNDS = 12;
  const now = new Date().toISOString();

  // Usa env var se disponível, senão usa padrão (TROCAR EM PRODUÇÃO!)
  const adminPwd  = process.env.ADMIN_PASSWORD     ?? 'admin123';
  const superPwd  = process.env.SUPERUSER_PASSWORD ?? 'super123';

  const [adminHash, superHash] = await Promise.all([
    bcrypt.hash(adminPwd,  SALT_ROUNDS),
    bcrypt.hash(superPwd, SALT_ROUNDS),
  ]);

  users.set('admin', {
    id: uuidv4(), role: 'admin',
    passwordHash: adminHash, createdAt: now, updatedAt: now,
  });
  users.set('superuser', {
    id: uuidv4(), role: 'superuser',
    passwordHash: superHash, createdAt: now, updatedAt: now,
  });

  persistUsers();
  const isDefault = adminPwd === 'admin123';
  console.log(`[Store] Usuários criados — admin: ${isDefault ? '(PADRÃO — TROQUE!)' : 'via env'}`);
}

// ── Getters / Setters ────────────────────────
export function getState(): Readonly<AppState> { return appState; }

export function updateVotos(votos: AppState['votos']): void {
  appState = { ...appState, votos }; persistState();
}

export function updateCandidatos(candidatos: Candidato[]): void {
  appState = { ...appState, candidatos }; persistState();
}

export function updateConfig(config: EnqueteConfig): void {
  appState = { ...appState, config }; persistState();
}

export function registrarVotoDuplicidade(
  uuid: string | null,
  waCredId: string | null,
  ip: string | null
): void {
  const s = { ...appState };
  if (uuid    && !s.votosUUID.includes(uuid))    s.votosUUID = [...s.votosUUID, uuid];
  if (waCredId && !s.votosWA.includes(waCredId)) s.votosWA   = [...s.votosWA, waCredId];
  if (ip      && !s.votosIP.includes(ip))        s.votosIP   = [...s.votosIP, ip];
  appState = s; persistState();
}

export function checarDuplicidade(
  uuid: string | null,
  waCredId: string | null,
  ip: string | null
): { duplicado: boolean; motivo?: string } {
  if (uuid     && appState.votosUUID.includes(uuid))    return { duplicado:true, motivo:'Token de navegador (UUID)' };
  if (waCredId && appState.votosWA.includes(waCredId))  return { duplicado:true, motivo:'Dispositivo físico (WebAuthn)' };
  if (ip       && appState.votosIP.includes(ip))        return { duplicado:true, motivo:`Endereço IP (${ip})` };
  return { duplicado: false };
}

// ── Auth helpers ─────────────────────────────
export function getUser(role: Role): User | undefined { return users.get(role); }

export async function validatePassword(role: Role, password: string): Promise<boolean> {
  const user = users.get(role);
  if (!user) return false;
  return bcrypt.compare(password, user.passwordHash);
}

export async function changePassword(role: Role, newPassword: string): Promise<void> {
  const user = users.get(role);
  if (!user) throw new Error(`Usuário ${role} não encontrado`);
  const hash = await bcrypt.hash(newPassword, 12);
  users.set(role, { ...user, passwordHash: hash, updatedAt: new Date().toISOString() });
  persistUsers();
}
