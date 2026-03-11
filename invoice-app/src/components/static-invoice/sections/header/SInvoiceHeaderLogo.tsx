import type { CompanyInfo } from '../../../../types';
import { getEffectiveHeaderFontSize } from '../../../../utils/helpers';

interface SInvoiceHeaderLogoProps {
  company: CompanyInfo | null;
}

function SInvoiceHeaderLogo({ company }: SInvoiceHeaderLogoProps) {
  const fontSize = getEffectiveHeaderFontSize(company);
  const titleSize = Math.min(fontSize + 4, 20);
  return (
    <div
      className="header-logo w-full h-full p-3"
      style={{
        backgroundColor: company?.headerLogoBgColor || 'transparent',
        color: company?.headerLogoTextColor || 'inherit',
        fontSize: `${fontSize}px`,
      }}
    >
      <h1 className="font-bold text-current uppercase" style={{ fontSize: `${titleSize}px` }}>
        {company?.businessName || company?.name || 'Company Name'}
      </h1>
      <p className="text-current">{company?.taxPractitionerTitle?.trim() || 'TAX GST PRACTITIONER'}</p>
      {company?.membershipNo && (
        <p className="text-current">MemberShip No: {company.membershipNo}</p>
      )}
      {company?.email && (
        <p className="text-current">Email: {company.email}</p>
      )}
      {company?.gstpNumber && (
        <p className="text-current">GSTP No: {company.gstpNumber}</p>
      )}
    </div>
  );
}

export default SInvoiceHeaderLogo;