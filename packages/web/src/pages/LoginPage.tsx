import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

export default function LoginPage() {
  const [familyCode, setFamilyCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { familyCode: familyCode.toUpperCase(), name, password });
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
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: 'Fredoka One, cursive', fontSize: 36, background: 'linear-gradient(135deg,#F59E0B,#F472B6,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Family Hub
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 14, fontWeight: 600 }}>Welcome back! 👋</p>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>Family Code</label>
            <input className="input" placeholder="FAM-XXXX" value={familyCode} onChange={e => setFamilyCode(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>Your Name</label>
            <input className="input" placeholder="Alex" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>Password</label>
            <input className="input" type="password" placeholder="••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>

          {error && <div style={{ padding: '10px 14px', background: 'rgba(248,113,113,0.1)', border: '1.5px solid rgba(248,113,113,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--danger)', fontWeight: 700 }}>{error}</div>}

          <button type="submit" className="btn btn-primary" style={{ marginTop: 4 }} disabled={loading}>
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
