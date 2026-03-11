import React, { useState, useEffect } from 'react';
import { X, Edit, Save, Building2, Mail, MapPin, CreditCard, Share2 } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { Customer, CreateCustomerDto, UserListDto } from '../types';
import { api } from '../services/agent';
import { getApiErrorMessage } from '../utils/helpers';

interface EditCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  onCustomerUpdated: (customer: Customer) => void;
  /** Other customer names for duplicate check (exclude current customer). */
  existingCustomerNames?: string[];
}

type TabId = 'basic' | 'contact' | 'address' | 'banking' | 'share';

export const EditCustomerModal: React.FC<EditCustomerModalProps> = ({
  isOpen,
  onClose,
  customer,
  onCustomerUpdated,
  existingCustomerNames = [],
}) => {
  const { themeColors } = useTheme();
  const [formData, setFormData] = useState<CreateCustomerDto>({
    customerName: '',
    gstNumber: '',
    email: '',
    phone: '',
    billingAddress: '',
    bankName: '',
    bankAccountNo: '',
    ifscCode: '',
    panNumber: '',
    City: '',
    State: '',
    Zip: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState<string>('User');
  const [managedUsers, setManagedUsers] = useState<UserListDto[]>([]);
  const [sharedUserIds, setSharedUserIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>('basic');

  const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'basic', label: 'Basic Info', icon: <Building2 className="h-4 w-4" /> },
    { id: 'contact', label: 'Contact', icon: <Mail className="h-4 w-4" /> },
    { id: 'address', label: 'Address', icon: <MapPin className="h-4 w-4" /> },
    { id: 'banking', label: 'Banking', icon: <CreditCard className="h-4 w-4" /> },
    ...(userRole === 'Admin' ? [{ id: 'share' as TabId, label: 'Share', icon: <Share2 className="h-4 w-4" /> }] : []),
  ];

  // Load customer data when modal opens
  useEffect(() => {
    if (customer && isOpen) {
      setFormData({
        customerName: customer.customerName || '',
        gstNumber: customer.gstNumber || '',
        email: customer.email || '',
        phone: customer.phone || '',
        billingAddress: customer.billingAddress || '',
        bankName: customer.bankName || '',
        bankAccountNo: customer.bankAccountNo || '',
        ifscCode: customer.ifscCode || '',
        panNumber: customer.panNumber || '',
        City: customer.city || '',
        State: customer.state || '',
        Zip: customer.zip || '',
      });
      // Include owner (creator) in shared list so they show as checked - they have access by ownership
      const baseShared = customer.sharedWithUserIds || [];
      const ownerId = customer.userId;
      const initialShared = ownerId && !baseShared.includes(ownerId)
        ? [...baseShared, ownerId]
        : baseShared;
      setSharedUserIds(initialShared);
      setError('');
      setActiveTab('basic');
    }
  }, [customer, isOpen]);

  useEffect(() => {
    const loadRoleAndUsers = async () => {
      try {
        const profile = await api.user.getProfile();
        setUserRole(profile.data?.role || 'User');
        if (profile.data?.role === 'Admin') {
          const usersRes = await api.userManagement.getAllUsers();
          setManagedUsers(usersRes.data || []);
        }
      } catch {
        setManagedUsers([]);
      }
    };
    if (isOpen) loadRoleAndUsers();
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;

    setLoading(true);
    setError('');

    try {
      const response = await api.customers.update(customer.id, formData);
      if (userRole === 'Admin') {
        try {
          await api.customers.share(customer.id, sharedUserIds);
        } catch (shareErr: any) {
          setError(getApiErrorMessage(shareErr, 'Customer updated but failed to save share settings.'));
          setLoading(false);
          return;
        }
      }
      onCustomerUpdated({ ...response.data, sharedWithUserIds: sharedUserIds });
      onClose();
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Failed to update customer'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const toggleSharedUser = (userId: string) => {
    setSharedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5';

  const isDuplicateName = Boolean(formData.customerName?.trim() &&
    existingCustomerNames.some((n) => n.toLowerCase() === formData.customerName!.trim().toLowerCase()));

  if (!isOpen || !customer) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Edit className={`h-6 w-6 ${themeColors.accent}`} />
            <h2 className="text-xl font-semibold text-gray-900">Edit Customer</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Close" aria-label="Close modal">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 py-2 border-b bg-gray-50 overflow-x-auto shrink-0">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-white text-blue-600 shadow-sm border border-gray-200'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {error && (
            <div className={`mx-6 mt-4 ${themeColors.dangerLight} border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm`}>
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-6">
            {/* Basic Info Tab */}
            {activeTab === 'basic' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Customer Name *</label>
                    <input type="text" name="customerName" value={formData.customerName} onChange={handleChange} className={`${inputClass} ${isDuplicateName ? 'border-red-500' : ''}`} placeholder="Customer or company name" required />
                    {isDuplicateName && (
                      <p className="mt-1 text-sm text-red-600">A customer with this name already exists. Please use a different name.</p>
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>GST Number</label>
                    <input type="text" name="gstNumber" value={formData.gstNumber} onChange={handleChange} className={inputClass} placeholder="GSTIN" />
                  </div>
                  <div>
                    <label className={labelClass}>PAN Number</label>
                    <input type="text" name="panNumber" value={formData.panNumber} onChange={handleChange} className={inputClass} placeholder="PAN" />
                  </div>
                </div>
              </div>
            )}

            {/* Contact Tab */}
            {activeTab === 'contact' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Email Address</label>
                  <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputClass} placeholder="customer@example.com" />
                </div>
                <div>
                  <label className={labelClass}>Phone Number</label>
                  <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={inputClass} placeholder="+91 9876543210" />
                </div>
              </div>
            )}

            {/* Address Tab */}
            {activeTab === 'address' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className={labelClass}>Billing Address</label>
                  <textarea name="billingAddress" value={formData.billingAddress} onChange={handleChange} rows={3} className={inputClass} placeholder="Complete billing address" />
                </div>
                <div>
                  <label className={labelClass}>City</label>
                  <input type="text" name="City" value={formData.City} onChange={handleChange} className={inputClass} placeholder="City" />
                </div>
                <div>
                  <label className={labelClass}>State</label>
                  <input type="text" name="State" value={formData.State} onChange={handleChange} className={inputClass} placeholder="State" />
                </div>
                <div>
                  <label className={labelClass}>Pin Code</label>
                  <input type="text" name="Zip" value={formData.Zip} onChange={handleChange} className={inputClass} placeholder="Zip Code" />
                </div>
              </div>
            )}

            {/* Banking Tab */}
            {activeTab === 'banking' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Bank Name</label>
                  <input type="text" name="bankName" value={formData.bankName} onChange={handleChange} className={inputClass} placeholder="Bank name" />
                </div>
                <div>
                  <label className={labelClass}>Account Number</label>
                  <input type="text" name="bankAccountNo" value={formData.bankAccountNo} onChange={handleChange} className={inputClass} placeholder="Account number" />
                </div>
                <div>
                  <label className={labelClass}>IFSC Code</label>
                  <input type="text" name="ifscCode" value={formData.ifscCode} onChange={handleChange} className={inputClass} placeholder="IFSC code" />
                </div>
              </div>
            )}

            {/* Share Tab (Admin only) */}
            {activeTab === 'share' && userRole === 'Admin' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-600">
                  Assign <span className="font-bold text-gray-900">{formData.customerName || customer.customerName}</span> to users you manage so they can use it for invoices.
                </p>
                {managedUsers.length === 0 ? (
                  <p className="text-sm text-gray-500">No users to share with. Create users first from User Management.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                    {managedUsers.map(u => (
                      <label key={u.id} className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sharedUserIds.includes(u.id)}
                          onChange={() => toggleSharedUser(u.id)}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm font-medium">{u.name}</span>
                        <span className="text-xs text-gray-500">{u.email}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={loading || !formData.customerName?.trim() || isDuplicateName} className={`flex items-center gap-2 px-5 py-2 ${themeColors.info} text-white rounded-lg ${themeColors.infoHover} disabled:opacity-50 text-sm font-medium`}>
              <Save className="h-4 w-4" /> {loading ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
