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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
          title="Close"
          aria-label="Close modal"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-bold mb-4">Add Payment</h2>
        <p className="text-sm text-gray-600 mb-4">
          Invoice: <span className="font-semibold">{invoiceNumber}</span>
        </p>
        <p className="text-sm text-gray-600 mb-6">
          Balance Amount: <span className="font-semibold">₹{balanceAmount.toLocaleString()}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Amount (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amountPaid || ''}
              onChange={(e) => {
                const newAmount = Number(e.target.value) || 0;
                setAmountPaid(newAmount);
                // If checkbox is checked, update wave automatically
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Payment Mode
            </label>
            <select
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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

          <div>
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wave (₹)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={wave || ''}
              onChange={(e) => {
                const newWave = Number(e.target.value) || 0;
                setWave(newWave);
                // If user manually changes wave, uncheck the checkbox if it doesn't match remaining
                if (waveRemainingAmount) {
                  const remaining = balanceAmount - amountPaid;
                  if (Math.abs(newWave - remaining) > 0.01) {
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
                Wave amount automatically set to remaining balance: ₹{(balanceAmount - amountPaid).toLocaleString()}
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
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional remarks..."
            />
          </div>

          <div className="bg-gray-50 p-3 rounded-md">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Payment Amount:</span>
              <span className="font-semibold">₹{amountPaid.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600">Wave Amount:</span>
              <span className="font-semibold">₹{wave.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold pt-2 border-t border-gray-300">
              <span>Total Deduction:</span>
              <span>₹{totalAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-gray-600">Remaining Balance:</span>
              <span className={`font-semibold ${remainingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                ₹{remainingBalance.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
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

