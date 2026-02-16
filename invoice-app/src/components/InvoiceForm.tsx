import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2, UserPlus, IndianRupee, FolderOpen } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import type { Customer, InvoiceItem, PaymentStatus, CreateInvoiceDto, InvoiceTemplateItemDto } from '../types';
import { InvoiceFormTaxableDetails } from './InvoiceFormTaxableDetails.tsx';
import { calculateGST } from '../utils/helpers';
import { AddCustomerModal } from './AddCustomerModal';
import { InvoiceTemplateModal } from './InvoiceTemplateModal';
import { ToWords } from 'to-words';

interface InvoiceFormProps {
  customers: Customer[];
  onInvoiceCreate: (invoiceData: CreateInvoiceDto | any) => void;
  onCustomerAdded: (customer: Customer) => void;
  handleSelectedCustomer: (id: number) => void;
  items: Partial<InvoiceItem>[];
  setItems: React.Dispatch<React.SetStateAction<Partial<InvoiceItem>[]>>;
  dueDate: string;
  setDueDate: React.Dispatch<React.SetStateAction<string>>;
  paymentStatus: PaymentStatus;
  setPaymentStatus: React.Dispatch<React.SetStateAction<PaymentStatus>>;
  initialPayment: number;
  setInitialPayment: React.Dispatch<React.SetStateAction<number>>;
  isEditMode?: boolean;
  initialCustomerId?: number;
}

