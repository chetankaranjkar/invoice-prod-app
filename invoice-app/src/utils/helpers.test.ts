import { describe, it, expect } from 'vitest';
import {
  sellerInfoToCompanyInfo,
  formatCurrency,
  formatDate,
  getFinancialYearString,
  generateInvoiceNumber,
  amountToWords,
  calculateGST,
} from './helpers';

describe('sellerInfoToCompanyInfo', () => {
  it('converts camelCase seller info to CompanyInfo', () => {
    const sellerInfo = {
      name: 'Test Company',
      email: 'test@example.com',
      businessName: 'Business',
      gstNumber: 'GST123',
    };
    const result = sellerInfoToCompanyInfo(sellerInfo);
    expect(result.name).toBe('Test Company');
    expect(result.email).toBe('test@example.com');
    expect(result.businessName).toBe('Business');
    expect(result.gstNumber).toBe('GST123');
  });

  it('converts PascalCase seller info to CompanyInfo (API compatibility)', () => {
    const sellerInfo = {
      Name: 'Pascal Company',
      Email: 'pascal@example.com',
      BusinessName: 'Pascal Business',
      GstNumber: 'GST456',
    };
    const result = sellerInfoToCompanyInfo(sellerInfo);
    expect(result.name).toBe('Pascal Company');
    expect(result.email).toBe('pascal@example.com');
    expect(result.businessName).toBe('Pascal Business');
    expect(result.gstNumber).toBe('GST456');
  });

  it('returns empty string for name when missing', () => {
    const sellerInfo = {};
    const result = sellerInfoToCompanyInfo(sellerInfo);
    expect(result.name).toBe('');
  });
});

describe('formatCurrency', () => {
  it('formats number as INR currency', () => {
    expect(formatCurrency(1000)).toContain('1,000');
    expect(formatCurrency(1000)).toMatch(/₹|Rs|INR/i);
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBeDefined();
  });

  it('handles decimal amounts', () => {
    const result = formatCurrency(1234.56);
    expect(result).toBeDefined();
    expect(result).toContain('1');
  });
});

describe('formatDate', () => {
  it('formats date string', () => {
    const result = formatDate('2024-03-15');
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });

  it('formats Date object', () => {
    const result = formatDate(new Date('2024-03-15'));
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
  });
});

describe('getFinancialYearString', () => {
  it('returns FY format for April–March (e.g. 2024-25)', () => {
    const result = getFinancialYearString(new Date(2024, 5, 15)); // June 2024
    expect(result).toMatch(/\d{4}-\d{2}/);
    expect(result).toBe('2024-25');
  });

  it('returns previous FY for Jan–Mar', () => {
    const result = getFinancialYearString(new Date(2024, 0, 15)); // Jan 2024
    expect(result).toBe('2023-24');
  });

  it('returns 2025-26 for Jan–Mar 2026', () => {
    expect(getFinancialYearString(new Date(2026, 0, 15))).toBe('2025-26');  // Jan 2026
    expect(getFinancialYearString(new Date(2026, 2, 31))).toBe('2025-26');   // Mar 2026
  });

  it('returns 2026-27 from 1 Apr 2026 onwards', () => {
    expect(getFinancialYearString(new Date(2026, 3, 1))).toBe('2026-27');   // Apr 1, 2026
    expect(getFinancialYearString(new Date(2026, 11, 31))).toBe('2026-27'); // Dec 31, 2026
  });

  it('uses current date when no argument', () => {
    const result = getFinancialYearString();
    expect(result).toMatch(/\d{4}-\d{2}/);
  });
});

describe('generateInvoiceNumber', () => {
  it('generates format: PREFIX0001 / FY', () => {
    const result = generateInvoiceNumber('INV', 1, new Date(2024, 5, 1));
    expect(result).toMatch(/^INV\d{4}\s*\/\s*\d{4}-\d{2}$/);
    expect(result).toContain('INV');
    expect(result).toContain('0001');
  });

  it('pads number to 4 digits', () => {
    const result = generateInvoiceNumber('INV', 42, new Date(2024, 5, 1));
    expect(result).toContain('0042');
  });
});

describe('amountToWords', () => {
  it('converts amount to words', () => {
    const result = amountToWords(100);
    expect(result).toBeDefined();
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('handles zero', () => {
    const result = amountToWords(0);
    expect(result).toBeDefined();
  });
});

describe('calculateGST', () => {
  it('calculates GST correctly for 18%', () => {
    const result = calculateGST(100, 18);
    expect(result.gstAmount).toBe(18);
    expect(result.cgst).toBe(9);
    expect(result.sgst).toBe(9);
    expect(result.total).toBe(118);
  });

  it('calculates GST correctly for 12%', () => {
    const result = calculateGST(200, 12);
    expect(result.gstAmount).toBe(24);
    expect(result.cgst).toBe(12);
    expect(result.sgst).toBe(12);
    expect(result.total).toBe(224);
  });

  it('handles 0% GST', () => {
    const result = calculateGST(100, 0);
    expect(result.gstAmount).toBe(0);
    expect(result.cgst).toBe(0);
    expect(result.sgst).toBe(0);
    expect(result.total).toBe(100);
  });
});
