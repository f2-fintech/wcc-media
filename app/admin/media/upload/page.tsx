'use client';

import { useEffect, useRef, useState } from 'react';
import { formatFileSize } from '@/lib/utils';

interface Event { _id: string; name: string; }
interface Edition { _id: string; name: string; }
interface Attendee { _id: string; name: string; email: string; }

interface FileEntry {
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
  mediaId?: string;
}

export default function MediaUploadPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [editions, setEditions] = useState<Edition[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [selectedEdition, setSelectedEdition] = useState('');
  const [attendeeName, setAttendeeName] = useState('');
  const [attendeeEmail, setAttendeeEmail] = useState('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [successCount, setSuccessCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/events').then(r => r.json()).then(data => {
      setEvents(data.events || []);
      if (data.events?.length) setSelectedEvent(data.events[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    fetch(`/api/editions?eventId=${selectedEvent}`).then(r => r.json()).then(data => {
      const active = (data.editions || []).filter((e: any) => e.status === 'active');
      setEditions(active);
      if (active.length) setSelectedEdition(active[0]._id);
    });
  }, [selectedEvent]);

  function addFiles(newFiles: FileList | null) {
    if (!newFiles) return;
    const entries: FileEntry[] = Array.from(newFiles).map(f => ({
      file: f, status: 'pending', progress: 0,
    }));
    setFiles(prev => [...prev, ...entries]);
  }

  async function handleUpload() {
    setError('');
    if (!selectedEvent || !selectedEdition) { setError('Select an event and edition.'); return; }
    if (!attendeeName.trim() || !attendeeEmail.trim()) { setError('Attendee name and email are required.'); return; }
    if (files.length === 0) { setError('Select at least one file.'); return; }
    if (files.every(f => f.status === 'done')) { setError('All files already uploaded.'); return; }

    setUploading(true);
    let successCnt = 0;

    try {
      // 1. Find or create attendee
      const attendeeRes = await fetch('/api/attendees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEvent, name: attendeeName.trim(), email: attendeeEmail.trim() }),
      });
      const attendeeData = await attendeeRes.json();
      if (!attendeeRes.ok) { setError(attendeeData.error || 'Failed to create attendee.'); setUploading(false); return; }
      const attendeeId = attendeeData.attendee._id;

      // 2. Get presigned URLs
      const pendingFiles = files.filter(f => f.status === 'pending');
      const presignRes = await fetch('/api/uploads/presign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId: selectedEvent,
          editionId: selectedEdition,
          attendeeId,
          files: pendingFiles.map(f => ({ name: f.file.name, type: f.file.type, size: f.file.size })),
        }),
      });
      const presignData = await presignRes.json();
      if (!presignRes.ok) { setError(presignData.error || 'Failed to get upload URLs.'); setUploading(false); return; }

      // 3. Upload each file to S3
      await Promise.allSettled(
        presignData.results.map(async (result: any, idx: number) => {
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
    } catch (err) {
      setError('Upload failed. Please try again.');
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
        <h2 className="admin-topbar-title">Upload Media</h2>
      </div>

      <div className="admin-content">
        <div style={{ maxWidth: 720 }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Upload Photos & Videos</h3>
            </div>
            <div className="card-body">
              {/* Event / Edition */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Event *</label>
                  <select id="upload-event" className="form-select" value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
                    {events.map(ev => <option key={ev._id} value={ev._id}>{ev.name}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Edition *</label>
                  <select id="upload-edition" className="form-select" value={selectedEdition} onChange={e => setSelectedEdition(e.target.value)}>
                    {editions.map(ed => <option key={ed._id} value={ed._id}>{ed.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Attendee */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Attendee Name *</label>
                  <input id="upload-attendee-name" className="form-input" placeholder="Dr. John Doe" value={attendeeName} onChange={e => setAttendeeName(e.target.value)} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Attendee Email *</label>
                  <input id="upload-attendee-email" className="form-input" type="email" placeholder="john@example.com" value={attendeeEmail} onChange={e => setAttendeeEmail(e.target.value)} />
                </div>
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
                  Photos: JPG, PNG, WEBP (max 50 MB) · Videos: MP4, MOV (max 2 GB)
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

              {/* File list */}
              {files.length > 0 && (
                <div style={{ marginTop: 16, border: '1px solid var(--color-light-grey)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
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
                          {formatFileSize(f.file.size)} · {f.file.type}
                        </p>
                        {f.status === 'uploading' && (
                          <div className="progress-bar" style={{ marginTop: 6 }}>
                            <div className="progress-bar-fill" style={{ width: `${f.progress}%` }} />
                          </div>
                        )}
                        {f.status === 'error' && <p style={{ fontSize: '0.75rem', color: 'var(--color-error)', marginTop: 2 }}>{f.error}</p>}
                      </div>
                      <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-ui)', fontWeight: 600, color: f.status === 'done' ? 'var(--color-success)' : f.status === 'error' ? 'var(--color-error)' : f.status === 'uploading' ? 'var(--color-accent)' : 'var(--color-dark-grey)', whiteSpace: 'nowrap' }}>
                        {f.status === 'done' ? '✓ Done' : f.status === 'error' ? '✗ Error' : f.status === 'uploading' ? `${f.progress}%` : 'Pending'}
                      </span>
                      {f.status !== 'uploading' && (
                        <button className="btn btn-ghost btn-icon" onClick={() => removeFile(idx)} style={{ flexShrink: 0, color: 'var(--color-dark-grey)' }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {error && <p className="error-text" style={{ marginTop: 12 }}>{error}</p>}
              {successCount > 0 && (
                <p style={{ marginTop: 12, fontFamily: 'var(--font-ui)', fontSize: '0.85rem', color: 'var(--color-success)', fontWeight: 500 }}>
                  ✓ {successCount} file(s) uploaded successfully.
                </p>
              )}

              <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
                <button
                  id="upload-btn"
                  className="btn btn-accent btn-lg"
                  onClick={handleUpload}
                  disabled={uploading || files.filter(f => f.status === 'pending').length === 0}
                >
                  {uploading ? 'Uploading...' : `Upload ${files.filter(f => f.status === 'pending').length} File(s)`}
                </button>
                {files.length > 0 && !uploading && (
                  <button className="btn btn-outline" onClick={() => setFiles([])}>Clear All</button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
