import React, { useState, useEffect } from 'react';
import { X, Wallet, Save } from 'lucide-react';
import { cn } from '../lib/cn';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentData: {
    amountPaid: number;
    paymentMode: string;
    wave: number;
    remarks: string;
  }) => Promise<void>;
  invoiceNumber: string;
  balanceAmount: number;
}

export const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  invoiceNumber,
  balanceAmount,
}) => {
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<string>('Cash');
  const [wave, setWave] = useState<number>(0);
  const [remarks, setRemarks] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [waveRemainingAmount, setWaveRemainingAmount] = useState<boolean>(false);
  const [errors, setErrors] = useState<{ amountPaid?: string; wave?: string }>({});

  useEffect(() => {
    if (isOpen) {
      setAmountPaid(0);
      setPaymentMode('Cash');
      setWave(0);
      setRemarks('');
      setWaveRemainingAmount(false);
      setErrors({});
    }
  }, [isOpen]);

  useEffect(() => {
    if (waveRemainingAmount) {
      const remaining = Math.max(0, balanceAmount - amountPaid);
      setWave(remaining);
    }
  }, [waveRemainingAmount, amountPaid, balanceAmount]);

  const validateForm = (): boolean => {
    const newErrors: { amountPaid?: string; wave?: string } = {};
    if (amountPaid < 0) newErrors.amountPaid = 'Amount cannot be negative';
    if (wave < 0) newErrors.wave = 'Wave amount cannot be negative';
    const totalAmount = amountPaid + wave;
    if (totalAmount > balanceAmount) {
      newErrors.amountPaid = `Total (Amount + Wave) cannot exceed balance amount (₹${balanceAmount.toLocaleString()})`;
    }
    if (totalAmount === 0) {
      newErrors.amountPaid = 'Please enter payment amount or wave amount';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      await onConfirm({ amountPaid, paymentMode, wave, remarks });
      onClose();
    } catch (error) {
      console.error('Error adding payment:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const totalAmount = amountPaid + wave;
  const remainingBalance = balanceAmount - totalAmount;

  return (
    <div className="ui-modal-backdrop">
      <div className="ui-modal max-w-3xl">
        <div className="ui-modal-header">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">Add Payment</h2>
              <p className="text-xs text-slate-500 mt-0.5">Record a payment for invoice <span className="font-medium text-slate-700">{invoiceNumber}</span></p>
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

        <form onSubmit={handleSubmit}>
          <div className="ui-modal-body">
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
                    <p className="text-xs text-slate-500 mt-1">Max: ₹{balanceAmount.toLocaleString()}</p>
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
                    {waveRemainingAmount && (
                      <p className="text-xs text-slate-500 mt-1">Auto: ₹{(balanceAmount - amountPaid).toLocaleString()}</p>
                    )}
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

              {/* Summary card */}
              <div className="lg:col-span-1">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[10px] uppercase font-semibold tracking-wider text-slate-500">Summary</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Invoice</span>
                      <span className="font-medium text-slate-900">{invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Balance</span>
                      <span className="font-medium text-slate-900">₹{balanceAmount.toLocaleString()}</span>
                    </div>
                    <div className="border-t border-slate-200 my-2" />
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment</span>
                      <span className="font-medium">₹{amountPaid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Wave</span>
                      <span className="font-medium">₹{wave.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold">
                      <span>Total</span>
                      <span>₹{totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Remaining</span>
                      <span className={cn('font-semibold', remainingBalance > 0 ? 'text-red-600' : 'text-emerald-600')}>
                        ₹{remainingBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="ui-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="ui-btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ui-btn-success"
              disabled={loading}
            >
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
      </div>
    </div>
  );
};
