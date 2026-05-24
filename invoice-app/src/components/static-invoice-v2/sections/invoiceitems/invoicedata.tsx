import type { InvoiceItem } from '../../../../types';
import { calculateInvoiceTotals } from '../../../../utils/invoiceCalculations';
import { InvoiceItemsTable } from '../../../invoice/InvoiceHierarchyRows';

interface StaticInvoiceItemsProps {
  items: InvoiceItem[];
}

function StaticInvoiceItems({ items }: StaticInvoiceItemsProps) {
  const { totalAmount } = calculateInvoiceTotals(items);

  return (
    <InvoiceItemsTable
      variant="modern"
      headerVariant="modern"
      items={items}
      renderOptions={{ showSubItems: true, hideZeroCostSubs: false }}
      footer={
        <tfoot>
          <tr className="bg-[#f3f4f6] border-t-2 border-[#1f2937]">
            <td className="border border-[#9ca3af] px-2 py-2" colSpan={2}>
              <span className="font-bold uppercase tracking-wide text-[#1f2937]">Subtotal</span>
            </td>
            <td className="border border-[#9ca3af] px-2 py-2 text-right tabular-nums">
              <span className="font-bold text-[#1f2937]">₹{totalAmount.toFixed(2)}</span>
            </td>
          </tr>
        </tfoot>
      }
    />
  );
}

export default StaticInvoiceItems;
