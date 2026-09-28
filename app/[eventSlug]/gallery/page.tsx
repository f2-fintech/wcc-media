'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import JSZip from 'jszip';

interface Attendee { _id: string; name: string; }
interface MediaItem {
  _id: string;
  type: 'photo' | 'video';
  thumbnailUrl: string;
  originalFileName: string;
  mimeType: string;
}
interface EventData {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  editionName?: string;
  desktopBannerUrl?: string;
  mobileBannerUrl?: string;
}

export default function GalleryPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventSlug = params.eventSlug as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [totalPhotos, setTotalPhotos] = useState(0);
  const [totalVideos, setTotalVideos] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedAttendee, setSelectedAttendee] = useState('');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  const load = useCallback(async (pageNum: number, attendeeId: string, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), limit: '24' });
      if (attendeeId) params.set('attendeeId', attendeeId);
      const res = await fetch(`/api/public/gallery/${eventSlug}?${params}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gallery not found.'); return; }
      if (!append) {
        setEvent(data.event);
        setAttendees(data.attendees || []);
        setTotalPhotos(data.totalPhotos);
        setTotalVideos(data.totalVideos);
        setMedia(data.media || []);
      } else {
        setMedia(prev => [...prev, ...(data.media || [])]);
      }
      setHasMore(pageNum < data.pagination.pages);
    } catch { setError('Failed to load gallery.'); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [eventSlug]);

  useEffect(() => {
    setPage(1);
    setMedia([]);
    load(1, selectedAttendee);
  }, [selectedAttendee, load]);

  function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    load(next, selectedAttendee, true);
  }

  async function handleDownload(item: MediaItem) {
    // For public users, we show a download by fetching the URL directly
    const a = document.createElement('a');
    a.href = item.thumbnailUrl;
    a.download = item.originalFileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  async function handleDownloadZipClick() {
    if (!selectedAttendee) return;
    setDownloadingZip(true);
    try {
      const res = await fetch(`/api/public/gallery/${eventSlug}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: '', attendeeId: selectedAttendee })
      });
      const data = await res.json();
      if (res.ok) {
        startZipDownload();
      } else if (res.status === 401) {
        setShowPinModal(true);
        setDownloadingZip(false);
      } else {
        alert(data.error || 'Failed to verify PIN status.');
        setDownloadingZip(false);
      }
    } catch {
      alert('Network error verifying PIN.');
      setDownloadingZip(false);
    }
  }

  async function submitPin(e: React.FormEvent) {
    e.preventDefault();
    setPinError('');
    try {
      const res = await fetch(`/api/public/gallery/${eventSlug}/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput, attendeeId: selectedAttendee })
      });
      const data = await res.json();
      if (res.ok) {
        setShowPinModal(false);
        setPinInput('');
        startZipDownload();
      } else {
        setPinError(data.error || 'Incorrect PIN.');
      }
    } catch {
      setPinError('Network error.');
    }
  }

  async function startZipDownload() {
    setDownloadingZip(true);
    setDownloadProgress(0);
    try {
      const params = new URLSearchParams({ attendeeId: selectedAttendee, limit: '1000' });
      const apiRes = await fetch(`/api/public/gallery/${eventSlug}?${params}`);
      const apiData = await apiRes.json();
      const allMedia: MediaItem[] = apiData.media || [];

      if (allMedia.length === 0) {
        alert('No media found to download.');
        setDownloadingZip(false);
        setDownloadProgress(null);
        return;
      }

      const zip = new JSZip();
      let loaded = 0;
      const total = allMedia.length;
      
      const promises = allMedia.map(async (item, i) => {
        try {
          const res = await fetch(item.thumbnailUrl, { cache: 'no-store' });
          if (!res.ok) throw new Error(`Failed to fetch ${item.originalFileName}`);
          const blob = await res.blob();
          
          const ext = item.originalFileName.split('.').pop() || '';
          const base = item.originalFileName.replace(`.${ext}`, '');
          const filename = `${base}_${i + 1}.${ext}`;
          
          zip.file(filename, blob);
        } catch (e) {
          console.error('Error fetching file for ZIP:', e);
        } finally {
          loaded++;
          setDownloadProgress((loaded / total) * 50);
        }
      });
      
      await Promise.all(promises);
      
      const zipBlob = await zip.generateAsync({ type: 'blob' }, (metadata) => {
        setDownloadProgress(50 + (metadata.percent / 2));
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      const attendeeName = attendees.find(att => att._id === selectedAttendee)?.name || 'attendee';
      a.download = `${attendeeName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_media.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (e) {
      alert('Failed to generate ZIP file.');
    } finally {
      setDownloadingZip(false);
      setTimeout(() => setDownloadProgress(null), 1000);
    }
  }

  if (error) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-ui)' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', marginBottom: 8 }}>Event Not Found</h1>
          <p style={{ color: 'var(--color-dark-grey)' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-white)' }}>
      {/* Hero Banner */}
      <div className="hero">
        <div className="hero-img-container">
          {event?.desktopBannerUrl || event?.mobileBannerUrl ? (
            <picture>
              {event?.mobileBannerUrl && <source media="(max-width: 768px)" srcSet={event.mobileBannerUrl} />}
              <img
                src={event?.desktopBannerUrl || event?.mobileBannerUrl}
                alt={event?.name || 'Event Banner'}
                className="hero-img"
              />
            </picture>
          ) : (
            <div style={{ width: '100%', height: '400px', background: 'linear-gradient(135deg, #1a2a3a 0%, #0d2020 50%, #1a1917 100%)' }} />
          )}
          <div className="hero-overlay" />
          <div className="hero-content">
            {loading ? (
              <div className="skeleton" style={{ height: 56, width: '60%', maxWidth: 300, marginBottom: 24, borderRadius: 4 }} />
            ) : (
              <>
                <h1 className="hero-title">{event?.name || ''}</h1>
                {(event?.editionName || event?.description) && <p className="hero-subtitle">{event.editionName || event.description}</p>}
              </>
            )}
            <div className="hero-ctas">
              <button
                className="hero-btn hero-btn-outline"
                onClick={() => document.getElementById('gallery-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                View Gallery
              </button>
              <Link href={`/${eventSlug}/my-photos`} className="hero-btn hero-btn-solid">
                My Photos
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Nav Bar */}
      <div className="gallery-bar" id="gallery-section">
        <div className="gallery-bar-top">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <img src="/logo_blue_croped.png" alt="F2 Fintech" style={{ height: '40px', objectFit: 'contain' }} />
            <div>
              <h2 className="gallery-bar-title">{event?.name || '...'}</h2>
              {(event?.editionName || event?.description) && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--color-dark-grey)', marginTop: 2, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {event.editionName || event.description}
                </div>
              )}
            </div>
          </div>

          <div className="gallery-bar-counts">
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z"/>
                <circle cx="12" cy="13" r="3"/>
              </svg>
              {totalPhotos.toLocaleString()}
            </span>
            <span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="23 7 16 12 23 17 23 7"/>
                <rect x="1" y="5" width="15" height="14" rx="2"/>
              </svg>
              {totalVideos.toLocaleString()}
            </span>
          </div>

          <div className="gallery-bar-actions">
            {selectedAttendee && media.length > 0 && (
              <button
                className="gallery-bar-action-btn"
                onClick={handleDownloadZipClick}
                disabled={downloadingZip}
                style={{ background: 'var(--color-charcoal)', color: 'white', borderColor: 'var(--color-charcoal)', position: 'relative', overflow: 'hidden' }}
              >
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
                  </svg>
                  {downloadProgress !== null ? `Loading ${Math.round(downloadProgress)}%` : downloadingZip ? 'Checking...' : 'Download ZIP'}
                </div>
                {downloadProgress !== null && (
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${downloadProgress}%`, background: 'rgba(255,255,255,0.2)', zIndex: 0, transition: 'width 0.2s' }} />
                )}
              </button>
            )}
            <Link href={`/${eventSlug}/my-photos`} className="gallery-bar-action-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
              </svg>
              My Photos
            </Link>
          </div>
        </div>

        {/* Attendee navigation */}
        <div className="gallery-edition-nav">
          <button
            className={`edition-nav-item ${selectedAttendee === '' ? 'active' : ''}`}
            onClick={() => setSelectedAttendee('')}
          >
            ALL
          </button>
          {attendees.map((att) => (
            <button
              key={att._id}
              className={`edition-nav-item ${selectedAttendee === att._id ? 'active' : ''}`}
              onClick={() => setSelectedAttendee(att._id)}
            >
              {att.name.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery Grid */}
      <div style={{ padding: '4px 0' }}>
        {loading ? (
          <div className="gallery-grid" style={{ padding: '4px' }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="skeleton"
                style={{
                  height: `${200 + Math.random() * 150}px`,
                  marginBottom: 4,
                  breakInside: 'avoid',
                }}
              />
            ))}
          </div>
        ) : media.length === 0 ? (
          <div className="empty-state" style={{ padding: '80px 24px' }}>
            <div className="empty-state-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z"/>
                <circle cx="12" cy="13" r="3"/>
              </svg>
            </div>
            <h3>No media yet</h3>
            <p>Photos and videos will appear here once uploaded.</p>
          </div>
        ) : (
          <div className="gallery-grid" style={{ padding: '0 4px' }}>
            {media.map((item, idx) => (
              <div
                key={item._id}
                className="gallery-item"
                onClick={() => setLightboxIdx(idx)}
              >
                {item.type === 'video' ? (
                  <div style={{ position: 'relative', aspectRatio: '16/9', background: 'var(--color-near-black)' }}>
                    {item.thumbnailUrl && (
                      <video
                        src={item.thumbnailUrl}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
                        preload="metadata"
                        muted
                        playsInline
                      />
                    )}
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                          <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                ) : (
                  <img
                    src={item.thumbnailUrl}
                    alt={item.originalFileName}
                    loading="lazy"
                    style={{ width: '100%', display: 'block' }}
                  />
                )}
                <div className="gallery-item-overlay">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                    style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', padding: '4px 10px', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'var(--font-ui)' }}
                  >
                    ↓ Download
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && !loading && (
          <div style={{ textAlign: 'center', padding: '32px 24px' }}>
            <button className="btn btn-outline btn-lg" onClick={handleLoadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && media[lightboxIdx] && (
        <div
          className="lightbox"
          onClick={() => setLightboxIdx(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setLightboxIdx(prev => prev !== null ? Math.min(prev + 1, media.length - 1) : null);
            if (e.key === 'ArrowLeft') setLightboxIdx(prev => prev !== null ? Math.max(prev - 1, 0) : null);
            if (e.key === 'Escape') setLightboxIdx(null);
          }}
          tabIndex={0}
        >
          <button className="lightbox-close" onClick={() => setLightboxIdx(null)}>✕</button>

          {lightboxIdx > 0 && (
            <button
              className="lightbox-nav prev"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}
            >
              ‹
            </button>
          )}

          <div onClick={(e) => e.stopPropagation()}>
            {media[lightboxIdx].type === 'video' ? (
              <video
                src={media[lightboxIdx].thumbnailUrl}
                controls
                autoPlay
                style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 8 }}
              />
            ) : (
              <img
                src={media[lightboxIdx].thumbnailUrl}
                alt={media[lightboxIdx].originalFileName}
                className="lightbox-img"
              />
            )}
          </div>

          {lightboxIdx < media.length - 1 && (
            <button
              className="lightbox-nav next"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}
            >
              ›
            </button>
          )}

          <div style={{ position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)', color: 'rgba(255,255,255,0.5)', fontFamily: 'var(--font-ui)', fontSize: '0.8rem' }}>
            {lightboxIdx + 1} / {media.length}
          </div>
        </div>
      )}

      {/* PIN Modal */}
      {showPinModal && (
        <div className="modal-overlay" onClick={() => setShowPinModal(false)} style={{ zIndex: 9999 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">Enter PIN</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowPinModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--color-dark-grey)', fontSize: '0.85rem', marginBottom: 16, fontFamily: 'var(--font-ui)' }}>
                This gallery is protected. Please enter the download PIN provided by the event organizer to download these files.
              </p>
              <form onSubmit={submitPin}>
                <div className="form-group" style={{ marginBottom: 16 }}>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Enter PIN"
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value)}
                    autoFocus
                  />
                  {pinError && <p className="error-text" style={{ marginTop: 4 }}>{pinError}</p>}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowPinModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-accent" disabled={!pinInput}>Confirm</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
