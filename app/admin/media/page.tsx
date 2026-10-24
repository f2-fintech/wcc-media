'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatFileSize } from '@/lib/utils';

interface Event { _id: string; name: string; }
interface Edition { _id: string; name: string; }
interface AttendeeFolder { _id: string; name: string; mediaCount?: number; }

interface MediaItem {
  _id: string;
  type: 'photo' | 'video';
  originalFileName: string;
  size: number;
  mimeType: string;
  thumbnailUrl?: string;
  createdAt: string;
  attendeeId: { _id?: string; name: string; email: string } | null;
  editionId: { name: string } | null;
}

interface Pagination { page: number; limit: number; total: number; pages: number; }

function MediaPageInner() {
  const searchParams = useSearchParams();
  const urlEventId = searchParams.get('eventId') || '';
  const urlAttendeeId = searchParams.get('attendeeId') || searchParams.get('folderId') || '';

  const [events, setEvents] = useState<Event[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [attendees, setAttendees] = useState<AttendeeFolder[]>([]);

  const [filterEvent, setFilterEvent] = useState(urlEventId);
  const [filterEdition, setFilterEdition] = useState('');
  const [filterAttendee, setFilterAttendee] = useState(urlAttendeeId);
  const [filterType, setFilterType] = useState('');

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 24, total: 0, pages: 0 });
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<MediaItem | null>(null);

  useEffect(() => {
    fetch('/api/events')
      .then(r => r.json())
      .then(d => {
        const evList = d.events || [];
        setEvents(evList);
        if (!urlEventId && evList.length > 0) {
          // keep empty or let user pick All Events
        }
      });
  }, [urlEventId]);

  useEffect(() => {
    if (!filterEvent) {
      setEditions([]);
      setFilterEdition('');
      setAttendees([]);
      setFilterAttendee('');
      return;
    }

    // Load editions
    fetch(`/api/editions?eventId=${filterEvent}`)
      .then(r => r.json())
      .then(d => setEditions(d.editions || []));
    setFilterEdition('');

    // Load folders for this event
    fetch(`/api/attendees?eventId=${filterEvent}&all=true`)
      .then(r => r.json())
      .then(d => {
        const attList: AttendeeFolder[] = d.attendees || [];
        setAttendees(attList);
        if (urlAttendeeId && attList.some(a => a._id === urlAttendeeId)) {
          setFilterAttendee(urlAttendeeId);
        }
      });
  }, [filterEvent, urlAttendeeId]);

  const loadMedia = useCallback(async (page = 1) => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: '24' });
    if (filterEvent) params.set('eventId', filterEvent);
    if (filterEdition) params.set('editionId', filterEdition);
    if (filterAttendee) params.set('attendeeId', filterAttendee);
    if (filterType) params.set('type', filterType);

    try {
      const res = await fetch(`/api/media?${params}`);
      const data = await res.json();
      setMedia(data.media || []);
      setPagination(data.pagination || { page: 1, limit: 24, total: 0, pages: 0 });
    } catch { }
    finally { setLoading(false); }
  }, [filterEvent, filterEdition, filterAttendee, filterType]);

  useEffect(() => { loadMedia(1); }, [loadMedia]);

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(media.map(m => m._id)));
  }

  async function handleBulkDelete() {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected item(s)? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch('/api/media/bulk-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selected) }),
    });
    setSelected(new Set());
    loadMedia(pagination.page);
    setDeleting(false);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this media item?')) return;
    await fetch(`/api/media/${id}`, { method: 'DELETE' });
    loadMedia(pagination.page);
  }

  async function handleView(item: MediaItem) {
    const res = await fetch(`/api/media/${item._id}`);
    const data = await res.json();
    if (data.media?.viewUrl) window.open(data.media.viewUrl, '_blank');
  }

  const selectedFolderObj = attendees.find(a => a._id === filterAttendee);

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h2 className="admin-topbar-title">All Media</h2>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--color-dark-grey)', marginTop: 2 }}>
            Manage and view photos & videos across all folders
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {filterAttendee && filterEvent && (
            <Link
              href={`/admin/media/upload?eventId=${filterEvent}&folderId=${filterAttendee}`}
              className="btn btn-accent btn-sm"
              style={{ textDecoration: 'none', fontWeight: 600 }}
            >
              + Add Images to this Folder
            </Link>
          )}
          <Link href="/admin/media/upload" className="btn btn-outline btn-sm">
            ⬆️ Upload Media
          </Link>
          {selected.size > 0 && (
            <button className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={deleting}>
              {deleting ? 'Deleting...' : `Delete ${selected.size} Selected`}
            </button>
          )}
        </div>
      </div>

      <div className="admin-content">
        {/* Active Folder Filter Banner */}
        {selectedFolderObj && (
          <div style={{
            marginBottom: 20,
            padding: '12px 16px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '1.2rem' }}>📁</span>
              <div>
                <strong style={{ color: '#166534', fontSize: '0.95rem' }}>
                  Folder: {selectedFolderObj.name}
                </strong>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#15803d' }}>
                  Showing {pagination.total} files inside this folder
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link
                href={`/admin/media/upload?eventId=${filterEvent}&folderId=${selectedFolderObj._id}`}
                className="btn btn-accent btn-sm"
                style={{ fontSize: '0.78rem', padding: '4px 10px', textDecoration: 'none' }}
              >
                + Add More Images
              </Link>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.78rem', color: '#166534' }}
                onClick={() => setFilterAttendee('')}
              >
                Clear Folder Filter ✕
              </button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ paddingTop: 16, paddingBottom: 16 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              <div>
                <label className="form-label">Event</label>
                <select className="form-select" style={{ minWidth: 180 }} value={filterEvent} onChange={e => setFilterEvent(e.target.value)}>
                  <option value="">All Events</option>
                  {events.map(ev => <option key={ev._id} value={ev._id}>{ev.name}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Folder</label>
                <select
                  className="form-select"
                  style={{ minWidth: 180 }}
                  value={filterAttendee}
                  onChange={e => setFilterAttendee(e.target.value)}
                  disabled={!filterEvent}
                >
                  <option value="">All Folders</option>
                  {attendees.map(att => (
                    <option key={att._id} value={att._id}>
                      📁 {att.name} ({att.mediaCount ?? 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Edition</label>
                <select className="form-select" style={{ minWidth: 160 }} value={filterEdition} onChange={e => setFilterEdition(e.target.value)} disabled={!filterEvent}>
                  <option value="">All Editions</option>
                  {editions.map(ed => <option key={ed._id} value={ed._id}>{ed.name}</option>)}
                </select>
              </div>

              <div>
                <label className="form-label">Type</label>
                <select className="form-select" style={{ minWidth: 120 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">All Types</option>
                  <option value="photo">Photos</option>
                  <option value="video">Videos</option>
                </select>
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={selectAll}>Select All</button>
                <button className="btn btn-outline btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--color-dark-grey)', marginBottom: 16 }}>
          {loading ? 'Loading...' : `${pagination.total.toLocaleString()} items`}
          {selected.size > 0 && ` · ${selected.size} selected`}
        </p>

        {/* Grid */}
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton" style={{ aspectRatio: '3/4', borderRadius: 'var(--radius-md)' }} />
            ))}
          </div>
        ) : media.length === 0 ? (
          <div className="empty-state">
            <h3>No media found</h3>
            <p>Try adjusting filters or upload some media to this folder.</p>
            {filterEvent && (
              <div style={{ marginTop: 14 }}>
                <Link
                  href={filterAttendee ? `/admin/media/upload?eventId=${filterEvent}&folderId=${filterAttendee}` : `/admin/media/upload?eventId=${filterEvent}`}
                  className="btn btn-accent btn-sm"
                  style={{ textDecoration: 'none' }}
                >
                  ➕ Upload Media Now
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
            {media.map((item) => (
              <div
                key={item._id}
                style={{
                  position: 'relative',
                  borderRadius: 'var(--radius-md)',
                  overflow: 'hidden',
                  background: 'var(--color-cream)',
                  border: selected.has(item._id) ? '2.5px solid var(--color-accent)' : '2.5px solid transparent',
                  cursor: 'pointer',
                  aspectRatio: '3/4',
                }}
              >
                {/* Checkbox */}
                <div
                  style={{ position: 'absolute', top: 8, left: 8, zIndex: 2 }}
                  onClick={(e) => { e.stopPropagation(); toggleSelect(item._id); }}
                >
                  <input type="checkbox" checked={selected.has(item._id)} onChange={() => {}} style={{ width: 16, height: 16, accentColor: 'var(--color-accent)' }} />
                </div>

                {/* Type badge */}
                <div style={{ position: 'absolute', top: 8, right: 8, zIndex: 2 }}>
                  <span className={`badge ${item.type === 'photo' ? 'badge-photo' : 'badge-video'}`} style={{ fontSize: '0.6rem' }}>
                    {item.type}
                  </span>
                </div>

                {/* Thumbnail */}
                {item.type === 'video' && item.thumbnailUrl ? (
                  <div
                    style={{ position: 'relative', width: '100%', height: '100%', background: 'var(--color-near-black)', cursor: 'pointer' }}
                    onClick={() => setPreviewMedia(item)}
                  >
                    <video
                      src={item.thumbnailUrl}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
                      preload="metadata"
                      muted
                      playsInline
                    />
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 40, height: 40, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                ) : item.thumbnailUrl ? (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.originalFileName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onClick={() => setPreviewMedia(item)}
                  />
                ) : (
                  <div
                    style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-light-grey)' }}
                    onClick={() => setPreviewMedia(item)}
                  >
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-mid-grey)" strokeWidth="1">
                      {item.type === 'photo'
                        ? <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z M12 13 a3 3 0 110-6 3 3 0 010 6"/>
                        : <><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></>
                      }
                    </svg>
                  </div>
                )}

                {/* Bottom Folder badge */}
                {item.attendeeId?.name && (
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    background: 'rgba(0,0,0,0.6)',
                    backdropFilter: 'blur(3px)',
                    padding: '4px 8px',
                    zIndex: 1,
                  }}>
                    <p style={{
                      fontSize: '0.68rem',
                      color: 'white',
                      fontFamily: 'var(--font-ui)',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      margin: 0,
                    }}>
                      📁 {item.attendeeId.name}
                    </p>
                  </div>
                )}

                {/* Hover overlay */}
                <div style={{
                  position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)',
                  display: 'flex', alignItems: 'flex-end', padding: 10, opacity: 0,
                  transition: 'opacity 0.2s',
                  zIndex: 3,
                }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  <div style={{ width: '100%' }}>
                    <p style={{ fontSize: '0.72rem', color: 'white', fontFamily: 'var(--font-ui)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📁 {item.attendeeId?.name || 'Folder'}
                    </p>
                    <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                      <button className="btn btn-sm" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', padding: '4px 8px', fontSize: '0.7rem', borderRadius: 4 }} onClick={(e) => { e.stopPropagation(); handleView(item); }}>View</button>
                      <button className="btn btn-sm" style={{ background: 'rgba(255,80,80,0.7)', color: 'white', padding: '4px 8px', fontSize: '0.7rem', borderRadius: 4 }} onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}>Del</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="pagination">
            <button className="page-btn" disabled={pagination.page <= 1} onClick={() => loadMedia(pagination.page - 1)}>‹</button>
            {Array.from({ length: Math.min(pagination.pages, 7) }, (_, i) => {
              const p = i + 1;
              return (
                <button key={p} className={`page-btn ${pagination.page === p ? 'active' : ''}`} onClick={() => loadMedia(p)}>{p}</button>
              );
            })}
            <button className="page-btn" disabled={pagination.page >= pagination.pages} onClick={() => loadMedia(pagination.page + 1)}>›</button>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewMedia && (
        <div className="lightbox" onClick={() => setPreviewMedia(null)}>
          <button className="lightbox-close" onClick={() => setPreviewMedia(null)}>✕</button>
          <div onClick={e => e.stopPropagation()}>
            {previewMedia.type === 'video' ? (
              <video src={previewMedia.thumbnailUrl} controls style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 8 }} />
            ) : (
              <img src={previewMedia.thumbnailUrl} alt={previewMedia.originalFileName} className="lightbox-img" />
            )}
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-ui)', fontSize: '0.8rem', marginTop: 12 }}>
              {previewMedia.attendeeId?.name ? `📁 ${previewMedia.attendeeId.name} · ` : ''}{previewMedia.originalFileName} · {formatFileSize(previewMedia.size)}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

export default function MediaPage() {
  return (
    <Suspense fallback={<div className="admin-content"><p>Loading media...</p></div>}>
      <MediaPageInner />
    </Suspense>
  );
}
