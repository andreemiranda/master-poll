/**
 * routes/auth.ts
 * Rotas de autenticação: login e troca de senha
 */

import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { validatePassword, changePassword, getUser } from '../store.js';
import { requireAuth, requireRole, JWT_SECRET, JWT_EXPIRES_IN } from '../middleware/auth.js';
import type { LoginRequest, ChangePasswordRequest, Role } from '../types/index.js';

const router = Router();

// ── POST /api/auth/login ─────────────────────
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { role, password } = req.body as LoginRequest;

  if (!role || !password) {
    res.status(400).json({ error: 'role e password são obrigatórios' });
    return;
  }

  if (role !== 'admin' && role !== 'superuser') {
    res.status(400).json({ error: 'Role inválida' });
    return;
  }

  const valid = await validatePassword(role, password);
  if (!valid) {
    // Pequeno delay para mitigar brute-force
    await new Promise(r => setTimeout(r, 500));
    res.status(401).json({ error: 'Senha incorreta' });
    return;
  }

  const user = getUser(role)!;
  const token = jwt.sign(
    { userId: user.id, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

  res.json({ token, role, expiresIn: JWT_EXPIRES_IN });
});

// ── POST /api/auth/change-password ───────────
// Somente superuser pode trocar senha de qualquer role
// Admin pode trocar apenas a própria senha
router.post(
  '/change-password',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const { role, currentPassword, newPassword } = req.body as ChangePasswordRequest;

    if (!role || !currentPassword || !newPassword) {
      res.status(400).json({ error: 'Campos obrigatórios: role, currentPassword, newPassword' });
      return;
    }

    // Admin só pode alterar a própria senha
    if (req.user!.role === 'admin' && role !== 'admin') {
      res.status(403).json({ error: 'Admin só pode alterar a própria senha' });
      return;
    }

    // Valida senha atual da role alvo
    const valid = await validatePassword(role as Role, currentPassword);
    if (!valid) {
      await new Promise(r => setTimeout(r, 500));
      res.status(401).json({ error: 'Senha atual incorreta' });
      return;
    }

    if (newPassword.length < 8) {
      res.status(400).json({ error: 'Nova senha deve ter no mínimo 8 caracteres' });
      return;
    }

    await changePassword(role as Role, newPassword);
    res.json({ ok: true, message: `Senha de ${role} alterada com sucesso` });
  }
);

// ── GET /api/auth/verify ─────────────────────
router.get('/verify', requireAuth, (req: Request, res: Response): void => {
  res.json({ valid: true, role: req.user!.role, userId: req.user!.userId });
});

export default router;
