export type PaymentStatus = 'Draft' | 'Sent' | 'Unpaid' | 'Partially Paid' | 'Paid';

export interface CreateInvoiceDto {
  customerId: number;
  dueDate?: string;
  invoicePrefix: string;
  items: Omit<InvoiceItem, 'id' | 'amount' | 'gstAmount' | 'cgst' | 'sgst'>[];
  status?: PaymentStatus;
  initialPayment?: number;
}

export interface UpdateInvoiceDto {
  customerId: number;
  dueDate?: string;
  items: Omit<InvoiceItem, 'id' | 'amount' | 'gstAmount' | 'cgst' | 'sgst'>[];
  status?: PaymentStatus;
}

export interface InvoiceTemplateItemDto {
  productName: string;
  quantity: number;
  rate: number;
  gstPercentage: number;
}

export type InvoiceSectionType = 'Header' | 'SellerInfo' | 'BuyerInfo' | 'ItemsTable' | 'Totals' | 'Footer' | 'StaticText';
export type InvoiceSectionPosition = 'left' | 'center' | 'right';
export type InvoiceSectionAlignment = 'start' | 'center' | 'end';

export interface InvoiceLayoutSectionConfig {
  id: string;
  type: InvoiceSectionType;
  order: number;
  width: number;
  position: InvoiceSectionPosition;
  alignment: InvoiceSectionAlignment;
  visible?: boolean;
  content?: string;
  styles?: {
    padding?: string;
    margin?: string;
    height?: string;
    minHeight?: string;
  };
}

export interface InvoiceLayoutConfig {
  version: string;
  grid: {
    columns: number;
    gap?: string;
  };
  sections: InvoiceLayoutSectionConfig[];
}

