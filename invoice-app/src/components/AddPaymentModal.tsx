import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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
  const [errors, setErrors] = useState<{
    amountPaid?: string;
    wave?: string;
  }>({});

  useEffect(() => {
    if (isOpen) {
      // Reset form when modal opens
      setAmountPaid(0);
      setPaymentMode('Cash');
      setWave(0);
      setRemarks('');
      setWaveRemainingAmount(false);
      setErrors({});
    }
  }, [isOpen]);

  // Calculate remaining amount and update wave when checkbox is checked or amountPaid changes
  useEffect(() => {
    if (waveRemainingAmount) {
      const remaining = Math.max(0, balanceAmount - amountPaid);
      setWave(remaining);
    }
  }, [waveRemainingAmount, amountPaid, balanceAmount]);

  const validateForm = (): boolean => {
    const newErrors: { amountPaid?: string; wave?: string } = {};

    if (amountPaid < 0) {
      newErrors.amountPaid = 'Amount cannot be negative';
    }

    if (wave < 0) {
      newErrors.wave = 'Wave amount cannot be negative';
    }

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

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      await onConfirm({
        amountPaid,
        paymentMode,
        wave,
        remarks,
      });
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          title="Close"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold mb-4">Add Payment</h2>

        <form onSubmit={handleSubmit}>
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left: Form fields in horizontal grid */}
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
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
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.amountPaid ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
                {errors.amountPaid && (
                  <p className="text-red-500 text-xs mt-1">{errors.amountPaid}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">Max: ₹{balanceAmount.toLocaleString()}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Payment Mode
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

              <div className="sm:col-span-2">
                <div className="flex items-center mb-2">
                  <input
                    type="checkbox"
                    id="waveRemaining"
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
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="waveRemaining" className="ml-2 text-sm font-medium text-gray-700 cursor-pointer">
                    Wave off remaining amount
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Wave (₹)
                </label>
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
                    if (waveRemainingAmount) {
                      if (Math.abs(newWave - maxWave) > 0.01) {
                        setWaveRemainingAmount(false);
                      }
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    errors.wave ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                  disabled={waveRemainingAmount}
                />
                {errors.wave && (
                  <p className="text-red-500 text-xs mt-1">{errors.wave}</p>
                )}
                {waveRemainingAmount && (
                  <p className="text-xs text-gray-500 mt-1">
                    Auto: ₹{(balanceAmount - amountPaid).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Remarks
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional remarks..."
                />
              </div>
            </div>

            {/* Right: Summary */}
            <div className="lg:w-56 shrink-0">
              <div className="bg-gray-50 p-4 rounded-md h-full">
                <p className="text-sm text-gray-600 mb-2">
                  Invoice: <span className="font-semibold text-gray-900">{invoiceNumber}</span>
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  Balance: <span className="font-semibold text-gray-900">₹{balanceAmount.toLocaleString()}</span>
                </p>
                <div className="border-t border-gray-200 pt-2 mt-2 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Payment:</span>
                    <span className="font-semibold">₹{amountPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Wave:</span>
                    <span className="font-semibold">₹{wave.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-200">
                    <span>Total:</span>
                    <span>₹{totalAmount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1">
                    <span className="text-gray-600">Remaining:</span>
                    <span className={`font-semibold ${remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      ₹{remainingBalance.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-6 mt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
            >
              {loading ? 'Adding...' : 'Add Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

