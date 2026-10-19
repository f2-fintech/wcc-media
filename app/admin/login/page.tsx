'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, ShieldCheck, ArrowRight, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { startTopProgress, doneTopProgress } from '@/components/TopProgressBar';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberEmail, setRememberEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Load remembered email on mount
  useEffect(() => {
    try {
      const savedEmail = localStorage.getItem('wcc_remembered_admin_email');
      if (savedEmail) {
        setEmail(savedEmail);
        setRememberEmail(true);
      }
    } catch {
      // localStorage may be disabled
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || success) return;

    setError('');
    setLoading(true);
    startTopProgress();

    // Persist or remove remembered email
    try {
      if (rememberEmail) {
        localStorage.setItem('wcc_remembered_admin_email', email.trim());
      } else {
        localStorage.removeItem('wcc_remembered_admin_email');
      }
    } catch {
      // ignore
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        doneTopProgress();
        setError(data.error || 'Authentication failed. Please check your credentials.');
        setLoading(false);
      } else {
        setSuccess(true);
        // Instant hard navigation ensures Set-Cookie headers are freshly loaded
        // without race conditions in Next.js router cache
        setTimeout(() => {
          window.location.href = data.redirectUrl || '/admin/dashboard';
        }, 350);
      }
    } catch {
      doneTopProgress();
      setError('Connection to server timed out. Please verify your internet connection or try again.');
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: '#070b10',
        backgroundImage: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(20, 184, 166, 0.15), transparent),
          radial-gradient(ellipse 60% 40% at 85% 80%, rgba(13, 148, 136, 0.08), transparent),
          radial-gradient(circle at 15% 50%, rgba(15, 23, 42, 0.8), transparent)
        `,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--font-ui, system-ui, -apple-system, sans-serif)',
      }}
    >
      {/* Subtle background grid pattern */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }}
      />

      {/* Login Card */}
      <div
        style={{
          width: '100%',
          maxWidth: '440px',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(15, 23, 36, 0.82)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px',
            padding: '40px 36px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 30px -10px rgba(20, 184, 166, 0.15)',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '6px 14px',
                borderRadius: '9999px',
                backgroundColor: 'rgba(20, 184, 166, 0.1)',
                border: '1px solid rgba(20, 184, 166, 0.25)',
                color: '#2dd4bf',
                fontSize: '0.72rem',
                fontWeight: 600,
                letterSpacing: '0.15em',
                textTransform: 'uppercase',
                marginBottom: '16px',
              }}
            >
              <ShieldCheck size={14} />
              Secured Admin Portal
            </div>

            <h1
              style={{
                color: '#f8fafc',
                fontSize: '1.65rem',
                fontWeight: 600,
                letterSpacing: '0.04em',
                margin: 0,
                fontFamily: 'var(--font-display, serif)',
              }}
            >
              White Coat Club
            </h1>
            <p
              style={{
                color: '#94a3b8',
                fontSize: '0.86rem',
                marginTop: '6px',
                marginBottom: 0,
              }}
            >
              Sign in to manage gallery events & media
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 16px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                color: '#fca5a5',
                fontSize: '0.84rem',
                marginBottom: '20px',
                lineHeight: 1.4,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#ef4444' }} />
              <div>{error}</div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '12px 16px',
                backgroundColor: 'rgba(20, 184, 166, 0.15)',
                border: '1px solid rgba(20, 184, 166, 0.4)',
                borderRadius: '10px',
                color: '#5eead4',
                fontSize: '0.84rem',
                marginBottom: '20px',
              }}
            >
              <CheckCircle2 size={18} style={{ color: '#2dd4bf', flexShrink: 0 }} />
              <div>Authentication successful! Redirecting to dashboard...</div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Email Field */}
            <div>
              <label
                htmlFor="admin-login-email"
                style={{
                  display: 'block',
                  color: '#cbd5e1',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  marginBottom: '8px',
                  letterSpacing: '0.02em',
                }}
              >
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748b',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Mail size={17} />
                </div>
                <input
                  id="admin-login-email"
                  type="email"
                  required
                  autoFocus
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@whitecoatclub.com"
                  disabled={loading || success}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px 14px 12px 42px',
                    backgroundColor: 'rgba(10, 15, 24, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#14b8a6';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20, 184, 166, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="admin-login-password"
                style={{
                  display: 'block',
                  color: '#cbd5e1',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  marginBottom: '8px',
                  letterSpacing: '0.02em',
                }}
              >
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: '#64748b',
                    pointerEvents: 'none',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Lock size={17} />
                </div>
                <input
                  id="admin-login-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  disabled={loading || success}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '12px 42px 12px 42px',
                    backgroundColor: 'rgba(10, 15, 24, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '10px',
                    color: '#f8fafc',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#14b8a6';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(20, 184, 166, 0.2)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '4px',
                  }}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '0.82rem',
                  color: '#94a3b8',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(e) => setRememberEmail(e.target.checked)}
                  style={{
                    accentColor: '#14b8a6',
                    width: '15px',
                    height: '15px',
                    cursor: 'pointer',
                  }}
                />
                Remember email
              </label>
              <span style={{ fontSize: '0.74rem', color: '#64748b' }}>256-bit SSL Encrypted</span>
            </div>

            {/* Submit Button */}
            <button
              id="admin-login-submit"
              type="submit"
              disabled={loading || success}
              style={{
                width: '100%',
                padding: '13px 20px',
                marginTop: '6px',
                borderRadius: '10px',
                border: 'none',
                background: success
                  ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)'
                  : 'linear-gradient(135deg, #0d9488 0%, #14b8a6 100%)',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
                cursor: loading || success ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(20, 184, 166, 0.35)',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.8 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading && !success) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(20, 184, 166, 0.45)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(20, 184, 166, 0.35)';
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Verifying credentials...
                </>
              ) : success ? (
                <>
                  <CheckCircle2 size={18} />
                  Access Granted
                </>
              ) : (
                <>
                  Sign In to Dashboard
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* Footer Navigation */}
          <div
            style={{
              marginTop: '28px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              textAlign: 'center',
            }}
          >
            <Link
              href="/"
              style={{
                color: '#64748b',
                fontSize: '0.8rem',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#94a3b8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#64748b')}
            >
              ← Return to Public Gallery
            </Link>
          </div>
        </div>

        {/* Security notice */}
        <p
          style={{
            textAlign: 'center',
            marginTop: '20px',
            fontSize: '0.72rem',
            color: '#475569',
            letterSpacing: '0.03em',
          }}
        >
          Protected System • Authorized Administrative Personnel Only
        </p>
      </div>
    </div>
  );
}
