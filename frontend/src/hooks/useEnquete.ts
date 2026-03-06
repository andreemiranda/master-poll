/**
 * useEnquete.ts
 * Gerencia estado da enquete — dados públicos e mutações autenticadas
 */

import { useState, useCallback } from 'react';
import { api } from '../utils/api';
import axios from 'axios';
import type { Candidato, EnqueteConfig, PublicData, VotoRecord } from '../types';
import { ENQUETE_CONFIG_DEFAULT } from '../constants/cargos';

export function useEnquete(authHeader: Record<string, string>) {
  const [votos,      setVotos]      = useState<VotoRecord>({});
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [config,     setConfig]     = useState<EnqueteConfig>(ENQUETE_CONFIG_DEFAULT);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);

  // ── Dados públicos ────────────────────────────
  const loadPublic = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<PublicData>('/api/enquete/public');
      setVotos(data.votos);
      setCandidatos(data.candidatos);
      setConfig(data.config);
    } catch {
      setError('Erro ao carregar dados da enquete');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * checarDuplicidade — verifica se o votante já votou SEM registrar voto.
   * Retorna { duplicado: boolean; motivo?: string }
   */
  const checarDuplicidade = useCallback(async (
    uuid:     string | null,
    waCredId: string | null,
    ip:       string | null,
  ): Promise<{ duplicado: boolean; motivo?: string }> => {
    try {
      const { data } = await api.post<{ duplicado: boolean; motivo?: string }>(
        '/api/enquete/checar',
        { uuid, waCredId: waCredId?.slice(0, 32) ?? null, ip },
      );
      return data;
    } catch {
      return { duplicado: false }; // em caso de erro de rede, permite continuar
    }
  }, []);

  // ── Registrar voto ────────────────────────────
  const registrarVoto = useCallback(async (
    numero:   number,
    uuid:     string | null,
    waCredId: string | null,
    ip:       string | null,
  ): Promise<{ ok: boolean; motivo?: string }> => {
    try {
      const { data } = await api.post<{ ok: boolean; votos: VotoRecord }>(
        '/api/enquete/voto',
        { numero, uuid, waCredId: waCredId?.slice(0, 32) ?? null, ip },
      );
      setVotos(data.votos);
      return { ok: true };
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        if (e.response?.status === 409)
          return { ok: false, motivo: e.response.data?.motivo ?? 'Voto duplicado' };
      }
      return { ok: false, motivo: 'Erro ao registrar voto' };
    }
  }, []);

  // ── Candidatos CRUD ───────────────────────────
  const adicionarCandidato = useCallback(async (c: Omit<Candidato, 'id'>) => {
    const { data } = await api.post<{ ok: boolean; candidato: Candidato }>(
      '/api/enquete/candidatos', c, { headers: authHeader },
    );
    setCandidatos(prev => [...prev, data.candidato]);
    return data.candidato;
  }, [authHeader]);

  const atualizarCandidato = useCallback(async (id: number, patch: Partial<Candidato>) => {
    await api.patch(`/api/enquete/candidatos/${id}`, patch, { headers: authHeader });
    setCandidatos(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  }, [authHeader]);

  const removerCandidato = useCallback(async (id: number) => {
    await api.delete(`/api/enquete/candidatos/${id}`, { headers: authHeader });
    setCandidatos(prev => prev.filter(c => c.id !== id));
  }, [authHeader]);

  // ── Config ───────────────────────────────────
  const atualizarConfig = useCallback(async (nova: EnqueteConfig) => {
    await api.put('/api/enquete/config', nova, { headers: authHeader });
    setConfig(nova);
  }, [authHeader]);

  // ── Zerar votos (superuser) ───────────────────
  const zerarVotos = useCallback(async () => {
    await api.delete('/api/enquete/votos', { headers: authHeader });
    setVotos({});
  }, [authHeader]);

  return {
    votos, candidatos, config, loading, error,
    loadPublic, checarDuplicidade, registrarVoto,
    adicionarCandidato, atualizarCandidato, removerCandidato,
    atualizarConfig, zerarVotos,
    setVotos, setCandidatos, setConfig,
  };
}
