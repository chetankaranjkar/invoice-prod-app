import type { InvoiceItem } from '../../types';
import { flattenInvoiceItems } from '../../utils/invoiceCalculations';

interface Props {
  items: InvoiceItem[];
  hideZeroCostSubs?: boolean;
  rowClassName?: string;
}

export function HierarchicalInvoiceItemRows({
  items,
  hideZeroCostSubs = true,
  rowClassName = '',
}: Props) {
  const flat = flattenInvoiceItems(items, { visibleOnly: true, hideZeroCostSubs });
  let rowNum = 0;

  return (
    <>
      {flat.map((item) => {
        rowNum += 1;
        const isSub = (item.hierarchyLevel ?? 0) > 0 || !!item.parentLineKey;
        const quantity = Number(item.quantity) || 0;
        const rate = Number(item.rate) || 0;
        const amount = Number(item.amount) || quantity * rate;
        const showDetails = quantity !== 1 || Number(item.gstPercentage) !== 0;

        return (
          <tr
            key={`${item.lineKey ?? item.productName}-${rowNum}`}
            className={`leading-tight border-b border-[#e5e7eb] ${rowClassName}`}
            style={{ backgroundColor: rowNum % 2 === 0 ? '#f9fafb' : '#ffffff' }}
          >
            <td className="px-2 py-2 text-center w-[7%] min-w-[2.5rem] align-top text-[#6b7280] font-semibold">
              {rowNum}
            </td>
            <td className={`px-2 py-2 align-top ${isSub ? 'pl-6' : ''}`}>
              {isSub && (
                <span className="text-[#9ca3af] mr-1 font-mono text-[10px]">└</span>
              )}
              <div
                className={`leading-snug ${isSub ? 'text-[#4b5563] font-normal text-[11px]' : 'font-semibold text-[#1f2937]'}`}
              >
                {item.productName}
              </div>
              {showDetails && (
                <div className="text-[9px] text-[#6b7280] mt-0.5 leading-tight">
                  Qty: {quantity} &middot; Rate: ₹{rate.toFixed(2)}
                  {Number(item.gstPercentage) !== 0 && ` · GST: ${item.gstPercentage}%`}
                  {item.affectTotal === false && ' · (breakdown)'}
                </div>
              )}
            </td>
            <td
              className={`px-2 py-2 text-right w-[18%] align-top tabular-nums ${
                isSub ? 'text-[#6b7280] text-[11px]' : 'font-semibold text-[#1f2937]'
              }`}
            >
              {item.affectTotal === false && amount === 0 ? '—' : `₹${amount.toFixed(2)}`}
            </td>
          </tr>
        );
      })}
    </>
  );
}
