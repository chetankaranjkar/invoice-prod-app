import type { InvoiceItem } from '../../../../types';

interface StaticInvoiceItemsProps {
  items: InvoiceItem[];
}

function StaticInvoiceItems({ items }: StaticInvoiceItemsProps) {
  return (
    <div className="w-full flex flex-col">
      <table
        className="w-full text-left border-collapse text-[10px] sm:text-xs md:text-sm shrink-0"
        style={{ minHeight: '40vh' }}
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
            items.map((item, index) => {
              const quantity = Number(item.quantity) || 0;
              const rate = Number(item.rate) || 0;
              const amount = Number(item.amount) || quantity * rate;
              return (
                <tr key={index} className="leading-tight">
                  <td className="border-x px-1 py-0.5 text-center w-[7%] min-w-[2.5rem] align-top">
                    {index + 1}
                  </td>
                  <td className="border-x px-2 py-0.5 align-top">
                    <div className="leading-tight">{item.productName}</div>
                    {(quantity !== 1 || Number(item.gstPercentage) !== 0) && (
                      <div className="text-[9px] text-[#4b5563] mt-0.5 leading-tight">
                        Qty: {quantity} × ₹{rate.toFixed(2)} | GST: {item.gstPercentage}%
                      </div>
                    )}
                  </td>
                  <td className="border-x px-1 py-0.5 text-center w-[15%] align-top">
                    ₹{amount.toFixed(2)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
        <tfoot>
          <tr className="bg-[#d1d5dc]">
            <td className="border px-1 py-0.5" colSpan={2}>
              <strong>Total</strong>
            </td>
            <td className="border px-1 py-0.5 text-center">
              <strong>
                ₹
                {items
                  .reduce(
                    (sum, item) =>
                      sum +
                      (Number(item.amount) ||
                        (Number(item.quantity) || 0) * (Number(item.rate) || 0)),
                    0
                  )
                  .toFixed(2)}
              </strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export default StaticInvoiceItems;
