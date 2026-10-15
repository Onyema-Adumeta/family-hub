import { useEffect, useRef, useState } from 'react';
import { bounceDirection, Level, levels, shotResult } from './sportsRules';
import './sports.css';
type Sport = 'soccer' | 'tennis';
type Result = { score: number; detail: string };
export default function SportsCup() {
  const [sport, setSport] = useState<Sport>('soccer');
  const [level, setLevel] = useState<Level>('Club');
  const [mode, setMode] = useState('solo');
  const [running, setRunning] = useState(false);
  const [round, setRound] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [best, setBest] = useState<number | null>(null);
  const key = `familyhub-sports-v1-${sport}-${level}`;
  useEffect(() => { try { const v = localStorage.getItem(key); setBest(v === null ? null : Number(v)); } catch { setBest(null); } }, [key]);
  function finish(result: Result) {
    setRunning(false); setResults(old => [...old, result]);
    try { const previous = Number(localStorage.getItem(key) || 0); if (result.score > previous) { localStorage.setItem(key, String(result.score)); setBest(result.score); } } catch { /* play remains available */ }
  }
  function start() { setResults([]); setRound(0); setRunning(true); }
  const awaitingSecond = mode === 'duel' && results.length === 1;
  return <section className="sports-cup">
    <header><span className="sports-eyebrow">COURT & GOAL</span><h1>Family Cup</h1><p>Read the keeper. Find the corner. Keep the rally alive.</p></header>
    {!running && <>
      <div className="sports-options"><label>Challenge<select value={sport} onChange={e => { setSport(e.target.value as Sport); setResults([]); }}><option value="soccer">⚽ Goal Rush</option><option value="tennis">🎾 Rally Rivals</option></select></label>
      <label>Difficulty<select value={level} onChange={e => { setLevel(e.target.value as Level); setResults([]); }} >{Object.keys(levels).map(l => <option key={l}>{l}</option>)}</select></label>
      <label>Players<select value={mode} onChange={e => { setMode(e.target.value); setResults([]); }}><option value="solo">Solo challenge</option><option value="duel">Two players · take turns</option></select></label></div>
      <p>{sport === 'soccer' ? 'Five penalties. Aim away from the moving keeper, hold Shoot to charge, then release in the green zone. The keeper commits when you strike.' : 'A 60-second tennis survival challenge. Move your racket to return the ball. Hit near its edges to change direction; beat the computer for bonus points. Three misses end the round.'}</p>
      <p className="sports-note">Touch or mouse to move. Keyboard: ← → or A/D; soccer: hold and release Space. Tennis returns automatically on contact.</p>
      {results.map((r, i) => <div className="sports-result" key={i}><strong>{mode === 'duel' ? `Player ${i + 1}` : 'Your round'} · {r.score} points</strong><span>{r.detail}</span></div>)}
      {results.length === 2 && <h2>{results[0].score === results[1].score ? 'A draw — rematch?' : `Player ${results[0].score > results[1].score ? 1 : 2} wins the cup!`}</h2>}
      <button className="sports-primary" onClick={awaitingSecond ? () => { setRound(1); setRunning(true); } : start}>{awaitingSecond ? 'Pass device · Start Player 2' : results.length ? 'Play again' : 'Start challenge'}</button>
      {best !== null && <p className="sports-note">Device best · {level} · {best} points</p>}
      <p className="sports-note">Scores stay on this device, separately for each sport and difficulty. They do not change chore stars. Available every day.</p>
    </>}
    {running && <Arena key={`${sport}-${round}`} sport={sport} level={level} player={mode === 'duel' ? round + 1 : 0} onFinish={finish} />}
  </section>;
}
function Arena({ sport, level, player, onFinish }: { sport: Sport; level: Level; player: number; onFinish: (r: Result) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const control = useRef({ x: 240, left: false, right: false, held: false, released: false });
  const [hud, setHud] = useState('Get ready');
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  useEffect(() => { pausedRef.current = paused; control.current.held = false; }, [paused]);
  useEffect(() => {
    const c = canvas.current!, ctx = c.getContext('2d')!, cfg = levels[level];
    const input = control.current;
    let raf = 0, last = 0, elapsed = 0, charge = 0, charging = false, keeper = 240, shots = 0, goals = 0, score = 0, misses = 0, rally = 0, longest = 0;
    let bx = 240, by = 290, vx = 70, vy = cfg.ball, ai = 240, flight = 0, target = 240, message = 'Aim, charge, release!', wait = .8, done = false;
    const keys = (e: KeyboardEvent, down: boolean) => {
      if (!['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D', ' '].includes(e.key)) return;
      if (e.target instanceof HTMLButtonElement || e.target instanceof HTMLSelectElement) return;
      e.preventDefault();
      if (['ArrowLeft','a','A'].includes(e.key)) input.left = down;
      if (['ArrowRight','d','D'].includes(e.key)) input.right = down;
      if (e.key === ' ' && sport === 'soccer') { if (!down && input.held) input.released = true; input.held = down; }
    };
    const kd = (e: KeyboardEvent) => keys(e, true), ku = (e: KeyboardEvent) => keys(e, false);
    const blur = () => { input.left = input.right = input.held = false; input.released = false; pausedRef.current = true; setPaused(true); };
    const visibility = () => { if (document.hidden) blur(); };
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); window.addEventListener('blur', blur); document.addEventListener('visibilitychange', visibility);
    const circle = (x: number, y: number, r: number, color: string) => { ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); };
    function end() { if (done) return; done = true; onFinish({ score, detail: sport === 'soccer' ? `${goals} goals from 5 shots · ${level}` : `${longest} longest rally · ${misses} misses · ${level}` }); }
    function frame(now: number) {
      if (done) return;
      const dt = last ? Math.min((now-last)/1000, .035) : 0; last = now;
      if (!pausedRef.current) {
        elapsed += dt;
        input.x = Math.max(45, Math.min(435, input.x + (Number(input.right)-Number(input.left))*340*dt));
        if (sport === 'soccer') {
          if (flight > 0) { flight = Math.max(0,flight-dt); if (flight === 0) { wait = 1.05; if (shots === 5) { end(); return; } } }
          else if (wait > 0) { wait -= dt; input.released = false; }
          else {
            keeper = 240 + Math.sin(elapsed * cfg.keeper/65)*137;
            if (input.held) { charging = true; charge = Math.min(1, charge+dt*.8); }
            if (charging && (input.released || charge === 1)) {
              const result = shotResult(input.x,keeper,charge,level === 'Practice' ? 39 : level === 'Club' ? 48 : 56);
              shots++; target = input.x; if (result === 'Goal') { goals++; score += 100 + Math.round(Math.abs(target-240)/4); }
              message = result === 'Goal' ? 'GOAL! Great placement.' : result === 'Saved' ? 'Saved! Aim away from the keeper.' : 'Miss! Release inside the green zone.';
              flight = .65; charging = false; input.held = false;
            } else if (!charging) charge = 0;
            input.released = false;
          }
        } else {
          ai += Math.sign(bx-ai)*Math.min(Math.abs(bx-ai), (level === 'Practice' ? 110 : level === 'Club' ? 160 : 200)*dt);
          const previousY = by; bx += vx*dt; by += vy*dt;
          if (bx < 30 || bx > 450) { bx = Math.max(30,Math.min(450,bx)); vx *= -1; }
          if (vy > 0 && previousY <= 492 && by >= 492 && Math.abs(bx-input.x) <= cfg.paddle/2+7) {
            const angle = bounceDirection((bx-input.x)/(cfg.paddle/2)); const speed = Math.min(440, cfg.ball+rally*9);
            vx = Math.sin(angle)*speed; vy = -Math.cos(angle)*speed; by = 491; rally++; longest = Math.max(longest,rally); score += 10; message = `Rally ${rally} — find an angle!`;
          }
          if (vy < 0 && previousY >= 72 && by <= 72 && Math.abs(bx-ai) < 48) { vy = Math.abs(vy); vx += Math.sin(elapsed*3)*45; by = 73; }
          if (by < 30 || by > 540) {
            if (by < 30) { score += 50; message = 'Winner! +50'; } else { misses++; message = 'Miss — get behind the ball!'; }
            rally = 0; bx = 240; by = 220; vx = (Math.random()-.5)*140; vy = cfg.ball;
          }
          if (misses >= 3 || elapsed >= 60) { end(); return; }
        }
      }
      ctx.clearRect(0,0,480,570); ctx.fillStyle = sport === 'soccer' ? '#164e3b' : '#154b62'; ctx.fillRect(0,0,480,570);
      ctx.strokeStyle = '#c7e1d1'; ctx.lineWidth = 2; ctx.strokeRect(25,30,430,510);
      if (sport === 'soccer') {
        ctx.strokeRect(50,40,380,130); ctx.strokeRect(100,30,280,60);
        ctx.fillStyle = '#e8eff5'; ctx.fillRect(keeper-28,86,56,18); circle(keeper,78,12,'#f9b44c');
        const progress = flight ? 1-flight/.65 : 0;
        circle(flight ? 240+(target-240)*progress : 240, flight ? 465-410*progress : 465, 11,'white');
        ctx.strokeStyle = '#b9e8ff'; ctx.setLineDash([7,8]); ctx.beginPath(); ctx.moveTo(240,450); ctx.lineTo(input.x,65); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#071f1b'; ctx.fillRect(90,510,300,18); ctx.fillStyle = '#5dcf92'; ctx.fillRect(150,510,222,18); ctx.fillStyle = 'white'; ctx.fillRect(90+charge*300,506,4,26);
      } else {
        ctx.strokeRect(70,30,340,510); ctx.beginPath(); ctx.moveTo(25,285); ctx.lineTo(455,285); ctx.moveTo(240,150); ctx.lineTo(240,420); ctx.stroke();
        ctx.fillStyle = '#f9ba5d'; ctx.fillRect(ai-40,60,80,12); ctx.fillStyle = '#e4f4ff'; ctx.fillRect(input.x-cfg.paddle/2,500,cfg.paddle,13); circle(bx,by,8,'#e4f76f');
      }
      ctx.fillStyle = 'white'; ctx.font = 'bold 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText(sport === 'soccer' ? `${shots}/5 shots · ${goals} goals · ${score} pts` : `${Math.max(0,60-Math.floor(elapsed))}s · ${score} pts · ${3-misses} lives`,240,565);
      setHud(sport === 'soccer' && flight === 0 && wait <= 0 ? `Shot ${shots+1} of 5 · Hold, then release Shoot` : message);
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);
    return () => { done = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); window.removeEventListener('blur', blur); document.removeEventListener('visibilitychange', visibility); };
  }, [sport, level]);
  function move(e: React.PointerEvent<HTMLCanvasElement>) { const r=e.currentTarget.getBoundingClientRect(); control.current.x = (e.clientX-r.left)/r.width*480; }
  function release() { if(control.current.held) control.current.released = true; control.current.held = false; }
  return <div><div className="sports-live"><strong>{player ? `Player ${player} · ` : ''}{level}</strong><button onClick={() => setPaused(p => !p)}>{paused ? 'Resume' : 'Pause'}</button></div>
    <p role="status" className="sports-status">{paused ? 'Paused — tap Resume when ready' : hud}</p>
    <canvas ref={canvas} width={480} height={570} aria-label={sport === 'soccer' ? 'Soccer pitch. Use arrow keys to aim and Space to shoot.' : 'Tennis court. Use arrow keys to move your racket.'} tabIndex={0} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); move(e); }} onPointerMove={move} />
    {sport === 'soccer' && <button className="sports-primary sports-shoot" disabled={paused} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); control.current.held = true; }} onPointerUp={release} onPointerCancel={() => { control.current.held=false; control.current.released=false; }} onKeyDown={e => { if (e.key===' ' || e.key==='Enter') { e.preventDefault(); control.current.held=true; } }} onKeyUp={e => { if(e.key===' ' || e.key==='Enter') { e.preventDefault(); release(); } }}>Hold to charge · Release to shoot</button>}
    <p className="sports-note">{sport === 'soccer' ? 'Aim on the pitch. Green meter = accurate strike.' : 'Slide anywhere on the court to move. Edge hits create sharper angles.'}</p>
  </div>;
}
