import React, { useState, useEffect } from 'react';
import { X, User, Building, Upload, Save, Trash2, Image, FileText, CreditCard, Receipt, Palette } from 'lucide-react';
import type { UserProfile, UpdateUserProfileDto } from '../types';
import { api } from '../services/agent';
import { useTheme } from '../contexts/ThemeContext';

type TabId = 'general' | 'tax' | 'bank' | 'invoice' | 'appearance';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'general', label: 'General', icon: <Building className="h-4 w-4" /> },
  { id: 'tax', label: 'Tax & Legal', icon: <FileText className="h-4 w-4" /> },
  { id: 'bank', label: 'Bank & Payment', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'invoice', label: 'Invoice Settings', icon: <Receipt className="h-4 w-4" /> },
  { id: 'appearance', label: 'Appearance', icon: <Palette className="h-4 w-4" /> },
];

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProfileUpdate: (profile: UserProfile) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  onProfileUpdate,
}) => {
  const { themeColors } = useTheme();
  const [, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<UpdateUserProfileDto>({});
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('general');

  useEffect(() => {
    if (isOpen) {
      loadProfile();
      setActiveTab('general');
    }
  }, [isOpen]);

  const loadProfile = async () => {
    try {
      const response = await api.user.getProfile();
      setProfile(response.data);
      setFormData({
        name: response.data.name,
        businessName: response.data.businessName,
        gstNumber: response.data.gstNumber,
        address: response.data.address,
        bankName: response.data.bankName,
        accountNumber: response.data.bankAccountNo || response.data.accountNumber || '',
        ifscCode: response.data.ifscCode,
        panNumber: response.data.panNumber,
        membershipNo: response.data.membershipNo,
        gstpNumber: response.data.gstpNumber,
        taxPractitionerTitle: response.data.taxPractitionerTitle,
        City: response.data.city,
        State: response.data.state,
        Zip: response.data.zip,
        phone: response.data.phone,
        headerLogoBgColor: response.data.headerLogoBgColor,
        addressSectionBgColor: response.data.addressSectionBgColor,
        headerLogoTextColor: response.data.headerLogoTextColor,
        addressSectionTextColor: response.data.addressSectionTextColor,
        gpayNumber: response.data.gpayNumber,
        invoicePrefix: response.data.invoicePrefix || 'INV',
        defaultGstPercentage: response.data.defaultGstPercentage ?? 18,
        disableQuantity: response.data.disableQuantity || false,
      });
      let logoUrl = response.data.logoUrl || '';
      if (logoUrl && logoUrl.trim() !== '') {
        if (logoUrl.startsWith('/uploads/') && !logoUrl.startsWith('http://') && !logoUrl.startsWith('https://')) {
          logoUrl = `http://localhost:5001${logoUrl}`;
        } else if (logoUrl.includes('https://localhost:7001')) {
          logoUrl = logoUrl.replace('https://localhost:7001', 'http://localhost:5001');
        } else if (logoUrl.includes('https://localhost')) {
          logoUrl = logoUrl.replace('https://localhost', 'http://localhost:5001');
        }
      }
      setLogoPreview(logoUrl);
    } catch (err: any) {
      setError('Failed to load profile');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setError('Image size should be less than 2MB');
        return;
      }
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
      setError('');
    }
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const profileData = {
        name: formData.name || '',
        businessName: formData.businessName || '',
        gstNumber: formData.gstNumber || '',
        address: formData.address || '',
        bankName: formData.bankName || '',
        bankAccountNo: formData.accountNumber || '',
        ifscCode: formData.ifscCode || '',
        panNumber: formData.panNumber || '',
        membershipNo: formData.membershipNo || '',
        gstpNumber: formData.gstpNumber || '',
        phone: formData.phone || '',
        City: formData.City || '',
        State: formData.State || 'Maharashtra',
        Zip: formData.Zip || '',
        headerLogoBgColor: formData.headerLogoBgColor || '',
        addressSectionBgColor: formData.addressSectionBgColor || '',
        headerLogoTextColor: formData.headerLogoTextColor || '',
        addressSectionTextColor: formData.addressSectionTextColor || '',
        gpayNumber: formData.gpayNumber || '',
        taxPractitionerTitle: formData.taxPractitionerTitle ?? '',
        invoicePrefix: formData.invoicePrefix || 'INV',
        defaultGstPercentage: formData.defaultGstPercentage ?? 18,
        disableQuantity: formData.disableQuantity || false
      };
      const response = await api.user.updateProfileWithLogo(profileData, logoFile || undefined);
      onProfileUpdate(response.data);
      onClose();
    } catch (err: any) {
      console.error('❌ Profile update failed:', err);
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1.5";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <User className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Company Profile & Settings</h2>
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
            {/* General Tab */}
            {activeTab === 'general' && (
              <div className="space-y-6">
                {/* Logo */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <Image className="h-4 w-4" /> Company Logo
                  </h3>
                  <div className="flex gap-6 items-start">
                    <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-white shrink-0">
                      {logoPreview ? (
                        <div className="relative w-full h-full">
                          <img src={logoPreview} alt="Logo" className="w-full h-full object-contain rounded p-1" />
                          <button type="button" onClick={removeLogo} className={`absolute -top-1 -right-1 ${themeColors.danger} text-white rounded-full p-0.5`}>
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <Upload className="h-8 w-8 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-gray-600 mb-3">PNG, JPG. Max 2MB. Appears on all invoices.</p>
                      <label>
                        <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
                        <span className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm ${themeColors.info} text-white rounded-md cursor-pointer hover:opacity-90`}>
                          <Upload className="h-4 w-4" /> Choose Logo
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Company Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Business Name *</label>
                    <input type="text" name="businessName" value={formData.businessName || ''} onChange={handleInputChange} className={inputClass} placeholder="Company name" required />
                  </div>
                  <div>
                    <label className={labelClass}>Contact Person *</label>
                    <input type="text" name="name" value={formData.name || ''} onChange={handleInputChange} className={inputClass} placeholder="Your name" required />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Title below company name</label>
                    <input type="text" name="taxPractitionerTitle" value={formData.taxPractitionerTitle || ''} onChange={handleInputChange} className={inputClass} placeholder="e.g. TAX GST PRACTITIONER" />
                  </div>
                  <div className="md:col-span-2">
                    <label className={labelClass}>Business Address <span className="text-xs text-gray-500 font-normal">(semicolon ; will appear as newline in invoice)</span></label>
                    <textarea name="address" value={formData.address || ''} onChange={handleInputChange} rows={2} className={inputClass} placeholder="Line 1; Line 2; Line 3" />
                  </div>
                  <div>
                    <label className={labelClass}>City</label>
                    <input type="text" name="City" value={formData.City || ''} onChange={handleInputChange} className={inputClass} placeholder="City" />
                  </div>
                  <div>
                    <label className={labelClass}>State</label>
                    <input type="text" name="State" value={formData.State || ''} onChange={handleInputChange} className={inputClass} placeholder="Maharashtra" />
                  </div>
                  <div>
                    <label className={labelClass}>Pincode</label>
                    <input type="text" name="Zip" value={formData.Zip || ''} onChange={handleInputChange} className={inputClass} placeholder="411018" />
                  </div>
                  <div>
                    <label className={labelClass}>Phone</label>
                    <input type="tel" name="phone" value={formData.phone || ''} onChange={handleInputChange} className={inputClass} placeholder="+91 9876543210" />
                  </div>
                </div>
              </div>
            )}

            {/* Tax & Legal Tab */}
            {activeTab === 'tax' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>GST Number</label>
                  <input type="text" name="gstNumber" value={formData.gstNumber || ''} onChange={handleInputChange} className={inputClass} placeholder="GSTIN" />
                </div>
                <div>
                  <label className={labelClass}>PAN Number</label>
                  <input type="text" name="panNumber" value={formData.panNumber || ''} onChange={handleInputChange} className={inputClass} placeholder="PAN" />
                </div>
                <div>
                  <label className={labelClass}>Membership No</label>
                  <input type="text" name="membershipNo" value={formData.membershipNo || ''} onChange={handleInputChange} className={inputClass} placeholder="Membership number" />
                </div>
                <div>
                  <label className={labelClass}>GSTP No</label>
                  <input type="text" name="gstpNumber" value={formData.gstpNumber || ''} onChange={handleInputChange} className={inputClass} placeholder="GSTP number" />
                </div>
              </div>
            )}

            {/* Bank & Payment Tab */}
            {activeTab === 'bank' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Bank Name</label>
                  <input type="text" name="bankName" value={formData.bankName || ''} onChange={handleInputChange} className={inputClass} placeholder="Bank name" />
                </div>
                <div>
                  <label className={labelClass}>Account Number</label>
                  <input type="text" name="accountNumber" value={formData.accountNumber || ''} onChange={handleInputChange} className={inputClass} placeholder="Account number" />
                </div>
                <div>
                  <label className={labelClass}>IFSC Code</label>
                  <input type="text" name="ifscCode" value={formData.ifscCode || ''} onChange={handleInputChange} className={inputClass} placeholder="IFSC code" />
                </div>
                <div>
                  <label className={labelClass}>GPay Number</label>
                  <input type="text" name="gpayNumber" value={formData.gpayNumber || ''} onChange={handleInputChange} className={inputClass} placeholder="GPay/UPI number" />
                </div>
              </div>
            )}

            {/* Invoice Settings Tab */}
            {activeTab === 'invoice' && (
              <div className="space-y-6 max-w-md">
                <div>
                  <label className={labelClass}>Invoice Prefix *</label>
                  <input type="text" name="invoicePrefix" value={formData.invoicePrefix || 'INV'} onChange={handleInputChange} className={inputClass} placeholder="INV" required maxLength={20} />
                  <p className="mt-1 text-xs text-gray-500">e.g. {formData.invoicePrefix || 'INV'}00001, {formData.invoicePrefix || 'INV'}00002</p>
                </div>
                <div>
                  <label className={labelClass}>Default GST % *</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      name="defaultGstPercentage"
                      value={formData.defaultGstPercentage ?? 18}
                      onChange={(e) => setFormData(prev => ({ ...prev, defaultGstPercentage: e.target.value === '' ? 18 : Number(e.target.value) }))}
                      readOnly={(formData.defaultGstPercentage ?? 18) === 0}
                      className={`${inputClass} w-24`}
                      min="0"
                      max="100"
                      step="0.01"
                    />
                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={(formData.defaultGstPercentage ?? 18) === 0}
                        onChange={(e) => setFormData(prev => ({ ...prev, defaultGstPercentage: e.target.checked ? 0 : 18 }))}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">Use 0% GST</span>
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">Default when adding items</p>
                </div>
                <div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" name="disableQuantity" checked={formData.disableQuantity || false} onChange={(e) => setFormData(prev => ({ ...prev, disableQuantity: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded" />
                    <span className="text-sm font-medium text-gray-700">Disable Quantity Field</span>
                  </label>
                  <p className="mt-1 text-xs text-gray-500 ml-6">Hide quantity; use 1 by default</p>
                </div>
              </div>
            )}

            {/* Appearance Tab */}
            {activeTab === 'appearance' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-800">Invoice Header</h3>
                  <div>
                    <label className={labelClass} id="headerLogoBg">Logo Background</label>
                    <input type="color" name="headerLogoBgColor" value={formData.headerLogoBgColor || '#ffffff'} onChange={handleInputChange} className="h-10 w-full rounded border border-gray-300 cursor-pointer" aria-labelledby="headerLogoBg" title="Header logo background color" />
                  </div>
                  <div>
                    <label className={labelClass} id="headerLogoText">Logo Text</label>
                    <input type="color" name="headerLogoTextColor" value={formData.headerLogoTextColor || '#111111'} onChange={handleInputChange} className="h-10 w-full rounded border border-gray-300 cursor-pointer" aria-labelledby="headerLogoText" title="Header logo text color" />
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-800">Address Section</h3>
                  <div>
                    <label className={labelClass} id="addressBg">Background</label>
                    <input type="color" name="addressSectionBgColor" value={formData.addressSectionBgColor || '#ffffff'} onChange={handleInputChange} className="h-10 w-full rounded border border-gray-300 cursor-pointer" aria-labelledby="addressBg" title="Address section background color" />
                  </div>
                  <div>
                    <label className={labelClass} id="addressText">Text Color</label>
                    <input type="color" name="addressSectionTextColor" value={formData.addressSectionTextColor || '#111111'} onChange={handleInputChange} className="h-10 w-full rounded border border-gray-300 cursor-pointer" aria-labelledby="addressText" title="Address section text color" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t bg-gray-50 shrink-0">
            <button type="button" onClick={onClose} className="px-5 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
              Cancel
            </button>
            <button type="submit" disabled={loading} className={`flex items-center gap-2 px-5 py-2 ${themeColors.info} text-white rounded-lg ${themeColors.infoHover} disabled:opacity-50 text-sm font-medium`}>
              <Save className="h-4 w-4" /> {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
