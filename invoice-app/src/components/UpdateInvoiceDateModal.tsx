import React, { useEffect, useState } from 'react';
import { X, CalendarDays } from 'lucide-react';
import { DateInputWithPicker, todayIsoDate } from './dates';
import { api } from '../services/agent';
import { getApiErrorMessage, parseLocalDate } from '../utils/helpers';
import type { Invoice } from '../types';

function isFutureInvoiceDate(iso: string): boolean {
  const selected = parseLocalDate(iso);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  selected.setHours(0, 0, 0, 0);
  return selected.getTime() > today.getTime();
}

function toIsoDate(value: string | Date | undefined | null): string {
  if (!value) return new Date().toISOString().split('T')[0];
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
  return d.toISOString().split('T')[0];
}

interface UpdateInvoiceDateModalProps {
  invoice: Pick<Invoice, 'id' | 'invoiceNumber' | 'invoiceDate'> | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (invoice: Invoice) => void;
}

export const UpdateInvoiceDateModal: React.FC<UpdateInvoiceDateModalProps> = ({
  invoice,
  isOpen,
  onClose,
  onUpdated,
}) => {
  const [invoiceDate, setInvoiceDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && invoice) {
      setInvoiceDate(toIsoDate(invoice.invoiceDate));
      setError('');
    }
  }, [isOpen, invoice]);

  if (!isOpen || !invoice) return null;

  const handleSave = async () => {
    if (!invoiceDate) {
      setError('Please enter an invoice date.');
      return;
    }

    if (isFutureInvoiceDate(invoiceDate)) {
      setError('Invoice date cannot be in the future.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const response = await api.invoices.updateInvoiceDate(invoice.id, invoiceDate);
      onUpdated(response.data);
      onClose();
    } catch (err: unknown) {
      setError(getApiErrorMessage(err as Parameters<typeof getApiErrorMessage>[0], 'Failed to update invoice date.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold text-slate-900">Update invoice date</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-sm text-slate-600">
            Invoice <span className="font-semibold text-slate-900">{invoice.invoiceNumber}</span>
          </p>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Invoice date</label>
            <DateInputWithPicker
              value={invoiceDate}
              onChange={setInvoiceDate}
              maxDate={todayIsoDate()}
              ariaLabel="Invoice date"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              Type the date or use the calendar — today or earlier only.
            </p>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save date'}
          </button>
        </div>
      </div>
    </div>
  );
};

interface UpdateInvoiceDateButtonProps {
  invoice: Pick<Invoice, 'id' | 'invoiceNumber' | 'invoiceDate'>;
  onClick: () => void;
  className?: string;
}

export const UpdateInvoiceDateButton: React.FC<UpdateInvoiceDateButtonProps> = ({
  onClick,
  className = '',
}) => (
  <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}
    className={`p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors ${className}`}
    title="Update invoice date"
    aria-label="Update invoice date"
  >
    <CalendarDays className="h-4 w-4" />
  </button>
);
