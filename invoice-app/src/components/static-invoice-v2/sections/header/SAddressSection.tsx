import type { CompanyInfo } from '../../../../types';
import { getEffectiveAddressFontSize } from '../../../../utils/helpers';

interface SAddressSectionProps {
  company: CompanyInfo | null;
}

function SAddressSection({ company }: SAddressSectionProps) {
  const fontSize = getEffectiveAddressFontSize(company);
  const address = company?.address || 'Company Address';
  const addressLines = address.split(';').map((s) => s.trim()).filter(Boolean);
  const hasCityStateZip = company?.City || company?.State || company?.Zip;

  return (
    <div
      className="invoice-address w-full h-full text-right font-normal p-3 rounded border-l-2 border-[#1f2937]"
      style={{
        backgroundColor: company?.addressSectionBgColor || 'transparent',
        color: company?.addressSectionTextColor || 'inherit',
        fontSize: `${fontSize}px`,
      }}
    >
      <p className="text-current font-semibold uppercase tracking-wide mb-1" style={{ fontSize: `${Math.max(fontSize - 2, 9)}px`, opacity: 0.7 }}>
        Address
      </p>
      <div className="text-current leading-snug">
        {addressLines.map((line, i) => (
          <span key={i}>
            {i > 0 && <br />}
            {line}
          </span>
        ))}
      </div>
      {hasCityStateZip && (
        <p className="text-current leading-snug">
          {[company?.City, company?.State, company?.Zip].filter(Boolean).join(', ')}
        </p>
      )}
      {company?.phone && (
        <p className="text-current mt-1">
          <span className="font-semibold">Mobile:</span> {company.phone}
        </p>
      )}
    </div>
  );
}
export default SAddressSection;