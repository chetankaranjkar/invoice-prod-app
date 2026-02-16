import React from 'react';
import type { CompanyInfo, Customer, InvoiceItem } from '../../../types';

interface FooterSectionProps {
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

export const FooterSection: React.FC<FooterSectionProps> = ({ company }) => {
  return (
    <div className="flex flex-col gap-3 text-xs">
      <div>
        <p className="font-semibold underline">Bank Account Details</p>
        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1">
          <div><strong>Bank Name:</strong> {company?.bankName}</div>
          <div><strong>Account Name:</strong> {company?.name}</div>
          <div><strong>Account Number:</strong> {company?.accountNumber}</div>
          <div><strong>IFSC Code:</strong> {company?.ifscCode}</div>
          <div><strong>Mobile Number:</strong> {company?.phone}</div>
        </div>
      </div>
      <div className="pt-3">
        <p className="font-semibold">Signature</p>
      </div>
    </div>
  );
};
