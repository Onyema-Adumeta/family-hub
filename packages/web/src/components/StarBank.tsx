import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

const money = (cents: number, currency = 'CAD') => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(cents / 100);
const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}` : `${m} min`);
const JARS = [
  { key: 'spend', label: 'Spend', icon: '🛍️' },
  { key: 'save', label: 'Save', icon: '🐷' },
  { key: 'give', label: 'Give', icon: '💝' },
] as const;
const card: React.CSSProperties = { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 16 };

/**
 * Stars to real value. Kids turn stars into screen time or allowance; parents
 * set the rates and record when screen time is used or money is paid out.
 * It's a record only — the parent hands over the real thing.
 */
export default function StarBank() {
  const member = useAuthStore(s => s.member);
  const isParent = member?.role === 'parent';
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['bank'], queryFn: () => api.get('/bank').then(r => r.data) });
  const [busy, setBusy] = useState(false);
  if (!data) return null;
  const s = data.settings;
  const refresh = () => { ['bank', 'members', 'briefing'].forEach(k => qc.invalidateQueries({ queryKey: [k] })); };

  async function call(fn: () => Promise<any>, ok?: string) {
    setBusy(true);
    try { await fn(); refresh(); if (ok) alert(ok); }
    catch (e: any) { alert(e.response?.data?.error || 'Something went wrong'); }
    finally { setBusy(false); }
  }

  async function editRates() {
    const screen = prompt('Screen time: minutes per star (blank = off)', s.screenMinutesPerStar ?? '5');
    if (screen === null) return;
    const cents = prompt(`Allowance: cents per star (blank = off). Example: 10 means 1⭐ = ${money(10, s.currency)}`, s.centsPerStar ?? '10');
    if (cents === null) return;
    await call(() => api.put('/bank/settings', { screenMinutesPerStar: screen.trim() || null, centsPerStar: cents.trim() || null }), 'Bank rates saved.');
  }

  function convert(kind: 'screen' | 'money', kid: any) {
    const n = prompt(`How many stars to turn into ${kind === 'screen' ? 'screen time' : 'allowance'}? (${kid.name} has ${kid.stars}⭐)`);
    if (!n) return;
    let bucket: string | undefined;
    if (kind === 'money') {
      const b = prompt('Which jar? spend, save or give', 'spend');
      if (!b) return;
      bucket = b.trim().toLowerCase();
    }
    call(() => api.post('/bank/convert', { kind, stars: Number(n), bucket, ...(isParent ? { memberId: kid.id } : {}) }));
  }

  function use(kind: 'screen' | 'money', kid: any, bucket?: string) {
    const n = prompt(kind === 'screen' ? `Minutes of screen time ${kid.name} used` : `Amount paid to ${kid.name} from ${bucket} (e.g. 2.50)`);
    if (!n) return;
    const amount = kind === 'screen' ? Number(n) : Math.round(Number(n) * 100);
    call(() => api.post('/bank/use', { memberId: kid.id, kind, amount, bucket }));
  }

  function move(kid: any) {
    const from = prompt('Move from which jar? spend, save or give', 'spend');
    if (!from) return;
    const to = prompt('Move to which jar?', 'save');
    if (!to) return;
    const amt = prompt('How much? (e.g. 1.00)');
    if (!amt) return;
    call(() => api.post('/bank/move', { memberId: isParent ? kid.id : undefined, from: from.trim().toLowerCase(), to: to.trim().toLowerCase(), amount: Math.round(Number(amt) * 100) }));
  }

  if (!s.screenEnabled && !s.moneyEnabled) {
    return isParent ? (
      <section style={card} aria-label="Star bank">
        <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>🏦 Star bank</h2>
        <p className="calm-muted" style={{ margin: '0 0 10px', fontSize: 13 }}>Let kids turn stars into screen time or allowance. You set the rates, and you hand over the real thing — FamilyHub just keeps track.</p>
        <button className="btn btn-primary" onClick={editRates} disabled={busy}>Set up the bank</button>
      </section>
    ) : null;
  }

  return (
    <section style={card} aria-label="Star bank">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>🏦 Star bank</h2>
        <span className="calm-muted" style={{ fontSize: 12 }}>
          {s.screenEnabled && `1⭐ = ${s.screenMinutesPerStar} min`}{s.screenEnabled && s.moneyEnabled && ' · '}{s.moneyEnabled && `1⭐ = ${money(s.centsPerStar, s.currency)}`}
          {isParent && <button className="btn btn-ghost" style={{ fontSize: 11, marginLeft: 8 }} onClick={editRates}>Rates</button>}
        </span>
      </div>
      {data.members.map((k: any) => (
        <div key={k.id} style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 22 }}>{k.emoji}</span><strong>{k.name}</strong><span className="calm-muted">· {k.stars}⭐ to spend</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8 }}>
            {s.screenEnabled && (
              <div style={{ background: 'rgba(96,165,250,0.08)', borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📺 Screen time</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{mins(k.screenMinutes)}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => convert('screen', k)}>+ Add stars</button>
                  {isParent && k.screenMinutes > 0 && <button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => use('screen', k)}>Used</button>}
                </div>
              </div>
            )}
            {s.moneyEnabled && JARS.map(j => (
              <div key={j.key} style={{ background: 'rgba(74,222,128,0.08)', borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{j.icon} {j.label}</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{money(k.money[j.key], s.currency)}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {j.key === 'spend' && <button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => convert('money', k)}>+ Add stars</button>}
                  {isParent && k.money[j.key] > 0 && <button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => use('money', k, j.key)}>Paid out</button>}
                </div>
              </div>
            ))}
          </div>
          {s.moneyEnabled && <button className="btn btn-ghost" style={{ fontSize: 11, marginTop: 6 }} disabled={busy} onClick={() => move(k)}>Move between jars</button>}
        </div>
      ))}
      <p className="calm-muted" style={{ fontSize: 11, margin: '12px 0 0' }}>FamilyHub keeps the record; a parent gives the real screen time or money.</p>
    </section>
  );
}
