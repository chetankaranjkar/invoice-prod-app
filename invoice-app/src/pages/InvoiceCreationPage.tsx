import React, { useState, useEffect } from 'react';
import { InvoiceForm } from '../components/InvoiceForm';
import { InvoicePreview } from '../components/InvoicePreview';
import { DynamicInvoiceRenderer } from '../components/invoice-layout/DynamicInvoiceRenderer';
import TaxInvoice from '../components/static-invoice/TaxInvoice';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/agent';
import type { Customer, CreateInvoiceDto, InvoiceItem, PaymentStatus, InvoiceLayoutConfigDto, CompanyInfo } from '../types';
import { calculateGST, getFinancialYearString, parseLocalDate, getApiErrorMessage } from '../utils/helpers';

interface UserOption {
  id: string;
  name: string;
  email: string;
  businessName?: string;
  address?: string;
  headerLogoBgColor?: string;
  addressSectionBgColor?: string;
  headerLogoTextColor?: string;
  addressSectionTextColor?: string;
  taxPractitionerTitle?: string;
  membershipNo?: string;
  gstpNumber?: string;
  phone?: string;
  city?: string;
  state?: string;
  zip?: string;
}

/** Get value from API response - handles both camelCase and PascalCase */
function getProp<T = string>(obj: Record<string, unknown>, camel: string, pascal: string): T | undefined {
  const v = obj[camel] ?? obj[pascal];
  return v as T | undefined;
}

function userProfileToCompanyInfo(p: Record<string, unknown>): CompanyInfo {
  return {
    name: (getProp(p, 'name', 'Name') as string) ?? '',
    email: getProp(p, 'email', 'Email') as string | undefined,
    businessName: getProp(p, 'businessName', 'BusinessName') as string | undefined,
    gstNumber: getProp(p, 'gstNumber', 'GstNumber') as string | undefined,
    address: getProp(p, 'address', 'Address') as string | undefined,
    bankName: getProp(p, 'bankName', 'BankName') as string | undefined,
    accountNumber: (getProp(p, 'bankAccountNo', 'BankAccountNo') ?? getProp(p, 'accountNumber', 'AccountNumber')) as string | undefined,
    ifscCode: getProp(p, 'ifscCode', 'IfscCode') as string | undefined,
    panNumber: getProp(p, 'panNumber', 'PanNumber') as string | undefined,
    membershipNo: getProp(p, 'membershipNo', 'MembershipNo') as string | undefined,
    gstpNumber: getProp(p, 'gstpNumber', 'GstpNumber') as string | undefined,
    City: (getProp(p, 'city', 'City') ?? getProp(p, 'City', 'city')) as string | undefined,
    State: (getProp(p, 'state', 'State') ?? getProp(p, 'State', 'state')) as string | undefined,
    Zip: (getProp(p, 'zip', 'Zip') ?? getProp(p, 'Zip', 'zip')) as string | undefined,
    phone: getProp(p, 'phone', 'Phone') as string | undefined,
    logoUrl: getProp(p, 'logoUrl', 'LogoUrl') as string | undefined,
    headerLogoBgColor: getProp(p, 'headerLogoBgColor', 'HeaderLogoBgColor') as string | undefined,
    addressSectionBgColor: getProp(p, 'addressSectionBgColor', 'AddressSectionBgColor') as string | undefined,
    headerLogoTextColor: getProp(p, 'headerLogoTextColor', 'HeaderLogoTextColor') as string | undefined,
    addressSectionTextColor: getProp(p, 'addressSectionTextColor', 'AddressSectionTextColor') as string | undefined,
    gpayNumber: getProp(p, 'gpayNumber', 'GpayNumber') as string | undefined,
    taxPractitionerTitle: getProp(p, 'taxPractitionerTitle', 'TaxPractitionerTitle') as string | undefined,
  };
}

