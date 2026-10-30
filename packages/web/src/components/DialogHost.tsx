import { useEffect, useRef, useState } from 'react';
import { useDialog, Field } from '../store/dialog';

function problemWith(f: Field, value: string): string | null {
  const v = value.trim();
  if (f.required !== false && !v) return `${f.label || 'This'} is required`;
  if (f.type === 'number' && v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 'Enter a number';
    if (!f.decimals && !Number.isInteger(n)) return 'Enter a whole number';
    if (f.min !== undefined && n < f.min) return `Enter ${f.min} or more`;
  }
  if (f.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return 'Enter a valid email address';
  if (f.mustEqual !== undefined && v !== f.mustEqual.trim()) return `Type it exactly: ${f.mustEqual}`;
  return null;
}

/** Renders whatever form()/ask()/choose() is waiting for. */
export default function DialogHost() {
  const current = useDialog(s => s.current);
  const close = useDialog(s => s.close);
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fresh values each time; typed passwords are cleared when the dialog closes.
    setValues(Object.fromEntries((current?.fields || []).map(f => [f.name, f.defaultValue ?? ''])));
    setTouched(false);
    if (current) setTimeout(() => first.current?.focus(), 30);
  }, [current]);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, close]);

  if (!current) return null;
  const fields = current.fields || [];
  const problems = fields.map(f => problemWith(f, values[f.name] ?? ''));
  const ok = problems.every(p => !p);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!ok) return;
    close(Object.fromEntries(fields.map(f => [f.name, (values[f.name] ?? '').trim()])));
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="dlg-title" onMouseDown={e => { if (e.target === e.currentTarget) close(null); }}
      style={{ position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <form onSubmit={submit} style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
        <h2 id="dlg-title" style={{ margin: '0 0 6px', fontSize: 17 }}>{current.title}</h2>
        {current.message && <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--text-secondary, var(--text-muted))', whiteSpace: 'pre-line' }}>{current.message}</p>}

        {current.choices ? (
          <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
            {current.choices.map((c, i) => (
              <button key={c.value} type="button" className="btn btn-ghost" style={{ padding: 12, fontWeight: 800, justifyContent: 'center' }}
                autoFocus={i === 0} onClick={() => close({ choice: c.value })}>{c.label}</button>
            ))}
            <button type="button" className="btn btn-ghost" style={{ padding: 8, opacity: 0.7 }} onClick={() => close(null)}>Cancel</button>
          </div>
        ) : (
          <>
            {fields.map((f, i) => (
              <label key={f.name} style={{ display: 'block', marginTop: i ? 12 : 4 }}>
                {f.label && <span style={{ display: 'block', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{f.label}</span>}
                <input
                  ref={i === 0 ? first : undefined}
                  className="input"
                  style={{ width: '100%' }}
                  type={f.type === 'number' ? 'text' : f.type || 'text'}
                  inputMode={f.type === 'number' ? (f.decimals ? 'decimal' : 'numeric') : undefined}
                  autoComplete={f.type === 'password' ? (f.name === 'newPassword' ? 'new-password' : 'current-password') : f.type === 'email' ? 'email' : 'off'}
                  placeholder={f.placeholder}
                  value={values[f.name] ?? ''}
                  onChange={e => setValues(v => ({ ...v, [f.name]: e.target.value }))}
                  aria-invalid={touched && !!problems[i]}
                />
                {f.hint && <span style={{ display: 'block', fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{f.hint}</span>}
                {touched && problems[i] && <span role="alert" style={{ display: 'block', fontSize: 12, color: 'var(--danger, #F87171)', marginTop: 4 }}>{problems[i]}</span>}
              </label>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => close(null)}>Cancel</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 2, fontWeight: 800, ...(current.danger ? { background: '#DC2626', borderColor: '#DC2626' } : {}) }}>
                {current.okLabel || 'OK'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
