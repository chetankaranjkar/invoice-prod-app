import type { CompanyInfo, Customer } from '../../../../types';
import SAddressSection from './SAddressSection';
import SInvoiceBillTo from './SInvoiceBillTo';
import SInvoiceDetails from './SInvoiceDetails';
import SInvoiceHeaderLogo from './SInvoiceHeaderLogo';

interface StaticInvoiceHeaderProps {
  company: CompanyInfo | null;
  customer: Customer | null;
  invoiceNumber: string;
  invoiceDate: string;
  formattedInvoiceDate?: string;
}

function StaticInvoiceHeader({ company, customer, invoiceNumber, invoiceDate, formattedInvoiceDate }: StaticInvoiceHeaderProps) {
  return (
    <>
      {/* TAX INVOICE label */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-semibold tracking-[0.2em] text-[#6b7280] uppercase">
          Tax Invoice
        </span>
        <span className="text-[10px] font-semibold tracking-[0.2em] text-[#6b7280] uppercase">
          # {invoiceNumber}
        </span>
      </div>

      <header className="invoice-header w-full flex justify-between items-stretch gap-4 mb-2">
        <div className="left-side w-[60%]">
          <SInvoiceHeaderLogo company={company} />
        </div>
        <div className="right-side w-[40%]">
          <SAddressSection company={company} />
        </div>
      </header>
      <div className="border-b-2 border-[#1f2937] mb-5" />

      <div className="secondrow w-full flex justify-between items-stretch mb-6 gap-3">
        <div className="left-side w-[60%]">
          <SInvoiceBillTo customer={customer} />
        </div>
        <div className="right-side w-[40%]">
          <SInvoiceDetails invoiceNumber={invoiceNumber} invoiceDate={invoiceDate} formattedInvoiceDate={formattedInvoiceDate} />
        </div>
      </div>
    </>
  );
}

export default StaticInvoiceHeader;