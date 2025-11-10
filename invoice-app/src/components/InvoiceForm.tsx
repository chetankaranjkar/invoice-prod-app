import React, { useState } from 'react';
import { Plus, Trash2, UserPlus, IndianRupee } from 'lucide-react';
import type { Customer, InvoiceItem, PaymentStatus, CreateInvoiceDto } from '../types';
import { calculateGST } from '../utils/helpers';
import { AddCustomerModal } from './AddCustomerModal';

interface InvoiceFormProps {
  customers: Customer[];
  onInvoiceCreate: (invoiceData: CreateInvoiceDto) => void;
  onCustomerAdded: (customer: Customer) => void;
  handleSelectedCustomer: (id: number) => void
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  customers,
  onInvoiceCreate,
  onCustomerAdded,
  handleSelectedCustomer
}) => {
  const [selectedCustomer, setSelectedCustomer] = useState<number>(0);
  const [dueDate, setDueDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Unpaid');
  const [initialPayment, setInitialPayment] = useState<number>(0);
  const [items, setItems] = useState<Partial<InvoiceItem>[]>([
    { productName: '', quantity: 1, rate: 0, gstPercentage: 18 },
  ]);
  const [showAddCustomer, setShowAddCustomer] = useState(false);

  const addItem = () => {
    setItems([...items, { productName: '', quantity: 1, rate: 0, gstPercentage: 18 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const updatedItems = [...items];

    updatedItems[index] = { ...updatedItems[index], [field]: value };

    if (['quantity', 'rate', 'gstPercentage'].includes(field)) {
      const quantity = Number(updatedItems[index].quantity) || 0;
      const rate = Number(updatedItems[index].rate) || 0;
      const gstPercentage = Number(updatedItems[index].gstPercentage) || 0;

      const amount = quantity * rate;
      const { gstAmount, cgst, sgst } = calculateGST(amount, gstPercentage);

      updatedItems[index] = {
        ...updatedItems[index],
        amount,
        gstAmount,
        cgst,
        sgst,
      };
    }

    setItems(updatedItems);
  };

  const calculateTotals = () => {
    const totalAmount = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const totalGST = items.reduce((sum, item) => sum + (item.gstAmount || 0), 0);
    const grandTotal = totalAmount + totalGST;

    return { totalAmount, totalGST, grandTotal };
  };

  const handlePaymentStatusChange = (status: PaymentStatus) => {
    const { grandTotal } = calculateTotals();

    setPaymentStatus(status);

    // Set initial payment based on status
    if (status === 'Unpaid') {
      setInitialPayment(0);
    } else if (status === 'Paid') {
      setInitialPayment(grandTotal);
    }
    // For 'Partially Paid', keep the current initialPayment value
  };


  const handleInitialPaymentChange = (amount: number) => {
    const { grandTotal } = calculateTotals();

    // Validate payment amount
    if (amount < 0) amount = 0;
    if (amount > grandTotal) amount = grandTotal;

    setInitialPayment(amount);

    // Update payment status based on payment amount
    if (amount === 0) {
      setPaymentStatus('Unpaid');
    } else if (amount === grandTotal) {
      setPaymentStatus('Paid');
    } else {
      setPaymentStatus('Partially Paid');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const { grandTotal } = calculateTotals();

    // Determine final values
    let finalInitialPayment = Math.min(initialPayment, grandTotal);
    let finalStatus: PaymentStatus = 'Unpaid';

    if (finalInitialPayment === 0) {
      finalStatus = 'Unpaid';
    } else if (finalInitialPayment === grandTotal) {
      finalStatus = 'Paid';
    } else {
      finalStatus = 'Partially Paid';
    }

    const invoiceData: CreateInvoiceDto = {
      customerId: selectedCustomer,
      dueDate: dueDate || undefined,
      invoicePrefix: 'INV',
      items: items.map(item => ({
        productName: item.productName!,
        quantity: item.quantity!,
        rate: item.rate!,
        gstPercentage: item.gstPercentage!,
      })),
      status: finalStatus,
      initialPayment: finalInitialPayment,  // ✅ new fix
    };

    console.log('🧾 Submitting Invoice:', invoiceData);
    onInvoiceCreate(invoiceData);
  };

  const handleCustomerSelection = (id: number) => {
    setSelectedCustomer(id);
    handleSelectedCustomer(id);
  };

  const handleCustomerAdded = (customer: Customer) => {
    onCustomerAdded(customer);
    setSelectedCustomer(customer.id);
    setShowAddCustomer(false);
  };

  const { totalAmount, totalGST, grandTotal } = calculateTotals();
  const balanceAmount = grandTotal - initialPayment;

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold mb-6">Create New Invoice</h2>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Selection */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Select Customer *
              </label>
              <button

                onClick={() => setShowAddCustomer(true)}
                className="flex items-center text-sm text-blue-600 hover:text-blue-700"
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Add New Customer
              </button>
            </div>
            <select
              value={selectedCustomer}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleCustomerSelection(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value={0}>Choose a customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customerName}
                  {customer.gstNumber && ` (${customer.gstNumber})`}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDueDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Payment Status Section */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Payment Status</h3>

            <div className="grid grid-cols-3 gap-4 mb-4">
              <button

                onClick={() => handlePaymentStatusChange('Unpaid')}
                className={`p-3 border-2 rounded-lg text-center transition-colors ${paymentStatus === 'Unpaid'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-red-300'
                  }`}
              >
                <div className="font-semibold">Unpaid</div>
                <div className="text-sm text-gray-500">No payment received</div>
              </button>

              <button

                onClick={() => handlePaymentStatusChange('Partially Paid')}
                className={`p-3 border-2 rounded-lg text-center transition-colors ${paymentStatus === 'Partially Paid'
                  ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-yellow-300'
                  }`}
              >
                <div className="font-semibold">Partially Paid</div>
                <div className="text-sm text-gray-500">Partial payment received</div>
              </button>

              <button

                onClick={() => handlePaymentStatusChange('Paid')}
                className={`p-3 border-2 rounded-lg text-center transition-colors ${paymentStatus === 'Paid'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-green-300'
                  }`}
              >
                <div className="font-semibold">Paid</div>
                <div className="text-sm text-gray-500">Full payment received</div>
              </button>
            </div>

            {/* Initial Payment Input */}
            {(paymentStatus === 'Partially Paid' || paymentStatus === 'Paid') && (
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Payment Amount (₹)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <IndianRupee className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={grandTotal}
                    step="0.01"
                    value={initialPayment}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInitialPaymentChange(Number(e.target.value))}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={paymentStatus as PaymentStatus !== 'Unpaid'}
                  />
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  Maximum: ₹{grandTotal.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* Invoice Items */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Invoice Items</h3>
              <button

                onClick={addItem}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </button>
            </div>

            <div className="space-y-4">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-4 items-end p-4 border rounded-lg">
                  <div className="col-span-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name *
                    </label>
                    <input
                      type="text"
                      value={item.productName || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(index, 'productName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(index, 'quantity', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rate (₹) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.rate || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(index, 'rate', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      GST % *
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={item.gstPercentage || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(index, 'gstPercentage', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div className="col-span-1">
                    <button

                      onClick={() => removeItem(index)}
                      className="w-full p-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Calculated amounts */}
                  <div className="col-span-12 grid grid-cols-4 gap-4 mt-2 text-sm">
                    <div>Amount: ₹{item.amount?.toFixed(2) || '0.00'}</div>
                    <div>GST: ₹{item.gstAmount?.toFixed(2) || '0.00'}</div>
                    <div>CGST: ₹{item.cgst?.toFixed(2) || '0.00'}</div>
                    <div>SGST: ₹{item.sgst?.toFixed(2) || '0.00'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals and Payment Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-lg font-semibold mb-3">Invoice Totals</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Total Amount:</span>
                    <span>₹{totalAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total GST:</span>
                    <span>₹{totalGST.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Grand Total:</span>
                    <span className="text-blue-600">₹{grandTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-lg font-semibold mb-3">Payment Summary</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Status:</span>
                    <span className={`font-semibold ${paymentStatus === 'Paid' ? 'text-green-600' :
                      paymentStatus === 'Partially Paid' ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                      {paymentStatus}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Paid Amount:</span>
                    <span className="text-green-600">₹{initialPayment.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Balance Due:</span>
                    <span className="text-red-600">₹{balanceAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Balance Amount:</span>
                    <span>₹{(grandTotal - initialPayment).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            className="w-full bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 font-medium text-lg"
          >
            Create Invoice
          </button>
        </form>
      </div>

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onCustomerAdded={handleCustomerAdded}
      />
    </>
  );
};