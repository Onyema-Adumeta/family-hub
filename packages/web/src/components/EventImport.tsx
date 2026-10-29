import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

type Proposed = { title: string; date: string; time: string | null; endTime: string | null; location: string | null; notes: string | null; emoji: string; possibleDuplicate?: boolean; keep?: boolean };

/** Shrinks a photo to at most 1600px and re-encodes it as JPEG, so uploads stay small. */
async function shrink(file: File): Promise<{ mediaType: string; data: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
    const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    return { mediaType: 'image/jpeg', data: dataUrl.split(',')[1] };
  } finally { URL.revokeObjectURL(url); }
}

/** "Snap a flyer or paste an email" → review the events found → add them. */
export default function EventImport({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [image, setImage] = useState<{ mediaType: string; data: string } | null>(null);
  const [found, setFound] = useState<Proposed[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick(f?: File | null) {
    if (!f) return;
    setError('');
    try { const img = await shrink(f); setImage(img); setPreview(`data:${img.mediaType};base64,${img.data}`); }
    catch { setError('Could not read that photo'); }
  }

  async function read() {
    setBusy(true); setError('');
    try {
      const { data } = await api.post('/events/extract', image ? { image, text: text || undefined } : { text });
      setFound(data.events.map((e: Proposed) => ({ ...e, keep: !e.possibleDuplicate })));
    } catch (e: any) { setError(e.response?.data?.error || 'Something went wrong'); }
    finally { setBusy(false); }
  }

  async function add() {
    const chosen = (found || []).filter(e => e.keep);
    if (!chosen.length) return;
    setBusy(true); setError('');
    try {
      await api.post('/events/batch', { events: chosen.map(({ keep, possibleDuplicate, ...e }) => e) });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['briefing'] });
      onClose();
    } catch (e: any) { setError(e.response?.data?.error || 'Could not add events'); }
    finally { setBusy(false); }
  }

  const set = (i: number, patch: Partial<Proposed>) => setFound(list => list!.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="import-title" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <h2 id="import-title" style={{ margin: 0, fontSize: 18 }}>📸 Snap or paste</h2>
          <button className="btn btn-ghost" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {!found && (
          <>
            <p className="calm-muted" style={{ fontSize: 13, marginTop: 0 }}>Take a photo of a school flyer or schedule, or paste an email. You'll check the dates before anything is added.</p>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={e => pick(e.target.files?.[0])} />
            <button className="btn btn-primary" style={{ width: '100%', padding: 12, marginBottom: 10 }} onClick={() => fileRef.current?.click()}>{preview ? 'Use a different photo' : '📷 Take or choose a photo'}</button>
            {preview && <img src={preview} alt="Flyer to read" style={{ width: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: 10, marginBottom: 10 }} />}
            <textarea className="input" rows={5} placeholder="…or paste the email or message here" value={text} onChange={e => setText(e.target.value)} style={{ width: '100%', resize: 'vertical' }} />
            {error && <div role="alert" style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</div>}
            <button className="btn btn-primary" style={{ width: '100%', padding: 12, marginTop: 10 }} disabled={busy || (!image && !text.trim())} onClick={read}>
              {busy ? 'Reading…' : 'Find the dates'}
            </button>
            <p className="calm-muted" style={{ fontSize: 11, marginBottom: 0 }}>Uses the AI features a parent turned on. The photo or text is sent to our AI provider to read the dates.</p>
          </>
        )}

        {found && (
          <>
            {found.length === 0
              ? <p>No dated events found. Try a clearer photo, or paste the text.</p>
              : <p className="calm-muted" style={{ fontSize: 13, marginTop: 0 }}>Found {found.length}. Untick anything you don't want, and fix any mistakes.</p>}
            {found.map((e, i) => (
              <div key={i} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 10, marginBottom: 8, opacity: e.keep ? 1 : 0.55 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 700 }}>
                  <input type="checkbox" checked={!!e.keep} onChange={ev => set(i, { keep: ev.target.checked })} />
                  <span>{e.emoji}</span>
                  <input className="input" value={e.title} onChange={ev => set(i, { title: ev.target.value })} style={{ flex: 1 }} aria-label="Title" />
                </label>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input className="input" type="date" value={e.date} onChange={ev => set(i, { date: ev.target.value })} aria-label="Date" />
                  <input className="input" type="time" value={e.time || ''} onChange={ev => set(i, { time: ev.target.value || null })} aria-label="Time" />
                </div>
                {(e.location || e.notes) && <div className="calm-muted" style={{ fontSize: 12, marginTop: 6 }}>{[e.location, e.notes].filter(Boolean).join(' · ')}</div>}
                {e.possibleDuplicate && <div style={{ fontSize: 12, color: '#F59E0B', marginTop: 6 }}>Looks like it's already on the calendar.</div>}
              </div>
            ))}
            {error && <div role="alert" style={{ color: 'var(--danger)', fontSize: 13 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn btn-ghost" onClick={() => setFound(null)}>Back</button>
              <button className="btn btn-primary" style={{ flex: 1 }} disabled={busy || !found.some(e => e.keep)} onClick={add}>
                {busy ? 'Adding…' : `Add ${found.filter(e => e.keep).length} to the calendar`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
