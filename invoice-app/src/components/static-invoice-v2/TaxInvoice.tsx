import { useMemo } from 'react';
import { ToWords } from 'to-words';
import type { CompanyInfo, Customer, InvoiceItem, Payment } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useDateFormat } from '../../hooks/useDateFormat';
import { resolveAssetUrl } from '../../utils/helpers';
import { InvoiceSignatureImage } from '../invoice/InvoiceSignatureImage';
import { calculateInvoiceTotals, normalizeInvoiceItemsForRender } from '../../utils/invoiceCalculations';
import StaticInvoiceHeader from './sections/header/StaticInvoiceHeader';
import StaticInvoiceItems from './sections/invoiceitems/invoicedata';
import BankandCost from './sections/BankandCost/BankandCost';

interface TaxInvoiceProps {
  customer: Customer | null;
  items: InvoiceItem[];
  invoiceDate: string;
  invoiceNumber: string;
  paymentStatus?: string;
  initialPayment?: number;
  waveAmount?: number;
  payments?: Payment[];
  /** When viewing another user's invoice (e.g. admin views user's invoice), pass the invoice creator's company info */
  companyInfo?: CompanyInfo | null;
  /** When true, never fall back to logged-in user's profile - use only companyInfo (or null/placeholder while loading) */
  forceUseCompanyInfo?: boolean;
  /** When true, company info is being loaded - show loading placeholder */
  companyInfoLoading?: boolean;
}

function TaxInvoice({
  customer,
  items,
  invoiceDate: invoiceDateProp,
  invoiceNumber,
  paymentStatus: _paymentStatus = 'Unpaid',
  initialPayment = 0,
  waveAmount = 0,
  companyInfo: companyInfoProp,
  forceUseCompanyInfo = false,
  companyInfoLoading = false,
}: TaxInvoiceProps) {
  const { profile } = useAuth();
  const formatDate = useDateFormat();
  const companyInfo = useMemo((): CompanyInfo | null => {
    if (companyInfoProp) return companyInfoProp;
    if (forceUseCompanyInfo && companyInfoLoading) {
      return { name: 'Loading...', businessName: 'Loading...' };
    }
    if (forceUseCompanyInfo) return null;
    if (!profile) return null;
    return {
      name: profile.name,
      email: profile.email,
      businessName: profile.businessName,
      gstNumber: profile.gstNumber,
      address: profile.address,
      bankName: profile.bankName,
      accountNumber: profile.bankAccountNo || profile.accountNumber,
      ifscCode: profile.ifscCode,
      panNumber: profile.panNumber,
      membershipNo: profile.membershipNo,
      gstpNumber: profile.gstpNumber,
      City: profile.city ?? profile.City,
      State: profile.state ?? profile.State,
      Zip: profile.zip ?? profile.Zip,
      phone: profile.phone,
      logoUrl: profile.logoUrl ? resolveAssetUrl(profile.logoUrl) : undefined,
      signatureUrl: profile.signatureUrl,
      includeSignatureOnInvoice: profile.includeSignatureOnInvoice,
      includeLogoOnInvoice: profile.includeLogoOnInvoice,
      headerLogoBgColor: profile.headerLogoBgColor,
      addressSectionBgColor: profile.addressSectionBgColor,
      headerLogoTextColor: profile.headerLogoTextColor,
      addressSectionTextColor: profile.addressSectionTextColor,
      invoiceHeaderFontSize: profile.invoiceHeaderFontSize,
      addressSectionFontSize: profile.addressSectionFontSize,
      useDefaultInvoiceFontSizes: profile.useDefaultInvoiceFontSizes,
      gpayNumber: profile.gpayNumber,
      taxPractitionerTitle: profile.taxPractitionerTitle,
    };
  }, [profile, companyInfoProp, forceUseCompanyInfo, companyInfoLoading]);
  const defaultGstPercentage = profile?.defaultGstPercentage ?? 18;
  const invoiceDate = invoiceDateProp || new Date().toISOString().split('T')[0];
  const toWords = new ToWords({
    localeCode: 'en-IN',
    converterOptions: {
      currency: true,
      ignoreDecimal: false,
      ignoreZeroCurrency: false,
      doNotAddOnly: false,
      currencyOptions: {
        name: 'Rupee',
        plural: 'Rupees',
        symbol: '₹',
        fractionalUnit: {
          name: 'Paisa',
          plural: 'Paise',
          symbol: '',
        },
      },
    },
  });

  const displayItems = useMemo(() => normalizeInvoiceItemsForRender(items), [items]);
  const invoiceTotals = useMemo(() => calculateInvoiceTotals(displayItems), [displayItems]);

  const totalPaid = Number(initialPayment) || 0;
  const totalWave = Number(waveAmount) || 0;
  const balanceAmount = Math.max(0, invoiceTotals.grandTotal - totalPaid - totalWave);
  const amountInWords = invoiceTotals.grandTotal > 0 && !isNaN(invoiceTotals.grandTotal)
    ? toWords.convert(invoiceTotals.grandTotal)
    : 'Zero Rupees Only';

  const totals = {
    totalAmount: invoiceTotals.totalAmount,
    totalGST: invoiceTotals.gstAmount,
    grandTotal: invoiceTotals.grandTotal,
  };

  return (
    <div className="static-invoice-v2 bg-white rounded-lg p-4 sm:p-6 md:p-8 border border-[#e5e7eb] shadow-sm">
      {/* Top accent bar */}
      <div className="static-invoice-v2-accent h-1 w-full bg-[#1f2937] rounded-t mb-4" />

      <StaticInvoiceHeader
        company={companyInfo}
        customer={customer}
        invoiceNumber={invoiceNumber}
        invoiceDate={invoiceDate}
        formattedInvoiceDate={formatDate(invoiceDate)}
      />
      <div className="my-2">
        <StaticInvoiceItems items={displayItems} />
      </div>
      <BankandCost
        company={companyInfo}
        totalAmount={totals.totalAmount}
        totalGST={totals.totalGST}
        grandTotal={totals.grandTotal}
        showTotalGst={defaultGstPercentage !== 0}
        totalPaid={totalPaid}
        totalWave={totalWave}
        balanceAmount={balanceAmount}
        amountInWords={amountInWords}
      />

      {/* Signature & Footer */}
      <div className="mt-8 invoice-signature">
        <div className="flex items-end justify-between gap-4">
          <div className="text-xs text-[#4b5563]">
            <p className="italic">Thank you for your business.</p>
            <p className="mt-1 text-[10px]">E.&amp; O.E</p>
          </div>
          <div className="text-right">
            <div className="h-12 w-48 flex items-end justify-end border-b border-[#1f2937] mb-1 overflow-hidden">
              <InvoiceSignatureImage
                company={companyInfo}
                className="max-h-10 max-w-full object-contain"
              />
            </div>
            <p className="text-xs font-semibold text-[#1f2937]">Authorised Signatory</p>
            <p className="text-[10px] text-[#4b5563] uppercase tracking-wide">
              {companyInfo?.businessName || companyInfo?.name || ''}
            </p>
          </div>
        </div>
        {/* Bottom accent bar */}
        <div className="static-invoice-v2-accent mt-6 h-1 w-full bg-[#1f2937] rounded-b" />
      </div>
    </div>
  );
}

export default TaxInvoice;