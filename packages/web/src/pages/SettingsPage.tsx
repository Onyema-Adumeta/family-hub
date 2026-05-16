import { useState, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { useMembers } from '../hooks/useApi';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const COLORS = ['#6366F1','#F472B6','#4ADE80','#F59E0B','#38BDF8','#FB923C','#A78BFA','#34D399'];
const EMOJIS = ['👨','👩','🧑','👦','👧','🧒','👴','👵','🦊','🐱','🐶','🐼','🦁','🐸'];

function avatarSrc(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

export default function SettingsPage() {
  const { member, family, setMember, logout } = useAuthStore();
  const { data: members = [] } = useMembers();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(member?.name || '');
  const [emoji, setEmoji] = useState(member?.emoji || '🙂');
  const [color, setColor] = useState(member?.color || '#6366F1');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(avatarSrc(member?.avatarUrl));

  async function handleSave() {
    if (!member) return;
    setSaving(true);
    try {
      const { data } = await api.patch(`/members/${member.id}`, { name, emoji, color });
      setMember(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to save'); }
    finally { setSaving(false); }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !member) return;
    const reader = new FileReader();
    reader.onload = ev => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setUploading(true);
    try {
      const form = new FormData();
      form.append('avatar', file);
      const { data } = await api.post(`/members/${member.id}/avatar`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMember(data);
      if (data.avatarUrl) setAvatarPreview(avatarSrc(data.avatarUrl));
    } catch { alert('Failed to upload photo'); }
    finally { setUploading(false); }
  }

  function copyCode() {
    if (family?.inviteCode) {
      navigator.clipboard.writeText(family.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div style={{ width: '100%' }}>
      <h1 style={{ fontSize: 22, fontWeight: 900, marginBottom: 20 }}>⚙️ Settings</h1>

      {/* Invite code — full width banner */}
      <div className="card" style={{
        marginBottom: 20,
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(244,114,182,0.06))',
        borderColor: 'rgba(99,102,241,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12
      }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.06em' }}>🔗 FAMILY INVITE CODE</div>
          <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 900, color: 'var(--primary)', letterSpacing: '0.08em' }}>
            {family?.inviteCode}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 4 }}>
            Share with family members so they can join at /join
          </div>
        </div>
        <button onClick={copyCode} className="btn btn-primary" style={{ fontSize: 13, padding: '10px 24px' }}>
          {copied ? '✅ Copied!' : '📋 Copy code'}
        </button>
      </div>

      {/* Two-column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
        gap: 20,
        alignItems: 'start',
      }}>
        {/* LEFT — Your Profile */}
        <div className="card">
          <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 16 }}>👤 Your Profile</div>

          {/* Avatar row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: 80, height: 80, borderRadius: '50%', cursor: 'pointer', position: 'relative',
                background: avatarPreview ? 'transparent' : color,
                border: `3px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden', flexShrink: 0
              }}
            >
              {avatarPreview
                ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 36 }}>{emoji}</span>
              }
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0,
                background: 'rgba(0,0,0,0.55)', fontSize: 10, fontWeight: 800,
                color: '#fff', textAlign: 'center', padding: '3px 0'
              }}>
                {uploading ? '...' : '📷'}
              </div>
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{name || member?.name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2, textTransform: 'capitalize' }}>{member?.role}</div>
              <button
                onClick={() => fileRef.current?.click()}
                className="btn btn-ghost"
                style={{ fontSize: 11, marginTop: 8, padding: '4px 10px' }}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : '📷 Change photo'}
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 4 }}>Name</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8 }}>Emoji (used when no photo)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EMOJIS.map(e => (
                  <button type="button" key={e} onClick={() => setEmoji(e)} style={{
                    fontSize: 18, width: 36, height: 36, borderRadius: 8,
                    border: `2px solid ${emoji === e ? 'var(--primary)' : 'var(--border)'}`,
                    background: emoji === e ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                    cursor: 'pointer', transition: 'all 0.1s'
                  }}>{e}</button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8 }}>Color</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button type="button" key={c} onClick={() => setColor(c)} style={{
                    width: 34, height: 34, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: `3px solid ${color === c ? '#fff' : 'transparent'}`,
                    boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                    transition: 'all 0.15s'
                  }} />
                ))}
              </div>
            </div>

            {/* Live preview */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--bg-secondary)', borderRadius: 10, padding: '10px 14px',
              border: '1px solid var(--border)'
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: avatarPreview ? 'transparent' : color,
                border: `3px solid ${color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, overflow: 'hidden', flexShrink: 0
              }}>
                {avatarPreview
                  ? <img src={avatarPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : emoji
                }
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800 }}>{name || member?.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Preview</div>
              </div>
            </div>

            <button onClick={handleSave} disabled={saving} className="btn btn-primary">
              {saved ? '✅ Saved!' : saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* RIGHT column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Family Members */}
          <div className="card">
            <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 14 }}>
              👨‍👩‍👧 Family Members
              <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                {(members as any[]).length} member{(members as any[]).length !== 1 ? 's' : ''}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(members as any[]).map((m: any) => (
                <div key={m.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 12px', borderRadius: 10,
                  background: m.id === member?.id ? 'rgba(99,102,241,0.08)' : 'var(--bg-secondary)',
                  border: `1.5px solid ${m.id === member?.id ? 'rgba(99,102,241,0.25)' : 'var(--border)'}`,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: m.color,
                    border: `2px solid ${m.color}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 22, overflow: 'hidden', flexShrink: 0
                  }}>
                    {m.avatarUrl
                      ? <img src={avatarSrc(m.avatarUrl)!} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : m.emoji
                    }
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: 800, fontSize: 14 }}>{m.name}</span>
                      {m.id === member?.id && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--primary)', background: 'rgba(99,102,241,0.12)', padding: '1px 6px', borderRadius: 6 }}>YOU</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'capitalize' }}>{m.role}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                    <span style={{ fontSize: 14 }}>⭐</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--warning)' }}>{m.stars}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Account */}
          <div className="card" style={{ borderColor: 'rgba(248,113,113,0.2)', background: 'rgba(248,113,113,0.03)' }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--danger)', marginBottom: 12 }}>⚠️ Account</div>
            <button onClick={() => { logout(); navigate('/login'); }} className="btn btn-danger" style={{ width: '100%' }}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}