'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import SearchableSelect from '@/components/admin/SearchableSelect';
import { useDebounce } from '@/lib/useDebounce';

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
  const debouncedSearch = useDebounce(search, 300);

  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);

  // Edit folder modal state
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', downloadPin: '' });
  const [saving, setSaving] = useState(false);

  // Create folder modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ eventId: '', name: '', email: '', downloadPin: '' });
  const [creating, setCreating] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch all events for autocomplete dropdown
  useEffect(() => {
    fetch('/api/events?all=true')
      .then(r => r.json())
      .then(d => {
        const evList = d.events || [];
        setEvents(evList);
        if (evList.length > 0) {
          setCreateForm(prev => ({ ...prev, eventId: evList[0]._id }));
        }
      });
  }, []);

  // Paginated load with debounced search
  const loadAttendees = useCallback(async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (filterEvent) params.set('eventId', filterEvent);
    if (debouncedSearch) params.set('search', debouncedSearch);

    try {
      const res = await fetch(`/api/attendees?${params}`);
      const data = await res.json();
      setAttendees(data.attendees || []);
      setPagination(data.pagination || { page: 1, limit: 20, total: 0, pages: 0 });
    } finally { setLoading(false); }
  }, [filterEvent, debouncedSearch]);

  useEffect(() => { loadAttendees(1); }, [loadAttendees]);

  function openEdit(a: Attendee) {
    setEditingAttendee(a);
    setEditForm({ name: a.name, email: a.email || '', downloadPin: a.downloadPin || '' });
    setError('');
  }

  function openCreate() {
    setShowCreateModal(true);
    setCreateForm({
      eventId: filterEvent || (events.length > 0 ? events[0]._id : ''),
      name: '',
      email: '',
      downloadPin: '',
    });
    setError('');
  }

  async function handleCreate() {
    setError('');
    if (!createForm.eventId) { setError('Please select an event.'); return; }
    if (!createForm.name.trim()) { setError('Folder name is required.'); return; }

    setCreating(true);
    try {
      const res = await fetch('/api/attendees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Failed to create folder.'); return; }

      setShowCreateModal(false);
      setSuccessMsg(`Folder "${data.attendee.name}" created successfully!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      loadAttendees(1);
    } catch {
      setError('Network error while creating folder.');
    } finally {
      setCreating(false);
    }
  }

  async function handleSave() {
    if (!editingAttendee) return;
    setError('');
    if (!editForm.name.trim()) { setError('Folder name is required.'); return; }
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
    if (!confirm(`Delete folder "${a.name}"? Media inside may become unlinked.`)) return;
    await fetch(`/api/attendees/${a._id}`, { method: 'DELETE' });
    loadAttendees(pagination.page);
  }

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h2 className="admin-topbar-title">Media Folders</h2>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--color-dark-grey)', marginTop: 2 }}>
            {pagination.total.toLocaleString()} folder(s) total · Paginated to 20 per page
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-accent btn-sm" onClick={openCreate}>
            ➕ Create New Folder
          </button>
          <Link href="/admin/media/upload" className="btn btn-outline btn-sm">
            ⬆️ Upload Media
          </Link>
        </div>
      </div>

      <div className="admin-content">
        {successMsg && (
          <div style={{
            marginBottom: 20,
            padding: '12px 16px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            color: '#166534',
            fontWeight: 500,
            fontSize: '0.875rem',
          }}>
            ✓ {successMsg}
          </div>
        )}

        {/* Filters with SearchableSelect and Debounced Search */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ paddingTop: 16, paddingBottom: 16 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ minWidth: 220, flex: '1 1 220px' }}>
                <SearchableSelect
                  value={filterEvent}
                  onChange={val => setFilterEvent(val)}
                  placeholder="All Events"
                  allOptionLabel="All Events"
                  allOptionValue=""
                  searchPlaceholder="Search event..."
                  options={events.map(ev => ({
                    value: ev._id,
                    label: ev.name,
                    icon: '📅',
                  }))}
                />
              </div>

              <div className="search-wrapper" style={{ flex: '2 1 300px', minWidth: 260 }}>
                <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
                </svg>
                <input
                  id="attendee-search"
                  className="search-input"
                  placeholder="Search folders by name or email (debounced)..."
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
        </div>

        <div className="table-wrapper">
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-dark-grey)', fontFamily: 'var(--font-ui)' }}>Loading folders...</div>
          ) : attendees.length === 0 ? (
            <div className="empty-state">
              <h3>No folders found</h3>
              <p>Create a folder or upload media to get started.</p>
              <div style={{ marginTop: 14 }}>
                <button className="btn btn-accent btn-sm" onClick={openCreate}>
                  ➕ Create First Folder
                </button>
              </div>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Folder Name</th>
                  <th>Contact Email</th>
                  <th>Media Count</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attendees.map((a) => (
                  <tr key={a._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1.1rem' }}>📁</span>
                        <div>
                          <Link
                            href={`/admin/media?eventId=${a.eventId}&attendeeId=${a._id}`}
                            style={{ fontWeight: 600, color: 'var(--color-charcoal)', textDecoration: 'none' }}
                            title="Click to view media in this folder"
                          >
                            {a.name}
                          </Link>
                          {a.downloadPin && (
                            <span style={{ marginLeft: 6, fontSize: '0.65rem', background: '#fef3c7', color: '#92400e', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>
                              PIN
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--color-dark-grey)', fontSize: '0.85rem' }}>
                      {a.email || <span style={{ color: '#94a3b8' }}>—</span>}
                    </td>
                    <td>
                      <Link
                        href={`/admin/media?eventId=${a.eventId}&attendeeId=${a._id}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          color: a.mediaCount > 0 ? '#166534' : '#64748b',
                          background: a.mediaCount > 0 ? '#f0fdf4' : '#f8fafc',
                          padding: '3px 10px',
                          borderRadius: 6,
                          textDecoration: 'none',
                        }}
                      >
                        {a.mediaCount} {a.mediaCount === 1 ? 'item' : 'items'}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--color-dark-grey)', fontSize: '0.8rem' }}>
                      {new Date(a.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                        <Link
                          href={`/admin/media/upload?eventId=${a.eventId}&folderId=${a._id}`}
                          className="btn btn-accent btn-sm"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textDecoration: 'none',
                          }}
                          title={`Add more images/videos directly into "${a.name}"`}
                        >
                          + Add Images
                        </Link>

                        <Link
                          href={`/admin/media?eventId=${a.eventId}&attendeeId=${a._id}`}
                          className="btn btn-outline btn-sm"
                          style={{
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            textDecoration: 'none',
                          }}
                        >
                          View
                        </Link>

                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(a)}>
                          Edit
                        </button>

                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleDelete(a)}>
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

      {/* Create Folder Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Media Folder</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Event *</label>
                <SearchableSelect
                  value={createForm.eventId}
                  onChange={val => setCreateForm(f => ({ ...f, eventId: val }))}
                  placeholder="Select an Event..."
                  searchPlaceholder="Search event..."
                  options={events.map(ev => ({
                    value: ev._id,
                    label: ev.name,
                    icon: '📅',
                  }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Folder Name *</label>
                <input
                  className="form-input"
                  placeholder="e.g. Stage Highlights, Dr. Anas, Awards Night..."
                  value={createForm.name}
                  onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Contact Email (Optional)</label>
                <input
                  className="form-input"
                  type="email"
                  placeholder="attendee@example.com (for private photo access)"
                  value={createForm.email}
                  onChange={e => setCreateForm(f => ({ ...f, email: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Download PIN (Optional)</label>
                <input
                  className="form-input"
                  placeholder="e.g. 1234 (leaves public if blank)"
                  value={createForm.downloadPin}
                  onChange={e => setCreateForm(f => ({ ...f, downloadPin: e.target.value }))}
                />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-dark-grey)', marginTop: 4, fontFamily: 'var(--font-ui)' }}>
                  If set, guests must enter this PIN to download ZIP files from this folder.
                </p>
              </div>

              {error && <p className="error-text">{error}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowCreateModal(false)}>Cancel</button>
              <button className="btn btn-accent" onClick={handleCreate} disabled={creating}>
                {creating ? 'Creating...' : 'Create Folder'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingAttendee && (
        <div className="modal-overlay" onClick={() => setEditingAttendee(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Edit Folder</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setEditingAttendee(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Folder Name</label>
                <input className="form-input" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Email (Optional)</label>
                <input className="form-input" type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Download PIN (Optional)</label>
                <input className="form-input" placeholder="e.g. 1234" value={editForm.downloadPin} onChange={e => setEditForm(f => ({ ...f, downloadPin: e.target.value }))} />
                <p style={{ fontSize: '0.75rem', color: 'var(--color-dark-grey)', marginTop: 4, fontFamily: 'var(--font-ui)' }}>
                  Require users to enter this PIN to download this folder&apos;s ZIP file.
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
