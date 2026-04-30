import { useEffect, useState, useCallback } from 'react';
import {
  Mail, Check, X, Edit3, Send, RefreshCw, Phone, Inbox,
  Sparkles, AlertTriangle, Clock, Building, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── API helper ─────────────────────────────────────────────

function api() {
  const token = sessionStorage.getItem('ts_admin_pw') || '';
  const headers = { 'x-admin-token': token, 'Content-Type': 'application/json' };
  return {
    listDrafts: () => fetch('/api/closer/drafts', { headers }).then(r => r.json()),
    sendDraft: (id, body) => fetch(`/api/closer/drafts/${id}/send`, { method: 'POST', headers, body: JSON.stringify({ body }) }).then(r => r.json()),
    rejectDraft: (id, reason) => fetch(`/api/closer/drafts/${id}/reject`, { method: 'POST', headers, body: JSON.stringify({ reason }) }).then(r => r.json()),
    pollInbox: () => fetch('/api/closer/poll-inbox', { method: 'POST', headers }).then(r => r.json()),
    scheduledCalls: () => fetch('/api/closer/scheduled-calls', { headers }).then(r => r.json()),
  };
}

// ─── helpers ────────────────────────────────────────────────

function fmtTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtFutureTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const TOOL_LABEL = {
  mark_qualified: { icon: '🟢', label: 'Mark Qualified', color: '#10b981' },
  mark_not_interested: { icon: '⚪', label: 'Opt Out', color: '#94a3b8' },
  schedule_outbound_call: { icon: '📞', label: 'Schedule Call', color: '#0ea5e9' },
  escalate_to_human: { icon: '🟡', label: 'Escalate to You', color: '#f59e0b' },
  propose_calendly: { icon: '📅', label: 'Send Calendly', color: '#863bff' },
};

// ─── Components ─────────────────────────────────────────────

function ToolBadge({ tool }) {
  const meta = TOOL_LABEL[tool.name] || { icon: '⚙️', label: tool.name, color: '#94a3b8' };
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
      borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
      background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}40`,
      marginRight: 6, marginBottom: 6,
    }}>
      <span>{meta.icon}</span>
      <span>{meta.label}</span>
      {tool.name === 'schedule_outbound_call' && tool.input?.scheduled_at_utc && (
        <span style={{ fontWeight: 400, opacity: 0.85 }}> · {fmtFutureTime(tool.input.scheduled_at_utc)}</span>
      )}
    </div>
  );
}

function DraftCard({ entry, onSend, onReject, busy }) {
  const { draft, thread, prospect } = entry;
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(draft.body || '');
  const [showThread, setShowThread] = useState(false);
  const [confirmReject, setConfirmReject] = useState(false);

  const inbound = (thread || []).filter(m => m.direction === 'inbound').slice(-1)[0];

  return (
    <div style={{
      background: 'var(--surface, #0f172a)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12, padding: 16, marginBottom: 16,
    }}>
      {/* Header — prospect */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          background: 'rgba(134,59,255,0.15)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Building size={18} style={{ color: '#863bff' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {prospect?.first_name} {prospect?.last_name}
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {prospect?.title} · {prospect?.company}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {prospect?.email} · {fmtTime(draft.created_at)}
          </div>
        </div>
      </div>

      {/* Their reply */}
      {inbound && (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderLeft: '3px solid #94a3b8',
          padding: '10px 14px', borderRadius: 6, marginBottom: 12,
        }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
            They said {fmtTime(inbound.received_at || inbound.created_at)}
          </div>
          <div style={{ fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
            {(inbound.body || '').slice(0, 600)}
          </div>
        </div>
      )}

      {/* AI draft */}
      <div style={{
        background: 'rgba(134,59,255,0.06)',
        border: '1px solid rgba(134,59,255,0.2)',
        padding: '12px 14px', borderRadius: 6, marginBottom: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: '0.7rem', color: '#863bff', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Sparkles size={12} /> AI draft · subject: {draft.subject}
          </div>
          <button onClick={() => setEditing(!editing)}
            style={{ background: 'none', border: 'none', color: '#863bff', cursor: 'pointer', padding: 4 }}>
            <Edit3 size={14} />
          </button>
        </div>
        {editing ? (
          <textarea value={body} onChange={e => setBody(e.target.value)}
            style={{
              width: '100%', minHeight: 200, fontSize: '0.9rem', padding: 10,
              background: 'rgba(0,0,0,0.2)', color: 'white',
              border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
              fontFamily: 'inherit', lineHeight: 1.5, resize: 'vertical',
            }} />
        ) : (
          <div style={{ fontSize: '0.92rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{body}</div>
        )}
      </div>

      {/* Tool calls */}
      {draft.ai_tool_calls?.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            AI also wants to:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            {draft.ai_tool_calls.map((t, i) => <ToolBadge key={i} tool={t} />)}
          </div>
        </div>
      )}

      {/* Thread expander */}
      {(thread?.length || 0) > 2 && (
        <button onClick={() => setShowThread(!showThread)}
          style={{
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: '0.78rem', padding: '4px 0', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 12,
          }}>
          {showThread ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {showThread ? 'Hide' : 'Show'} full thread ({thread.length} messages)
        </button>
      )}
      {showThread && (
        <div style={{ marginBottom: 12, fontSize: '0.82rem' }}>
          {thread.map((m, i) => (
            <div key={i} style={{
              padding: '8px 10px', marginBottom: 6, borderRadius: 4,
              background: m.direction === 'inbound' ? 'rgba(255,255,255,0.04)' : 'rgba(134,59,255,0.04)',
            }}>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                {m.direction === 'inbound' ? 'THEM' : (m.ai_generated ? 'AI' : 'STEVE')} · {fmtTime(m.created_at)}
              </div>
              <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{(m.body || '').slice(0, 400)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSend(draft.id, editing ? body : null)}
          disabled={busy}
          style={{
            flex: 1, padding: '12px 14px', borderRadius: 8, border: 'none',
            background: '#10b981', color: 'white', fontWeight: 700, fontSize: '0.95rem',
            cursor: busy ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            opacity: busy ? 0.5 : 1,
          }}>
          <Send size={16} /> {editing ? 'Send Edited' : 'Approve & Send'}
        </button>
        {!confirmReject ? (
          <button onClick={() => setConfirmReject(true)}
            disabled={busy}
            style={{
              padding: '12px 16px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)',
              background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontWeight: 600, fontSize: '0.9rem',
              cursor: busy ? 'wait' : 'pointer',
            }}>
            <X size={16} /> Reject
          </button>
        ) : (
          <>
            <button onClick={() => onReject(draft.id, 'manual reject')}
              style={{
                padding: '12px 14px', borderRadius: 8, border: 'none',
                background: '#ef4444', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
              }}>
              Confirm
            </button>
            <button onClick={() => setConfirmReject(false)}
              style={{
                padding: '12px 10px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent', color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer',
              }}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────

export default function Closer() {
  const [drafts, setDrafts] = useState([]);
  const [calls, setCalls] = useState([]);
  const [tab, setTab] = useState('drafts');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [polling, setPolling] = useState(false);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([api().listDrafts(), api().scheduledCalls()]);
      if (d?.error) { setError(d.error); return; }
      setDrafts(Array.isArray(d) ? d : []);
      setCalls(Array.isArray(c) ? c : []);
      setError(null);
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const t = setInterval(reload, 30000);
    return () => clearInterval(t);
  }, [reload]);

  const handleSend = async (id, body) => {
    if (!confirm('Send this reply now?')) return;
    setBusyId(id);
    try {
      const r = await api().sendDraft(id, body);
      if (r?.error) alert('Send failed: ' + r.error);
      else { setDrafts(d => d.filter(x => x.draft.id !== id)); reload(); }
    } catch (e) { alert('Send failed: ' + e.message); }
    finally { setBusyId(null); }
  };

  const handleReject = async (id, reason) => {
    setBusyId(id);
    try {
      await api().rejectDraft(id, reason);
      setDrafts(d => d.filter(x => x.draft.id !== id));
    } catch (e) { alert('Reject failed: ' + e.message); }
    finally { setBusyId(null); }
  };

  const handlePollNow = async () => {
    setPolling(true);
    try {
      const r = await api().pollInbox();
      if (r?.error) alert('Poll failed: ' + r.error);
      reload();
    } catch (e) { alert('Poll failed: ' + e.message); }
    finally { setPolling(false); }
  };

  const upcomingCalls = calls.filter(c => c.status === 'scheduled' || c.status === 'placed');

  return (
    <main style={{
      paddingTop: 72, paddingBottom: 100, maxWidth: 720, margin: '0 auto',
      padding: '72px 16px 100px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, paddingTop: 12 }}>
        <Sparkles size={24} style={{ color: '#863bff' }} />
        <div>
          <h1 style={{ margin: 0, fontSize: '1.4rem' }}>AI Sales Closer</h1>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Approve, edit, or reject AI-drafted replies to prospect inbounds
          </div>
        </div>
      </div>

      {/* Stats + tabs */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16, marginTop: 16,
      }}>
        <Stat label="Pending review" value={drafts.length} accent="#863bff" />
        <Stat label="Calls scheduled" value={upcomingCalls.length} accent="#0ea5e9" />
        <button onClick={handlePollNow} disabled={polling}
          style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8, padding: '8px 10px', cursor: polling ? 'wait' : 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            color: 'inherit',
          }}>
          <RefreshCw size={16} style={{ animation: polling ? 'spin 1s linear infinite' : 'none' }} />
          <div style={{ fontSize: '0.7rem', marginTop: 4, color: 'var(--text-muted)' }}>
            {polling ? 'Polling…' : 'Poll inbox'}
          </div>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
        {['drafts', 'calls'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '10px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
              color: tab === t ? '#863bff' : 'var(--text-muted)',
              borderBottom: `2px solid ${tab === t ? '#863bff' : 'transparent'}`,
              fontWeight: 600, textTransform: 'capitalize', fontSize: '0.92rem',
            }}>
            {t === 'drafts' ? `Drafts (${drafts.length})` : `Scheduled Calls (${upcomingCalls.length})`}
          </button>
        ))}
      </div>

      {error && (
        <div style={{
          padding: 12, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
          borderRadius: 8, color: '#ef4444', fontSize: '0.85rem', marginBottom: 16,
        }}>
          <AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          {error}
        </div>
      )}

      {tab === 'drafts' && (
        loading ? <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading…</div>
        : drafts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <Inbox size={32} style={{ marginBottom: 12, opacity: 0.6 }} />
            <div>No pending drafts. AI auto-generates them when prospects reply.</div>
          </div>
        ) : drafts.map(entry => (
          <DraftCard key={entry.draft.id} entry={entry} onSend={handleSend} onReject={handleReject} busy={busyId === entry.draft.id} />
        ))
      )}

      {tab === 'calls' && (
        upcomingCalls.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <Phone size={32} style={{ marginBottom: 12, opacity: 0.6 }} />
            <div>No scheduled calls. AI books them when prospects propose times.</div>
          </div>
        ) : upcomingCalls.map(c => <CallRow key={c.id} call={c} />)
      )}
    </main>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      padding: 10, borderRadius: 8, textAlign: 'center',
    }}>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color: accent || 'var(--text)' }}>{value}</div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

function CallRow({ call }) {
  const colors = { scheduled: '#0ea5e9', placed: '#10b981', completed: '#94a3b8', failed: '#ef4444', cancelled: '#94a3b8' };
  return (
    <div style={{
      background: 'var(--surface, #0f172a)', border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 8, padding: 14, marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700 }}>{call.prospect_name || call.prospect_email}</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{call.prospect_phone}</div>
        </div>
        <span style={{
          fontSize: '0.7rem', padding: '2px 10px', borderRadius: 12,
          background: `${colors[call.status]}20`, color: colors[call.status], textTransform: 'uppercase',
        }}>{call.status}</span>
      </div>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        {fmtFutureTime(call.scheduled_at)}
      </div>
      {call.context_summary && (
        <div style={{ fontSize: '0.78rem', marginTop: 8, padding: 8, background: 'rgba(255,255,255,0.03)', borderRadius: 4, lineHeight: 1.5 }}>
          {call.context_summary.slice(0, 250)}
        </div>
      )}
    </div>
  );
}
