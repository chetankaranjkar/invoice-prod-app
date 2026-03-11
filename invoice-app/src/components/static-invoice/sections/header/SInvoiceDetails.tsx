interface SInvoiceDetailsProps {
  invoiceNumber: string;
  invoiceDate: string;
  /** Formatted date string for display (uses user's date format preference) */
  formattedInvoiceDate?: string;
}

function SInvoiceDetails({ invoiceNumber, invoiceDate, formattedInvoiceDate }: SInvoiceDetailsProps) {
  const displayDate = formattedInvoiceDate ?? invoiceDate;
  return (
    <div className="invoice-details w-full h-full bg-[#e5e7eb] p-2 rounded-lg shadow text-xs text-left">
      <h1 className="mb-1 text-xs font-semibold text-gray-900">Invoice</h1>
      <p className="text-xs text-gray-700"><strong>Invoice No:</strong> {invoiceNumber}</p>
      <p className="text-xs text-gray-700"><strong>Invoice Date:</strong> {displayDate}</p>
    </div>
  );
}
export default SInvoiceDetails;