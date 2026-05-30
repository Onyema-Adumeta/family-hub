import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

export default function LoginPage() {
  const [familyCode, setFamilyCode] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', {
        familyCode: familyCode.trim().toUpperCase(),
        name: name.trim(),
      });
      setAuth(data.token, data.member, data.family);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>🏠</div>
          <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: 32, background: 'linear-gradient(135deg,#F59E0B,#F472B6,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Family Hub
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 14, fontWeight: 600 }}>Welcome back! 👋</p>
        </div>

        {/* Info banner */}
        <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.1)', border: '1.5px solid rgba(99,102,241,0.25)', borderRadius: 12, marginBottom: 20, fontSize: 13, color: '#A78BFA', fontWeight: 600, textAlign: 'center' }}>
          Just your family code + your name — no password needed! 🎉
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>Family Code</label>
            <input
              className="input"
              placeholder="FAM-XXXX"
              value={familyCode}
              onChange={e => setFamilyCode(e.target.value)}
              style={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: 16 }}
              required
              autoFocus
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>Your Name</label>
            <input
              className="input"
              placeholder="Alex"
              value={name}
              onChange={e => setName(e.target.value)}
              required
            />
          </div>

          {error && (
            <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.1)', border: '1.5px solid rgba(248,113,113,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--danger)', fontWeight: 700 }}>
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ marginTop: 4, padding: '14px', fontSize: 15, fontWeight: 800 }} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in →'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>
          New family? <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 800 }}>Create one</Link>
          {' · '}
          <Link to="/join" style={{ color: 'var(--accent)', fontWeight: 800 }}>Join with code</Link>
        </div>
      </div>
    </div>
  );
}