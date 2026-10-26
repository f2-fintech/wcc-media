'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { slugify } from '@/lib/utils';
import SearchableSelect from '@/components/admin/SearchableSelect';
import { useDebounce } from '@/lib/useDebounce';

interface Event { _id: string; name: string; }
interface Edition {
  _id: string;
  eventId: string;
  name: string;
  slug: string;
  status: 'active' | 'inactive';
  order: number;
  mediaCount?: number;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export default function EditionsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 15, total: 0, pages: 0 });

  const [showForm, setShowForm] = useState(false);
  const [editingEdition, setEditingEdition] = useState<Edition | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', status: 'active', order: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch all events for autocomplete dropdown
  useEffect(() => {
    fetch('/api/events?all=true').then((r) => r.json()).then((data) => {
      const evList = data.events || [];
      setEvents(evList);
      if (evList.length > 0) setSelectedEventId(evList[0]._id);
    });
  }, []);

  const loadEditions = useCallback(async (page = 1) => {
    if (!selectedEventId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        eventId: selectedEventId,
        page: String(page),
        limit: '15',
      });
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      const res = await fetch(`/api/editions?${params}`);
      const data = await res.json();
      setEditions(data.editions || []);
      setPagination(data.pagination || { page: 1, limit: 15, total: 0, pages: 0 });
    } catch {
      setError('Failed to load editions.');
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, debouncedSearch]);

  useEffect(() => {
    loadEditions(1);
  }, [loadEditions]);

  function openNew() {
    setEditingEdition(null);
    setForm({ name: '', slug: '', status: 'active', order: pagination.total });
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
      loadEditions(pagination.page);
    } catch { setError('Network error.'); }
    finally { setSaving(false); }
  }

  async function handleDelete(ed: Edition) {
    if (!confirm(`Delete edition "${ed.name}"?`)) return;
    await fetch(`/api/editions/${ed._id}`, { method: 'DELETE' });
    loadEditions(pagination.page);
  }

  async function handleToggle(ed: Edition) {
    await fetch(`/api/editions/${ed._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: ed.status === 'active' ? 'inactive' : 'active' }),
    });
    loadEditions(pagination.page);
  }

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h2 className="admin-topbar-title">Event Editions</h2>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--color-dark-grey)', marginTop: 2 }}>
            {pagination.total} edition(s) · Paginated to 15 per page
          </p>
        </div>
        <button id="new-edition-btn" className="btn btn-accent btn-sm" onClick={openNew}>+ Add Edition</button>
      </div>

      <div className="admin-content">
        {/* Event selector & Search */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ paddingTop: 16, paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 260, flex: '1 1 260px' }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Select Event</label>
                <SearchableSelect
                  value={selectedEventId}
                  onChange={(val) => setSelectedEventId(val)}
                  placeholder="Select an Event..."
                  searchPlaceholder="Search events..."
                  options={events.map((e) => ({
                    value: e._id,
                    label: e.name,
                    icon: '📅',
                  }))}
                />
              </div>

              <div style={{ minWidth: 240, flex: '2 1 280px' }}>
                <label className="form-label" style={{ marginBottom: 4 }}>Filter Editions</label>
                <div className="search-wrapper" style={{ width: '100%' }}>
                  <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                  </svg>
                  <input
                    className="search-input"
                    placeholder="Search edition by name..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
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
          </div>
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-dark-grey)', fontFamily: 'var(--font-ui)' }}>Loading editions...</div>
          ) : editions.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polygon points="12 2 22 8.5 12 15 2 8.5"/><polyline points="2 15.5 12 22 22 15.5"/><polyline points="2 12 12 18.5 22 12"/>
                </svg>
              </div>
              <h3>No editions found</h3>
              <p>{search ? 'No editions match your search.' : 'Add your first edition for this event (e.g. 2024, Summer Edition).'}</p>
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
                  <th>Media Files</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {editions.map((ed) => (
                  <tr key={ed._id}>
                    <td style={{ color: 'var(--color-dark-grey)', fontWeight: 600 }}>#{ed.order}</td>
                    <td style={{ fontWeight: 500 }}>{ed.name}</td>
                    <td><code style={{ fontSize: '0.8rem', background: 'var(--color-cream)', padding: '2px 6px', borderRadius: 4 }}>{ed.slug}</code></td>
                    <td>
                      <span className={`badge ${ed.status === 'active' ? 'badge-active' : 'badge-inactive'}`}>
                        {ed.status}
                      </span>
                    </td>
                    <td>{ed.mediaCount ?? 0} files</td>
                    <td style={{ color: 'var(--color-dark-grey)', fontSize: '0.8rem' }}>{new Date(ed.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link
                          href={`/admin/banner?eventId=${selectedEventId}&editionId=${ed._id}`}
                          className="btn btn-ghost btn-sm"
                          title="Manage Banner for this Edition"
                          style={{ textDecoration: 'none' }}
                        >
                          🖼️ Banner
                        </Link>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(ed)}>Edit</button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleToggle(ed)}
                          style={{ color: ed.status === 'active' ? 'var(--color-error)' : 'var(--color-success)' }}
                        >
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

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="pagination">
            <button className="page-btn" disabled={pagination.page <= 1} onClick={() => loadEditions(pagination.page - 1)}>‹</button>
            {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => i + 1).map(p => (
              <button key={p} className={`page-btn ${pagination.page === p ? 'active' : ''}`} onClick={() => loadEditions(p)}>{p}</button>
            ))}
            <button className="page-btn" disabled={pagination.page >= pagination.pages} onClick={() => loadEditions(pagination.page + 1)}>›</button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
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
                  placeholder="e.g. 2024 Edition, Spring Gala..."
                  value={form.name}
                  onChange={e => {
                    const name = e.target.value;
                    setForm(f => ({ ...f, name, slug: !editingEdition ? slugify(name) : f.slug }));
                  }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Slug *</label>
                <input
                  id="edition-slug-input"
                  className="form-input"
                  placeholder="e.g. 2024-edition"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Display Order</label>
                <input
                  className="form-input"
                  type="number"
                  value={form.order}
                  onChange={e => setForm(f => ({ ...f, order: parseInt(e.target.value) || 0 }))}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-dark-grey)', marginTop: 4, fontFamily: 'var(--font-ui)' }}>
                  Lower number = displays first.
                </p>
              </div>
              <div className="form-group">
                <label className="form-label">Status</label>
                <select
                  className="form-select"
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'inactive' }))}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              {error && <p className="error-text">{error}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
              <button id="save-edition-btn" className="btn btn-accent" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : editingEdition ? 'Save Changes' : 'Create Edition'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
