'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export function startTopProgress() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('top-progress-start'));
  }
}

export function doneTopProgress() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('top-progress-done'));
  }
}

function TopProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(1);

  const trickleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finishTimerRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isNavigatingRef = useRef(false);

  const clearTimers = () => {
    if (trickleTimerRef.current) clearInterval(trickleTimerRef.current);
    if (finishTimerRef.current) clearTimeout(finishTimerRef.current);
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
  };

  const start = () => {
    clearTimers();
    isNavigatingRef.current = true;
    setOpacity(1);
    setVisible(true);
    setProgress(20);

    // Trickle progress up to 90%
    trickleTimerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 88) return prev;
        if (prev < 40) return prev + Math.floor(Math.random() * 12 + 10);
        if (prev < 70) return prev + Math.floor(Math.random() * 8 + 5);
        return prev + Math.floor(Math.random() * 4 + 2);
      });
    }, 200);

    // Safety timeout: auto-finish if navigation takes longer than 8s
    safetyTimerRef.current = setTimeout(() => {
      done();
    }, 8000);
  };

  const done = () => {
    if (!isNavigatingRef.current && progress === 0) return;
    clearTimers();
    isNavigatingRef.current = false;
    setProgress(100);

    // Give time to reach 100% visually, then fade out
    finishTimerRef.current = setTimeout(() => {
      setOpacity(0);
      finishTimerRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
        setOpacity(1);
      }, 300);
    }, 200);
  };

  // Complete progress bar whenever route (pathname or searchParams) changes
  useEffect(() => {
    done();
  }, [pathname, searchParams]);

  // Intercept global link clicks & custom events
  useEffect(() => {
    const handleAnchorClick = (e: MouseEvent) => {
      // Find closest anchor tag
      const anchor = (e.target as HTMLElement)?.closest('a');
      if (!anchor || !anchor.href) return;

      // Ignore modified clicks (opens in new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      // Ignore target="_blank"
      if (anchor.target && anchor.target !== '_self') return;

      // Ignore downloads
      if (anchor.hasAttribute('download')) return;

      try {
        const targetUrl = new URL(anchor.href, window.location.href);

        // Ignore external links
        if (targetUrl.origin !== window.location.origin) return;

        // Ignore same page anchor links (#section)
        const currentPath = window.location.pathname + window.location.search;
        const targetPath = targetUrl.pathname + targetUrl.search;

        if (currentPath === targetPath) {
          return;
        }

        // Internal navigation starting
        start();
      } catch {
        // invalid URL
      }
    };

    const handlePopState = () => {
      start();
    };

    const handleCustomStart = () => start();
    const handleCustomDone = () => done();

    document.addEventListener('click', handleAnchorClick, { capture: true });
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('top-progress-start', handleCustomStart);
    window.addEventListener('top-progress-done', handleCustomDone);

    return () => {
      document.removeEventListener('click', handleAnchorClick, { capture: true });
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('top-progress-start', handleCustomStart);
      window.removeEventListener('top-progress-done', handleCustomDone);
      clearTimers();
    };
  }, []);

  if (!visible && progress === 0) return null;

  return (
    <div
      id="top-progress-bar-container"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '3px',
        zIndex: 99999999,
        pointerEvents: 'none',
        opacity: opacity,
        transition: 'opacity 0.3s ease-in-out',
      }}
      aria-hidden="true"
    >
      <div
        id="top-progress-bar"
        style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #1d2ebd 0%, #2563eb 45%, #0ea5e9 80%, #38bdf8 100%)',
          boxShadow: '0 0 12px rgba(29, 46, 189, 0.85), 0 0 5px rgba(37, 99, 235, 0.6)',
          transition: progress === 100 ? 'width 0.15s ease-out' : 'width 0.25s cubic-bezier(0.1, 0.05, 0, 1)',
          position: 'relative',
        }}
      >
        {/* Glow particle at the leading head of the bar */}
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: '-2px',
            bottom: '-2px',
            width: '80px',
            background: 'radial-gradient(circle at 100% 50%, rgba(255, 255, 255, 0.95) 0%, rgba(37, 99, 235, 0.6) 40%, transparent 80%)',
            filter: 'blur(1px)',
          }}
        />
      </div>
    </div>
  );
}

export default function TopProgressBar() {
  return (
    <Suspense fallback={null}>
      <TopProgressBarInner />
    </Suspense>
  );
}
