import { ToWords } from 'to-words';
import type { CompanyInfo, InvoiceSellerInfo } from '../types';

/** Extract user-friendly error message from API error. Handles string body, { message }, { detail }, { title }, and status-based fallbacks. */
export const getApiErrorMessage = (
  err: { response?: { data?: unknown; status?: number }; message?: string; code?: string },
  fallback = 'Something went wrong. Please try again.'
): string => {
  const data = err?.response?.data;
  if (typeof data === 'string' && data.trim()) return data.trim();
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const msg = obj.message ?? obj.Message ?? obj.detail ?? obj.Detail ?? obj.title ?? obj.Title ?? obj.error ?? obj.Error;
    if (typeof msg === 'string' && msg.trim()) return msg.trim();
  }
  if (err?.response?.status === 401) return 'Session expired. Please log in again.';
  if (err?.response?.status === 403) return 'You do not have permission to perform this action.';
  if (err?.response?.status === 404) return 'The requested resource was not found.';
  if (err?.response?.status === 500) return 'Server error. Please try again later.';
  if (err?.code === 'ECONNABORTED' || err?.message?.includes?.('timeout')) return 'Request timed out. Please check your connection.';
  if (err?.code === 'ERR_NETWORK' || !err?.response) return 'Cannot reach server. Please ensure the API is running.';
  return err?.message && typeof err.message === 'string' ? err.message : fallback;
};

/** API returns PascalCase (Newtonsoft.Json default); support both for robustness */
type SellerInfoRaw = InvoiceSellerInfo | Record<string, unknown>;

const get = (s: SellerInfoRaw, camel: string, pascal: string): string | undefined => {
  const val = (s as Record<string, unknown>)[camel] ?? (s as Record<string, unknown>)[pascal];
  return val != null ? String(val) : undefined;
};

const getNum = (s: SellerInfoRaw, camel: string, pascal: string): number | undefined => {
  const val = (s as Record<string, unknown>)[camel] ?? (s as Record<string, unknown>)[pascal];
  if (val == null) return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
};

const getBool = (s: SellerInfoRaw, camel: string, pascal: string): boolean => {
  const val = (s as Record<string, unknown>)[camel] ?? (s as Record<string, unknown>)[pascal];
  if (val == null) return true; // default when not in snapshot
  return val === true || val === 'true' || val === 1;
};

/** Convert invoice seller info (from API) to CompanyInfo for display. Handles both camelCase and PascalCase. */
export const sellerInfoToCompanyInfo = (s: SellerInfoRaw): CompanyInfo => ({
  name: get(s, 'name', 'Name') ?? '',
  email: get(s, 'email', 'Email'),
  businessName: get(s, 'businessName', 'BusinessName'),
  gstNumber: get(s, 'gstNumber', 'GstNumber'),
  address: get(s, 'address', 'Address'),
  bankName: get(s, 'bankName', 'BankName'),
  accountNumber: get(s, 'bankAccountNo', 'BankAccountNo'),
  ifscCode: get(s, 'ifscCode', 'IfscCode'),
  panNumber: get(s, 'panNumber', 'PanNumber'),
  membershipNo: get(s, 'membershipNo', 'MembershipNo'),
  gstpNumber: get(s, 'gstpNumber', 'GstpNumber'),
  City: get(s, 'city', 'City'),
  State: get(s, 'state', 'State'),
  Zip: get(s, 'zip', 'Zip'),
  phone: get(s, 'phone', 'Phone'),
  logoUrl: get(s, 'logoUrl', 'LogoUrl'),
  headerLogoBgColor: get(s, 'headerLogoBgColor', 'HeaderLogoBgColor'),
  addressSectionBgColor: get(s, 'addressSectionBgColor', 'AddressSectionBgColor'),
  headerLogoTextColor: get(s, 'headerLogoTextColor', 'HeaderLogoTextColor'),
  addressSectionTextColor: get(s, 'addressSectionTextColor', 'AddressSectionTextColor'),
  invoiceHeaderFontSize: getNum(s, 'invoiceHeaderFontSize', 'InvoiceHeaderFontSize'),
  addressSectionFontSize: getNum(s, 'addressSectionFontSize', 'AddressSectionFontSize'),
  useDefaultInvoiceFontSizes: getBool(s, 'useDefaultInvoiceFontSizes', 'UseDefaultInvoiceFontSizes'),
  gpayNumber: get(s, 'gpayNumber', 'GpayNumber'),
  taxPractitionerTitle: get(s, 'taxPractitionerTitle', 'TaxPractitionerTitle'),
});

/** Default: 12px. Use custom only when useDefaultInvoiceFontSizes is explicitly false. */
export const getEffectiveHeaderFontSize = (company: { useDefaultInvoiceFontSizes?: boolean; invoiceHeaderFontSize?: number } | null): number => {
  if (!company || company.useDefaultInvoiceFontSizes !== false) return 12;
  return company.invoiceHeaderFontSize ?? 12;
};

/** Default: 14px. Use custom only when useDefaultInvoiceFontSizes is explicitly false. */
export const getEffectiveAddressFontSize = (company: { useDefaultInvoiceFontSizes?: boolean; addressSectionFontSize?: number } | null): number => {
  if (!company || company.useDefaultInvoiceFontSizes !== false) return 14;
  return company.addressSectionFontSize ?? 14;
};

export const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
    }).format(amount);
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Format date using user preference. format: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, DD-MM-YYYY, MM-DD-YYYY, DD-MMM-yyyy */
export const formatDateWithPreference = (date: string | Date, format?: string | null): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const monthShort = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  switch (format) {
    case 'MM/DD/YYYY': return `${month}/${day}/${year}`;
    case 'YYYY-MM-DD': return `${year}-${month}-${day}`;
    case 'DD-MM-YYYY': return `${day}-${month}-${year}`;
    case 'MM-DD-YYYY': return `${month}-${day}-${year}`;
    case 'DD-MMM-yyyy': return `${day}-${monthShort}-${year}`;
    case 'DD/MM/YYYY':
    default: return `${day}/${month}/${year}`;
  }
};

export const formatDate = (date: string | Date): string => {
    return new Date(date).toLocaleDateString('en-IN');
};

/** Indian FY: Apr–Mar. e.g. "2025-26" for Apr 2025–Mar 2026. From 1 Apr 2026 → "2026-27". */
export const getFinancialYearString = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1; // 1=Jan, 4=Apr, 12=Dec
  const startYear = month >= 4 ? year : year - 1;
  const endYear = startYear + 1;
  return `${startYear}-${String(endYear % 100).padStart(2, '0')}`;
};

/** Parse YYYY-MM-DD as local date (avoids timezone issues with new Date(string)) */
export const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

/** Format: INV0001 / 2024-25 (prefix + 4-digit number + FY) */
export const generateInvoiceNumber = (prefix: string, number: number, date?: Date): string => {
  const fy = getFinancialYearString(date ?? new Date());
  return `${prefix}${number.toString().padStart(4, '0')} / ${fy}`;
};

export const amountToWords = (amount: number): string => {
    const toWords = new ToWords({
        localeCode: 'en-IN',
        converterOptions: {
            currency: true,
            ignoreDecimal: false,
            ignoreZeroCurrency: false,
        },
    });
    return toWords.convert(amount);
};

export const calculateGST = (amount: number, gstPercentage: number) => {
    const gstAmount = amount * (gstPercentage / 100);
    const cgst = gstAmount / 2;
    const sgst = gstAmount / 2;
    const total = amount + gstAmount;

    return {
        gstAmount,
        cgst,
        sgst,
        total,
    };
};