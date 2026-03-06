// ══════════════════════════════════════════════
// TIPOS COMPARTILHADOS — Backend
// ══════════════════════════════════════════════

export type Role = 'admin' | 'superuser';

export interface User {
  id: string;
  role: Role;
  /** Hash bcrypt da senha */
  passwordHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface JwtPayload {
  userId: string;
  role: Role;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  role: Role;
  password: string;
}

export interface LoginResponse {
  token: string;
  role: Role;
  expiresIn: number;
}

export interface ChangePasswordRequest {
  role: Role;
  currentPassword: string;
  newPassword: string;
}

// ── Enquete ──────────────────────────────────

export interface Candidato {
  id: number;
  numero: number;
  nome: string;
  partido: string;
  cor: string;
  genero: 'M' | 'F';
  /** base64 data URL ou null */
  avatar: string | null;
}

export interface EnqueteConfig {
  cargoId: string;
  perguntaCustom: string;
  localNome: string;
  subtitulo: string;
}

export interface VotoRecord {
  /** chave = numero do candidato (string), valor = contagem */
  [numero: string]: number;
}

export interface AppState {
  votos: VotoRecord;
  candidatos: Candidato[];
  config: EnqueteConfig;
  votosUUID: string[];        // UUIDs que já votaram
  votosWA: string[];          // credId prefixes que já votaram
  votosIP: string[];          // IPs (sanitizados) que já votaram
}

// ── Express augmentation ──────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