export const InvoiceForm: React.FC<InvoiceFormProps> = ({
  customers,
  onInvoiceCreate,
  onCustomerAdded,
  handleSelectedCustomer,
  items,
  setItems,
  dueDate,
  setDueDate,
  paymentStatus,
  setPaymentStatus,
  initialPayment,
  setInitialPayment,
  isEditMode = false,
  initialCustomerId,
}) => {
  const [selectedCustomer, setSelectedCustomer] = useState<number>(initialCustomerId || 0);
  const { profile } = useAuth();
  const defaultGstPercentage = profile?.defaultGstPercentage ?? 18;
  const disableQuantity = profile?.disableQuantity ?? false;
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const { themeColors, focusRing } = useTheme();
  const toWords = new ToWords({
    localeCode: 'en-IN',
    converterOptions: {
      currency: true,
      ignoreDecimal: false,
      ignoreZeroCurrency: false,
      doNotAddOnly: false,
      currencyOptions: {
        name: 'Rupee',
        plural: 'Rupees',
        symbol: '₹',
        fractionalUnit: {
          name: 'Paisa',
          plural: 'Paise',
          symbol: '',
        },
      },
    },
  });

  // Update selectedCustomer when initialCustomerId changes
  useEffect(() => {
    if (initialCustomerId && initialCustomerId !== selectedCustomer) {
      setSelectedCustomer(initialCustomerId);
      handleSelectedCustomer(initialCustomerId);
    }
  }, [initialCustomerId]);

  const addItem = () => {
    if (selectedCustomer === 0) {
      alert('Please select a customer first before adding items.');
      return;
    }
    // Add new item at the start of the array
    setItems([{ productName: '', quantity: 1, rate: 0, gstPercentage: defaultGstPercentage }, ...items]);
    // Ensure quantity is always 1 if disabled
    if (disableQuantity) {
      const newItems = [{ productName: '', quantity: 1, rate: 0, gstPercentage: defaultGstPercentage }, ...items];
      setItems(newItems.map(item => ({ ...item, quantity: 1 })));
    }
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
      // If quantity is disabled, always use 1
      const quantity = disableQuantity ? 1 : (Number(updatedItems[index].quantity) || 1);
      const rate = Number(updatedItems[index].rate) || 0;
      const gstPercentage = updatedItems[index].gstPercentage !== undefined && updatedItems[index].gstPercentage !== null 
        ? Number(updatedItems[index].gstPercentage) 
        : 0;

      const amount = quantity * rate;
      const { gstAmount, cgst, sgst } = calculateGST(amount, gstPercentage);

      updatedItems[index] = {
        ...updatedItems[index],
        quantity: disableQuantity ? 1 : quantity,
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

    // Validate customer is selected
    if (selectedCustomer === 0) {
      alert('Please select a customer before creating the invoice.');
      return;
    }

    if (isEditMode) {
      // For edit mode, create UpdateInvoiceDto
      const invoiceData = {
        customerId: selectedCustomer,
        dueDate: dueDate || undefined,
        items: items.map(item => ({
          productName: item.productName!,
          quantity: item.quantity!,
          rate: item.rate!,
          gstPercentage: item.gstPercentage!,
        })),
        status: paymentStatus,
      };
      onInvoiceCreate(invoiceData);
      return;
    }

    // For create mode, use CreateInvoiceDto
    const { grandTotal } = calculateTotals();

    // Determine final status based on payment status and payment amount
    let finalStatus: PaymentStatus = paymentStatus;
    let finalInitialPayment = Math.min(initialPayment, grandTotal);

    // If status is Draft, keep it as Draft
    // If status is Sent, keep it as Sent
    // Otherwise, determine based on payment amount
    if (paymentStatus !== 'Draft' && paymentStatus !== 'Sent') {
      if (finalInitialPayment === 0) {
        finalStatus = 'Unpaid';
      } else if (finalInitialPayment === grandTotal) {
        finalStatus = 'Paid';
      } else {
        finalStatus = 'Partially Paid';
      }
    }

    const invoiceData: CreateInvoiceDto = {
      customerId: selectedCustomer,
      dueDate: dueDate || undefined,
      invoicePrefix: '', // Will be set from user profile on backend
      items: items.map(item => ({
        productName: item.productName!,
        quantity: item.quantity!,
        rate: item.rate!,
        gstPercentage: item.gstPercentage!,
      })),
      status: finalStatus,
      initialPayment: finalInitialPayment,
    };

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

  const { totalAmount, grandTotal } = calculateTotals();
  const amountInWords = grandTotal > 0 && !isNaN(grandTotal)
    ? toWords.convert(grandTotal)
    : 'Zero Rupees Only';

  return (
    <>
      <div className="bg-white rounded-lg shadow-md p-4">
        <h2 className="text-xl font-bold mb-4">{isEditMode ? 'Edit Invoice' : 'Create New Invoice'}</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Customer Selection */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-medium text-gray-700">
                Select Customer *
              </label>
              <button
                type="button"
                onClick={() => setShowAddCustomer(true)}
                className="flex items-center text-xs text-blue-600 hover:text-blue-700"
              >
                <UserPlus className="h-3 w-3 mr-1" />
                Add New Customer
              </button>
            </div>
            <select
              value={selectedCustomer}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleCustomerSelection(Number(e.target.value))}
              aria-label="Select customer"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            {selectedCustomer > 0 && (() => {
              const customerObj = customers.find(c => c.id === selectedCustomer);
              if (customerObj && customerObj.totalBalance !== undefined) {
                const balance = customerObj.totalBalance || 0;
                return (
                  <p className="mt-1 text-xs text-gray-500">
                    Balance: ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    {' '}
                    <Link to={`/customers/${selectedCustomer}`} className="text-blue-600 hover:text-blue-700 hover:underline">
                      View customer
                    </Link>
                  </p>
                );
              }
              return null;
            })()}
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDueDate(e.target.value)}
              aria-label="Due date"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Invoice Status Section */}
          <div className="bg-gray-50 p-2 rounded-md">
            <h3 className="text-xs font-medium text-gray-900 mb-1.5">Invoice Status</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1 sm:gap-1.5 mb-1.5">
              <button
                type="button"
                onClick={() => {
                  setPaymentStatus('Draft');
                  setInitialPayment(0);
                }}
                className={`py-1 px-1.5 border rounded text-center transition-colors text-[11px] leading-tight font-semibold ${paymentStatus === 'Draft'
                  ? 'border-gray-500 bg-gray-100 text-gray-900'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
              >
                Draft
              </button>

              <button
                type="button"
                onClick={() => {
                  setPaymentStatus('Sent');
                  setInitialPayment(0);
                }}
                className={`py-1 px-1.5 border rounded text-center transition-colors text-[11px] leading-tight font-semibold ${paymentStatus === 'Sent'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
                  }`}
              >
                Sent
              </button>

              <button
                type="button"
                onClick={() => handlePaymentStatusChange('Unpaid')}
                className={`py-1 px-1.5 border rounded text-center transition-colors text-[11px] leading-tight font-semibold ${paymentStatus === 'Unpaid'
                  ? 'border-red-500 bg-red-50 text-red-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-red-300'
                  }`}
              >
                Unpaid
              </button>

              <button
                type="button"
                onClick={() => handlePaymentStatusChange('Partially Paid')}
                className={`py-1 px-1.5 border rounded text-center transition-colors text-[11px] leading-tight font-semibold ${paymentStatus === 'Partially Paid'
                  ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-yellow-300'
                  }`}
              >
                Partially Paid
              </button>

              <button
                type="button"
                onClick={() => handlePaymentStatusChange('Paid')}
                className={`py-1 px-1.5 border rounded text-center transition-colors text-[11px] leading-tight font-semibold ${paymentStatus === 'Paid'
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-white text-gray-700 hover:border-green-300'
                  }`}
              >
                Paid
              </button>
            </div>

            {/* Initial Payment Input - Show only for Unpaid, Partially Paid, or Paid */}
            {(paymentStatus === 'Partially Paid' || paymentStatus === 'Paid' || paymentStatus === 'Unpaid') && (
              <div className="mt-1.5">
                <label className="block text-[11px] font-medium text-gray-700 mb-0.5">
                  Initial Payment Amount (₹)
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-1.5 flex items-center pointer-events-none">
                    <IndianRupee className="h-3 w-3 text-gray-400" />
                  </div>
                  <input
                    type="number"
                    min="0"
                    max={grandTotal}
                    step="0.01"
                    value={initialPayment}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleInitialPaymentChange(Number(e.target.value))}
                    aria-label="Initial payment amount"
                    className="w-full pl-6 pr-1.5 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={paymentStatus as PaymentStatus !== 'Unpaid'}
                  />
                </div>
                <div className="mt-0.5 text-[11px] text-gray-500">
                  Maximum: ₹{grandTotal.toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {/* Invoice Items */}
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 sm:gap-0 mb-2">
              <h3 className="text-sm font-medium">Invoice Items</h3>
              <div className="flex gap-1.5 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setShowTemplateModal(true)}
                  disabled={selectedCustomer === 0}
                  className={`flex items-center px-2 py-1.5 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={selectedCustomer === 0 ? "Please select a customer first" : "Load or save templates"}
                >
                  <FolderOpen className="h-3 w-3 mr-1.5" />
                  Templates
                </button>
                <button
                  type="button"
                  onClick={addItem}
                  disabled={selectedCustomer === 0}
                  className={`flex items-center px-2 py-1.5 ${themeColors.primary} text-white rounded-md ${themeColors.primaryHover} text-xs disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={selectedCustomer === 0 ? "Please select a customer first" : "Add new item"}
                >
                  <Plus className="h-3 w-3 mr-1.5" />
                  Add Item
                </button>
              </div>
            </div>

            {selectedCustomer === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 mb-2">
                <p className="text-xs text-yellow-800">
                  <strong>Please select a customer first</strong> before adding products to the invoice.
                </p>
              </div>
            )}

            <div className={`space-y-2 ${selectedCustomer === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
              {items.map((item, index) => (
                <div key={index} className="border rounded-md p-2 sm:p-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2 sm:gap-3 items-end">
                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">
                        Product Name *
                      </label>
                      <input
                        type="text"
                        value={item.productName || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(index, 'productName', e.target.value)}
                        disabled={selectedCustomer === 0}
                        aria-label={`Product name ${index + 1}`}
                        className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${focusRing} ${selectedCustomer === 0 ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        required
                      />
                    </div>

                    <div className="sm:col-span-1 lg:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">
                        {disableQuantity ? 'Quantity (Fixed: 1)' : 'Quantity *'}
                      </label>
                      {disableQuantity ? (
                        <input
                          type="number"
                          value="1"
                          disabled
                          aria-label={`Quantity ${index + 1}`}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md bg-gray-100 cursor-not-allowed"
                        />
                      ) : (
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(index, 'quantity', Number(e.target.value))}
                          disabled={selectedCustomer === 0}
                          aria-label={`Quantity ${index + 1}`}
                          className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${focusRing} ${selectedCustomer === 0 ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                          required
                        />
                      )}
                    </div>

                    <div className="sm:col-span-1 lg:col-span-3">
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">
                        Rate (₹) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.rate || ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateItem(index, 'rate', Number(e.target.value))}
                        disabled={selectedCustomer === 0}
                        aria-label={`Rate ${index + 1}`}
                        className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${focusRing} ${selectedCustomer === 0 ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        required
                      />
                    </div>

                    <div className="sm:col-span-1 lg:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-0.5">
                        GST % *
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={item.gstPercentage !== undefined && item.gstPercentage !== null ? item.gstPercentage : ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const value = e.target.value === '' ? undefined : Number(e.target.value);
                          updateItem(index, 'gstPercentage', value !== undefined ? value : 0);
                        }}
                        disabled={selectedCustomer === 0}
                        aria-label={`GST percentage ${index + 1}`}
                        className={`w-full px-2 py-1.5 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 ${focusRing} ${selectedCustomer === 0 ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        required
                      />
                    </div>

                    <div className="sm:col-span-1 lg:col-span-2">
                      <button
                        type="button"
                        onClick={() => removeItem(index)}
                        disabled={selectedCustomer === 0}
                        className="w-full p-1.5 bg-red-600 text-white rounded-md hover:bg-red-700 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Remove item"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Calculated amounts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 mt-2 pt-2 border-t text-xs">
                    <div><span className="font-medium">Amount:</span> ₹{item.amount?.toFixed(2) || '0.00'}</div>
                    <div><span className="font-medium">GST:</span> ₹{item.gstAmount?.toFixed(2) || '0.00'}</div>
                    <div><span className="font-medium">CGST:</span> ₹{item.cgst?.toFixed(2) || '0.00'}</div>
                    <div><span className="font-medium">SGST:</span> ₹{item.sgst?.toFixed(2) || '0.00'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Taxable Amount Details */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <InvoiceFormTaxableDetails
              totalAmount={totalAmount}
              grandTotal={grandTotal}
              amountInWords={amountInWords}
            />
          </div>

          <button
            type="submit"
            disabled={selectedCustomer === 0}
            className="w-full bg-green-600 text-white py-2 px-3 rounded-md hover:bg-green-700 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isEditMode ? 'Update Invoice' : 'Create Invoice'}
          </button>
        </form>
      </div>

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={showAddCustomer}
        onClose={() => setShowAddCustomer(false)}
        onCustomerAdded={handleCustomerAdded}
      />

      {/* Invoice Template Modal */}
      <InvoiceTemplateModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onLoadTemplate={(templateItems: InvoiceTemplateItemDto[]) => {
          // Convert template items to form items
          const formItems = templateItems.map(item => ({
            productName: item.productName,
            quantity: item.quantity,
            rate: item.rate,
            gstPercentage: item.gstPercentage,
          }));
          setItems(formItems);
        }}
        currentItems={items}
      />
    </>
  );
};