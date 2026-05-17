export function fireConfetti(x?: number, y?: number) {
  const colors = ['#7C6FF7','#F472B6','#FBBF24','#4ADE80','#38BDF8','#FB923C'];
  const cx = x ?? window.innerWidth / 2;
  const cy = y ?? window.innerHeight / 2;
  for (let i = 0; i < 22; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-particle';
    el.style.cssText = `left:${cx+(Math.random()-0.5)*120}px;top:${cy-20}px;background:${colors[Math.floor(Math.random()*colors.length)]};transform:rotate(${Math.random()*360}deg);animation-delay:${Math.random()*0.4}s;animation-duration:${0.9+Math.random()*0.6}s;width:${5+Math.random()*7}px;height:${5+Math.random()*7}px;border-radius:${Math.random()>0.5?'50%':'2px'};`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1800);
  }
}
