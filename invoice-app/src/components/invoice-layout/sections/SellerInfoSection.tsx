import React from 'react';
import type { CompanyInfo, Customer, InvoiceItem } from '../../../types';

interface SellerInfoSectionProps {
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

export const SellerInfoSection: React.FC<SellerInfoSectionProps> = ({ company }) => {
  return (
    <div className="bg-gray-100 rounded-md p-3 text-xs">
      <h2 className="text-xs font-semibold mb-1">Billed by</h2>
      <p className="font-semibold">{company?.businessName || company?.name || 'Business Name'}</p>
      <p>{company?.address}</p>
      <p>{company?.City}, {company?.State} {company?.Zip}</p>
      <p><strong>GSTIN</strong> {company?.gstNumber}</p>
      <p><strong>PAN</strong> {company?.panNumber}</p>
    </div>
  );
};
