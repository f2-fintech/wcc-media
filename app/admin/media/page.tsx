'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatFileSize } from '@/lib/utils';
import SearchableSelect from '@/components/admin/SearchableSelect';

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

  // Move to Folder modal states
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveItemIds, setMoveItemIds] = useState<string[]>([]);
  const [moveEvent, setMoveEvent] = useState('');
  const [moveEdition, setMoveEdition] = useState('');
  const [moveFolderId, setMoveFolderId] = useState('');
  const [moveEditionsList, setMoveEditionsList] = useState<Edition[]>([]);
  const [moveFoldersList, setMoveFoldersList] = useState<AttendeeFolder[]>([]);
  const [loadingMoveFolders, setLoadingMoveFolders] = useState(false);
  const [moveMode, setMoveMode] = useState<'existing' | 'new'>('existing');
  const [moveNewName, setMoveNewName] = useState('');
  const [moveNewEmail, setMoveNewEmail] = useState('');
  const [moveNewPin, setMoveNewPin] = useState('');
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState('');
  const [moveSuccessMsg, setMoveSuccessMsg] = useState('');

  // Load all events for autocomplete dropdown
  useEffect(() => {
    fetch('/api/events?all=true')
      .then(r => r.json())
      .then(d => {
        setEvents(d.events || []);
      });
  }, [urlEventId]);

  // Load all editions for selected event
  useEffect(() => {
    if (!filterEvent) {
      setEditions([]);
      setFilterEdition('');
      return;
    }

    // Load editions (all=true for dropdown autocomplete)
    fetch(`/api/editions?eventId=${filterEvent}&all=true`)
      .then(r => r.json())
      .then(d => setEditions(d.editions || []));
    setFilterEdition('');
  }, [filterEvent]);

  // Load folders for selected event and edition
  useEffect(() => {
    if (!filterEvent) {
      setAttendees([]);
      setFilterAttendee('');
      return;
    }

    // Load folders (all=true for dropdown autocomplete, filtered by editionId if selected)
    const editionParam = filterEdition ? `&editionId=${filterEdition}` : '';
    fetch(`/api/attendees?eventId=${filterEvent}${editionParam}&all=true`)
      .then(r => r.json())
      .then(d => {
        const attList: AttendeeFolder[] = d.attendees || [];
        setAttendees(attList);
        if (urlAttendeeId && attList.some(a => a._id === urlAttendeeId)) {
          setFilterAttendee(urlAttendeeId);
        } else if (filterAttendee && !attList.some(a => a._id === filterAttendee)) {
          setFilterAttendee('');
        }
      });
  }, [filterEvent, filterEdition, urlAttendeeId]);

  // Paginated media loading (rate limited per page to 24 items)
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

  function loadMoveFolders(evId: string, edId: string) {
    if (!evId || !edId) {
      setMoveFoldersList([]);
      setMoveFolderId('');
      return;
    }
    setLoadingMoveFolders(true);
    fetch(`/api/attendees?eventId=${evId}&editionId=${edId}&all=true`)
      .then(r => r.json())
      .then(d => {
        const fList: AttendeeFolder[] = d.attendees || [];
        setMoveFoldersList(fList);
        if (fList.length > 0) {
          setMoveFolderId(fList[0]._id);
          setMoveMode('existing');
        } else {
          setMoveFolderId('');
          setMoveMode('new');
        }
      })
      .finally(() => setLoadingMoveFolders(false));
  }

  function openMoveModal(ids?: string[]) {
    const targets = ids && ids.length > 0 ? ids : Array.from(selected);
    if (targets.length === 0) return;

    setMoveItemIds(targets);
    setMoveError('');
    setShowMoveModal(true);

    const initialEv = filterEvent || (events.length > 0 ? events[0]._id : '');
    setMoveEvent(initialEv);

    if (initialEv) {
      fetch(`/api/editions?eventId=${initialEv}&all=true`)
        .then(r => r.json())
        .then(d => {
          const eds: Edition[] = (d.editions || []).filter((e: any) => e.status === 'active');
          setMoveEditionsList(eds);
          const initialEd = (filterEdition && eds.some(e => e._id === filterEdition))
            ? filterEdition
            : (eds.length > 0 ? eds[0]._id : '');
          setMoveEdition(initialEd);

          if (initialEd) {
            loadMoveFolders(initialEv, initialEd);
          } else {
            setMoveFoldersList([]);
            setMoveFolderId('');
            setMoveMode('new');
          }
        });
    } else {
      setMoveEditionsList([]);
      setMoveFoldersList([]);
      setMoveFolderId('');
    }
  }

  function handleMoveEventChange(evId: string) {
    setMoveEvent(evId);
    setMoveEdition('');
    setMoveFolderId('');
    if (evId) {
      fetch(`/api/editions?eventId=${evId}&all=true`)
        .then(r => r.json())
        .then(d => {
          const eds: Edition[] = (d.editions || []).filter((e: any) => e.status === 'active');
          setMoveEditionsList(eds);
          if (eds.length > 0) {
            setMoveEdition(eds[0]._id);
            loadMoveFolders(evId, eds[0]._id);
          } else {
            setMoveFoldersList([]);
            setMoveMode('new');
          }
        });
    } else {
      setMoveEditionsList([]);
      setMoveFoldersList([]);
    }
  }

  function handleMoveEditionChange(edId: string) {
    setMoveEdition(edId);
    setMoveFolderId('');
    if (moveEvent && edId) {
      loadMoveFolders(moveEvent, edId);
    } else {
      setMoveFoldersList([]);
    }
  }

  async function handleExecuteMove() {
    setMoveError('');
    if (!moveEvent) {
      setMoveError('Please select a target event.');
      return;
    }
    if (!moveEdition) {
      setMoveError('Please select a target edition.');
      return;
    }

    if (moveMode === 'existing') {
      if (!moveFolderId) {
        setMoveError('Please select an existing folder to move media into.');
        return;
      }
    } else {
      if (!moveNewName.trim()) {
        setMoveError('Folder name is required.');
        return;
      }
    }

    setMoving(true);
    try {
      const payload: any = {
        mediaIds: moveItemIds,
      };

      if (moveMode === 'existing') {
        payload.targetFolderId = moveFolderId;
      } else {
        payload.newFolder = {
          eventId: moveEvent,
          editionId: moveEdition,
          name: moveNewName.trim(),
          email: moveNewEmail.trim() || undefined,
          downloadPin: moveNewPin.trim() || undefined,
        };
      }

      const res = await fetch('/api/media/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setMoveError(data.error || 'Failed to move media.');
        return;
      }

      setShowMoveModal(false);
      setMoveSuccessMsg(`✓ Moved ${data.movedCount} photo(s)/video(s) to folder "${data.targetFolder?.name}" successfully!`);
      setTimeout(() => setMoveSuccessMsg(''), 5000);
      setSelected(new Set());
      setMoveNewName('');
      setMoveNewEmail('');
      setMoveNewPin('');

      // Refresh current media list and folders
      loadMedia(pagination.page);

      // Refresh attendees/folders list
      const editionParam = filterEdition ? `&editionId=${filterEdition}` : '';
      if (filterEvent) {
        fetch(`/api/attendees?eventId=${filterEvent}${editionParam}&all=true`)
          .then(r => r.json())
          .then(d => setAttendees(d.attendees || []));
      }
    } catch {
      setMoveError('Network error while moving media.');
    } finally {
      setMoving(false);
    }
  }

  const selectedFolderObj = attendees.find(a => a._id === filterAttendee);

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h2 className="admin-topbar-title">All Media</h2>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--color-dark-grey)', marginTop: 2 }}>
            Manage media with autocomplete searchable filters
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
            <>
              <button
                className="btn btn-accent btn-sm"
                onClick={() => openMoveModal()}
                style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                📁 Move {selected.size} to Folder
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleBulkDelete} disabled={deleting}>
                {deleting ? 'Deleting...' : `Delete ${selected.size} Selected`}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="admin-content">
        {moveSuccessMsg && (
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
            {moveSuccessMsg}
          </div>
        )}
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
                  Showing {pagination.total} files inside this folder (paginated to 24 per page)
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

        {/* Filters with Autocomplete SearchableSelect */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ paddingTop: 16, paddingBottom: 16 }}>
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {/* Event Autocomplete */}
              <div style={{ minWidth: 200, flex: '1 1 200px' }}>
                <label className="form-label">Event</label>
                <SearchableSelect
                  value={filterEvent}
                  onChange={val => {
                    setFilterEvent(val);
                    setFilterAttendee('');
                    setFilterEdition('');
                  }}
                  placeholder="All Events"
                  allOptionLabel="All Events"
                  allOptionValue=""
                  searchPlaceholder="Search events..."
                  options={events.map(ev => ({
                    value: ev._id,
                    label: ev.name,
                    icon: '📅',
                  }))}
                />
              </div>

              {/* Folder Autocomplete */}
              <div style={{ minWidth: 220, flex: '1 1 220px' }}>
                <label className="form-label">Folder</label>
                <SearchableSelect
                  value={filterAttendee}
                  onChange={val => setFilterAttendee(val)}
                  placeholder={!filterEvent ? 'Select event first' : 'All Folders'}
                  allOptionLabel="All Folders"
                  allOptionValue=""
                  disabled={!filterEvent}
                  searchPlaceholder="Type folder name or email..."
                  options={attendees.map(att => ({
                    value: att._id,
                    label: att.name,
                    badge: `${att.mediaCount ?? 0} files`,
                    icon: '📁',
                  }))}
                />
              </div>

              {/* Edition Autocomplete */}
              <div style={{ minWidth: 180, flex: '1 1 180px' }}>
                <label className="form-label">Edition</label>
                <SearchableSelect
                  value={filterEdition}
                  onChange={val => {
                    setFilterEdition(val);
                    setFilterAttendee('');
                  }}
                  placeholder={!filterEvent ? 'Select event first' : 'All Editions'}
                  allOptionLabel="All Editions"
                  allOptionValue=""
                  disabled={!filterEvent}
                  searchPlaceholder="Search editions..."
                  options={editions.map(ed => ({
                    value: ed._id,
                    label: ed.name,
                    icon: '📑',
                  }))}
                />
              </div>

              {/* Type Autocomplete */}
              <div style={{ minWidth: 150, flex: '1 1 150px' }}>
                <label className="form-label">Type</label>
                <SearchableSelect
                  value={filterType}
                  onChange={val => setFilterType(val)}
                  placeholder="All Types"
                  allOptionLabel="All Types"
                  allOptionValue=""
                  options={[
                    { value: 'photo', label: 'Photos Only', icon: '📷' },
                    { value: 'video', label: 'Videos Only', icon: '🎥' },
                  ]}
                />
              </div>

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, paddingBottom: 2 }}>
                <button className="btn btn-outline btn-sm" onClick={selectAll}>Select All</button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setSelected(new Set());
                    setFilterEvent('');
                    setFilterAttendee('');
                    setFilterEdition('');
                    setFilterType('');
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8rem', color: 'var(--color-dark-grey)', marginBottom: 16 }}>
          {loading ? 'Loading media...' : `${pagination.total.toLocaleString()} total items · Page ${pagination.page} of ${Math.max(1, pagination.pages)}`}
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
            <p>Try adjusting your search filters or upload new media into this folder.</p>
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
                      <button className="btn btn-sm" style={{ background: 'rgba(59, 130, 246, 0.8)', color: 'white', padding: '4px 8px', fontSize: '0.7rem', borderRadius: 4 }} onClick={(e) => { e.stopPropagation(); openMoveModal([item._id]); }} title="Move to another folder">Move</button>
                      <button className="btn btn-sm" style={{ background: 'rgba(255,80,80,0.7)', color: 'white', padding: '4px 8px', fontSize: '0.7rem', borderRadius: 4 }} onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}>Del</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
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
      {/* Move to Folder Modal */}
      {showMoveModal && (
        <div className="modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h3 className="modal-title">
                📁 Move {moveItemIds.length} {moveItemIds.length === 1 ? 'Item' : 'Items'} to Folder
              </h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowMoveModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              {/* Target Event and Edition Selection */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Target Event *</label>
                  <SearchableSelect
                    value={moveEvent}
                    onChange={val => handleMoveEventChange(val)}
                    placeholder="Select event..."
                    searchPlaceholder="Search event..."
                    options={events.map(ev => ({
                      value: ev._id,
                      label: ev.name,
                      icon: '📅',
                    }))}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Target Edition *</label>
                  <SearchableSelect
                    value={moveEdition}
                    onChange={val => handleMoveEditionChange(val)}
                    placeholder={moveEditionsList.length === 0 ? 'Select event first' : 'Select edition...'}
                    searchPlaceholder="Search edition..."
                    disabled={moveEditionsList.length === 0}
                    options={moveEditionsList.map(ed => ({
                      value: ed._id,
                      label: ed.name,
                      icon: '📑',
                    }))}
                  />
                </div>
              </div>

              {/* Destination Mode: Existing vs New Folder */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-md)',
                padding: 14,
                marginBottom: 16,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>
                    Destination Folder *
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${moveMode === 'existing' ? 'btn-accent' : 'btn-outline'}`}
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                      onClick={() => setMoveMode('existing')}
                    >
                      📁 Existing ({moveFoldersList.length})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${moveMode === 'new' ? 'btn-accent' : 'btn-outline'}`}
                      style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                      onClick={() => setMoveMode('new')}
                    >
                      ➕ Create New
                    </button>
                  </div>
                </div>

                {moveMode === 'existing' ? (
                  loadingMoveFolders ? (
                    <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>Loading folders...</p>
                  ) : moveFoldersList.length === 0 ? (
                    <div style={{ padding: 12, background: '#fffbeb', border: '1px dashed #fcd34d', borderRadius: 6, textAlign: 'center' }}>
                      <p style={{ margin: '0 0 6px', fontSize: '0.82rem', color: '#92400e', fontWeight: 500 }}>
                        No folders found for this edition.
                      </p>
                      <button
                        type="button"
                        className="btn btn-accent btn-sm"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => setMoveMode('new')}
                      >
                        ➕ Create First Folder
                      </button>
                    </div>
                  ) : (
                    <div className="form-group" style={{ margin: 0 }}>
                      <SearchableSelect
                        value={moveFolderId}
                        onChange={val => setMoveFolderId(val)}
                        placeholder="-- Choose target folder --"
                        searchPlaceholder="Type folder name or email..."
                        options={moveFoldersList.map(folder => ({
                          value: folder._id,
                          label: folder.name,
                          badge: `${folder.mediaCount ?? 0} files`,
                          icon: '📁',
                        }))}
                      />
                    </div>
                  )
                ) : (
                  <div>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Folder Name *</label>
                      <input
                        className="form-input"
                        placeholder="e.g. Stage Highlights, Dr. Anas, VIP Dinner..."
                        value={moveNewName}
                        onChange={e => setMoveNewName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Contact Email (Optional)</label>
                      <input
                        className="form-input"
                        type="email"
                        placeholder="attendee@example.com"
                        value={moveNewEmail}
                        onChange={e => setMoveNewEmail(e.target.value)}
                      />
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: '0.78rem' }}>Download PIN (Optional)</label>
                      <input
                        className="form-input"
                        placeholder="e.g. 1234 (leaves public if blank)"
                        value={moveNewPin}
                        onChange={e => setMoveNewPin(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {moveError && <p className="error-text" style={{ margin: 0 }}>{moveError}</p>}
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowMoveModal(false)} disabled={moving}>
                Cancel
              </button>
              <button className="btn btn-accent" onClick={handleExecuteMove} disabled={moving}>
                {moving ? 'Moving...' : `Move ${moveItemIds.length} ${moveItemIds.length === 1 ? 'Item' : 'Items'}`}
              </button>
            </div>
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
