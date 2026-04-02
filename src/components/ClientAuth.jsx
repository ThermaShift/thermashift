import { createContext, useContext, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Building, LogIn, LogOut } from 'lucide-react';

const SUPABASE_URL = 'https://auqklthrpvsqyelfjood.supabase.co/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1cWtsdGhycHZzcXllbGZqb29kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwNzYxOTksImV4cCI6MjA5MDY1MjE5OX0.xWWKByjiASSOC9QqhHdj2M8NkifsjJhXrFBYmpeXVH4';

const ClientAuthContext = createContext(null);

export function ClientAuthProvider({ children }) {
  const [client, setClient] = useState(() => {
    const saved = sessionStorage.getItem('ts_client');
    return saved ? JSON.parse(saved) : null;
  });

  const login = async (facilityId, apiKey) => {
    try {
      const url = `${SUPABASE_URL}/clients?facility_id=eq.${encodeURIComponent(facilityId)}&api_key=eq.${encodeURIComponent(apiKey)}&status=eq.active&select=client_name,facility_id,max_racks`;
      const resp = await fetch(url, {
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      });
      if (!resp.ok) return false;
      const rows = await resp.json();
      if (rows.length !== 1) return false;

      const clientData = { ...rows[0], apiKey };
      sessionStorage.setItem('ts_client', JSON.stringify(clientData));
      setClient(clientData);
      return true;
    } catch {
      return false;
    }
  };

  const logout = () => {
    sessionStorage.removeItem('ts_client');
    setClient(null);
  };

  return (
    <ClientAuthContext.Provider value={{ client, login, logout }}>
      {children}
    </ClientAuthContext.Provider>
  );
}

export function useClientAuth() {
  return useContext(ClientAuthContext);
}

export function ClientProtectedRoute({ children }) {
  const { client } = useClientAuth();
  if (!client) return <Navigate to="/portal" replace />;
  return children;
}

export function ClientLogin() {
  const { client, login, logout } = useClientAuth();
  const [facilityId, setFacilityId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  if (client) {
    return <Navigate to="/portal/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const success = await login(facilityId.trim(), apiKey.trim());
    if (!success) setError(true);
    setLoading(false);
  };

  return (
    <main style={{ paddingTop: '72px', minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '420px', padding: '0 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Building size={48} style={{ color: 'var(--accent)', marginBottom: '16px' }} />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '4px' }}>
            Therma<span style={{ color: 'var(--accent)' }}>Shift</span> Client Portal
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Access your facility monitoring dashboard
          </p>
        </div>
        <form onSubmit={handleSubmit} className="card" style={{ padding: '28px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label>Facility ID</label>
            <input
              value={facilityId}
              onChange={(e) => { setFacilityId(e.target.value); setError(false); }}
              placeholder="your-facility-id"
              required
            />
            <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>
              Provided by your ThermaShift administrator
            </span>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label>API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); setError(false); }}
              placeholder="Enter your API key"
              required
            />
          </div>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
              color: 'var(--danger)', fontSize: '0.85rem', fontWeight: 600,
            }}>
              Invalid credentials or inactive account. Contact your ThermaShift administrator.
            </div>
          )}
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}>
            <LogIn size={18} /> {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: '0.8rem', color: 'var(--text-dim)' }}>
          Need access? Contact <a href="mailto:info@thermashift.net">info@thermashift.net</a>
        </p>
      </div>
    </main>
  );
}
