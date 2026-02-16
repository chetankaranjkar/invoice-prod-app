import type { Customer } from '../../../../types';

interface SInvoiceBillToProps {
  customer: Customer | null;
}

function SInvoiceBillTo({ customer }: SInvoiceBillToProps) {
  return (
    <div className="invoice-to w-full h-full bg-[#e5e7eb] p-2 rounded-lg shadow text-xs">
      <h1 className="mb-1 text-xs font-semibold text-gray-900">Billed To</h1>
      {customer ? (
        <>
          <p className="text-xs font-semibold text-gray-900">{customer.customerName}</p>
          <p className="text-xs text-gray-700">{customer.billingAddress}</p>
          <p className="text-xs text-gray-700">
            {customer.city}, {customer.state} {customer.zip}
          </p>
          <p className="text-xs text-gray-700"><strong>GSTIN</strong> {customer.gstNumber}</p>
          <p className="text-xs text-gray-700"><strong>PAN</strong> {customer.panNumber}</p>
        </>
      ) : (
        <p className="text-xs text-gray-500">No customer selected</p>
      )}
    </div>
  );
}
export default SInvoiceBillTo;