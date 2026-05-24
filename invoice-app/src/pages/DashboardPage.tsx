import React, { useState, useEffect } from 'react';
import { DashboardStats } from '../components/DashboardStats';
import { InvoicePreview } from '../components/InvoicePreview';
import { DynamicInvoiceRenderer } from '../components/invoice-layout/DynamicInvoiceRenderer';
import TaxInvoice from '../components/static-invoice/TaxInvoice';
import TaxInvoiceV2 from '../components/static-invoice-v2/TaxInvoice';
import { api } from '../services/agent';
import type { DashboardStats as DashboardStatsType, Customer, Invoice, PaymentStatus, InvoiceLayoutConfigDto } from '../types';
import { useNavigate } from 'react-router-dom';
import { X, Download, Edit, Trash2, Copy, Printer, DollarSign, ArrowUpDown, ArrowUp, ArrowDown, FileText as FileTextIcon } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { InvoiceStatusBadge } from '../components/ui/Badge';
import { sellerInfoToCompanyInfo, formatCurrency, getApiErrorMessage } from '../utils/helpers';
import { useDateFormat } from '../hooks/useDateFormat';
import { AddPaymentModal } from '../components/AddPaymentModal';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import { buildHtml2CanvasOnClone } from '../utils/pdfCapture';
import jsPDF from 'jspdf';

