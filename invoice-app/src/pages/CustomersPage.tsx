import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Users, IndianRupee, Phone, Mail, UserPlus, X, Edit, Eye, Upload, Download, Printer } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { api } from '../services/agent';
import type { Customer, Invoice, CreateCustomerDto, InvoiceLayoutConfigDto } from '../types';
import { formatCurrency } from '../utils/helpers';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorAlert } from '../components/ErrorAlert';
import { AddCustomerModal } from '../components/AddCustomerModal';
import { EditCustomerModal } from '../components/EditCustomerModal';
import { InvoicePreview } from '../components/InvoicePreview';
import { DynamicInvoiceRenderer } from '../components/invoice-layout/DynamicInvoiceRenderer';
import TaxInvoice from '../components/static-invoice/TaxInvoice';
import { AddPaymentModal } from '../components/AddPaymentModal';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface CustomersPageProps {
  filter?: 'all' | 'paid' | 'unpaid';
}

export const CustomersPage: React.FC<CustomersPageProps> = ({ filter = 'all' }) => {
  const { customerId: customerIdParam } = useParams<{ customerId?: string }>();
  const { themeColors } = useTheme();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [userRole, setUserRole] = useState<string>('User');

  // 🆕 New: Track selected customer for invoice/payment modal
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerInvoices, setCustomerInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loadingInvoiceDetails, setLoadingInvoiceDetails] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [layoutConfigs, setLayoutConfigs] = useState<InvoiceLayoutConfigDto[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>('static');
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadData();
    loadUserRole();
    loadInvoiceLayouts();
  }, []);

  const loadUserRole = async () => {
    try {
      const response = await api.user.getProfile();
      setUserRole(response.data.role || 'User');
    } catch (error) {
      console.error('Failed to load user role:', error);
    }
  };

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

  const handleEditCustomer = (customer: Customer, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click event
    setEditingCustomer(customer);
    setShowEditCustomer(true);
  };

  const handleCustomerUpdated = (updatedCustomer: Customer) => {
    setCustomers(prev =>
      prev.map(c => (c.id === updatedCustomer.id ? updatedCustomer : c))
    );
    setShowEditCustomer(false);
    setEditingCustomer(null);
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
      if (process.env.NODE_ENV === 'development') {
        console.error('Error loading customer invoices:', error);
      }
    } finally {
      setLoadingInvoices(false);
    }
  };

  // When navigating to /customers/:customerId, open that customer's panel once data is loaded
  useEffect(() => {
    if (!customerIdParam || customers.length === 0) return;
    if (customerIdParam === 'paid' || customerIdParam === 'unpaid') return;
    const id = Number(customerIdParam);
    if (!Number.isInteger(id)) return;
    const customer = customers.find((c) => c.id === id);
    if (customer) handleViewInvoices(customer);
  }, [customers, customerIdParam]);

  // 🆕 Load full invoice details for preview
  const handleViewInvoice = async (invoiceId: number) => {
    try {
      setLoadingInvoiceDetails(true);
      const response = await api.invoices.getById(invoiceId);
      setSelectedInvoice(response.data);
      setSelectedLayoutId('static');
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

    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          const styleTags = Array.from(clonedDoc.querySelectorAll('style'));
          styleTags.forEach((tag) => {
            if (tag.textContent) {
              tag.textContent = tag.textContent
                .replace(/oklch\([^)]+\)/gi, 'rgb(128, 128, 128)')
                .replace(/oklab\([^)]+\)/gi, 'rgb(128, 128, 128)')
                .replace(/oslch\([^)]+\)/gi, 'rgb(128, 128, 128)');
            }
          });
          const pdfRoot = clonedDoc.querySelector('[data-pdf-root="true"]') as HTMLElement | null;
          const fontTarget = pdfRoot ?? clonedDoc.body;
          if (fontTarget) {
            fontTarget.style.fontSize = '1.15em';
            fontTarget.style.lineHeight = '1.3';
          }
        },
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
    }
  };

  // 🆕 Add payment to a specific invoice
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
      // Send wave amount separately to the backend
      await api.invoices.addPayment(selectedInvoiceForPayment.id, {
        amountPaid: paymentData.amountPaid,
        waveAmount: paymentData.wave,
        paymentMode: paymentData.paymentMode,
        remarks: paymentData.remarks || 'Added from customers page',
      });

      alert('✅ Payment added successfully!');
      await handleViewInvoices(selectedCustomer!);
      await loadData(); // refresh customer balances
      setShowPaymentModal(false);
      setSelectedInvoiceForPayment(null);
    } catch (err: any) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to add payment:', err);
      }
      alert(`Error adding payment: ${err.response?.data?.message || 'Please try again.'}`);
      throw err; // Re-throw to let modal handle it
    }
  };

  // Download Excel Template
  const handleDownloadTemplate = () => {
    // Create template data with headers and sample rows
    const templateData = [
      {
        'Company Name': 'ABC Corporation',
        'Email': 'abc@example.com',
        'Phone': '1234567890',
        'GST Number': '27ABCDE1234F1Z5',
        'PAN Number': 'ABCDE1234F',
        'Billing Address': '123 Business Street, City',
        'City': 'Mumbai',
        'State': 'Maharashtra',
        'Zip': '400001',
        'Bank Name': 'State Bank of India',
        'Bank Account No': '12345678901',
        'IFSC Code': 'SBIN0001234'
      },
      {
        'Company Name': 'XYZ Limited',
        'Email': 'xyz@example.com',
        'Phone': '9876543210',
        'GST Number': '29XYZAB5678G2H6',
        'PAN Number': 'XYZAB5678G',
        'Billing Address': '456 Corporate Avenue, City',
        'City': 'Delhi',
        'State': 'Delhi',
        'Zip': '110001',
        'Bank Name': 'HDFC Bank',
        'Bank Account No': '98765432109',
        'IFSC Code': 'HDFC0009876'
      },
      {
        'Company Name': 'Sample Company Name Only',
        'Email': '',
        'Phone': '',
        'GST Number': '',
        'PAN Number': '',
        'Billing Address': '',
        'City': '',
        'State': '',
        'Zip': '',
        'Bank Name': '',
        'Bank Account No': '',
        'IFSC Code': ''
      }
    ];

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Set column widths for better readability
    const colWidths = [
      { wch: 25 }, // Company Name
      { wch: 30 }, // Email
      { wch: 15 }, // Phone
      { wch: 20 }, // GST Number
      { wch: 15 }, // PAN Number
      { wch: 40 }, // Billing Address
      { wch: 15 }, // City
      { wch: 15 }, // State
      { wch: 10 }, // Zip
      { wch: 25 }, // Bank Name
      { wch: 18 }, // Bank Account No
      { wch: 15 }  // IFSC Code
    ];
    ws['!cols'] = colWidths;

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customers Template');

    // Generate filename with current date
    const fileName = `Customer_Import_Template_${new Date().toISOString().split('T')[0]}.xlsx`;

    // Download file
    XLSX.writeFile(wb, fileName);
  };

  // Excel Import functionality
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validExtensions.includes(fileExtension)) {
      setImportError('Please select a valid Excel file (.xlsx, .xls, or .csv)');
      return;
    }

    setImporting(true);
    setImportError('');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet);

      if (jsonData.length === 0) {
        setImportError('Excel file is empty. Please add at least one company name.');
        setImporting(false);
        return;
      }

      // Process and validate data - only company name is required
      const customersToCreate: CreateCustomerDto[] = [];
      const errors: string[] = [];
      const seenCompanyNames = new Set<string>();
      const seenGstNumbers = new Set<string>();
      const seenPanNumbers = new Set<string>();

      // Load existing customers for duplicate checking
      const existingCustomers = customers.map(c => ({
        name: c.customerName.toLowerCase(),
        gst: c.gstNumber?.toLowerCase() || '',
        pan: c.panNumber?.toUpperCase() || ''
      }));

      jsonData.forEach((row: any, index: number) => {
        const rowNum = index + 2; // +2 because index is 0-based and Excel rows start at 1, plus header row

        // Try to find company name in various possible column names (case-insensitive)
        const companyName = 
          row['Company Name'] || 
          row['CompanyName'] || 
          row['company name'] || 
          row['companyname'] ||
          row['Customer Name'] ||
          row['CustomerName'] ||
          row['customer name'] ||
          row['customername'] ||
          row['Name'] ||
          row['name'] ||
          row['Company'] ||
          row['company'] ||
          '';

        if (!companyName || companyName.toString().trim() === '') {
          errors.push(`Row ${rowNum}: Company name is required`);
          return;
        }

        const companyNameTrimmed = companyName.toString().trim();
        const companyNameLower = companyNameTrimmed.toLowerCase();

        // Check for duplicate company name within Excel file
        if (seenCompanyNames.has(companyNameLower)) {
          errors.push(`Row ${rowNum}: Duplicate company name '${companyNameTrimmed}' found in Excel file`);
          return;
        }

        // Check for duplicate company name against existing customers
        if (existingCustomers.some(c => c.name === companyNameLower)) {
          errors.push(`Row ${rowNum}: Company name '${companyNameTrimmed}' already exists`);
          return;
        }

        seenCompanyNames.add(companyNameLower);

        // Get GST and PAN numbers
        const gstNumber = (row['GST Number'] || row['GSTNumber'] || row['gst number'] || row['GST'] || row['gst'] || '').toString().trim() || undefined;
        const panNumber = (row['PAN'] || row['pan'] || row['PAN Number'] || row['PANNumber'] || '').toString().trim() || undefined;

        // Validate GST Number if provided
        if (gstNumber) {
          const gstLower = gstNumber.toLowerCase();
          
          // Check for duplicate GST within Excel file
          if (seenGstNumbers.has(gstLower)) {
            errors.push(`Row ${rowNum}: Duplicate GST Number '${gstNumber}' found in Excel file`);
            return;
          }

          // Check for duplicate GST against existing customers
          if (existingCustomers.some(c => c.gst && c.gst === gstLower)) {
            errors.push(`Row ${rowNum}: GST Number '${gstNumber}' already exists`);
            return;
          }

          seenGstNumbers.add(gstLower);
        }

        // Validate PAN Number if provided
        if (panNumber) {
          const panUpper = panNumber.toUpperCase();
          
          // Check for duplicate PAN within Excel file
          if (seenPanNumbers.has(panUpper)) {
            errors.push(`Row ${rowNum}: Duplicate PAN Number '${panNumber}' found in Excel file`);
            return;
          }

          // Check for duplicate PAN against existing customers
          if (existingCustomers.some(c => c.pan && c.pan === panUpper)) {
            errors.push(`Row ${rowNum}: PAN Number '${panNumber}' already exists`);
            return;
          }

          seenPanNumbers.add(panUpper);
        }

        // Create customer DTO - only company name is required, others are optional
        const customerDto: CreateCustomerDto = {
          customerName: companyNameTrimmed,
          gstNumber: gstNumber,
          email: (row['Email'] || row['email'] || row['E-mail'] || '').toString().trim() || undefined,
          phone: (row['Phone'] || row['phone'] || row['Phone Number'] || row['Mobile'] || '').toString().trim() || undefined,
          billingAddress: (row['Address'] || row['address'] || row['Billing Address'] || row['BillingAddress'] || '').toString().trim() || undefined,
          bankName: (row['Bank Name'] || row['BankName'] || row['bank name'] || '').toString().trim() || undefined,
          bankAccountNo: (row['Bank Account'] || row['BankAccount'] || row['Account Number'] || row['AccountNumber'] || '').toString().trim() || undefined,
          ifscCode: (row['IFSC'] || row['ifsc'] || row['IFSC Code'] || row['IFSCCode'] || '').toString().trim() || undefined,
          panNumber: panNumber,
          City: (row['City'] || row['city'] || '').toString().trim() || undefined,
          State: (row['State'] || row['state'] || '').toString().trim() || undefined,
          Zip: (row['Zip'] || row['zip'] || row['ZIP'] || row['Pincode'] || row['Pin Code'] || '').toString().trim() || undefined,
        };

        customersToCreate.push(customerDto);
      });

      if (errors.length > 0) {
        setImportError(`Validation errors:\n${errors.join('\n')}\n\nPlease fix these errors and try again.`);
        setImporting(false);
        return;
      }

      if (customersToCreate.length === 0) {
        setImportError('No valid customers found. Please ensure at least one row has a company name.');
        setImporting(false);
        return;
      }

      // Create customers in bulk
      let successCount = 0;
      let failCount = 0;
      const failMessages: string[] = [];

      for (const customerDto of customersToCreate) {
        try {
          await api.customers.create(customerDto);
          successCount++;
        } catch (err: any) {
          failCount++;
          const errorMsg = err.response?.data?.message || 'Unknown error';
          failMessages.push(`${customerDto.customerName}: ${errorMsg}`);
        }
      }

      // Show results
      let resultMessage = `Import completed!\n✅ Successfully imported: ${successCount} customer(s)`;
      if (failCount > 0) {
        resultMessage += `\n❌ Failed: ${failCount} customer(s)`;
        if (failMessages.length > 0 && failMessages.length <= 5) {
          resultMessage += `\n\nErrors:\n${failMessages.join('\n')}`;
        }
      }
      alert(resultMessage);

      // Reload customers list
      await loadData();

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      console.error('Error importing Excel file:', err);
      setImportError(`Failed to import Excel file: ${err.message || 'Please check the file format and try again.'}`);
    } finally {
      setImporting(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorAlert message={error} onRetry={loadData} />;

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
    <>
      <div className="min-h-screen bg-gray-50 p-6">
        {importError && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <p className="text-sm text-yellow-800 whitespace-pre-line">{importError}</p>
              </div>
              <button
                onClick={() => setImportError('')}
                className="ml-4 text-yellow-600 hover:text-yellow-800"
                title="Dismiss"
                aria-label="Dismiss import error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
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
              {/* MasterUser cannot create customers - they can only manage admins */}
              {userRole !== 'MasterUser' && (
                <>
                  <button
                    onClick={handleDownloadTemplate}
                    className="flex items-center justify-center px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm sm:text-base"
                    title="Download Excel template with sample data"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Template
                  </button>
                  <button
                    onClick={handleImportClick}
                    disabled={importing}
                    className={`flex items-center justify-center px-3 sm:px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base`}
                    title="Import customers from Excel file (only company name required)"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {importing ? 'Importing...' : 'Import from Excel'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileImport}
                    style={{ display: 'none' }}
                    aria-label="Upload customers file"
                  />
                  <button
                    onClick={() => setShowAddCustomer(true)}
                    className={`flex items-center justify-center px-3 sm:px-4 py-2 ${themeColors.primary} text-white rounded-md ${themeColors.primaryHover} text-sm sm:text-base`}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Customer
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {filteredCustomers.map(customer => {
              const customerBalance = getCustomerBalance(customer.id);
              const customerStatus = getCustomerStatus(customer.id);

              return (
                <div
                  key={customer.id}
                  className="card p-6 hover:shadow-lg transition-shadow cursor-pointer relative"
                  onClick={() => handleViewInvoices(customer)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center">
                      <div className={`p-2 ${themeColors.secondary} rounded-full mr-3`}>
                        <Users className={`h-5 w-5 ${themeColors.accent}`} />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {customer.customerName}
                      </h3>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => handleEditCustomer(customer, e)}
                        className={`p-1.5 ${themeColors.primaryLight} ${themeColors.accent} rounded-md ${themeColors.secondary.replace('bg-', 'hover:bg-')} transition-colors`}
                        title="Edit Customer"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${customerStatus === 'paid'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                          }`}
                      >
                        {customerStatus === 'paid' ? 'Paid' : 'Unpaid'}
                      </span>
                    </div>
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
                          className={`font-semibold ${customerBalance > 0
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
                className={`flex items-center px-4 py-2 ${themeColors.primary} text-white rounded-md ${themeColors.primaryHover} mx-auto`}
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

      {/* ✅ Edit Customer Modal */}
      <EditCustomerModal
        isOpen={showEditCustomer}
        onClose={() => {
          setShowEditCustomer(false);
          setEditingCustomer(null);
        }}
        customer={editingCustomer}
        onCustomerUpdated={handleCustomerUpdated}
      />

      {/* 🧾 Customer Invoice + Payment Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl p-6 relative max-h-[90vh] overflow-auto">
            <button
              onClick={() => setSelectedCustomer(null)}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              title="Close"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold mb-4">
              Invoices – {selectedCustomer.customerName}
            </h2>

            {loadingInvoices ? (
              <LoadingSpinner />
            ) : customerInvoices.length > 0 ? (
              <div className="min-w-0">
                <table className="w-full text-sm min-w-full">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="px-4 py-2 text-left">Invoice #</th>
                      <th className="px-4 py-2 text-left whitespace-nowrap min-w-[7rem]">Invoice Date</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-right">Paid</th>
                      <th className="px-4 py-2 text-right">Waved</th>
                      <th className="px-4 py-2 text-right">Balance</th>
                      <th className="px-4 py-2 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customerInvoices.map(inv => (
                      <tr key={inv.id} className="border-b hover:bg-gray-50">
                        <td
                          className="px-4 py-2 font-medium cursor-pointer text-blue-600 hover:text-blue-800"
                          onClick={() => handleViewInvoice(inv.id)}
                        >
                          {inv.invoiceNumber}
                        </td>
                        <td className="px-4 py-2 text-left text-gray-600 whitespace-nowrap min-w-[7rem]">
                          {inv.invoiceDate ? new Date(inv.invoiceDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '–'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          ₹{inv.grandTotal.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right">
                          ₹{inv.paidAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right text-green-600">
                          ₹{(inv.waveAmount || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-right">
                          ₹{inv.balanceAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewInvoice(inv.id);
                              }}
                              className={`px-3 py-1 ${themeColors.info} text-white rounded ${themeColors.infoHover} flex items-center gap-1`}
                              title="View Invoice"
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </button>
                            {inv.balanceAmount > 0 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddPaymentClick(inv);
                                }}
                                className={`px-3 py-1 ${themeColors.success} text-white rounded ${themeColors.successHover}`}
                              >
                                Add Payment
                              </button>
                            )}
                          </div>
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

      {/* Invoice Preview Modal */}
      {selectedInvoice && selectedCustomer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl relative my-4 sm:my-8 max-h-[95vh] overflow-y-auto">
            <button
              onClick={() => setSelectedInvoice(null)}
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
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handlePrintInvoice}
                      className="flex items-center gap-2 px-3 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800 text-sm"
                    >
                      <Printer className="h-4 w-4" />
                      Print
                    </button>
                    <button
                      onClick={handleDownloadPdf}
                      className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </button>
                  </div>
                </div>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <label className="text-sm font-medium text-gray-700">Invoice Format</label>
                  <select
                    value={selectedLayoutId}
                    onChange={(e) => setSelectedLayoutId(e.target.value)}
                    aria-label="Select invoice layout"
                    className="border rounded-md px-2 py-1 text-sm"
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
                <div ref={previewRef} data-pdf-root="true">
                  {selectedLayoutId === 'static' ? (
                    <TaxInvoice
                      customer={selectedCustomer}
                      items={selectedInvoice.items || []}
                      dueDate={selectedInvoice.dueDate || ''}
                      invoiceNumber={selectedInvoice.invoiceNumber}
                      paymentStatus={selectedInvoice.status}
                      initialPayment={selectedInvoice.paidAmount}
                      waveAmount={selectedInvoice.waveAmount || 0}
                      payments={selectedInvoice.payments || []}
                    />
                  ) : selectedLayoutId === 'classic' || !selectedLayout || !hasVisibleSections ? (
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
                  ) : (
                    <DynamicInvoiceRenderer
                      layout={resolvedLayoutConfig}
                      customer={selectedCustomer}
                      items={selectedInvoice.items || []}
                      dueDate={selectedInvoice.dueDate || ''}
                      invoiceNumber={selectedInvoice.invoiceNumber}
                      paymentStatus={selectedInvoice.status}
                      initialPayment={selectedInvoice.paidAmount}
                      waveAmount={selectedInvoice.waveAmount || 0}
                      payments={selectedInvoice.payments || []}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};
