'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface SearchableOption {
  value: string;
  label: string;
  badge?: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface SearchableSelectProps {
  id?: string;
  options: SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  allowClear?: boolean;
  allOptionLabel?: string;
  allOptionValue?: string;
}

export default function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  searchPlaceholder = 'Search...',
  disabled = false,
  className = '',
  style = {},
  allowClear = false,
  allOptionLabel,
  allOptionValue = '',
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Position state for the portal popover
  const [popoverCoords, setPopoverCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
  }>({ left: 0, width: 220 });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Full list of options including "All" option if provided
  const allOptions = useMemo(() => {
    const list: SearchableOption[] = [];
    if (allOptionLabel) {
      list.push({
        value: allOptionValue,
        label: allOptionLabel,
        icon: '🌐',
      });
    }
    return [...list, ...options];
  }, [allOptionLabel, allOptionValue, options]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!search.trim()) return allOptions;
    const q = search.toLowerCase().trim();
    return allOptions.filter(
      opt =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge !== undefined && String(opt.badge).toLowerCase().includes(q))
    );
  }, [allOptions, search]);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return allOptions.find(opt => opt.value === value) || null;
  }, [allOptions, value]);

  // Calculate coordinates relative to viewport for the portal
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();

    const expectedHeight = 280;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openUp = spaceBelow < expectedHeight && spaceAbove > spaceBelow;

    // Minimum popover width matching trigger or at least 220px
    const width = Math.max(rect.width, 220);

    // Keep within horizontal screen bounds
    let left = rect.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }

    if (openUp) {
      setPopoverCoords({
        bottom: window.innerHeight - rect.top + 4,
        left,
        width,
      });
    } else {
      setPopoverCoords({
        top: rect.bottom + 4,
        left,
        width,
      });
    }
  }, []);

  // Update position on open, scroll, or resize
  useEffect(() => {
    if (!isOpen) return;

    updatePosition();
    setSearch('');
    setHighlightedIndex(0);

    // Auto-focus search input
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 40);

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, updatePosition]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const insideTrigger = triggerRef.current?.contains(target);
      const insidePopover = popoverRef.current?.contains(target);

      if (!insideTrigger && !insidePopover) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
        onChange(filteredOptions[highlightedIndex].value);
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
  }

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-option-item]');
      if (items[highlightedIndex]) {
        (items[highlightedIndex] as HTMLElement).scrollIntoView({
          block: 'nearest',
        });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Popover Portal Content
  const popoverElement = isOpen && mounted && typeof document !== 'undefined' ? createPortal(
    <div
      ref={popoverRef}
      style={{
        position: 'fixed',
        top: popoverCoords.top !== undefined ? `${popoverCoords.top}px` : undefined,
        bottom: popoverCoords.bottom !== undefined ? `${popoverCoords.bottom}px` : undefined,
        left: `${popoverCoords.left}px`,
        width: `${popoverCoords.width}px`,
        zIndex: 99999, // Super high z-index to stay above cards, tables, headers, and modals
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 12px 32px -4px rgba(0, 0, 0, 0.18), 0 6px 12px -2px rgba(0, 0, 0, 0.08)',
        overflow: 'hidden',
        minWidth: 220,
      }}
      onKeyDown={handleKeyDown}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Autocomplete Search Input */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#64748b"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          className="searchable-select-input"
          value={search}
          onChange={e => {
            setSearch(e.target.value);
            setHighlightedIndex(0);
          }}
          placeholder={searchPlaceholder}
          style={{
            width: '100%',
            border: 'none',
            background: 'transparent',
            outline: 'none',
            fontFamily: 'var(--font-ui)',
            fontSize: '0.82rem',
            color: '#0f172a',
          }}
        />
        {search && (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              searchInputRef.current?.focus();
            }}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 0,
              fontSize: '0.75rem',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Options List */}
      <div
        ref={listRef}
        style={{
          maxHeight: 240,
          overflowY: 'auto',
          padding: '4px 0',
        }}
      >
        {filteredOptions.length === 0 ? (
          <div
            style={{
              padding: '14px 12px',
              textAlign: 'center',
              color: '#64748b',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-ui)',
            }}
          >
            No results found for &ldquo;{search}&rdquo;
          </div>
        ) : (
          filteredOptions.map((opt, idx) => {
            const isSelected = opt.value === value;
            const isHighlighted = idx === highlightedIndex;

            return (
              <div
                key={`${opt.value}-${idx}`}
                data-option-item
                onClick={() => {
                  if (!opt.disabled) {
                    onChange(opt.value);
                    setIsOpen(false);
                    triggerRef.current?.focus();
                  }
                }}
                onMouseEnter={() => setHighlightedIndex(idx)}
                style={{
                  padding: '8px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  cursor: opt.disabled ? 'not-allowed' : 'pointer',
                  background: isSelected
                    ? '#eff6ff'
                    : isHighlighted
                    ? '#f1f5f9'
                    : 'transparent',
                  color: isSelected ? '#1d2ebd' : '#1e293b',
                  fontSize: '0.85rem',
                  fontFamily: 'var(--font-ui)',
                  fontWeight: isSelected ? 600 : 400,
                  opacity: opt.disabled ? 0.5 : 1,
                  transition: 'background 0.1s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                  {opt.icon && (
                    <span style={{ fontSize: '0.95rem', flexShrink: 0 }}>
                      {opt.icon}
                    </span>
                  )}
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.label}
                    </div>
                    {opt.sublabel && (
                      <div
                        style={{
                          fontSize: '0.72rem',
                          color: isSelected ? '#3b82f6' : '#64748b',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          marginTop: 1,
                        }}
                      >
                        {opt.sublabel}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {opt.badge !== undefined && (
                    <span
                      style={{
                        fontSize: '0.68rem',
                        background: isSelected ? '#dbeafe' : '#f1f5f9',
                        color: isSelected ? '#1e40af' : '#475569',
                        padding: '1px 6px',
                        borderRadius: 10,
                        fontWeight: 600,
                      }}
                    >
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1d2ebd" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer info indicator */}
      <div
        style={{
          padding: '4px 10px',
          background: '#f8fafc',
          borderTop: '1px solid #e2e8f0',
          fontSize: '0.7rem',
          color: '#94a3b8',
          fontFamily: 'var(--font-ui)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>{filteredOptions.length} of {allOptions.length} items</span>
        <span>↑↓ to navigate · ↵ to select</span>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div
      id={id}
      className={`searchable-select-container ${className}`}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '100%',
        minWidth: 160,
        ...style,
      }}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(prev => !prev);
          }
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '9px 12px',
          border: isOpen ? '1.5px solid var(--color-accent)' : '1.5px solid var(--color-light-grey)',
          borderRadius: 'var(--radius-md)',
          background: disabled ? '#f8fafc' : 'var(--color-white)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline: 'none',
          boxShadow: isOpen ? '0 0 0 3px rgba(45, 106, 106, 0.12)' : 'none',
          transition: 'all 0.15s ease',
          textAlign: 'left',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
          {selectedOption ? (
            <>
              {selectedOption.icon && (
                <span style={{ fontSize: '1rem', flexShrink: 0 }}>
                  {selectedOption.icon}
                </span>
              )}
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontSize: '0.88rem',
                  fontWeight: 500,
                  color: 'var(--color-charcoal)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedOption.label}
              </span>
              {selectedOption.badge !== undefined && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    background: '#f1f5f9',
                    color: '#475569',
                    padding: '1px 6px',
                    borderRadius: 10,
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {selectedOption.badge}
                </span>
              )}
            </>
          ) : (
            <span
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '0.88rem',
                color: 'var(--color-mid-grey)',
              }}
            >
              {placeholder}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {allowClear && selectedOption && !disabled && (
            <span
              onClick={e => {
                e.stopPropagation();
                onChange('');
              }}
              style={{
                color: '#94a3b8',
                fontSize: '0.8rem',
                padding: '0 4px',
                cursor: 'pointer',
              }}
            >
              ✕
            </span>
          )}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              color: '#64748b',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s ease',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Render Popover via Portal at document.body level */}
      {popoverElement}
    </div>
  );
}
