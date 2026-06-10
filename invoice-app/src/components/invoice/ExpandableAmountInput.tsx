import React, { useMemo, useState } from 'react';
import { cn } from '../../lib/cn';

interface ExpandableAmountInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  min?: number;
  step?: string | number;
}

/**
 * Narrow table cell amount field that expands left on focus so long values (e.g. 70000) stay visible.
 */
export const ExpandableAmountInput: React.FC<ExpandableAmountInputProps> = ({
  value,
  onChange,
  className = '',
  min = 0,
  step = '0.01',
}) => {
  const [focused, setFocused] = useState(false);

  const expandedWidthPx = useMemo(() => {
    const text = String(value ?? '');
    const len = Math.max(text.length, 4);
    return Math.min(Math.max(88, len * 11 + 24), 240);
  }, [value]);

  return (
    <div className="relative flex h-8 items-center justify-end">
      <input
        type="number"
        min={min}
        step={step}
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={cn(
          'rounded border px-2 py-1 text-right text-sm tabular-nums transition-[width,box-shadow] duration-150 focus:outline-none focus:ring-2',
          focused
            ? 'absolute right-0 z-30 bg-white shadow-md ring-2'
            : 'w-full min-w-0',
          className
        )}
        style={focused ? { width: expandedWidthPx } : undefined}
      />
    </div>
  );
};
