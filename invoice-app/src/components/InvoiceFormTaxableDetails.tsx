interface InvoiceFormTaxableDetailsProps {
  totalAmount: number;
  grandTotal: number;
  amountInWords: string;
  hideGst?: boolean;
}

export const InvoiceFormTaxableDetails = ({
  totalAmount,
  grandTotal,
  amountInWords,
  hideGst = false,
}: InvoiceFormTaxableDetailsProps) => {
  return (
    <div className="invoice-summary">
      <table className="w-full text-left text-xs">
        <tbody>
          {!hideGst && (
            <tr>
              <td className="py-1"><strong>Taxable Amount:</strong></td>
              <td className="py-1 text-right">₹{totalAmount.toFixed(2)}</td>
            </tr>
          )}
          <tr className="font-bold">
            <td className="py-1">{hideGst ? 'Total:' : 'Grand Total:'}</td>
            <td className="py-1 text-right">₹{grandTotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td colSpan={2}>
              <hr className="border-[#99a1af] my-3" />
            </td>
          </tr>
          <tr>
            <td className="py-1" colSpan={2}>
              <strong>Amount in Words:</strong> {amountInWords}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
