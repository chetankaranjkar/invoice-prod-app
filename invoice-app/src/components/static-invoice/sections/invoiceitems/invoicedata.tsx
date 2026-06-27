import type { InvoiceItem } from '../../../../types';
import { calculateInvoiceTotals } from '../../../../utils/invoiceCalculations';
import { InvoiceItemsTable, MIN_VISIBLE_ROWS } from '../../../invoice/InvoiceHierarchyRows';

interface StaticInvoiceItemsProps {
  items: InvoiceItem[];
}

function StaticInvoiceItems({ items }: StaticInvoiceItemsProps) {
  const { totalAmount } = calculateInvoiceTotals(items);

  return (
    <InvoiceItemsTable
      variant="classic"
      headerVariant="classic"
      items={items}
      minVisibleRows={MIN_VISIBLE_ROWS}
      renderOptions={{ showSubItems: true, hideZeroCostSubs: false }}
      footer={
        <tfoot>
          <tr className="bg-[#d1d5dc]">
            <td className="border border-[#9ca3af] px-1 py-0.5" colSpan={2}>
              <strong>Total</strong>
            </td>
            <td className="border border-[#9ca3af] px-1 py-0.5 text-center">
              <strong>₹{totalAmount.toFixed(2)}</strong>
            </td>
          </tr>
        </tfoot>
      }
    />
  );
}

export default StaticInvoiceItems;
