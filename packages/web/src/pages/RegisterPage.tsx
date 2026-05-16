import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

const EMOJIS = ['👨','👩','🧑','👦','👧','🧒','👴','👵','🧔','👱'];
const COLORS = ['#6366F1','#F472B6','#4ADE80','#F59E0B','#38BDF8','#FB923C','#A78BFA','#34D399'];

export default function RegisterPage() {
  const [familyName, setFamilyName] = useState('');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('👨');
  const [color, setColor] = useState('#6366F1');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { familyName, name, emoji, color, password });
      setAuth(data.token, data.member, data.family);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: 32, background: 'linear-gradient(135deg,#F59E0B,#F472B6,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Create your family
          </div>
        </div>

        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>Family Name</label>
            <input className="input" placeholder="The Smiths" value={familyName} onChange={e => setFamilyName(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>Your Name</label>
            <input className="input" placeholder="Alex" value={name} onChange={e => setName(e.target.value)} required />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8 }}>Your Emoji</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {EMOJIS.map(e => (
                <button type="button" key={e} onClick={() => setEmoji(e)} style={{ fontSize: 22, width: 40, height: 40, borderRadius: 10, border: `2px solid ${emoji === e ? 'var(--primary)' : 'var(--border)'}`, background: 'var(--bg-secondary)', cursor: 'pointer' }}>{e}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8 }}>Your Color</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {COLORS.map(c => (
                <button type="button" key={c} onClick={() => setColor(c)} style={{ width: 32, height: 32, borderRadius: '50%', background: c, border: `3px solid ${color === c ? '#fff' : 'transparent'}`, cursor: 'pointer' }} />
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>Password</label>
            <input className="input" type="password" placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {error && <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.1)', border: '1.5px solid rgba(248,113,113,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--danger)', fontWeight: 700 }}>{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating...' : '🏠 Create Family'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
          Already have a family? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 800 }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
