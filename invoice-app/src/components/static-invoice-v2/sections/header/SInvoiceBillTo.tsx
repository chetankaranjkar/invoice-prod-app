import type { Customer } from '../../../../types';

interface SInvoiceBillToProps {
  customer: Customer | null;
}

function SInvoiceBillTo({ customer }: SInvoiceBillToProps) {
  return (
    <div className="invoice-to w-full h-full bg-[#f9fafb] p-3 rounded-lg border border-[#e5e7eb] border-l-4 border-l-[#1f2937] text-xs">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#6b7280]">
        Billed To
      </p>
      {customer ? (
        <div className="space-y-0.5">
          <p className="text-sm font-bold text-[#1f2937] leading-tight">{customer.customerName}</p>
          {customer.billingAddress && (
            <p className="text-xs text-[#374151] leading-snug">{customer.billingAddress}</p>
          )}
          {(customer.city || customer.state || customer.zip) && (
            <p className="text-xs text-[#374151] leading-snug">
              {[customer.city, customer.state, customer.zip].filter(Boolean).join(', ')}
            </p>
          )}
          {customer.gstNumber && (
            <p className="text-xs text-[#374151]">
              <span className="font-semibold text-[#1f2937]">GSTIN:</span> {customer.gstNumber}
            </p>
          )}
          {customer.panNumber && (
            <p className="text-xs text-[#374151]">
              <span className="font-semibold text-[#1f2937]">PAN:</span> {customer.panNumber}
            </p>
          )}
        </div>
      ) : (
        <p className="text-xs text-[#6b7280] italic">No customer selected</p>
      )}
    </div>
  );
}
export default SInvoiceBillTo;