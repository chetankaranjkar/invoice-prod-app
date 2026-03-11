import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { formatDateWithPreference } from '../utils/helpers';

const DEFAULT_FORMAT = 'DD/MM/YYYY';

/** Hook that returns a date formatter using the user's profile date format preference. */
export function useDateFormat() {
  const { profile } = useAuth();
  const format = profile?.dateFormat || DEFAULT_FORMAT;
  return useCallback(
    (date: string | Date) => formatDateWithPreference(date, format),
    [format]
  );
}
