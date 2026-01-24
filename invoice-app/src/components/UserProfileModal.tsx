import React, { useState, useEffect } from 'react';
import { X, User, Building, Upload, Save, Trash2 } from 'lucide-react';
import type { UserProfile, UpdateUserProfileDto } from '../types';
import { api } from '../services/agent';
import { useTheme } from '../contexts/ThemeContext';

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

    useEffect(() => {
        if (isOpen) {
            loadProfile();
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
                accountNumber: response.data.bankAccountNo || response.data.accountNumber || '', // Backend returns bankAccountNo
                ifscCode: response.data.ifscCode,
                panNumber: response.data.panNumber,
                City: response.data.city,
                State: response.data.state,
                Zip: response.data.zip,
                phone: response.data.phone,
                invoicePrefix: response.data.invoicePrefix || 'INV',
                defaultGstPercentage: response.data.defaultGstPercentage ?? 18,
                disableQuantity: response.data.disableQuantity || false,
            });
            // Process logoUrl to ensure it works in Docker (use direct API port)
            let logoUrl = response.data.logoUrl || '';
            if (logoUrl && logoUrl.trim() !== '') {
                // If it's a relative path starting with /uploads/, prepend direct API URL
                if (logoUrl.startsWith('/uploads/') && !logoUrl.startsWith('http://') && !logoUrl.startsWith('https://')) {
                    logoUrl = `http://localhost:5001${logoUrl}`;
                }
                // Fix old HTTPS URLs
                else if (logoUrl.includes('https://localhost:7001')) {
                    logoUrl = logoUrl.replace('https://localhost:7001', 'http://localhost:5001');
                }
                else if (logoUrl.includes('https://localhost')) {
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
            // Validate file type
            if (!file.type.startsWith('image/')) {
                setError('Please select an image file');
                return;
            }

            // Validate file size (max 2MB)
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

    // In the handleSubmit function, update the form data appending:
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Prepare profile data
            const profileData = {
                name: formData.name || '',
                businessName: formData.businessName || '',
                gstNumber: formData.gstNumber || '',
                address: formData.address || '',
                bankName: formData.bankName || '',
                bankAccountNo: formData.accountNumber || '', // Backend expects bankAccountNo
                ifscCode: formData.ifscCode || '',
                panNumber: formData.panNumber || '',
                phone: formData.phone || '',
                City: formData.City || '',
                State: formData.State || 'Maharashtra',
                Zip: formData.Zip || '',
                invoicePrefix: formData.invoicePrefix || 'INV',
                defaultGstPercentage: formData.defaultGstPercentage ?? 18,
                disableQuantity: formData.disableQuantity || false
            };

            // Use the fixed API method
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


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-2 sm:p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[95vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center">
                        <User className="h-6 w-6 text-blue-600 mr-2" />
                        <h2 className="text-xl font-semibold text-gray-900">Company Profile & Settings</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        title="Close"
                        aria-label="Close modal"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-8">
                    {error && (
                        <div className={`${themeColors.dangerLight} border border-red-200 text-red-600 px-4 py-3 rounded`}>
                            {error}
                        </div>
                    )}

                    {/* Logo Upload Section */}
                    <div className="border-b pb-8">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Company Logo</h3>
                        <div className="flex items-start space-x-6">
                            <div className="shrink-0">
                                <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                                    {logoPreview ? (
                                        <div className="relative">
                                            <img
                                                src={logoPreview}
                                                alt="Company Logo"
                                                className="w-28 h-28 object-contain rounded"
                                            />
                                            <button
                                                type="button"
                                                onClick={removeLogo}
                                                className={`absolute -top-2 -right-2 ${themeColors.danger} text-white rounded-full p-1 ${themeColors.dangerHover}`}
                                                title="Remove logo"
                                                aria-label="Remove logo"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    ) : (
                                        <Upload className="h-8 w-8 text-gray-400" />
                                    )}
                                </div>
                            </div>
                            <div className="flex-1">
                                <p className="text-sm text-gray-600 mb-4">
                                    Upload your company logo. It will appear on all your invoices.
                                    <br />
                                    Recommended: Square image, PNG format, max 2MB
                                </p>
                                <label className="block">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleLogoChange}
                                        className="hidden"
                                    />
                                    <span className={`cursor-pointer ${themeColors.info} text-white px-4 py-2 rounded-md ${themeColors.infoHover} inline-flex items-center`}>
                                        <Upload className="h-4 w-4 mr-2" />
                                        Choose Logo
                                    </span>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* Company Information */}
                    <div className="border-b pb-8">
                        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                            <Building className="h-5 w-5 mr-2" />
                            Company Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Business Name *
                                </label>
                                <input
                                    type="text"
                                    name="businessName"
                                    value={formData.businessName || ''}
                                    onChange={handleInputChange}
                                    className="input-field"
                                    placeholder="Your company name"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Contact Person Name *
                                </label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name || ''}
                                    onChange={handleInputChange}
                                    className="input-field"
                                    placeholder="Your name"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    GST Number
                                </label>
                                <input
                                    type="text"
                                    name="gstNumber"
                                    value={formData.gstNumber || ''}
                                    onChange={handleInputChange}
                                    className="input-field"
                                    placeholder="GSTIN number"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    PAN Number
                                </label>
                                <input
                                    type="text"
                                    name="panNumber"
                                    value={formData.panNumber || ''}
                                    onChange={handleInputChange}
                                    className="input-field"
                                    placeholder="PAN number"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone || ''}
                                    onChange={handleInputChange}
                                    className="input-field"
                                    placeholder="+91 9876543210"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Pincode
                                </label>
                                <input
                                    type="text"
                                    name="Zip"
                                    value={formData.Zip || ''}
                                    onChange={handleInputChange}
                                    className="input-field"
                                    placeholder="411018"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    City
                                </label>
                                <input
                                    type="text"
                                    name="City"
                                    value={formData.City || ''}
                                    onChange={handleInputChange}
                                    className="input-field"
                                    placeholder="City"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    State
                                </label>
                                <input
                                    type="text"
                                    name="State"
                                    value={formData.State || ''}
                                    onChange={handleInputChange}
                                    className="input-field"
                                    placeholder="Maharashtra"
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Business Address
                                </label>
                                <textarea
                                    name="address"
                                    value={formData.address || ''}
                                    onChange={handleInputChange}
                                    rows={3}
                                    className="input-field"
                                    placeholder="Complete business address"
                                />
                            </div>

                        </div>
                    </div>

                    {/* Bank Details */}
                    <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Bank Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Bank Name
                                </label>
                                <input
                                    type="text"
                                    name="bankName"
                                    value={formData.bankName || ''}
                                    onChange={handleInputChange}
                                    className="input-field"
                                    placeholder="Bank name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Account Number
                                </label>
                                <input
                                    type="text"
                                    name="accountNumber"
                                    value={formData.accountNumber || ''}
                                    onChange={handleInputChange}
                                    className="input-field"
                                    placeholder="Account number"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    IFSC Code
                                </label>
                                <input
                                    type="text"
                                    name="ifscCode"
                                    value={formData.ifscCode || ''}
                                    onChange={handleInputChange}
                                    className="input-field"
                                    placeholder="IFSC code"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Invoice Prefix *
                                </label>
                                <input
                                    type="text"
                                    name="invoicePrefix"
                                    value={formData.invoicePrefix || 'INV'}
                                    onChange={handleInputChange}
                                    className="input-field"
                                    placeholder="INV"
                                    required
                                    maxLength={20}
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    Your invoices will be numbered like: {formData.invoicePrefix || 'INV'}00001, {formData.invoicePrefix || 'INV'}00002, etc.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Default GST Percentage *
                                </label>
                                <input
                                    type="number"
                                    name="defaultGstPercentage"
                                    value={formData.defaultGstPercentage ?? 18}
                                    onChange={(e) => {
                                        const value = e.target.value === '' ? undefined : Number(e.target.value);
                                        setFormData(prev => ({ 
                                            ...prev, 
                                            defaultGstPercentage: value !== undefined ? value : 18 
                                        }));
                                    }}
                                    className="input-field"
                                    placeholder="18"
                                    required
                                    min="0"
                                    max="100"
                                    step="0.01"
                                />
                                <p className="mt-1 text-xs text-gray-500">
                                    This GST percentage will be used as default when adding items to invoices.
                                </p>
                            </div>

                            <div>
                                <label className="flex items-center">
                                    <input
                                        type="checkbox"
                                        name="disableQuantity"
                                        checked={formData.disableQuantity || false}
                                        onChange={(e) => setFormData(prev => ({ ...prev, disableQuantity: e.target.checked }))}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="ml-2 text-sm font-medium text-gray-700">
                                        Disable Quantity Field (Default: 1)
                                    </span>
                                </label>
                                <p className="mt-1 text-xs text-gray-500 ml-6">
                                    When enabled, quantity field will be hidden in invoice items and default value of 1 will be used.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end space-x-3 pt-6 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex items-center px-6 py-2 ${themeColors.info} text-white rounded-md ${themeColors.infoHover} disabled:opacity-50 disabled:cursor-not-allowed transition-colors`}
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {loading ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};