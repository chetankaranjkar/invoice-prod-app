import React, { useState } from 'react';
import { X, UserPlus, Save } from 'lucide-react';
import type { CreateCustomerDto } from '../types';
import { api } from '../services/agent';

interface AddCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCustomerAdded: (customer: any) => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
    isOpen,
    onClose,
    onCustomerAdded,
}) => {
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
        Zip: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await api.customers.create(formData);
            onCustomerAdded(response.data);
            setFormData({
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
                Zip: ''
            });
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create customer');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div className="flex items-center">
                        <UserPlus className="h-6 w-6 text-blue-600 mr-2" />
                        <h2 className="text-xl font-semibold text-gray-900">Add New Customer</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Customer Name */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Customer Name *
                            </label>
                            <input
                                type="text"
                                name="customerName"
                                value={formData.customerName}
                                onChange={handleChange}
                                required
                                className="input-field"
                                placeholder="Enter customer name"
                            />
                        </div>

                        {/* GST Number */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                GST Number
                            </label>
                            <input
                                type="text"
                                name="gstNumber"
                                value={formData.gstNumber}
                                onChange={handleChange}
                                className="input-field"
                                placeholder="GSTIN number"
                            />
                        </div>
                        {/* GST Number */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                PAN Number
                            </label>
                            <input
                                type="text"
                                name="panNumber"
                                value={formData.panNumber}
                                onChange={handleChange}
                                className="input-field"
                                placeholder="PAN number"
                            />
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Email Address
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                className="input-field"
                                placeholder="customer@example.com"
                            />
                        </div>

                        {/* Phone */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Phone Number
                            </label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                className="input-field"
                                placeholder="+91 9876543210"
                            />
                        </div>

                        {/* Bank Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Bank Name
                            </label>
                            <input
                                type="text"
                                name="bankName"
                                value={formData.bankName}
                                onChange={handleChange}
                                className="input-field"
                                placeholder="Bank name"
                            />
                        </div>

                        {/* Account Number */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Account Number
                            </label>
                            <input
                                type="text"
                                name="bankAccountNo"
                                value={formData.bankAccountNo}
                                onChange={handleChange}
                                className="input-field"
                                placeholder="Account number"
                            />
                        </div>

                        {/* IFSC Code */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                IFSC Code
                            </label>
                            <input
                                type="text"
                                name="ifscCode"
                                value={formData.ifscCode}
                                onChange={handleChange}
                                className="input-field"
                                placeholder="IFSC code"
                            />
                        </div>

                        {/* Billing Address */}
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Billing Address
                            </label>
                            <textarea
                                name="billingAddress"
                                value={formData.billingAddress}
                                onChange={handleChange}
                                rows={3}
                                className="input-field"
                                placeholder="Complete billing address"
                            />
                        </div>
                    </div>
                    {/* CITY */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            City
                        </label>
                        <input
                            type="text"
                            name="City"
                            value={formData.City}
                            onChange={handleChange}
                            className="input-field"
                            placeholder="City"
                        />
                    </div>
                    {/* State */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            State
                        </label>
                        <input
                            type="text"
                            name="State"
                            value={formData.State}
                            onChange={handleChange}
                            className="input-field"
                            placeholder="State"
                        />
                    </div>
                    {/* ZIP */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Pin Code
                        </label>
                        <input
                            type="text"
                            name="Zip"
                            value={formData.Zip}
                            onChange={handleChange}
                            className="input-field"
                            placeholder="Zip Code"
                        />
                    </div>
                    {/* Actions */}
                    <div className="flex justify-end space-x-3 pt-6 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !formData.customerName.trim()}
                            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Save className="h-4 w-4 mr-2" />
                            {loading ? 'Creating...' : 'Create Customer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};