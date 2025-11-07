import React, { useState, useEffect } from 'react';
import { InvoiceForm } from '../components/InvoiceForm';
import { InvoicePreview } from '../components/InvoicePreview';
import { api } from '../services/agent';
import type { Customer, CreateInvoiceDto, InvoiceItem, PaymentStatus } from '../types';

export const InvoiceCreationPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Unpaid'); // Use PaymentStatus type
  const [initialPayment, setInitialPayment] = useState<number>(0);
  const [invoiceNumber, setInvoiceNumber] = useState('INV00001');

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const response = await api.customers.getList();
      setCustomers(response.data);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const handleInvoiceCreate = async (invoiceData: CreateInvoiceDto) => {
    try {
      console.log('Creating invoice with data:', invoiceData);
      const response = await api.invoices.create(invoiceData);
      console.log('Invoice created:', response.data);
      alert('Invoice created successfully!');

      // Reset form
      setInvoiceItems([]);
      setDueDate('');
      setPaymentStatus('Unpaid');
      setInitialPayment(0);
    } catch (error: any) {
      console.error('Failed to create invoice:', error);
      alert(`Failed to create invoice: ${error.response?.data?.message || 'Please try again.'}`);
    }
  };

  const handleCustomerAdded = (customer: Customer) => {
    setCustomers(prev => [...prev, customer]);
    setSelectedCustomer(customer);
  };

  // Update preview when form data changes
  const updatePreview = (data: any) => {
    setSelectedCustomer(customers.find(c => c.id === data.customerId) || null);
    setDueDate(data.dueDate || '');
    setPaymentStatus(data.status || 'Unpaid');
    setInitialPayment(data.initialPayment || 0);

    // Convert form items to InvoiceItem format for preview
    const previewItems: InvoiceItem[] = data.items.map((item: any, index: number) => ({
      id: index,
      productName: item.productName,
      quantity: item.quantity,
      rate: item.rate,
      amount: item.quantity * item.rate,
      gstPercentage: item.gstPercentage,
      gstAmount: (item.quantity * item.rate * item.gstPercentage) / 100,
      cgst: (item.quantity * item.rate * item.gstPercentage) / 200,
      sgst: (item.quantity * item.rate * item.gstPercentage) / 200,
    }));

    setInvoiceItems(previewItems);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Create Invoice</h1>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Left Side - Invoice Form */}
          <div>
            <InvoiceForm
              customers={customers}
              onInvoiceCreate={handleInvoiceCreate}
              onCustomerAdded={handleCustomerAdded}
            />
          </div>

          {/* Right Side - Invoice Preview */}
          <div>
            <InvoicePreview
              customer={selectedCustomer}
              items={invoiceItems}
              dueDate={dueDate}
              invoiceNumber={invoiceNumber}
              paymentStatus={paymentStatus}
              initialPayment={initialPayment}
            />
          </div>
        </div>
      </div>
    </div>
  );
};