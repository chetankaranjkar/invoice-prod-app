interface StaticInvoiceTotalsProps {
  totalAmount: number;
  totalGST: number;
  grandTotal: number;
  showTotalGst?: boolean;
  totalPaid: number;
  totalWave: number;
  balanceAmount: number;
  amountInWords: string;
}

function StaticInvoiceTotals({
  totalAmount,
  totalGST,
  grandTotal,
  showTotalGst = true,
  totalPaid,
  totalWave,
  balanceAmount,
  amountInWords,
}: StaticInvoiceTotalsProps) {
  const showBalanceRow = totalPaid > 0 || totalWave > 0;

  return (
    <div className="w-full h-full text-xs flex flex-col">
      {/* Totals breakdown */}
      <div className="rounded-lg border border-[#e5e7eb] overflow-hidden">
        <table className="w-full">
          <tbody>
            <tr className="border-b border-[#e5e7eb]">
              <td className="px-3 py-1.5 font-semibold text-[#374151]">Taxable Amount</td>
              <td className="px-3 py-1.5 text-right text-[#1f2937] tabular-nums">
                ₹{totalAmount.toFixed(2)}
              </td>
            </tr>
            {showTotalGst && (
              <tr className="border-b border-[#e5e7eb]">
                <td className="px-3 py-1.5 font-semibold text-[#374151]">Total GST</td>
                <td className="px-3 py-1.5 text-right text-[#1f2937] tabular-nums">
                  ₹{totalGST.toFixed(2)}
                </td>
              </tr>
            )}
            {totalWave > 0 && (
              <tr className="border-b border-[#e5e7eb]">
                <td className="px-3 py-1.5 font-semibold text-[#15803d]">Discount</td>
                <td className="px-3 py-1.5 text-right text-[#15803d] tabular-nums">
                  -₹{totalWave.toFixed(2)}
                </td>
              </tr>
            )}
            {totalPaid > 0 && (
              <tr className="border-b border-[#e5e7eb]">
                <td className="px-3 py-1.5 font-semibold text-[#15803d]">Paid Amount</td>
                <td className="px-3 py-1.5 text-right text-[#15803d] tabular-nums">
                  ₹{totalPaid.toFixed(2)}
                </td>
              </tr>
            )}
            <tr className="bg-[#1f2937] text-white">
              <td className="px-3 py-2 font-bold uppercase tracking-wide">Grand Total</td>
              <td className="px-3 py-2 text-right font-bold tabular-nums text-base">
                ₹{grandTotal.toFixed(2)}
              </td>
            </tr>
            {showBalanceRow && (
              <tr
                className="border-t-2"
                style={{
                  backgroundColor: balanceAmount > 0 ? '#fef2f2' : '#f0fdf4',
                  borderTopColor: balanceAmount > 0 ? '#dc2626' : '#16a34a',
                }}
              >
                <td
                  className="px-3 py-1.5 font-bold uppercase tracking-wide"
                  style={{ color: balanceAmount > 0 ? '#dc2626' : '#15803d' }}
                >
                  Balance Due
                </td>
                <td
                  className="px-3 py-1.5 text-right font-bold tabular-nums"
                  style={{ color: balanceAmount > 0 ? '#dc2626' : '#15803d' }}
                >
                  ₹{balanceAmount.toFixed(2)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Amount in words */}
      <div className="mt-2 px-3 py-2 rounded-lg bg-[#f9fafb] border border-[#e5e7eb]">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] mb-0.5">
          Amount in Words
        </p>
        <p className="text-xs italic text-[#1f2937] leading-snug">{amountInWords}</p>
      </div>
    </div>
  );
}

export default StaticInvoiceTotals;
