import React, { useState, useEffect } from 'react';
import { Users, IndianRupee, Phone, Mail, UserPlus, FileText, X } from 'lucide-react';
import { api } from '../services/agent';
import type { Customer, Invoice } from '../types';
import { formatCurrency } from '../utils/helpers';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorAlert } from '../components/ErrorAlert';
import { AddCustomerModal } from '../components/AddCustomerModal';

interface CustomersPageProps {
  filter?: 'all' | 'paid' | 'unpaid';
}

export const CustomersPage: React.FC<CustomersPageProps> = ({ filter = 'all' }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  // 🆕 New: Track selected customer for invoice/payment modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [customersResponse, invoicesResponse] = await Promise.all([
        api.customers.getList(),
        api.invoices.getList(),
      ]);

      setCustomers(customersResponse.data);
      setInvoices(invoicesResponse.data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate customer balances from invoices
  const getCustomerBalance = (customerId: number): number => {
    return invoices
      .filter(invoice => invoice.customerId === customerId)
      .reduce((sum, invoice) => sum + invoice.balanceAmount, 0);
  };

  const getCustomerStatus = (customerId: number): 'paid' | 'unpaid' => {
    const balance = getCustomerBalance(customerId);
    return balance > 0 ? 'unpaid' : 'paid';
  };

  const filteredCustomers = customers.filter(customer => {
    if (filter === 'paid') return getCustomerStatus(customer.id) === 'paid';
    if (filter === 'unpaid') return getCustomerStatus(customer.id) === 'unpaid';
    return true;
  });

  const handleCustomerAdded = (customer: Customer) => {
    setCustomers(prev => [...prev, customer]);
    setShowAddCustomer(false);
  };

  // 🆕 Load invoices for a selected customer
  const handleViewInvoices = async (customer: Customer) => {
    try {
      setSelectedCustomer(customer);
      setLoadingInvoices(true);
      const response = await api.invoices.getList();
      const custInvoices = response.data.filter(
        (inv: Invoice) => inv.customerId === customer.id
      );
      setCustomerInvoices(custInvoices);
    } catch (error) {
      console.error('Error loading customer invoices:', error);
    } finally {
      setLoadingInvoices(false);
    }
  };

  // 🆕 Add payment to a specific invoice
  const handleAddPayment = async (invoiceId: number) => {
    const amount = Number(prompt('Enter payment amount (₹):'));
    if (!amount || amount <= 0) return;

    try {
      await api.invoices.addPayment(invoiceId, {
        amountPaid: amount,
        paymentMode: 'Cash',
        remarks: 'Added from unpaid page',
      });
      alert('✅ Payment added successfully!');
      await handleViewInvoices(selectedCustomer!);
      await loadData(); // refresh customer balances
    } catch (err) {
      console.error('❌ Failed to add payment:', err);
      alert('Error adding payment.');
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} onRetry={loadData} />;

  return (
    <>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">
              {filter === 'paid'
                ? 'Paid Customers'
                : filter === 'unpaid'
                ? 'Unpaid Customers'
                : 'All Customers'}
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-lg text-gray-600">
                {filteredCustomers.length} customers
              </span>
              <button
                onClick={() => setShowAddCustomer(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Customer
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCustomers.map(customer => {
              const customerBalance = getCustomerBalance(customer.id);
              const customerStatus = getCustomerStatus(customer.id);

              return (
                <div
                  key={customer.id}
                  className="card p-6 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() =>
                    customerStatus === 'unpaid' && handleViewInvoices(customer)
                  }
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-100 rounded-full mr-3">
                        <Users className="h-5 w-5 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {customer.customerName}
                      </h3>
                    </div>
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        customerStatus === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {customerStatus === 'paid' ? 'Paid' : 'Unpaid'}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-gray-600">
                    {customer.email && (
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2" />
                        {customer.email}
                      </div>
                    )}
                    {customer.phone && (
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2" />
                        {customer.phone}
                      </div>
                    )}
                    {customer.gstNumber && (
                      <div>
                        <strong>GST:</strong> {customer.gstNumber}
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">
                        Pending Amount
                      </span>
                      <div className="flex items-center">
                        <IndianRupee className="h-4 w-4 text-gray-500 mr-1" />
                        <span
                          className={`font-semibold ${
                            customerBalance > 0
                              ? 'text-red-600'
                              : 'text-green-600'
                          }`}
                        >
                          {formatCurrency(customerBalance)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredCustomers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No customers found
              </h3>
              <p className="text-gray-500 mb-4">
                {filter === 'all'
                  ? 'No customers have been added yet.'
                  : `No ${filter} customers found.`}
              </p>
              <button
                onClick={() => setShowAddCustomer(true)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 mx-auto"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add Your First Customer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ✅ Add Customer Modal */}
      <AddCustomerModal
        isOpen={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onCustomerAdded={handleCustomerAdded}
      />

      {/* 🧾 Customer Invoice + Payment Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl p-6 relative">
            <button
              onClick={() => setSelectedCustomer(null)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold mb-4">
              Invoices – {selectedCustomer.customerName}
            </h2>

            {loadingInvoices ? (
              <LoadingSpinner />
            ) : customerInvoices.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left">Invoice #</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-right">Paid</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                      <th className="px-4 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerInvoices.map(inv => (
                      <tr key={inv.id} className="border-b hover:bg-gray-50">
                        <td className="px-4 py-2 font-medium">{inv.invoiceNumber}</td>
                        <td className="px-4 py-2 text-right">
                          ₹{inv.grandTotal.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right">
                          ₹{inv.paidAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right">
                          ₹{inv.balanceAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {inv.balanceAmount > 0 ? (
                            <button
                              onClick={() => handleAddPayment(inv.id)}
                              className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                              Add Payment
                            </button>
                          ) : (
                            <span className="text-green-600 font-medium">Paid</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-6">No invoices found.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
};
