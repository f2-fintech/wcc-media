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
        backgroundColor: '#f8fafc',
        backgroundImage: `
          radial-gradient(ellipse 80% 50% at 50% -20%, rgba(29, 46, 189, 0.08), transparent),
          radial-gradient(ellipse 60% 40% at 85% 80%, rgba(37, 99, 235, 0.05), transparent),
          linear-gradient(180deg, #f8fafc 0%, #ffffff 50%, #f1f5f9 100%)
        `,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'var(--font-ui, "Outfit", system-ui, -apple-system, sans-serif)',
      }}
    >
      {/* Delicate background grid pattern */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(rgba(29, 46, 189, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(29, 46, 189, 0.02) 1px, transparent 1px)`,
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
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '20px',
            padding: '42px 36px',
            boxShadow: '0 20px 40px -12px rgba(29, 46, 189, 0.08), 0 1px 3px rgba(0, 0, 0, 0.05)',
          }}
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo_blue_croped.png"
              alt="F2 Fintech"
              style={{
                height: '42px',
                width: 'auto',
                objectFit: 'contain',
                margin: '0 auto 16px',
                display: 'block',
              }}
            />

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 14px',
                borderRadius: '9999px',
                backgroundColor: '#eff6ff',
                border: '1px solid #bfdbfe',
                color: '#1d2ebd',
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                marginBottom: '14px',
              }}
            >
              <ShieldCheck size={14} />
              Secured Admin Portal
            </div>

            <h1
              style={{
                color: '#0f172a',
                fontSize: '1.6rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
                margin: 0,
                fontFamily: 'var(--font-display, "Cormorant Garamond", serif)',
              }}
            >
              1F2 Management Console
            </h1>
            <p
              style={{
                color: '#64748b',
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
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '10px',
                color: '#b91c1c',
                fontSize: '0.84rem',
                marginBottom: '20px',
                lineHeight: 1.4,
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px', color: '#dc2626' }} />
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
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '10px',
                color: '#047857',
                fontSize: '0.84rem',
                marginBottom: '20px',
              }}
            >
              <CheckCircle2 size={18} style={{ color: '#059669', flexShrink: 0 }} />
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
                  color: '#334155',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  marginBottom: '8px',
                  letterSpacing: '0.01em',
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
                    color: '#94a3b8',
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
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    color: '#0f172a',
                    fontSize: '0.92rem',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#1d2ebd';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29, 46, 189, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
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
                  color: '#334155',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  marginBottom: '8px',
                  letterSpacing: '0.01em',
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
                    color: '#94a3b8',
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
                    backgroundColor: '#ffffff',
                    border: '1px solid #cbd5e1',
                    borderRadius: '10px',
                    color: '#0f172a',
                    fontSize: '0.92rem',
                    outline: 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = '#1d2ebd';
                    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(29, 46, 189, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = '#cbd5e1';
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
                    color: '#64748b',
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
                  color: '#475569',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(e) => setRememberEmail(e.target.checked)}
                  style={{
                    accentColor: '#1d2ebd',
                    width: '15px',
                    height: '15px',
                    cursor: 'pointer',
                  }}
                />
                Remember email
              </label>
              <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>256-bit SSL Encrypted</span>
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
                  : 'linear-gradient(135deg, #1d2ebd 0%, #2563eb 100%)',
                color: '#ffffff',
                fontSize: '0.92rem',
                fontWeight: 600,
                letterSpacing: '0.02em',
                cursor: loading || success ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(29, 46, 189, 0.3)',
                transition: 'all 0.2s ease',
                opacity: loading ? 0.8 : 1,
              }}
              onMouseEnter={(e) => {
                if (!loading && !success) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 20px rgba(29, 46, 189, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(29, 46, 189, 0.3)';
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
              borderTop: '1px solid #f1f5f9',
              textAlign: 'center',
            }}
          >
            <Link
              href="/"
              style={{
                color: '#1d2ebd',
                fontSize: '0.82rem',
                fontWeight: 600,
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#152296')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#1d2ebd')}
            >
              ← Return to 1F2 Events Portal
            </Link>
          </div>
        </div>

        {/* Security notice */}
        <p
          style={{
            textAlign: 'center',
            marginTop: '20px',
            fontSize: '0.74rem',
            color: '#64748b',
            letterSpacing: '0.02em',
          }}
        >
          Protected System • Authorized Administrative Personnel Only
        </p>
      </div>
    </div>
  );
}
