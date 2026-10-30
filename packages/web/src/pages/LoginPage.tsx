import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { choose } from '../store/dialog';

export default function LoginPage() {
  const [familyCode, setFamilyCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'code' | 'email'>('code');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login', mode === 'email'
        ? { email: email.trim(), password }
        : { familyCode: familyCode.trim().toUpperCase(), name: name.trim(), password });
      if (data.passwordCreated) alert('Your password is now set. Use it every time you sign in.');
      setAuth(data.token, data.member, data.family);
      // Parents with a password shorter than 8 characters are asked to pick a longer one.
      if (data.passwordTooShort) {
        const now = await choose('Please choose a longer password', [
          { label: 'Change it now', value: 'now' }, { label: 'Remind me next time', value: 'later' },
        ], 'Parent accounts can see and delete the whole family’s data, so they now need at least 8 characters. Your current password still works.');
        if (now === 'now') { navigate('/settings'); return; }
      }
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
            Kinroost
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: 14, fontWeight: 600 }}>Welcome back! 👋</p>
        </div>

        {/* Info banner */}
        <div style={{ padding: '12px 16px', background: 'rgba(99,102,241,0.1)', border: '1.5px solid rgba(99,102,241,0.25)', borderRadius: 12, marginBottom: 20, fontSize: 13, color: '#A78BFA', fontWeight: 600, textAlign: 'center' }}>
          Family code, your name and your password or PIN 🔒<br/><span style={{ fontWeight: 500 }}>Forgot it? Parents can reset by email; kids, ask a parent for a new PIN.</span>
        </div>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['code', 'email'] as const).map(m => (
              <button type="button" key={m} onClick={() => setMode(m)} style={{
                flex: 1, padding: '8px', borderRadius: 10, fontSize: 12, fontWeight: 800, cursor: 'pointer',
                background: mode === m ? 'var(--primary)' : 'transparent', color: mode === m ? '#fff' : 'var(--text-muted)',
                border: `1.5px solid ${mode === m ? 'var(--primary)' : 'var(--border)'}`,
              }}>{m === 'code' ? 'Family code + name' : 'Email (parents)'}</button>
            ))}
          </div>
          {mode === 'code' ? (<>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>Family Code</label>
            <input
              className="input"
              placeholder="FAM-XXXXXX"
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

          </>) : (
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required autoFocus />
          </div>
          )}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 }}>Password or PIN</label>
            <input
              className="input"
              type="password"
              placeholder="••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              minLength={4}
              required
            />
          </div>

          <div style={{ textAlign: 'right', marginTop: -6 }}>
            <Link to="/forgot-password" style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>Forgot password?</Link>
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
          <div style={{ marginTop: 10, fontSize: 11 }}><Link to="/privacy" style={{ color: 'var(--text-muted)' }}>Privacy</Link> · <Link to="/terms" style={{ color: 'var(--text-muted)' }}>Terms</Link></div>
        </div>
      </div>
    </div>
  );
}