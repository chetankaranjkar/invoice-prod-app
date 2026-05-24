import React from 'react';
import type { CompanyInfo, Customer, InvoiceItem } from '../../../types';
import { calculateInvoiceTotals } from '../../../utils/invoiceCalculations';
import { InvoiceItemsTable } from '../../invoice/InvoiceHierarchyRows';

interface ItemsTableSectionProps {
  company?: CompanyInfo | null;
  customer?: Customer | null;
  items: InvoiceItem[];
  invoiceNumber?: string;
  invoiceDate?: string;
  dueDate?: string;
  paymentStatus?: string;
  totals?: unknown;
}

export const ItemsTableSection: React.FC<ItemsTableSectionProps> = ({ items }) => {
  const { totalAmount } = calculateInvoiceTotals(items);

  return (
    <InvoiceItemsTable
      variant="classic"
      headerVariant="classic"
      items={items}
      renderOptions={{ showSubItems: true, hideZeroCostSubs: false }}
      footer={
        <tfoot>
          <tr className="bg-gray-200">
            <td className="border border-gray-400 px-2 py-1" colSpan={2}>
              <strong>Subtotal</strong>
            </td>
            <td className="border border-gray-400 px-2 py-1 text-right">
              <strong>₹{totalAmount.toFixed(2)}</strong>
            </td>
          </tr>
        </tfoot>
      }
    />
  );
};
