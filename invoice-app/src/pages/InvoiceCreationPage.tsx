import React, { useState, useEffect } from 'react';
import { InvoiceForm } from '../components/InvoiceForm';
import { InvoicePreview } from '../components/InvoicePreview';
import { api } from '../services/agent';
import type { Customer, CreateInvoiceDto, InvoiceItem, PaymentStatus } from '../types';
import { calculateGST, generateInvoiceNumber } from '../utils/helpers';

export const InvoiceCreationPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Unpaid');
  const [initialPayment, setInitialPayment] = useState<number>(0);
  const [invoiceNumber, setInvoiceNumber] = useState('INV00001');
  const [userRole, setUserRole] = useState<string>('User');

  const [items, setItems] = useState<Partial<InvoiceItem>[]>([
    { productName: '', quantity: 1, rate: 0, gstPercentage: 18 },
  ]);

  useEffect(() => {
    const loadDefaultGst = async () => {
      try {
        const response = await api.user.getProfile();
        if (response.data.defaultGstPercentage !== undefined && response.data.defaultGstPercentage !== null) {
          const defaultGst = response.data.defaultGstPercentage;
          // Update initial item with default GST
          setItems([{ productName: '', quantity: 1, rate: 0, gstPercentage: defaultGst }]);
        }
      } catch (error) {
        console.error('Failed to load default GST:', error);
      }
    };
    loadDefaultGst();
  }, []);

  useEffect(() => {
    loadUserRole();
    if (userRole !== 'MasterUser') {
      loadCustomers();
    }
  }, [userRole]);

  const loadUserRole = async () => {
    try {
      const response = await api.user.getProfile();
      setUserRole(response.data.role || 'User');
    } catch (error) {
      console.error('Failed to load user role:', error);
    }
  };

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
      await api.invoices.create(invoiceData);
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

  const handleCustomerAdded = async (customer: Customer) => {
    setCustomers(prev => [...prev, customer]);
    setSelectedCustomer(customer);
    // Generate invoice number when customer is added
    await generateNextInvoiceNumber();
  };

  const handleSelectedCustomer = async (id: number) => {
    const customer = customers.find(c => c.id === id) || null;
    setSelectedCustomer(customer);

    // Generate invoice number when customer is selected
    if (customer) {
      await generateNextInvoiceNumber();
    }
  };

  const generateNextInvoiceNumber = async () => {
    try {
      // Get user profile to get invoice prefix
      const profileResponse = await api.user.getProfile();
      const invoicePrefix = profileResponse.data.invoicePrefix || 'INV';

      // Get all invoices to find the latest one
      const invoicesResponse = await api.invoices.getList();
      const invoices = invoicesResponse.data || [];

      // Find the latest invoice with the same prefix
      const invoicesWithPrefix = invoices
        .filter((inv: any) => inv.invoiceNumber && inv.invoiceNumber.startsWith(invoicePrefix))
        .sort((a: any, b: any) => {
          // Extract number part and sort
          const numA = parseInt(a.invoiceNumber.replace(invoicePrefix, '')) || 0;
          const numB = parseInt(b.invoiceNumber.replace(invoicePrefix, '')) || 0;
          return numB - numA;
        });

      let nextNumber = 1;
      if (invoicesWithPrefix.length > 0) {
        const latestInvoice = invoicesWithPrefix[0];
        const lastNumberStr = latestInvoice.invoiceNumber.replace(invoicePrefix, '');
        const lastNumber = parseInt(lastNumberStr) || 0;
        nextNumber = lastNumber + 1;
      }

      // Generate new invoice number
      const newInvoiceNumber = generateInvoiceNumber(invoicePrefix, nextNumber);
      setInvoiceNumber(newInvoiceNumber);
    } catch (error) {
      console.error('Failed to generate invoice number:', error);
      // Fallback to default
      setInvoiceNumber('INV00001');
    }
  };

  // Update preview items whenever items state changes
  useEffect(() => {
    const previewItems: InvoiceItem[] = items
      .filter(item => item.productName && item.quantity && item.rate) // Only include valid items
      .map((item, index) => {
        const quantity = Number(item.quantity) || 0;
        const rate = Number(item.rate) || 0;
        const gstPercentage = Number(item.gstPercentage) || 0;
        const amount = quantity * rate;
        const { gstAmount, cgst, sgst } = calculateGST(amount, gstPercentage);

        return {
          id: index,
          productName: item.productName!,
          quantity: quantity,
          rate: rate,
          amount: amount,
          gstPercentage: gstPercentage,
          gstAmount: gstAmount,
          cgst: cgst,
          sgst: sgst,
        };
      });

    setInvoiceItems(previewItems);
  }, [items]);

  // MasterUser cannot create invoices
  if (userRole === 'MasterUser') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-8xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Restricted</h1>
            <p className="text-gray-600 mb-4">
              MasterUser cannot create invoices. Only Admin and User roles can create invoices.
            </p>
            <p className="text-gray-500 text-sm">
              MasterUser can only manage Admin users through User Management.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-8xl mx-auto">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 md:mb-8">Create Invoice</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          {/* Left Side - Invoice Form */}
          <div className='lg:col-span-1'>
            <InvoiceForm
              customers={customers}
              onInvoiceCreate={handleInvoiceCreate}
              onCustomerAdded={handleCustomerAdded}
              handleSelectedCustomer={handleSelectedCustomer}
              items={items}
              setItems={setItems}
              dueDate={dueDate}
              setDueDate={setDueDate}
              paymentStatus={paymentStatus}
              setPaymentStatus={setPaymentStatus}
              initialPayment={initialPayment}
              setInitialPayment={setInitialPayment}
            />
          </div>

          {/* Right Side - Invoice Preview */}
          {selectedCustomer && (
            <div className='lg:col-span-2'>
              <InvoicePreview
                customer={selectedCustomer}
                items={invoiceItems}
                dueDate={dueDate}
                invoiceNumber={invoiceNumber}
                paymentStatus={paymentStatus}
                initialPayment={initialPayment}
              />
            </div>
          )}
          {!selectedCustomer && (
            <div className='lg:col-span-2 flex items-center justify-center bg-white rounded-lg shadow-md p-8'>
              <div className="text-center text-gray-500">
                <p className="text-lg font-medium">Please select a customer to see the invoice preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};