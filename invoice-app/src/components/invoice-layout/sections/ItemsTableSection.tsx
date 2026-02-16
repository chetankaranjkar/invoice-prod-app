import React from 'react';
import type { CompanyInfo, Customer, InvoiceItem } from '../../../types';

interface ItemsTableSectionProps {
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

export const ItemsTableSection: React.FC<ItemsTableSectionProps> = ({ items }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="bg-gray-200">
            <th className="border px-2 py-0.5 w-[8%]">Index</th>
            <th className="border px-2 py-0.5">Particular</th>
            <th className="border px-2 py-0.5 w-[18%] text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={3} className="border px-2 py-4 text-center text-gray-500">
                No items added yet.
              </td>
            </tr>
          ) : (
            items.map((item, index) => (
              <tr key={index} className="leading-tight">
                <td className="border px-2 py-0.5 text-center align-top">{index + 1}</td>
                <td className="border px-2 py-0.5 align-top">
                  <div className="font-medium leading-tight">{item.productName}</div>
                  {(Number(item.quantity) !== 1 || Number(item.gstPercentage) !== 0) && (
                    <div className="text-[10px] text-gray-600 leading-tight">
                      Qty: {item.quantity} × ₹{Number(item.rate).toFixed(2)} | GST: {item.gstPercentage}%
                    </div>
                  )}
                </td>
                <td className="border px-2 py-0.5 text-right align-top">₹{Number(item.amount || item.quantity * item.rate).toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
