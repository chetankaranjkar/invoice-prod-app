interface SInvoiceDetailsProps {
  invoiceNumber: string;
  invoiceDate: string;
  /** Formatted date string for display (uses user's date format preference) */
  formattedInvoiceDate?: string;
}

function SInvoiceDetails({ invoiceNumber, invoiceDate, formattedInvoiceDate }: SInvoiceDetailsProps) {
  const displayDate = formattedInvoiceDate ?? invoiceDate;
  return (
    <div className="invoice-details w-full h-full bg-[#f9fafb] p-3 rounded-lg border border-[#e5e7eb] border-l-4 border-l-[#1f2937] text-xs">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">
        Invoice Details
      </p>
      <table className="w-full">
        <tbody>
          <tr>
            <td className="py-0.5 text-xs font-semibold text-[#1f2937] pr-2">Invoice No</td>
            <td className="py-0.5 text-xs text-[#374151] text-right">{invoiceNumber}</td>
          </tr>
          <tr>
            <td className="py-0.5 text-xs font-semibold text-[#1f2937] pr-2">Invoice Date</td>
            <td className="py-0.5 text-xs text-[#374151] text-right">{displayDate}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
export default SInvoiceDetails;