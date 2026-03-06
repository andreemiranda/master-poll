/**
 * middleware/auth.ts
 * Middleware JWT para rotas protegidas
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { JwtPayload, Role } from '../types/index.js';

export const JWT_SECRET = process.env.JWT_SECRET ?? 'enquete-secret-change-in-production-2024';
export const JWT_EXPIRES_IN = 60 * 60 * 8; // 8 horas em segundos

/** Verifica JWT e injeta req.user */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token não fornecido' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

/** Exige role específica (superuser passa em qualquer verificação) */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) { res.status(401).json({ error: 'Não autenticado' }); return; }
    // superuser tem acesso total
    if (req.user.role === 'superuser' || roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ error: 'Permissão insuficiente' });
    }
  };
}