export const DashboardPage: React.FC = () => {
  const formatDate = useDateFormat();
  const [stats, setStats] = useState<DashboardStatsType>({
    totalPendingAmount: 0,
    totalCustomers: 0,
    paidCustomersCount: 0,
    unpaidCustomersCount: 0,
    recentInvoices: [],
  });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  /** Type or pick a customer name; partial text filters within the date scope; exact full-name match shows all invoices for that customer */
  const [invoiceCustomerFilter, setInvoiceCustomerFilter] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showAllInvoices, setShowAllInvoices] = useState<boolean>(false);
  const [showPendingInvoices, setShowPendingInvoices] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingInvoiceDetails, setLoadingInvoiceDetails] = useState(false);
  const [userRole, setUserRole] = useState<string>('User');
  const [businessName, setBusinessName] = useState<string>('');
  const [layoutConfigs, setLayoutConfigs] = useState<InvoiceLayoutConfigDto[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>('static');
  const [showPendingByUserModal, setShowPendingByUserModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'date' | 'invoiceNumber' | 'customer' | 'amount' | 'balance'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const previewRef = React.useRef<HTMLDivElement>(null);

  const PAGE_SIZE = 10;

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortOrder(column === 'date' || column === 'amount' || column === 'balance' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  };

  const SortIcon = ({ column }: { column: typeof sortBy }) => {
    if (sortBy !== column) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-50" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5 ml-1" /> : <ArrowDown className="h-3.5 w-3.5 ml-1" />;
  };

  useEffect(() => {
    loadDashboardStats();
    loadUserRole();
    loadBusinessName();
    loadInvoiceLayouts();
  }, []);

  // Update selected year when invoices are loaded
  useEffect(() => {
    if (allInvoices.length > 0) {
      const years = new Set<number>();
      allInvoices.forEach(invoice => {
        const invoiceDate = new Date(invoice.invoiceDate);
        years.add(invoiceDate.getFullYear());
      });
      const availableYears = Array.from(years).sort((a, b) => b - a);
      if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
        setSelectedYear(availableYears[0]); // Set to most recent year
      }
    }
  }, [allInvoices, selectedYear]);

  const loadUserRole = async () => {
    try {
      const response = await api.user.getProfile();
      setUserRole(response.data.role || 'User');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load user role:', error);
      }
    }
  };

  const loadBusinessName = async () => {
    try {
      const response = await api.user.getProfile();
      setBusinessName(response.data.businessName || '');
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load business name:', error);
      }
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
      if (process.env.NODE_ENV === 'development') {
        console.error('Failed to load invoice layouts:', error);
      }
    }
  };

  const loadDashboardStats = async () => {
    try {
      // Use Promise.allSettled to handle partial failures gracefully
      const [profileResult, customersResult, invoicesResult] = await Promise.allSettled([
        api.user.getProfile(),
        api.customers.getList(),
        api.invoices.getList(),
      ]);

      // Extract data - handle both direct array and wrapped { data: [...] } responses
      const unwrapData = (res: any): any[] => {
        const d = res?.data;
        return Array.isArray(d) ? d : (Array.isArray(d?.data) ? d.data : []);
      };

      let customersData: Customer[] = [];
      let invoicesData: Invoice[] = [];

        if (customersResult.status === 'rejected') {
          const err = customersResult.reason;
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ Failed to load customers:', err?.response?.status, err?.message, err);
          }
        } else {
          customersData = unwrapData(customersResult.value) as Customer[];
        }

        if (invoicesResult.status === 'rejected') {
          const err = invoicesResult.reason;
          if (process.env.NODE_ENV === 'development') {
            console.error('❌ Failed to load invoices:', err?.response?.status, err?.message, err);
          }
          // If both fail, show a helpful error
          if (customersResult.status === 'rejected') {
            const customersErr = customersResult.reason;
            let msg = getApiErrorMessage(
              err ?? customersErr,
              'Failed to load dashboard. Ensure the API is running and try again.'
            );
            if (!err?.response && !customersErr?.response && import.meta.env.DEV) {
              msg +=
                ' Also start the UI: run "npm run dev" in the invoice-app folder, then open http://localhost:3000 (API: http://localhost:5001).';
            }
            throw new Error(msg);
          }
        } else {
          invoicesData = unwrapData(invoicesResult.value) as Invoice[];
        }

      // Remove duplicate invoices by id (keep first occurrence)
      const uniqueInvoices = Array.from(new Map(invoicesData.map(inv => [inv.id, inv])).values());

      setCustomers(customersData);
      setAllInvoices(uniqueInvoices);

      // Calculate total pending amount from ALL invoices' balanceAmount
      const totalPendingAmount = uniqueInvoices.reduce((sum, invoice) => sum + (invoice.balanceAmount ?? 0), 0);

      // Admin only: calculate admin's own pending amount (invoices created by admin)
      let adminOwnPendingAmount: number | undefined;
      if (profileResult.status === 'fulfilled' && profileResult.value?.data?.role === 'Admin') {
        const currentUserId = profileResult.value?.data?.id;
        adminOwnPendingAmount = uniqueInvoices
          .filter((inv) => String(inv.userId) === String(currentUserId))
          .reduce((sum, inv) => sum + (inv.balanceAmount ?? 0), 0);
      }

      // Calculate customer counts based on their invoice balances
      const customerBalanceMap = new Map<number, number>();

      uniqueInvoices.forEach(invoice => {
        const currentBalance = customerBalanceMap.get(invoice.customerId) || 0;
        customerBalanceMap.set(invoice.customerId, currentBalance + (invoice.balanceAmount ?? 0));
      });

      let paidCustomersCount = 0;
      let unpaidCustomersCount = 0;

      customersData.forEach(customer => {
        const customerTotalBalance = customerBalanceMap.get(customer.id) || 0;
        if (customerTotalBalance > 0) {
          unpaidCustomersCount++;
        } else {
          paidCustomersCount++;
        }
      });

      setStats({
        totalPendingAmount,
        adminOwnPendingAmount,
        totalCustomers: customersData.length,
        paidCustomersCount,
        unpaidCustomersCount,
        recentInvoices: uniqueInvoices.slice(0, 5),
      });
    } catch (error: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to load dashboard stats:', error);
      }

      // Show user-friendly error message
      const errorMessage = error?.message || 'Failed to load dashboard data. Please refresh the page.';
      alert(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPaid = () => {
    navigate('/customers/paid');
  };

  const handleViewUnpaid = () => {
    navigate('/customers/unpaid');
  };

  const handleViewAllCustomers = () => {
    navigate('/customers');
  };

  const handleViewPending = () => {
    setShowPendingInvoices(true);
    setShowAllInvoices(true); // Show all invoices view
    setSelectedStatusFilter('all'); // Reset status filter
    setInvoiceCustomerFilter(''); // Reset customer filter
    // Scroll to invoices section
    setTimeout(() => {
      const invoicesSection = document.getElementById('invoices-section');
      if (invoicesSection) {
        invoicesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  const handleViewPendingByUser = () => {
    setShowPendingByUserModal(true);
  };

  // Group pending amount by user (for the popup)
  const pendingByUser = React.useMemo(() => {
    const map = new Map<string, { userName: string; amount: number }>();
    allInvoices.forEach((inv) => {
      const uid = inv.userId ?? 'unknown';
      const name = inv.userName ?? 'Unknown';
      const balance = inv.balanceAmount ?? 0;
      const existing = map.get(uid);
      if (existing) {
        existing.amount += balance;
      } else {
        map.set(uid, { userName: name, amount: balance });
      }
    });
    return Array.from(map.entries())
      .map(([userId, { userName, amount }]) => ({ userId, userName, amount }))
      .filter((r) => r.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [allInvoices]);

  // Filter invoices for current month
  const getCurrentMonthInvoices = () => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return allInvoices.filter(invoice => {
      try {
        // Parse invoice date - handle both ISO strings and date objects
        let invoiceDate: Date;
        if (typeof invoice.invoiceDate === 'string') {
          // If it's a string, parse it and use local timezone
          invoiceDate = new Date(invoice.invoiceDate);
          // If the date string includes time, we need to ensure we're comparing dates correctly
          // Create a new date using year, month to avoid timezone issues
          const invoiceYear = invoiceDate.getFullYear();
          const invoiceMonth = invoiceDate.getMonth();

          // Compare year and month only (ignore day and time)
          return invoiceMonth === currentMonth && invoiceYear === currentYear;
        } else {
          invoiceDate = new Date(invoice.invoiceDate);
          return invoiceDate.getMonth() === currentMonth && invoiceDate.getFullYear() === currentYear;
        }
      } catch (error) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Error parsing invoice date:', invoice.invoiceDate, error);
        }
        return false;
      }
    });
  };

  const trimmedCustomerInvoice = invoiceCustomerFilter.trim();
  const invoiceFilterExactCustomer = trimmedCustomerInvoice
    ? customers.find(
        (c) =>
          c.customerName.trim().toLowerCase() === trimmedCustomerInvoice.toLowerCase(),
      )
    : undefined;

  // Apply filters
  const getFilteredInvoices = () => {
    // Exact full-name match (e.g. from datalist pick): same as old single-customer dropdown — all invoices for that customer.
    const useAllInvoices = showAllInvoices || !!invoiceFilterExactCustomer;
    let filtered = useAllInvoices ? allInvoices : getCurrentMonthInvoices();

    // Filter pending invoices (balanceAmount > 0) when showPendingInvoices is true
    if (showPendingInvoices) {
      filtered = filtered.filter(inv => inv.balanceAmount > 0);
    }

    // Filter by customer name (typed substring, or exact id match via full name)
    if (invoiceFilterExactCustomer) {
      filtered = filtered.filter((inv) => inv.customerId === invoiceFilterExactCustomer.id);
    } else if (trimmedCustomerInvoice) {
      const q = trimmedCustomerInvoice.toLowerCase();
      filtered = filtered.filter((inv) =>
        String(inv.customerName ?? '').toLowerCase().includes(q)
      );
    }

    // Filter by status
    if (selectedStatusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === selectedStatusFilter);
    }

    return filtered;
  };

  const filteredInvoices = getFilteredInvoices();

  // Sort
  const sortedInvoices = React.useMemo(() => {
    const arr = [...filteredInvoices];
    const mult = sortOrder === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return mult * (new Date(a.invoiceDate).getTime() - new Date(b.invoiceDate).getTime());
        case 'invoiceNumber':
          return mult * String(a.invoiceNumber).localeCompare(String(b.invoiceNumber));
        case 'customer':
          return mult * String(a.customerName || '').localeCompare(String(b.customerName || ''));
        case 'amount':
          return mult * ((a.grandTotal ?? 0) - (b.grandTotal ?? 0));
        case 'balance':
          return mult * ((a.balanceAmount ?? 0) - (b.balanceAmount ?? 0));
        default:
          return 0;
      }
    });
    return arr;
  }, [filteredInvoices, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedInvoices.length / PAGE_SIZE));
  const paginatedInvoices = sortedInvoices.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [invoiceCustomerFilter, selectedStatusFilter, showAllInvoices, showPendingInvoices]);

  // Get available years from invoices
  const getAvailableYears = (): number[] => {
    const years = new Set<number>();
    allInvoices.forEach(invoice => {
      const invoiceDate = new Date(invoice.invoiceDate);
      years.add(invoiceDate.getFullYear());
    });
    return Array.from(years).sort((a, b) => b - a); // Sort descending (newest first)
  };

  // Export all invoices to Excel with all items
  const handleExportToExcel = () => {
    try {
      if (allInvoices.length === 0) {
        alert('No invoices to export.');
        return;
      }

      // Prepare data for Excel export - one row per invoice item
      const excelData: any[] = [];
      let rowIndex = 1;

      allInvoices.forEach((invoice) => {
        // If invoice has items, create a row for each item
        if (invoice.items && invoice.items.length > 0) {
          invoice.items.forEach((item) => {
            excelData.push({
              'S.No': rowIndex++,
              'Invoice Number': invoice.invoiceNumber,
              'Invoice Date': formatDate(invoice.invoiceDate),
              'Due Date': invoice.dueDate ? formatDate(invoice.dueDate) : '',
              'Customer Name': invoice.customerName || '',
              'User': invoice.userName || '',
              'Product Name': item.productName || '',
              'Quantity': item.quantity || 0,
              'Rate': item.rate || 0,
              'Item Amount': item.amount || 0,
              'GST %': item.gstPercentage || 0,
              'Item CGST': item.cgst || 0,
              'Item SGST': item.sgst || 0,
              'Item GST Amount': item.gstAmount || 0,
              'Invoice Total Amount': invoice.totalAmount || 0,
              'Invoice CGST': invoice.cgst || 0,
              'Invoice SGST': invoice.sgst || 0,
              'Invoice Total GST': invoice.gstAmount || 0,
              'Grand Total': invoice.grandTotal || 0,
              'Paid Amount': invoice.paidAmount || 0,
              'Waved Amount': invoice.waveAmount || 0,
              'Balance Amount': invoice.balanceAmount || 0,
              'Status': invoice.status || 'Unpaid',
            });
          });
        } else {
          // If invoice has no items, still create one row with invoice data
          excelData.push({
            'S.No': rowIndex++,
            'Invoice Number': invoice.invoiceNumber,
            'Invoice Date': formatDate(invoice.invoiceDate),
            'Due Date': invoice.dueDate ? formatDate(invoice.dueDate) : '',
            'Customer Name': invoice.customerName || '',
            'User': invoice.userName || '',
            'Product Name': '',
            'Quantity': 0,
            'Rate': 0,
            'Item Amount': 0,
            'GST %': 0,
            'Item CGST': 0,
            'Item SGST': 0,
            'Item GST Amount': 0,
            'Invoice Total Amount': invoice.totalAmount || 0,
            'Invoice CGST': invoice.cgst || 0,
            'Invoice SGST': invoice.sgst || 0,
            'Invoice Total GST': invoice.gstAmount || 0,
            'Grand Total': invoice.grandTotal || 0,
            'Paid Amount': invoice.paidAmount || 0,
            'Waved Amount': invoice.waveAmount || 0,
            'Balance Amount': invoice.balanceAmount || 0,
            'Status': invoice.status || 'Unpaid',
          });
        }
      });

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Invoices');

      // Auto-size columns
      const maxWidth = 25;
      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
        wch: Math.min(Math.max(key.length, (excelData[0] as any)[key]?.toString().length || 0), maxWidth)
      }));
      ws['!cols'] = colWidths;

      // Generate filename with current date
      const fileName = `All_Invoices_With_Items_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Write and download
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error exporting to Excel:', error);
      }
      alert('Failed to export invoices to Excel. Please try again.');
    }
  };

  // Export invoices by selected year to Excel with all items
  const handleExportToExcelByYear = () => {
    try {
      // Filter invoices by selected year
      const yearInvoices = allInvoices.filter(invoice => {
        const invoiceDate = new Date(invoice.invoiceDate);
        return invoiceDate.getFullYear() === selectedYear;
      });

      if (yearInvoices.length === 0) {
        alert(`No invoices found for year ${selectedYear}.`);
        return;
      }

      // Prepare data for Excel export - one row per invoice item
      const excelData: any[] = [];
      let rowIndex = 1;

      yearInvoices.forEach((invoice) => {
        // If invoice has items, create a row for each item
        if (invoice.items && invoice.items.length > 0) {
          invoice.items.forEach((item) => {
            excelData.push({
              'S.No': rowIndex++,
              'Invoice Number': invoice.invoiceNumber,
              'Invoice Date': formatDate(invoice.invoiceDate),
              'Due Date': invoice.dueDate ? formatDate(invoice.dueDate) : '',
              'Customer Name': invoice.customerName || '',
              'User': invoice.userName || '',
              'Product Name': item.productName || '',
              'Quantity': item.quantity || 0,
              'Rate': item.rate || 0,
              'Item Amount': item.amount || 0,
              'GST %': item.gstPercentage || 0,
              'Item CGST': item.cgst || 0,
              'Item SGST': item.sgst || 0,
              'Item GST Amount': item.gstAmount || 0,
              'Invoice Total Amount': invoice.totalAmount || 0,
              'Invoice CGST': invoice.cgst || 0,
              'Invoice SGST': invoice.sgst || 0,
              'Invoice Total GST': invoice.gstAmount || 0,
              'Grand Total': invoice.grandTotal || 0,
              'Paid Amount': invoice.paidAmount || 0,
              'Waved Amount': invoice.waveAmount || 0,
              'Balance Amount': invoice.balanceAmount || 0,
              'Status': invoice.status || 'Unpaid',
            });
          });
        } else {
          // If invoice has no items, still create one row with invoice data
          excelData.push({
            'S.No': rowIndex++,
            'Invoice Number': invoice.invoiceNumber,
            'Invoice Date': formatDate(invoice.invoiceDate),
            'Due Date': invoice.dueDate ? formatDate(invoice.dueDate) : '',
            'Customer Name': invoice.customerName || '',
            'User': invoice.userName || '',
            'Product Name': '',
            'Quantity': 0,
            'Rate': 0,
            'Item Amount': 0,
            'GST %': 0,
            'Item CGST': 0,
            'Item SGST': 0,
            'Item GST Amount': 0,
            'Invoice Total Amount': invoice.totalAmount || 0,
            'Invoice CGST': invoice.cgst || 0,
            'Invoice SGST': invoice.sgst || 0,
            'Invoice Total GST': invoice.gstAmount || 0,
            'Grand Total': invoice.grandTotal || 0,
            'Paid Amount': invoice.paidAmount || 0,
            'Waved Amount': invoice.waveAmount || 0,
            'Balance Amount': invoice.balanceAmount || 0,
            'Status': invoice.status || 'Unpaid',
          });
        }
      });

      // Create workbook and worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Invoices');

      // Auto-size columns
      const maxWidth = 25;
      const colWidths = Object.keys(excelData[0] || {}).map(key => ({
        wch: Math.min(Math.max(key.length, (excelData[0] as any)[key]?.toString().length || 0), maxWidth)
      }));
      ws['!cols'] = colWidths;

      // Generate filename with year
      const fileName = `Invoices_${selectedYear}_With_Items_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Write and download
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Failed to export invoices to Excel. Please try again.');
    }
  };

  // Handle duplicate invoice
  const handleDuplicateInvoice = async (invoiceId: number) => {
    if (!window.confirm('Are you sure you want to duplicate this invoice?')) {
      return;
    }

    try {
      await api.invoices.duplicate(invoiceId);
      alert('Invoice duplicated successfully!');
      // Reload invoices
      await loadDashboardStats();
    } catch (error: any) {
      console.error('Failed to duplicate invoice:', error);
      alert(`Failed to duplicate invoice: ${getApiErrorMessage(error, 'Please try again.')}`);
    }
  };

  // Handle delete invoice
  const handleDeleteInvoice = async (invoiceId: number, invoiceNumber: string) => {
    if (!window.confirm(`Are you sure you want to delete invoice ${invoiceNumber}? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.invoices.delete(invoiceId);
      alert('Invoice deleted successfully!');
      // Reload invoices
      await loadDashboardStats();
    } catch (error: any) {
      console.error('Failed to delete invoice:', error);
      alert(`Failed to delete invoice: ${getApiErrorMessage(error, 'Please try again.')}`);
    }
  };

  // Add payment to invoice
  const handleAddPaymentClick = (invoice: Invoice) => {
    setSelectedInvoiceForPayment(invoice);
    setShowPaymentModal(true);
  };

  const handleConfirmPayment = async (paymentData: {
    amountPaid: number;
    paymentMode: string;
    wave: number;
    remarks: string;
  }) => {
    if (!selectedInvoiceForPayment) return;

    try {
      await api.invoices.addPayment(selectedInvoiceForPayment.id, {
        amountPaid: paymentData.amountPaid,
        waveAmount: paymentData.wave,
        paymentMode: paymentData.paymentMode,
        remarks: paymentData.remarks || 'Added from dashboard',
      });

      alert('Payment added successfully!');
      await loadDashboardStats();
      setShowPaymentModal(false);
      setSelectedInvoiceForPayment(null);
    } catch (err: any) {
      console.error('Failed to add payment:', err);
      alert(`Error adding payment: ${getApiErrorMessage(err, 'Please try again.')}`);
      throw err;
    }
  };

  // Handle invoice click to show preview
  const handleViewInvoice = async (invoice: Invoice) => {
    try {
      setLoadingInvoiceDetails(true);

      // Fetch full invoice details
      const invoiceResponse = await api.invoices.getById(invoice.id);
      const fullInvoice = invoiceResponse.data;

      // Find customer from the customers list
      let customer = customers.find(c => c.id === invoice.customerId);

      if (!customer) {
        // If customer not found in list, try to fetch it
        try {
          const customerResponse = await api.customers.getById(invoice.customerId);
          customer = customerResponse.data;
        } catch (error: any) {
          // If customer fetch fails (404 - customer belongs to different user),
          // create a minimal customer object from invoice data
          if (error?.response?.status === 404 || error?.response?.status === 403) {
            // Create customer object from invoice data
            customer = {
              id: invoice.customerId,
              customerName: invoice.customerName || 'Unknown Customer',
              billingAddress: '',
              city: '',
              state: '',
              zip: '',
              gstNumber: '',
              email: '',
              phone: '',
            } as Customer;

            if (process.env.NODE_ENV === 'development') {
              console.warn('Customer not accessible, using invoice data:', customer);
            }
          } else {
            // For other errors, show alert
            if (process.env.NODE_ENV === 'development') {
              console.error('Error loading customer:', error);
            }
            alert('Failed to load customer details. Showing invoice with limited customer information.');
            // Still create minimal customer object
            customer = {
              id: invoice.customerId,
              customerName: invoice.customerName || 'Unknown Customer',
              billingAddress: '',
              city: '',
              state: '',
              zip: '',
              gstNumber: '',
              email: '',
              phone: '',
            } as Customer;
          }
        }
      }

      if (customer) {
        setSelectedInvoice(fullInvoice);
        setSelectedCustomer(customer);
        setSelectedLayoutId('static');
      } else {
        alert('Unable to load customer information for this invoice.');
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading invoice details:', error);
      }
      alert('Failed to load invoice details');
    } finally {
      setLoadingInvoiceDetails(false);
    }
  };

  const handlePrintInvoice = () => {
    if (!previewRef.current) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups to print the invoice');
      return;
    }

    const previewClone = previewRef.current.cloneNode(true) as HTMLElement;
    const styles = Array.from(document.styleSheets)
      .map(sheet => {
        try {
          return Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n');
        } catch {
          return '';
        }
      })
      .join('\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice</title>
          <style>
            ${styles.replace(/oklch\([^)]+\)/gi, 'rgb(128, 128, 128)').replace(/oslch\([^)]+\)/gi, 'rgb(128, 128, 128)').replace(/oklab\([^)]+\)/gi, 'rgb(128, 128, 128)')}
            @media print {
              @page { margin: 10mm; size: A4; }
              body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: white; }
          </style>
        </head>
        <body>
          ${previewClone.outerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
      setTimeout(() => printWindow.close(), 1000);
    }, 300);
  };

  const handleDownloadPdf = async () => {
    if (!previewRef.current) return;

    const previewEl = previewRef.current;
    previewEl.classList.add('pdf-export');

    try {
      const canvas = await html2canvas(previewEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: buildHtml2CanvasOnClone(previewEl, (clonedDoc) => {
          const pdfRoot = clonedDoc.querySelector('[data-pdf-root="true"]') as HTMLElement | null;
          const fontTarget = pdfRoot ?? clonedDoc.body;
          if (fontTarget) {
            fontTarget.style.fontSize = '1.15em';
            fontTarget.style.lineHeight = '1.3';
          }
        }),
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pdfWidth = 210;
      const pdfHeight = 297;
      const margin = 10;
      const contentWidth = pdfWidth - margin * 2;
      const contentHeight = pdfHeight - margin * 2;

      const ratio = canvas.width / canvas.height;
      let finalWidth = contentWidth;
      let finalHeight = contentWidth / ratio;

      if (finalHeight <= contentHeight) {
        pdf.addImage(imgData, 'PNG', margin, margin, finalWidth, finalHeight);
      } else {
        const totalPages = Math.ceil(finalHeight / contentHeight);
        const imgHeightPerPage = canvas.height / totalPages;
        const pdfHeightPerPage = finalHeight / totalPages;
        for (let i = 0; i < totalPages; i++) {
          if (i > 0) pdf.addPage();
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = canvas.width;
          pageCanvas.height = imgHeightPerPage;
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(
              canvas,
              0, i * imgHeightPerPage, canvas.width, imgHeightPerPage,
              0, 0, canvas.width, imgHeightPerPage
            );
            const pageImg = pageCanvas.toDataURL('image/png');
            pdf.addImage(pageImg, 'PNG', margin, margin, finalWidth, pdfHeightPerPage);
          }
        }
      }

      const fileName = `Invoice_${selectedInvoice?.invoiceNumber || 'preview'}_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
    } catch (error: any) {
      alert(`Failed to generate PDF: ${error?.message || 'Unknown error'}`);
    } finally {
      previewEl.classList.remove('pdf-export');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full border-[3px] border-slate-200 border-t-indigo-500 animate-spin" />
          <p className="text-sm text-slate-500">Loading dashboard…</p>
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
    <div className="min-h-screen">
      <div className="max-w-[1400px] mx-auto">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {businessName ? `${businessName.length > 30 ? businessName.substring(0, 30) + '…' : businessName} Dashboard` : 'Dashboard'}
            </h1>
            <p className="page-subtitle">Overview of customers, invoices and outstanding receivables.</p>
          </div>
          {userRole !== 'MasterUser' && (
            <button
              onClick={() => navigate('/invoices')}
              className="ui-btn-primary self-start sm:self-auto"
            >
              <FileTextIcon className="h-4 w-4" /> Create Invoice
            </button>
          )}
        </div>

        <DashboardStats
          stats={stats}
          userRole={userRole}
          onViewPaid={handleViewPaid}
          onViewUnpaid={handleViewUnpaid}
          onViewPending={handleViewPending}
          onViewPendingByUser={handleViewPendingByUser}
          onViewAllCustomers={handleViewAllCustomers}
        />

        {/* Pending Amount by User Modal */}
        {showPendingByUserModal && (
          <div className="ui-modal-backdrop">
            <div className="ui-modal max-w-md">
              <div className="ui-modal-header">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Pending Amount by User</h2>
                  <p className="text-xs text-slate-500 mt-0.5">Outstanding receivables grouped by team member</p>
                </div>
                <button
                  onClick={() => setShowPendingByUserModal(false)}
                  className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                  title="Close"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="ui-modal-body max-h-80">
                {pendingByUser.length === 0 ? (
                  <p className="text-slate-500 text-center py-6 text-sm">No pending amounts.</p>
                ) : (
                  <table className="ui-table">
                    <thead>
                      <tr><th>User</th><th className="text-right">Pending</th></tr>
                    </thead>
                    <tbody>
                      {pendingByUser.map((row) => (
                        <tr key={row.userId}>
                          <td className="font-medium text-slate-900">{row.userName}</td>
                          <td className="text-right font-semibold text-red-600">{formatCurrency(row.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              <div className="ui-modal-footer flex-col items-stretch gap-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="font-medium text-slate-600">Total outstanding</span>
                  <span className="font-bold text-slate-900 text-base">{formatCurrency(stats.totalPendingAmount)}</span>
                </div>
                <button
                  onClick={() => {
                    setShowPendingByUserModal(false);
                    handleViewPending();
                  }}
                  className="ui-btn-primary w-full"
                >
                  View Pending Invoices
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Year-based Excel Export Section */}
        <div className="ui-card p-5 sm:p-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Export Invoices by Year</h2>
              <p className="text-xs text-slate-500 mt-0.5">Download all invoices for a specific year in Excel format</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center w-full sm:w-auto">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="ui-select min-w-[120px]"
                title="Select year"
                aria-label="Select year for export"
              >
                {getAvailableYears().length > 0 ? (
                  getAvailableYears().map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))
                ) : (
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                )}
              </select>
              <button
                onClick={handleExportToExcelByYear}
                className="ui-btn-success"
                title={`Export invoices for year ${selectedYear} to Excel`}
                aria-label={`Export invoices for year ${selectedYear} to Excel`}
              >
                <Download className="h-4 w-4" />
                <span>Download Excel</span>
              </button>
            </div>
          </div>
        </div>

        {/* Current Month Invoices Section */}
        <div id="invoices-section" className="ui-card overflow-hidden scroll-mt-8">
          <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-base font-semibold text-slate-900">
                  {showPendingInvoices
                    ? 'Pending Invoices'
                    : invoiceFilterExactCustomer
                      ? `Invoices · ${invoiceFilterExactCustomer.customerName}`
                      : trimmedCustomerInvoice
                        ? showAllInvoices
                          ? `All invoices · “${trimmedCustomerInvoice}”`
                          : `Current month · “${trimmedCustomerInvoice}”`
                        : showAllInvoices
                          ? 'All Invoices'
                          : 'Current Month Invoices'}
                </h2>
                <span className="ui-badge-neutral">{sortedInvoices.length}</span>
                {showPendingInvoices && (
                  <button
                    onClick={() => { setShowPendingInvoices(false); setShowAllInvoices(false); }}
                    className="ui-btn-ghost ui-btn-sm"
                  >
                    Clear filter
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <button
                  onClick={() => { setShowAllInvoices(!showAllInvoices); setShowPendingInvoices(false); }}
                  className={showAllInvoices ? 'ui-btn-primary ui-btn-sm' : 'ui-btn-secondary ui-btn-sm'}
                  title={showAllInvoices ? 'Show only current month invoices' : 'Show all invoices'}
                >
                  {showAllInvoices ? 'Showing all' : 'Show all'}
                </button>
                <button
                  onClick={handleExportToExcel}
                  className="ui-btn-success ui-btn-sm"
                  title="Export all invoices to Excel"
                  aria-label="Export all invoices to Excel"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Export</span>
                </button>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 flex-wrap items-stretch">
              <div className="flex flex-col gap-1 min-w-0 sm:max-w-[min(100%,280px)]">
                <label htmlFor="dash-invoice-customer-filter" className="sr-only">
                  Filter by customer name
                </label>
                <input
                  id="dash-invoice-customer-filter"
                  type="text"
                  list="dashboard-invoice-customer-names"
                  value={invoiceCustomerFilter}
                  onChange={(e) => setInvoiceCustomerFilter(e.target.value)}
                  placeholder="All customers — type or choose"
                  className="ui-select w-full min-w-0"
                  autoComplete="off"
                  title="Filters the invoice list. Partial name: current scope only. Exact full customer name from list: all invoices for that customer."
                  aria-label="Filter invoices by customer name"
                />
                <datalist id="dashboard-invoice-customer-names">
                  {customers.map((c) => (
                    <option key={c.id} value={c.customerName} />
                  ))}
                </datalist>
                <p className="text-[11px] text-slate-500 leading-snug px-0.5">
                  Type part of a name to filter below, or pick a full customer from suggestions to load all invoices for them.
                </p>
              </div>
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value as PaymentStatus | 'all')}
                className="ui-select sm:max-w-[200px]"
                title="Filter by payment status"
                aria-label="Filter invoices by payment status"
              >
                <option value="all">All status</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>
          {filteredInvoices.length > 0 ? (
            <>
              <div className="overflow-x-auto">
                <table className="ui-table">
                  <thead>
                    <tr>
                      <th>
                        <button onClick={() => handleSort('invoiceNumber')} className="flex items-center gap-1 hover:text-slate-700 focus:outline-none uppercase">
                          Invoice # <SortIcon column="invoiceNumber" />
                        </button>
                      </th>
                      <th className="hidden sm:table-cell">
                        <button onClick={() => handleSort('customer')} className="flex items-center gap-1 hover:text-slate-700 focus:outline-none uppercase">
                          Customer <SortIcon column="customer" />
                        </button>
                      </th>
                      {(userRole === 'MasterUser' || userRole === 'Admin') && (
                        <th className="hidden md:table-cell uppercase">User</th>
                      )}
                      <th className="hidden lg:table-cell">
                        <button onClick={() => handleSort('date')} className="flex items-center gap-1 hover:text-slate-700 focus:outline-none uppercase">
                          Date <SortIcon column="date" />
                        </button>
                      </th>
                      <th>
                        <button onClick={() => handleSort('amount')} className="flex items-center gap-1 hover:text-slate-700 focus:outline-none uppercase">
                          Amount <SortIcon column="amount" />
                        </button>
                      </th>
                      <th className="hidden md:table-cell">
                        <button onClick={() => handleSort('balance')} className="flex items-center gap-1 hover:text-slate-700 focus:outline-none uppercase">
                          Balance <SortIcon column="balance" />
                        </button>
                      </th>
                      <th className="uppercase">Status</th>
                      <th className="text-right uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedInvoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td
                          className="cursor-pointer"
                          onClick={() => handleViewInvoice(invoice)}
                        >
                          <div className="flex flex-col">
                            <span className="font-semibold text-indigo-600 hover:text-indigo-700 whitespace-nowrap">{invoice.invoiceNumber}</span>
                            <span className="text-xs text-slate-500 sm:hidden mt-0.5">{invoice.customerName}</span>
                          </div>
                        </td>
                        <td className="hidden sm:table-cell whitespace-nowrap">{invoice.customerName}</td>
                        {(userRole === 'MasterUser' || userRole === 'Admin') && (
                          <td className="hidden md:table-cell whitespace-nowrap text-slate-500">{invoice.userName || '—'}</td>
                        )}
                        <td className="hidden lg:table-cell whitespace-nowrap text-slate-500">{formatDate(invoice.invoiceDate)}</td>
                        <td className="font-semibold text-slate-900 whitespace-nowrap">₹{invoice.grandTotal.toLocaleString()}</td>
                        <td className="hidden md:table-cell whitespace-nowrap">
                          <span className={invoice.balanceAmount > 0 ? 'text-red-600 font-medium' : 'text-slate-500'}>
                            ₹{invoice.balanceAmount.toLocaleString()}
                          </span>
                        </td>
                        <td><InvoiceStatusBadge status={invoice.status} /></td>
                        <td className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            {invoice.balanceAmount > 0 && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleAddPaymentClick(invoice); }}
                                className="p-1.5 rounded-md text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
                                title="Add Payment"
                              >
                                <DollarSign className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/invoices/edit/${invoice.id}`); }}
                              className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                              title="Edit Invoice"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDuplicateInvoice(invoice.id); }}
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                              title="Duplicate Invoice"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteInvoice(invoice.id, invoice.invoiceNumber); }}
                              className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Delete Invoice"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 px-5 sm:px-6 py-3 border-t border-slate-100 bg-slate-50/40">
                  <p className="text-sm text-slate-500">
                    Showing <span className="font-medium text-slate-700">{(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, sortedInvoices.length)}</span> of <span className="font-medium text-slate-700">{sortedInvoices.length}</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="ui-btn-secondary ui-btn-sm"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-500 px-2">Page {currentPage} of {totalPages}</span>
                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="ui-btn-secondary ui-btn-sm"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
              <FileTextIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No invoices found</p>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {selectedInvoice && selectedCustomer && (
        <div className="ui-modal-backdrop overflow-y-auto py-6">
          <div className="ui-modal max-w-6xl relative">
            <div className="ui-modal-header">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Invoice {selectedInvoice.invoiceNumber}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedCustomer.customerName}</p>
              </div>
              <button
                onClick={() => { setSelectedInvoice(null); setSelectedCustomer(null); }}
                className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                title="Close"
                aria-label="Close invoice preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {loadingInvoiceDetails ? (
              <div className="p-12 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="ui-modal-body">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <label className="text-sm font-medium text-slate-700 mr-1">Format:</label>
                    <select
                      value={selectedLayoutId}
                      onChange={(e) => setSelectedLayoutId(e.target.value)}
                      aria-label="Select invoice layout"
                      className="ui-select max-w-[260px]"
                    >
                      <option value="classic">Classic (Current)</option>
                      <option value="static-v2">Static Invoice (Modern)</option>
                      <option value="static">Static Invoice (Classic)</option>
                      {layoutConfigs.map((layout) => (
                        <option key={layout.id} value={String(layout.id)}>
                          {layout.name} {layout.isDefault ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handlePrintInvoice} className="ui-btn-secondary ui-btn-sm">
                      <Printer className="h-4 w-4" />
                      Print
                    </button>
                    <button onClick={handleDownloadPdf} className="ui-btn-success ui-btn-sm">
                      <Download className="h-4 w-4" />
                      Download PDF
                    </button>
                  </div>
                </div>
                <div ref={previewRef} data-pdf-root="true">
                  {selectedLayoutId === 'static' ? (
                    <TaxInvoice
                      customer={selectedCustomer}
                      items={selectedInvoice.items || []}
                      invoiceDate={selectedInvoice.invoiceDate ? new Date(selectedInvoice.invoiceDate).toISOString().split('T')[0] : ''}
                      invoiceNumber={selectedInvoice.invoiceNumber}
                      paymentStatus={selectedInvoice.status}
                      initialPayment={selectedInvoice.paidAmount}
                      waveAmount={selectedInvoice.waveAmount || 0}
                      payments={selectedInvoice.payments || []}
                      companyInfo={selectedInvoice.sellerInfo ? sellerInfoToCompanyInfo(selectedInvoice.sellerInfo) : undefined}
                    />
                  ) : selectedLayoutId === 'static-v2' ? (
                    <TaxInvoiceV2
                      customer={selectedCustomer}
                      items={selectedInvoice.items || []}
                      invoiceDate={selectedInvoice.invoiceDate ? new Date(selectedInvoice.invoiceDate).toISOString().split('T')[0] : ''}
                      invoiceNumber={selectedInvoice.invoiceNumber}
                      paymentStatus={selectedInvoice.status}
                      initialPayment={selectedInvoice.paidAmount}
                      waveAmount={selectedInvoice.waveAmount || 0}
                      payments={selectedInvoice.payments || []}
                      companyInfo={selectedInvoice.sellerInfo ? sellerInfoToCompanyInfo(selectedInvoice.sellerInfo) : undefined}
                    />
                  ) : selectedLayoutId === 'classic' || !selectedLayout || !hasVisibleSections ? (
                    <InvoicePreview
                      customer={selectedCustomer}
                      items={selectedInvoice.items || []}
                      invoiceDate={selectedInvoice.invoiceDate ? new Date(selectedInvoice.invoiceDate).toISOString().split('T')[0] : ''}
                      invoiceNumber={selectedInvoice.invoiceNumber}
                      paymentStatus={selectedInvoice.status}
                      initialPayment={selectedInvoice.paidAmount}
                      waveAmount={selectedInvoice.waveAmount || 0}
                      payments={selectedInvoice.payments || []}
                      companyInfo={selectedInvoice.sellerInfo ? sellerInfoToCompanyInfo(selectedInvoice.sellerInfo) : undefined}
                    />
                  ) : (
                    <DynamicInvoiceRenderer
                      layout={resolvedLayoutConfig}
                      customer={selectedCustomer}
                      items={selectedInvoice.items || []}
                      invoiceDate={selectedInvoice.invoiceDate ? new Date(selectedInvoice.invoiceDate).toISOString().split('T')[0] : ''}
                      invoiceNumber={selectedInvoice.invoiceNumber}
                      paymentStatus={selectedInvoice.status}
                      initialPayment={selectedInvoice.paidAmount}
                      waveAmount={selectedInvoice.waveAmount || 0}
                      payments={selectedInvoice.payments || []}
                      companyInfo={selectedInvoice.sellerInfo ? sellerInfoToCompanyInfo(selectedInvoice.sellerInfo) : undefined}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Payment Modal */}
      {showPaymentModal && selectedInvoiceForPayment && (
        <AddPaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedInvoiceForPayment(null);
          }}
          onConfirm={handleConfirmPayment}
          invoiceNumber={selectedInvoiceForPayment.invoiceNumber}
          balanceAmount={selectedInvoiceForPayment.balanceAmount}
        />
      )}
    </div>
  );
};