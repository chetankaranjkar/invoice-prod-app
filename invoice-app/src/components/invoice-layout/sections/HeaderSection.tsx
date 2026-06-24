import React from 'react';
import type { CompanyInfo, Customer, InvoiceItem } from '../../../types';
import { useDateFormat } from '../../../hooks/useDateFormat';
import { resolveAssetUrl, shouldShowInvoiceLogo } from '../../../utils/helpers';

interface HeaderSectionProps {
  company: CompanyInfo | null;
  customer: Customer | null;
  items: InvoiceItem[];
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentStatus?: string;
  totals: {
    totalAmount: number;
    totalGST: number;
    grandTotal: number;
    totalPaid: number;
    totalWave: number;
    balanceAmount: number;
  };
}

export const HeaderSection: React.FC<HeaderSectionProps> = ({ company, invoiceNumber, invoiceDate }) => {
  const formatDate = useDateFormat();
  return (
    <div className="flex flex-col gap-2 border-b border-gray-300 pb-2">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Invoice</h1>
          <p className="text-xs text-gray-700"><strong>Invoice No:</strong> {invoiceNumber}</p>
          <p className="text-xs text-gray-700"><strong>Invoice Date:</strong> {formatDate(invoiceDate)}</p>
        </div>
        {shouldShowInvoiceLogo(company) ? (
          <img
            src={resolveAssetUrl(company!.logoUrl)}
            alt={company?.businessName || company?.name || 'Company Logo'}
            className="h-10 w-auto max-w-[96px] object-contain"
            crossOrigin="anonymous"
          />
        ) : (
          <div className="text-xs font-semibold text-gray-700">
            {company?.businessName || company?.name || 'Company'}
          </div>
        )}
      </div>
    </div>
  );
};
