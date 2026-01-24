import React, { useState, useMemo } from 'react';
import { X, UserPlus, Save, Building2, Mail, Phone, MapPin, CreditCard, FileText, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import type { CreateCustomerDto } from '../types';
import { api } from '../services/agent';

interface AddCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCustomerAdded: (customer: any) => void;
}

type FormSection = 'basic' | 'contact' | 'address' | 'banking';

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
    isOpen,
    onClose,
    onCustomerAdded,
}) => {
    const { themeColors } = useTheme();
    const [activeSection, setActiveSection] = useState<FormSection>('basic');
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
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [sectionErrors, setSectionErrors] = useState<Record<FormSection, string[]>>({
        basic: [],
        contact: [],
        address: [],
        banking: []
    });

    const sections: { id: FormSection; label: string; icon: React.ReactNode }[] = [
        { id: 'basic', label: 'Basic Info', icon: <Building2 className="h-4 w-4" /> },
        { id: 'contact', label: 'Contact', icon: <Mail className="h-4 w-4" /> },
        { id: 'address', label: 'Address', icon: <MapPin className="h-4 w-4" /> },
        { id: 'banking', label: 'Banking', icon: <CreditCard className="h-4 w-4" /> },
    ];

    const handleSubmit = async (e?: React.FormEvent) => {
        if (e) {
            e.preventDefault();
        }

        // Mark all fields as touched and validate all sections
        const allFields: (keyof CreateCustomerDto)[] = [
            'customerName', 'gstNumber', 'panNumber', 'email', 'phone',
            'billingAddress', 'City', 'State', 'Zip',
            'bankName', 'bankAccountNo', 'ifscCode'
        ];

        allFields.forEach(field => {
            setTouched(prev => ({ ...prev, [field]: true }));
        });

        // Validate all sections
        const sectionsToValidate: FormSection[] = ['basic', 'contact', 'address', 'banking'];
        let allValid = true;
        sectionsToValidate.forEach(section => {
            if (!validateSection(section)) {
                allValid = false;
            }
        });

        if (!allValid) {
            // If validation fails, go to the first section with errors
            for (const section of sectionsToValidate) {
                if (sectionErrors[section].length > 0) {
                    setActiveSection(section);
                    break;
                }
            }
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await api.customers.create(formData);
            onCustomerAdded(response.data);
            // Reset form
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
            setTouched({});
            setSectionErrors({ basic: [], contact: [], address: [], banking: [] });
            setActiveSection('basic');
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
        setTouched(prev => ({ ...prev, [name]: true }));
    };

    const handleBlur = (fieldName: string) => {
        setTouched(prev => ({ ...prev, [fieldName]: true }));
    };

    const validateField = (fieldName: keyof CreateCustomerDto, value: any): string | null => {
        const trimmedValue = value?.toString().trim() || '';

        if (!trimmedValue) {
            return `${getFieldLabel(fieldName)} is required`;
        }

        // Email validation
        if (fieldName === 'email') {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(trimmedValue)) {
                return 'Please enter a valid email address';
            }
        }

        // Phone validation (should be at least 10 digits)
        if (fieldName === 'phone') {
            const phoneRegex = /^[\d\s\+\-\(\)]{10,}$/;
            if (!phoneRegex.test(trimmedValue.replace(/\s/g, ''))) {
                return 'Please enter a valid phone number (at least 10 digits)';
            }
        }

        // GST validation (15 characters)
        if (fieldName === 'gstNumber' && trimmedValue.length > 0) {
            if (trimmedValue.length !== 15) {
                return 'GST number must be 15 characters';
            }
        }

        // PAN validation (10 characters)
        if (fieldName === 'panNumber' && trimmedValue.length > 0) {
            if (trimmedValue.length !== 10) {
                return 'PAN number must be 10 characters';
            }
        }

        // IFSC validation (11 characters)
        if (fieldName === 'ifscCode' && trimmedValue.length > 0) {
            if (trimmedValue.length !== 11) {
                return 'IFSC code must be 11 characters';
            }
        }

        // Pin Code validation (6 digits)
        if (fieldName === 'Zip' && trimmedValue.length > 0) {
            if (!/^\d{6}$/.test(trimmedValue)) {
                return 'Pin code must be 6 digits';
            }
        }

        return null;
    };

    const getFieldLabel = (fieldName: keyof CreateCustomerDto): string => {
        const labels: Record<string, string> = {
            customerName: 'Customer Name',
            gstNumber: 'GST Number',
            panNumber: 'PAN Number',
            email: 'Email Address',
            phone: 'Phone Number',
            billingAddress: 'Billing Address',
            City: 'City',
            State: 'State',
            Zip: 'Pin Code',
            bankName: 'Bank Name',
            bankAccountNo: 'Account Number',
            ifscCode: 'IFSC Code'
        };
        return labels[fieldName] || fieldName;
    };

    const validateSection = (section: FormSection): boolean => {
        const errors: string[] = [];

        switch (section) {
            case 'basic':
                if (!formData.customerName?.trim()) errors.push('Customer Name is required');
                if (!formData.gstNumber?.trim()) errors.push('GST Number is required');
                if (!formData.panNumber?.trim()) errors.push('PAN Number is required');
                // Validate formats
                const gstError = validateField('gstNumber', formData.gstNumber);
                if (gstError) errors.push(gstError);
                const panError = validateField('panNumber', formData.panNumber);
                if (panError) errors.push(panError);
                break;
            case 'contact':
                if (!formData.email?.trim()) errors.push('Email Address is required');
                if (!formData.phone?.trim()) errors.push('Phone Number is required');
                // Validate formats
                const emailError = validateField('email', formData.email);
                if (emailError) errors.push(emailError);
                const phoneError = validateField('phone', formData.phone);
                if (phoneError) errors.push(phoneError);
                break;
            case 'address':
                if (!formData.billingAddress?.trim()) errors.push('Billing Address is required');
                if (!formData.City?.trim()) errors.push('City is required');
                if (!formData.State?.trim()) errors.push('State is required');
                if (!formData.Zip?.trim()) errors.push('Pin Code is required');
                // Validate pin code format
                const zipError = validateField('Zip', formData.Zip);
                if (zipError) errors.push(zipError);
                break;
            case 'banking':
                if (!formData.bankName?.trim()) errors.push('Bank Name is required');
                if (!formData.bankAccountNo?.trim()) errors.push('Account Number is required');
                if (!formData.ifscCode?.trim()) errors.push('IFSC Code is required');
                // Validate IFSC format
                const ifscError = validateField('ifscCode', formData.ifscCode);
                if (ifscError) errors.push(ifscError);
                break;
        }

        setSectionErrors(prev => ({ ...prev, [section]: errors }));
        return errors.length === 0;
    };

    const handleNext = () => {
        // Mark all fields in current section as touched
        const currentSectionFields: Record<FormSection, (keyof CreateCustomerDto)[]> = {
            basic: ['customerName', 'gstNumber', 'panNumber'],
            contact: ['email', 'phone'],
            address: ['billingAddress', 'City', 'State', 'Zip'],
            banking: ['bankName', 'bankAccountNo', 'ifscCode']
        };

        currentSectionFields[activeSection].forEach(field => {
            setTouched(prev => ({ ...prev, [field]: true }));
        });

        // Validate current section
        const isValid = validateSection(activeSection);
        if (!isValid) {
            return; // Don't proceed if validation fails
        }

        // Move to next section
        const sectionOrder: FormSection[] = ['basic', 'contact', 'address', 'banking'];
        const currentIndex = sectionOrder.indexOf(activeSection);
        if (currentIndex < sectionOrder.length - 1) {
            setActiveSection(sectionOrder[currentIndex + 1]);
        }
    };

    const handlePrevious = () => {
        const sectionOrder: FormSection[] = ['basic', 'contact', 'address', 'banking'];
        const currentIndex = sectionOrder.indexOf(activeSection);
        if (currentIndex > 0) {
            setActiveSection(sectionOrder[currentIndex - 1]);
        }
    };

    const isFieldValid = (fieldName: keyof CreateCustomerDto) => {
        const value = formData[fieldName];
        const error = validateField(fieldName, value);
        return !error;
    };

    // Check if banking section is valid without calling setState
    const isBankingSectionValid = useMemo(() => {
        const hasBankName = formData.bankName?.trim();
        const hasAccountNo = formData.bankAccountNo?.trim();
        const hasIfsc = formData.ifscCode?.trim();
        const ifscValid = hasIfsc && hasIfsc.length === 11;
        return hasBankName && hasAccountNo && hasIfsc && ifscValid;
    }, [formData.bankName, formData.bankAccountNo, formData.ifscCode]);

    const getSectionProgress = (section: FormSection): number => {
        switch (section) {
            case 'basic':
                const basicFields = [formData.customerName, formData.gstNumber, formData.panNumber].filter(Boolean).length;
                return (basicFields / 3) * 100;
            case 'contact':
                const contactFields = [formData.email, formData.phone].filter(Boolean).length;
                return (contactFields / 2) * 100;
            case 'address':
                const addressFields = [formData.billingAddress, formData.City, formData.State, formData.Zip].filter(Boolean).length;
                return (addressFields / 4) * 100;
            case 'banking':
                const bankingFields = [formData.bankName, formData.bankAccountNo, formData.ifscCode].filter(Boolean).length;
                return (bankingFields / 3) * 100;
            default:
                return 0;
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className={`${themeColors.primary} px-6 py-5 text-white`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="p-2 bg-white/20 rounded-lg">
                                <UserPlus className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">Add New Customer</h2>
                                <p className="text-white/80 text-sm mt-1">Fill in the customer details below</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-white/80 hover:text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                            disabled={loading}
                            title="Close"
                            aria-label="Close modal"
                        >
                            <X className="h-6 w-6" />
                        </button>
                    </div>
                </div>

                {/* Section Navigation */}
                <div className="border-b bg-gray-50 px-6">
                    <div className="flex space-x-1 overflow-x-auto">
                        {sections.map((section, index) => {
                            const progress = getSectionProgress(section.id);
                            const isActive = activeSection === section.id;
                            const isCompleted = progress === 100;
                            const sectionOrder: FormSection[] = ['basic', 'contact', 'address', 'banking'];
                            const currentIndex = sectionOrder.indexOf(activeSection);
                            const isAccessible = index <= currentIndex || isCompleted;

                            return (
                                <div
                                    key={section.id}
                                    className={`flex items-center space-x-2 px-4 py-3 relative transition-all ${isActive
                                            ? `${themeColors.primaryLight} ${themeColors.accent} border-b-2 ${themeColors.primary.replace('bg-', 'border-')}`
                                            : isAccessible
                                                ? 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 cursor-pointer'
                                                : 'text-gray-400 cursor-not-allowed'
                                        }`}
                                    onClick={() => {
                                        if (isAccessible) {
                                            setActiveSection(section.id);
                                        }
                                    }}
                                >
                                    {section.icon}
                                    <span className="font-medium whitespace-nowrap">{section.label}</span>
                                    {isCompleted && (
                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                    )}
                                    {!isCompleted && progress > 0 && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                                            {Math.round(progress)}%
                                        </span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
                    {error && (
                        <div className="mx-6 mt-4 bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg flex items-start space-x-3">
                            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-red-800">Error</p>
                                <p className="text-sm text-red-700 mt-1">{error}</p>
                            </div>
                        </div>
                    )}

                    <div className="p-6">
                        {/* Section Error Summary */}
                        {sectionErrors[activeSection].length > 0 && (
                            <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 rounded-r-lg">
                                <div className="flex items-start space-x-3">
                                    <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-red-800 mb-2">Please fix the following errors:</p>
                                        <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                            {sectionErrors[activeSection].map((error, index) => (
                                                <li key={index}>{error}</li>
                                            ))}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Basic Information Section */}
                        {activeSection === 'basic' && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <Building2 className="h-5 w-5 mr-2 text-gray-600" />
                                        Basic Information
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Customer Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="customerName"
                                                value={formData.customerName}
                                                onChange={handleChange}
                                                onBlur={() => handleBlur('customerName')}
                                                required
                                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${!isFieldValid('customerName') && touched.customerName
                                                        ? 'border-red-300 focus:ring-red-500'
                                                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                    }`}
                                                placeholder="Enter customer or company name"
                                            />
                                            {!isFieldValid('customerName') && touched.customerName && (
                                                <p className="mt-1 text-sm text-red-600">{validateField('customerName', formData.customerName)}</p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    <FileText className="h-4 w-4 inline mr-1" />
                                                    GST Number <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="gstNumber"
                                                    value={formData.gstNumber}
                                                    onChange={handleChange}
                                                    onBlur={() => handleBlur('gstNumber')}
                                                    required
                                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all uppercase ${!isFieldValid('gstNumber') && touched.gstNumber
                                                            ? 'border-red-300 focus:ring-red-500'
                                                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                        }`}
                                                    placeholder="15-digit GSTIN"
                                                    maxLength={15}
                                                />
                                                {!isFieldValid('gstNumber') && touched.gstNumber && (
                                                    <p className="mt-1 text-sm text-red-600">{validateField('gstNumber', formData.gstNumber)}</p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    <FileText className="h-4 w-4 inline mr-1" />
                                                    PAN Number <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="panNumber"
                                                    value={formData.panNumber}
                                                    onChange={handleChange}
                                                    onBlur={() => handleBlur('panNumber')}
                                                    required
                                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all uppercase ${!isFieldValid('panNumber') && touched.panNumber
                                                            ? 'border-red-300 focus:ring-red-500'
                                                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                        }`}
                                                    placeholder="10-digit PAN"
                                                    maxLength={10}
                                                />
                                                {!isFieldValid('panNumber') && touched.panNumber && (
                                                    <p className="mt-1 text-sm text-red-600">{validateField('panNumber', formData.panNumber)}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Contact Information Section */}
                        {activeSection === 'contact' && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <Phone className="h-5 w-5 mr-2 text-gray-600" />
                                        Contact Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                <Mail className="h-4 w-4 inline mr-1" />
                                                Email Address <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                value={formData.email}
                                                onChange={handleChange}
                                                onBlur={() => handleBlur('email')}
                                                required
                                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${!isFieldValid('email') && touched.email
                                                        ? 'border-red-300 focus:ring-red-500'
                                                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                    }`}
                                                placeholder="customer@example.com"
                                            />
                                            {!isFieldValid('email') && touched.email && (
                                                <p className="mt-1 text-sm text-red-600">{validateField('email', formData.email)}</p>
                                            )}
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                <Phone className="h-4 w-4 inline mr-1" />
                                                Phone Number <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                onBlur={() => handleBlur('phone')}
                                                required
                                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${!isFieldValid('phone') && touched.phone
                                                        ? 'border-red-300 focus:ring-red-500'
                                                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                    }`}
                                                placeholder="+91 9876543210"
                                            />
                                            {!isFieldValid('phone') && touched.phone && (
                                                <p className="mt-1 text-sm text-red-600">{validateField('phone', formData.phone)}</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Address Information Section */}
                        {activeSection === 'address' && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <MapPin className="h-5 w-5 mr-2 text-gray-600" />
                                        Address Information
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Billing Address <span className="text-red-500">*</span>
                                            </label>
                                            <textarea
                                                name="billingAddress"
                                                value={formData.billingAddress}
                                                onChange={handleChange}
                                                onBlur={() => handleBlur('billingAddress')}
                                                required
                                                rows={3}
                                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all resize-none ${!isFieldValid('billingAddress') && touched.billingAddress
                                                        ? 'border-red-300 focus:ring-red-500'
                                                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                    }`}
                                                placeholder="Street address, building, floor, etc."
                                            />
                                            {!isFieldValid('billingAddress') && touched.billingAddress && (
                                                <p className="mt-1 text-sm text-red-600">{validateField('billingAddress', formData.billingAddress)}</p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    City <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="City"
                                                    value={formData.City}
                                                    onChange={handleChange}
                                                    onBlur={() => handleBlur('City')}
                                                    required
                                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${!isFieldValid('City') && touched.City
                                                            ? 'border-red-300 focus:ring-red-500'
                                                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                        }`}
                                                    placeholder="City"
                                                />
                                                {!isFieldValid('City') && touched.City && (
                                                    <p className="mt-1 text-sm text-red-600">{validateField('City', formData.City)}</p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    State <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="State"
                                                    value={formData.State}
                                                    onChange={handleChange}
                                                    onBlur={() => handleBlur('State')}
                                                    required
                                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${!isFieldValid('State') && touched.State
                                                            ? 'border-red-300 focus:ring-red-500'
                                                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                        }`}
                                                    placeholder="State"
                                                />
                                                {!isFieldValid('State') && touched.State && (
                                                    <p className="mt-1 text-sm text-red-600">{validateField('State', formData.State)}</p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Pin Code <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="Zip"
                                                    value={formData.Zip}
                                                    onChange={handleChange}
                                                    onBlur={() => handleBlur('Zip')}
                                                    required
                                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${!isFieldValid('Zip') && touched.Zip
                                                            ? 'border-red-300 focus:ring-red-500'
                                                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                        }`}
                                                    placeholder="PIN Code"
                                                    maxLength={6}
                                                />
                                                {!isFieldValid('Zip') && touched.Zip && (
                                                    <p className="mt-1 text-sm text-red-600">{validateField('Zip', formData.Zip)}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Banking Information Section */}
                        {activeSection === 'banking' && (
                            <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                        <CreditCard className="h-5 w-5 mr-2 text-gray-600" />
                                        Banking Information
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Bank Name <span className="text-red-500">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="bankName"
                                                value={formData.bankName}
                                                onChange={handleChange}
                                                onBlur={() => handleBlur('bankName')}
                                                required
                                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${!isFieldValid('bankName') && touched.bankName
                                                        ? 'border-red-300 focus:ring-red-500'
                                                        : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                    }`}
                                                placeholder="Bank name"
                                            />
                                            {!isFieldValid('bankName') && touched.bankName && (
                                                <p className="mt-1 text-sm text-red-600">{validateField('bankName', formData.bankName)}</p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Account Number <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="bankAccountNo"
                                                    value={formData.bankAccountNo}
                                                    onChange={handleChange}
                                                    onBlur={() => handleBlur('bankAccountNo')}
                                                    required
                                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all ${!isFieldValid('bankAccountNo') && touched.bankAccountNo
                                                            ? 'border-red-300 focus:ring-red-500'
                                                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                        }`}
                                                    placeholder="Account number"
                                                />
                                                {!isFieldValid('bankAccountNo') && touched.bankAccountNo && (
                                                    <p className="mt-1 text-sm text-red-600">{validateField('bankAccountNo', formData.bankAccountNo)}</p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    IFSC Code <span className="text-red-500">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    name="ifscCode"
                                                    value={formData.ifscCode}
                                                    onChange={handleChange}
                                                    onBlur={() => handleBlur('ifscCode')}
                                                    required
                                                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:outline-none transition-all uppercase ${!isFieldValid('ifscCode') && touched.ifscCode
                                                            ? 'border-red-300 focus:ring-red-500'
                                                            : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                                                        }`}
                                                    placeholder="IFSC code"
                                                    maxLength={11}
                                                />
                                                {!isFieldValid('ifscCode') && touched.ifscCode && (
                                                    <p className="mt-1 text-sm text-red-600">{validateField('ifscCode', formData.ifscCode)}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </form>

                {/* Footer Actions */}
                <div className="border-t bg-gray-50 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <span className="font-medium">All fields are required</span>
                            <span className="text-red-500">*</span>
                        </div>
                        <div className="flex space-x-3">
                            {activeSection !== 'basic' && (
                                <button
                                    type="button"
                                    onClick={handlePrevious}
                                    disabled={loading}
                                    className="flex items-center space-x-2 px-6 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    <span>Previous</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            {activeSection !== 'banking' ? (
                                <button
                                    type="button"
                                    onClick={handleNext}
                                    disabled={loading}
                                    className={`flex items-center space-x-2 px-6 py-2.5 ${themeColors.primary} text-white rounded-lg font-medium ${themeColors.primaryHover} disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg`}
                                >
                                    <span>Next</span>
                                    <ChevronRight className="h-4 w-4" />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => handleSubmit()}
                                    disabled={loading || !isBankingSectionValid}
                                    className={`flex items-center space-x-2 px-6 py-2.5 ${themeColors.primary} text-white rounded-lg font-medium ${themeColors.primaryHover} disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg`}
                                >
                                    {loading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                            <span>Creating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Save className="h-4 w-4" />
                                            <span>Create Customer</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};