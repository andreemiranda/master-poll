/**
 * ModalAuth.tsx
 * Modal de autenticação — protege abas restritas
 * Suporta roles: admin e superuser
 */

import { useState, useRef, useEffect } from 'react';
import type { Role } from '../types';

interface Props {
  onLogin:  (role: Role, password: string) => Promise<void>;
  onClose?: () => void;
  tabLabel: string;
}

const S = {
  overlay: {
    position: 'fixed' as const, inset: 0, background: '#000000cc',
    zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  modal: {
    background: '#0d1a2e', border: '1px solid #1e3a60', borderRadius: 18, padding: 32,
    maxWidth: 400, width: '100%', position: 'relative' as const,
    animation: 'fadeInScale 0.25s cubic-bezier(0.4,0,0.2,1)',
  },
  inp: {
    width: '100%', padding: '11px 14px', background: '#060c1a',
    border: '1px solid #1e3a60', borderRadius: 9, color: '#c8d8f0',
    fontSize: 15, outline: 'none', boxSizing: 'border-box' as const,
    fontFamily: 'monospace',
  },
  btn: (cor: string) => ({
    width: '100%', padding: 13, background: `linear-gradient(135deg,${cor}dd,${cor})`,
    border: 'none', borderRadius: 10, color: '#fff', fontSize: 15,
    fontWeight: 700, cursor: 'pointer', marginTop: 6,
  }),
};

export function ModalAuth({ onLogin, onClose, tabLabel }: Props) {
  const [role, setRole]         = useState<Role>('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [erro, setErro]         = useState('');
  const [tentativas, setTentativas] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const MAX_TENTATIVAS = 5;
  const bloqueado = tentativas >= MAX_TENTATIVAS;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (bloqueado || loading || !password) return;
    setLoading(true);
    setErro('');
    try {
      await onLogin(role, password);
      setPassword('');
    } catch {
      const novas = tentativas + 1;
      setTentativas(novas);
      if (novas >= MAX_TENTATIVAS) {
        setErro(`Limite de ${MAX_TENTATIVAS} tentativas atingido. Recarregue a página.`);
      } else {
        setErro(`Senha incorreta. ${MAX_TENTATIVAS - novas} tentativa${MAX_TENTATIVAS - novas !== 1 ? 's' : ''} restante${MAX_TENTATIVAS - novas !== 1 ? 's' : ''}.`);
      }
    } finally {
      setLoading(false);
    }
  }

  const ROLES: { value: Role; label: string; cor: string; desc: string }[] = [
    { value: 'admin',     label: '🛡️ Administrador',  cor: '#1d4ed8', desc: 'Acesso às abas protegidas' },
    { value: 'superuser', label: '👑 Superusuário',   cor: '#7c3aed', desc: 'Acesso total + gestão de senhas' },
  ];

  const corAtiva = ROLES.find(r => r.value === role)!.cor;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        {onClose && (
          <button onClick={onClose} style={{ position:'absolute',top:14,right:16,background:'transparent',border:'none',color:'#64748b',fontSize:22,cursor:'pointer',lineHeight:1 }}>✕</button>
        )}

        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🔐</div>
          <h2 style={{ color:'#93c5fd', margin:'0 0 6px', fontSize:19 }}>Área Restrita</h2>
          <p style={{ color:'#4a6080', fontSize:13, margin:0, lineHeight:1.5 }}>
            A aba <strong style={{ color:'#c8d8f0' }}>{tabLabel}</strong> requer autenticação.
          </p>
        </div>

        {/* Seleção de role */}
        <div style={{ marginBottom:18 }}>
          <div style={{ color:'#64748b', fontSize:11, letterSpacing:'1.5px', fontWeight:700, marginBottom:8 }}>PERFIL DE ACESSO</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {ROLES.map(r => (
              <button key={r.value} onClick={() => { setRole(r.value); setErro(''); setPassword(''); }}
                style={{ padding:'10px 8px', background: role===r.value ? `${r.cor}18` : '#060c1a',
                  border:`2px solid ${role===r.value ? r.cor : '#1e3a60'}`, borderRadius:10,
                  cursor:'pointer', textAlign:'left', transition:'all 0.2s',
                  boxShadow: role===r.value ? `0 0 14px ${r.cor}30` : 'none' }}>
                <div style={{ color: role===r.value ? '#fff' : '#94a3b8', fontWeight:700, fontSize:13 }}>{r.label}</div>
                <div style={{ color:'#2d4a70', fontSize:10, marginTop:3 }}>{r.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', color:'#64748b', fontSize:11, letterSpacing:'1.5px', fontWeight:700, marginBottom:6 }}>SENHA</label>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setErro(''); }}
              placeholder="••••••••"
              disabled={bloqueado || loading}
              style={{ ...S.inp, borderColor: erro ? '#7f1d1d' : '#1e3a60' }}
              autoComplete="current-password"
            />
          </div>

          {erro && (
            <div style={{ background:'#1a0808', border:'1px solid #7f1d1d', borderRadius:8,
              padding:'10px 14px', color:'#f87171', fontSize:12, marginBottom:14 }}>
              ⚠️ {erro}
            </div>
          )}

          <button type="submit" disabled={bloqueado || loading || !password} style={S.btn(corAtiva)}>
            {loading ? '⏳ Verificando…' : bloqueado ? '🚫 Bloqueado' : '🔓 Entrar'}
          </button>
        </form>

        {/* Dica de senhas padrão (apenas em desenvolvimento) */}
        {import.meta.env.DEV && (
          <div style={{ marginTop:16, padding:'10px 14px', background:'#060c1a', border:'1px dashed #1a3050', borderRadius:8 }}>
            <div style={{ color:'#2d4a70', fontSize:10, letterSpacing:'1px', fontWeight:700, marginBottom:4 }}>🛠 MODO DEV — SENHAS PADRÃO</div>
            <div style={{ color:'#1e3a50', fontSize:11, fontFamily:'monospace' }}>admin → admin123</div>
            <div style={{ color:'#1e3a50', fontSize:11, fontFamily:'monospace' }}>superuser → super123</div>
          </div>
        )}

        <style>{`@keyframes fadeInScale{from{opacity:0;transform:scale(0.96)}to{opacity:1;transform:scale(1)}}`}</style>
      </div>
    </div>
  );
}
