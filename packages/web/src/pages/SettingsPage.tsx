import { useState, useRef } from 'react';
import { useAuthStore } from '../store/auth';
import { useMembers } from '../hooks/useApi';
import { api } from '../lib/api';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const COLORS = ['#6366F1','#F472B6','#4ADE80','#F59E0B','#38BDF8','#FB923C','#A78BFA','#34D399'];
const EMOJIS = ['👨','👩','🧑','👦','👧','🧒','👴','👵','🦊','🐱','🐶','🐼','🦁','🐸','🐯','🦋'];

function avatarSrc(url?: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

const BADGE_META: Record<string, { icon: string; label: string; color: string }> = {
  first_chore: { icon: '🌟', label: 'First Chore',   color: '#FBBF24' },
  streak_7:    { icon: '🔥', label: '7-Day Streak',  color: '#FB923C' },
  streak_30:   { icon: '💎', label: '30-Day Streak', color: '#60A5FA' },
  star_50:     { icon: '⭐', label: '50 Stars',       color: '#4ADE80' },
  star_100:    { icon: '🌠', label: '100 Stars',      color: '#A78BFA' },
};

export default function SettingsPage() {
  const { member, family, setMember, logout } = useAuthStore();
  const { data: members = [] } = useMembers();
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const fileRef     = useRef<HTMLInputElement>(null);

  const [name, setName]       = useState(member?.name  || '');
  const [emoji, setEmoji]     = useState(member?.emoji || '🙂');
  const [color, setColor]     = useState(member?.color || '#6366F1');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(avatarSrc(member?.avatarUrl) || null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [copied, setCopied]   = useState(false);
  const [shared, setShared]   = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [removingId, setRemovingId]       = useState<string | null>(null);

  // Birthday editing state: memberId -> value being edited
  const [birthdayEdits, setBirthdayEdits] = useState<Record<string, string>>({});
  const [savingBirthday, setSavingBirthday] = useState<string | null>(null);

  const isParent   = member?.role === 'parent';
  const inviteCode = family?.inviteCode || '';
  const inviteUrl  = `${window.location.origin}/join/${inviteCode}`;

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
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMember(data);
      if (data.avatarUrl) setAvatarPreview(avatarSrc(data.avatarUrl));
    } catch (e: any) { alert('Failed to upload photo'); }
    finally { setUploading(false); }
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch { alert(`Invite code: ${inviteCode}`); }
  }

  async function shareLink() {
    const shareData = {
      title: `Join ${family?.name || 'our family'} on Family Hub`,
      text:  `Use invite code ${inviteCode} to join our family on Family Hub!`,
      url:   inviteUrl,
    };
    if (navigator.share) {
      try {
        await navigator.share(shareData);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } catch { /* user cancelled */ }
    } else {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  async function handleRemoveMember(id: string) {
    setRemovingId(id);
    try {
      await api.delete(`/members/${id}`);
      queryClient.invalidateQueries({ queryKey: ['members'] });
      setConfirmRemove(null);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to remove member');
    } finally {
      setRemovingId(null);
    }
  }

  async function saveBirthday(memberId: string, value: string) {
    setSavingBirthday(memberId);
    try {
      await api.patch(`/members/${memberId}`, { birthday: value || null });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      // If saving own birthday, update local member too
      if (memberId === member?.id) {
        setMember({ ...member, birthday: value || null } as any);
      }
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save birthday');
    } finally {
      setSavingBirthday(null);
    }
  }

  const myBadges: string[] = (member as any)?.badges ?? [];
  const myStreak: number   = (member as any)?.streakDays ?? 0;

  return (
    <div style={{ padding: '16px 16px 80px', maxWidth: 540, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 16px' }}>⚙️ Settings</h1>

      {/* ── INVITE CODE ── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(244,114,182,0.06))',
        border: '1.5px solid rgba(99,102,241,0.3)',
        borderRadius: 16, padding: '16px', marginBottom: 16,
      }}>
        <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 10 }}>
          🔗 FAMILY INVITE
        </div>
        <div style={{
          fontFamily: 'monospace', fontSize: 28, fontWeight: 900,
          color: 'var(--primary)', letterSpacing: '0.1em', marginBottom: 12,
          textAlign: 'center',
        }}>{inviteCode}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={copyCode} style={{
            flex: 1, padding: '10px', borderRadius: 10,
            background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.08)',
            border: `1.5px solid ${copied ? '#4ADE80' : 'rgba(255,255,255,0.15)'}`,
            color: copied ? '#4ADE80' : 'var(--text)',
            fontWeight: 700, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {copied ? '✅ Copied!' : '📋 Copy Code'}
          </button>
          <button onClick={shareLink} style={{
            flex: 1, padding: '10px', borderRadius: 10,
            background: shared ? 'rgba(74,222,128,0.15)' : 'var(--primary)',
            border: 'none', color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>
            {shared ? '✅ Shared!' : '📤 Share Link'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 10, textAlign: 'center' }}>
          Family members join at <strong>{window.location.origin}/join</strong>
        </div>
      </div>

      {/* ── MY STATS ── */}
      {(myStreak > 0 || myBadges.length > 0) && (
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '14px', marginBottom: 16,
        }}>
          <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.08em' }}>
            🏆 MY ACHIEVEMENTS
          </div>
          {myStreak > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <span style={{ fontSize: 22 }}>🔥</span>
              <span style={{ fontWeight: 700, color: '#FB923C' }}>{myStreak}-day streak!</span>
              {myStreak >= 7 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Keep it up!</span>}
            </div>
          )}
          {myBadges.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {myBadges.map(b => {
                const m = BADGE_META[b] || { icon: '🏅', label: b, color: '#94A3B8' };
                return (
                  <div key={b} style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: `${m.color}22`, border: `1px solid ${m.color}44`,
                    borderRadius: 20, padding: '5px 12px',
                    fontSize: 12, fontWeight: 700, color: m.color,
                  }}>
                    <span>{m.icon}</span><span>{m.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PROFILE ── */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '16px', marginBottom: 16,
      }}>
        <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, letterSpacing: '0.08em' }}>
          👤 YOUR PROFILE
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div onClick={() => fileRef.current?.click()} style={{
            width: 72, height: 72, borderRadius: '50%', cursor: 'pointer',
            background: avatarPreview ? 'transparent' : color,
            border: `3px solid ${color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', flexShrink: 0, position: 'relative',
          }}>
            {avatarPreview
              ? <img src={avatarPreview} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 30 }}>{emoji}</span>}
            {uploading && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>⏳</div>
            )}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Profile photo</div>
            <button onClick={() => fileRef.current?.click()} style={{
              padding: '6px 12px', borderRadius: 8,
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--text)', fontSize: 12, cursor: 'pointer',
            }}>
              {uploading ? 'Uploading...' : '📷 Change photo'}
            </button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={handleAvatarChange} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>Name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="input" style={{ width: '100%' }} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Avatar emoji</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {EMOJIS.map(e => (
              <button key={e} onClick={() => setEmoji(e)} style={{
                width: 36, height: 36, borderRadius: 8, fontSize: 18,
                background: emoji === e ? color : 'rgba(255,255,255,0.06)',
                border: emoji === e ? `2px solid ${color}` : '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
              }}>{e}</button>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>Your color</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => setColor(c)} style={{
                width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer',
                border: color === c ? `3px solid #fff` : '2px solid transparent',
                boxShadow: color === c ? `0 0 0 2px ${c}` : 'none',
                transition: 'all 0.15s',
              }} />
            ))}
          </div>
        </div>

        {/* My birthday */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>🎂 My birthday</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="date"
              className="input"
              style={{ flex: 1 }}
              defaultValue={(member as any)?.birthday ? (member as any).birthday.substring(0, 10) : ''}
              onChange={e => setBirthdayEdits(prev => ({ ...prev, [member!.id]: e.target.value }))}
            />
            <button
              onClick={() => member && saveBirthday(member.id, birthdayEdits[member.id] ?? (member as any)?.birthday?.substring(0, 10) ?? '')}
              disabled={savingBirthday === member?.id}
              style={{
                padding: '8px 14px', borderRadius: 10, fontSize: 12, fontWeight: 700,
                background: 'var(--primary)', border: 'none', color: '#fff', cursor: 'pointer',
                opacity: savingBirthday === member?.id ? 0.6 : 1, flexShrink: 0,
              }}
            >
              {savingBirthday === member?.id ? '...' : 'Save'}
            </button>
          </div>
        </div>

        <button onClick={handleSave} disabled={saving} style={{
          width: '100%', padding: '12px', borderRadius: 12,
          background: saved ? 'rgba(74,222,128,0.2)' : 'var(--primary)',
          border: saved ? '1.5px solid #4ADE80' : 'none',
          color: saved ? '#4ADE80' : '#fff',
          fontWeight: 700, fontSize: 15, cursor: 'pointer', transition: 'all 0.2s',
        }}>
          {saved ? '✅ Saved!' : saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {/* ── FAMILY MEMBERS ── */}
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '16px', marginBottom: 16,
      }}>
        <div style={{ fontWeight: 800, fontSize: 12, color: 'var(--text-muted)', marginBottom: 14, letterSpacing: '0.08em' }}>
          👨‍👩‍👧‍👦 FAMILY MEMBERS
        </div>
        {(members as any[]).map(m => {
          const src = avatarSrc(m.avatarUrl);
          const badges: string[] = m.badges ?? [];
          const isMe         = m.id === member?.id;
          const isConfirming = confirmRemove === m.id;
          const currentBday  = birthdayEdits[m.id] ?? (m.birthday ? m.birthday.substring(0, 10) : '');

          return (
            <div key={m.id} style={{
              paddingBottom: 14, marginBottom: 14,
              borderBottom: '1px solid rgba(255,255,255,0.06)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {/* Avatar */}
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: m.color || '#6366F1',
                  border: `2px solid ${m.color || '#6366F1'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  overflow: 'hidden', flexShrink: 0,
                }}>
                  {src
                    ? <img src={src} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 20 }}>{m.emoji || '👤'}</span>}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', gap: 8, marginTop: 2 }}>
                    <span style={{ textTransform: 'capitalize' }}>{m.role}</span>
                    <span>· ⭐ {m.stars ?? 0}</span>
                    {(m.streakDays ?? 0) > 0 && <span>· 🔥 {m.streakDays}d streak</span>}
                  </div>
                  {badges.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {badges.slice(0, 3).map(b => {
                        const bm = BADGE_META[b] || { icon: '🏅', label: b, color: '#94A3B8' };
                        return (
                          <span key={b} style={{
                            fontSize: 10, color: bm.color,
                            background: `${bm.color}22`, borderRadius: 10, padding: '1px 6px',
                          }}>{bm.icon} {bm.label}</span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Right: "You" badge OR remove controls */}
                {isMe ? (
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: 'var(--primary)',
                    background: 'rgba(99,102,241,0.15)', borderRadius: 8, padding: '3px 8px',
                    flexShrink: 0,
                  }}>You</span>
                ) : isParent && (
                  isConfirming ? (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button
                        onClick={() => handleRemoveMember(m.id)}
                        disabled={removingId === m.id}
                        style={{
                          padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          background: 'rgba(239,68,68,0.15)', border: '1.5px solid rgba(239,68,68,0.4)',
                          color: '#F87171', cursor: 'pointer',
                        }}
                      >
                        {removingId === m.id ? '…' : 'Remove'}
                      </button>
                      <button
                        onClick={() => setConfirmRemove(null)}
                        style={{
                          padding: '5px 10px', borderRadius: 8, fontSize: 12,
                          background: 'transparent', border: '1px solid rgba(255,255,255,0.12)',
                          color: 'var(--text-muted)', cursor: 'pointer',
                        }}
                      >Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmRemove(m.id)}
                      title={`Remove ${m.name}`}
                      style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        fontSize: 16, padding: '6px', borderRadius: 8, lineHeight: 1,
                        color: 'var(--text-muted)', flexShrink: 0, transition: 'color 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#F87171')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >🗑️</button>
                  )
                )}
              </div>

              {/* ── Birthday row (parents can edit anyone's; kids can only edit their own) ── */}
              {(isParent || isMe) && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>🎂</span>
                  <input
                    type="date"
                    className="input"
                    style={{ flex: 1, fontSize: 12, padding: '6px 10px' }}
                    value={currentBday}
                    onChange={e => setBirthdayEdits(prev => ({ ...prev, [m.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => saveBirthday(m.id, currentBday)}
                    disabled={savingBirthday === m.id}
                    style={{
                      padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: 'rgba(244,114,182,0.15)', border: '1px solid rgba(244,114,182,0.35)',
                      color: '#F472B6', cursor: 'pointer', flexShrink: 0,
                      opacity: savingBirthday === m.id ? 0.5 : 1,
                    }}
                  >
                    {savingBirthday === m.id ? '...' : currentBday ? 'Update' : 'Set'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sign out */}
      <button onClick={() => { logout(); navigate('/login'); }} style={{
        width: '100%', padding: '12px', borderRadius: 12,
        background: 'rgba(248,113,113,0.1)', border: '1.5px solid rgba(248,113,113,0.25)',
        color: '#F87171', fontWeight: 700, fontSize: 15, cursor: 'pointer',
      }}>Sign Out</button>
    </div>
  );
}