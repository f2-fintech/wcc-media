'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import JSZip from 'jszip';
import { ChevronDown, Check, Layers } from 'lucide-react';
import { startTopProgress } from '@/components/TopProgressBar';

interface Attendee { _id: string; name: string; }
interface MediaItem {
  _id: string;
  type: 'photo' | 'video';
  thumbnailUrl: string;
  originalFileName: string;
  mimeType: string;
}
interface EditionItem {
  _id: string;
  name: string;
  slug: string;
  mediaCount: number;
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
  const [editions, setEditions] = useState<EditionItem[]>([]);
  const [currentEdition, setCurrentEdition] = useState<EditionItem | null>(null);
  const [selectedEditionId, setSelectedEditionId] = useState<string>(
    searchParams.get('edition') || searchParams.get('editionId') || ''
  );
  const [isEditionDropdownOpen, setIsEditionDropdownOpen] = useState(false);
  const editionDropdownRef = useRef<HTMLDivElement>(null);

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
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Close edition dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (editionDropdownRef.current && !editionDropdownRef.current.contains(e.target as Node)) {
        setIsEditionDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const abortControllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async (pageNum: number, attendeeId: string, editionId?: string, append = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (!append) setLoading(true);
    else setLoadingMore(true);

    try {
      const queryParams = new URLSearchParams({ page: String(pageNum), limit: '24' });
      if (attendeeId) queryParams.set('attendeeId', attendeeId);
      if (editionId) queryParams.set('editionId', editionId);

      const res = await fetch(`/api/public/gallery/${eventSlug}?${queryParams}`, {
        signal: controller.signal,
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Gallery not found.'); return; }
      if (!append) {
        setEvent(data.event);
        setEditions(data.editions || []);
        if (data.currentEdition) {
          setCurrentEdition(data.currentEdition);
          setSelectedEditionId(prev => (prev ? prev : data.currentEdition._id));
        }
        const attList: Attendee[] = data.attendees || [];
        setAttendees(attList);
        setSelectedAttendee(prev => (attList.some(a => a._id === prev) ? prev : ''));
        setTotalPhotos(data.totalPhotos);
        setTotalVideos(data.totalVideos);
        setMedia(data.media || []);
      } else {
        setMedia(prev => [...prev, ...(data.media || [])]);
      }
      setHasMore(pageNum < data.pagination.pages);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError('Failed to load gallery.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [eventSlug]);

  useEffect(() => {
    setPage(1);
    setMedia([]);
    load(1, selectedAttendee, selectedEditionId);
  }, [selectedAttendee, selectedEditionId, load]);

  function handleSelectEdition(ed: EditionItem) {
    if (ed._id === selectedEditionId || ed._id === currentEdition?._id) {
      setIsEditionDropdownOpen(false);
      return;
    }
    startTopProgress();
    setSelectedAttendee('');
    setIsEditionDropdownOpen(false);
    setPage(1);
    setMedia([]);

    const url = new URL(window.location.href);
    url.searchParams.set('edition', ed.slug || ed._id);
    url.searchParams.delete('attendeeId');
    window.history.replaceState({}, '', url.toString());

    setSelectedEditionId(ed._id);
  }

  function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    load(next, selectedAttendee, selectedEditionId, true);
  }

  function handleDownload(item: MediaItem) {
    if (!item || !item._id) return;
    setDownloadingId(item._id);

    // Direct download via dedicated same-origin streaming route with Content-Disposition: attachment
    // Bypasses browser CORS and forces immediate direct download into Downloads folder without opening in new tab
    const downloadUrl = `/api/public/gallery/download?mediaId=${encodeURIComponent(item._id)}`;

    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = downloadUrl;
    a.setAttribute('download', item.originalFileName || 'image.jpeg');
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      setDownloadingId(null);
    }, 1500);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo_blue_croped.png" alt="F2 Fintech" style={{ height: '40px', objectFit: 'contain' }} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h2 className="gallery-bar-title" style={{ margin: 0 }}>{event?.name || '...'}</h2>

                {/* Edition Selector Dropdown (Tareeqa 1) */}
                {editions.length > 0 && (
                  <div style={{ position: 'relative', display: 'inline-block' }} ref={editionDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setIsEditionDropdownOpen(!isEditionDropdownOpen)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '7px',
                        padding: '5px 14px',
                        borderRadius: '20px',
                        backgroundColor: '#eff6ff',
                        border: '1px solid #bfdbfe',
                        color: '#1d2ebd',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxShadow: '0 1px 3px rgba(29, 46, 189, 0.08)',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#dbeafe';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = '#eff6ff';
                      }}
                    >
                      <Layers size={13} style={{ color: '#1d2ebd' }} />
                      <span>{currentEdition?.name || event?.editionName || 'Select Edition'}</span>
                      <ChevronDown
                        size={14}
                        style={{
                          transform: isEditionDropdownOpen ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s ease',
                        }}
                      />
                    </button>

                    {/* Dropdown Menu */}
                    {isEditionDropdownOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          left: 0,
                          minWidth: '270px',
                          backgroundColor: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '14px',
                          boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.12), 0 4px 12px -2px rgba(0, 0, 0, 0.06)',
                          zIndex: 100,
                          padding: '6px',
                        }}
                      >
                        <div
                          style={{
                            padding: '8px 12px 6px',
                            borderBottom: '1px solid #f1f5f9',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              letterSpacing: '0.1em',
                              textTransform: 'uppercase',
                              color: '#64748b',
                            }}
                          >
                            Select Edition
                          </span>
                          <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                            {editions.length} Available
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                          {editions.map((ed) => {
                            const isSelected = ed._id === (currentEdition?._id || selectedEditionId);
                            return (
                              <button
                                key={ed._id}
                                type="button"
                                onClick={() => handleSelectEdition(ed)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '8px 12px',
                                  borderRadius: '8px',
                                  border: 'none',
                                  backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                                  color: isSelected ? '#1d2ebd' : '#334155',
                                  fontWeight: isSelected ? 600 : 500,
                                  fontSize: '0.82rem',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  width: '100%',
                                  transition: 'background 0.15s',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = '#f8fafc';
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  {isSelected ? (
                                    <Check size={14} style={{ color: '#1d2ebd', flexShrink: 0 }} />
                                  ) : (
                                    <span style={{ width: '14px', height: '14px', display: 'inline-block' }} />
                                  )}
                                  <span>{ed.name}</span>
                                </div>
                                <span
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '2px 8px',
                                    borderRadius: '9999px',
                                    backgroundColor: isSelected ? '#dbeafe' : '#f1f5f9',
                                    color: isSelected ? '#1d2ebd' : '#64748b',
                                    fontWeight: 600,
                                  }}
                                >
                                  {ed.mediaCount} media
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {editions.length === 1 && (
                          <div
                            style={{
                              marginTop: '4px',
                              padding: '8px 10px 4px',
                              borderTop: '1px solid #f1f5f9',
                              fontSize: '0.7rem',
                              color: '#94a3b8',
                              textAlign: 'center',
                            }}
                          >
                            Additional editions will appear here once added in Admin.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {(currentEdition?.name || event?.editionName || event?.description) && (
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '0.7rem', color: 'var(--color-dark-grey)', marginTop: 2, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                  {currentEdition?.name || event?.editionName || event?.description}
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
                  {downloadProgress !== null ? `Loading ${Math.round(downloadProgress)}%` : downloadingZip ? 'Checking...' : 'Download Folder ZIP'}
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
                    disabled={downloadingId === item._id}
                    style={{
                      background: 'rgba(255,255,255,0.2)',
                      backdropFilter: 'blur(4px)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: 'white',
                      padding: '5px 12px',
                      borderRadius: 4,
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      cursor: downloadingId === item._id ? 'wait' : 'pointer',
                      fontFamily: 'var(--font-ui)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    {downloadingId === item._id ? 'Downloading...' : 'Download'}
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
          {/* Top Download Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(media[lightboxIdx]);
            }}
            disabled={downloadingId === media[lightboxIdx]._id}
            title="Download image"
            style={{
              position: 'absolute',
              top: 16,
              right: 70,
              height: 40,
              padding: '0 16px',
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 20,
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: downloadingId === media[lightboxIdx]._id ? 'wait' : 'pointer',
              fontFamily: 'var(--font-ui)',
              fontSize: '0.85rem',
              fontWeight: 500,
              zIndex: 2005,
              transition: 'background var(--transition-fast)',
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {downloadingId === media[lightboxIdx]._id ? 'Downloading...' : 'Download'}
          </button>

          <button className="lightbox-close" onClick={() => setLightboxIdx(null)}>✕</button>

          {lightboxIdx > 0 && (
            <button
              className="lightbox-nav prev"
              onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}
            >
              ‹
            </button>
          )}

          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              maxWidth: '92vw',
            }}
          >
            {media[lightboxIdx].type === 'video' ? (
              <video
                src={media[lightboxIdx].thumbnailUrl}
                controls
                autoPlay
                style={{ maxWidth: '90vw', maxHeight: '72vh', borderRadius: 8 }}
              />
            ) : (
              <img
                src={media[lightboxIdx].thumbnailUrl}
                alt={media[lightboxIdx].originalFileName}
                className="lightbox-img"
                style={{ maxHeight: '72vh' }}
              />
            )}

            {/* Direct Download Button in Image View */}
            <button
              onClick={() => handleDownload(media[lightboxIdx])}
              disabled={downloadingId === media[lightboxIdx]._id}
              style={{
                background: 'rgba(255, 255, 255, 0.95)',
                color: 'var(--color-charcoal)',
                border: 'none',
                borderRadius: 24,
                padding: '10px 24px',
                fontSize: '0.875rem',
                fontWeight: 600,
                fontFamily: 'var(--font-ui)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                cursor: downloadingId === media[lightboxIdx]._id ? 'wait' : 'pointer',
                boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
                transition: 'all 0.15s ease',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              {downloadingId === media[lightboxIdx]._id ? 'Downloading...' : 'Download Image'}
            </button>
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
