import React, { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { DateInput, type DateInputProps } from './DateInput';
import { CalendarPopover } from './CalendarPopover';
import { cn } from '../../lib/cn';

export interface DateInputWithPickerProps extends DateInputProps {
  /** Inclusive max selectable date (YYYY-MM-DD). */
  maxDate?: string;
  /** Inclusive min selectable date (YYYY-MM-DD). */
  minDate?: string;
}

/**
 * Manual date entry (profile format) plus an optional month calendar picker.
 * Values remain **YYYY-MM-DD** for APIs.
 */
export const DateInputWithPicker: React.FC<DateInputWithPickerProps> = ({
  maxDate,
  minDate,
  className = '',
  ...dateInputProps
}) => {
  const [calendarOpen, setCalendarOpen] = useState(false);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <DateInput
          {...dateInputProps}
          className={cn('min-w-0 flex-1', className)}
        />
        <button
          type="button"
          onClick={() => setCalendarOpen((open) => !open)}
          className={cn(
            'shrink-0 rounded-lg border border-slate-300 px-2.5 text-slate-600 transition-colors',
            'hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700',
            calendarOpen && 'border-indigo-500 bg-indigo-50 text-indigo-700'
          )}
          aria-label="Open calendar"
          aria-expanded={calendarOpen}
        >
          <CalendarDays className="h-4 w-4" />
        </button>
      </div>

      {calendarOpen && (
        <CalendarPopover
          value={dateInputProps.value}
          onChange={dateInputProps.onChange}
          onClose={() => setCalendarOpen(false)}
          maxDate={maxDate}
          minDate={minDate}
        />
      )}
    </div>
  );
};
