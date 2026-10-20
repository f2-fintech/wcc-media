'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { 
  Search, 
  Sparkles, 
  ArrowUpRight, 
  Image as ImageIcon, 
  ShieldCheck, 
  X,
  Calendar,
  Layers
} from 'lucide-react';
import { startTopProgress } from '@/components/TopProgressBar';

export interface EventItemData {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coverImage?: string | null;
  mediaCount: number;
  editionCount: number;
  active: boolean;
  createdAt?: string;
}

interface EventPortalClientProps {
  events: EventItemData[];
}

// Preset luxury light gradients for events without custom banners
const THEME_LIGHT_GRADIENTS: Record<string, { bg: string; accent: string; tag: string; border: string }> = {
  'white-coat-club': {
    bg: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #e0f2fe 100%)',
    accent: '#059669',
    tag: 'Medical Excellence',
    border: '#bbf7d0',
  },
  'navratri': {
    bg: 'linear-gradient(135deg, #fdf4ff 0%, #fae8ff 50%, #eff6ff 100%)',
    accent: '#9333ea',
    tag: 'Festive Celebration',
    border: '#f5d0fe',
  },
  'diwali': {
    bg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #ffedd5 100%)',
    accent: '#d97706',
    tag: 'Festival of Lights',
    border: '#fde68a',
  },
  'f2-anniversary-': {
    bg: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #e0e7ff 100%)',
    accent: '#1d2ebd',
    tag: 'Milestone Celebration',
    border: '#bfdbfe',
  },
};

