'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/utils';

interface Event {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  active: boolean;
  editionCount?: number;
  mediaCount?: number;
  createdAt: string;
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadEvents() {
    setLoading(true);
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      setEvents(data.events || []);
    } catch { setError('Failed to load events.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadEvents(); }, []);

  function openNew() {
    setEditingEvent(null);
    setForm({ name: '', slug: '', description: '', active: true });
    setError('');
    setShowForm(true);
  }

  function openEdit(event: Event) {
    setEditingEvent(event);
    setForm({ name: event.name, slug: event.slug, description: event.description || '', active: event.active });
    setError('');
    setShowForm(true);
  }

  async function handleSave() {
    setError('');
    if (!form.name.trim() || !form.slug.trim()) {
      setError('Name and slug are required.');
      return;
    }
    setSaving(true);
    try {
      const url = editingEvent ? `/api/events/${editingEvent._id}` : '/api/events';
      const method = editingEvent ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to save.'); return; }
      setShowForm(false);
      loadEvents();
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  async function handleToggleActive(event: Event) {
    await fetch(`/api/events/${event._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !event.active }),
    });
    loadEvents();
  }

  async function handleDelete(event: Event) {
    if (!confirm(`Delete event "${event.name}"? This cannot be undone.`)) return;
    await fetch(`/api/events/${event._id}`, { method: 'DELETE' });
    loadEvents();
  }

  return (
    <>
      <div className="admin-topbar">
        <h2 className="admin-topbar-title">Events</h2>
        <button id="new-event-btn" className="btn btn-accent btn-sm" onClick={openNew}>
          + New Event
        </button>
      </div>

      <div className="admin-content">
        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-dark-grey)', fontFamily: 'var(--font-ui)' }}>
              Loading events...
            </div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
              </div>
              <h3>No events yet</h3>
              <p>Create your first event to get started.</p>
              <button className="btn btn-accent" style={{ marginTop: 16 }} onClick={openNew}>Create Event</button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Event Name</th>
                  <th>Slug</th>
                  <th>Status</th>
                  <th>Editions</th>
                  <th>Media</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event._id}>
                    <td style={{ fontWeight: 500 }}>{event.name}</td>
                    <td><code style={{ fontSize: '0.8rem', background: 'var(--color-cream)', padding: '2px 6px', borderRadius: 4 }}>{event.slug}</code></td>
                    <td>
                      <span className={`badge ${event.active ? 'badge-active' : 'badge-inactive'}`}>
                        {event.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>{event.editionCount ?? 0}</td>
                    <td>{event.mediaCount ?? 0}</td>
                    <td style={{ color: 'var(--color-dark-grey)', fontSize: '0.8rem' }}>
                      {new Date(event.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(event)}>Edit</button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleToggleActive(event)}
                          style={{ color: event.active ? 'var(--color-error)' : 'var(--color-success)' }}
                        >
                          {event.active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(event)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingEvent ? 'Edit Event' : 'New Event'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Event Name *</label>
                <input
                  id="event-name-input"
                  className="form-input"
                  placeholder="e.g. WHITE COAT CLUB"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({ ...f, name, ...(editingEvent ? {} : { slug: slugify(name) }) }));
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Slug *</label>
                <input
                  id="event-slug-input"
                  className="form-input"
                  placeholder="white-coat-club"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-dark-grey)', marginTop: 4, fontFamily: 'var(--font-ui)' }}>
                  URL: /{form.slug}/gallery
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  placeholder="A brief description of the event..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="checkbox-wrapper">
                  <input
                    className="checkbox-input"
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                  />
                  <span className="checkbox-label">Event is active (visible to attendees)</span>
                </label>
              </div>
              {error && <p className="error-text">{error}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button id="save-event-btn" className="btn btn-accent" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
