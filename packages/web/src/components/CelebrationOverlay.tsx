import { useEffect } from 'react';
import { useCelebrations } from '../store/celebrations';
import { useAuthStore } from '../store/auth';

const CONFETTI = ['🎉', '⭐', '✨', '🎊', '🌟'];

/** Full-screen "level up / new badge" moment. Tap anywhere to continue. */
export default function CelebrationOverlay() {
  const { queue, shift } = useCelebrations();
  const me = useAuthStore(s => s.member);
  const c = queue[0];
  useEffect(() => {
    if (!c) return;
    const t = setTimeout(shift, 6000);
    return () => clearTimeout(t);
  }, [c, shift]);
  if (!c) return null;
  const isMe = c.memberId === me?.id;
  return (
    <div role="dialog" aria-live="assertive" aria-label="Celebration" onClick={shift} style={{
      position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(10,8,25,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, cursor: 'pointer', overflow: 'hidden',
    }}>
      <style>{`@keyframes fh-pop{0%{transform:scale(.4);opacity:0}60%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}
@keyframes fh-fall{0%{transform:translateY(-10vh) rotate(0)}100%{transform:translateY(110vh) rotate(540deg)}}
@media (prefers-reduced-motion: reduce){.fh-anim{animation:none!important}}`}</style>
      {Array.from({ length: 24 }).map((_, i) => (
        <span key={i} className="fh-anim" aria-hidden="true" style={{
          position: 'absolute', top: 0, left: `${(i * 37) % 100}%`, fontSize: 18 + (i % 4) * 6,
          animation: `fh-fall ${2.5 + (i % 5) * 0.5}s linear ${(i % 7) * 0.2}s forwards`,
        }}>{CONFETTI[i % CONFETTI.length]}</span>
      ))}
      <div className="fh-anim" style={{ textAlign: 'center', animation: 'fh-pop .6s ease-out', maxWidth: 360 }}>
        {c.levelUp && (
          <>
            <div style={{ fontSize: 72 }}>🏆</div>
            <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.15em', color: '#FBBF24' }}>LEVEL UP!</div>
            <h2 style={{ fontSize: 34, fontWeight: 900, margin: '6px 0', color: '#fff' }}>{isMe ? 'You' : c.name} reached Level {c.levelUp.level}</h2>
            <div style={{ fontSize: 22, fontWeight: 800, color: '#A78BFA' }}>{c.levelUp.title}</div>
          </>
        )}
        {c.badges.length > 0 && (
          <div style={{ marginTop: c.levelUp ? 20 : 0 }}>
            {!c.levelUp && <div style={{ fontSize: 14, fontWeight: 800, letterSpacing: '0.15em', color: '#FBBF24' }}>NEW BADGE{c.badges.length > 1 ? 'S' : ''}!</div>}
            {!c.levelUp && <h2 style={{ fontSize: 26, fontWeight: 900, margin: '6px 0 12px', color: '#fff' }}>{isMe ? 'You earned' : `${c.name} earned`}</h2>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {c.badges.map(b => (
                <div key={b.code} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 14, padding: '10px 14px', color: '#fff' }}>
                  <div style={{ fontSize: 36 }}>{b.icon}</div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{b.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 20 }}>Tap to continue</p>
      </div>
    </div>
  );
}
