import React from 'react';
import type { CompanyInfo, Customer, InvoiceItem, InvoiceLayoutSectionConfig } from '../../../types';

interface StaticTextSectionProps {
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
  section?: InvoiceLayoutSectionConfig;
}

export const StaticTextSection: React.FC<StaticTextSectionProps> = ({ section }) => {
  return (
    <div className="text-xs text-gray-700 whitespace-pre-wrap">
      {section?.content || 'Add your text here'}
    </div>
  );
};
