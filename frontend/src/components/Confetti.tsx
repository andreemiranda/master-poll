import { useEffect, useState } from 'react';

export function Confetti({ show }: { show: boolean }) {
  if (!show) return null;
  const colors = ['#e53e3e','#3182ce','#d69e2e','#38a169','#805ad5','#fff','#f6ad55'];
  return (
    <div style={{ position:'fixed', inset:0, pointerEvents:'none', zIndex:9999, overflow:'hidden' }}>
      {Array.from({ length:28 }, (_, i) => (
        <div key={i} style={{
          position:'absolute', left:`${(i / 28) * 100}%`, top:'-20px',
          width: i % 3 === 0 ? 12 : 8, height: i % 3 === 0 ? 12 : 8,
          borderRadius: i % 2 === 0 ? '50%' : 2,
          background: colors[i % 7],
          animation: `cf${i % 4} ${1.2 + (i % 5) * 0.25}s ease-in ${(i % 8) * 0.08}s forwards`,
        }}/>
      ))}
      <style>{`
        @keyframes cf0{to{transform:translateY(110vh) rotate(420deg);opacity:0}}
        @keyframes cf1{to{transform:translateY(110vh) rotate(-240deg) translateX(50px);opacity:0}}
        @keyframes cf2{to{transform:translateY(110vh) rotate(840deg) translateX(-35px);opacity:0}}
        @keyframes cf3{to{transform:translateY(110vh) rotate(-480deg) translateX(70px);opacity:0}}
      `}</style>
    </div>
  );
}

export function Bar({ pct, cor, delay }: { pct: number; cor: string; delay: number }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(pct), delay);
    return () => clearTimeout(t);
  }, [pct, delay]);
  return (
    <div style={{ height:'100%', background:'#111d30', borderRadius:6, overflow:'hidden', position:'relative' }}>
      <div style={{
        position:'absolute', inset:0, right:'auto', width:`${w}%`,
        background:`linear-gradient(90deg,${cor}99,${cor})`,
        borderRadius:6, transition:'width 0.9s cubic-bezier(0.4,0,0.2,1)',
        boxShadow:`0 0 10px ${cor}44`,
      }}/>
    </div>
  );
}
