import React, { useState, useEffect } from 'react';
import { useDateFormat } from '../hooks/useDateFormat';
import { X, DollarSign, FileText } from 'lucide-react';
import { api } from '../services/agent';
import { AddPaymentModal } from './AddPaymentModal';
import type { Invoice } from '../types';

interface UserInvoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
}

export const UserInvoicesModal: React.FC<UserInvoicesModalProps> = ({
  isOpen,
  onClose,
  userId,
  userName,
}) => {
  const formatDate = useDateFormat();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      loadInvoices();
    }
  }, [isOpen, userId]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.invoices.getList();
      // Filter invoices by userName (which is the name of the user who created the invoice)
      // The API already filters by role (Admin sees invoices from users they created)
      const userInvoices = response.data.filter((inv: Invoice) => {
        // Match by userName which is set in the InvoiceDto
        return inv.userName === userName;
      });
      setInvoices(userInvoices);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load invoices');
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading invoices:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setShowPaymentModal(true);
  };

  const handlePaymentAdded = async (paymentData: {
    amountPaid: number;
    paymentMode: string;
    wave: number;
    remarks: string;
  }) => {
    if (!selectedInvoice) return;

    try {
      await api.invoices.addPayment(selectedInvoice.id, {
        amountPaid: paymentData.amountPaid,
        waveAmount: paymentData.wave,
        paymentMode: paymentData.paymentMode,
        remarks: paymentData.remarks || `Payment added by admin for ${userName}`,
      });

      // Reload invoices to get updated payment information
      await loadInvoices();
      setShowPaymentModal(false);
      setSelectedInvoice(null);
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error adding payment:', err);
      }
      throw err; // Let the modal handle the error
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-800';
      case 'Partially Paid':
        return 'bg-yellow-100 text-yellow-800';
      case 'Unpaid':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div className="flex items-center">
              <FileText className="h-6 w-6 text-blue-600 mr-2" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">Invoices for {userName}</h2>
                <p className="text-sm text-gray-500 mt-1">{invoices.length} invoice(s) found</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
              aria-label="Close modal"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {error}
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No invoices found</h3>
                <p className="mt-1 text-sm text-gray-500">This user has not created any invoices yet.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Invoice #
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Customer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Grand Total
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Paid
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Balance
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {invoice.invoiceNumber}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(invoice.invoiceDate)}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          {invoice.customerName || 'N/A'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                          ₹{invoice.grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                          ₹{invoice.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          ₹{invoice.balanceAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                              invoice.status
                            )}`}
                          >
                            {invoice.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {invoice.balanceAmount > 0 && (
                            <button
                              onClick={() => handleAddPayment(invoice)}
                              className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-700 transition-colors"
                            >
                              <DollarSign className="h-3 w-3 mr-1" />
                              Add Payment
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <AddPaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedInvoice(null);
          }}
          onConfirm={handlePaymentAdded}
          invoiceNumber={selectedInvoice.invoiceNumber}
          balanceAmount={selectedInvoice.balanceAmount}
        />
      )}
    </>
  );
};

