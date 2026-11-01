// "Apply for the beta" on the landing page. Saves straight to Kinroost's database.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

const DEVICES = ['iPhone or iPad', 'Android', 'Computer or browser'];

const field: React.CSSProperties = {
  width: '100%', padding: '12px 14px', borderRadius: 12, background: 'rgba(255,255,255,0.06)',
  border: '1.5px solid rgba(255,255,255,0.12)', color: '#F0F0F5', fontSize: 15, fontWeight: 600,
};
const label: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, marginBottom: 6, color: 'rgba(240,240,245,0.85)' };

export default function BetaApplyForm() {
  const [v, setV] = useState({ parentName: '', email: '', country: 'Canada', region: '', kids: '', why: '', heardFrom: '', website: '' });
  const [devices, setDevices] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV(o => ({ ...o, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!devices.length) return setError('Please pick at least one device your family will use.');
    setState('sending');
    try {
      await api.post('/beta-applications', { ...v, devices: devices.join(', ') });
      setState('sent');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Could not send your application. Please try again.');
      setState('idle');
    }
  }

  if (state === 'sent') {
    return (
      <div role="status" style={{ maxWidth: 520, margin: '0 auto', padding: 28, borderRadius: 18, background: 'rgba(74,222,128,0.08)', border: '1.5px solid rgba(74,222,128,0.3)' }}>
        <div style={{ fontSize: 40 }} aria-hidden="true">🎉</div>
        <h3 style={{ fontSize: 22, fontWeight: 800, margin: '8px 0' }}>Thanks, {v.parentName.split(' ')[0] || 'friend'}!</h3>
        <p style={{ color: 'rgba(240,240,245,0.75)', lineHeight: 1.6 }}>
          We're inviting a few families at a time. We'll email <strong>{v.email}</strong> when there's a spot for yours.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} style={{ maxWidth: 560, margin: '0 auto', textAlign: 'left', display: 'grid', gap: 16 }} noValidate>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <label><span style={label}>Your name</span><input style={field} value={v.parentName} onChange={set('parentName')} required maxLength={80} autoComplete="name" /></label>
        <label><span style={label}>Email</span><input style={field} type="email" value={v.email} onChange={set('email')} required maxLength={200} autoComplete="email" /></label>
        <label><span style={label}>Country</span>
          <select style={field} value={v.country} onChange={set('country')}>
            <option>Canada</option><option>United States</option><option>Other</option>
          </select>
        </label>
        <label><span style={label}>Province or state</span><input style={field} value={v.region} onChange={set('region')} required maxLength={60} placeholder="e.g. BC" /></label>
      </div>
      <label><span style={label}>Your kids' ages</span><input style={field} value={v.kids} onChange={set('kids')} required maxLength={80} placeholder="e.g. 6, 9 and 13" /></label>
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend style={label}>Devices your family will use</legend>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {DEVICES.map(d => {
            const on = devices.includes(d);
            return (
              <button type="button" key={d} aria-pressed={on} onClick={() => setDevices(x => on ? x.filter(y => y !== d) : [...x, d])}
                style={{ padding: '10px 14px', borderRadius: 999, fontSize: 14, fontWeight: 700, color: on ? '#fff' : 'rgba(240,240,245,0.8)',
                  background: on ? 'linear-gradient(135deg,#8B5CF6,#6366F1)' : 'rgba(255,255,255,0.06)', border: `1.5px solid ${on ? 'transparent' : 'rgba(255,255,255,0.12)'}` }}>
                {on ? '✓ ' : ''}{d}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label><span style={label}>What would you most like help with? <span style={{ fontWeight: 600, opacity: 0.6 }}>(optional)</span></span>
        <textarea style={{ ...field, minHeight: 90, resize: 'vertical' }} value={v.why} onChange={set('why')} maxLength={1000} placeholder="Mornings, chores, screen time, keeping track of everyone's schedule…" />
      </label>
      <label><span style={label}>How did you hear about Kinroost? <span style={{ fontWeight: 600, opacity: 0.6 }}>(optional)</span></span>
        <input style={field} value={v.heardFrom} onChange={set('heardFrom')} maxLength={200} />
      </label>
      {/* Hidden from people; bots tend to fill it in. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}>
        <label>Website<input tabIndex={-1} autoComplete="off" value={v.website} onChange={set('website')} /></label>
      </div>
      {error && <p role="alert" style={{ color: '#F87171', fontWeight: 700, margin: 0 }}>{error}</p>}
      <button type="submit" className="fh-cta" disabled={state === 'sending'}
        style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', color: '#fff', fontWeight: 800, fontSize: 17, padding: '16px 40px', borderRadius: 14, boxShadow: '0 8px 24px rgba(139,92,246,0.4)', opacity: state === 'sending' ? 0.7 : 1 }}>
        {state === 'sending' ? 'Sending…' : 'Apply for the free beta'}
      </button>
      <p style={{ fontSize: 12, color: 'rgba(240,240,245,0.5)', margin: 0, textAlign: 'center' }}>
        We only use this to contact you about the beta. See our <Link to="/privacy" style={{ color: '#A78BFA' }}>Privacy Policy</Link>.
      </p>
    </form>
  );
}
