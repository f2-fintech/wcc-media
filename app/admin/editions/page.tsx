'use client';

import { useEffect, useState } from 'react';
import { slugify } from '@/lib/utils';

interface Event { _id: string; name: string; }
interface Edition {
  _id: string;
  eventId: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  order: number;
  createdAt: string;
}

export default function EditionsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEdition, setEditingEdition] = useState<Edition | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', status: 'active', order: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/events').then((r) => r.json()).then((data) => {
      setEvents(data.events || []);
      if (data.events?.length > 0) setSelectedEventId(data.events[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedEventId) return;
    setLoading(true);
    fetch(`/api/editions?eventId=${selectedEventId}`)
      .then((r) => r.json())
      .then((data) => setEditions(data.editions || []))
      .finally(() => setLoading(false));
  }, [selectedEventId]);

  function openNew() {
    setEditingEdition(null);
    setForm({ name: '', slug: '', status: 'active', order: editions.length });
    setError('');
    setShowForm(true);
  }

  function openEdit(ed: Edition) {
    setEditingEdition(ed);
    setForm({ name: ed.name, slug: ed.slug, status: ed.status, order: ed.order });
    setError('');
    setShowForm(true);
  }

  async function handleSave() {
    setError('');
    if (!form.name.trim() || !form.slug.trim()) { setError('Name and slug are required.'); return; }
    setSaving(true);
    try {
      const url = editingEdition ? `/api/editions/${editingEdition._id}` : '/api/editions';
      const method = editingEdition ? 'PATCH' : 'POST';
      const body = editingEdition
        ? { name: form.name, slug: form.slug, status: form.status, order: form.order }
        : { eventId: selectedEventId, name: form.name, slug: form.slug, status: form.status, order: form.order };
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save.'); return; }
      setShowForm(false);
      // Reload
      fetch(`/api/editions?eventId=${selectedEventId}`).then(r => r.json()).then(d => setEditions(d.editions || []));
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(ed: Edition) {
    if (!confirm(`Delete edition "${ed.name}"?`)) return;
    await fetch(`/api/editions/${ed._id}`, { method: 'DELETE' });
    fetch(`/api/editions?eventId=${selectedEventId}`).then(r => r.json()).then(d => setEditions(d.editions || []));
  }

  async function handleToggle(ed: Edition) {
    await fetch(`/api/editions/${ed._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: ed.status === 'active' ? 'inactive' : 'active' }),
    });
    fetch(`/api/editions?eventId=${selectedEventId}`).then(r => r.json()).then(d => setEditions(d.editions || []));
  }

  return (
    <>
      <div className="admin-topbar">
        <h2 className="admin-topbar-title">Event Editions</h2>
        <button id="new-edition-btn" className="btn btn-accent btn-sm" onClick={openNew}>+ Add Edition</button>
      </div>

      <div className="admin-content">
        {/* Event selector */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ paddingTop: 16, paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Select Event:</label>
              <select
                className="form-select"
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                style={{ maxWidth: 300 }}
              >
                {events.map((e) => (<option key={e._id} value={e._id}>{e.name}</option>))}
              </select>
            </div>
          </div>
        </div>

        {/* Editions table */}
        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-dark-grey)', fontFamily: 'var(--font-ui)' }}>Loading...</div>
          ) : editions.length === 0 ? (
            <div className="empty-state">
              <h3>No editions yet</h3>
              <p>Add the first edition for this event.</p>
              <button className="btn btn-accent" style={{ marginTop: 16 }} onClick={openNew}>Add Edition</button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Edition Name</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {editions.map((ed) => (
                  <tr key={ed._id}>
                    <td style={{ color: 'var(--color-dark-grey)', width: 60 }}>{ed.order}</td>
                    <td style={{ fontWeight: 500 }}>{ed.name}</td>
                    <td><code style={{ fontSize: '0.8rem', background: 'var(--color-cream)', padding: '2px 6px', borderRadius: 4 }}>{ed.slug}</code></td>
                    <td><span className={`badge ${ed.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>{ed.status}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(ed)}>Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(ed)} style={{ color: ed.status === 'active' ? 'var(--color-error)' : 'var(--color-success)' }}>
                          {ed.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(ed)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingEdition ? 'Edit Edition' : 'New Edition'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Edition Name *</label>
                <input
                  id="edition-name-input"
                  className="form-input"
                  placeholder="e.g. White Coat Club 2026"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({ ...f, name, ...(editingEdition ? {} : { slug: slugify(name) }) }));
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Slug *</label>
                <input
                  id="edition-slug-input"
                  className="form-input"
                  placeholder="white-coat-club-2026"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Display Order</label>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  value={form.order}
                  onChange={(e) => setForm((f) => ({ ...f, order: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {error && <p className="error-text">{error}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button id="save-edition-btn" className="btn btn-accent" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
