
import type { CompanyInfo } from '../../../../types';

interface SInvoiceHeaderLogoProps {
  company: CompanyInfo | null;
}

function SInvoiceHeaderLogo({ company }: SInvoiceHeaderLogoProps) {
  return (
    <div
      className="header-logo w-full h-full p-3"
      style={{
        backgroundColor: company?.headerLogoBgColor || 'transparent',
        color: company?.headerLogoTextColor || 'inherit',
      }}
    >
      <h1 className="text-xl font-bold text-current uppercase">
        {company?.businessName || company?.name || 'Company Name'}
      </h1>
      <p className="text-xs text-current">{company?.taxPractitionerTitle?.trim() || 'TAX GST PRACTITIONER'}</p>
      {company?.membershipNo && (
        <p className="text-xs text-current">MemberShip No: {company.membershipNo}</p>
      )}
      {company?.email && (
        <p className="text-xs text-current">Email: {company.email}</p>
      )}
      {company?.gstpNumber && (
        <p className="text-xs text-current">GSTP No: {company.gstpNumber}</p>
      )}
    </div>
  );
}

export default SInvoiceHeaderLogo;