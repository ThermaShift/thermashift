import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Copy, Check, ArrowLeft } from 'lucide-react';

export default function DemoLibrary() {
  const [demos, setDemos] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    fetch('/api/demos/library')
      .then(r => r.json())
      .then(setDemos)
      .catch(() => setDemos([]));
  }, []);

  const copyUrl = async (id, url) => {
    const fullUrl = `https://thermashift.net${url}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = fullUrl;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <main style={{ paddingTop: 72, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1080, margin: '40px auto', padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <Link to="/admin" style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', fontSize: '0.85rem' }}>
            <ArrowLeft size={16} /> Back to admin
          </Link>
        </div>

        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: '1.6rem', margin: 0 }}>Demo Library</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 6, fontSize: '0.9rem' }}>
            Pick the scenario that matches the conversation you're having. Each demo has its own company name, sites, sensors, AI advisor analysis, and recommendations — every tab tells that scenario's story. URLs are public and safe to share with prospects.
          </p>
        </div>

        {demos === null && <div style={{ padding: 40, textAlign: 'center' }}>Loading…</div>}

        {demos && demos.length === 0 && (
          <div className="card" style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)' }}>
            <strong>No demos seeded yet.</strong>
            <p style={{ fontSize: '0.85rem', marginTop: 8 }}>
              Run on the VPS: <code>node server/seed-all-demos.js</code> to populate all scenarios. Make sure SQL migrations v6, v7, and v8 have been applied first.
            </p>
          </div>
        )}

        {demos && demos.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
            {demos.map(d => (
              <div key={d.id} className="card" style={{
                padding: 18,
                background: 'linear-gradient(135deg, rgba(134,59,255,0.04), transparent)',
                border: '1px solid rgba(134,59,255,0.2)',
                display: 'flex', flexDirection: 'column', gap: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ fontSize: '1.6rem', lineHeight: 1 }}>{d.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '1rem', fontWeight: 700 }}>{d.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {d.company}
                    </div>
                  </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text)', lineHeight: 1.5, margin: '4px 0' }}>
                  {d.blurb}
                </p>

                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  <strong style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Best for:</strong> {d.bestFor}
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 'auto' }}>
                  <a href={d.url} target="_blank" rel="noopener noreferrer"
                    style={{
                      flex: 1, padding: '8px 10px', borderRadius: 6,
                      background: '#10b981', color: 'white',
                      fontSize: '0.82rem', fontWeight: 700, textAlign: 'center',
                      textDecoration: 'none', display: 'inline-flex',
                      alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>
                    <ExternalLink size={14} /> Open Demo
                  </a>
                  <button onClick={() => copyUrl(d.id, d.url)}
                    style={{
                      padding: '8px 12px', borderRadius: 6,
                      background: copiedId === d.id ? '#10b981' : 'rgba(134,59,255,0.15)',
                      color: copiedId === d.id ? 'white' : '#863bff',
                      border: '1px solid rgba(134,59,255,0.3)',
                      fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                    {copiedId === d.id ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy URL</>}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 32, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          <strong>How to use:</strong> Pick the demo matching your prospect's situation. Click "Open Demo" to preview, or "Copy URL" to paste into an email/LinkedIn DM. Each demo is independent — same prospect can compare scenarios, or you can A/B test which one resonates.
        </div>
      </div>
    </main>
  );
}
