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
  balanceAmount: _balanceAmount,
  amountInWords,
}: StaticInvoiceTotalsProps) {
  return (
    <div className="w-full text-sm">
      <table className="w-full">
        <tbody>
          <tr>
            <td className="py-0.5 font-semibold">Taxable Amount</td>
            <td className="py-0.5 text-right">₹{totalAmount.toFixed(2)}</td>
          </tr>
          {showTotalGst && (
            <tr>
              <td className="py-0.5 font-semibold">Total GST</td>
              <td className="py-0.5 text-right">₹{totalGST.toFixed(2)}</td>
            </tr>
          )}
          <tr className="font-bold">
            <td className="py-0.5">Grand Total</td>
            <td className="py-0.5 text-right">₹{grandTotal.toFixed(2)}</td>
          </tr>
          {totalWave > 0 && (
            <tr>
              <td className="py-0.5 text-green-700">Discount</td>
              <td className="py-0.5 text-right text-green-700">-₹{totalWave.toFixed(2)}</td>
            </tr>
          )}
          {totalPaid > 0 && (
            <tr>
              <td className="py-0.5 text-green-700">Paid Amount</td>
              <td className="py-0.5 text-right text-green-700">₹{totalPaid.toFixed(2)}</td>
            </tr>
          )}
          <tr>
            <td className="py-0.5" colSpan={2}>
              <strong className="font-bold">Amount in Words:</strong> {amountInWords}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export default StaticInvoiceTotals;
