'use client';

import { Suspense, useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import SearchableSelect from '@/components/admin/SearchableSelect';

interface EventItem {
  _id: string;
  name: string;
}

interface EditionItem {
  _id: string;
  name: string;
  slug?: string;
}

function BannerPageInner() {
  const searchParams = useSearchParams();
  const urlEventId = searchParams.get('eventId') || '';
  const urlEditionId = searchParams.get('editionId') || '';

  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEvent, setSelectedEvent] = useState(urlEventId);
  const [editions, setEditions] = useState<EditionItem[]>([]);
  const [selectedEdition, setSelectedEdition] = useState(urlEditionId);

  const [desktopPreview, setDesktopPreview] = useState('');
  const [mobilePreview, setMobilePreview] = useState('');
  const [desktopFile, setDesktopFile] = useState<File | null>(null);
  const [mobileFile, setMobileFile] = useState<File | null>(null);
  const [isDesktopFallback, setIsDesktopFallback] = useState(false);
  const [isMobileFallback, setIsMobileFallback] = useState(false);
  const [hasCustomDesktop, setHasCustomDesktop] = useState(false);
  const [hasCustomMobile, setHasCustomMobile] = useState(false);

  const [loadingBanner, setLoadingBanner] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const desktopRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);

  // Load events
  useEffect(() => {
    fetch('/api/events?all=true')
      .then((r) => r.json())
      .then((d) => {
        const evList: EventItem[] = d.events || [];
        setEvents(evList);
        if (evList.length > 0 && !selectedEvent) {
          const match = urlEventId && evList.some((e) => e._id === urlEventId);
          setSelectedEvent(match ? urlEventId : evList[0]._id);
        }
      })
      .catch((err) => console.error('Failed to load events:', err));
  }, [urlEventId]);

  // Load editions when selectedEvent changes
  useEffect(() => {
    if (!selectedEvent) {
      setEditions([]);
      setSelectedEdition('');
      return;
    }

    fetch(`/api/editions?eventId=${selectedEvent}&all=true`)
      .then((r) => r.json())
      .then((d) => {
        const edList: EditionItem[] = d.editions || [];
        setEditions(edList);

        // Keep or validate selected edition
        if (urlEditionId && edList.some((ed) => ed._id === urlEditionId)) {
          setSelectedEdition(urlEditionId);
        } else if (selectedEdition && !edList.some((ed) => ed._id === selectedEdition)) {
          setSelectedEdition('');
        }
      })
      .catch((err) => console.error('Failed to load editions:', err));
  }, [selectedEvent, urlEditionId]);

  // Fetch banner data when selectedEvent or selectedEdition changes
  const loadBanners = useCallback(async () => {
    if (!selectedEvent) return;
    setLoadingBanner(true);
    setDesktopFile(null);
    setMobileFile(null);

    try {
      const url = `/api/banner/${selectedEvent}${selectedEdition ? `?editionId=${selectedEdition}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();

      if (res.ok) {
        setDesktopPreview(data.desktopBannerUrl || '');
        setMobilePreview(data.mobileBannerUrl || '');
        setIsDesktopFallback(Boolean(data.isDesktopFallback));
        setIsMobileFallback(Boolean(data.isMobileFallback));
        setHasCustomDesktop(Boolean(data.hasCustomDesktop));
        setHasCustomMobile(Boolean(data.hasCustomMobile));
      } else {
        setDesktopPreview('');
        setMobilePreview('');
        setIsDesktopFallback(false);
        setIsMobileFallback(false);
        setHasCustomDesktop(false);
        setHasCustomMobile(false);
      }
    } catch (err) {
      console.error('Failed to load banner:', err);
    } finally {
      setLoadingBanner(false);
    }
  }, [selectedEvent, selectedEdition]);

  useEffect(() => {
    loadBanners();
  }, [loadBanners]);

  function handleFileSelect(file: File, variant: 'desktop' | 'mobile') {
    const url = URL.createObjectURL(file);
    setError('');
    setMessage('');
    if (variant === 'desktop') {
      setDesktopFile(file);
      setDesktopPreview(url);
      setIsDesktopFallback(false);
    } else {
      setMobileFile(file);
      setMobilePreview(url);
      setIsMobileFallback(false);
    }
  }

  async function uploadBanner(file: File, variant: 'desktop' | 'mobile') {
    // 1. Get presigned URL
    const presignRes = await fetch('/api/banner/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventId: selectedEvent,
        editionId: selectedEdition || undefined,
        variant,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      }),
    });
    const presignData = await presignRes.json();
    if (!presignRes.ok) throw new Error(presignData.error || 'Failed to get upload URL');

    // 2. Upload to S3
    const uploadRes = await fetch(presignData.presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!uploadRes.ok) throw new Error('S3 upload failed');

    // 3. Save metadata to DB
    const saveRes = await fetch(`/api/banner/${selectedEvent}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        editionId: selectedEdition || undefined,
        variant,
        s3Bucket: presignData.s3Bucket,
        s3Key: presignData.s3Key,
        s3Url: presignData.s3Url,
      }),
    });
    if (!saveRes.ok) {
      const saveErr = await saveRes.json();
      throw new Error(saveErr.error || 'Failed to save banner metadata');
    }
  }

  async function handleSave() {
    setError('');
    setMessage('');
    if (!desktopFile && !mobileFile) {
      setError('Select at least one banner image to upload.');
      return;
    }
    setUploading(true);
    try {
      if (desktopFile) await uploadBanner(desktopFile, 'desktop');
      if (mobileFile) await uploadBanner(mobileFile, 'mobile');
      setMessage(
        selectedEdition
          ? 'Edition banner(s) saved successfully!'
          : 'Event fallback banner(s) saved successfully!'
      );
      setDesktopFile(null);
      setMobileFile(null);
      await loadBanners();
    } catch (err: any) {
      setError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteBanner(variant: 'desktop' | 'mobile') {
    const isEdition = Boolean(selectedEdition);
    const confirmMsg = isEdition
      ? `Remove the custom ${variant} banner for this edition? It will automatically revert to the event fallback banner.`
      : `Delete the event-wide ${variant} banner?`;

    if (!confirm(confirmMsg)) return;

    setError('');
    setMessage('');
    try {
      const url = `/api/banner/${selectedEvent}?variant=${variant}${selectedEdition ? `&editionId=${selectedEdition}` : ''}`;
      const res = await fetch(url, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Failed to delete banner.');
      }
      setMessage(
        isEdition
          ? `Custom ${variant} banner removed. Reverted to event default.`
          : `${variant} banner deleted.`
      );
      await loadBanners();
    } catch (err: any) {
      setError(err.message || 'Delete failed.');
    }
  }

  const selectedEventObj = events.find((e) => e._id === selectedEvent);
  const selectedEditionObj = editions.find((ed) => ed._id === selectedEdition);

  return (
    <>
      <div className="admin-topbar">
        <div>
          <h2 className="admin-topbar-title">Banner Management</h2>
          <p
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '0.8rem',
              color: 'var(--color-dark-grey)',
              marginTop: 2,
            }}
          >
            Upload separate desktop and mobile hero banners for each event and edition
          </p>
        </div>
      </div>

      <div className="admin-content">
        {/* Event & Edition selectors */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-body" style={{ paddingTop: 16, paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              {/* Event Select */}
              <div style={{ minWidth: 260, flex: 1 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>
                  Select Event
                </label>
                <SearchableSelect
                  value={selectedEvent}
                  onChange={(val) => {
                    setSelectedEvent(val);
                    setSelectedEdition('');
                  }}
                  placeholder="Select an Event..."
                  searchPlaceholder="Search events..."
                  options={events.map((ev) => ({
                    value: ev._id,
                    label: ev.name,
                    icon: '📅',
                  }))}
                />
              </div>

              {/* Edition Select */}
              <div style={{ minWidth: 280, flex: 1 }}>
                <label className="form-label" style={{ marginBottom: 4 }}>
                  Select Edition / Target
                </label>
                <SearchableSelect
                  value={selectedEdition}
                  onChange={(val) => setSelectedEdition(val)}
                  placeholder="Event Default Banner"
                  searchPlaceholder="Search editions..."
                  options={[
                    {
                      value: '',
                      label: '🌐 Event Fallback Banner (Default for all editions)',
                      icon: '🌐',
                    },
                    ...editions.map((ed) => ({
                      value: ed._id,
                      label: `📑 Edition: ${ed.name}`,
                      icon: '📑',
                    })),
                  ]}
                />
              </div>
            </div>

            {/* Target indicator banner */}
            <div
              style={{
                marginTop: 14,
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                background: selectedEdition ? 'rgba(37, 99, 235, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                fontSize: '0.82rem',
                fontFamily: 'var(--font-ui)',
              }}
            >
              <div>
                <span style={{ fontWeight: 600, color: 'var(--color-black)' }}>
                  Target:{' '}
                </span>
                {selectedEdition ? (
                  <span style={{ color: '#1d4ed8', fontWeight: 600 }}>
                    Edition &ldquo;{selectedEditionObj?.name || 'Selected Edition'}&rdquo; ({selectedEventObj?.name})
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-dark-grey)', fontWeight: 600 }}>
                    Global Fallback for event &ldquo;{selectedEventObj?.name}&rdquo;
                  </span>
                )}
              </div>
              <div style={{ color: 'var(--color-mid-grey)', fontSize: '0.78rem' }}>
                {selectedEdition
                  ? 'If no edition banner is uploaded, the event default banner is automatically displayed.'
                  : 'Used as the default hero whenever an edition does not have its own custom banner.'}
              </div>
            </div>
          </div>
        </div>

        {loadingBanner ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-dark-grey)' }}>
            Loading banners...
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
            {/* Desktop Banner */}
            <div className="card">
              <div
                className="card-header"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <h3 className="card-title" style={{ margin: 0 }}>
                  Desktop Banner
                </h3>
                {selectedEdition && (
                  <div>
                    {hasCustomDesktop && !desktopFile ? (
                      <span
                        className="badge badge-active"
                        style={{ fontSize: '0.75rem', fontWeight: 600 }}
                      >
                        ✨ Custom Edition Banner
                      </span>
                    ) : isDesktopFallback && !desktopFile ? (
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.75rem',
                          background: 'rgba(0,0,0,0.06)',
                          color: 'var(--color-dark-grey)',
                        }}
                      >
                        🌐 Inherited from Event
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="card-body">
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '16/6',
                    background: 'var(--color-cream)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    marginBottom: 16,
                    position: 'relative',
                    cursor: 'pointer',
                    border: '1px dashed var(--color-border)',
                  }}
                  onClick={() => desktopRef.current?.click()}
                >
                  {desktopPreview ? (
                    <img
                      src={desktopPreview}
                      alt="Desktop banner"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: 'var(--color-mid-grey)',
                        padding: 16,
                        textAlign: 'center',
                      }}
                    >
                      <svg
                        width="36"
                        height="36"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <p
                        style={{
                          fontSize: '0.8rem',
                          marginTop: 8,
                          fontFamily: 'var(--font-ui)',
                          color: 'var(--color-black)',
                        }}
                      >
                        Click to select desktop banner
                      </p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-light-grey)', margin: 0 }}>
                        Recommended: 1920×600 (Landscape)
                      </p>
                    </div>
                  )}

                  {selectedEdition && isDesktopFallback && !desktopFile && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'rgba(0, 0, 0, 0.65)',
                        color: '#fff',
                        fontSize: '0.72rem',
                        padding: '4px 8px',
                        textAlign: 'center',
                      }}
                    >
                      Showing Event Fallback Banner · Click to override for this edition
                    </div>
                  )}
                </div>

                <input
                  ref={desktopRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'desktop')}
                />

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => desktopRef.current?.click()}
                  >
                    {desktopPreview
                      ? selectedEdition && isDesktopFallback && !desktopFile
                        ? 'Override with Edition Banner'
                        : 'Replace Desktop Banner'
                      : 'Select Desktop Banner'}
                  </button>

                  {/* Remove button */}
                  {selectedEdition ? (
                    hasCustomDesktop && !desktopFile && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-error)' }}
                        onClick={() => handleDeleteBanner('desktop')}
                      >
                        Revert to Event Banner
                      </button>
                    )
                  ) : (
                    desktopPreview && !desktopFile && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-error)' }}
                        onClick={() => handleDeleteBanner('desktop')}
                      >
                        Remove
                      </button>
                    )
                  )}

                  {desktopFile && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        alignSelf: 'center',
                        color: 'var(--color-dark-grey)',
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      Selected: <strong>{desktopFile.name}</strong>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile Banner */}
            <div className="card">
              <div
                className="card-header"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                <h3 className="card-title" style={{ margin: 0 }}>
                  Mobile Banner
                </h3>
                {selectedEdition && (
                  <div>
                    {hasCustomMobile && !mobileFile ? (
                      <span
                        className="badge badge-active"
                        style={{ fontSize: '0.75rem', fontWeight: 600 }}
                      >
                        ✨ Custom Edition Banner
                      </span>
                    ) : isMobileFallback && !mobileFile ? (
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.75rem',
                          background: 'rgba(0,0,0,0.06)',
                          color: 'var(--color-dark-grey)',
                        }}
                      >
                        🌐 Inherited from Event
                      </span>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="card-body">
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '9/16',
                    maxHeight: 280,
                    background: 'var(--color-cream)',
                    borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                    marginBottom: 16,
                    position: 'relative',
                    cursor: 'pointer',
                    margin: '0 auto 16px',
                    border: '1px dashed var(--color-border)',
                  }}
                  onClick={() => mobileRef.current?.click()}
                >
                  {mobilePreview ? (
                    <img
                      src={mobilePreview}
                      alt="Mobile banner"
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: 'var(--color-mid-grey)',
                        padding: 16,
                        textAlign: 'center',
                      }}
                    >
                      <svg
                        width="36"
                        height="36"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.2"
                      >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      <p
                        style={{
                          fontSize: '0.8rem',
                          marginTop: 8,
                          fontFamily: 'var(--font-ui)',
                          color: 'var(--color-black)',
                        }}
                      >
                        Click to select mobile banner
                      </p>
                      <p style={{ fontSize: '0.7rem', color: 'var(--color-light-grey)', margin: 0 }}>
                        Recommended: 750×1334 (Portrait)
                      </p>
                    </div>
                  )}

                  {selectedEdition && isMobileFallback && !mobileFile && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'rgba(0, 0, 0, 0.65)',
                        color: '#fff',
                        fontSize: '0.72rem',
                        padding: '4px 8px',
                        textAlign: 'center',
                      }}
                    >
                      Showing Event Fallback · Click to override
                    </div>
                  )}
                </div>

                <input
                  ref={mobileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0], 'mobile')}
                />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-outline btn-sm"
                    onClick={() => mobileRef.current?.click()}
                  >
                    {mobilePreview
                      ? selectedEdition && isMobileFallback && !mobileFile
                        ? 'Override with Edition Banner'
                        : 'Replace Mobile Banner'
                      : 'Select Mobile Banner'}
                  </button>

                  {/* Remove button */}
                  {selectedEdition ? (
                    hasCustomMobile && !mobileFile && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-error)' }}
                        onClick={() => handleDeleteBanner('mobile')}
                      >
                        Revert to Event Banner
                      </button>
                    )
                  ) : (
                    mobilePreview && !mobileFile && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-error)' }}
                        onClick={() => handleDeleteBanner('mobile')}
                      >
                        Remove
                      </button>
                    )
                  )}

                  {mobileFile && (
                    <div
                      style={{
                        width: '100%',
                        textAlign: 'center',
                        fontSize: '0.75rem',
                        color: 'var(--color-dark-grey)',
                        fontFamily: 'var(--font-ui)',
                      }}
                    >
                      Selected: <strong>{mobileFile.name}</strong>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {error && <p className="error-text" style={{ marginTop: 16 }}>{error}</p>}
        {message && (
          <p
            style={{
              color: 'var(--color-success)',
              marginTop: 16,
              fontFamily: 'var(--font-ui)',
              fontSize: '0.875rem',
            }}
          >
            ✓ {message}
          </p>
        )}

        {(desktopFile || mobileFile) && (
          <div style={{ marginTop: 24 }}>
            <button className="btn btn-accent btn-lg" onClick={handleSave} disabled={uploading}>
              {uploading
                ? 'Uploading to S3...'
                : selectedEdition
                ? 'Save and Publish Edition Banners'
                : 'Save and Publish Event Banners'}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export default function BannerPage() {
  return (
    <Suspense
      fallback={
        <div className="admin-content">
          <p>Loading banner management...</p>
        </div>
      }
    >
      <BannerPageInner />
    </Suspense>
  );
}
