import React, { useState, useEffect } from 'react';
import { InvoiceForm } from '../components/InvoiceForm';
import { InvoicePreview } from '../components/InvoicePreview';
import { DynamicInvoiceRenderer } from '../components/invoice-layout/DynamicInvoiceRenderer';
import TaxInvoice from '../components/static-invoice/TaxInvoice';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/agent';
import type { Customer, CreateInvoiceDto, InvoiceItem, PaymentStatus, InvoiceLayoutConfigDto } from '../types';
import { calculateGST, generateInvoiceNumber } from '../utils/helpers';

export const InvoiceCreationPage: React.FC = () => {
  const { profile, loadProfile } = useAuth();
  const userRole = profile?.role || 'User';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Unpaid');
  const [initialPayment, setInitialPayment] = useState<number>(0);
  const [invoiceNumber, setInvoiceNumber] = useState('INV00001');
  const [layoutConfigs, setLayoutConfigs] = useState<InvoiceLayoutConfigDto[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>('static');

  const [items, setItems] = useState<Partial<InvoiceItem>[]>([
    { productName: '', quantity: 1, rate: 0, gstPercentage: 18 },
  ]);

  useEffect(() => {
    if (profile?.defaultGstPercentage !== undefined && profile?.defaultGstPercentage !== null) {
      setItems(prev => prev.length ? [{ ...prev[0], gstPercentage: profile.defaultGstPercentage ?? 18 }] : [{ productName: '', quantity: 1, rate: 0, gstPercentage: profile.defaultGstPercentage ?? 18 }]);
    }
  }, [profile?.defaultGstPercentage]);

  useEffect(() => {
    if (userRole !== 'MasterUser') {
      loadCustomers();
    }
  }, [userRole]);

  useEffect(() => {
    loadInvoiceLayouts();
  }, []);

  const loadCustomers = async () => {
    try {
      const response = await api.customers.getList();
      setCustomers(response.data);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const loadInvoiceLayouts = async () => {
    try {
      const response = await api.invoiceLayouts.getList();
      const layouts = response.data || [];
      setLayoutConfigs(layouts);
      const defaultLayout = layouts.find((layout: InvoiceLayoutConfigDto) => layout.isDefault);
      if (defaultLayout) {
        setSelectedLayoutId(String(defaultLayout.id));
      }
    } catch (error) {
      console.error('Failed to load invoice layouts:', error);
    }
  };

  const handleInvoiceCreate = async (invoiceData: CreateInvoiceDto) => {
    try {
      await api.invoices.create(invoiceData);
      alert('Invoice created successfully!');

      // Clear all form data except selected customer
      setInvoiceItems([]);
      const refreshed = await loadProfile();
      const defaultGst = refreshed?.defaultGstPercentage ?? 18;
      setItems([{ productName: '', quantity: 1, rate: 0, gstPercentage: defaultGst }]);
      setDueDate('');
      setPaymentStatus('Unpaid');
      setInitialPayment(0);
      await generateNextInvoiceNumber();
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
      let p = profile;
      if (!p?.invoicePrefix) p = await loadProfile();
      const invoicePrefix = p?.invoicePrefix || 'INV';

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

  const selectedLayout = layoutConfigs.find((layout) => String(layout.id) === selectedLayoutId);
  const resolvedLayoutConfig = (() => {
    if (selectedLayout?.config?.sections) {
      return selectedLayout.config;
    }
    if (selectedLayout?.configJson) {
      try {
        return JSON.parse(selectedLayout.configJson);
      } catch {
        return null;
      }
    }
    return null;
  })();
  const hasVisibleSections = Boolean(
    resolvedLayoutConfig?.sections?.some((section: any) => section.visible !== false)
  );

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-3 md:p-4">
      <div className="max-w-8xl mx-auto">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4 md:mb-6">Create Invoice</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
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
              <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                <label className="text-xs font-medium text-gray-700">Invoice Format</label>
                <select
                  value={selectedLayoutId}
                  onChange={(e) => setSelectedLayoutId(e.target.value)}
                  aria-label="Select invoice layout"
                  className="border rounded-md px-2 py-1 text-xs"
                >
                  <option value="classic">Classic (Current)</option>
                  <option value="static">Static Invoice</option>
                  {layoutConfigs.map((layout) => (
                    <option key={layout.id} value={String(layout.id)}>
                      {layout.name} {layout.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {!hasVisibleSections && selectedLayoutId !== 'classic' && (
                <div className="mb-1.5 rounded-md bg-yellow-50 border border-yellow-200 px-2 py-1.5 text-xs text-yellow-800">
                  Selected layout has no visible sections. Please edit the layout or enable sections.
                </div>
              )}
              {selectedLayoutId === 'static' ? (
                <TaxInvoice
                  customer={selectedCustomer}
                  items={invoiceItems}
                  dueDate={dueDate}
                  invoiceNumber={invoiceNumber}
                  paymentStatus={paymentStatus}
                  initialPayment={initialPayment}
                />
              ) : selectedLayoutId === 'classic' || !selectedLayout || !hasVisibleSections ? (
                <InvoicePreview
                  customer={selectedCustomer}
                  items={invoiceItems}
                  dueDate={dueDate}
                  invoiceNumber={invoiceNumber}
                  paymentStatus={paymentStatus}
                  initialPayment={initialPayment}
                />
              ) : (
                <DynamicInvoiceRenderer
                  layout={resolvedLayoutConfig}
                  customer={selectedCustomer}
                  items={invoiceItems}
                  dueDate={dueDate}
                  invoiceNumber={invoiceNumber}
                  paymentStatus={paymentStatus}
                  initialPayment={initialPayment}
                />
              )}
            </div>
          )}
          {!selectedCustomer && (
            <div className='lg:col-span-2 flex items-center justify-center bg-white rounded-lg shadow-md p-6'>
              <div className="text-center text-gray-500">
                <p className="text-base font-medium">Please select a customer to see the invoice preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};