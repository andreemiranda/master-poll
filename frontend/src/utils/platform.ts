import type { PlataformaInfo } from '../types';

export function detectarPlataforma(): PlataformaInfo {
  const ua = navigator.userAgent || '';
  const isIOS     = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobile  = isIOS || isAndroid;
  return {
    isIOS, isAndroid, isMobile,
    nome:  isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop',
    icone: isIOS ? '🍎' : isAndroid ? '🤖' : '🖥️',
  };
}

export function gerarUUID(): string {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function getPublicIP(): Promise<string | null> {
  for (const url of [
    'https://api.ipify.org?format=json',
    'https://api64.ipify.org?format=json',
  ]) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      const d = await r.json() as { ip?: string };
      if (d.ip) return d.ip;
    } catch { /* tenta próximo */ }
  }
  return null;
}

export function sanitizeIP(ip: string): string {
  return ip.replace(/[:.]/g, '_');
}
