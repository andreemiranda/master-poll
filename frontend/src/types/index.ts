// ══════════════════════════════════════════════
// TIPOS — Frontend
// ══════════════════════════════════════════════

export type Role = 'admin' | 'superuser';

/** null = não logado */
export type AuthState = {
  token: string;
  role: Role;
  expiresAt: number; // timestamp ms
} | null;

export interface LoginResponse {
  token: string;
  role: Role;
  expiresIn: number;
}

// ── Enquete ──────────────────────────────────

export interface Candidato {
  id: number;
  numero: number;
  nome: string;
  partido: string;
  cor: string;
  genero: 'M' | 'F';
  avatar: string | null;
}

export interface EnqueteConfig {
  cargoId: string;
  perguntaCustom: string;
  localNome: string;
  subtitulo: string;
}

export interface CargoEletivo {
  id: string;
  icone: string;
  cargo: string;
  pergunta: string;
  abrangencia: string;
  ambito: string;
  cor: string;
  hint: string;
}

export interface VotoRecord {
  [numero: string]: number;
}

export interface PublicData {
  votos: VotoRecord;
  candidatos: Candidato[];
  config: EnqueteConfig;
}

// ── Consentimento LGPD ───────────────────────
export type ConsentimentoStatus = 'aceito' | 'recusado' | null;

export interface BloqueioInfo {
  motivo: string;
  icone: string;
  detalhes: string;
}

// ── WebAuthn ─────────────────────────────────
export type WaStatus = 'pendente' | 'criando' | 'ativo' | 'negado' | 'indisponivel';

export interface PlataformaInfo {
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  nome: string;
  icone: string;
}

// ── Abas ─────────────────────────────────────
export type TabId = 'votar' | 'resultado' | 'candidatos' | 'avatares' | 'config';

export interface TabConfig {
  id: TabId;
  label: string;
  protegida: boolean;
  roleMinima?: Role;
}
