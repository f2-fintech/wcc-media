'use client';
import React from 'react';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  totalEvents: number;
  totalEditions: number;
  totalMedia: number;
  totalPhotos: number;
  totalVideos: number;
  totalAttendees: number;
}

const STAT_CONFIG = [
  { key: 'totalEvents', label: 'Total Events', icon: 'calendar', color: '#2d6a6a' },
  { key: 'totalEditions', label: 'Editions', icon: 'layers', color: '#5a6a2d' },
  { key: 'totalMedia', label: 'Total Media', icon: 'photo', color: '#6a2d6a' },
  { key: 'totalPhotos', label: 'Photos', icon: 'image', color: '#2d4a6a' },
  { key: 'totalVideos', label: 'Videos', icon: 'video', color: '#6a4a2d' },
  { key: 'totalAttendees', label: 'Attendees', icon: 'users', color: '#2d6a4a' },
] as const;

function StatIcon({ name, color }: { name: string; color: string }) {
  const icons: Record<string, React.ReactElement> = {
    calendar: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
    layers: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="12 2 22 8.5 12 15 2 8.5"/>
        <polyline points="2 15.5 12 22 22 15.5"/>
        <polyline points="2 12 12 18.5 22 12"/>
      </svg>
    ),
    photo: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z"/>
        <circle cx="12" cy="13" r="3"/>
      </svg>
    ),
    image: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
    video: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2"/>
      </svg>
    ),
    users: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
  };

  return (
    <div
      className="stat-card-icon"
      style={{ background: `${color}18`, color }}
    >
      {icons[name]}
    </div>
  );
}

const QUICK_LINKS = [
  { href: '/admin/events', label: 'Manage Events', desc: 'Create and configure events' },
  { href: '/admin/media/upload', label: 'Upload Media', desc: 'Add photos and videos' },
  { href: '/admin/attendees', label: 'View Attendees', desc: 'Manage attendee records' },
  { href: '/admin/banner', label: 'Update Banner', desc: 'Change event hero images' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/dashboard/stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setStats(data);
      })
      .catch(() => setError('Failed to load stats.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="admin-topbar">
        <h2 className="admin-topbar-title">Dashboard</h2>
        <Link href="/admin/media/upload" className="btn btn-accent btn-sm">
          + Upload Media
        </Link>
      </div>

      <div className="admin-content">
        {/* Stats Grid */}
        <div className="stat-grid">
          {STAT_CONFIG.map(({ key, label, icon, color }) => (
            <div className="stat-card" key={key}>
              <StatIcon name={icon} color={color} />
              <p className="stat-card-label">{label}</p>
              {loading ? (
                <div className="skeleton" style={{ height: 40, width: 80, borderRadius: 4 }} />
              ) : (
                <p className="stat-card-value">
                  {stats ? (stats[key as keyof Stats] ?? 0).toLocaleString() : '—'}
                </p>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="card" style={{ marginBottom: 24, padding: '16px 20px', background: '#fef2f2', borderColor: '#fecaca' }}>
            <p style={{ color: 'var(--color-error)', fontFamily: 'var(--font-ui)', fontSize: '0.875rem' }}>{error}</p>
          </div>
        )}

        {/* Quick Actions */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
              {QUICK_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    display: 'block',
                    padding: '16px 20px',
                    borderRadius: 'var(--radius-lg)',
                    border: '1.5px solid var(--color-light-grey)',
                    textDecoration: 'none',
                    transition: 'all var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--color-accent)';
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 0 3px rgba(45,106,106,0.08)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--color-light-grey)';
                    (e.currentTarget as HTMLAnchorElement).style.boxShadow = 'none';
                  }}
                >
                  <p style={{ fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: '0.9rem', color: 'var(--color-charcoal)', marginBottom: 4 }}>
                    {link.label}
                  </p>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--color-dark-grey)' }}>
                    {link.desc}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
