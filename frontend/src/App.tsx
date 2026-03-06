/**
 * App.tsx — Componente principal
 * Gerencia autenticação, consentimento LGPD e navegação entre abas
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './hooks/useAuth';
import { useEnquete } from './hooks/useEnquete';
import { detectarPlataforma, gerarUUID, getPublicIP, sanitizeIP } from './utils/platform';
import {
  webAuthnPlataformaDisponivel,
  webAuthnCriarCredencial,
  webAuthnVerificarCredencial,
} from './utils/webauthn';
import { CARGOS_ELETIVOS, CORES_PRESET, ABAS } from './constants/cargos';
import { Avatar } from './components/Avatar';
import { Confetti, Bar } from './components/Confetti';
import { ModalAuth } from './components/ModalAuth';
import { ModalPrivacidade, BannerConsentimento, RodapeLGPD } from './components/ModalPrivacidade';
import type { TabId, Role, Candidato, EnqueteConfig, ConsentimentoStatus, WaStatus, BloqueioInfo } from './types';

// ── Helpers de estilo ─────────────────────────
const INP: React.CSSProperties = {
  width:'100%', padding:'10px 13px', background:'#060c1a',
  border:'1px solid #1e3a60', borderRadius:8, color:'#c8d8f0',
  fontSize:14, outline:'none', boxSizing:'border-box',
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', color:'#64748b', fontSize:11, letterSpacing:'1.5px', fontWeight:700, marginBottom:5 }}>{label}</label>
      {children}
      {hint && <div style={{ color:'#2d4a70', fontSize:11, marginTop:4 }}>{hint}</div>}
    </div>
  );
}

const BRANCO_NULO: Candidato = { id:0, numero:0, nome:'Branco / Nulo', partido:'—', cor:'#718096', genero:'M', avatar:null };
const STORAGE_KEY = {
  consentimento: 'lgpd:consentimento',
  uuid:          'lgpd:uuid',
  waCredId:      'wa:credId',
  waRpId:        'wa:rpId',
};

// ══════════════════════════════════════════════
export default function App() {
  // Auth
  const { auth, login, logout, changePassword, hasRole, authHeader } = useAuth();

  // Enquete
  const enquete = useEnquete(authHeader);

  // Navegação
  const [aba, setAba]               = useState<TabId>('votar');
  const [authModal, setAuthModal]   = useState<TabId | null>(null); // aba pedindo auth
  const [animou, setAnimou]         = useState(false);

  // Plataforma
  const [plataforma] = useState(detectarPlataforma);

  // LGPD
  const [consentimento, setConsentimento] = useState<ConsentimentoStatus>(null);
  const [showPolitica, setShowPolitica]   = useState(false);

  // Identidades
  const [uuid,     setUuid]     = useState<string | null>(null);
  const [publicIP, setPublicIP] = useState<string | null>(null);

  // WebAuthn
  const [waStatus,    setWaStatus]    = useState<WaStatus>('pendente');
  const [waCredId,    setWaCredId]    = useState<string | null>(null);
  const [waRpId,      setWaRpId]      = useState<string | null>(null);
  const [criandoCred, setCriandoCred] = useState(false);

  // Votação
  const [selecionado,  setSelecionado]  = useState<number | null>(null);
  const [jaVotou,      setJaVotou]      = useState(false);
  const [bloqueio,     setBloqueio]     = useState<BloqueioInfo | null>(null);
  const [confirmando,  setConfirmando]  = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);

  // CRUD form
  const [showForm,    setShowForm]    = useState(false);
  const [formData,    setFormData]    = useState({ numero:'', nome:'', partido:'', genero:'M' as 'M'|'F', cor:CORES_PRESET[0] });
  const [formErro,    setFormErro]    = useState('');
  const [editandoId,  setEditandoId]  = useState<number | null>(null);
  const [editData,    setEditData]    = useState<Partial<Candidato>>({});
  const [removendoId, setRemovendoId] = useState<number | null>(null);

  // Som
  const [somVoto, setSomVoto] = useState<string | null>(null);
  const somRef = useRef<HTMLInputElement>(null);

  // SeletorCargo
  const [editandoPergunta, setEditandoPergunta] = useState(false);
  const [perguntaTemp,     setPerguntaTemp]     = useState('');

  // Troca de senha modal
  const [showTrocaSenha,    setShowTrocaSenha]    = useState(false);
  const [trocaRole,         setTrocaRole]         = useState<Role>('admin');
  const [trocaSenhaAtual,   setTrocaSenhaAtual]   = useState('');
  const [trocaSenhaNova,    setTrocaSenhaNova]     = useState('');
  const [trocaSenhaConfirm, setTrocaSenhaConfirm] = useState('');
  const [trocaErro,         setTrocaErro]         = useState('');
  const [trocaOk,           setTrocaOk]           = useState('');

  const cargoAtivo = CARGOS_ELETIVOS.find(c => c.id === enquete.config.cargoId) ?? CARGOS_ELETIVOS[1];
  const perguntaFinal = enquete.config.perguntaCustom || cargoAtivo.pergunta;
  const todos = [...enquete.candidatos, BRANCO_NULO];
  const totalVotos = Object.values(enquete.votos).reduce((a, b) => a + b, 0);
  const ranking = [...todos].sort((a, b) => (enquete.votos[b.numero] ?? 0) - (enquete.votos[a.numero] ?? 0));

  // ── Init ──────────────────────────────────────
  useEffect(() => {
    setAnimou(true);
    enquete.loadPublic();
    const c = localStorage.getItem(STORAGE_KEY.consentimento) as ConsentimentoStatus;
    if (c === 'aceito')   { setConsentimento('aceito');   iniciarAposConsentimento(); }
    if (c === 'recusado') { setConsentimento('recusado'); }
  }, []);

  // ── Navegação com guarda ──────────────────────
  function navegarPara(tabId: TabId) {
    const tabConfig = ABAS.find(t => t.id === tabId)!;
    if (tabConfig.protegida && !hasRole(tabConfig.roleMinima ?? 'admin')) {
      setAuthModal(tabId);
      return;
    }
    setAba(tabId);
    setAuthModal(null);
  }

  async function handleLogin(role: Role, password: string) {
    await login(role, password);
    if (authModal) setAba(authModal);
    setAuthModal(null);
  }

  // ── LGPD ─────────────────────────────────────
  async function iniciarAposConsentimento() {
    let token = localStorage.getItem(STORAGE_KEY.uuid);
    if (!token) { token = gerarUUID(); localStorage.setItem(STORAGE_KEY.uuid, token); }
    setUuid(token);
    const ip = await getPublicIP(); setPublicIP(ip);
    const savedCred  = localStorage.getItem(STORAGE_KEY.waCredId);
    const savedRpId  = localStorage.getItem(STORAGE_KEY.waRpId);
    const waDisp     = await webAuthnPlataformaDisponivel();
    if (savedCred && savedRpId) { setWaCredId(savedCred); setWaRpId(savedRpId); setWaStatus('ativo'); }
    else if (!waDisp) setWaStatus('indisponivel');
    // Verifica duplicidade no backend
    if (token || ip) {
      // Checa duplicidade SEM registrar voto (endpoint dedicado)
      const dup = await enquete.checarDuplicidade(token, savedCred?.slice(0, 32) ?? null, ip ? sanitizeIP(ip) : null);
      if (dup.duplicado) {
        setBloqueio({ motivo: dup.motivo ?? 'Identificador já utilizado', icone:'🚫', detalhes:'Voto já registrado para este identificador.' });
        setJaVotou(true);
      }
    }
  }

  async function aceitarConsentimento() {
    localStorage.setItem(STORAGE_KEY.consentimento, 'aceito');
    setConsentimento('aceito');
    await iniciarAposConsentimento();
  }

  async function recusarConsentimento() {
    localStorage.setItem(STORAGE_KEY.consentimento, 'recusado');
    setConsentimento('recusado');
  }

  async function revogarConsentimento() {
    if (!confirm('Deseja revogar seu consentimento?\n\nSeus dados (UUID e credencial WebAuthn) serão excluídos.')) return;
    [STORAGE_KEY.uuid, STORAGE_KEY.consentimento, STORAGE_KEY.waCredId, STORAGE_KEY.waRpId]
      .forEach(k => localStorage.removeItem(k));
    setConsentimento(null); setUuid(null); setPublicIP(null);
    setWaCredId(null); setWaStatus('pendente'); setJaVotou(false); setBloqueio(null);
  }

  // ── WebAuthn ──────────────────────────────────
  async function criarCredencialWebAuthn() {
    setCriandoCred(true); setWaStatus('criando');
    try {
      const r = await webAuthnCriarCredencial();
      if (r) {
        localStorage.setItem(STORAGE_KEY.waCredId, r.credId);
        localStorage.setItem(STORAGE_KEY.waRpId, r.rpId);
        setWaCredId(r.credId); setWaRpId(r.rpId); setWaStatus('ativo');
      } else setWaStatus('negado');
    } catch { setWaStatus('negado'); }
    setCriandoCred(false);
  }

  // ── Registrar voto ────────────────────────────
  async function registrarVoto() {
    if (selecionado === null || jaVotou || consentimento !== 'aceito') return;
    if (waCredId && waRpId) {
      const ok = await webAuthnVerificarCredencial(waCredId, waRpId);
      if (!ok) { alert('⚠️ Verificação de hardware falhou.'); return; }
    }
    const result = await enquete.registrarVoto(
      selecionado,
      uuid,
      waCredId?.slice(0, 32) ?? null,
      publicIP ? sanitizeIP(publicIP) : null
    );
    if (result.ok) {
      setJaVotou(true); setConfirmando(false);
      setShowConfetti(true); navegarPara('resultado');
      setTimeout(() => setShowConfetti(false), 2500);
      if (somVoto) { try { const a = new Audio(somVoto); a.volume = 0.8; await a.play(); } catch {} }
    } else {
      setBloqueio({ motivo: result.motivo ?? 'Erro', icone:'🚫', detalhes: result.motivo ?? '' });
      setJaVotou(true);
    }
  }

  // ── Candidatos CRUD ───────────────────────────
  async function adicionarCandidato() {
    setFormErro('');
    const num = parseInt(formData.numero);
    if (!formData.nome.trim())       return setFormErro('Nome obrigatório.');
    if (isNaN(num)||num<1||num>99)   return setFormErro('Número deve ser 1–99.');
    if (enquete.candidatos.some(c => c.numero === num)) return setFormErro(`Número ${num} já em uso.`);
    if (!formData.partido.trim())    return setFormErro('Partido obrigatório.');
    try {
      await enquete.adicionarCandidato({ numero:num, nome:formData.nome.trim(), partido:formData.partido.trim().toUpperCase(), cor:formData.cor, genero:formData.genero, avatar:null });
      setFormData({ numero:'', nome:'', partido:'', genero:'M', cor:CORES_PRESET[enquete.candidatos.length % CORES_PRESET.length] });
      setShowForm(false);
    } catch (e: unknown) {
      setFormErro((e as Error).message ?? 'Erro ao adicionar');
    }
  }

  async function salvarEdicao() {
    if (editandoId === null) return;
    const num = parseInt(String(editData.numero));
    if (!editData.nome?.trim() || isNaN(num) || num < 1 || num > 99) return;
    if (enquete.candidatos.some(c => c.numero === num && c.id !== editandoId)) return;
    await enquete.atualizarCandidato(editandoId, { ...editData, numero:num, partido:editData.partido?.toUpperCase() });
    setEditandoId(null);
  }

  async function removerCandidato(id: number) {
    await enquete.removerCandidato(id);
    setRemovendoId(null);
    if (editandoId === id) setEditandoId(null);
  }

  async function atualizarConfig(nova: EnqueteConfig) {
    await enquete.atualizarConfig(nova);
  }

  async function handleTrocaSenha(e: React.FormEvent) {
    e.preventDefault();
    setTrocaErro(''); setTrocaOk('');
    if (trocaSenhaNova !== trocaSenhaConfirm) return setTrocaErro('As senhas não coincidem.');
    if (trocaSenhaNova.length < 8) return setTrocaErro('Nova senha deve ter no mínimo 8 caracteres.');
    try {
      await changePassword(trocaRole, trocaSenhaAtual, trocaSenhaNova);
      setTrocaOk(`Senha de ${trocaRole} alterada com sucesso!`);
      setTrocaSenhaAtual(''); setTrocaSenhaNova(''); setTrocaSenhaConfirm('');
    } catch { setTrocaErro('Senha atual incorreta ou erro inesperado.'); }
  }

  // ══════════════════════════════════════════════
  // RENDERS DAS ABAS
  // ══════════════════════════════════════════════

  function renderVotar() {
    if (jaVotou) return (
      <div style={{ background:bloqueio?'#1a0a08':'#0a2a1a', border:`1px solid ${bloqueio?'#7f1d1d':'#22543d'}`, borderRadius:16, padding:32, textAlign:'center' }}>
        {bloqueio ? (
          <><div style={{fontSize:44,marginBottom:12}}>{bloqueio.icone}</div>
          <h2 style={{color:'#f87171',margin:'0 0 8px'}}>Voto Duplicado Bloqueado</h2>
          <p style={{color:'#7f1d1d',marginBottom:4,fontWeight:600}}>Critério: {bloqueio.motivo}</p>
          <p style={{color:'#6b2222',fontSize:13,margin:0}}>{bloqueio.detalhes}</p></>
        ) : (
          <><div style={{display:'flex',justifyContent:'center',marginBottom:14}}>
            <Avatar c={todos.find(c=>c.numero===selecionado)??BRANCO_NULO} size={80}/>
          </div>
          <div style={{fontSize:32,marginBottom:10}}>✅</div>
          <h2 style={{color:'#68d391',margin:'0 0 8px',fontSize:22}}>Voto Registrado!</h2>
          <p style={{color:'#276749',margin:'0 0 20px'}}>Você votou em <strong style={{color:'#9ae6b4'}}>{todos.find(c=>c.numero===selecionado)?.nome}</strong></p>
          <button onClick={()=>navegarPara('resultado')} style={{background:'linear-gradient(135deg,#276749,#38a169)',color:'#fff',border:'none',borderRadius:10,padding:'12px 28px',fontSize:15,fontWeight:700,cursor:'pointer'}}>Ver resultados →</button></>
        )}
      </div>
    );

    if (consentimento === null) return (
      <div style={{ background:'#0a1422', border:'1px solid #1e3a60', borderRadius:16, padding:40, textAlign:'center' }}>
        <div style={{fontSize:40,marginBottom:14}}>🍪</div>
        <h3 style={{color:'#93c5fd',margin:'0 0 10px'}}>Consentimento necessário</h3>
        <p style={{color:'#4a6080',fontSize:14,margin:'0 0 20px',lineHeight:1.6}}>Para participar, precisamos do seu consentimento conforme a LGPD/GDPR.</p>
        <button onClick={aceitarConsentimento} style={{padding:'12px 28px',background:'linear-gradient(135deg,#1d4ed8,#3b82f6)',border:'none',borderRadius:10,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer'}}>Aceitar e participar</button>
        <button onClick={()=>setShowPolitica(true)} style={{display:'block',margin:'10px auto 0',background:'none',border:'none',color:'#3a5a80',fontSize:12,cursor:'pointer',textDecoration:'underline'}}>Ver política de privacidade</button>
      </div>
    );

    if (consentimento === 'recusado') return (
      <div style={{ background:'#1a1008', border:'1px solid #92400e44', borderRadius:16, padding:40, textAlign:'center' }}>
        <div style={{fontSize:40,marginBottom:14}}>⚠️</div>
        <h3 style={{color:'#d97706',margin:'0 0 10px'}}>Sem consentimento</h3>
        <button onClick={aceitarConsentimento} style={{padding:'12px 28px',background:'#1d4ed8',border:'none',borderRadius:10,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer'}}>Aceitar e participar</button>
      </div>
    );

    if (enquete.candidatos.length === 0) return (
      <div style={{ background:'#0d1a2e', border:'1px solid #1e3a60', borderRadius:16, padding:48, textAlign:'center' }}>
        <div style={{fontSize:48,marginBottom:12}}>👤</div>
        <div style={{color:'#4a6080',fontSize:16}}>Nenhum candidato cadastrado.</div>
      </div>
    );

    const candConf = todos.find(c => c.numero === selecionado);
    return (
      <div>
        <div style={{ display:'grid', gap:9, marginBottom:16 }}>
          {enquete.candidatos.map((c, i) => {
            const sel = selecionado === c.numero;
            return (
              <div key={c.id} onClick={() => { setSelecionado(c.numero); setConfirmando(false); }}
                style={{ background:sel?`${c.cor}12`:'#0d1a2e', border:`2px solid ${sel?c.cor:'#1e3a60'}`,
                  borderRadius:14, padding:'13px 16px', cursor:'pointer', display:'flex',
                  alignItems:'center', gap:14, transition:'all 0.22s', boxShadow:sel?`0 0 20px ${c.cor}28`:'none',
                  animation:`slideIn 0.4s ease ${i*0.06}s both` }}>
                <Avatar c={c} size={54}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
                    <span style={{color:sel?'#fff':'#c8d8f0',fontWeight:700,fontSize:15}}>{c.nome}</span>
                    <span style={{background:`${c.cor}22`,border:`1px solid ${c.cor}44`,borderRadius:5,padding:'1px 8px',fontSize:11,color:c.cor,fontWeight:700,letterSpacing:1}}>{c.partido}</span>
                    <span style={{fontSize:11,color:c.genero==='F'?'#db2777':'#3b82f6'}}>{c.genero==='F'?'♀':'♂'}</span>
                  </div>
                  <div style={{color:'#2a4a70',fontSize:12,marginTop:2}}>Nº {c.numero}</div>
                </div>
                <div style={{width:22,height:22,borderRadius:'50%',border:`2px solid ${sel?c.cor:'#2d4a70'}`,background:sel?c.cor:'transparent',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.2s'}}>
                  {sel && <span style={{color:'#fff',fontSize:12}}>✓</span>}
                </div>
              </div>
            );
          })}
          <div onClick={() => { setSelecionado(0); setConfirmando(false); }}
            style={{ background:selecionado===0?'#16202f':'#080f1c', border:`2px dashed ${selecionado===0?'#718096':'#1e3a60'}`, borderRadius:13, padding:'13px 16px', cursor:'pointer', display:'flex', alignItems:'center', gap:14, transition:'all 0.2s' }}>
            <div style={{width:54,height:54,borderRadius:'50%',background:'#111827',border:'2px dashed #374151',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20}}>✖️</div>
            <span style={{color:'#718096',fontWeight:500}}>Voto em Branco / Nulo</span>
            {selecionado === 0 && <span style={{marginLeft:'auto',color:'#718096'}}>✓</span>}
          </div>
        </div>

        {selecionado !== null && !confirmando && (
          <button onClick={() => setConfirmando(true)} style={{width:'100%',padding:15,background:'linear-gradient(135deg,#1d4ed8,#3b82f6)',color:'#fff',border:'none',borderRadius:12,fontSize:16,fontWeight:700,cursor:'pointer',boxShadow:'0 4px 20px #3b82f644'}}>Confirmar voto →</button>
        )}

        {confirmando && candConf && (
          <div style={{ background:'#0a1a30', border:'1px solid #1e3a60', borderRadius:14, padding:24, textAlign:'center' }}>
            <div style={{display:'flex',justifyContent:'center',marginBottom:14}}><Avatar c={candConf} size={72}/></div>
            <p style={{color:'#93c5fd',margin:'0 0 5px',fontWeight:600}}>Confirmar voto em <strong style={{color:'#fff'}}>{candConf.nome}</strong>?</p>
            {waCredId && <p style={{color:'#6366f1',fontSize:12,margin:'0 0 8px'}}>⚡ A verificação de hardware será solicitada.</p>}
            <p style={{color:'#2d4a70',fontSize:12,margin:'0 0 16px'}}>⚠️ Ação irreversível. 1 voto por dispositivo/rede.</p>
            <div style={{display:'flex',gap:10}}>
              <button onClick={() => setConfirmando(false)} style={{flex:1,padding:11,background:'transparent',border:'1px solid #2d4a70',borderRadius:10,color:'#64748b',fontSize:14,cursor:'pointer'}}>Cancelar</button>
              <button onClick={registrarVoto} style={{flex:1,padding:11,background:'linear-gradient(135deg,#1d4ed8,#3b82f6)',border:'none',borderRadius:10,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>✅ Confirmar</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderResultado() {
    const lider = ranking[0];
    return (
      <div>
        {totalVotos === 0 ? (
          <div style={{ background:'#0d1a2e', border:'1px solid #1e3a60', borderRadius:16, padding:48, textAlign:'center' }}>
            <div style={{fontSize:48,marginBottom:12}}>🗳️</div>
            <div style={{color:'#4a6080',fontSize:16}}>Nenhum voto registrado ainda.</div>
          </div>
        ) : (
          <>
            <div style={{ background:`linear-gradient(135deg,${lider.cor}18,${lider.cor}08)`, border:`1px solid ${lider.cor}44`, borderRadius:16, padding:'18px 22px', marginBottom:18, display:'flex', alignItems:'center', gap:16 }}>
              <div style={{position:'relative'}}><Avatar c={lider} size={70}/><div style={{position:'absolute',top:-8,right:-8,fontSize:20}}>🏆</div></div>
              <div>
                <div style={{color:'#6b7280',fontSize:11,letterSpacing:2,fontWeight:600}}>LIDERANDO</div>
                <div style={{color:'#fff',fontWeight:800,fontSize:19}}>{lider.nome}</div>
                <div style={{color:lider.cor,fontWeight:700,fontSize:24}}>{(((enquete.votos[lider.numero]??0)/totalVotos)*100).toFixed(1)}%</div>
              </div>
              <div style={{marginLeft:'auto',textAlign:'right'}}>
                <div style={{color:'#3a5070',fontSize:11}}>Total</div>
                <div style={{color:'#60a5fa',fontWeight:700,fontSize:22}}>{totalVotos.toLocaleString('pt-BR')}</div>
                <div style={{color:'#2d4a70',fontSize:11}}>votos</div>
              </div>
            </div>
            <div style={{ background:'#0d1a2e', border:'1px solid #1e3a60', borderRadius:16, padding:22 }}>
              <h3 style={{color:'#93c5fd',margin:'0 0 20px',fontSize:13,letterSpacing:2}}>📊 DISTRIBUIÇÃO DOS VOTOS</h3>
              {ranking.map((c, i) => {
                const v = enquete.votos[c.numero] ?? 0;
                const pct = totalVotos > 0 ? (v / totalVotos) * 100 : 0;
                return (
                  <div key={c.id ?? 'bn'} style={{marginBottom:18}}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:7}}>
                      <Avatar c={c} size={38}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                          <span style={{color:'#c8d8f0',fontWeight:700,fontSize:14}}>{c.nome}</span>
                          <span style={{background:`${c.cor}22`,border:`1px solid ${c.cor}44`,borderRadius:4,padding:'1px 6px',fontSize:10,color:c.cor,fontWeight:700,letterSpacing:1}}>{c.partido}</span>
                          {i === 0 && v > 0 && <span>👑</span>}
                        </div>
                      </div>
                      <div style={{textAlign:'right',flexShrink:0}}>
                        <div style={{color:c.cor,fontWeight:700,fontSize:16}}>{pct.toFixed(1)}%</div>
                        <div style={{color:'#2a4060',fontSize:11}}>{v.toLocaleString('pt-BR')} votos</div>
                      </div>
                    </div>
                    <div style={{height:8}}><Bar pct={pct} cor={c.cor} delay={i*100}/></div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {auth?.role === 'superuser' && (
          <button onClick={()=>{ if(confirm('Zerar TODOS os votos? Esta ação é irreversível.')) enquete.zerarVotos(); }}
            style={{marginTop:16,width:'100%',padding:11,background:'transparent',border:'1px solid #7f1d1d',borderRadius:10,color:'#f87171',fontSize:13,cursor:'pointer'}}>
            🗑️ Zerar todos os votos (superuser)
          </button>
        )}
        <p style={{color:'#1e3050',fontSize:11,textAlign:'center',marginTop:14}}>Enquete não científica · Dados meramente ilustrativos</p>
      </div>
    );
  }

  function renderCandidatos() {
    return (
      <div style={{display:'grid',gap:14}}>
        <button onClick={()=>{setShowForm(f=>!f);setFormErro('');}}
          style={{width:'100%',padding:13,background:showForm?'#1a0d2e':'linear-gradient(135deg,#1d4ed8,#3b82f6)',border:showForm?'1px solid #4a2080':'none',borderRadius:12,color:'#fff',fontSize:15,fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:8}}>
          {showForm ? '✕ Cancelar' : '➕ Adicionar novo candidato'}
        </button>

        {showForm && (
          <div style={{background:'#0d1a2e',border:'1px solid #1e3a60',borderRadius:16,padding:22,animation:'fadeIn 0.25s ease'}}>
            <h3 style={{color:'#93c5fd',margin:'0 0 18px',fontSize:15}}>👤 Novo Candidato</h3>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0 14px'}}>
              <div style={{gridColumn:'1/-1'}}><Field label="NOME COMPLETO"><input style={INP} value={formData.nome} onChange={e=>setFormData(d=>({...d,nome:e.target.value}))} placeholder="Ex: José da Silva"/></Field></div>
              <Field label="NÚMERO" hint="1 a 99"><input style={INP} type="number" min={1} max={99} value={formData.numero} onChange={e=>setFormData(d=>({...d,numero:e.target.value}))} placeholder="Ex: 13"/></Field>
              <Field label="PARTIDO"><input style={INP} value={formData.partido} onChange={e=>setFormData(d=>({...d,partido:e.target.value}))} placeholder="Ex: PT"/></Field>
              <Field label="GÊNERO"><div style={{display:'flex',gap:8}}>{(['M','F'] as const).map(v=><button key={v} onClick={()=>setFormData(d=>({...d,genero:v}))} style={{flex:1,padding:10,background:formData.genero===v?(v==='F'?'#831843':'#1e3a7a'):'#060c1a',border:`1px solid ${formData.genero===v?(v==='F'?'#db2777':'#3b82f6'):'#1e3a60'}`,borderRadius:8,color:formData.genero===v?(v==='F'?'#f9a8d4':'#93c5fd'):'#4a6080',fontSize:13,fontWeight:formData.genero===v?700:400,cursor:'pointer'}}>{v==='F'?'♀ Fem.':'♂ Masc.'}</button>)}</div></Field>
              <div style={{gridColumn:'1/-1'}}><Field label="COR"><div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>{CORES_PRESET.map(cor=><div key={cor} onClick={()=>setFormData(d=>({...d,cor}))} style={{width:28,height:28,borderRadius:'50%',background:cor,cursor:'pointer',border:`3px solid ${formData.cor===cor?'#fff':'transparent'}`,boxShadow:formData.cor===cor?`0 0 10px ${cor}88`:'none',transition:'all 0.15s'}}/>)}<input type="color" value={formData.cor} onChange={e=>setFormData(d=>({...d,cor:e.target.value}))} style={{width:32,height:32,borderRadius:'50%',border:'2px solid #1e3a60',padding:0,cursor:'pointer',background:'none'}}/></div></Field></div>
            </div>
            <div style={{background:'#060c1a',border:'1px solid #1a3050',borderRadius:10,padding:'12px 16px',marginBottom:14,display:'flex',alignItems:'center',gap:12}}>
              <Avatar c={{...formData,numero:parseInt(formData.numero)||99,id:-1,avatar:null}} size={52}/>
              <div>
                <div style={{color:'#c8d8f0',fontWeight:700,fontSize:15}}>{formData.nome||'Nome do candidato'}</div>
                <div style={{display:'flex',gap:8,marginTop:4,alignItems:'center'}}>{formData.partido&&<span style={{background:`${formData.cor}22`,border:`1px solid ${formData.cor}44`,borderRadius:5,padding:'1px 8px',fontSize:11,color:formData.cor,fontWeight:700}}>{formData.partido.toUpperCase()}</span>}<span style={{color:'#3a5070',fontSize:12}}>Nº {formData.numero||'?'}</span></div>
              </div>
            </div>
            {formErro && <div style={{background:'#1a0808',border:'1px solid #7f1d1d',borderRadius:8,padding:'10px 14px',color:'#f87171',fontSize:13,marginBottom:12}}>⚠️ {formErro}</div>}
            <button onClick={adicionarCandidato} style={{width:'100%',padding:13,background:`linear-gradient(135deg,${formData.cor}cc,${formData.cor})`,color:'#fff',border:'none',borderRadius:10,fontSize:15,fontWeight:700,cursor:'pointer'}}>✅ Adicionar candidato</button>
          </div>
        )}

        <div style={{background:'#0d1a2e',border:'1px solid #1e3a60',borderRadius:16,padding:22}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
            <h3 style={{color:'#93c5fd',margin:0,fontSize:15}}>📋 Candidatos cadastrados</h3>
            <span style={{background:'#1e3a60',borderRadius:99,padding:'3px 12px',fontSize:12,color:'#60a5fa',fontWeight:700}}>{enquete.candidatos.length}</span>
          </div>
          {enquete.candidatos.length === 0 ? <div style={{textAlign:'center',padding:24,color:'#2d4a70'}}>Nenhum candidato ainda.</div> : (
            <div style={{display:'grid',gap:10}}>
              {enquete.candidatos.map((c, i) => {
                if (editandoId === c.id) return (
                  <div key={c.id} style={{background:'#0a1728',border:`2px solid ${editData.cor??c.cor}`,borderRadius:14,padding:16,animation:'fadeIn 0.2s ease'}}>
                    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:14}}>
                      <Avatar c={{...c,...editData,numero:parseInt(String(editData.numero??c.numero))||c.numero}} size={50}/>
                      <div style={{color:'#93c5fd',fontWeight:700,fontSize:14}}>Editando candidato</div>
                      <button onClick={()=>setEditandoId(null)} style={{marginLeft:'auto',background:'transparent',border:'none',color:'#4a6080',cursor:'pointer',fontSize:18,lineHeight:1}}>✕</button>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px 14px'}}>
                      <div style={{gridColumn:'1/-1'}}><Field label="NOME"><input style={INP} value={String(editData.nome??'')} onChange={e=>setEditData(d=>({...d,nome:e.target.value}))}/></Field></div>
                      <Field label="NÚMERO"><input style={INP} type="number" min={1} max={99} value={String(editData.numero??'')} onChange={e=>setEditData(d=>({...d,numero:e.target.value as unknown as number}))}/></Field>
                      <Field label="PARTIDO"><input style={INP} value={String(editData.partido??'')} onChange={e=>setEditData(d=>({...d,partido:e.target.value}))}/></Field>
                      <Field label="GÊNERO"><div style={{display:'flex',gap:8}}>{(['M','F'] as const).map(v=><button key={v} onClick={()=>setEditData(d=>({...d,genero:v}))} style={{flex:1,padding:9,background:(editData.genero??c.genero)===v?(v==='F'?'#831843':'#1e3a7a'):'#060c1a',border:`1px solid ${(editData.genero??c.genero)===v?(v==='F'?'#db2777':'#3b82f6'):'#1e3a60'}`,borderRadius:7,color:(editData.genero??c.genero)===v?'#fff':'#4a6080',fontSize:13,fontWeight:700,cursor:'pointer'}}>{v==='F'?'♀':'♂'} {v}</button>)}</div></Field>
                      <div style={{gridColumn:'1/-1'}}><Field label="COR"><div style={{display:'flex',gap:7,flexWrap:'wrap',alignItems:'center'}}>{CORES_PRESET.map(cor=><div key={cor} onClick={()=>setEditData(d=>({...d,cor}))} style={{width:26,height:26,borderRadius:'50%',background:cor,cursor:'pointer',border:`3px solid ${(editData.cor??c.cor)===cor?'#fff':'transparent'}`,boxShadow:(editData.cor??c.cor)===cor?`0 0 8px ${cor}88`:'none',transition:'all 0.15s'}}/>)}</div></Field></div>
                    </div>
                    <div style={{display:'flex',gap:10,marginTop:6}}>
                      <button onClick={()=>setEditandoId(null)} style={{flex:1,padding:10,background:'transparent',border:'1px solid #2d4a70',borderRadius:9,color:'#64748b',fontSize:14,cursor:'pointer'}}>Cancelar</button>
                      <button onClick={salvarEdicao} style={{flex:2,padding:10,background:`linear-gradient(135deg,${editData.cor??c.cor}cc,${editData.cor??c.cor})`,border:'none',borderRadius:9,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>💾 Salvar</button>
                    </div>
                  </div>
                );
                if (removendoId === c.id) return (
                  <div key={c.id} style={{background:'#1a0808',border:'2px solid #7f1d1d',borderRadius:14,padding:16,animation:'fadeIn 0.2s ease'}}>
                    <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:12}}>
                      <Avatar c={c} size={46}/>
                      <div><div style={{color:'#f87171',fontWeight:700,fontSize:14}}>Remover candidato?</div><div style={{color:'#6b2222',fontSize:13}}>{c.nome} ({c.partido})</div></div>
                    </div>
                    <div style={{display:'flex',gap:10}}>
                      <button onClick={()=>setRemovendoId(null)} style={{flex:1,padding:10,background:'transparent',border:'1px solid #2d4a70',borderRadius:9,color:'#64748b',fontSize:14,cursor:'pointer'}}>Cancelar</button>
                      <button onClick={()=>removerCandidato(c.id)} style={{flex:1,padding:10,background:'#7f1d1d',border:'none',borderRadius:9,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>🗑️ Remover</button>
                    </div>
                  </div>
                );
                return (
                  <div key={c.id} style={{background:'#060f1e',border:'1px solid #1a3050',borderRadius:12,padding:'12px 14px',display:'flex',alignItems:'center',gap:12,animation:`slideIn 0.35s ease ${i*0.05}s both`}}>
                    <Avatar c={c} size={48}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
                        <span style={{color:'#c8d8f0',fontWeight:700,fontSize:14}}>{c.nome}</span>
                        <span style={{background:`${c.cor}22`,border:`1px solid ${c.cor}44`,borderRadius:4,padding:'1px 7px',fontSize:10,color:c.cor,fontWeight:700,letterSpacing:1}}>{c.partido}</span>
                        <span style={{fontSize:11,color:c.genero==='F'?'#db2777':'#3b82f6'}}>{c.genero==='F'?'♀':'♂'}</span>
                      </div>
                      <div style={{color:'#2a4060',fontSize:12,marginTop:2}}>Nº {c.numero} · {enquete.votos[c.numero]??0} voto{(enquete.votos[c.numero]??0)!==1?'s':''}</div>
                    </div>
                    <div style={{display:'flex',gap:6}}>
                      <button onClick={()=>{setEditandoId(c.id);setEditData({nome:c.nome,partido:c.partido,numero:c.numero,genero:c.genero,cor:c.cor});setRemovendoId(null);}} style={{width:34,height:34,borderRadius:8,background:'#0a1e40',border:'1px solid #1e3a60',color:'#60a5fa',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✏️</button>
                      <button onClick={()=>{setRemovendoId(c.id);setEditandoId(null);}} style={{width:34,height:34,borderRadius:8,background:'#1a0808',border:'1px solid #7f1d1d44',color:'#f87171',fontSize:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>🗑️</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderAvatares() {
    return (
      <div style={{background:'#0d1a2e',border:'1px solid #1e3a60',borderRadius:16,padding:26}}>
        <h3 style={{color:'#93c5fd',margin:'0 0 6px',fontSize:15}}>🖼️ Gerenciar Avatares</h3>
        <p style={{color:'#4a6080',fontSize:13,margin:'0 0 24px',lineHeight:1.6}}>Clique em <strong style={{color:'#60a5fa'}}>📷</strong> para upload. Sem foto, silhueta por gênero.</p>
        {enquete.candidatos.length === 0 ? <div style={{textAlign:'center',padding:24,color:'#2d4a70'}}>Adicione candidatos primeiro.</div> : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(110px,1fr))',gap:22}}>
            {enquete.candidatos.map(c => (
              <div key={c.id} style={{textAlign:'center'}}>
                <div style={{display:'flex',justifyContent:'center',marginBottom:10}}>
                  <Avatar c={c} size={76} showUpload onUpload={d=>enquete.atualizarCandidato(c.id,{avatar:d})}/>
                </div>
                <div style={{color:'#c8d8f0',fontWeight:700,fontSize:12,lineHeight:1.3}}>{c.nome}</div>
                <div style={{fontSize:11,color:c.genero==='F'?'#db2777':'#3b82f6',marginTop:3}}>{c.genero==='F'?'♀ Feminino':'♂ Masculino'}</div>
                <div style={{display:'inline-block',marginTop:5,background:`${c.cor}22`,border:`1px solid ${c.cor}44`,borderRadius:5,padding:'2px 8px',fontSize:10,color:c.cor,fontWeight:700,letterSpacing:1}}>{c.partido}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderConfig() {
    const cfg = enquete.config;
    const waStatusLabel: Record<WaStatus,string> = { ativo:'✅ Ativo',pendente:'⏳ Pendente',criando:'⏳ Criando…',negado:'❌ Negado',indisponivel:'⚫ Indisponível' };
    return (
      <div style={{display:'grid',gap:16}}>
        {/* ── ENQUETE ── */}
        <div style={{background:'#0d1a2e',border:`2px solid ${cargoAtivo.cor}44`,borderRadius:16,padding:22}}>
          <h3 style={{color:'#93c5fd',margin:'0 0 18px',fontSize:15}}>🗳️ Configurar Enquete</h3>
          {/* Cargos */}
          <div style={{marginBottom:16}}>
            <div style={{color:'#64748b',fontSize:11,letterSpacing:'1.5px',fontWeight:700,marginBottom:10}}>CARGO ELETIVO</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(140px,1fr))',gap:8}}>
              {CARGOS_ELETIVOS.map(c=>{const ativo=cfg.cargoId===c.id;return(
                <button key={c.id} onClick={()=>atualizarConfig({...cfg,cargoId:c.id,perguntaCustom:''})}
                  style={{padding:'12px 10px',background:ativo?`${c.cor}18`:'#060c1a',border:`2px solid ${ativo?c.cor:'#1e3a60'}`,borderRadius:12,cursor:'pointer',textAlign:'left',boxShadow:ativo?`0 0 16px ${c.cor}30`:'none'}}>
                  <div style={{fontSize:22,marginBottom:6}}>{c.icone}</div>
                  <div style={{color:ativo?'#fff':'#94a3b8',fontWeight:ativo?700:500,fontSize:12,marginBottom:5}}>{c.cargo}</div>
                  <span style={{background:ativo?`${c.cor}33`:'#0d1a2e',border:`1px solid ${ativo?c.cor+'55':'#1e3a60'}`,borderRadius:4,padding:'1px 7px',fontSize:10,color:ativo?c.cor:'#3a5070',fontWeight:600}}>{c.ambito}</span>
                </button>
              );})}
            </div>
          </div>
          {/* Local */}
          <Field label={`${cargoAtivo.abrangencia.toUpperCase()} (OPCIONAL)`} hint={cargoAtivo.hint}>
            <input style={INP} value={cfg.localNome} onChange={e=>atualizarConfig({...cfg,localNome:e.target.value})} placeholder={`Nome d${cargoAtivo.abrangencia==='Estado'?'o':'o'} ${cargoAtivo.abrangencia.toLowerCase()}…`}/>
          </Field>
          {/* Pergunta */}
          <div style={{marginBottom:14}}>
            <div style={{color:'#64748b',fontSize:11,letterSpacing:'1.5px',fontWeight:700,marginBottom:8}}>PERGUNTA</div>
            {editandoPergunta ? (
              <div style={{display:'grid',gap:8}}>
                <input style={{...INP,fontSize:15}} value={perguntaTemp} onChange={e=>setPerguntaTemp(e.target.value)} placeholder={cargoAtivo.pergunta} autoFocus/>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={()=>{atualizarConfig({...cfg,perguntaCustom:perguntaTemp||''});setEditandoPergunta(false);}} style={{flex:2,padding:9,background:'linear-gradient(135deg,#1d4ed8,#3b82f6)',border:'none',borderRadius:8,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>✅ Salvar</button>
                  <button onClick={()=>setEditandoPergunta(false)} style={{flex:1,padding:9,background:'transparent',border:'1px solid #2d4a70',borderRadius:8,color:'#64748b',fontSize:13,cursor:'pointer'}}>Cancelar</button>
                </div>
                {cfg.perguntaCustom&&<button onClick={()=>{atualizarConfig({...cfg,perguntaCustom:''});setEditandoPergunta(false);}} style={{padding:7,background:'transparent',border:'1px solid #3a1a24',borderRadius:7,color:'#f87171',fontSize:12,cursor:'pointer'}}>↩ Restaurar padrão</button>}
              </div>
            ) : (
              <div style={{background:'#060c1a',border:`2px solid ${cfg.perguntaCustom?'#6366f155':'#1e3a60'}`,borderRadius:10,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer'}} onClick={()=>{setPerguntaTemp(perguntaFinal);setEditandoPergunta(true);}}>
                <div style={{flex:1}}>
                  {cfg.perguntaCustom&&<div style={{color:'#6366f1',fontSize:10,fontWeight:700,letterSpacing:1,marginBottom:4}}>✏️ PERSONALIZADA</div>}
                  <div style={{color:'#e2e8f0',fontSize:15,fontWeight:700,lineHeight:1.4}}>{perguntaFinal}</div>
                  {cfg.localNome&&<div style={{color:cargoAtivo.cor,fontSize:14,fontWeight:600,marginTop:3}}>{cfg.localNome}</div>}
                  <div style={{color:'#2d4a70',fontSize:11,marginTop:5}}>Clique para editar</div>
                </div>
                <div style={{fontSize:20,color:'#3a5a80'}}>✏️</div>
              </div>
            )}
          </div>
          <Field label="SUBTÍTULO OPCIONAL">
            <input style={INP} value={cfg.subtitulo} onChange={e=>atualizarConfig({...cfg,subtitulo:e.target.value})} placeholder="Ex: Eleições 2026 · Enquete não oficial"/>
          </Field>
        </div>

        {/* ── SOM ── */}
        <div style={{background:'#0d1a2e',border:'1px solid #1e3a60',borderRadius:16,padding:22}}>
          <h3 style={{color:'#93c5fd',margin:'0 0 6px',fontSize:15}}>🔊 Som do Voto</h3>
          <p style={{color:'#4a6080',fontSize:13,margin:'0 0 16px'}}>Upload de WAV/MP3. Toca ao confirmar o voto.</p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button onClick={()=>somRef.current?.click()} style={{padding:'10px 18px',background:somVoto?'#14532d':'#1e3a60',border:`1px solid ${somVoto?'#22c55e44':'#2d4a70'}`,borderRadius:9,color:somVoto?'#4ade80':'#93c5fd',fontSize:13,fontWeight:600,cursor:'pointer'}}>{somVoto?'✅ Som carregado — trocar':'📁 Selecionar arquivo de som'}</button>
            {somVoto&&<><button onClick={()=>{try{const a=new Audio(somVoto);a.volume=0.8;a.play();}catch{}}} style={{padding:'10px 18px',background:'#1a2a10',border:'1px solid #22c55e44',borderRadius:9,color:'#4ade80',fontSize:13,fontWeight:600,cursor:'pointer'}}>▶️ Testar</button><button onClick={()=>setSomVoto(null)} style={{padding:'10px 18px',background:'transparent',border:'1px solid #3a1a24',borderRadius:9,color:'#f87171',fontSize:13,cursor:'pointer'}}>✕ Remover</button></>}
          </div>
          <input ref={somRef} type="file" accept="audio/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>setSomVoto(ev.target?.result as string);r.readAsDataURL(f);}}/>
        </div>

        {/* ── HARDWARE ── */}
        <div style={{background:'#0d1a2e',border:'1px solid #1e3a60',borderRadius:16,padding:22}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:8}}>
            <h3 style={{color:'#93c5fd',margin:0,fontSize:15}}>⚡ Proteção de Hardware</h3>
            <span style={{background:'#1a1a3a',border:'1px solid #6366f144',borderRadius:99,padding:'3px 10px',fontSize:11,color:'#818cf8',fontWeight:600}}>{plataforma.icone} {plataforma.nome}</span>
          </div>
          <div style={{display:'grid',gap:10}}>
            {[
              { id:'wa', titulo: plataforma.isIOS?'WebAuthn / Secure Enclave':plataforma.isAndroid?'WebAuthn / TEE·StrongBox':'WebAuthn / TPM', icone:plataforma.icone, nivel:'hardware', status:waStatus, det:waCredId?`${waCredId.slice(0,16)}…`:waStatusLabel[waStatus] },
              { id:'uuid', titulo:'Token UUID', icone:'🔑', nivel:'software', status:uuid?'ativo':'pendente', det:uuid?`${uuid.slice(0,18)}…`:'Gerado após consentimento' },
              { id:'ip', titulo:'Endereço IP', icone:'🌐', nivel:'software', status:publicIP?'ativo':'pendente', det:publicIP||'Coletado após consentimento' },
            ].map(m=>{
              const COR:Record<string,string>={ativo:'#22c55e',pendente:'#f59e0b',criando:'#60a5fa',negado:'#ef4444',indisponivel:'#6b7280'};
              const cor=COR[m.status]??'#6b7280';
              return(
                <div key={m.id} style={{background:'#060f1e',border:`1px solid ${m.status==='ativo'?cor+'44':'#1a3050'}`,borderRadius:10,padding:'12px 14px'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:10}}>
                    <div style={{fontSize:20,flexShrink:0,marginTop:1}}>{m.icone}</div>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap',marginBottom:3}}>
                        <span style={{color:'#c8d8f0',fontWeight:700,fontSize:13}}>{m.titulo}</span>
                        <span style={{background:m.nivel==='hardware'?'#1a1a3a':'#0a2010',border:`1px solid ${m.nivel==='hardware'?'#6366f144':'#22c55e44'}`,borderRadius:99,padding:'1px 8px',fontSize:10,color:m.nivel==='hardware'?'#818cf8':'#4ade80',fontWeight:600}}>{m.nivel==='hardware'?'⚡ Hardware':'🔐 Software'}</span>
                        <span style={{background:cor+'22',border:`1px solid ${cor}44`,borderRadius:99,padding:'1px 7px',fontSize:10,color:cor,fontWeight:600}}>{waStatusLabel[m.status as WaStatus]??m.status}</span>
                      </div>
                      <div style={{color:'#1e3a5a',fontSize:10,fontFamily:'monospace'}}>{m.det}</div>
                    </div>
                  </div>
                  {m.id==='wa'&&waStatus==='pendente'&&!criandoCred&&(
                    <button onClick={criarCredencialWebAuthn} style={{marginTop:10,width:'100%',padding:9,background:'linear-gradient(135deg,#4c1d95,#7c3aed)',border:'none',borderRadius:8,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer'}}>
                      {plataforma.isIOS?'🍎 Autenticar com Face ID / Touch ID':plataforma.isAndroid?'🤖 Autenticar com biometria Android':'💻 Registrar autenticador de hardware'}
                    </button>
                  )}
                  {m.id==='wa'&&criandoCred&&<div style={{marginTop:10,padding:9,background:'#0a1030',border:'1px solid #3b82f644',borderRadius:8,color:'#60a5fa',fontSize:13,textAlign:'center',fontWeight:600}}>⏳ Aguardando autenticação…</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── PRIVACIDADE ── */}
        <div style={{background:'#0d1a2e',border:'1px solid #1e3a60',borderRadius:16,padding:22}}>
          <h3 style={{color:'#93c5fd',margin:'0 0 14px',fontSize:15}}>🔒 Privacidade</h3>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button onClick={()=>setShowPolitica(true)} style={{padding:'10px 16px',background:'#0a1e40',border:'1px solid #1e3a60',borderRadius:9,color:'#93c5fd',fontSize:13,fontWeight:600,cursor:'pointer'}}>📄 Política de Privacidade</button>
            {consentimento==='aceito'&&<button onClick={revogarConsentimento} style={{padding:'10px 16px',background:'transparent',border:'1px solid #7f1d1d',borderRadius:9,color:'#f87171',fontSize:13,cursor:'pointer'}}>🗑️ Revogar consentimento</button>}
            {consentimento!=='aceito'&&<button onClick={aceitarConsentimento} style={{padding:'10px 16px',background:'#1d4ed8',border:'none',borderRadius:9,color:'#fff',fontSize:13,fontWeight:600,cursor:'pointer'}}>✅ Dar consentimento</button>}
          </div>
        </div>

        {/* ── SESSÃO / AUTH ── */}
        <div style={{background:'#0d1a2e',border:'1px solid #1e3a60',borderRadius:16,padding:22}}>
          <h3 style={{color:'#93c5fd',margin:'0 0 14px',fontSize:15}}>🔐 Sessão Administrativa</h3>
          <div style={{background:'#060c1a',borderRadius:8,padding:'10px 14px',marginBottom:14,display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,flexWrap:'wrap'}}>
            <div>
              <div style={{color:'#64748b',fontSize:11,fontWeight:700}}>LOGADO COMO</div>
              <div style={{color:'#c8d8f0',fontSize:14,fontWeight:700,marginTop:2}}>{auth?.role==='superuser'?'👑 Superusuário':'🛡️ Administrador'}</div>
            </div>
            <button onClick={logout} style={{padding:'8px 16px',background:'transparent',border:'1px solid #7f1d1d',borderRadius:8,color:'#f87171',fontSize:13,cursor:'pointer'}}>Encerrar sessão</button>
          </div>
          {/* Troca de senha (superuser pode trocar qualquer uma) */}
          <button onClick={()=>setShowTrocaSenha(t=>!t)} style={{width:'100%',padding:11,background:showTrocaSenha?'#1a0d2e':'#0a1e40',border:'1px solid #1e3a60',borderRadius:9,color:'#93c5fd',fontSize:13,fontWeight:600,cursor:'pointer'}}>
            {showTrocaSenha?'✕ Cancelar':'🔑 Alterar senha'}
          </button>
          {showTrocaSenha&&(
            <form onSubmit={handleTrocaSenha} style={{marginTop:14,display:'grid',gap:12}}>
              {auth?.role==='superuser'&&(
                <Field label="ALTERAR SENHA DE">
                  <div style={{display:'flex',gap:8}}>{(['admin','superuser'] as Role[]).map(r=><button key={r} type="button" onClick={()=>setTrocaRole(r)} style={{flex:1,padding:9,background:trocaRole===r?'#1e3a60':'#060c1a',border:`1px solid ${trocaRole===r?'#3b82f6':'#1e3a60'}`,borderRadius:8,color:trocaRole===r?'#93c5fd':'#4a6080',fontSize:13,fontWeight:trocaRole===r?700:400,cursor:'pointer'}}>{r==='superuser'?'👑 Superusuário':'🛡️ Admin'}</button>)}</div>
                </Field>
              )}
              <Field label="SENHA ATUAL"><input type="password" style={INP} value={trocaSenhaAtual} onChange={e=>setTrocaSenhaAtual(e.target.value)} placeholder="••••••••"/></Field>
              <Field label="NOVA SENHA" hint="Mínimo 8 caracteres"><input type="password" style={INP} value={trocaSenhaNova} onChange={e=>setTrocaSenhaNova(e.target.value)} placeholder="••••••••"/></Field>
              <Field label="CONFIRMAR NOVA SENHA"><input type="password" style={INP} value={trocaSenhaConfirm} onChange={e=>setTrocaSenhaConfirm(e.target.value)} placeholder="••••••••"/></Field>
              {trocaErro&&<div style={{background:'#1a0808',border:'1px solid #7f1d1d',borderRadius:8,padding:'10px 14px',color:'#f87171',fontSize:12}}>⚠️ {trocaErro}</div>}
              {trocaOk&&<div style={{background:'#0a2a1a',border:'1px solid #22543d',borderRadius:8,padding:'10px 14px',color:'#68d391',fontSize:12}}>✅ {trocaOk}</div>}
              <button type="submit" style={{padding:12,background:'linear-gradient(135deg,#1d4ed8,#3b82f6)',border:'none',borderRadius:9,color:'#fff',fontSize:14,fontWeight:700,cursor:'pointer'}}>🔑 Confirmar alteração</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════
  // RENDER PRINCIPAL
  // ══════════════════════════════════════════════
  return (
    <div style={{ minHeight:'100vh', background:'#060c1a',
      backgroundImage:'radial-gradient(ellipse at 15% 15%,#0d2040 0%,transparent 55%),radial-gradient(ellipse at 85% 85%,#0a1528 0%,transparent 55%)',
      display:'flex', alignItems:'flex-start', justifyContent:'center',
      padding:`28px 14px ${consentimento==='aceito'?24:100}px`,
      fontFamily:"'Segoe UI',system-ui,sans-serif" }}>

      <Confetti show={showConfetti}/>
      {showPolitica && <ModalPrivacidade onClose={()=>setShowPolitica(false)}/>}
      {consentimento === null && <BannerConsentimento onAceitar={aceitarConsentimento} onRecusar={recusarConsentimento} onVerPolitica={()=>setShowPolitica(true)}/>}
      {authModal && <ModalAuth tabLabel={ABAS.find(t=>t.id===authModal)?.label??authModal} onLogin={handleLogin} onClose={()=>setAuthModal(null)}/>}

      <div style={{ width:'100%', maxWidth:680, opacity:animou?1:0,
        transform:animou?'translateY(0)':'translateY(24px)',
        transition:'all 0.5s cubic-bezier(0.4,0,0.2,1)' }}>

        {/* HEADER */}
        <div style={{ textAlign:'center', marginBottom:22 }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:8, background:'#0a1830',
            border:`1px solid ${cargoAtivo.cor}44`, borderRadius:99, padding:'5px 16px',
            marginBottom:10, fontSize:11, letterSpacing:2, fontWeight:600, color:cargoAtivo.cor }}>
            {cargoAtivo.icone} {cargoAtivo.cargo.toUpperCase()}
          </div>
          <h1 style={{ fontSize:'clamp(18px,4.5vw,30px)', fontWeight:800, color:'#f0f6ff',
            margin:'0 0 4px', letterSpacing:'-0.5px', lineHeight:1.2 }}>{perguntaFinal}</h1>
          {enquete.config.localNome && <div style={{ fontSize:'clamp(14px,3.5vw,20px)', fontWeight:700, color:cargoAtivo.cor, marginBottom:4 }}>{enquete.config.localNome}</div>}
          {enquete.config.subtitulo && <div style={{ color:'#4a6080', fontSize:13 }}>{enquete.config.subtitulo}</div>}
          <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:8, marginTop:10, flexWrap:'wrap' }}>
            {consentimento==='aceito'&&<><span style={{background:'#022c22',border:'1px solid #22c55e33',borderRadius:99,padding:'3px 10px',fontSize:11,color:'#22c55e',fontWeight:600}}>🛡️ LGPD</span>{waStatus==='ativo'&&<span style={{background:'#1a1a3a',border:'1px solid #6366f144',borderRadius:99,padding:'3px 10px',fontSize:11,color:'#818cf8',fontWeight:600}}>⚡ Hardware {plataforma.icone}</span>}</>}
            {auth && <span style={{background:auth.role==='superuser'?'#2e1065':'#1e1b4b',border:`1px solid ${auth.role==='superuser'?'#7c3aed44':'#3b82f644'}`,borderRadius:99,padding:'3px 10px',fontSize:11,color:auth.role==='superuser'?'#a78bfa':'#60a5fa',fontWeight:600}}>{auth.role==='superuser'?'👑':'🛡️'} {auth.role}</span>}
          </div>
        </div>

        {/* ABAS */}
        <div style={{ display:'flex', background:'#0d1a2e', borderRadius:12, padding:4,
          marginBottom:20, border:'1px solid #1e3a60', gap:2, overflowX:'auto' }}>
          {ABAS.map(t => {
            const bloqueadaSemAuth = t.protegida && !hasRole(t.roleMinima ?? 'admin');
            return (
              <button key={t.id} onClick={() => navegarPara(t.id)}
                style={{ flex:'0 0 auto', padding:'9px 10px', borderRadius:9, border:'none',
                  background: aba===t.id ? '#1e3a60' : 'transparent',
                  color: aba===t.id ? '#93c5fd' : bloqueadaSemAuth ? '#374151' : '#4a6080',
                  fontWeight: aba===t.id ? 700 : 500, fontSize:12, cursor:'pointer',
                  transition:'all 0.2s', whiteSpace:'nowrap',
                  position:'relative' as const }}>
                {t.label}
                {bloqueadaSemAuth && <span style={{ fontSize:8, position:'absolute', top:3, right:3 }}>🔒</span>}
              </button>
            );
          })}
        </div>

        {/* CONTEÚDO */}
        {aba==='votar'      && renderVotar()}
        {aba==='resultado'  && renderResultado()}
        {aba==='candidatos' && renderCandidatos()}
        {aba==='avatares'   && renderAvatares()}
        {aba==='config'     && renderConfig()}

        {consentimento==='aceito' && <RodapeLGPD onRevogar={revogarConsentimento} onVerPolitica={()=>setShowPolitica(true)}/>}

        <style>{`
          @keyframes slideIn{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:translateX(0)}}
          @keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
          input:focus{border-color:#3b82f6!important;box-shadow:0 0 0 2px #3b82f622}
          input[type=number]::-webkit-inner-spin-button{opacity:0.4}
          *{box-sizing:border-box}
        `}</style>
      </div>
    </div>
  );
}
