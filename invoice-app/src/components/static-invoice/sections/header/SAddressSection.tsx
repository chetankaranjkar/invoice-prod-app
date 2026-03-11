import type { CompanyInfo } from '../../../../types';
import { getEffectiveAddressFontSize } from '../../../../utils/helpers';

interface SAddressSectionProps {
  company: CompanyInfo | null;
}

function SAddressSection({ company }: SAddressSectionProps) {
  const fontSize = getEffectiveAddressFontSize(company);
  const address = company?.address || 'Company Address';
  const addressLines = address.split(';').map((s) => s.trim()).filter(Boolean);

  return (
    <div
      className="invoice-address w-full h-full text-right font-normal"
      style={{
        backgroundColor: company?.addressSectionBgColor || 'transparent',
        color: company?.addressSectionTextColor || 'inherit',
        fontSize: `${fontSize}px`,
      }}
    >
      <div className="text-current">
        {addressLines.map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </div>
      <p className="text-current">
        {company?.City}, {company?.State} {company?.Zip}
      </p>
      {company?.phone && (
        <p className="text-current">Mobile No: {company.phone}</p>
      )}
    </div>
  );
}
export default SAddressSection;