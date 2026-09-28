'use client';

import { useEffect, useState, useCallback } from 'react';

interface Event { _id: string; name: string; }
interface Attendee {
  _id: string;
  name: string;
  email: string;
  downloadPin?: string;
  eventId: string;
  mediaCount: number;
  createdAt: string;
}
interface Pagination { page: number; limit: number; total: number; pages: number; }

export default function AttendeesPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [filterEvent, setFilterEvent] = useState('');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', downloadPin: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/events').then(r => r.json()).then(d => setEvents(d.events || []));
  }, []);

  const loadAttendees = useCallback(async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filterEvent) params.set('eventId', filterEvent);
    if (search) params.set('search', search);
    try {
      const res = await fetch(`/api/attendees?${params}`);
      const data = await res.json();
      setAttendees(data.attendees || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } finally { setLoading(false); }
  }, [filterEvent, search]);

  useEffect(() => { loadAttendees(1); }, [loadAttendees]);

  function openEdit(a: Attendee) {
    setEditingAttendee(a);
    setEditForm({ name: a.name, email: a.email, downloadPin: a.downloadPin || '' });
    setError('');
  }

  async function handleSave() {
    if (!editingAttendee) return;
    setError('');
    if (!editForm.name.trim() || !editForm.email.trim()) { setError('Name and email are required.'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/attendees/${editingAttendee._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save.'); return; }
      setEditingAttendee(null);
      loadAttendees(pagination.page);
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(a: Attendee) {
    if (!confirm(`Delete attendee "${a.name}"?`)) return;
    await fetch(`/api/attendees/${a._id}`, { method: 'DELETE' });
    loadAttendees(pagination.page);
  }

  return (
    <>
      <div className="admin-topbar">
        <h2 className="admin-topbar-title">Attendees</h2>
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--color-dark-grey)' }}>
          {pagination.total.toLocaleString()} total
        </p>
      </div>

      <div className="admin-content">
        {/* Filters */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ paddingTop: 16, paddingBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <select className="form-select" style={{ minWidth: 200 }} value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
                <option value="">All Events</option>
                {events.map(ev => <option key={ev._id} value={ev._id}>{ev.name}</option>)}
              </select>
              <div className="search-wrapper">
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  id="attendee-search"
                  className="search-input"
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ minWidth: 280 }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-dark-grey)', fontFamily: 'var(--font-ui)' }}>Loading...</div>
          ) : attendees.length === 0 ? (
            <div className="empty-state">
              <h3>No attendees found</h3>
              <p>Attendees are created automatically when media is uploaded.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Media</th>
                  <th>Added</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((a) => (
                  <tr key={a._id}>
                    <td style={{ fontWeight: 500 }}>{a.name}</td>
                    <td style={{ color: 'var(--color-dark-grey)', fontSize: '0.875rem' }}>{a.email}</td>
                    <td>{a.mediaCount}</td>
                    <td style={{ color: 'var(--color-dark-grey)', fontSize: '0.8rem' }}>{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>Edit</button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(a)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {pagination.pages > 1 && (
          <div className="pagination">
            <button className="page-btn" disabled={pagination.page <= 1} onClick={() => loadAttendees(pagination.page - 1)}>‹</button>
            {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn ${pagination.page === p ? 'active' : ''}`} onClick={() => loadAttendees(p)}>{p}</button>
            ))}
            <button className="page-btn" disabled={pagination.page >= pagination.pages} onClick={() => loadAttendees(pagination.page + 1)}>›</button>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingAttendee && (
        <div className="modal-overlay" onClick={() => setEditingAttendee(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Attendee</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditingAttendee(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input className="form-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input className="form-input" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Download PIN (Optional)</label>
                <input className="form-input" placeholder="e.g. 1234" value={editForm.downloadPin} onChange={e => setEditForm(f => ({ ...f, downloadPin: e.target.value }))} />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-dark-grey)', marginTop: 4, fontFamily: 'var(--font-ui)' }}>
                  Require users to enter this PIN to download their ZIP file.
                </p>
              </div>
              {error && <p className="error-text">{error}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditingAttendee(null)}>Cancel</button>
              <button className="btn btn-accent" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
