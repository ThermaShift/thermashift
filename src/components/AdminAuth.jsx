import { createContext, useContext, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Lock, LogIn, LogOut } from 'lucide-react';

const AuthContext = createContext(null);
const HASH = '6a1cf8ff6fa4491a4b3d9e22d6ef2ea31f2873c631fce4401ee49d6be788762f';

async function sha256(message) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('ts_admin') === 'true');

  const login = async (password) => {
    const hash = await sha256(password);
    if (hash === HASH) {
      sessionStorage.setItem('ts_admin', 'true');
      setAuthed(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    sessionStorage.removeItem('ts_admin');
    setAuthed(false);
  };

  return (
    <AuthContext.Provider value={{ authed, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function ProtectedRoute({ children }) {
  const { authed } = useAuth();
  if (!authed) return <Navigate to="/admin" replace />;
  return children;
}

export function AdminLogin() {
  const { authed, login, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  if (authed) {
    return (
      <main style={{ paddingTop: '72px', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <Lock size={48} style={{ color: 'var(--success)', marginBottom: '16px' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Admin Access Granted</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
            You have access to internal tools. Use the links below or navigate directly.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
            <Link to="/tracker" style={{ padding: '12px 20px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}>
              CRM Tracker
            </Link>
            <Link to="/report" style={{ padding: '12px 20px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}>
              Report Generator
            </Link>
            <Link to="/proposal" style={{ padding: '12px 20px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}>
              Proposal & SOW Generator
            </Link>
            <Link to="/monitor" style={{ padding: '12px 20px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}>
              Client Monitoring Platform
            </Link>
            <a href="/agent/INSTALL.html" target="_blank" rel="noopener noreferrer" style={{ padding: '12px 20px', background: 'var(--primary)', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none' }}>
              Agent Install Guide (share with clients)
            </a>
          </div>
          <button onClick={logout} className="btn btn-outline" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </main>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const success = await login(password);
    if (!success) {
      setError(true);
      setPassword('');
    }
    setLoading(false);
  };

  return (
    <main style={{ paddingTop: '72px', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '380px', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Lock size={48} style={{ color: 'var(--accent)', marginBottom: '16px' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '8px' }}>Admin Access</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Enter your password to access internal tools.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="card" style={{ padding: '28px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(false); }}
              placeholder="Enter admin password"
              autoFocus
              required
            />
          </div>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600,
            }}>
              Incorrect password. Try again.
            </div>
          )}
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}>
            <LogIn size={18} /> {loading ? 'Verifying...' : 'Sign In'}
          </button>
        </form>
      </div>
    </main>
  );
}
