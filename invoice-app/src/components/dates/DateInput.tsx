import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  formatDateWithPreference,
  parseLocalDate,
  parseDateWithPreference,
  dateFormatExampleHint,
} from '../../utils/helpers';

const DEFAULT_PREF = 'DD/MM/YYYY';

function displayFromIso(iso: string | undefined | null, pref: string): string {
  const v = iso?.trim();
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    return formatDateWithPreference(parseLocalDate(v), pref);
  }
  const parsed = parseDateWithPreference(v, pref);
  if (parsed) {
    return formatDateWithPreference(parseLocalDate(parsed), pref);
  }
  return '';
}

export interface DateInputProps {
  value: string;
  onChange: (isoYyyyMmDd: string) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  id?: string;
  ariaLabel?: string;
  /** When true, empty input is saved as '' (e.g. optional end date). */
  allowEmpty?: boolean;
}

/**
 * Central calendar-date field for the whole app:
 * binds to **`YYYY-MM-DD`** for APIs, displays/parses per **User Profile → Date format**.
 *
 * Do **not** use `<input type="date" />`; ESLint forbids it. Import from `components/dates`.
 */
export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
  required = false,
  id,
  ariaLabel = 'Date',
  allowEmpty = false,
}) => {
  const { profile } = useAuth();
  const pref = profile?.dateFormat || DEFAULT_PREF;
  const [focused, setFocused] = useState(false);
  const [text, setText] = useState(() => displayFromIso(value, pref));

  useEffect(() => {
    if (!focused) {
      setText(displayFromIso(value, pref));
    }
  }, [value, pref, focused]);

  const commit = useCallback(() => {
    const raw = text.trim();
    if (!raw) {
      if (allowEmpty) {
        onChange('');
      } else {
        setText(displayFromIso(value, pref));
      }
      return;
    }
    const iso = parseDateWithPreference(raw, pref);
    if (iso) {
      if (iso !== value) onChange(iso);
      setText(displayFromIso(iso, pref));
      return;
    }
    setText(displayFromIso(value, pref));
  }, [text, allowEmpty, value, pref, onChange]);

  const hint = dateFormatExampleHint(pref);

  return (
    <input
      id={id}
      type="text"
      autoComplete="off"
      spellCheck={false}
      disabled={disabled}
      required={required}
      aria-label={ariaLabel}
      title={hint}
      placeholder={hint}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
      className={className}
    />
  );
};
