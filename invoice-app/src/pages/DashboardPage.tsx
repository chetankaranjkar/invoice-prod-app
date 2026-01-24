import React, { useState, useEffect } from 'react';
import { DashboardStats } from '../components/DashboardStats';
import { InvoicePreview } from '../components/InvoicePreview';
import { api } from '../services/agent';
import type { DashboardStats as DashboardStatsType, Customer, Invoice, PaymentStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import { X, Download, Edit, Trash2, Copy } from 'lucide-react';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { useTheme } from '../contexts/ThemeContext';
import * as XLSX from 'xlsx';

export const DashboardPage: React.FC = () => {
  const { themeColors } = useTheme();
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
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState<number | 'all'>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [showAllInvoices, setShowAllInvoices] = useState<boolean>(false);
  const [showPendingInvoices, setShowPendingInvoices] = useState<boolean>(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingInvoiceDetails, setLoadingInvoiceDetails] = useState(false);
  const [userRole, setUserRole] = useState<string>('User');
  const [businessName, setBusinessName] = useState<string>('');

  useEffect(() => {
    loadDashboardStats();
    loadUserRole();
    loadBusinessName();
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

  const loadDashboardStats = async () => {
    try {
      // Use Promise.allSettled to handle partial failures gracefully
      const [customersResult, invoicesResult] = await Promise.allSettled([
        api.customers.getList(),
        api.invoices.getList(),
      ]);

      // Handle customers response
      if (customersResult.status === 'rejected') {
        const error = customersResult.reason;
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Failed to load customers:', error);
        }
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          throw new Error('Request timed out. Please check your connection and try again.');
        }
        throw new Error('Failed to load customers. Please try again.');
      }

      // Handle invoices response
      if (invoicesResult.status === 'rejected') {
        const error = invoicesResult.reason;
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Failed to load invoices:', error);
        }
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          throw new Error('Request timed out. Please check your connection and try again.');
        }
        throw new Error('Failed to load invoices. Please try again.');
      }

      const customersResponse = customersResult.value;
      const invoicesResponse = invoicesResult.value;

      const customersData = customersResponse.data;
      const invoicesData = invoicesResponse.data;

      setCustomers(customersData);
      setAllInvoices(invoicesData);

      // Calculate total pending amount from ALL invoices' balanceAmount
      const totalPendingAmount = invoicesData.reduce((sum, invoice) => sum + invoice.balanceAmount, 0);

      // Calculate customer counts based on their invoice balances
      const customerBalanceMap = new Map<number, number>();

      // Sum up balance amounts for each customer
      invoicesData.forEach(invoice => {
        const currentBalance = customerBalanceMap.get(invoice.customerId) || 0;
        customerBalanceMap.set(invoice.customerId, currentBalance + invoice.balanceAmount);
      });

      // Count paid and unpaid customers
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
        totalCustomers: customersData.length,
        paidCustomersCount,
        unpaidCustomersCount,
        recentInvoices: invoicesData.slice(0, 5), // Show 5 most recent invoices
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

  const handleViewPending = () => {
    setShowPendingInvoices(true);
    setShowAllInvoices(true); // Show all invoices view
    setSelectedStatusFilter('all'); // Reset status filter
    setSelectedCustomerFilter('all'); // Reset customer filter
    // Scroll to invoices section
    setTimeout(() => {
      const invoicesSection = document.getElementById('invoices-section');
      if (invoicesSection) {
        invoicesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

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

  // Apply filters
  const getFilteredInvoices = () => {
    let filtered = showAllInvoices ? allInvoices : getCurrentMonthInvoices();

    // Filter pending invoices (balanceAmount > 0) when showPendingInvoices is true
    if (showPendingInvoices) {
      filtered = filtered.filter(inv => inv.balanceAmount > 0);
    }

    // Filter by customer
    if (selectedCustomerFilter !== 'all') {
      filtered = filtered.filter(inv => inv.customerId === selectedCustomerFilter);
    }

    // Filter by status
    if (selectedStatusFilter !== 'all') {
      filtered = filtered.filter(inv => inv.status === selectedStatusFilter);
    }

    return filtered;
  };

  const filteredInvoices = getFilteredInvoices();

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
        const invoiceDate = new Date(invoice.invoiceDate);
        const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;

        // If invoice has items, create a row for each item
        if (invoice.items && invoice.items.length > 0) {
          invoice.items.forEach((item) => {
            excelData.push({
              'S.No': rowIndex++,
              'Invoice Number': invoice.invoiceNumber,
              'Invoice Date': invoiceDate.toLocaleDateString('en-GB'),
              'Due Date': dueDate ? dueDate.toLocaleDateString('en-GB') : '',
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
            'Invoice Date': invoiceDate.toLocaleDateString('en-GB'),
            'Due Date': dueDate ? dueDate.toLocaleDateString('en-GB') : '',
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
        const invoiceDate = new Date(invoice.invoiceDate);
        const dueDate = invoice.dueDate ? new Date(invoice.dueDate) : null;

        // If invoice has items, create a row for each item
        if (invoice.items && invoice.items.length > 0) {
          invoice.items.forEach((item) => {
            excelData.push({
              'S.No': rowIndex++,
              'Invoice Number': invoice.invoiceNumber,
              'Invoice Date': invoiceDate.toLocaleDateString('en-GB'),
              'Due Date': dueDate ? dueDate.toLocaleDateString('en-GB') : '',
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
            'Invoice Date': invoiceDate.toLocaleDateString('en-GB'),
            'Due Date': dueDate ? dueDate.toLocaleDateString('en-GB') : '',
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
      alert(`Failed to duplicate invoice: ${error.response?.data?.message || 'Please try again.'}`);
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
      alert(`Failed to delete invoice: ${error.response?.data?.message || 'Please try again.'}`);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-4 sm:mb-6 md:mb-8">
          {businessName ? (
            <>
              <span className="hidden sm:inline">{businessName} </span>
              <span className="sm:hidden">{businessName.length > 15 ? businessName.substring(0, 15) + '...' : businessName}</span>
              Dashboard
            </>
          ) : (
            'Dashboard'
          )}
        </h1>

        <DashboardStats
          stats={stats}
          onViewPaid={handleViewPaid}
          onViewUnpaid={handleViewUnpaid}
          onViewPending={handleViewPending}
        />

        {/* Year-based Excel Export Section */}
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 mt-4 sm:mt-6 md:mt-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="w-full sm:w-auto">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900">Export Invoices by Year</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Download all invoices for a specific year in Excel format</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full sm:w-auto">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="px-3 sm:px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-900 text-sm sm:text-base"
                title="Select year"
                aria-label="Select year for export"
              >
                {getAvailableYears().length > 0 ? (
                  getAvailableYears().map(year => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))
                ) : (
                  <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                )}
              </select>
              <button
                onClick={handleExportToExcelByYear}
                className={`flex items-center justify-center gap-2 px-4 sm:px-6 py-2 ${themeColors.success} ${themeColors.successHover} text-white rounded-md transition-colors font-medium text-sm sm:text-base`}
                title={`Export invoices for year ${selectedYear} to Excel`}
                aria-label={`Export invoices for year ${selectedYear} to Excel`}
              >
                <Download className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">Download Excel</span>
                <span className="sm:hidden">Download</span>
              </button>
            </div>
          </div>
        </div>

        {/* Current Month Invoices Section */}
        <div id="invoices-section" className="bg-white rounded-lg shadow-md p-4 sm:p-6 mt-4 sm:mt-6 md:mt-8 scroll-mt-8">
            <div className="flex flex-col gap-4 mb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <h2 className="text-xl font-bold">
                  {showPendingInvoices
                    ? 'Pending Invoices'
                    : showAllInvoices
                      ? 'All Invoices'
                      : 'Current Month Invoices'}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {showPendingInvoices && (
                    <button
                      onClick={() => {
                        setShowPendingInvoices(false);
                        setShowAllInvoices(false);
                      }}
                      className="px-4 py-2 rounded-md text-sm font-medium bg-gray-200 text-gray-700 hover:bg-gray-300"
                    >
                      Clear Filter
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowAllInvoices(!showAllInvoices);
                      setShowPendingInvoices(false);
                    }}
                    className={`px-3 py-1 text-sm rounded-md transition-colors ${showAllInvoices
                      ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    title={showAllInvoices ? 'Show only current month invoices' : 'Show all invoices'}
                  >
                    {showAllInvoices ? 'Show Current Month' : 'Show All'}
                  </button>
                </div>
              </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
              {/* Export to Excel Button */}
              <button
                onClick={handleExportToExcel}
                className={`flex items-center justify-center gap-2 px-4 py-2 ${themeColors.success} ${themeColors.successHover} text-white rounded-md transition-colors text-sm sm:text-base`}
                title="Export all invoices to Excel"
                aria-label="Export all invoices to Excel"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Export to Excel</span>
                <span className="sm:hidden">Export</span>
              </button>

              {/* Customer Filter */}
              <select
                value={selectedCustomerFilter}
                onChange={(e) => setSelectedCustomerFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                className="px-3 sm:px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                title="Filter by customer"
                aria-label="Filter invoices by customer"
              >
                <option value="all">All Customers</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customerName}
                  </option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value as PaymentStatus | 'all')}
                className="px-3 sm:px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm sm:text-base"
                title="Filter by payment status"
                aria-label="Filter invoices by payment status"
              >
                <option value="all">All Status</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Unpaid">Unpaid</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
              </select>
            </div>
          </div>
          {filteredInvoices.length > 0 ? (
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                      Customer
                    </th>
                    {(userRole === 'MasterUser' || userRole === 'Admin') && (
                      <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                        User
                      </th>
                    )}
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                      Date
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                      Balance
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-3 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td
                        className="px-3 sm:px-6 py-4 text-sm font-medium text-blue-600 hover:text-blue-800 cursor-pointer"
                        onClick={() => handleViewInvoice(invoice)}
                      >
                        <div className="flex flex-col">
                          <span className="whitespace-nowrap">{invoice.invoiceNumber}</span>
                          <span className="text-xs text-gray-500 sm:hidden mt-1">{invoice.customerName}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">
                        {invoice.customerName}
                      </td>
                      {(userRole === 'MasterUser' || userRole === 'Admin') && (
                        <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                          {invoice.userName || '-'}
                        </td>
                      )}
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden lg:table-cell">
                        {new Date(invoice.invoiceDate).toLocaleDateString()}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        ₹{invoice.grandTotal.toLocaleString()}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 hidden md:table-cell">
                        ₹{invoice.balanceAmount.toLocaleString()}
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          invoice.status === 'Paid'
                            ? 'bg-green-100 text-green-800'
                            : invoice.status === 'Partially Paid'
                            ? 'bg-yellow-100 text-yellow-800'
                            : invoice.status === 'Sent'
                            ? 'bg-blue-100 text-blue-800'
                            : invoice.status === 'Draft'
                            ? 'bg-gray-100 text-gray-800'
                            : 'bg-red-100 text-red-800'
                          }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-3 sm:px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex items-center gap-1 sm:gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/invoices/edit/${invoice.id}`);
                            }}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50"
                            title="Edit Invoice"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateInvoice(invoice.id);
                            }}
                            className="text-green-600 hover:text-green-900 p-1 rounded hover:bg-green-50"
                            title="Duplicate Invoice"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteInvoice(invoice.id, invoice.invoiceNumber);
                            }}
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
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
            </div>
          ) : (
            <p className="text-gray-500 text-center py-4">No invoices found</p>
          )}
        </div>
      </div>

      {/* Invoice Preview Modal */}
      {selectedInvoice && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl relative my-4 sm:my-8 max-h-[95vh] overflow-y-auto">
            <button
              onClick={() => {
                setSelectedInvoice(null);
                setSelectedCustomer(null);
              }}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 z-10 bg-white rounded-full p-2 shadow-md"
              title="Close"
              aria-label="Close invoice preview"
            >
              <X className="h-5 w-5" />
            </button>
            {loadingInvoiceDetails ? (
              <div className="p-6 flex items-center justify-center min-h-[400px]">
                <LoadingSpinner />
              </div>
            ) : (
              <div className="p-6">
                <InvoicePreview
                  customer={selectedCustomer}
                  items={selectedInvoice.items || []}
                  dueDate={selectedInvoice.dueDate || ''}
                  invoiceNumber={selectedInvoice.invoiceNumber}
                  paymentStatus={selectedInvoice.status}
                  initialPayment={selectedInvoice.paidAmount}
                  waveAmount={selectedInvoice.waveAmount || 0}
                  payments={selectedInvoice.payments || []}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};