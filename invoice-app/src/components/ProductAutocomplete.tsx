import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../services/agent';
import type { Product } from '../types';

interface ProductAutocompleteProps {
  value: string;
  onChange: (productName: string, product?: Product) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  focusRing?: string;
  ariaLabel?: string;
  required?: boolean;
  /** When true, only parent products appear in suggestions */
  parentOnly?: boolean;
}

const DEBOUNCE_MS = 250;

export const ProductAutocomplete: React.FC<ProductAutocompleteProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = '',
  className = '',
  focusRing = 'focus:ring-blue-500',
  ariaLabel = 'Product name',
  required = false,
  parentOnly = false,
}) => {
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listboxId = useId().replace(/:/g, '');

  const positionDropdown = useCallback(() => {
    const input = inputRef.current;
    const dd = dropdownRef.current;
    if (!input || !dd || !showDropdown) return;

    const rect = input.getBoundingClientRect();
    const pad = 12;
    const maxW = Math.max(200, window.innerWidth - pad * 2);
    // At least as wide as the field; on small screens allow a comfortable min so text isn’t cramped
    const targetW = Math.max(rect.width, Math.min(360, maxW));
    const w = Math.min(targetW, maxW);

    let left = rect.left;
    if (left + w > window.innerWidth - pad) {
      left = window.innerWidth - pad - w;
    }
    if (left < pad) {
      left = pad;
    }

    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const maxH = 192; // 12rem
    const openDown = spaceBelow >= 120 || spaceBelow >= spaceAbove;

    dd.style.position = 'fixed';
    dd.style.left = `${left}px`;
    dd.style.width = `${w}px`;
    dd.style.minWidth = `${w}px`;
    dd.style.zIndex = '9999';
    dd.style.maxHeight = `${Math.max(80, Math.min(maxH, openDown ? spaceBelow - 4 : spaceAbove - 4))}px`;

    if (openDown) {
      dd.style.top = `${rect.bottom + 4}px`;
      dd.style.bottom = 'auto';
    } else {
      dd.style.bottom = `${window.innerHeight - rect.top + 4}px`;
      dd.style.top = 'auto';
    }
  }, [showDropdown]);

  useLayoutEffect(() => {
    if (!showDropdown || (!loading && suggestions.length === 0)) return;
    const run = () => positionDropdown();
    run();
    const id = window.requestAnimationFrame(run);
    return () => window.cancelAnimationFrame(id);
  }, [showDropdown, loading, suggestions, positionDropdown, value]);

  useEffect(() => {
    if (!showDropdown) return;
    const onScrollOrResize = () => positionDropdown();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [showDropdown, positionDropdown]);

  const fetchProducts = useCallback(async (q: string) => {
    if (!q || q.trim().length === 0) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.products.search(q.trim(), 15);
      const list = Array.isArray(res.data) ? res.data : [];
      setSuggestions(
        parentOnly
          ? list.filter((p) => p.productType === 'parent' || !p.productType)
          : list
      );
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, [parentOnly]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(value);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, fetchProducts]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const t = e.target as Node;
      if (containerRef.current?.contains(t)) return;
      if (dropdownRef.current?.contains(t)) return;
      setShowDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    setShowDropdown(true);
  };

  const handleSelect = (product: Product) => {
    onChange(product.name, product);
    setShowDropdown(false);
  };

  const handleFocus = () => {
    if (suggestions.length > 0) setShowDropdown(true);
  };

  const handleBlur = () => {
    // Delay to allow click on suggestion
    setTimeout(() => setShowDropdown(false), 150);
  };

  return (
    <div ref={containerRef} className="relative isolate w-full min-w-0 block">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={showDropdown && (loading || suggestions.length > 0) ? 'true' : 'false'}
        aria-controls={listboxId}
        autoComplete="off"
        required={required}
        title={ariaLabel}
        className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${focusRing} ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${className}`}
      />
      {showDropdown && (loading || suggestions.length > 0) &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            id={listboxId}
            className="overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-xl"
            style={{ pointerEvents: 'auto' }}
            role="listbox"
          >
            {loading && suggestions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
            ) : (
              suggestions.map((p) => (
                <div
                  key={p.id}
                  role="option"
                  className="cursor-pointer border-b border-gray-100 px-3 py-2 text-sm leading-snug last:border-b-0 hover:bg-blue-50"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(p);
                  }}
                >
                  <div className="break-words text-gray-900">{p.name}</div>
                  {(p.defaultRate != null || p.defaultGstPercentage != null) && (
                    <div className="mt-0.5 text-xs text-gray-500">
                      {p.defaultRate != null && `₹${p.defaultRate}`}
                      {p.defaultRate != null && p.defaultGstPercentage != null && ' • '}
                      {p.defaultGstPercentage != null && `${p.defaultGstPercentage}% GST`}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  );
};
