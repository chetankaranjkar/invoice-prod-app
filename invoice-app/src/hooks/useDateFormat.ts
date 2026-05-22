import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatDateWithPreference, parseLocalDate } from '../utils/helpers';

const DEFAULT_FORMAT = 'DD/MM/YYYY';

const ISO_DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})(?:[^\d].*)?$/;

/**
 * Format dates for display using User Profile → **date format**.
 * For editable calendar fields, use **`DateInput`** from **`src/components/dates`** (`YYYY-MM-DD` state).
 */
export function useDateFormat() {
  const { profile } = useAuth();
  const format = profile?.dateFormat || DEFAULT_FORMAT;
  return useCallback(
    (date: string | Date) => {
      if (typeof date === 'string') {
        const m = date.trim().match(ISO_DATE_PREFIX);
        if (m) {
          return formatDateWithPreference(parseLocalDate(m[1]), format);
        }
      }
      return formatDateWithPreference(date, format);
    },
    [format],
  );
}
