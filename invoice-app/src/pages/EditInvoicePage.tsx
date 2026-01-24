import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { InvoiceForm } from '../components/InvoiceForm';
import { InvoicePreview } from '../components/InvoicePreview';
import { api } from '../services/agent';
import type { Customer, UpdateInvoiceDto, InvoiceItem, PaymentStatus, Invoice } from '../types';
import { calculateGST } from '../utils/helpers';

export const EditInvoicePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [dueDate, setDueDate] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Unpaid');
  const [initialPayment, setInitialPayment] = useState<number>(0);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [userRole, setUserRole] = useState<string>('User');
  const [invoice, setInvoice] = useState<Invoice | null>(null);

  const [items, setItems] = useState<Partial<InvoiceItem>[]>([]);

  useEffect(() => {
    loadUserRole();
    loadInvoice();
  }, [id]);

  useEffect(() => {
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

  const loadInvoice = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const response = await api.invoices.getById(parseInt(id));
      const invoiceData = response.data;

      setInvoice(invoiceData);
      setInvoiceNumber(invoiceData.invoiceNumber);
      setDueDate(invoiceData.dueDate ? new Date(invoiceData.dueDate).toISOString().split('T')[0] : '');
      setPaymentStatus(invoiceData.status as PaymentStatus);
      setInitialPayment(invoiceData.paidAmount || 0);

      // Find and set customer
      const customer = customers.find(c => c.id === invoiceData.customerId);
      if (customer) {
        setSelectedCustomer(customer);
      } else {
        // Load customer if not in list
        try {
          const customerResponse = await api.customers.getById(invoiceData.customerId);
          setSelectedCustomer(customerResponse.data);
        } catch (error) {
          console.error('Failed to load customer:', error);
        }
      }

      // Convert invoice items to form format
      const formItems: Partial<InvoiceItem>[] = invoiceData.items.map((item: any) => ({
        productName: item.productName,
        quantity: item.quantity,
        rate: item.rate,
        gstPercentage: item.gstPercentage,
      }));

      setItems(formItems);
      setInvoiceItems(invoiceData.items || []);
    } catch (error: any) {
      console.error('Failed to load invoice:', error);
      alert(`Failed to load invoice: ${error.response?.data?.message || 'Please try again.'}`);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (customers.length > 0 && invoice) {
      const customer = customers.find(c => c.id === invoice.customerId);
      if (customer) {
        setSelectedCustomer(customer);
      }
    }
  }, [customers, invoice]);

  const handleInvoiceUpdate = async (invoiceData: UpdateInvoiceDto) => {
    if (!id) return;

    try {
      await api.invoices.update(parseInt(id), invoiceData);
      alert('Invoice updated successfully!');
      navigate('/dashboard');
    } catch (error: any) {
      console.error('Failed to update invoice:', error);
      alert(`Failed to update invoice: ${error.response?.data?.message || 'Please try again.'}`);
    }
  };

  const handleCustomerAdded = async (customer: Customer) => {
    setCustomers(prev => [...prev, customer]);
    setSelectedCustomer(customer);
  };

  const handleSelectedCustomer = async (customerId: number) => {
    const customer = customers.find(c => c.id === customerId) || null;
    setSelectedCustomer(customer);
  };

  // Update preview items whenever items state changes
  useEffect(() => {
    const previewItems: InvoiceItem[] = items
      .filter(item => item.productName && item.quantity && item.rate)
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

  // MasterUser cannot edit invoices
  if (userRole === 'MasterUser') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-8xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Restricted</h1>
            <p className="text-gray-600 mb-4">
              MasterUser cannot edit invoices.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-8xl mx-auto">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 md:mb-8">
          <span className="hidden sm:inline">Edit Invoice - </span>
          <span className="sm:hidden">Edit - </span>
          {invoiceNumber}
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          {/* Left Side - Invoice Form */}
          <div className='lg:col-span-1'>
            <InvoiceForm
              customers={customers}
              onInvoiceCreate={handleInvoiceUpdate}
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
              isEditMode={true}
              initialCustomerId={invoice?.customerId}
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
