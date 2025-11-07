export type PaymentStatus = 'Unpaid' | 'Partially Paid' | 'Paid';

export interface CreateInvoiceDto {
  customerId: number;
  dueDate?: string;
  invoicePrefix: string;
  items: Omit<InvoiceItem, 'id' | 'amount' | 'gstAmount' | 'cgst' | 'sgst'>[];
  status?: PaymentStatus;
  initialPayment?: number;
}

export interface UserProfile {
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
  City?:string;
  State?:string;
  Zip?:string;
  phone?: string;
  logoUrl?: string;
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
  phone?: string;
  logoUrl?: string;
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
    City?:string;
    State?:string;
    Zip?:string;
    phone?: string;
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
    City?:string;
    State?:string;
    Zip?:string;
    phone?: string;
    logoUrl?: string;
    createdAt: string;
}

export interface Customer {
    id: number;
    customerName: string;
    gstNumber?: string;
    panNumber?: string;
    City?:string;
    State?:string;
    Zip?:string;
    email?: string;
    phone?: string;
    billingAddress?: string;
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
    City?:string;
    State?:string;
    Zip?:string;
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
  invoiceDate: string;
  dueDate?: string;
  totalAmount: number;
  gstPercentage: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
  paidAmount: number;
  balanceAmount: number;
  status: PaymentStatus; // Use the new type
  items: InvoiceItem[];
  payments: Payment[];
}

export interface Payment {
    id: number;
    amountPaid: number;
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