export const InvoiceCreationPage: React.FC = () => {
  const { profile, loadProfile } = useAuth();
  const userRole = profile?.role || 'User';
  const isAdmin = userRole === 'Admin';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('Unpaid');
  const [initialPayment, setInitialPayment] = useState<number>(0);
  const [invoicePrefix, setInvoicePrefix] = useState<string>('INV');
  const [invoiceNumberNumeric, setInvoiceNumberNumeric] = useState<number>(1);
  const [invoiceNumberError, setInvoiceNumberError] = useState<string>('');

  const handleInvoiceNumberNumericChange: React.Dispatch<React.SetStateAction<number>> = (value) => {
    setInvoiceNumberNumeric(typeof value === 'function' ? value(invoiceNumberNumeric) : value);
    setInvoiceNumberError('');
  };

  /** Build full invoice number: prefix + number (as entered) + FY (from invoiceDate) */
  const fullInvoiceNumber = `${invoicePrefix}${invoiceNumberNumeric} / ${getFinancialYearString(invoiceDate ? parseLocalDate(invoiceDate) : new Date())}`;
  const [layoutConfigs, setLayoutConfigs] = useState<InvoiceLayoutConfigDto[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<string>('static');

  const [items, setItems] = useState<Partial<InvoiceItem>[]>([
    { productName: '', quantity: 1, rate: 0, gstPercentage: 18 },
  ]);

  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserForInvoice, setSelectedUserForInvoice] = useState<string | null>(null);
  const [companyInfoForPreview, setCompanyInfoForPreview] = useState<CompanyInfo | null>(null);
  const [companyInfoLoading, setCompanyInfoLoading] = useState(false);

  useEffect(() => {
    if (profile?.defaultGstPercentage !== undefined && profile?.defaultGstPercentage !== null) {
      setItems(prev => prev.length ? [{ ...prev[0], gstPercentage: profile.defaultGstPercentage ?? 18 }] : [{ productName: '', quantity: 1, rate: 0, gstPercentage: profile.defaultGstPercentage ?? 18 }]);
    }
  }, [profile?.defaultGstPercentage]);

  useEffect(() => {
    if (userRole !== 'MasterUser') {
      loadCustomers();
    }
  }, [userRole, selectedUserForInvoice]);

  useEffect(() => {
    if (isAdmin) {
      loadUsers();
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && users.length > 0 && !selectedUserForInvoice && profile?.id) {
      setSelectedUserForInvoice(profile.id);
    }
  }, [isAdmin, users, selectedUserForInvoice, profile?.id]);

  useEffect(() => {
    loadInvoiceLayouts();
  }, []);

  useEffect(() => {
    const loadPrefix = async () => {
      let p = profile;
      if (isAdmin && selectedUserForInvoice && selectedUserForInvoice !== profile?.id) {
        try {
          const res = await api.user.getProfileById(selectedUserForInvoice);
          p = res.data;
        } catch {
          p = profile;
        }
      }
      setInvoicePrefix(p?.invoicePrefix || 'INV');
    };
    loadPrefix();
  }, [profile?.invoicePrefix, profile?.id, isAdmin, selectedUserForInvoice]);

  useEffect(() => {
    if (selectedUserForInvoice && isAdmin) {
      setCompanyInfoForPreview(null);
      setCompanyInfoLoading(true);
      const fallbackFromUsersList = () => {
        const u = users.find((x) => x.id === selectedUserForInvoice);
        if (u) {
          setCompanyInfoForPreview({
            name: u.name,
            email: u.email,
            businessName: u.businessName,
            address: u.address,
            headerLogoBgColor: u.headerLogoBgColor,
            addressSectionBgColor: u.addressSectionBgColor,
            headerLogoTextColor: u.headerLogoTextColor,
            addressSectionTextColor: u.addressSectionTextColor,
            taxPractitionerTitle: u.taxPractitionerTitle,
            membershipNo: u.membershipNo,
            gstpNumber: u.gstpNumber,
            phone: u.phone,
            City: u.city,
            State: u.state,
            Zip: u.zip,
          });
        } else {
          setCompanyInfoForPreview(null);
        }
      };
      api.user.getProfileById(selectedUserForInvoice)
        .then((r) => {
          const data = r.data;
          const profileObj = (data && typeof data === 'object'
            ? (('data' in data && data.data && typeof data.data === 'object') ? data.data : data)
            : {}) as Record<string, unknown>;
          setCompanyInfoForPreview(userProfileToCompanyInfo(profileObj));
        })
        .catch(() => {
          api.userManagement.getUserById(selectedUserForInvoice)
            .then((r) => {
              const u = (r.data || {}) as Record<string, unknown>;
              setCompanyInfoForPreview(userProfileToCompanyInfo(u));
            })
            .catch(() => fallbackFromUsersList());
        })
        .finally(() => setCompanyInfoLoading(false));
    } else {
      setCompanyInfoForPreview(null);
      setCompanyInfoLoading(false);
    }
  }, [selectedUserForInvoice, isAdmin, users]);

  const loadUsers = async () => {
    try {
      const response = await api.userManagement.getAllUsers();
      const list = response.data || [];
      setUsers(list.map((u: Record<string, unknown>) => ({
        id: String(getProp(u, 'id', 'Id') ?? ''),
        name: String(getProp(u, 'name', 'Name') ?? ''),
        email: String(getProp(u, 'email', 'Email') ?? ''),
        businessName: getProp(u, 'businessName', 'BusinessName') as string | undefined,
        address: getProp(u, 'address', 'Address') as string | undefined,
        headerLogoBgColor: getProp(u, 'headerLogoBgColor', 'HeaderLogoBgColor') as string | undefined,
        addressSectionBgColor: getProp(u, 'addressSectionBgColor', 'AddressSectionBgColor') as string | undefined,
        headerLogoTextColor: getProp(u, 'headerLogoTextColor', 'HeaderLogoTextColor') as string | undefined,
        addressSectionTextColor: getProp(u, 'addressSectionTextColor', 'AddressSectionTextColor') as string | undefined,
        taxPractitionerTitle: getProp(u, 'taxPractitionerTitle', 'TaxPractitionerTitle') as string | undefined,
        membershipNo: getProp(u, 'membershipNo', 'MembershipNo') as string | undefined,
        gstpNumber: getProp(u, 'gstpNumber', 'GstpNumber') as string | undefined,
        phone: getProp(u, 'phone', 'Phone') as string | undefined,
        city: getProp(u, 'city', 'City') as string | undefined,
        state: getProp(u, 'state', 'State') as string | undefined,
        zip: getProp(u, 'zip', 'Zip') as string | undefined,
      })));
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadCustomers = async () => {
    try {
      const response = isAdmin && selectedUserForInvoice
        ? await api.customers.getList(selectedUserForInvoice)
        : await api.customers.getList();
      setCustomers(response.data);
      setSelectedCustomer(null);
    } catch (error) {
      console.error('Failed to load customers:', error);
    }
  };

  const handleUserForInvoiceChange = (userId: string) => {
    setSelectedUserForInvoice(userId || null);
  };

  const loadInvoiceLayouts = async () => {
    try {
      const response = await api.invoiceLayouts.getList();
      const layouts = response.data || [];
      setLayoutConfigs(layouts);
      const defaultLayout = layouts.find((layout: InvoiceLayoutConfigDto) => layout.isDefault);
      if (defaultLayout) {
        setSelectedLayoutId(String(defaultLayout.id));
      }
    } catch (error) {
      console.error('Failed to load invoice layouts:', error);
    }
  };

  const handleInvoiceCreate = async (invoiceData: CreateInvoiceDto) => {
    setInvoiceNumberError('');
    try {
      await api.invoices.create(invoiceData);
      alert('Invoice created successfully!');

      // Clear all form data except selected customer
      setInvoiceItems([]);
      const refreshed = await loadProfile();
      const defaultGst = refreshed?.defaultGstPercentage ?? 18;
      setItems([{ productName: '', quantity: 1, rate: 0, gstPercentage: defaultGst }]);
      setInvoiceDate(new Date().toISOString().split('T')[0]);
      setPaymentStatus('Unpaid');
      setInitialPayment(0);
      await generateNextInvoiceNumber();
    } catch (error: any) {
      console.error('Failed to create invoice:', error);
      const msg = getApiErrorMessage(error, 'Please try again.');
      if (msg.toLowerCase().includes('already exists') || msg.toLowerCase().includes('duplicate')) {
        setInvoiceNumberError(msg);
      } else {
        alert(`Failed to create invoice: ${msg}`);
      }
    }
  };

  const handleCustomerAdded = async (customer: Customer) => {
    setCustomers(prev => [...prev, customer]);
    setSelectedCustomer(customer);
    // Generate invoice number when customer is added
    await generateNextInvoiceNumber();
  };

  const handleSelectedCustomer = async (id: number) => {
    const customer = customers.find(c => c.id === id) || null;
    setSelectedCustomer(customer);

    // Generate invoice number when customer is selected
    if (customer) {
      await generateNextInvoiceNumber();
    }
  };

  const generateNextInvoiceNumber = async () => {
    try {
      let p = profile;
      if (isAdmin && selectedUserForInvoice && selectedUserForInvoice !== profile?.id) {
        try {
          const res = await api.user.getProfileById(selectedUserForInvoice);
          p = res.data;
        } catch {
          p = profile;
        }
      }
      if (!p?.invoicePrefix) {
        p = await loadProfile();
      }
      const prefix = p?.invoicePrefix || 'INV';
      const fy = getFinancialYearString(invoiceDate ? parseLocalDate(invoiceDate) : new Date());
      const fySuffix = ` / ${fy}`;

      setInvoicePrefix(prefix);

      const invoicesResponse = await api.invoices.getList();
      const invoices = invoicesResponse.data || [];

      // Target user: when admin creates on behalf of another user, use that user; otherwise current user
      const targetUserId = (isAdmin && selectedUserForInvoice) ? selectedUserForInvoice : profile?.id;

      // Only consider invoices for the TARGET USER with same prefix AND current FY (format: INV0001 / 2024-25)
      const invoicesThisFy = invoices.filter(
        (inv: any) => {
          const invUserId = inv.userId ?? inv.UserId;
          if (targetUserId && invUserId !== targetUserId) return false;
          return (
            inv.invoiceNumber &&
            inv.invoiceNumber.startsWith(prefix) &&
            inv.invoiceNumber.endsWith(fySuffix)
          );
        }
      );

      let nextNumber = 1;
      if (invoicesThisFy.length > 0) {
        const numbers = invoicesThisFy.map((inv: any) => {
          const mid = inv.invoiceNumber.slice(prefix.length).replace(fySuffix, '').trim();
          return parseInt(mid, 10) || 0;
        }).filter((n: number) => n > 0);
        nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
      }

      setInvoiceNumberNumeric(nextNumber);
    } catch (error) {
      console.error('Failed to generate invoice number:', error);
      setInvoicePrefix('INV');
      setInvoiceNumberNumeric(1);
    }
  };

  // Update preview items whenever items state changes
  useEffect(() => {
    const previewItems: InvoiceItem[] = items
      .filter(item => item.productName && item.quantity && item.rate) // Only include valid items
      .map((item, index) => {
        const quantity = Number(item.quantity) || 0;
        const rate = Number(item.rate) || 0;
        const gstPercentage = Number(item.gstPercentage) || 0;
        const amount = quantity * rate;
        const { gstAmount, cgst, sgst } = calculateGST(amount, gstPercentage);

        return {
          id: index,
          productName: item.productName!,
          quantity: quantity,
          rate: rate,
          amount: amount,
          gstPercentage: gstPercentage,
          gstAmount: gstAmount,
          cgst: cgst,
          sgst: sgst,
        };
      });

    setInvoiceItems(previewItems);
  }, [items]);

  // MasterUser cannot create invoices
  if (userRole === 'MasterUser') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-8xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Restricted</h1>
            <p className="text-gray-600 mb-4">
              MasterUser cannot create invoices. Only Admin and User roles can create invoices.
            </p>
            <p className="text-gray-500 text-sm">
              MasterUser can only manage Admin users through User Management.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const selectedLayout = layoutConfigs.find((layout) => String(layout.id) === selectedLayoutId);
  const resolvedLayoutConfig = (() => {
    if (selectedLayout?.config?.sections) {
      return selectedLayout.config;
    }
    if (selectedLayout?.configJson) {
      try {
        return JSON.parse(selectedLayout.configJson);
      } catch {
        return null;
      }
    }
    return null;
  })();
  const hasVisibleSections = Boolean(
    resolvedLayoutConfig?.sections?.some((section: any) => section.visible !== false)
  );

  const onBehalfOfUserId = isAdmin && selectedUserForInvoice && selectedUserForInvoice !== profile?.id
    ? selectedUserForInvoice
    : undefined;

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-3 md:p-4 min-w-0 overflow-x-hidden">
      <div className="max-w-8xl mx-auto min-w-0 w-full">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-3 sm:mb-4 md:mb-6">Create Invoice</h1>

        {isAdmin && users.length > 0 && (
          <div className="mb-4 min-w-0 w-full">
            <label htmlFor="create-on-behalf-of" className="block text-sm font-medium text-gray-700 mb-1">Create invoice on behalf of</label>
            <select
              id="create-on-behalf-of"
              value={selectedUserForInvoice ?? ''}
              onChange={(e) => handleUserForInvoiceChange(e.target.value)}
              className="border rounded-md px-3 py-2 text-sm w-full min-w-0 max-w-full"
              aria-label="Select user to create invoice on behalf of"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email}){u.id === profile?.id ? ' (Myself)' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4 md:gap-6">
          {/* Left Side - Invoice Form */}
          <div className='lg:col-span-1'>
            <InvoiceForm
              customers={customers}
              onInvoiceCreate={handleInvoiceCreate}
              onCustomerAdded={handleCustomerAdded}
              handleSelectedCustomer={handleSelectedCustomer}
              items={items}
              setItems={setItems}
              invoicePrefix={invoicePrefix}
              invoiceNumberNumeric={invoiceNumberNumeric}
              setInvoiceNumberNumeric={handleInvoiceNumberNumericChange}
              invoiceNumberError={invoiceNumberError}
              invoiceDate={invoiceDate}
              setInvoiceDate={setInvoiceDate}
              paymentStatus={paymentStatus}
              setPaymentStatus={setPaymentStatus}
              initialPayment={initialPayment}
              setInitialPayment={setInitialPayment}
              onBehalfOfUserId={onBehalfOfUserId}
            />
          </div>

          {/* Right Side - Invoice Preview */}
          {selectedCustomer && (
            <div className='lg:col-span-2'>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-1.5">
                <label className="text-xs font-medium text-gray-700">Invoice Format</label>
                <select
                  value={selectedLayoutId}
                  onChange={(e) => setSelectedLayoutId(e.target.value)}
                  aria-label="Select invoice layout"
                  className="border rounded-md px-2 py-1 text-xs"
                >
                  <option value="classic">Classic (Current)</option>
                  <option value="static">Static Invoice</option>
                  {layoutConfigs.map((layout) => (
                    <option key={layout.id} value={String(layout.id)}>
                      {layout.name} {layout.isDefault ? '(Default)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {!hasVisibleSections && selectedLayoutId !== 'classic' && (
                <div className="mb-1.5 rounded-md bg-yellow-50 border border-yellow-200 px-2 py-1.5 text-xs text-yellow-800">
                  Selected layout has no visible sections. Please edit the layout or enable sections.
                </div>
              )}
              {selectedLayoutId === 'static' ? (
                <TaxInvoice
                  customer={selectedCustomer}
                  items={invoiceItems}
                  invoiceDate={invoiceDate}
                  invoiceNumber={fullInvoiceNumber}
                  paymentStatus={paymentStatus}
                  initialPayment={initialPayment}
                  companyInfo={companyInfoForPreview ?? undefined}
                  forceUseCompanyInfo={isAdmin && !!selectedUserForInvoice}
                  companyInfoLoading={companyInfoLoading}
                />
              ) : selectedLayoutId === 'classic' || !selectedLayout || !hasVisibleSections ? (
                <InvoicePreview
                  customer={selectedCustomer}
                  items={invoiceItems}
                  invoiceDate={invoiceDate}
                  invoiceNumber={fullInvoiceNumber}
                  paymentStatus={paymentStatus}
                  initialPayment={initialPayment}
                  companyInfo={companyInfoForPreview ?? undefined}
                  forceUseCompanyInfo={isAdmin && !!selectedUserForInvoice}
                />
              ) : (
                <DynamicInvoiceRenderer
                  layout={resolvedLayoutConfig}
                  customer={selectedCustomer}
                  items={invoiceItems}
                  invoiceDate={invoiceDate}
                  invoiceNumber={fullInvoiceNumber}
                  paymentStatus={paymentStatus}
                  initialPayment={initialPayment}
                  companyInfo={companyInfoForPreview ?? undefined}
                  forceUseCompanyInfo={isAdmin && !!selectedUserForInvoice}
                />
              )}
            </div>
          )}
          {!selectedCustomer && (
            <div className='lg:col-span-2 flex items-center justify-center bg-white rounded-lg shadow-md p-6'>
              <div className="text-center text-gray-500">
                <p className="text-base font-medium">Please select a customer to see the invoice preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};