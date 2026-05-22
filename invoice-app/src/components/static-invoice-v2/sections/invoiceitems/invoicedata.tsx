import type { InvoiceItem } from '../../../../types';

interface StaticInvoiceItemsProps {
  items: InvoiceItem[];
}

function StaticInvoiceItems({ items }: StaticInvoiceItemsProps) {
  const total = items.reduce(
    (sum, item) =>
      sum +
      (Number(item.amount) ||
        (Number(item.quantity) || 0) * (Number(item.rate) || 0)),
    0
  );

  return (
    <div className="w-full flex flex-col rounded-lg overflow-hidden border border-[#e5e7eb]">
      <table className="invoice-table w-full text-left border-collapse text-[10px] sm:text-xs md:text-sm shrink-0">
        <thead>
          <tr className="bg-[#1f2937] text-white">
            <th className="px-2 py-2 w-[7%] min-w-[2.5rem] text-center font-semibold uppercase tracking-wide text-[10px]">
              #
            </th>
            <th className="px-2 py-2 font-semibold uppercase tracking-wide text-[10px]">
              Description
            </th>
            <th className="px-2 py-2 w-[18%] text-right font-semibold uppercase tracking-wide text-[10px]">
              Amount (INR)
            </th>
          </tr>
        </thead>
        <tbody style={{ verticalAlign: 'top' }}>
          {items.length === 0 ? (
            <tr>
              <td
                colSpan={3}
                className="invoice-empty-row px-2 py-4 text-center text-[#6b7280]"
                style={{ height: '40vh', verticalAlign: 'middle' }}
              >
                <div className="flex items-center justify-center h-full italic">
                  No items added yet. Add items in the form to see them here.
                </div>
              </td>
            </tr>
          ) : (
            items.map((item, index) => {
              const quantity = Number(item.quantity) || 0;
              const rate = Number(item.rate) || 0;
              const amount = Number(item.amount) || quantity * rate;
              const showDetails = quantity !== 1 || Number(item.gstPercentage) !== 0;
              const isEven = index % 2 === 1;
              return (
                <tr
                  key={index}
                  className="leading-tight border-b border-[#e5e7eb]"
                  style={{ backgroundColor: isEven ? '#f9fafb' : '#ffffff' }}
                >
                  <td className="px-2 py-2 text-center w-[7%] min-w-[2.5rem] align-top text-[#6b7280] font-semibold">
                    {index + 1}
                  </td>
                  <td className="px-2 py-2 align-top">
                    <div className="leading-snug font-medium text-[#1f2937]">{item.productName}</div>
                    {showDetails && (
                      <div className="text-[9px] text-[#6b7280] mt-0.5 leading-tight">
                        Qty: {quantity} &middot; Rate: ₹{rate.toFixed(2)}
                        {Number(item.gstPercentage) !== 0 && ` · GST: ${item.gstPercentage}%`}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-right w-[18%] align-top font-semibold text-[#1f2937] tabular-nums">
                    ₹{amount.toFixed(2)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        <tfoot>
          <tr className="bg-[#f3f4f6] border-t-2 border-[#1f2937]">
            <td className="px-2 py-2" colSpan={2}>
              <span className="font-bold uppercase tracking-wide text-[#1f2937]">Subtotal</span>
            </td>
            <td className="px-2 py-2 text-right tabular-nums">
              <span className="font-bold text-[#1f2937]">₹{total.toFixed(2)}</span>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default StaticInvoiceItems;
