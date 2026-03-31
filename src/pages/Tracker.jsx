import { useState } from 'react';
import { Users, Plus, Trash2, Edit3, Check, X, Search, Filter } from 'lucide-react';

const INITIAL_PROSPECTS = [
  { id: 1, company: 'Flexential', contact: 'Director of Facilities', location: 'Charlotte, NC', status: 'New', notes: 'Multiple facilities, AI colocation growth', lastContact: '', nextFollowUp: '' },
  { id: 2, company: 'QTS Data Centers', contact: 'VP of Engineering', location: 'Wake Forest, NC', status: 'New', notes: '200 Turner Blvd, closest major operator', lastContact: '', nextFollowUp: '' },
  { id: 3, company: 'DataBank', contact: 'Director of DC Operations', location: 'Charlotte, NC', status: 'New', notes: 'Charlotte presence, growing', lastContact: '', nextFollowUp: '' },
  { id: 4, company: 'Aligned Data Centers', contact: 'Chief Sustainability Officer', location: 'Charlotte, NC', status: 'New', notes: 'Charlotte market expansion', lastContact: '', nextFollowUp: '' },
  { id: 5, company: 'Google', contact: 'Data Center Site Lead', location: 'Maiden, NC', status: 'New', notes: '~1 hour from Harrisburg', lastContact: '', nextFollowUp: '' },
  { id: 6, company: 'Apple', contact: 'Facilities Manager', location: 'Maiden, NC', status: 'New', notes: 'Same area as Google campus', lastContact: '', nextFollowUp: '' },
  { id: 7, company: 'Meta', contact: 'Director of Sustainability', location: 'Forest City, NC', status: 'New', notes: '~2 hours from Harrisburg', lastContact: '', nextFollowUp: '' },
  { id: 8, company: 'PowerHouse Data Centers', contact: 'VP of Engineering', location: 'Charlotte, NC', status: 'New', notes: '122-acre, 300MW, construction Q1 2025', lastContact: '', nextFollowUp: '' },
  { id: 9, company: 'Microsoft', contact: 'DC Engineering Manager', location: 'Conover, NC', status: 'New', notes: '$1B Catawba County build, under construction', lastContact: '', nextFollowUp: '' },
  { id: 10, company: 'Digital Realty', contact: 'VP of Development', location: 'Charlotte, NC', status: 'New', notes: '400MW campus, rezoning approved May 2025', lastContact: '', nextFollowUp: '' },
];

const STATUSES = ['New', 'Contacted', 'Meeting Set', 'Proposal Sent', 'Negotiating', 'Won', 'Lost'];
const STATUS_COLORS = {
  'New': '#64748b',
  'Contacted': '#06b6d4',
  'Meeting Set': '#8b5cf6',
  'Proposal Sent': '#f59e0b',
  'Negotiating': '#f97316',
  'Won': '#10b981',
  'Lost': '#ef4444',
};

