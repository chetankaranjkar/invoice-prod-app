import React, { useState, useEffect, useCallback } from 'react';
import { X, Wallet, Save, Pencil, History } from 'lucide-react';
import { cn } from '../lib/cn';
import { api } from '../services/agent';
import { useDateFormat } from '../hooks/useDateFormat';
import { getApiErrorMessage } from '../utils/helpers';
import type { Payment } from '../types';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentData: {
    amountPaid: number;
    paymentMode: string;
    wave: number;
    remarks: string;
  }) => Promise<void>;
  onPaymentsChanged?: () => Promise<void>;
  invoiceId: number;
  invoiceNumber: string;
  grandTotal: number;
  balanceAmount: number;
}

const formatCurrency = (value: number) =>
  `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  onPaymentsChanged,
  invoiceId,
  invoiceNumber,
  grandTotal,
  balanceAmount: initialBalanceAmount,
}) => {
  const formatDate = useDateFormat();
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [wave, setWave] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [waveRemainingAmount, setWaveRemainingAmount] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ amountPaid?: string; wave?: string }>({});

  const [payments, setPayments] = useState<Payment[]>([]);
  const [balanceAmount, setBalanceAmount] = useState(initialBalanceAmount);
  const [invoiceStatus, setInvoiceStatus] = useState<string>('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editAmountPaid, setEditAmountPaid] = useState(0);
  const [editWave, setEditWave] = useState(0);
  const [editPaymentMode, setEditPaymentMode] = useState('Cash');
  const [editRemarks, setEditRemarks] = useState('');
  const [editErrors, setEditErrors] = useState<{ amountPaid?: string; wave?: string }>({});
  const [editLoading, setEditLoading] = useState(false);

  const canEditPayments = payments.length > 1 || invoiceStatus === 'Partially Paid';

  const loadPaymentHistory = useCallback(async () => {
    if (!invoiceId) return;
    setLoadingHistory(true);
    try {
      const response = await api.invoices.getById(invoiceId);
      const invoice = response.data;
      setPayments(invoice.payments || []);
      setBalanceAmount(invoice.balanceAmount ?? initialBalanceAmount);
      setInvoiceStatus(invoice.status || '');
    } catch (error) {
      console.error('Failed to load payment history:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [invoiceId, initialBalanceAmount]);

  useEffect(() => {
    if (isOpen) {
      setAmountPaid(0);
      setPaymentMode('Cash');
      setWave(0);
      setRemarks('');
      setWaveRemainingAmount(false);
      setErrors({});
      setEditingPayment(null);
      setBalanceAmount(initialBalanceAmount);
      void loadPaymentHistory();
    }
  }, [isOpen, initialBalanceAmount, loadPaymentHistory]);

  useEffect(() => {
    if (waveRemainingAmount) {
      const remaining = Math.max(0, balanceAmount - amountPaid);
      setWave(remaining);
    }
  }, [waveRemainingAmount, amountPaid, balanceAmount]);

  const getMaxAllowedForPayment = (excludePaymentId?: number) => {
    const otherTotal = payments
      .filter((p) => p.id !== excludePaymentId)
      .reduce((sum, p) => sum + (p.amountPaid || 0) + (p.waveAmount || 0), 0);
    return Math.max(0, grandTotal - otherTotal);
  };

  const validateForm = (): boolean => {
    const newErrors: { amountPaid?: string; wave?: string } = {};
    if (amountPaid < 0) newErrors.amountPaid = 'Amount cannot be negative';
    if (wave < 0) newErrors.wave = 'Wave amount cannot be negative';
    const totalAmount = amountPaid + wave;
    if (totalAmount > balanceAmount) {
      newErrors.amountPaid = `Total (Amount + Wave) cannot exceed balance amount (${formatCurrency(balanceAmount)})`;
    }
    if (totalAmount === 0) {
      newErrors.amountPaid = 'Please enter payment amount or wave amount';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateEditForm = (): boolean => {
    if (!editingPayment) return false;
    const newErrors: { amountPaid?: string; wave?: string } = {};
    const maxAllowed = getMaxAllowedForPayment(editingPayment.id);

    if (editAmountPaid < 0) newErrors.amountPaid = 'Amount cannot be negative';
    if (editWave < 0) newErrors.wave = 'Wave amount cannot be negative';

    const totalAmount = editAmountPaid + editWave;
    if (totalAmount > maxAllowed) {
      newErrors.amountPaid = `Total cannot exceed ${formatCurrency(maxAllowed)} for this payment`;
    }
    if (totalAmount <= 0) {
      newErrors.amountPaid = 'Payment amount or wave must be greater than zero';
    }

    setEditErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      await onConfirm({ amountPaid, paymentMode, wave, remarks });
      await loadPaymentHistory();
      if (onPaymentsChanged) await onPaymentsChanged();
      onClose();
    } catch (error) {
      console.error('Error adding payment:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (payment: Payment) => {
    setEditingPayment(payment);
    setEditAmountPaid(payment.amountPaid || 0);
    setEditWave(payment.waveAmount || 0);
    setEditPaymentMode(payment.paymentMode || 'Cash');
    setEditRemarks(payment.remarks || '');
    setEditErrors({});
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPayment || !validateEditForm()) return;

    setEditLoading(true);
    try {
      await api.invoices.updatePayment(invoiceId, editingPayment.id, {
        amountPaid: editAmountPaid,
        waveAmount: editWave,
        paymentMode: editPaymentMode,
        remarks: editRemarks,
      });
      setEditingPayment(null);
      await loadPaymentHistory();
      if (onPaymentsChanged) await onPaymentsChanged();
    } catch (error) {
      alert(`Failed to update payment: ${getApiErrorMessage(error as Parameters<typeof getApiErrorMessage>[0], 'Please try again.')}`);
    } finally {
      setEditLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalAmount = amountPaid + wave;
  const remainingBalance = balanceAmount - totalAmount;
  const totalRecorded = payments.reduce((sum, p) => sum + (p.amountPaid || 0) + (p.waveAmount || 0), 0);

  return (
    <div className="ui-modal-backdrop">
      <div className="ui-modal max-w-4xl">
        <div className="ui-modal-header">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Manage Payments</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Invoice <span className="font-medium text-slate-700">{invoiceNumber}</span>
                {' · '}Grand total {formatCurrency(grandTotal)}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            title="Close"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="ui-modal-body space-y-5">
          {payments.length > 0 && (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200">
                <History className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-800">Payment History</h3>
                <span className="text-xs text-slate-500 ml-auto">
                  Recorded: {formatCurrency(totalRecorded)} / {formatCurrency(grandTotal)}
                </span>
              </div>

              {loadingHistory ? (
                <div className="px-4 py-6 text-sm text-slate-500 text-center">Loading payment history…</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium">Date</th>
                        <th className="px-4 py-2 text-right font-medium">Paid</th>
                        <th className="px-4 py-2 text-right font-medium">Wave</th>
                        <th className="px-4 py-2 text-left font-medium">Mode</th>
                        <th className="px-4 py-2 text-left font-medium">Remarks</th>
                        {canEditPayments && <th className="px-4 py-2 text-right font-medium">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((payment) => (
                        <tr key={payment.id} className="hover:bg-slate-50/80">
                          <td className="px-4 py-2.5 whitespace-nowrap text-slate-700">
                            {payment.paymentDate ? formatDate(payment.paymentDate) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium text-slate-900">
                            {formatCurrency(payment.amountPaid || 0)}
                          </td>
                          <td className="px-4 py-2.5 text-right text-slate-600">
                            {(payment.waveAmount || 0) > 0 ? formatCurrency(payment.waveAmount) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">{payment.paymentMode || '—'}</td>
                          <td className="px-4 py-2.5 text-slate-500 max-w-[180px] truncate" title={payment.remarks || ''}>
                            {payment.remarks || '—'}
                          </td>
                          {canEditPayments && (
                            <td className="px-4 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => startEditing(payment)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded"
                              >
                                <Pencil className="h-3 w-3" />
                                Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {editingPayment && (
            <form onSubmit={handleEditSubmit} className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-indigo-900">Edit Payment</h3>
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel edit
                </button>
              </div>
              <p className="text-xs text-slate-600">
                Max for this payment: {formatCurrency(getMaxAllowedForPayment(editingPayment.id))}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="ui-label">Payment Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editAmountPaid || ''}
                    onChange={(e) => setEditAmountPaid(Math.max(0, Number(e.target.value) || 0))}
                    className={cn('ui-input', editErrors.amountPaid && 'border-red-300')}
                    aria-label="Edit payment amount"
                  />
                  {editErrors.amountPaid && <p className="text-red-500 text-xs mt-1">{editErrors.amountPaid}</p>}
                </div>
                <div>
                  <label className="ui-label">Wave (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editWave || ''}
                    onChange={(e) => setEditWave(Math.max(0, Number(e.target.value) || 0))}
                    className={cn('ui-input', editErrors.wave && 'border-red-300')}
                    aria-label="Edit wave amount"
                  />
                  {editErrors.wave && <p className="text-red-500 text-xs mt-1">{editErrors.wave}</p>}
                </div>
                <div>
                  <label className="ui-label">Payment Mode</label>
                  <select
                    value={editPaymentMode}
                    onChange={(e) => setEditPaymentMode(e.target.value)}
                    className="ui-select"
                    aria-label="Edit payment mode"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="UPI">UPI</option>
                    <option value="Credit Card">Credit Card</option>
                    <option value="Debit Card">Debit Card</option>
                    <option value="Initial">Initial</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="ui-label">Remarks</label>
                  <input
                    type="text"
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    className="ui-input"
                    placeholder="Optional remarks"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button type="submit" className="ui-btn-primary ui-btn-sm" disabled={editLoading}>
                  {editLoading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {balanceAmount > 0 && (
            <form onSubmit={handleSubmit}>
              <h3 className="text-sm font-semibold text-slate-800 mb-3">Add Payment</h3>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                <div className="lg:col-span-2 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="ui-label">
                        Payment Amount (₹) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={balanceAmount}
                        value={amountPaid || ''}
                        onChange={(e) => {
                          const newAmount = Math.min(Math.max(0, Number(e.target.value) || 0), balanceAmount);
                          setAmountPaid(newAmount);
                          if (waveRemainingAmount) {
                            const remaining = Math.max(0, balanceAmount - newAmount);
                            setWave(remaining);
                          }
                        }}
                        className={cn('ui-input', errors.amountPaid && 'border-red-300 focus:border-red-400')}
                        placeholder="0.00"
                      />
                      {errors.amountPaid && <p className="text-red-500 text-xs mt-1">{errors.amountPaid}</p>}
                      <p className="text-xs text-slate-500 mt-1">Max: {formatCurrency(balanceAmount)}</p>
                    </div>

                    <div>
                      <label className="ui-label">Payment Mode</label>
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="ui-select"
                        aria-label="Payment mode"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                        <option value="UPI">UPI</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="Debit Card">Debit Card</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>

                  <label className="flex items-center gap-2 select-none cursor-pointer p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <input
                      type="checkbox"
                      checked={waveRemainingAmount}
                      onChange={(e) => {
                        setWaveRemainingAmount(e.target.checked);
                        if (e.target.checked) {
                          const remaining = balanceAmount - amountPaid;
                          setWave(Math.max(0, remaining));
                        } else {
                          setWave(0);
                        }
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Wave off remaining amount</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="ui-label">Wave (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={Math.max(0, balanceAmount - amountPaid)}
                        value={wave || ''}
                        onChange={(e) => {
                          const maxWave = Math.max(0, balanceAmount - amountPaid);
                          const newWave = Math.min(Math.max(0, Number(e.target.value) || 0), maxWave);
                          setWave(newWave);
                          if (waveRemainingAmount && Math.abs(newWave - maxWave) > 0.01) {
                            setWaveRemainingAmount(false);
                          }
                        }}
                        className={cn('ui-input', errors.wave && 'border-red-300 focus:border-red-400')}
                        placeholder="0.00"
                        disabled={waveRemainingAmount}
                      />
                      {errors.wave && <p className="text-red-500 text-xs mt-1">{errors.wave}</p>}
                    </div>

                    <div>
                      <label className="ui-label">Remarks</label>
                      <textarea
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={2}
                        className="ui-textarea min-h-[60px]"
                        placeholder="Optional remarks…"
                      />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-1">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Summary</p>
                    <div className="mt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Balance</span>
                        <span className="font-medium text-slate-900">{formatCurrency(balanceAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Payment</span>
                        <span className="font-medium">{formatCurrency(amountPaid)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Wave</span>
                        <span className="font-medium">{formatCurrency(wave)}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold">
                        <span>Total</span>
                        <span>{formatCurrency(totalAmount)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Remaining</span>
                        <span className={cn('font-semibold', remainingBalance > 0 ? 'text-red-600' : 'text-emerald-600')}>
                          {formatCurrency(remainingBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ui-modal-footer mt-4 -mx-6 -mb-6 px-6 py-4 border-t border-slate-200 bg-slate-50/50">
                <button type="button" onClick={onClose} className="ui-btn-secondary" disabled={loading}>
                  {balanceAmount > 0 ? 'Cancel' : 'Close'}
                </button>
                <button type="submit" className="ui-btn-success" disabled={loading}>
                  {loading ? (
                    <>
                      <span className="inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                      Adding…
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Add Payment
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {balanceAmount <= 0 && payments.length > 0 && (
            <div className="flex justify-end pt-2">
              <button type="button" onClick={onClose} className="ui-btn-secondary">
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
