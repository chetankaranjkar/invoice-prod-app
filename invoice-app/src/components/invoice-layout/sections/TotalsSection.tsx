import React from 'react';
import type { CompanyInfo, Customer, InvoiceItem } from '../../../types';

interface TotalsSectionProps {
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

export const TotalsSection: React.FC<TotalsSectionProps> = ({ totals }) => {
  return (
    <div className="border rounded-md p-3 text-xs">
      <div className="flex justify-between py-1">
        <span>Taxable Amount</span>
        <span>₹{totals.totalAmount.toFixed(2)}</span>
      </div>
      <div className="flex justify-between py-1">
        <span>Total GST</span>
        <span>₹{totals.totalGST.toFixed(2)}</span>
      </div>
      <div className="flex justify-between py-1 font-semibold border-t mt-1 pt-2">
        <span>Grand Total</span>
        <span>₹{totals.grandTotal.toFixed(2)}</span>
      </div>
      {totals.totalWave > 0 && (
        <div className="flex justify-between py-1 text-green-700">
          <span>Discount</span>
          <span>-₹{totals.totalWave.toFixed(2)}</span>
        </div>
      )}
      {totals.totalPaid > 0 && (
        <div className="flex justify-between py-1 text-green-700">
          <span>Paid Amount</span>
          <span>₹{totals.totalPaid.toFixed(2)}</span>
        </div>
      )}
      <div className="flex justify-between py-1 font-semibold">
        <span>Balance Due</span>
        <span className={totals.balanceAmount > 0 ? 'text-red-600' : 'text-green-700'}>
          ₹{totals.balanceAmount.toFixed(2)}
        </span>
      </div>
    </div>
  );
};
