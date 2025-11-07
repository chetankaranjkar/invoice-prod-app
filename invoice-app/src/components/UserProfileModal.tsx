import React, { useState, useEffect } from 'react';
import { X, User, Building, Upload, Save, Trash2 } from 'lucide-react';
import type { UserProfile, UpdateUserProfileDto } from '../types';
import { api } from '../services/agent';

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
    const [profile, setProfile] = useState<UserProfile | null>(null);
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
                accountNumber: response.data.accountNumber,
                ifscCode: response.data.ifscCode,
                panNumber: response.data.panNumber,
                phone: response.data.phone,
            });
            setLogoPreview(response.data.logoUrl || '');
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
      accountNumber: formData.accountNumber || '',
      ifscCode: formData.ifscCode || '',
      panNumber: formData.panNumber || '',
      phone: formData.phone || '',
    };

    console.log('📤 Submitting profile data:', profileData);
    console.log('📁 Logo file:', logoFile ? `Present (${logoFile.name})` : 'Not provided');

    // Use the fixed API method
    const response = await api.user.updateProfileWithLogo(profileData, logoFile || undefined);
    
    console.log('✅ Profile updated successfully:', response.data);
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center">
                        <User className="h-6 w-6 text-blue-600 mr-2" />
                        <h2 className="text-xl font-semibold text-gray-900">Company Profile & Settings</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-8">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    {/* Logo Upload Section */}
                    <div className="border-b pb-8">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Company Logo</h3>
                        <div className="flex items-start space-x-6">
                            <div className="flex-shrink-0">
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
                                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
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
                                    <span className="cursor-pointer bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 inline-flex items-center">
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
                            className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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