export default function EventPortalClient({ events }: EventPortalClientProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'media' | 'active'>('all');

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchesSearch =
        ev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ev.description && ev.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ev.slug.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      if (filterMode === 'media') {
        return ev.mediaCount > 0;
      }
      if (filterMode === 'active') {
        return ev.active;
      }
      return true;
    });
  }, [events, searchQuery, filterMode]);

  const totalMedia = useMemo(() => {
    return events.reduce((acc, curr) => acc + (curr.mediaCount || 0), 0);
  }, [events]);

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#ffffff',
        color: '#0f172a',
        fontFamily: 'var(--font-ui, "Outfit", system-ui, -apple-system, sans-serif)',
        position: 'relative',
        overflowX: 'hidden',
      }}
    >
      {/* Light subtle atmospheric background */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          pointerEvents: 'none',
          zIndex: 0,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 40%, #f1f5f9 100%)',
        }}
      >
        {/* Soft F2 royal blue gradient radial glow at the top */}
        <div
          style={{
            position: 'absolute',
            top: '-15%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90vw',
            maxWidth: '1200px',
            height: '520px',
            background: 'radial-gradient(ellipse at center, rgba(29, 46, 189, 0.07) 0%, rgba(37, 99, 235, 0.03) 50%, transparent 75%)',
            filter: 'blur(50px)',
          }}
        />

        {/* Delicate decorative grid lines */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `linear-gradient(rgba(29, 46, 189, 0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(29, 46, 189, 0.025) 1px, transparent 1px)`,
            backgroundSize: '48px 48px',
          }}
        />
      </div>

      {/* Main Content Layout */}
      <div style={{ position: 'relative', zIndex: 1, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Sticky Header with Official F2 Logo */}
        <header
          style={{
            height: '76px',
            borderBottom: '1px solid #e2e8f0',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            backgroundColor: 'rgba(255, 255, 255, 0.88)',
            position: 'sticky',
            top: 0,
            zIndex: 40,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 32px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.03)',
          }}
        >
          {/* Logo & Platform Name */}
          <Link
            href="/"
            onClick={() => startTopProgress()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_blue_croped.png"
              alt="F2 Fintech"
              style={{
                height: '38px',
                width: 'auto',
                objectFit: 'contain',
                display: 'block',
              }}
            />
            <div
              style={{
                width: '1px',
                height: '24px',
                backgroundColor: '#cbd5e1',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span
                style={{
                  fontFamily: 'var(--font-display, Georgia, serif)',
                  fontSize: '1.25rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  color: '#0f172a',
                  lineHeight: 1.1,
                }}
              >
                1<span style={{ color: '#1d2ebd', fontStyle: 'italic' }}>F2</span>
              </span>
              <span
                style={{
                  fontSize: '0.62rem',
                  letterSpacing: '0.18em',
                  textTransform: 'uppercase',
                  color: '#64748b',
                  fontWeight: 600,
                }}
              >
                Media Experience
              </span>
            </div>
          </Link>

          {/* Right Action: Admin Portal Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <Link
              href="/admin/login"
              onClick={() => startTopProgress()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '10px',
                fontSize: '0.84rem',
                fontWeight: 600,
                color: '#ffffff',
                textDecoration: 'none',
                backgroundColor: '#1d2ebd',
                border: '1px solid #1d2ebd',
                boxShadow: '0 2px 8px rgba(29, 46, 189, 0.25)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#152296';
                e.currentTarget.style.borderColor = '#152296';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(29, 46, 189, 0.35)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#1d2ebd';
                e.currentTarget.style.borderColor = '#1d2ebd';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(29, 46, 189, 0.25)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <ShieldCheck size={16} />
              Admin Portal
            </Link>
          </div>
        </header>

        {/* Hero Section */}
        <section
          style={{
            padding: '72px 24px 44px',
            textAlign: 'center',
            maxWidth: '1000px',
            margin: '0 auto',
            width: '100%',
          }}
        >
          {/* F2 Fintech Brand Tag */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 16px',
              borderRadius: '9999px',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              color: '#1d2ebd',
              fontSize: '0.74rem',
              fontWeight: 700,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              marginBottom: '24px',
              boxShadow: '0 2px 6px rgba(29, 46, 189, 0.06)',
            }}
          >
            <Sparkles size={14} style={{ color: '#1d2ebd' }} />
            F2 FINTECH OFFICIAL MEDIA PORTAL
          </div>

          {/* Designer Main Heading: "1F2" */}
          <div style={{ position: 'relative', display: 'inline-block', marginBottom: '20px' }}>
            <h1
              style={{
                margin: 0,
                fontSize: 'clamp(4.2rem, 11vw, 8rem)',
                fontWeight: 300,
                lineHeight: 0.98,
                letterSpacing: '-0.01em',
                fontFamily: 'var(--font-display, "Cormorant Garamond", Georgia, serif)',
                color: '#0f172a',
              }}
            >
              <span
                style={{
                  fontWeight: 400,
                  color: '#0f172a',
                  letterSpacing: '-0.02em',
                }}
              >
                1
              </span>
              <span
                style={{
                  fontStyle: 'italic',
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #1d2ebd 10%, #2563eb 55%, #0284c7 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  display: 'inline-block',
                  marginLeft: '2px',
                  filter: 'drop-shadow(0 4px 18px rgba(29, 46, 189, 0.2))',
                }}
              >
                F2
              </span>
            </h1>

            {/* Signature Underline */}
            <div
              style={{
                width: '84px',
                height: '3px',
                margin: '16px auto 0',
                background: 'linear-gradient(90deg, transparent, #1d2ebd, transparent)',
                borderRadius: '9999px',
              }}
            />
          </div>

          {/* Tagline / Subtitle */}
          <p
            style={{
              fontSize: 'clamp(1.05rem, 2.2vw, 1.25rem)',
              color: '#475569',
              maxWidth: '680px',
              margin: '0 auto 36px',
              lineHeight: 1.6,
              fontWeight: 400,
            }}
          >
            Step inside the official archive of celebrations, town halls, and milestones across 1F2. 
            Select an event to explore high-resolution memories and portraits.
          </p>

          {/* Clean Metric Counters */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexWrap: 'wrap',
              gap: '24px',
              backgroundColor: '#ffffff',
              padding: '12px 28px',
              borderRadius: '9999px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
              fontSize: '0.86rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#1d2ebd', fontWeight: 800, fontSize: '1.05rem' }}>
                {events.length}
              </span>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Curated Events</span>
            </div>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#1d2ebd', fontWeight: 800, fontSize: '1.05rem' }}>
                {totalMedia}+
              </span>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Photos & Videos</span>
            </div>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', backgroundColor: '#cbd5e1' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#059669', fontWeight: 700 }}>Instant</span>
              <span style={{ color: '#64748b', fontWeight: 500 }}>Full-Res Downloads</span>
            </div>
          </div>
        </section>

        {/* Search & Filter Bar */}
        <section
          style={{
            maxWidth: '1200px',
            margin: '0 auto 36px',
            padding: '0 24px',
            width: '100%',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '16px',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '16px',
              padding: '14px 22px',
              boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.04)',
            }}
          >
            {/* Search Input */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                flex: '1 1 280px',
                position: 'relative',
              }}
            >
              <Search size={18} style={{ color: '#1d2ebd', flexShrink: 0 }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events by title or keywords..."
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#0f172a',
                  fontSize: '0.94rem',
                  fontWeight: 500,
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '2px',
                    display: 'flex',
                  }}
                  aria-label="Clear search"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setFilterMode('all')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '9999px',
                  border: filterMode === 'all' ? '1px solid #1d2ebd' : '1px solid #e2e8f0',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: filterMode === 'all' ? '#1d2ebd' : '#ffffff',
                  color: filterMode === 'all' ? '#ffffff' : '#64748b',
                  boxShadow: filterMode === 'all' ? '0 2px 6px rgba(29, 46, 189, 0.25)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                All Events ({events.length})
              </button>
              <button
                onClick={() => setFilterMode('media')}
                style={{
                  padding: '7px 16px',
                  borderRadius: '9999px',
                  border: filterMode === 'media' ? '1px solid #1d2ebd' : '1px solid #e2e8f0',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: filterMode === 'media' ? '#1d2ebd' : '#ffffff',
                  color: filterMode === 'media' ? '#ffffff' : '#64748b',
                  boxShadow: filterMode === 'media' ? '0 2px 6px rgba(29, 46, 189, 0.25)' : 'none',
                  transition: 'all 0.2s ease',
                }}
              >
                With Photos
              </button>
            </div>
          </div>
        </section>

        {/* Events Grid Section */}
        <section
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 24px 80px',
            width: '100%',
            flex: 1,
          }}
        >
          {filteredEvents.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '64px 20px',
                backgroundColor: '#ffffff',
                borderRadius: '20px',
                border: '1px dashed #cbd5e1',
              }}
            >
              <p style={{ color: '#64748b', fontSize: '1.1rem', margin: 0, fontWeight: 500 }}>
                No events matched your search &quot;{searchQuery}&quot;
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterMode('all');
                }}
                style={{
                  marginTop: '16px',
                  padding: '9px 20px',
                  backgroundColor: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d2ebd',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))',
                gap: '28px',
              }}
            >
              {filteredEvents.map((event) => {
                const theme = THEME_LIGHT_GRADIENTS[event.slug] || {
                  bg: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                  accent: '#1d2ebd',
                  tag: 'Special Event',
                  border: '#e2e8f0',
                };

                const hasCover = Boolean(event.coverImage);

                return (
                  <Link
                    key={event.id}
                    href={`/${event.slug}/gallery`}
                    onClick={() => startTopProgress()}
                    style={{
                      textDecoration: 'none',
                      color: 'inherit',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: '20px',
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      overflow: 'hidden',
                      position: 'relative',
                      boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
                      transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease, box-shadow 0.35s ease',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-6px)';
                      e.currentTarget.style.borderColor = '#93c5fd';
                      e.currentTarget.style.boxShadow = '0 20px 32px -10px rgba(29, 46, 189, 0.12), 0 0 0 1px rgba(29, 46, 189, 0.15)';
                      const img = e.currentTarget.querySelector('img.event-card-img');
                      if (img) (img as HTMLElement).style.transform = 'scale(1.05)';
                      const arrow = e.currentTarget.querySelector('.card-arrow');
                      if (arrow) (arrow as HTMLElement).style.transform = 'translate(2px, -2px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.boxShadow = '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)';
                      const img = e.currentTarget.querySelector('img.event-card-img');
                      if (img) (img as HTMLElement).style.transform = 'scale(1)';
                      const arrow = e.currentTarget.querySelector('.card-arrow');
                      if (arrow) (arrow as HTMLElement).style.transform = 'translate(0, 0)';
                    }}
                  >
                    {/* Media Cover Image */}
                    <div
                      style={{
                        position: 'relative',
                        width: '100%',
                        height: '215px',
                        overflow: 'hidden',
                        background: hasCover ? '#f1f5f9' : theme.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderBottom: '1px solid #eef2f6',
                      }}
                    >
                      {hasCover ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            className="event-card-img"
                            src={event.coverImage!}
                            alt={event.name}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
                            }}
                          />
                          {/* Subtle gradient vignette at bottom of image for contrast */}
                          <div
                            style={{
                              position: 'absolute',
                              inset: 0,
                              background: 'linear-gradient(to top, rgba(15, 23, 42, 0.45) 0%, transparent 60%)',
                            }}
                          />
                        </>
                      ) : (
                        /* Designer Light Abstract Illustration when no photo is uploaded */
                        <div
                          style={{
                            width: '100%',
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '20px',
                            textAlign: 'center',
                            position: 'relative',
                          }}
                        >
                          <div
                            style={{
                              width: '56px',
                              height: '56px',
                              borderRadius: '16px',
                              backgroundColor: '#ffffff',
                              border: `1px solid ${theme.border}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: theme.accent,
                              marginBottom: '10px',
                              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
                            }}
                          >
                            <Sparkles size={24} />
                          </div>
                          <span
                            style={{
                              fontSize: '0.74rem',
                              letterSpacing: '0.16em',
                              textTransform: 'uppercase',
                              color: theme.accent,
                              fontWeight: 700,
                            }}
                          >
                            {theme.tag}
                          </span>
                        </div>
                      )}

                      {/* Top Badges */}
                      <div
                        style={{
                          position: 'absolute',
                          top: '14px',
                          left: '14px',
                          right: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          zIndex: 2,
                        }}
                      >
                        <span
                          style={{
                            padding: '5px 12px',
                            borderRadius: '9999px',
                            backgroundColor: hasCover ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
                            backdropFilter: 'blur(8px)',
                            border: hasCover ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid #e2e8f0',
                            color: hasCover ? '#ffffff' : '#0f172a',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            letterSpacing: '0.04em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
                          }}
                        >
                          <ImageIcon size={13} style={{ color: '#1d2ebd' }} />
                          {event.mediaCount > 0 ? `${event.mediaCount} Media` : 'Active Gallery'}
                        </span>

                        <div
                          className="card-arrow"
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#1d2ebd',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
                            transition: 'transform 0.25s ease',
                          }}
                        >
                          <ArrowUpRight size={17} />
                        </div>
                      </div>
                    </div>

                    {/* Card Body */}
                    <div
                      style={{
                        padding: '24px 22px 20px',
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        {/* Event Title */}
                        <h3
                          style={{
                            margin: '0 0 8px',
                            fontSize: '1.35rem',
                            fontWeight: 600,
                            letterSpacing: '0.01em',
                            color: '#0f172a',
                            lineHeight: 1.25,
                            fontFamily: 'var(--font-display, "Cormorant Garamond", Georgia, serif)',
                          }}
                        >
                          {event.name}
                        </h3>

                        {/* Description */}
                        <p
                          style={{
                            margin: 0,
                            fontSize: '0.86rem',
                            color: '#64748b',
                            lineHeight: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            minHeight: '2.5em',
                          }}
                        >
                          {event.description || 'Explore the curated gallery collection and download high-resolution event media.'}
                        </p>
                      </div>

                      {/* Card Footer Info */}
                      <div
                        style={{
                          marginTop: '22px',
                          paddingTop: '16px',
                          borderTop: '1px solid #f1f5f9',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          fontSize: '0.8rem',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontWeight: 500 }}>
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                backgroundColor: event.active ? '#10b981' : '#94a3b8',
                              }}
                            />
                            {event.active ? 'Available' : 'Archived'}
                          </span>
                          {event.editionCount > 1 && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.72rem',
                                padding: '2px 8px',
                                borderRadius: '9999px',
                                backgroundColor: '#eff6ff',
                                color: '#1d2ebd',
                                fontWeight: 600,
                              }}
                            >
                              <Layers size={11} />
                              {event.editionCount} Editions
                            </span>
                          )}
                        </div>

                        <span
                          style={{
                            color: '#1d2ebd',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          View Gallery →
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer
          style={{
            marginTop: 'auto',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            padding: '36px 24px',
            textAlign: 'center',
            color: '#64748b',
            fontSize: '0.84rem',
          }}
        >
          <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_blue_croped.png"
              alt="F2 Fintech"
              style={{
                height: '32px',
                width: 'auto',
                objectFit: 'contain',
              }}
            />
            <p style={{ margin: '4px 0 0', color: '#0f172a', fontWeight: 600, letterSpacing: '0.04em' }}>
              <strong>1F2</strong> • Official Media & Experience Portal
            </p>
            <p style={{ margin: 0, fontSize: '0.76rem', color: '#64748b' }}>
              © {new Date().getFullYear()} F2 Fintech Private Limited. All rights reserved. High-resolution photos & video distribution.
            </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
