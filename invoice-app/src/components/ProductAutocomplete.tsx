import React, { useState, useEffect, useRef, useCallback, useLayoutEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
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
  /** Hide GST in suggestion subtitles (e.g. profile GST = 0) */
  hideGstInSuggestions?: boolean;
}

const DEBOUNCE_MS = 250;
const SEARCH_LIMIT = 20;
const LIST_LIMIT = 50;

function filterProducts(list: Product[], parentOnly: boolean): Product[] {
  if (!parentOnly) return list;
  return list.filter(
    (p) => p.productType === 'parent' || !p.productType || !p.parentProductId
  );
}

export const ProductAutocomplete: React.FC<ProductAutocompleteProps> = ({
  value,
  onChange,
  disabled = false,
  placeholder = 'Select or search product…',
  className = '',
  focusRing = 'focus:ring-blue-500',
  ariaLabel = 'Product name',
  required = false,
  parentOnly = false,
  hideGstInSuggestions = false,
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
    const maxH = 240;
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
    if (!showDropdown) return;
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

  const fetchProducts = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const term = q.trim();
        const limit = term ? SEARCH_LIMIT : LIST_LIMIT;
        const res = await api.products.search(term, limit);
        const list = Array.isArray(res.data) ? res.data : [];
        setSuggestions(filterProducts(list, parentOnly));
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    },
    [parentOnly]
  );

  useEffect(() => {
    if (!showDropdown) return;
    const timer = setTimeout(() => {
      fetchProducts(value);
    }, value.trim() ? DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
  }, [value, fetchProducts, showDropdown]);

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

  const openDropdown = () => {
    if (disabled) return;
    setShowDropdown(true);
    fetchProducts(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setShowDropdown(true);
  };

  const handleSelect = (product: Product) => {
    onChange(product.name, product);
    setShowDropdown(false);
  };

  const handleFocus = () => {
    openDropdown();
  };

  const handleBlur = () => {
    setTimeout(() => setShowDropdown(false), 150);
  };

  const handleToggleDropdown = (e: React.MouseEvent) => {
    e.preventDefault();
    if (disabled) return;
    if (showDropdown) {
      setShowDropdown(false);
    } else {
      openDropdown();
      inputRef.current?.focus();
    }
  };

  return (
    <div ref={containerRef} className="relative isolate w-full min-w-0 block">
      <div className="relative">
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
          aria-expanded={showDropdown ? 'true' : 'false'}
          aria-controls={listboxId}
          autoComplete="off"
          required={required}
          title={ariaLabel}
          className={`w-full py-1.5 pl-2 pr-8 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${focusRing} ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${className}`}
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label="Show products"
          onMouseDown={handleToggleDropdown}
          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      {showDropdown &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            id={listboxId}
            className="overflow-auto rounded-md border border-gray-200 bg-white py-1 shadow-xl"
            style={{ pointerEvents: 'auto' }}
            role="listbox"
          >
            {loading ? (
              <div className="px-3 py-2 text-sm text-gray-500">Loading products…</div>
            ) : suggestions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                {value.trim() ? 'No matching products' : 'No products found'}
              </div>
            ) : (
              suggestions.map((p) => (
                <div
                  key={p.id}
                  role="option"
                  aria-selected={value === p.name}
                  className="cursor-pointer border-b border-gray-100 px-3 py-2 text-sm leading-snug last:border-b-0 hover:bg-blue-50"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(p);
                  }}
                >
                  <div className="break-words text-gray-900">{p.name}</div>
                  {(p.defaultRate != null ||
                    (!hideGstInSuggestions && p.defaultGstPercentage != null) ||
                    p.parentProductName) && (
                    <div className="mt-0.5 text-xs text-gray-500">
                      {p.parentProductName && (
                        <span className="text-sky-600">{p.parentProductName} · </span>
                      )}
                      {p.defaultRate != null && `₹${p.defaultRate}`}
                      {!hideGstInSuggestions &&
                        p.defaultRate != null &&
                        p.defaultGstPercentage != null &&
                        ' • '}
                      {!hideGstInSuggestions &&
                        p.defaultGstPercentage != null &&
                        `${p.defaultGstPercentage}% GST`}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
