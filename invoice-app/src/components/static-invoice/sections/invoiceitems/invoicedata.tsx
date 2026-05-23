import type { InvoiceItem } from '../../../../types';
import { calculateInvoiceTotals } from '../../../../utils/invoiceCalculations';
import { HierarchicalInvoiceItemRows } from '../../../invoice/HierarchicalInvoiceItemRows';

interface StaticInvoiceItemsProps {
  items: InvoiceItem[];
}

function StaticInvoiceItems({ items }: StaticInvoiceItemsProps) {
  const { totalAmount } = calculateInvoiceTotals(items);

  return (
    <div className="w-full flex flex-col">
      <table
        className="invoice-table w-full text-left border-collapse text-[10px] sm:text-xs md:text-sm shrink-0"
        style={items.length === 0 ? { minHeight: '40vh' } : undefined}
      >
        <thead>
          <tr className="bg-[#d1d5dc]">
            <th className="border px-1 py-0.5 w-[7%] min-w-[2.5rem] whitespace-nowrap">SR. no</th>
            <th className="border px-1 sm:px-2 py-0.5">Description</th>
            <th className="border px-1 py-0.5 w-[15%] text-center">Amount (INR)</th>
          </tr>
        </thead>
        <tbody style={items.length === 0 ? { minHeight: '40vh' } : { verticalAlign: 'top' }}>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={3}
                className="border px-2 py-4 text-center text-[#6b7280]"
                style={{ height: '50vh', verticalAlign: 'middle' }}
              >
                <div className="flex items-center justify-center h-full">
                  No items added yet. Add items in the form to see them here.
                </div>
              </td>
            </tr>
          ) : (
            <HierarchicalInvoiceItemRows items={items} hideZeroCostSubs />
          )}
        </tbody>
        <tfoot>
          <tr className="bg-[#d1d5dc]">
            <td className="border px-1 py-0.5" colSpan={2}>
              <strong>Total</strong>
            </td>
            <td className="border px-1 py-0.5 text-center">
              <strong>₹{totalAmount.toFixed(2)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default StaticInvoiceItems;