export default function Tracker() {
  const [prospects, setProspects] = useState(() => {
    try {
      const saved = localStorage.getItem('thermashift_prospects');
      return saved ? JSON.parse(saved) : INITIAL_PROSPECTS;
    } catch {
      return INITIAL_PROSPECTS;
    }
  });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [filterStatus, setFilterStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProspect, setNewProspect] = useState({
    company: '', contact: '', location: '', status: 'New', notes: '', lastContact: '', nextFollowUp: '',
  });

  const save = (updated) => {
    setProspects(updated);
    localStorage.setItem('thermashift_prospects', JSON.stringify(updated));
  };

  const addProspect = () => {
    if (!newProspect.company) return;
    const next = [...prospects, { ...newProspect, id: Date.now() }];
    save(next);
    setNewProspect({ company: '', contact: '', location: '', status: 'New', notes: '', lastContact: '', nextFollowUp: '' });
    setShowAddForm(false);
  };

  const deleteProspect = (id) => {
    save(prospects.filter(p => p.id !== id));
  };

  const startEdit = (prospect) => {
    setEditingId(prospect.id);
    setEditForm({ ...prospect });
  };

  const saveEdit = () => {
    save(prospects.map(p => p.id === editingId ? editForm : p));
    setEditingId(null);
  };

  const filtered = prospects
    .filter(p => filterStatus === 'All' || p.status === filterStatus)
    .filter(p =>
      p.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.contact.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.location.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const statusCounts = STATUSES.reduce((acc, s) => {
    acc[s] = prospects.filter(p => p.status === s).length;
    return acc;
  }, {});

  return (
    <main style={{ paddingTop: '72px', minHeight: '100vh' }}>
      <section style={{ padding: '40px 0' }}>
        <div className="container">
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <Users size={22} style={{ color: 'var(--accent)' }} />
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Client Outreach Tracker</h1>
              </div>
              <p style={{ color: 'var(--text-dim)', fontSize: '0.85rem' }}>
                {prospects.length} prospects | {statusCounts['Won'] || 0} won
              </p>
            </div>
            <button onClick={() => setShowAddForm(!showAddForm)} className="btn btn-primary" style={{ padding: '10px 20px' }}>
              <Plus size={18} /> Add Prospect
            </button>
          </div>

          {/* Pipeline summary */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setFilterStatus('All')}
              style={{
                padding: '6px 14px', borderRadius: '100px', fontSize: '0.8rem', fontWeight: 600,
                background: filterStatus === 'All' ? 'var(--accent)' : 'var(--surface)',
                color: filterStatus === 'All' ? 'var(--primary)' : 'var(--text-muted)',
                border: '1px solid var(--border)', cursor: 'pointer',
              }}
            >
              All ({prospects.length})
            </button>
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                style={{
                  padding: '6px 14px', borderRadius: '100px', fontSize: '0.8rem', fontWeight: 600,
                  background: filterStatus === s ? STATUS_COLORS[s] + '20' : 'var(--surface)',
                  color: filterStatus === s ? STATUS_COLORS[s] : 'var(--text-muted)',
                  border: `1px solid ${filterStatus === s ? STATUS_COLORS[s] + '40' : 'var(--border)'}`,
                  cursor: 'pointer',
                }}
              >
                {s} ({statusCounts[s] || 0})
              </button>
            ))}
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '400px' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              placeholder="Search companies, contacts, locations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
          </div>

          {/* Add form */}
          {showAddForm && (
            <div className="card" style={{ marginBottom: '20px', padding: '24px' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px' }}>Add New Prospect</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <div>
                  <label>Company *</label>
                  <input value={newProspect.company} onChange={(e) => setNewProspect({ ...newProspect, company: e.target.value })} placeholder="CoreWeave" />
                </div>
                <div>
                  <label>Contact Title</label>
                  <input value={newProspect.contact} onChange={(e) => setNewProspect({ ...newProspect, contact: e.target.value })} placeholder="VP of Engineering" />
                </div>
                <div>
                  <label>Location</label>
                  <input value={newProspect.location} onChange={(e) => setNewProspect({ ...newProspect, location: e.target.value })} placeholder="Charlotte, NC" />
                </div>
                <div>
                  <label>Status</label>
                  <select value={newProspect.status} onChange={(e) => setNewProspect({ ...newProspect, status: e.target.value })}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label>Notes</label>
                  <input value={newProspect.notes} onChange={(e) => setNewProspect({ ...newProspect, notes: e.target.value })} placeholder="Key details..." />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button onClick={addProspect} className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  <Check size={16} /> Save
                </button>
                <button onClick={() => setShowAddForm(false)} className="btn btn-outline" style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Company', 'Contact', 'Location', 'Status', 'Notes', 'Last Contact', 'Next Follow-up', ''].map(h => (
                    <th key={h} style={{
                      padding: '12px 16px', textAlign: 'left', fontSize: '0.75rem',
                      fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    {editingId === p.id ? (
                      <>
                        <td style={{ padding: '8px 16px' }}><input value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} style={{ padding: '6px 10px', fontSize: '0.85rem' }} /></td>
                        <td style={{ padding: '8px 16px' }}><input value={editForm.contact} onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })} style={{ padding: '6px 10px', fontSize: '0.85rem' }} /></td>
                        <td style={{ padding: '8px 16px' }}><input value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} style={{ padding: '6px 10px', fontSize: '0.85rem' }} /></td>
                        <td style={{ padding: '8px 16px' }}>
                          <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} style={{ padding: '6px 10px', fontSize: '0.85rem' }}>
                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '8px 16px' }}><input value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} style={{ padding: '6px 10px', fontSize: '0.85rem' }} /></td>
                        <td style={{ padding: '8px 16px' }}><input type="date" value={editForm.lastContact} onChange={(e) => setEditForm({ ...editForm, lastContact: e.target.value })} style={{ padding: '6px 10px', fontSize: '0.85rem' }} /></td>
                        <td style={{ padding: '8px 16px' }}><input type="date" value={editForm.nextFollowUp} onChange={(e) => setEditForm({ ...editForm, nextFollowUp: e.target.value })} style={{ padding: '6px 10px', fontSize: '0.85rem' }} /></td>
                        <td style={{ padding: '8px 16px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={saveEdit} style={{ background: 'none', border: 'none', color: 'var(--success)', padding: '4px' }}><Check size={16} /></button>
                            <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', padding: '4px' }}><X size={16} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.9rem' }}>{p.company}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.contact}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{p.location}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '100px', fontSize: '0.75rem', fontWeight: 700,
                            background: STATUS_COLORS[p.status] + '15', color: STATUS_COLORS[p.status],
                            border: `1px solid ${STATUS_COLORS[p.status]}30`,
                          }}>{p.status}</span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: '0.85rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.notes}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>{p.lastContact || '—'}</td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-dim)', fontSize: '0.85rem' }}>{p.nextFollowUp || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => startEdit(p)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', padding: '4px', cursor: 'pointer' }}><Edit3 size={14} /></button>
                            <button onClick={() => deleteProspect(p.id)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)', padding: '4px', cursor: 'pointer' }}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-dim)' }}>
              No prospects match your filters.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
