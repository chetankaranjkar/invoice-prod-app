/**
 * Canonical date UX for this app:
 * - **Editable calendar fields**: `DateInput`
 * - **Read-only formatting**: `useDateFormat()` in `hooks/useDateFormat`
 *
 * Stored/bound calendar values should stay **`YYYY-MM-DD`**. Do not use `<input type="date" />`; ESLint forbids it.
 */

export type { DateInputProps } from './DateInput';
export { DateInput } from './DateInput';
export type { DateInputWithPickerProps } from './DateInputWithPicker';
export { DateInputWithPicker } from './DateInputWithPicker';
export type { CalendarPopoverProps } from './CalendarPopover';
export { CalendarPopover, todayIsoDate, compareIsoDates } from './CalendarPopover';
