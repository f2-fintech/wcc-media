'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface MediaItem {
  _id: string;
  type: 'photo' | 'video';
  viewUrl: string;
  thumbnailUrl: string;
  originalFileName: string;
  size: number;
  createdAt: string;
}

interface AttendeeResult {
  found: boolean;
  attendee?: { name: string };
  media: MediaItem[];
}

function formatFileSize(bytes: number): string {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function MyPhotosPage() {
  const params = useParams();
  const eventSlug = params.eventSlug as string;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AttendeeResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'photo' | 'video'>('all');
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setResult(null);

    if (!name.trim() || !email.trim()) {
      setError('Please enter both your name and email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/attendees/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), eventSlug }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Lookup failed.'); return; }
      setResult(data);
    } catch { setError('Network error. Please try again.'); }
    finally { setLoading(false); }
  }

  async function handleDownload(item: MediaItem) {
    const a = document.createElement('a');
    a.href = item.viewUrl || item.thumbnailUrl;
    a.download = item.originalFileName;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const filteredMedia = result?.media?.filter(m => filter === 'all' || m.type === filter) || [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-white)' }}>
      {/* Mini header */}
      <div style={{
        background: 'var(--color-white)',
        borderBottom: '1px solid var(--color-light-grey)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <img src="/logo_blue_croped.png" alt="F2 Fintech" style={{ height: '36px', objectFit: 'contain' }} />
          <Link
            href={`/${eventSlug}/gallery`}
            style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-dark-grey)', fontFamily: 'var(--font-ui)', fontSize: '0.8rem', textDecoration: 'none' }}
          >
            ← Back to Gallery
          </Link>
        </div>
      </div>

      {/* Form or Results */}
      {!result ? (
        <div className="my-photos-page">
          <div style={{ marginBottom: 8 }}>
            <Link href={`/${eventSlug}/gallery`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--color-dark-grey)', fontSize: '0.8rem', fontFamily: 'var(--font-ui)', marginBottom: 24 }}>
              ← Gallery
            </Link>
          </div>

          <h1 className="my-photos-heading">My Photos</h1>
          <p className="my-photos-sub">To continue, please enter your details.</p>

          <form onSubmit={handleLookup}>
            <div className="form-group" style={{ marginBottom: 24 }}>
              <label className="form-label" htmlFor="my-photos-name" style={{ fontSize: '0.75rem', letterSpacing: '0.08em' }}>Name</label>
              <input
                id="my-photos-name"
                className="my-photos-form-input"
                placeholder="Your full name"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group" style={{ marginBottom: 32 }}>
              <label className="form-label" htmlFor="my-photos-email" style={{ color: 'var(--color-accent)', fontSize: '0.75rem', letterSpacing: '0.08em' }}>Email</label>
              <input
                id="my-photos-email"
                className="my-photos-form-input"
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            {error && (
              <p style={{ color: 'var(--color-error)', fontFamily: 'var(--font-ui)', fontSize: '0.85rem', marginBottom: 16 }}>
                {error}
              </p>
            )}

            <button
              id="my-photos-next-btn"
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ minWidth: 120 }}
            >
              {loading ? 'Searching...' : 'Next'}
            </button>
          </form>
        </div>
      ) : (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
          {/* Back button */}
          <button
            className="btn btn-ghost"
            style={{ marginBottom: 24 }}
            onClick={() => { setResult(null); setFilter('all'); }}
          >
            ← Search Again
          </button>

          {!result.found || result.media.length === 0 ? (
            <div className="empty-state" style={{ maxWidth: 480, margin: '60px auto' }}>
              <div className="empty-state-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                </svg>
              </div>
              <h3>No photos or videos found</h3>
              <p>No photos or videos were found for the details provided.</p>
              <button className="btn btn-outline" style={{ marginTop: 16 }} onClick={() => setResult(null)}>Try Again</button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ marginBottom: 32 }}>
                <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.75rem', color: 'var(--color-dark-grey)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>
                  Welcome
                </p>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 400, color: 'var(--color-charcoal)', letterSpacing: '0.04em' }}>
                  {result.attendee?.name}
                </h2>
              </div>

              {/* Filter tabs */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--color-light-grey)', paddingBottom: 0 }}>
                {(['all', 'photo', 'video'] as const).map((f) => {
                  const count = f === 'all' ? result.media.length : result.media.filter(m => m.type === f).length;
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      style={{
                        padding: '10px 20px',
                        fontFamily: 'var(--font-ui)',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        background: 'none',
                        border: 'none',
                        borderBottom: filter === f ? '2px solid var(--color-charcoal)' : '2px solid transparent',
                        color: filter === f ? 'var(--color-charcoal)' : 'var(--color-dark-grey)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        marginBottom: -1,
                      }}
                    >
                      {f === 'all' ? 'All' : f === 'photo' ? 'Photos' : 'Videos'} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Media grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                {filteredMedia.map((item, idx) => (
                  <div
                    key={item._id}
                    style={{
                      position: 'relative',
                      borderRadius: 'var(--radius-md)',
                      overflow: 'hidden',
                      background: 'var(--color-cream)',
                      aspectRatio: item.type === 'video' ? '16/9' : '3/4',
                      cursor: 'pointer',
                    }}
                    onClick={() => setLightboxIdx(idx)}
                  >
                    {item.type === 'video' ? (
                      <>
                        <video
                          src={item.thumbnailUrl}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
                          preload="metadata"
                          muted
                          playsInline
                        />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                          <div style={{ width: 48, height: 48, background: 'rgba(255,255,255,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                          </div>
                        </div>
                        <span className="badge badge-video" style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, fontSize: '0.65rem' }}>Video</span>
                      </>
                    ) : (
                      <img src={item.thumbnailUrl} alt={item.originalFileName} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                    )}

                    {/* Download overlay */}
                    <div style={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, transparent 60%)',
                      display: 'flex', alignItems: 'flex-end', padding: 12,
                      opacity: 0, transition: 'opacity 0.2s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                    >
                      <button
                        className="btn"
                        style={{ background: 'white', color: 'var(--color-charcoal)', padding: '6px 14px', fontSize: '0.78rem', borderRadius: 4 }}
                        onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                      >
                        ↓ Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && filteredMedia[lightboxIdx] && (
        <div
          className="lightbox"
          onClick={() => setLightboxIdx(null)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') setLightboxIdx(prev => prev !== null ? Math.min(prev + 1, filteredMedia.length - 1) : null);
            if (e.key === 'ArrowLeft') setLightboxIdx(prev => prev !== null ? Math.max(prev - 1, 0) : null);
            if (e.key === 'Escape') setLightboxIdx(null);
          }}
          tabIndex={0}
        >
          <button className="lightbox-close" onClick={() => setLightboxIdx(null)}>✕</button>

          {lightboxIdx > 0 && (
            <button className="lightbox-nav prev" onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }}>‹</button>
          )}

          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {filteredMedia[lightboxIdx].type === 'video' ? (
              <video src={filteredMedia[lightboxIdx].viewUrl || filteredMedia[lightboxIdx].thumbnailUrl} controls autoPlay style={{ maxWidth: '90vw', maxHeight: '78vh', borderRadius: 8 }} />
            ) : (
              <img src={filteredMedia[lightboxIdx].viewUrl || filteredMedia[lightboxIdx].thumbnailUrl} alt={filteredMedia[lightboxIdx].originalFileName} className="lightbox-img" />
            )}
            <button
              className="btn"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '8px 20px', fontSize: '0.8rem' }}
              onClick={() => handleDownload(filteredMedia[lightboxIdx])}
            >
              ↓ Download
            </button>
          </div>

          {lightboxIdx < filteredMedia.length - 1 && (
            <button className="lightbox-nav next" onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }}>›</button>
          )}
        </div>
      )}
    </div>
  );
}
