'use client';

import { Suspense, useEffect, useRef, useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatFileSize } from '@/lib/utils';
import SearchableSelect from '@/components/admin/SearchableSelect';

interface Event {
  _id: string;
  name: string;
}

interface Edition {
  _id: string;
  name: string;
}

interface ExistingFolder {
  _id: string;
  name: string;
  email?: string;
  mediaCount?: number;
  downloadPin?: string;
}

interface FileEntry {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  mediaId?: string;
}

function MediaUploadInner() {
  const searchParams = useSearchParams();
  const urlEventId = searchParams.get('eventId') || '';
  const urlFolderId = searchParams.get('folderId') || searchParams.get('attendeeId') || '';
  const urlEditionId = searchParams.get('editionId') || '';

  const [events, setEvents] = useState<Event[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selectedEvent, setSelectedEvent] = useState(urlEventId);
  const [selectedEdition, setSelectedEdition] = useState(urlEditionId);

  // Folder selection mode: 'existing' or 'new'
  const [folderMode, setFolderMode] = useState<'existing' | 'new'>(urlFolderId ? 'existing' : 'existing');
  const [existingFolders, setExistingFolders] = useState<ExistingFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState(urlFolderId);

  // New folder fields
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderEmail, setNewFolderEmail] = useState('');
  const [newFolderPin, setNewFolderPin] = useState('');

  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const [lastUploadedFolderId, setLastUploadedFolderId] = useState('');
  const [loadingFolders, setLoadingFolders] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all events on mount for autocomplete
  useEffect(() => {
    fetch('/api/events?all=true')
      .then(r => r.json())
      .then(data => {
        const evList = data.events || [];
        setEvents(evList);
        if (!urlEventId && evList.length > 0) {
          setSelectedEvent(evList[0]._id);
        }
      });
  }, [urlEventId]);

  // Fetch editions and existing folders when event changes (all=true for dropdown autocomplete)
  const loadFoldersForEvent = (eventId: string) => {
    if (!eventId) return;
    setLoadingFolders(true);
    fetch(`/api/attendees?eventId=${eventId}&all=true`)
      .then(r => r.json())
      .then(data => {
        const folders: ExistingFolder[] = data.attendees || [];
        setExistingFolders(folders);

        if (urlFolderId && folders.some(f => f._id === urlFolderId)) {
          setSelectedFolderId(urlFolderId);
          setFolderMode('existing');
        } else if (folders.length > 0 && !selectedFolderId) {
          setSelectedFolderId(folders[0]._id);
        } else if (folders.length === 0) {
          setFolderMode('new');
        }
      })
      .catch(() => {})
      .finally(() => setLoadingFolders(false));
  };

  useEffect(() => {
    if (!selectedEvent) return;

    fetch(`/api/editions?eventId=${selectedEvent}&all=true`)
      .then(r => r.json())
      .then(data => {
        const active = (data.editions || []).filter((e: any) => e.status === 'active');
        setEditions(active);
        if (urlEditionId && active.some((e: any) => e._id === urlEditionId)) {
          setSelectedEdition(urlEditionId);
        } else if (active.length > 0) {
          setSelectedEdition(active[0]._id);
        } else {
          setSelectedEdition('');
        }
      });

    loadFoldersForEvent(selectedEvent);
  }, [selectedEvent, urlEditionId, urlFolderId]);

  const activeSelectedFolder = useMemo(() => {
    return existingFolders.find(f => f._id === selectedFolderId) || null;
  }, [existingFolders, selectedFolderId]);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const entries: FileEntry[] = Array.from(newFiles).map(f => ({
      file: f,
      status: 'pending',
      progress: 0,
    }));
    setFiles(prev => [...prev, ...entries]);
  }

  async function handleUpload() {
    setError('');
    if (!selectedEvent || !selectedEdition) {
      setError('Please select an event and edition.');
      return;
    }

    let targetAttendeeId = '';

    if (folderMode === 'existing') {
      if (!selectedFolderId) {
        setError('Please select an existing folder to upload into.');
        return;
      }
      targetAttendeeId = selectedFolderId;
    } else {
      if (!newFolderName.trim()) {
        setError('Folder name is required for creating a new folder.');
        return;
      }
    }

    if (files.length === 0) {
      setError('Select at least one file to upload.');
      return;
    }
    if (files.every(f => f.status === 'done')) {
      setError('All files are already uploaded. Add new files or clear the list.');
      return;
    }

    setUploading(true);
    let successCnt = 0;

    try {
      if (folderMode === 'new') {
        const attendeeRes = await fetch('/api/attendees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventId: selectedEvent,
            name: newFolderName.trim(),
            email: newFolderEmail.trim(),
            downloadPin: newFolderPin.trim(),
          }),
        });
        const attendeeData = await attendeeRes.json();
        if (!attendeeRes.ok) {
          setError(attendeeData.error || 'Failed to create folder.');
          setUploading(false);
          return;
        }
        targetAttendeeId = attendeeData.attendee._id;
      }

      setLastUploadedFolderId(targetAttendeeId);

      const pendingFiles = files.filter(f => f.status === 'pending');
      const presignRes = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEvent,
          editionId: selectedEdition,
          attendeeId: targetAttendeeId,
          files: pendingFiles.map(f => ({
            name: f.file.name,
            type: f.file.type,
            size: f.file.size,
          })),
        }),
      });

      const presignData = await presignRes.json();
      if (!presignRes.ok) {
        setError(presignData.error || 'Failed to get upload URLs.');
        setUploading(false);
        return;
      }

      await Promise.allSettled(
        presignData.results.map(async (result: any) => {
          const fileIdx = files.findIndex(f => f.status === 'pending' && f.file.name === result.name);
          if (fileIdx === -1) return;

          if (!result.success) {
            setFiles(prev => {
              const next = [...prev];
              next[fileIdx] = { ...next[fileIdx], status: 'error', error: result.error };
              return next;
            });
            return;
          }

          setFiles(prev => {
            const next = [...prev];
            next[fileIdx] = { ...next[fileIdx], status: 'uploading' };
            return next;
          });

          try {
            const xhr = new XMLHttpRequest();
            await new Promise<void>((resolve, reject) => {
              xhr.open('PUT', result.presignedUrl);
              xhr.setRequestHeader('Content-Type', files[fileIdx].file.type);
              xhr.upload.onprogress = (e) => {
                if (e.lengthComputable) {
                  const pct = Math.round((e.loaded / e.total) * 100);
                  setFiles(prev => {
                    const next = [...prev];
                    next[fileIdx] = { ...next[fileIdx], progress: pct };
                    return next;
                  });
                }
              };
              xhr.onload = () => {
                if (xhr.status === 200) {
                  setFiles(prev => {
                    const next = [...prev];
                    next[fileIdx] = { ...next[fileIdx], status: 'done', progress: 100 };
                    return next;
                  });
                  successCnt++;
                  resolve();
                } else {
                  reject(new Error(`Upload failed: ${xhr.status}`));
                }
              };
              xhr.onerror = () => reject(new Error('Network error'));
              xhr.send(files[fileIdx].file);
            });
          } catch (err: any) {
            setFiles(prev => {
              const next = [...prev];
              next[fileIdx] = { ...next[fileIdx], status: 'error', error: err.message };
              return next;
            });
          }
        })
      );

      setSuccessCount(prev => prev + successCnt);
      loadFoldersForEvent(selectedEvent);

      if (folderMode === 'new' && targetAttendeeId) {
        setSelectedFolderId(targetAttendeeId);
        setFolderMode('existing');
        setNewFolderName('');
        setNewFolderEmail('');
        setNewFolderPin('');
      }
    } catch {
      setError('Upload failed. Please check your network and try again.');
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h2 className="admin-topbar-title">Upload Media</h2>
          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.78rem', color: 'var(--color-dark-grey)', marginTop: 2 }}>
            Add photos & videos with searchable autocomplete folders
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/admin/attendees" className="btn btn-outline btn-sm">
            📁 View All Folders
          </Link>
          <Link href="/admin/media" className="btn btn-outline btn-sm">
            🖼️ View All Media
          </Link>
        </div>
      </div>

      <div className="admin-content">
        <div style={{ maxWidth: 780 }}>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title">Upload Photos & Videos</h3>
              <span className="badge badge-photo" style={{ fontSize: '0.75rem' }}>
                Full Autocomplete Enabled
              </span>
            </div>

            <div className="card-body">
              {/* Event / Edition Selection with Autocomplete */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Event *</label>
                  <SearchableSelect
                    id="upload-event"
                    value={selectedEvent}
                    onChange={val => {
                      setSelectedEvent(val);
                      setSelectedFolderId('');
                    }}
                    placeholder="Select an Event..."
                    searchPlaceholder="Search event by name..."
                    options={events.map(ev => ({
                      value: ev._id,
                      label: ev.name,
                      icon: '📅',
                    }))}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Edition *</label>
                  <SearchableSelect
                    id="upload-edition"
                    value={selectedEdition}
                    onChange={val => setSelectedEdition(val)}
                    placeholder={editions.length === 0 ? 'No editions available' : 'Select an Edition...'}
                    searchPlaceholder="Search editions..."
                    disabled={editions.length === 0}
                    options={editions.map(ed => ({
                      value: ed._id,
                      label: ed.name,
                      icon: '📑',
                    }))}
                  />
                </div>
              </div>

              {/* Destination: Existing Folder vs New Folder */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: 'var(--radius-md)',
                padding: 16,
                marginBottom: 24,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <label className="form-label" style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>
                    Destination Folder *
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${folderMode === 'existing' ? 'btn-accent' : 'btn-outline'}`}
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      onClick={() => setFolderMode('existing')}
                    >
                      📁 Existing Folder ({existingFolders.length})
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${folderMode === 'new' ? 'btn-accent' : 'btn-outline'}`}
                      style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                      onClick={() => setFolderMode('new')}
                    >
                      ➕ Create New Folder
                    </button>
                  </div>
                </div>

                {/* MODE 1: Select Existing Folder with Autocomplete */}
                {folderMode === 'existing' && (
                  <div>
                    {loadingFolders ? (
                      <p style={{ fontSize: '0.82rem', color: '#64748b' }}>Loading existing folders...</p>
                    ) : existingFolders.length === 0 ? (
                      <div style={{ padding: 16, background: '#fffbeb', border: '1px dashed #fcd34d', borderRadius: 8, textAlign: 'center' }}>
                        <p style={{ margin: '0 0 8px', fontSize: '0.85rem', color: '#92400e', fontWeight: 500 }}>
                          No folders found for this event yet.
                        </p>
                        <button
                          type="button"
                          className="btn btn-accent btn-sm"
                          onClick={() => setFolderMode('new')}
                        >
                          ➕ Create First Folder
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="form-group" style={{ margin: 0 }}>
                          <SearchableSelect
                            id="select-existing-folder"
                            value={selectedFolderId}
                            onChange={val => setSelectedFolderId(val)}
                            placeholder="-- Type or choose an existing folder --"
                            searchPlaceholder="Type folder name or email..."
                            options={existingFolders.map(folder => ({
                              value: folder._id,
                              label: folder.name,
                              badge: `${folder.mediaCount ?? 0} files`,
                              sublabel: folder.email || (folder.downloadPin ? 'PIN Protected' : undefined),
                              icon: '📁',
                            }))}
                          />
                        </div>

                        {/* Selected Folder Details Card */}
                        {activeSelectedFolder && (
                          <div style={{
                            marginTop: 12,
                            padding: '12px 14px',
                            background: '#f0fdf4',
                            border: '1px solid #bbf7d0',
                            borderRadius: 'var(--radius-md)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{
                                  fontSize: '0.68rem',
                                  fontWeight: 600,
                                  background: '#22c55e',
                                  color: 'white',
                                  padding: '2px 8px',
                                  borderRadius: 12,
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.04em',
                                }}>
                                  Target Folder
                                </span>
                                <strong style={{ color: '#166534', fontSize: '0.95rem' }}>
                                  📁 {activeSelectedFolder.name}
                                </strong>
                              </div>
                              <p style={{ margin: '4px 0 0', fontSize: '0.78rem', color: '#15803d' }}>
                                Currently has <strong>{activeSelectedFolder.mediaCount ?? 0}</strong> media files.
                                {activeSelectedFolder.email && ` · Email: ${activeSelectedFolder.email}`}
                                {activeSelectedFolder.downloadPin && ' · PIN Protected'}
                                {' — All uploaded media will be added directly into this folder.'}
                              </p>
                            </div>
                            <Link
                              href={`/admin/media?eventId=${selectedEvent}&attendeeId=${activeSelectedFolder._id}`}
                              className="btn btn-ghost btn-sm"
                              style={{ color: '#166534', fontSize: '0.75rem', textDecoration: 'underline' }}
                              target="_blank"
                            >
                              Browse Folder ↗
                            </Link>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* MODE 2: Create New Folder */}
                {folderMode === 'new' && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12, marginBottom: 12 }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">New Folder Name *</label>
                        <input
                          id="new-folder-name"
                          className="form-input"
                          placeholder="e.g. Stage Highlights, Dr. Anas, Awards..."
                          value={newFolderName}
                          onChange={e => setNewFolderName(e.target.value)}
                        />
                      </div>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">Contact Email (Optional)</label>
                        <input
                          id="new-folder-email"
                          className="form-input"
                          type="email"
                          placeholder="attendee@example.com"
                          value={newFolderEmail}
                          onChange={e => setNewFolderEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Download PIN (Optional)</label>
                      <input
                        id="new-folder-pin"
                        className="form-input"
                        placeholder="e.g. 1234 (leaves public if blank)"
                        value={newFolderPin}
                        onChange={e => setNewFolderPin(e.target.value)}
                        style={{ maxWidth: 260 }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Drop Zone */}
              <div
                className={`upload-zone ${dragging ? 'dragging' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="upload-zone-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                    <polyline points="17 8 12 3 7 8"/>
                    <line x1="12" y1="3" x2="12" y2="15"/>
                  </svg>
                </div>
                <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 500, color: 'var(--color-charcoal)', marginBottom: 4 }}>
                  Drop files here or click to browse
                </p>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-dark-grey)' }}>
                  Photos: JPG, PNG, WEBP, HEIC (max 50 MB) · Videos: MP4, MOV (max 2 GB)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/mov,video/quicktime,video/avi,video/webm"
                  style={{ display: 'none' }}
                  onChange={(e) => addFiles(e.target.files)}
                />
              </div>

              {/* Selected Files List */}
              {files.length > 0 && (
                <div style={{ marginTop: 16, border: '1px solid var(--color-light-grey)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div style={{ padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#475569', fontFamily: 'var(--font-ui)' }}>
                      Selected Files ({files.length})
                    </span>
                    {!uploading && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                        onClick={() => setFiles([])}
                      >
                        Clear All
                      </button>
                    )}
                  </div>
                  <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                    {files.map((f, idx) => (
                      <div key={idx} style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                        borderBottom: idx < files.length - 1 ? '1px solid var(--color-cream)' : 'none',
                        background: f.status === 'done' ? '#f0faf4' : f.status === 'error' ? '#fef2f2' : 'white',
                      }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.85rem', fontWeight: 500, color: 'var(--color-charcoal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {f.file.name}
                          </p>
                          <p style={{ fontSize: '0.75rem', color: 'var(--color-dark-grey)' }}>
                            {formatFileSize(f.file.size)} · {f.file.type || 'file'}
                          </p>
                          {f.status === 'uploading' && (
                            <div className="progress-bar" style={{ marginTop: 6 }}>
                              <div className="progress-bar-fill" style={{ width: `${f.progress}%` }} />
                            </div>
                          )}
                          {f.status === 'error' && <p style={{ fontSize: '0.75rem', color: 'var(--color-error)', marginTop: 2 }}>{f.error}</p>}
                        </div>
                        <span style={{
                          fontSize: '0.75rem',
                          fontFamily: 'var(--font-ui)',
                          fontWeight: 600,
                          color: f.status === 'done' ? 'var(--color-success)' : f.status === 'error' ? 'var(--color-error)' : f.status === 'uploading' ? 'var(--color-accent)' : 'var(--color-dark-grey)',
                          whiteSpace: 'nowrap',
                        }}>
                          {f.status === 'done' ? '✓ Uploaded' : f.status === 'error' ? '✗ Error' : f.status === 'uploading' ? `${f.progress}%` : 'Ready'}
                        </span>
                        {f.status !== 'uploading' && (
                          <button className="btn btn-ghost btn-icon" onClick={() => removeFile(idx)} style={{ flexShrink: 0, color: 'var(--color-dark-grey)' }}>✕</button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {error && <p className="error-text" style={{ marginTop: 14 }}>{error}</p>}

              {successCount > 0 && (
                <div style={{
                  marginTop: 14,
                  padding: 12,
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 8,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <p style={{ margin: 0, fontFamily: 'var(--font-ui)', fontSize: '0.85rem', color: 'var(--color-success)', fontWeight: 500 }}>
                    ✓ {successCount} file(s) added successfully into the folder!
                  </p>
                  {lastUploadedFolderId && (
                    <Link
                      href={`/admin/media?eventId=${selectedEvent}&attendeeId=${lastUploadedFolderId}`}
                      className="btn btn-sm btn-outline"
                      style={{ fontSize: '0.75rem' }}
                    >
                      View Folder Media ↗
                    </Link>
                  )}
                </div>
              )}

              {/* Upload Action Button */}
              <div style={{ marginTop: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  id="upload-btn"
                  className="btn btn-accent btn-lg"
                  onClick={handleUpload}
                  disabled={
                    uploading ||
                    files.filter(f => f.status === 'pending').length === 0 ||
                    (folderMode === 'existing' && !selectedFolderId) ||
                    (folderMode === 'new' && !newFolderName.trim())
                  }
                >
                  {uploading
                    ? 'Uploading Files to S3...'
                    : `Upload ${files.filter(f => f.status === 'pending').length} File(s) to ${
                        folderMode === 'existing'
                          ? activeSelectedFolder ? `"${activeSelectedFolder.name}"` : 'Selected Folder'
                          : newFolderName.trim() ? `"${newFolderName.trim()}"` : 'New Folder'
                      }`}
                </button>

                {files.length > 0 && !uploading && (
                  <button className="btn btn-outline" onClick={() => setFiles([])}>Clear Files</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function MediaUploadPage() {
  return (
    <Suspense fallback={<div className="admin-content"><p>Loading upload console...</p></div>}>
      <MediaUploadInner />
    </Suspense>
  );
}
