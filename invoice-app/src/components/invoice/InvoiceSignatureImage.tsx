import type { CompanyInfo } from '../../types';
import { resolveAssetUrl, shouldShowInvoiceSignature } from '../../utils/helpers';

interface InvoiceSignatureImageProps {
  company: CompanyInfo | null | undefined;
  className?: string;
}

export function InvoiceSignatureImage({
  company,
  className = 'max-h-10 max-w-[140px] object-contain',
}: InvoiceSignatureImageProps) {
  if (!shouldShowInvoiceSignature(company)) return null;

  return (
    <img
      src={resolveAssetUrl(company!.signatureUrl)}
      alt="Authorised Signature"
      className={className}
      crossOrigin="anonymous"
    />
  );
}
