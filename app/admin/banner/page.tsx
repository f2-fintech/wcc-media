'use client';

import { useEffect, useRef, useState } from 'react';

interface Event { _id: string; name: string; desktopBanner?: { s3Url: string }; mobileBanner?: { s3Url: string }; }

export default function BannerPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState('');
  const [desktopPreview, setDesktopPreview] = useState('');
  const [mobilePreview, setMobilePreview] = useState('');
  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const desktopRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/events').then(r => r.json()).then(d => {
      setEvents(d.events || []);
      if (d.events?.length) setSelectedEvent(d.events[0]._id);
    });
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;
    setDesktopPreview('');
    setMobilePreview('');
    // Load presigned banner URLs
    fetch(`/api/banner/${selectedEvent}`).then(r => r.json()).then(d => {
      if (d.desktopBannerUrl) setDesktopPreview(d.desktopBannerUrl);
      if (d.mobileBannerUrl) setMobilePreview(d.mobileBannerUrl);
    });
  }, [selectedEvent]);

  function handleFileSelect(file: File, variant: 'desktop' | 'mobile') {
    const url = URL.createObjectURL(file);
    if (variant === 'desktop') { setDesktopFile(file); setDesktopPreview(url); }
    else { setMobileFile(file); setMobilePreview(url); }
  }

  async function uploadBanner(file: File, variant: 'desktop' | 'mobile') {
    // Get presigned URL
    const presignRes = await fetch('/api/banner/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventId: selectedEvent, variant, fileName: file.name, fileType: file.type, fileSize: file.size }),
    });
    const presignData = await presignRes.json();
    if (!presignRes.ok) throw new Error(presignData.error || 'Failed to get upload URL');

    // Upload to S3
    const uploadRes = await fetch(presignData.presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!uploadRes.ok) throw new Error('S3 upload failed');

    // Save metadata to DB
    const saveRes = await fetch(`/api/banner/${selectedEvent}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ variant, s3Bucket: presignData.s3Bucket, s3Key: presignData.s3Key, s3Url: presignData.s3Url }),
    });
    if (!saveRes.ok) throw new Error('Failed to save banner metadata');
  }

  async function handleSave() {
    setError('');
    setMessage('');
    if (!desktopFile && !mobileFile) { setError('Select at least one banner image.'); return; }
    setUploading(true);
    try {
      if (desktopFile) await uploadBanner(desktopFile, 'desktop');
      if (mobileFile) await uploadBanner(mobileFile, 'mobile');
      setMessage('Banner(s) saved successfully!');
      setDesktopFile(null);
      setMobileFile(null);
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteBanner(variant: 'desktop' | 'mobile') {
    if (!confirm(`Delete the ${variant} banner?`)) return;
    await fetch(`/api/banner/${selectedEvent}?variant=${variant}`, { method: 'DELETE' });
    if (variant === 'desktop') setDesktopPreview('');
    else setMobilePreview('');
  }

  return (
    <>
      <div className="admin-topbar">
        <h2 className="admin-topbar-title">Banner Management</h2>
      </div>

      <div className="admin-content">
        {/* Event selector */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ paddingTop: 16, paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <label className="form-label" style={{ margin: 0, whiteSpace: 'nowrap' }}>Event:</label>
              <select className="form-select" style={{ maxWidth: 300 }} value={selectedEvent} onChange={e => setSelectedEvent(e.target.value)}>
                {events.map(ev => <option key={ev._id} value={ev._id}>{ev.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Desktop Banner */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">Desktop Banner</h3></div>
            <div className="card-body">
              <div
                style={{ width: '100%', aspectRatio: '16/5', background: 'var(--color-cream)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 16, position: 'relative', cursor: 'pointer' }}
                onClick={() => desktopRef.current?.click()}
              >
                {desktopPreview ? (
                  <img src={desktopPreview} alt="Desktop banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-mid-grey)' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <p style={{ fontSize: '0.8rem', marginTop: 8, fontFamily: 'var(--font-ui)' }}>Click to select desktop banner</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-light-grey)' }}>Recommended: 1920×600</p>
                  </div>
                )}
              </div>
              <input ref={desktopRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'desktop')} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => desktopRef.current?.click()}>Replace</button>
                {desktopPreview && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleDeleteBanner('desktop')}>Delete</button>}
              </div>
            </div>
          </div>

          {/* Mobile Banner */}
          <div className="card">
            <div className="card-header"><h3 className="card-title">Mobile Banner</h3></div>
            <div className="card-body">
              <div
                style={{ width: '100%', aspectRatio: '9/5', background: 'var(--color-cream)', borderRadius: 'var(--radius-md)', overflow: 'hidden', marginBottom: 16, position: 'relative', cursor: 'pointer' }}
                onClick={() => mobileRef.current?.click()}
              >
                {mobilePreview ? (
                  <img src={mobilePreview} alt="Mobile banner" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-mid-grey)' }}>
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                    <p style={{ fontSize: '0.8rem', marginTop: 8, fontFamily: 'var(--font-ui)' }}>Click to select mobile banner</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--color-light-grey)' }}>Recommended: 768×500</p>
                  </div>
                )}
              </div>
              <input ref={mobileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'mobile')} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => mobileRef.current?.click()}>Replace</button>
                {mobilePreview && <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }} onClick={() => handleDeleteBanner('mobile')}>Delete</button>}
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <button id="save-banner-btn" className="btn btn-accent btn-lg" onClick={handleSave} disabled={uploading || (!desktopFile && !mobileFile)}>
            {uploading ? 'Saving...' : 'Save Banners'}
          </button>
          {message && <p style={{ color: 'var(--color-success)', fontFamily: 'var(--font-ui)', fontSize: '0.875rem' }}>✓ {message}</p>}
          {error && <p className="error-text">{error}</p>}
        </div>
      </div>
    </>
  );
}
