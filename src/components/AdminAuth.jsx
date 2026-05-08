import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Lock, LogIn, LogOut } from 'lucide-react';

const AuthContext = createContext(null);
const HASH = 'a7adb46eea195572e6d1f418a324673fc33ce5889869c39c67e88aa68eb6fe33';

// Idle timeout — auto-logout after 30 minutes of no activity
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
// Brute-force protection — N failed attempts in window blocks for cooldown
const MAX_ATTEMPTS = 5;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const COOLDOWN_MS = 30 * 60 * 1000;

async function sha256(message) {
  const data = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getAttempts() {
  try { return JSON.parse(sessionStorage.getItem('ts_login_attempts') || '[]'); } catch { return []; }
}
function recordFailedAttempt() {
  const now = Date.now();
  const attempts = getAttempts().filter(t => now - t < ATTEMPT_WINDOW_MS);
  attempts.push(now);
  sessionStorage.setItem('ts_login_attempts', JSON.stringify(attempts));
  return attempts.length;
}
function isLockedOut() {
  const attempts = getAttempts();
  if (attempts.length < MAX_ATTEMPTS) return false;
  const lastAttempt = Math.max(...attempts);
  return (Date.now() - lastAttempt) < COOLDOWN_MS;
}
function getCooldownSecondsRemaining() {
  const attempts = getAttempts();
  if (attempts.length < MAX_ATTEMPTS) return 0;
  const lastAttempt = Math.max(...attempts);
  return Math.max(0, Math.ceil((COOLDOWN_MS - (Date.now() - lastAttempt)) / 1000));
}

export function AuthProvider({ children }) {
  const [authed, setAuthed] = useState(() => {
    if (sessionStorage.getItem('ts_admin') !== 'true') return false;
    // Check if session has timed out
    const lastActivity = parseInt(sessionStorage.getItem('ts_last_activity') || '0', 10);
    if (lastActivity && (Date.now() - lastActivity) > IDLE_TIMEOUT_MS) {
      sessionStorage.removeItem('ts_admin');
      sessionStorage.removeItem('ts_admin_pw');
      sessionStorage.removeItem('ts_last_activity');
      return false;
    }
    return true;
  });
  const idleTimerRef = useRef(null);

  const logout = useCallback(() => {
    sessionStorage.removeItem('ts_admin');
    sessionStorage.removeItem('ts_admin_pw');
    sessionStorage.removeItem('ts_last_activity');
    setAuthed(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
  }, []);

  const resetIdleTimer = useCallback(() => {
    if (!authed) return;
    sessionStorage.setItem('ts_last_activity', String(Date.now()));
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      logout();
      alert('Signed out due to 30 minutes of inactivity.');
    }, IDLE_TIMEOUT_MS);
  }, [authed, logout]);

  // Track activity for idle timeout
  useEffect(() => {
    if (!authed) return;
    resetIdleTimer();
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [authed, resetIdleTimer]);

  const login = async (password) => {
    if (isLockedOut()) {
      return { ok: false, lockedOut: true, retryIn: getCooldownSecondsRemaining() };
    }
    const hash = await sha256(password);
    if (hash === HASH) {
      sessionStorage.setItem('ts_admin', 'true');
      sessionStorage.setItem('ts_admin_pw', password);
      sessionStorage.setItem('ts_last_activity', String(Date.now()));
      sessionStorage.removeItem('ts_login_attempts');
      setAuthed(true);
      return { ok: true };
    }
    const attempts = recordFailedAttempt();
    return { ok: false, attemptsRemaining: Math.max(0, MAX_ATTEMPTS - attempts) };
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
    const adminTileStyle = { padding: '12px 16px', background: 'var(--surface)', borderRadius: '8px', border: '1px solid var(--border)', color: 'var(--text)', fontWeight: 600, fontSize: '0.9rem', textDecoration: 'none', display: 'block' };
    return (
      <main style={{ paddingTop: '72px', minHeight: '60vh' }}>
        <div style={{ maxWidth: '720px', margin: '40px auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <Lock size={36} style={{ color: 'var(--success)', marginBottom: '10px' }} />
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '6px' }}>Admin Access Granted</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              30-min idle timeout active. Sign out when done.
            </p>
          </div>

          {/* DEMO — shareable with prospects */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ padding: '2px 10px', borderRadius: '100px', fontSize: '0.65rem', fontWeight: 700, background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>SAFE TO SHARE</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Public demo URL — shows fake data, no real client info</span>
            </div>
            <a href="/saas?key=tsk_demo_9f42e3c62de1be877830fa37dab0f3f2" target="_blank" rel="noopener noreferrer"
              style={{
                display: 'block', padding: '18px 20px', textDecoration: 'none',
                background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.08))',
                border: '2px solid rgba(16,185,129,0.4)', borderRadius: '10px',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 700, marginBottom: '4px' }}>
                    🌐 Demo Dashboard for Prospects
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)' }}>Open ThermaShift Demo Co dashboard →</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Live SaaS view: 2 sites, 12 sensors, AI Cooling Advisor, Pro auto-action features. Send this URL to any prospect.
                  </div>
                </div>
              </div>
            </a>
          </div>

          {/* INTERNAL — your CRM data */}
          <div style={{ marginBottom: '28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              <span style={{ padding: '2px 10px', borderRadius: '100px', fontSize: '0.65rem', fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>INTERNAL — DO NOT SHARE</span>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>Your real CRM data — leads, audits, proposals</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
              <Link to="/dashboard" style={adminTileStyle}>📊 Sales Pipeline</Link>
              <Link to="/closer" style={{ ...adminTileStyle, background: 'linear-gradient(135deg, rgba(134,59,255,0.15), rgba(0,163,224,0.1))', border: '1px solid rgba(134,59,255,0.4)', color: '#863bff', fontWeight: 700 }}>✨ AI Sales Closer</Link>
              <Link to="/tracker" style={adminTileStyle}>👥 CRM Tracker</Link>
              <Link to="/report" style={adminTileStyle}>📄 Report Generator</Link>
              <Link to="/proposal" style={adminTileStyle}>📋 Proposal & SOW</Link>
              <Link to="/contracts" style={adminTileStyle}>📑 Contract Manager</Link>
              <Link to="/content" style={adminTileStyle}>📢 LinkedIn Content</Link>
            </div>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button onClick={logout} className="btn btn-outline" style={{ padding: '8px 20px', fontSize: '0.85rem' }}>
              <LogOut size={16} /> Sign Out
            </button>
          </div>
        </div>
      </main>
    );
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(password);
    if (!result.ok) {
      if (result.lockedOut) {
        setError(`Too many failed attempts. Try again in ${Math.ceil(result.retryIn / 60)} minute(s).`);
      } else if (result.attemptsRemaining === 0) {
        setError('Too many failed attempts. Locked out for 30 minutes.');
      } else {
        setError(`Incorrect password. ${result.attemptsRemaining} attempt(s) remaining before lockout.`);
      }
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
        <form onSubmit={handleSubmit} className="card" style={{ padding: '28px' }} autoComplete="off">
          {/* Hidden honeypot fields trick browsers' aggressive autofill into filling these instead of the real password field */}
          <input type="text" name="username" autoComplete="username" style={{ display: 'none' }} aria-hidden="true" tabIndex="-1" />
          <input type="password" name="fakepassword" autoComplete="current-password" style={{ display: 'none' }} aria-hidden="true" tabIndex="-1" />

          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="ts-admin-pw">Password</label>
            <input
              id="ts-admin-pw"
              name="ts-admin-pw-no-autofill"
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter admin password"
              autoComplete="new-password"
              data-lpignore="true"
              data-form-type="other"
              data-1p-ignore="true"
              required
            />
          </div>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600,
            }}>
              {error}
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
