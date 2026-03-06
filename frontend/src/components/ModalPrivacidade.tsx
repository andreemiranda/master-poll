import { useState } from 'react';

// ══════════════════════════════════════════════
// MODAL POLÍTICA DE PRIVACIDADE
// ══════════════════════════════════════════════
export function ModalPrivacidade({ onClose }: { onClose: () => void }) {
  const sections = [
    ['🎯 Finalidade', 'Impedir votos duplicados nesta enquete eleitoral não oficial. Base legal: consentimento (LGPD Art. 7º, I / GDPR Art. 6º, 1(a)).'],
    ['📦 Dados Coletados', '• Token UUID anônimo — identificador de sessão por navegador\n• Credencial WebAuthn — chave criptográfica no hardware do dispositivo (Secure Enclave / TEE), sem transmissão de dados biométricos\n• Endereço IP público\n\nNão coletamos: nome, e-mail, biometria bruta, Canvas/WebGL/Áudio fingerprint.'],
    ['🔐 WebAuthn e Privacidade', 'A credencial é gerada LOCALMENTE no chip de segurança. Nenhum dado biométrico é transmitido — apenas prova criptográfica de posse do dispositivo.'],
    ['📅 Retenção', 'Dados retidos pelo período da enquete e excluídos ao encerramento.'],
    ['✅ Direitos do Titular', 'Confirmação, acesso, revogação e exclusão. Use o botão "Revogar consentimento" na aba ⚙️ Config.'],
  ] as const;

  return (
    <div style={{ position:'fixed', inset:0, background:'#000c', zIndex:10000,
      display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#0d1a2e', border:'1px solid #1e3a60',
        borderRadius:16, padding:28, maxWidth:580, width:'100%', maxHeight:'85vh',
        overflowY:'auto', position:'relative' }}>
        <button onClick={onClose} style={{ position:'absolute', top:14, right:16, background:'transparent',
          border:'none', color:'#64748b', fontSize:22, cursor:'pointer', lineHeight:1 }}>✕</button>
        <h2 style={{ color:'#93c5fd', margin:'0 0 4px', fontSize:17 }}>🔒 Política de Privacidade</h2>
        <p style={{ color:'#3a5a80', fontSize:12, margin:'0 0 20px' }}>LGPD (Lei 13.709/2018) · GDPR (UE 2016/679)</p>
        {sections.map(([t, v]) => (
          <div key={t} style={{ marginBottom:16 }}>
            <div style={{ color:'#60a5fa', fontWeight:700, fontSize:13, marginBottom:5 }}>{t}</div>
            <div style={{ color:'#4a6a8a', fontSize:13, lineHeight:1.7, whiteSpace:'pre-line' }}>{v}</div>
          </div>
        ))}
        <button onClick={onClose} style={{ width:'100%', padding:12, background:'#1e3a60', border:'none',
          borderRadius:10, color:'#93c5fd', fontWeight:700, fontSize:14, cursor:'pointer', marginTop:8 }}>
          Entendi e fechar
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
// BANNER DE CONSENTIMENTO (LGPD)
// ══════════════════════════════════════════════
interface BannerProps {
  onAceitar: () => void;
  onRecusar: () => void;
  onVerPolitica: () => void;
}

export function BannerConsentimento({ onAceitar, onRecusar, onVerPolitica }: BannerProps) {
  const [exp, setExp] = useState(false);

  return (
    <div style={{ position:'fixed', bottom:0, left:0, right:0, zIndex:9000,
      background:'#0a1422ee', backdropFilter:'blur(8px)',
      borderTop:'1px solid #1e3a60', boxShadow:'0 -4px 24px #00000066' }}>
      <div style={{ maxWidth:760, margin:'0 auto', padding:'12px 16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span style={{ fontSize:16 }}>🍪</span>
          <p style={{ color:'#94a3b8', fontSize:12, margin:0, flex:1, lineHeight:1.5 }}>
            Esta enquete usa <strong style={{ color:'#c8d8f0' }}>token anônimo</strong>,{' '}
            <strong style={{ color:'#c8d8f0' }}>credencial WebAuthn (hardware)</strong> e{' '}
            <strong style={{ color:'#c8d8f0' }}>IP</strong> para impedir votos duplicados.{' '}
            <button onClick={() => setExp(v => !v)} style={{ background:'none', border:'none',
              color:'#60a5fa', fontSize:12, cursor:'pointer', padding:0, textDecoration:'underline' }}>
              {exp ? 'Ver menos ↑' : 'Saiba mais ↓'}
            </button>
          </p>
          <div style={{ display:'flex', gap:8, flexShrink:0 }}>
            <button onClick={onVerPolitica} style={{ padding:'7px 12px', background:'transparent',
              border:'1px solid #1e3a60', borderRadius:7, color:'#64748b', fontSize:12,
              cursor:'pointer', whiteSpace:'nowrap' }}>Política de Privacidade</button>
            <button onClick={onRecusar} style={{ padding:'7px 12px', background:'transparent',
              border:'1px solid #374151', borderRadius:7, color:'#64748b', fontSize:12,
              cursor:'pointer', whiteSpace:'nowrap' }}>Recusar</button>
            <button onClick={onAceitar} style={{ padding:'7px 14px',
              background:'linear-gradient(135deg,#1d4ed8,#3b82f6)', border:'none', borderRadius:7,
              color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}>
              Aceitar e continuar
            </button>
          </div>
        </div>
        {exp && (
          <div style={{ marginTop:10, padding:'10px 14px', background:'#060c1a',
            borderRadius:8, border:'1px solid #1a3050' }}>
            <p style={{ color:'#2d4a70', fontSize:11, margin:0, lineHeight:1.6 }}>
              Base legal: consentimento — LGPD Art. 7º, I / GDPR Art. 6º, 1(a).
              Nenhum dado biométrico é armazenado ou transmitido.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function RodapeLGPD({ onRevogar, onVerPolitica }: { onRevogar: () => void; onVerPolitica: () => void }) {
  return (
    <div style={{ marginTop:28, padding:'10px 16px', background:'#060c1a',
      border:'1px solid #0d1e35', borderRadius:10,
      display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
      <span style={{ color:'#1e3050', fontSize:11 }}>🔒 LGPD/GDPR · Dados tratados com consentimento</span>
      <div style={{ display:'flex', gap:10 }}>
        <button onClick={onVerPolitica} style={{ background:'none', border:'none', color:'#2d4a70',
          fontSize:11, cursor:'pointer', textDecoration:'underline', padding:0 }}>Política de Privacidade</button>
        <span style={{ color:'#1a3050' }}>·</span>
        <button onClick={onRevogar} style={{ background:'none', border:'none', color:'#7f1d1d',
          fontSize:11, cursor:'pointer', textDecoration:'underline', padding:0 }}>Revogar consentimento</button>
      </div>
    </div>
  );
}
