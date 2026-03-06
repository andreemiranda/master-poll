import { useRef } from 'react';
import type { Candidato } from '../types';

function SilhuetaM({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx="50" cy="26" r="18" fill="#374151"/>
      <rect x="46" y="43" width="8" height="7" fill="#374151"/>
      <path d="M20 52 Q30 47 50 49 Q70 47 80 52 L77 78 L23 78 Z" fill="#2d3748"/>
      <path d="M22 52 L14 78 L28 78 L30 56 Z" fill="#2d3748"/>
      <path d="M78 52 L86 78 L72 78 L70 56 Z" fill="#2d3748"/>
      <rect x="28" y="78" width="19" height="22" rx="4" fill="#2d3748"/>
      <rect x="53" y="78" width="19" height="22" rx="4" fill="#2d3748"/>
    </svg>
  );
}

function SilhuetaF({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <ellipse cx="50" cy="22" rx="16" ry="18" fill="#2d3748"/>
      <path d="M34 28 Q28 42 30 56 Q33 54 35 52 Q31 42 37 32Z" fill="#2d3748"/>
      <path d="M66 28 Q72 42 70 56 Q67 54 65 52 Q69 42 63 32Z" fill="#2d3748"/>
      <circle cx="50" cy="24" r="14" fill="#374151"/>
      <rect x="46" y="37" width="8" height="6" fill="#374151"/>
      <path d="M30 43 Q40 40 50 42 Q60 40 70 43 L67 60 Q58 57 50 59 Q42 57 33 60Z" fill="#2d3748"/>
      <ellipse cx="50" cy="62" rx="15" ry="5" fill="#374151"/>
      <path d="M35 65 L22 100 L78 100 L65 65Z" fill="#2d3748"/>
    </svg>
  );
}

interface AvatarProps {
  c: Pick<Candidato, 'numero' | 'cor' | 'genero' | 'avatar' | 'nome'>;
  size?: number;
  showUpload?: boolean;
  onUpload?: (dataUrl: string | null) => void;
}

export function Avatar({ c, size = 56, showUpload = false, onUpload }: AvatarProps) {
  const ref = useRef<HTMLInputElement>(null);
  const anel  = c.numero === 0 ? '#4a5568' : c.cor;
  const inner = size - 7;

  return (
    <div style={{ position:'relative', flexShrink:0, width:size, height:size }}>
      <div style={{ width:size, height:size, borderRadius:'50%', padding:2.5,
        background:`conic-gradient(${anel} 0deg,${anel}55 180deg,${anel} 360deg)`,
        boxShadow: c.numero === 0 ? 'none' : `0 0 14px ${anel}44` }}>
        <div style={{ width:'100%', height:'100%', borderRadius:'50%', overflow:'hidden',
          border:'2.5px solid #060c1a', background:'#1f2937',
          display:'flex', alignItems:'center', justifyContent:'center' }}>
          {c.avatar
            ? <img src={c.avatar} alt={c.nome} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
            : c.genero === 'F' ? <SilhuetaF size={inner}/> : <SilhuetaM size={inner}/>
          }
        </div>
      </div>

      {!c.avatar && c.numero !== 0 && (
        <div style={{ position:'absolute', bottom:-1, left:-1, width:15, height:15, borderRadius:'50%',
          background: c.genero === 'F' ? '#db2777' : '#2563eb',
          border:'2px solid #060c1a', fontSize:9, display:'flex',
          alignItems:'center', justifyContent:'center', zIndex:2, color:'#fff', fontWeight:700 }}>
          {c.genero === 'F' ? '♀' : '♂'}
        </div>
      )}

      {showUpload && (
        <>
          <button
            onClick={() => ref.current?.click()}
            title="Trocar foto"
            style={{ position:'absolute', bottom:-2, right:-2, width:22, height:22, borderRadius:'50%',
              background:'#1a2a45', border:'2px solid #060c1a', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:10, padding:0, zIndex:3, transition:'background 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = anel)}
            onMouseLeave={e => (e.currentTarget.style.background = '#1a2a45')}>
            📷
          </button>
          {c.avatar && onUpload && (
            <button onClick={() => onUpload(null)} title="Remover foto"
              style={{ position:'absolute', top:-4, right:-4, width:18, height:18, borderRadius:'50%',
                background:'#7f1d1d', border:'2px solid #060c1a', cursor:'pointer',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:9, padding:0, zIndex:4, color:'#fff' }}>
              ✕
            </button>
          )}
          <input ref={ref} type="file" accept="image/*" style={{ display:'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (!f) return;
              const reader = new FileReader();
              reader.onload = ev => onUpload?.(ev.target?.result as string);
              reader.readAsDataURL(f);
            }}
          />
        </>
      )}
    </div>
  );
}
