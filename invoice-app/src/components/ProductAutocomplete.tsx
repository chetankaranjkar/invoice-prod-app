import React, { useState, useEffect, useRef, useCallback } from 'react';
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
}) => {
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchProducts = useCallback(async (q: string) => {
    if (!q || q.trim().length === 0) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    try {
      const res = await api.products.search(q.trim(), 15);
      setSuggestions(Array.isArray(res.data) ? res.data : []);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts(value);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, fetchProducts]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
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
    <div ref={containerRef} className="relative">
      <input
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
        aria-controls="product-suggestions"
        autoComplete="off"
        required={required}
        title={ariaLabel}
        className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${focusRing} ${disabled ? 'bg-gray-100 cursor-not-allowed' : ''} ${className}`}
      />
      {showDropdown && (loading || suggestions.length > 0) && (
        <div
          id="product-suggestions"
          className="absolute z-50 mt-0.5 w-full max-h-48 overflow-auto bg-white border border-gray-200 rounded-md shadow-lg"
          role="listbox"
        >
          {loading && suggestions.length === 0 ? (
            <div className="px-2 py-1.5 text-sm text-gray-500">Searching...</div>
          ) : (
            suggestions.map((p) => (
              <div
                key={p.id}
                role="option"
                className="px-2 py-1.5 text-sm cursor-pointer hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(p);
                }}
              >
                {p.name}
                {(p.defaultRate != null || p.defaultGstPercentage != null) && (
                  <span className="ml-1 text-gray-500 text-xs">
                    {p.defaultRate != null && `₹${p.defaultRate}`}
                    {p.defaultRate != null && p.defaultGstPercentage != null && ' • '}
                    {p.defaultGstPercentage != null && `${p.defaultGstPercentage}% GST`}
                  </span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
