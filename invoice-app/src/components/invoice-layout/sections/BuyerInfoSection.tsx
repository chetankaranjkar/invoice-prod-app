import React from 'react';
import type { CompanyInfo, Customer, InvoiceItem } from '../../../types';

interface BuyerInfoSectionProps {
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

export const BuyerInfoSection: React.FC<BuyerInfoSectionProps> = ({ customer }) => {
  return (
    <div className="bg-gray-100 rounded-md p-3 text-xs">
      <h2 className="text-xs font-semibold mb-1">Billed to</h2>
      {customer ? (
        <>
          <p className="font-semibold">{customer.customerName}</p>
          <p>{customer.billingAddress}</p>
          <p>{customer.city}, {customer.state} {customer.zip}</p>
          <p><strong>GSTIN</strong> {customer.gstNumber}</p>
          <p><strong>PAN</strong> {customer.panNumber}</p>
        </>
      ) : (
        <p>No customer selected</p>
      )}
    </div>
  );
};
