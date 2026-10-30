import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { ask, choose, form } from '../store/dialog';

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

  const JAR_CHOICES = JARS.map(j => ({ label: `${j.icon} ${j.label}`, value: j.key }));

  async function editRates() {
    const r = await form({
      title: '🏦 Star bank rates',
      message: 'Leave a box empty to switch that one off.',
      fields: [
        { name: 'screen', label: '📺 Minutes of screen time per star', type: 'number', min: 1, required: false, defaultValue: String(s.screenMinutesPerStar ?? '5') },
        { name: 'cents', label: `💵 Cents of allowance per star (10 means 1⭐ = ${money(10, s.currency)})`, type: 'number', min: 1, required: false, defaultValue: String(s.centsPerStar ?? '10') },
      ],
      okLabel: 'Save rates',
    });
    if (!r) return;
    await call(() => api.put('/bank/settings', { screenMinutesPerStar: r.screen || null, centsPerStar: r.cents || null }), 'Bank rates saved.');
  }

  async function convert(kind: 'screen' | 'money', kid: any) {
    const rate = kind === 'screen' ? `1⭐ = ${s.screenMinutesPerStar} min` : `1⭐ = ${money(s.centsPerStar, s.currency)}`;
    const n = await ask(kind === 'screen' ? 'Turn stars into screen time' : 'Turn stars into allowance',
      { label: `How many stars? (${kid.name} has ${kid.stars}⭐)`, type: 'number', min: 1 },
      { message: `${rate}. The stars are spent; your level does not go down.`, okLabel: 'Turn them in' });
    if (!n) return;
    let bucket: string | undefined;
    if (kind === 'money') {
      const b = await choose('Which jar?', JAR_CHOICES, 'Spend it, save it, or give it to someone.');
      if (!b) return;
      bucket = b;
    }
    call(() => api.post('/bank/convert', { kind, stars: Number(n), bucket, ...(isParent ? { memberId: kid.id } : {}) }));
  }

  async function use(kind: 'screen' | 'money', kid: any, bucket?: string) {
    const n = await ask(kind === 'screen' ? `Screen time ${kid.name} used` : `Money paid to ${kid.name}`,
      kind === 'screen' ? { label: 'Minutes', type: 'number', min: 1 } : { label: `Amount from ${bucket} (e.g. 2.50)`, type: 'number', decimals: true, min: 0.01 },
      { okLabel: 'Record' });
    if (!n) return;
    const amount = kind === 'screen' ? Number(n) : Math.round(Number(n) * 100);
    call(() => api.post('/bank/use', { memberId: kid.id, kind, amount, bucket }));
  }

  async function move(kid: any) {
    const from = await choose('Move money from which jar?', JAR_CHOICES);
    if (!from) return;
    const to = await choose('…to which jar?', JAR_CHOICES.filter(j => j.value !== from));
    if (!to) return;
    const amt = await ask('How much?', { label: 'Amount (e.g. 1.00)', type: 'number', decimals: true, min: 0.01 }, { okLabel: 'Move' });
    if (!amt) return;
    call(() => api.post('/bank/move', { memberId: isParent ? kid.id : undefined, from, to, amount: Math.round(Number(amt) * 100) }));
  }

  if (!s.screenEnabled && !s.moneyEnabled) {
    return isParent ? (
      <section style={card} aria-label="Star bank">
        <h2 style={{ margin: '0 0 6px', fontSize: 16 }}>🏦 Star bank</h2>
        <p className="calm-muted" style={{ margin: '0 0 10px', fontSize: 13 }}>Let kids turn stars into screen time or allowance. You set the rates, and you hand over the real thing — Kinroost just keeps track.</p>
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
                  <button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => convert('screen', k)}>⭐ Turn into screen time</button>
                  {isParent && k.screenMinutes > 0 && <button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => use('screen', k)}>Used</button>}
                </div>
              </div>
            )}
            {s.moneyEnabled && JARS.map(j => (
              <div key={j.key} style={{ background: 'rgba(74,222,128,0.08)', borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{j.icon} {j.label}</div>
                <div style={{ fontSize: 20, fontWeight: 900 }}>{money(k.money[j.key], s.currency)}</div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  {j.key === 'spend' && <button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => convert('money', k)}>⭐ Turn into allowance</button>}
                  {isParent && k.money[j.key] > 0 && <button className="btn btn-ghost" style={{ fontSize: 11 }} disabled={busy} onClick={() => use('money', k, j.key)}>Paid out</button>}
                </div>
              </div>
            ))}
          </div>
          {s.moneyEnabled && <button className="btn btn-ghost" style={{ fontSize: 11, marginTop: 6 }} disabled={busy} onClick={() => move(k)}>Move between jars</button>}
        </div>
      ))}
      <p className="calm-muted" style={{ fontSize: 11, margin: '12px 0 0' }}>Kinroost keeps the record; a parent gives the real screen time or money.</p>
    </section>
  );
}