export interface InvoiceLayoutConfigDto {
  id: number;
  name: string;
  description?: string;
  config: InvoiceLayoutConfig;
  configJson?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateInvoiceLayoutConfigDto {
  name: string;
  description?: string;
  config: InvoiceLayoutConfig;
  configJson?: string;
  isDefault: boolean;
}

export interface UpdateInvoiceLayoutConfigDto {
  name: string;
  description?: string;
  config: InvoiceLayoutConfig;
  configJson?: string;
  isDefault: boolean;
}

export interface CreateInvoiceTemplateDto {
  templateName: string;
  description?: string;
  items: InvoiceTemplateItemDto[];
}

export interface UpdateInvoiceTemplateDto {
  templateName: string;
  description?: string;
  items: InvoiceTemplateItemDto[];
}

export interface InvoiceTemplateDto {
  id: number;
  templateName: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  items: InvoiceTemplateItemDto[];
}

export interface RecurringInvoiceItemDto {
  productName: string;
  quantity: number;
  rate: number;
  gstPercentage: number;
}

export interface CreateRecurringInvoiceDto {
  name: string;
  customerId: number;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  dayOfMonth: number;
  startDate: string;
  endDate?: string;
  numberOfOccurrences?: number;
  description?: string;
  items: RecurringInvoiceItemDto[];
}

export interface UpdateRecurringInvoiceDto {
  name: string;
  customerId: number;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  dayOfMonth: number;
  startDate: string;
  endDate?: string;
  numberOfOccurrences?: number;
  isActive: boolean;
  description?: string;
  items: RecurringInvoiceItemDto[];
}

export interface RecurringInvoiceDto {
  id: number;
  name: string;
  customerId: number;
  customerName: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Yearly';
  dayOfMonth: number;
  startDate: string;
  endDate?: string;
  numberOfOccurrences?: number;
  generatedCount: number;
  isActive: boolean;
  lastGeneratedDate?: string;
  nextGenerationDate?: string;
  description?: string;
  createdAt: string;
  updatedAt?: string;
  items: RecurringInvoiceItemDto[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role?: string;
  businessName?: string;
  gstNumber?: string;
  address?: string;
  bankName?: string;
  accountNumber?: string;
  bankAccountNo?: string;
  ifscCode?: string;
  panNumber?: string;
  membershipNo?: string;
  gstpNumber?: string;
  City?: string;
  State?: string;
  Zip?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
  logoUrl?: string;
  headerLogoBgColor?: string;
  addressSectionBgColor?: string;
  headerLogoTextColor?: string;
  addressSectionTextColor?: string;
  gpayNumber?: string;
  taxPractitionerTitle?: string;
  defaultGstPercentage?: number;
  disableQuantity?: boolean;
  invoicePrefix?: string;
  createdAt: string;
}

// Add a separate interface for company info used in invoices
export interface CompanyInfo {
  name: string;
  email?: string;
  businessName?: string;
  gstNumber?: string;
  address?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  panNumber?: string;
  membershipNo?: string;
  gstpNumber?: string;
  City?: string;
  State?: string;
  Zip?: string;
  phone?: string;
  logoUrl?: string;
  headerLogoBgColor?: string;
  addressSectionBgColor?: string;
  headerLogoTextColor?: string;
  addressSectionTextColor?: string;
  gpayNumber?: string;
  taxPractitionerTitle?: string;
}

export interface UpdateUserProfileDto {
  name?: string;
  businessName?: string;
  gstNumber?: string;
  address?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  panNumber?: string;
  membershipNo?: string;
  gstpNumber?: string;
  City?: string;
  State?: string;
  Zip?: string;
  phone?: string;
  headerLogoBgColor?: string;
  addressSectionBgColor?: string;
  headerLogoTextColor?: string;
  addressSectionTextColor?: string;
  gpayNumber?: string;
  taxPractitionerTitle?: string;
  invoicePrefix?: string;
  defaultGstPercentage?: number;
  disableQuantity?: boolean;
  logo?: File;
}

// Update existing User interface to match backend
export interface User {
  id: string;
  name: string;
  email: string;
  businessName?: string;
  gstNumber?: string;
  address?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  panNumber?: string;
  membershipNo?: string;
  gstpNumber?: string;
  City?: string;
  State?: string;
  Zip?: string;
  phone?: string;
  logoUrl?: string;
  headerLogoBgColor?: string;
  addressSectionBgColor?: string;
  headerLogoTextColor?: string;
  addressSectionTextColor?: string;
  gpayNumber?: string;
  createdAt: string;
}

export interface Customer {
  id: number;
  customerName: string;
  gstNumber?: string;
  panNumber?: string;
  city?: string;
  state?: string;
  zip?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  bankName?: string;
  bankAccountNo?: string;
  ifscCode?: string;
  totalBalance: number;
  createdAt: string;

}

export interface CreateCustomerDto {
  customerName: string;
  gstNumber?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  bankName?: string;
  bankAccountNo?: string;
  ifscCode?: string;
  panNumber?: string;
  City?: string;
  State?: string;
  Zip?: string;
}

export interface InvoiceItem {
  id?: number;
  productName: string;
  quantity: number;
  rate: number;
  amount: number;
  gstPercentage: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  customerId: number;
  customerName?: string;
  userName?: string; // Name of the user who created the invoice (for admin view)
  invoiceDate: string;
  dueDate?: string;
  totalAmount: number;
  gstPercentage: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
  paidAmount: number; // Actual payment received (excluding wave)
  waveAmount: number; // Total wave off/discount amount
  balanceAmount: number;
  status: PaymentStatus; // Use the new type
  items: InvoiceItem[];
  payments: Payment[];
}

export interface Payment {
  id: number;
  amountPaid: number;
  waveAmount: number; // Wave off amount
  paymentDate: string;
  paymentMode?: string;
  remarks?: string;
}

export interface CreateInvoiceDto {
  customerId: number;
  dueDate?: string;
  invoicePrefix: string;
  items: Omit<InvoiceItem, 'id' | 'amount' | 'gstAmount' | 'cgst' | 'sgst'>[];
  status?: PaymentStatus; // Use the PaymentStatus type
  initialPayment?: number;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  userId: string;
  email: string;
  name: string;
  expires: string;
}

export interface DashboardStats {
  totalPendingAmount: number;
  totalCustomers: number;
  paidCustomersCount: number;
  unpaidCustomersCount: number;
  recentInvoices: Invoice[];
}

export interface UserListDto {
  id: string;
  name: string;
  email: string;
  role: string;
  businessName?: string;
  createdAt: string;
  createdByName?: string; // Name of the user who created this user
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  role?: string;
  businessName?: string;
  gstNumber?: string;
  address?: string;
  bankName?: string;
  bankAccountNo?: string;
  ifscCode?: string;
  panNumber?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
}