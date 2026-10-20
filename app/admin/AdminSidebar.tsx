'use client';
import React from 'react';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  {
    section: 'Overview',
    items: [
      { href: '/admin/dashboard', label: 'Dashboard', icon: 'grid' },
    ],
  },
  {
    section: 'Content',
    items: [
      { href: '/admin/events', label: 'Events', icon: 'calendar' },
      { href: '/admin/editions', label: 'Editions', icon: 'layers' },
      { href: '/admin/banner', label: 'Banner', icon: 'image' },
    ],
  },
  {
    section: 'Media',
    items: [
      { href: '/admin/media/upload', label: 'Add Media', icon: 'upload' },
      { href: '/admin/media', label: 'All Media', icon: 'photo' },
    ],
  },
  {
    section: 'Organization',
    items: [
      { href: '/admin/attendees', label: 'Folders', icon: 'folder' },
    ],
  },
];

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactElement> = {
    grid: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
    calendar: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
    layers: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="12 2 22 8.5 12 15 2 8.5"/>
        <polyline points="2 15.5 12 22 22 15.5"/>
        <polyline points="2 12 12 18.5 22 12"/>
      </svg>
    ),
    image: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    ),
    upload: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="17 8 12 3 7 8"/>
        <line x1="12" y1="3" x2="12" y2="15"/>
      </svg>
    ),
    photo: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M14.5 4h-5L7 7H4a2 2 0 00-2 2v9a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2h-3l-2.5-3z"/>
        <circle cx="12" cy="13" r="3"/>
      </svg>
    ),
    users: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
      </svg>
    ),
    folder: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
    logout: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
        <polyline points="16 17 21 12 16 7"/>
        <line x1="21" y1="12" x2="9" y2="12"/>
      </svg>
    ),
    menu: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="3" y1="6" x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
      </svg>
    ),
    x: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    ),
  };
  return (
    <span style={{ width: 16, height: 16, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {icons[name] || null}
    </span>
  );
}

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/admin/login');
    router.refresh();
  }

  const sidebarContent = (
    <div className={`admin-sidebar ${mobileOpen ? 'open' : ''}`}>
      {/* Logo & 1F2 Branding */}
      <Link
        href="/admin/dashboard"
        className="admin-sidebar-logo"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          textDecoration: 'none',
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
            flexShrink: 0,
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontFamily: 'var(--font-display, Georgia, serif)',
              fontSize: '1.28rem',
              fontWeight: 600,
              letterSpacing: '0.03em',
              color: '#0f172a',
              lineHeight: 1.1,
            }}
          >
            1<span style={{ color: '#1d2ebd', fontStyle: 'italic' }}>F2</span>
          </span>
          <span
            style={{
              fontSize: '0.62rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#64748b',
              fontWeight: 600,
              marginTop: '3px',
            }}
          >
            Admin Console
          </span>
        </div>
      </Link>

      {/* Nav */}
      <nav className="admin-nav">
        {NAV_ITEMS.map((section) => (
          <div key={section.section} className="admin-nav-section">
            <p className="admin-nav-label">{section.section}</p>
            {section.items.map((item) => {
              const isActive =
                item.href === '/admin/media'
                  ? pathname === '/admin/media'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`admin-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <NavIcon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="admin-sidebar-footer">
        <button
          onClick={handleLogout}
          className="admin-nav-item"
          style={{ width: '100%', background: 'none', border: 'none', cursor: 'pointer' }}
          id="admin-logout-btn"
        >
          <NavIcon name="logout" />
          Logout
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          display: 'none',
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 50,
          width: 40,
          height: 40,
          background: '#1d2ebd',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(29, 46, 189, 0.25)',
          cursor: 'pointer',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        id="sidebar-toggle"
        aria-label="Toggle menu"
      >
        <NavIcon name={mobileOpen ? 'x' : 'menu'} />
      </button>

      {/* Overlay on mobile */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 35,
          }}
        />
      )}

      {sidebarContent}
    </>
  );
}
