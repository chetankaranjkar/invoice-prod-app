/**
 * Input validation and sanitization utilities
 */

// Email validation
export const isValidEmail = (email: string): boolean => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

// Phone number validation (basic)
export const isValidPhone = (phone: string): boolean => {
  if (!phone) return true; // Optional field
  // Allow digits, spaces, +, -, and parentheses
  const phoneRegex = /^[\d\s\+\-\(\)]+$/;
  return phoneRegex.test(phone.trim()) && phone.replace(/\D/g, '').length >= 10;
};

// GST Number validation (Indian format)
export const isValidGST = (gst: string): boolean => {
  if (!gst) return true; // Optional field
  // Indian GST format: 15 alphanumeric characters
  const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  return gstRegex.test(gst.toUpperCase().trim());
};

// PAN Number validation (Indian format)
export const isValidPAN = (pan: string): boolean => {
  if (!pan) return true; // Optional field
  // Indian PAN format: 5 letters, 4 digits, 1 letter
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  return panRegex.test(pan.toUpperCase().trim());
};

// IFSC Code validation (Indian format)
export const isValidIFSC = (ifsc: string): boolean => {
  if (!ifsc) return true; // Optional field
  // Indian IFSC format: 4 letters, 0, 6 alphanumeric
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  return ifscRegex.test(ifsc.toUpperCase().trim());
};

// Sanitize string input (remove potentially dangerous characters)
export const sanitizeString = (input: string): string => {
  if (!input) return '';
  // Remove script tags and dangerous characters
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .trim();
};

// Sanitize number input
export const sanitizeNumber = (input: string | number): number => {
  if (typeof input === 'number') {
    return isNaN(input) ? 0 : Math.max(0, input);
  }
  const num = parseFloat(input);
  return isNaN(num) ? 0 : Math.max(0, num);
};

// Validate required field
export const isRequired = (value: string | number | undefined | null): boolean => {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return true;
};

// Validate string length
export const isValidLength = (value: string, min: number, max: number): boolean => {
  if (!value) return min === 0;
  return value.length >= min && value.length <= max;
};

