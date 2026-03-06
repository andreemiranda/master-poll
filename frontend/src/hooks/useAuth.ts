/**
 * useAuth.ts
 * Gerencia autenticação admin/superuser com JWT
 * Usa instância axios centralizada (api.ts) para suporte prod/dev automático
 */

import { useState, useCallback, useEffect } from 'react';
import { api } from '../utils/api';
import axios from 'axios';
import type { AuthState, Role, LoginResponse } from '../types';

const SESSION_KEY = 'enquete:auth';

function loadFromSession(): AuthState {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState;
    if (!parsed || Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

export function useAuth() {
  const [auth, setAuth] = useState<AuthState>(loadFromSession);

  // Verifica expiração automaticamente
  useEffect(() => {
    if (!auth) return;
    const msLeft = auth.expiresAt - Date.now();
    if (msLeft <= 0) { logout(); return; }
    const timer = setTimeout(logout, msLeft);
    return () => clearTimeout(timer);
  }, [auth]);

  const login = useCallback(async (role: Role, password: string): Promise<void> => {
    const { data } = await api.post<LoginResponse>('/api/auth/login', { role, password });
    const state: AuthState = {
      token: data.token,
      role: data.role,
      expiresAt: Date.now() + data.expiresIn * 1000,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
    setAuth(state);
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setAuth(null);
  }, []);

  const changePassword = useCallback(async (
    role: Role,
    currentPassword: string,
    newPassword: string
  ): Promise<void> => {
    if (!auth) throw new Error('Não autenticado');
    await api.post(
      '/api/auth/change-password',
      { role, currentPassword, newPassword },
      { headers: { Authorization: `Bearer ${auth.token}` } }
    );
  }, [auth]);

  /** Verifica se o usuário logado tem acesso a uma role mínima */
  const hasRole = useCallback((minRole: Role): boolean => {
    if (!auth) return false;
    if (auth.role === 'superuser') return true;
    return auth.role === minRole;
  }, [auth]);

  /** Cabeçalho Bearer para requisições autenticadas */
  const authHeader = auth ? { Authorization: `Bearer ${auth.token}` } : {};

  return { auth, login, logout, changePassword, hasRole, authHeader };
}
