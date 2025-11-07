import React, { useState, useEffect } from 'react';
import type { Customer, InvoiceItem, CompanyInfo, PaymentStatus } from '../types';
import { formatDate, amountToWords } from '../utils/helpers';
import { api } from '../services/agent';

interface InvoicePreviewProps {
  customer: Customer | null;
  items: InvoiceItem[];
  dueDate: string;
  invoiceNumber: string;
  paymentStatus?: PaymentStatus; // Use PaymentStatus type
  initialPayment?: number;
}

export const InvoicePreview: React.FC<InvoicePreviewProps> = ({
  customer,
  items,
  dueDate,
  invoiceNumber,
  paymentStatus = 'Unpaid',
  initialPayment = 0,
}) => {
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const invoiceDate = new Date().toISOString().split('T')[0];
  
  useEffect(() => {
    loadCompanyInfo();
  }, []);

  const loadCompanyInfo = async () => {
    try {
      const response = await api.user.getProfile();
      const userProfile = response.data;
      
      const companyData: CompanyInfo = {
        name: userProfile.name,
        email: userProfile.email,
        businessName: userProfile.businessName,
        gstNumber: userProfile.gstNumber,
        address: userProfile.address,
        bankName: userProfile.bankName,
        accountNumber: userProfile.accountNumber,
        ifscCode: userProfile.ifscCode,
        panNumber: userProfile.panNumber,
        phone: userProfile.phone,
        logoUrl: userProfile.logoUrl,
      };
      
      setCompanyInfo(companyData);
    } catch (error) {
      console.error('Failed to load company info:', error);
      setCompanyInfo({
        name: 'LEAP NEXT',
        businessName: 'LEAP NEXT',
        address: 'Remula Gulmolar Phase 2, Behind City One Mall E Wing Hit No 002, Morwadi, Pune, Maharashtra 411017',
        gstNumber: '27BBPK5069A1ZW',
        panNumber: 'BBPK5069A',
        bankName: 'Kotak Mahindra Bank',
        accountNumber: '8350277598',
        ifscCode: 'KKBK0007798',
        phone: '0877411434',
      });
    }
  };

  const totals = items.reduce(
    (acc, item) => ({
      totalAmount: acc.totalAmount + item.amount,
      totalGST: acc.totalGST + item.gstAmount,
      grandTotal: acc.grandTotal + (item.amount + item.gstAmount),
    }),
    { totalAmount: 0, totalGST: 0, grandTotal: 0 }
  );

  const balanceAmount = totals.grandTotal - initialPayment;

  const currentCompany = companyInfo;

  if (!currentCompany) {
    return (
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="border-2 border-gray-800 p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading company information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <div className="border-2 border-gray-800 p-8">
        {/* Header with Logo */}
        <div className="flex justify-between items-start mb-8">
          {currentCompany.logoUrl ? (
            <div className="flex items-center">
              <img
                src={currentCompany.logoUrl}
                alt="Company Logo"
                className="h-16 w-auto object-contain"
              />
            </div>
          ) : (
            <div></div>
          )}
          <div className="text-right">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {currentCompany.businessName || currentCompany.name}
            </h1>
            <p className="text-sm text-gray-600">Invoice</p>
          </div>
        </div>

        {/* Invoice Details */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <p className="font-semibold">Client Name: {customer?.customerName || 'Select Customer'}</p>
            <p>Invoice No: {invoiceNumber}</p>
            <p>Invoice Date: {formatDate(invoiceDate)}</p>
            {dueDate && <p>Due Date: {formatDate(dueDate)}</p>}
          </div>
          <div className="text-right">
            <p className="font-semibold">Status: 
              <span className={`ml-2 ${
                paymentStatus === 'Paid' ? 'text-green-600' :
                paymentStatus === 'Partially Paid' ? 'text-yellow-600' :
                'text-red-600'
              }`}>
                {paymentStatus}
              </span>
            </p>
            <p>GST %: 18</p>
          </div>
        </div>

        {/* Rest of the InvoicePreview component remains the same */}
        {/* ... (keep the existing Billed By, Items Table, Taxable Amounts, Bank Details sections) */}

        {/* Payment Summary */}
        <div className="grid grid-cols-2 gap-8 mb-6">
          <div>
            <h3 className="font-bold mb-2">Payment Summary</h3>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>Grand Total:</span>
                <span>₹{totals.grandTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid Amount:</span>
                <span className="text-green-600">₹{initialPayment.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-1">
                <span>Balance Due:</span>
                <span className="text-red-600">₹{balanceAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>
          <div>
            <h3 className="font-bold mb-2">Amount in Words</h3>
            <p className="text-sm">{amountToWords(totals.grandTotal)}</p>
          </div>
        </div>

        {/* Rest of the component... */}
      </div>
    </div>
  );
};