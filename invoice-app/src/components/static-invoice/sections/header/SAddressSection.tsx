import type { CompanyInfo } from '../../../../types';

interface SAddressSectionProps {
  company: CompanyInfo | null;
}

function SAddressSection({ company }: SAddressSectionProps) {
  const address = company?.address || 'Company Address';
  const addressLines = address.split(';').map((s) => s.trim()).filter(Boolean);

  return (
    <div
      className="invoice-address w-full h-full text-right"
      style={{
        backgroundColor: company?.addressSectionBgColor || 'transparent',
        color: company?.addressSectionTextColor || 'inherit',
      }}
    >
      <div className="text-base print:text-sm text-current font-normal">
        {addressLines.map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </div>
      <p className="text-sm print:text-xs text-current">
        {company?.City}, {company?.State} {company?.Zip}
      </p>
      {company?.phone && (
        <p className="text-sm print:text-xs text-current">Mobile No: {company.phone}</p>
      )}
    </div>
  );
}
export default SAddressSection;