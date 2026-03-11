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
      <header className="invoice-header w-full flex justify-between items-stretch">
        <div className="left-side w-[60%] h-full">
          <SInvoiceHeaderLogo company={company} />
        </div>
        <div className="right-side w-[40%] h-full">
          <SAddressSection company={company} />
        </div>
      </header>
      <hr className="mb-4" />
      <div className="secondrow w-full flex justify-between items-stretch mb-6 gap-2">
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