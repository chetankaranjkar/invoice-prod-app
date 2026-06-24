import type { CompanyInfo } from '../../../../types';
import { getEffectiveHeaderFontSize } from '../../../../utils/helpers';
import { InvoiceSmallLogo } from '../../../invoice/InvoiceSmallLogo';

interface SInvoiceHeaderLogoProps {
  company: CompanyInfo | null;
}

function SInvoiceHeaderLogo({ company }: SInvoiceHeaderLogoProps) {
  const fontSize = getEffectiveHeaderFontSize(company);
  const titleSize = Math.min(fontSize + 8, 26);
  const hasCustomBg = !!company?.headerLogoBgColor;
  return (
    <div
      className="header-logo w-full h-full p-3 rounded"
      style={{
        backgroundColor: company?.headerLogoBgColor || 'transparent',
        color: company?.headerLogoTextColor || 'inherit',
        fontSize: `${fontSize}px`,
      }}
    >
      <div className="flex items-start gap-3">
        <InvoiceSmallLogo company={company} />
        <div className="min-w-0 flex-1">
      <h1
        className="font-extrabold text-current uppercase tracking-tight leading-tight"
        style={{ fontSize: `${titleSize}px` }}
      >
        {company?.businessName || company?.name || 'Company Name'}
      </h1>
      <p
        className="text-current font-medium tracking-wide uppercase mt-0.5"
        style={{ fontSize: `${Math.max(fontSize - 2, 9)}px`, opacity: hasCustomBg ? 0.9 : 0.75 }}
      >
        {company?.taxPractitionerTitle?.trim() || 'TAX GST PRACTITIONER'}
      </p>
      <div className="mt-1.5 space-y-0.5">
        {company?.membershipNo && (
          <p className="text-current">
            <span className="font-semibold">Membership No:</span> {company.membershipNo}
          </p>
        )}
        {company?.email && (
          <p className="text-current">
            <span className="font-semibold">Email:</span> {company.email}
          </p>
        )}
        {company?.gstpNumber && (
          <p className="text-current">
            <span className="font-semibold">GSTP No:</span> {company.gstpNumber}
          </p>
        )}
        {company?.gstNumber && (
          <p className="text-current">
            <span className="font-semibold">GSTIN:</span> {company.gstNumber}
          </p>
        )}
      </div>
        </div>
      </div>
    </div>
  );
}

export default SInvoiceHeaderLogo;