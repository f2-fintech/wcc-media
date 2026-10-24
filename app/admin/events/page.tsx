'use client';

import { useEffect, useState, useCallback } from 'react';
import { formatDate } from '@/lib/utils';
import { useDebounce } from '@/lib/useDebounce';

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

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
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
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 10, total: 0, pages: 0 });

  const [showForm, setShowForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadEvents = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      const res = await fetch(`/api/events?${params}`);
      const data = await res.json();
      setEvents(data.events || []);
      setPagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 0 });
    } catch {
      setError('Failed to load events.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    loadEvents(1);
  }, [loadEvents]);

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
      loadEvents(pagination.page);
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  async function handleToggleActive(event: Event) {
    await fetch(`/api/events/${event._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !event.active }),
    });
    loadEvents(pagination.page);
  }

  async function handleDelete(event: Event) {
    if (!confirm(`Delete event "${event.name}"? This cannot be undone.`)) return;
    await fetch(`/api/events/${event._id}`, { method: 'DELETE' });
    loadEvents(pagination.page);
  }

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h2 className="admin-topbar-title">Events</h2>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--color-dark-grey)', marginTop: 2 }}>
            {pagination.total} event(s) total · Paginated to 10 per page
          </p>
        </div>
        <button id="new-event-btn" className="btn btn-accent btn-sm" onClick={openNew}>
          + New Event
        </button>
      </div>

      <div className="admin-content">
        {/* Search Bar */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ paddingTop: 14, paddingBottom: 14 }}>
            <div className="search-wrapper" style={{ maxWidth: 360 }}>
              <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                className="search-input"
                placeholder="Search events by name or slug..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%' }}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: 12,
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

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
              <h3>No events found</h3>
              <p>{search ? 'Try a different search term.' : 'Create your first event to get started.'}</p>
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

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="pagination">
            <button className="page-btn" disabled={pagination.page <= 1} onClick={() => loadEvents(pagination.page - 1)}>‹</button>
            {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn ${pagination.page === p ? 'active' : ''}`} onClick={() => loadEvents(p)}>{p}</button>
            ))}
            <button className="page-btn" disabled={pagination.page >= pagination.pages} onClick={() => loadEvents(pagination.page + 1)}>›</button>
          </div>
        )}
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
                  placeholder="e.g. White Coat Club Gala"
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setForm((f) => ({
                      ...f,
                      name,
                      slug: !editingEvent ? slugify(name) : f.slug,
                    }));
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Slug *</label>
                <input
                  id="event-slug-input"
                  className="form-input"
                  placeholder="e.g. white-coat-club-gala"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-dark-grey)', marginTop: 4, fontFamily: 'var(--font-ui)' }}>
                  Used in URL: /event-slug/gallery
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-textarea"
                  placeholder="Optional description of this event..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
                    style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }}
                  />
                  Active (visible in public gallery)
                </label>
              </div>
              {error && <p className="error-text">{error}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button id="save-event-btn" className="btn btn-accent" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingEvent ? 'Save Changes' : 'Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
