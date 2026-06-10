import React, { useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { parseLocalDate } from '../../utils/helpers';
import { cn } from '../../lib/cn';

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isoToParts(iso: string): { year: number; month: number; day: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  return { year: y, month: m - 1, day: d };
}

export interface CalendarPopoverProps {
  value: string;
  onChange: (isoYyyyMmDd: string) => void;
  onClose: () => void;
  /** Inclusive max selectable date (YYYY-MM-DD). */
  maxDate?: string;
  /** Inclusive min selectable date (YYYY-MM-DD). */
  minDate?: string;
  className?: string;
}

export const CalendarPopover: React.FC<CalendarPopoverProps> = ({
  value,
  onChange,
  onClose,
  maxDate,
  minDate,
  className = '',
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = isoToParts(value) ?? isoToParts(new Date().toISOString().split('T')[0])!;
  const [viewYear, setViewYear] = React.useState(selected.year);
  const [viewMonth, setViewMonth] = React.useState(selected.month);

  useEffect(() => {
    const parts = isoToParts(value);
    if (parts) {
      setViewYear(parts.year);
      setViewMonth(parts.month);
    }
  }, [value]);

  useEffect(() => {
    const handlePointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [onClose]);

  const maxParts = maxDate ? isoToParts(maxDate) : null;
  const minParts = minDate ? isoToParts(minDate) : null;

  const cells = useMemo(() => {
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const items: Array<{ day: number; iso: string } | null> = [];

    for (let i = 0; i < firstWeekday; i++) items.push(null);
    for (let day = 1; day <= daysInMonth; day++) {
      items.push({ day, iso: toIsoDate(viewYear, viewMonth, day) });
    }
    return items;
  }, [viewYear, viewMonth]);

  const isDisabled = (iso: string) => {
    if (maxDate && iso > maxDate) return true;
    if (minDate && iso < minDate) return true;
    return false;
  };

  const goMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const canGoNext =
    !maxParts ||
    viewYear < maxParts.year ||
    (viewYear === maxParts.year && viewMonth < maxParts.month);

  const canGoPrev =
    !minParts ||
    viewYear > minParts.year ||
    (viewYear === minParts.year && viewMonth > minParts.month);

  return (
    <div
      ref={rootRef}
      className={cn(
        'absolute right-0 top-full z-50 mt-1 w-[17.5rem] rounded-lg border border-slate-200 bg-white p-3 shadow-lg',
        className
      )}
      role="dialog"
      aria-label="Choose date"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          disabled={!canGoPrev}
          onClick={() => goMonth(-1)}
          className="rounded-md p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold text-slate-900">
          {MONTH_NAMES[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          disabled={!canGoNext}
          onClick={() => goMonth(1)}
          className="rounded-md p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium uppercase text-slate-400">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((cell, idx) => {
          if (!cell) return <div key={`empty-${idx}`} />;
          const disabled = isDisabled(cell.iso);
          const isSelected = cell.iso === value;
          const isToday = cell.iso === toIsoDate(
            new Date().getFullYear(),
            new Date().getMonth(),
            new Date().getDate()
          );

          return (
            <button
              key={cell.iso}
              type="button"
              disabled={disabled}
              onClick={() => {
                onChange(cell.iso);
                onClose();
              }}
              className={cn(
                'h-8 rounded-md text-sm transition-colors',
                isSelected && 'bg-indigo-600 text-white font-semibold',
                !isSelected && !disabled && 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-700',
                !isSelected && isToday && 'font-semibold text-indigo-600',
                disabled && 'cursor-not-allowed text-slate-300'
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export function todayIsoDate(): string {
  const t = new Date();
  return toIsoDate(t.getFullYear(), t.getMonth(), t.getDate());
}

/** Compare two YYYY-MM-DD strings. */
export function compareIsoDates(a: string, b: string): number {
  return parseLocalDate(a).getTime() - parseLocalDate(b).getTime();
}
