import type { CompanyInfo } from '../../types';
import { resolveAssetUrl, shouldShowInvoiceLogo } from '../../utils/helpers';

interface InvoiceSmallLogoProps {
  company: CompanyInfo | null | undefined;
  className?: string;
}

/** Compact logo for static invoice headers and classic preview. */
export function InvoiceSmallLogo({
  company,
  className = 'h-12 w-auto max-w-[96px] object-contain shrink-0',
}: InvoiceSmallLogoProps) {
  if (!shouldShowInvoiceLogo(company)) return null;

  return (
    <img
      src={resolveAssetUrl(company!.logoUrl)}
      alt={company?.businessName || company?.name || 'Company logo'}
      className={className}
      crossOrigin="anonymous"
    />
  );
}
