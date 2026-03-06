/**
 * api.ts — Instância Axios centralizada
 *
 * Em desenvolvimento:  VITE_API_URL=http://localhost:3001
 * Em produção:         VITE_API_URL=https://master-poll.onrender.com
 *
 * Todos os hooks usam esta instância para que a URL seja
 * resolvida corretamente em qualquer ambiente.
 */

import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20_000,
  headers: { 'Content-Type': 'application/json' },
});

/** Interceptor global: loga erros de rede em dev */
if (import.meta.env.DEV) {
  api.interceptors.response.use(
    r => r,
    err => {
      console.error('[API Error]', err.config?.url, err.response?.status, err.message);
      return Promise.reject(err);
    }
  );
}

export default api;
