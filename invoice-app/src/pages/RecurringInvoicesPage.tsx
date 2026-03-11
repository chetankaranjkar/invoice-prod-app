import React, { useState, useEffect } from 'react';
import { useDateFormat } from '../hooks/useDateFormat';
import { Calendar, Plus, Edit, Trash2, Play, Pause, Clock, CheckCircle2, X } from 'lucide-react';
import { api } from '../services/agent';
import type { RecurringInvoiceDto, CreateRecurringInvoiceDto, UpdateRecurringInvoiceDto, Customer, RecurringInvoiceItemDto } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { getApiErrorMessage } from '../utils/helpers';

export const RecurringInvoicesPage: React.FC = () => {
  const { themeColors } = useTheme();
  const navigate = useNavigate();
  const formatDate = useDateFormat();
  const [recurringInvoices, setRecurringInvoices] = useState<RecurringInvoiceDto[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<RecurringInvoiceDto | null>(null);
  const [userRole, setUserRole] = useState<string>('User');

  useEffect(() => {
    loadData();
    loadUserRole();
  }, []);

  const loadUserRole = async () => {
    try {
      const response = await api.user.getProfile();
      setUserRole(response.data.role || 'User');
    } catch (error) {
      console.error('Failed to load user role:', error);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [recurringResponse, customersResponse] = await Promise.all([
        api.recurringInvoices.getList(),
        api.customers.getList(),
      ]);
      setRecurringInvoices(recurringResponse.data);
      setCustomers(customersResponse.data);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!window.confirm(`Are you sure you want to delete recurring invoice "${name}"?`)) {
      return;
    }

    try {
      await api.recurringInvoices.delete(id);
      await loadData();
    } catch (error: any) {
      alert(`Failed to delete: ${error.response?.data?.message || 'Please try again.'}`);
    }
  };

  const handleGenerate = async (id: number) => {
    if (!window.confirm('Generate invoice from this recurring template now?')) {
      return;
    }

    try {
      const response = await api.recurringInvoices.generate(id);
      alert(`Invoice ${response.data.invoiceNumber} generated successfully!`);
      navigate('/dashboard');
    } catch (error: any) {
      alert(`Failed to generate invoice: ${error.response?.data?.message || 'Please try again.'}`);
    }
  };

  const handleToggleActive = async (invoice: RecurringInvoiceDto) => {
    try {
      const updateDto: UpdateRecurringInvoiceDto = {
        name: invoice.name,
        customerId: invoice.customerId,
        frequency: invoice.frequency,
        dayOfMonth: invoice.dayOfMonth,
        startDate: invoice.startDate,
        endDate: invoice.endDate || undefined,
        numberOfOccurrences: invoice.numberOfOccurrences || undefined,
        isActive: !invoice.isActive,
        description: invoice.description || undefined,
        items: invoice.items,
      };
      await api.recurringInvoices.update(invoice.id, updateDto);
      await loadData();
    } catch (error: any) {
      alert(`Failed to update: ${error.response?.data?.message || 'Please try again.'}`);
    }
  };

  if (userRole === 'MasterUser') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Restricted</h1>
            <p className="text-gray-600">MasterUser cannot manage recurring invoices.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Recurring Invoices</h1>
          <button
            onClick={() => {
              setEditingInvoice(null);
              setShowCreateModal(true);
            }}
            className={`flex items-center gap-2 px-4 py-2 ${themeColors.primary} text-white rounded-md ${themeColors.primaryHover}`}
          >
            <Plus className="h-5 w-5" />
            Create Recurring Invoice
          </button>
        </div>

        {recurringInvoices.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-900 mb-2">No recurring invoices</p>
            <p className="text-gray-600 mb-4">Create a recurring invoice to automatically generate invoices on a schedule</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {recurringInvoices.map((invoice) => (
              <div key={invoice.id} className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">{invoice.name}</h3>
                    <p className="text-sm text-gray-600">{invoice.customerName}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    invoice.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {invoice.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span><strong>Frequency:</strong> {invoice.frequency}</span>
                  </div>
                  {invoice.nextGenerationDate && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="h-4 w-4" />
                      <span><strong>Next:</strong> {formatDate(invoice.nextGenerationDate)}</span>
                    </div>
                  )}
                  {invoice.lastGeneratedDate && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span><strong>Last:</strong> {formatDate(invoice.lastGeneratedDate)}</span>
                    </div>
                  )}
                  <div className="text-gray-600">
                    <strong>Generated:</strong> {invoice.generatedCount}
                    {invoice.numberOfOccurrences && ` / ${invoice.numberOfOccurrences}`}
                  </div>
                  <div className="text-gray-600">
                    <strong>Items:</strong> {invoice.items.length}
                  </div>
                </div>

                {invoice.description && (
                  <p className="text-sm text-gray-500 mb-4">{invoice.description}</p>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleGenerate(invoice.id)}
                    className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                    title="Generate invoice now"
                  >
                    <Play className="h-4 w-4 inline mr-1" />
                    Generate
                  </button>
                  <button
                    onClick={() => handleToggleActive(invoice)}
                    className={`px-3 py-2 rounded-md text-sm ${
                      invoice.isActive
                        ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                    title={invoice.isActive ? 'Deactivate' : 'Activate'}
                  >
                    {invoice.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => {
                      setEditingInvoice(invoice);
                      setShowCreateModal(true);
                    }}
                    className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                    title="Edit"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(invoice.id, invoice.name)}
                    className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <RecurringInvoiceModal
            isOpen={showCreateModal}
            onClose={() => {
              setShowCreateModal(false);
              setEditingInvoice(null);
            }}
            onSave={async () => {
              await loadData();
              setShowCreateModal(false);
              setEditingInvoice(null);
            }}
            customers={customers}
            editingInvoice={editingInvoice}
          />
        )}
      </div>
    </div>
  );
};

// Recurring Invoice Modal Component
interface RecurringInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  customers: Customer[];
  editingInvoice: RecurringInvoiceDto | null;
}

const RecurringInvoiceModal: React.FC<RecurringInvoiceModalProps> = ({
  isOpen,
  onClose,
  onSave,
  customers,
  editingInvoice,
}) => {
  const { themeColors } = useTheme();
  const [formData, setFormData] = useState<CreateRecurringInvoiceDto>({
    name: '',
    customerId: 0,
    frequency: 'Monthly',
    dayOfMonth: 1,
    startDate: new Date().toISOString().split('T')[0],
    endDate: undefined,
    numberOfOccurrences: undefined,
    description: '',
    items: [{ productName: '', quantity: 1, rate: 0, gstPercentage: 18 }],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (editingInvoice) {
      setFormData({
        name: editingInvoice.name,
        customerId: editingInvoice.customerId,
        frequency: editingInvoice.frequency,
        dayOfMonth: editingInvoice.dayOfMonth,
        startDate: editingInvoice.startDate.split('T')[0],
        endDate: editingInvoice.endDate ? editingInvoice.endDate.split('T')[0] : undefined,
        numberOfOccurrences: editingInvoice.numberOfOccurrences || undefined,
        description: editingInvoice.description || '',
        items: editingInvoice.items.length > 0 ? editingInvoice.items : [{ productName: '', quantity: 1, rate: 0, gstPercentage: 18 }],
      });
    } else {
      setFormData({
        name: '',
        customerId: 0,
        frequency: 'Monthly',
        dayOfMonth: 1,
        startDate: new Date().toISOString().split('T')[0],
        endDate: undefined,
        numberOfOccurrences: undefined,
        description: '',
        items: [{ productName: '', quantity: 1, rate: 0, gstPercentage: 18 }],
      });
    }
  }, [editingInvoice, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim()) {
      setError('Name is required');
      return;
    }

    if (formData.customerId === 0) {
      setError('Please select a customer');
      return;
    }

    if (formData.items.length === 0 || !formData.items.some(item => item.productName)) {
      setError('Please add at least one item');
      return;
    }

    try {
      setSaving(true);
      if (editingInvoice) {
        const updateDto: UpdateRecurringInvoiceDto = {
          ...formData,
          isActive: editingInvoice.isActive,
        };
        await api.recurringInvoices.update(editingInvoice.id, updateDto);
      } else {
        await api.recurringInvoices.create(formData);
      }
      onSave();
    } catch (error: any) {
      setError(getApiErrorMessage(error, 'Failed to save recurring invoice'));
    } finally {
      setSaving(false);
    }
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { productName: '', quantity: 1, rate: 0, gstPercentage: 18 }],
    });
  };

  const removeItem = (index: number) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter((_, i) => i !== index),
      });
    }
  };

  const updateItem = (index: number, field: keyof RecurringInvoiceItemDto, value: any) => {
    const updatedItems = [...formData.items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setFormData({ ...formData, items: updatedItems });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            {editingInvoice ? 'Edit Recurring Invoice' : 'Create Recurring Invoice'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Customer *
              </label>
              <select
                value={formData.customerId}
                onChange={(e) => setFormData({ ...formData, customerId: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value={0}>Select Customer</option>
                {customers.map(customer => (
                  <option key={customer.id} value={customer.id}>
                    {customer.customerName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Frequency *
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value as any })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
                <option value="Yearly">Yearly</option>
              </select>
            </div>

            {formData.frequency === 'Monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Day of Month (1-31) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={formData.dayOfMonth}
                  onChange={(e) => setFormData({ ...formData, dayOfMonth: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date (Optional)
              </label>
              <input
                type="date"
                value={formData.endDate || ''}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value || undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Occurrences (Optional)
              </label>
              <input
                type="number"
                min="1"
                value={formData.numberOfOccurrences || ''}
                onChange={(e) => setFormData({ ...formData, numberOfOccurrences: e.target.value ? Number(e.target.value) : undefined })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Leave empty for unlimited"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
              />
            </div>
          </div>

          {/* Items Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Items</h3>
              <button
                type="button"
                onClick={addItem}
                className={`px-3 py-2 ${themeColors.primary} text-white rounded-md ${themeColors.primaryHover} text-sm`}
              >
                <Plus className="h-4 w-4 inline mr-1" />
                Add Item
              </button>
            </div>

            {/* Items table header */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 px-3 py-2 bg-gray-100 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 mb-3">
              <div className="sm:col-span-4">Product Name</div>
              <div className="sm:col-span-2">Qty</div>
              <div className="sm:col-span-2">Rate</div>
              <div className="sm:col-span-2">GST %</div>
              <div className="sm:col-span-2">Action</div>
            </div>

            <div className="space-y-3">
              {formData.items.map((item, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-3 p-3 border rounded-lg">
                  <div className="sm:col-span-4">
                    <input
                      type="text"
                      placeholder="Product Name *"
                      value={item.productName}
                      onChange={(e) => updateItem(index, 'productName', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min="1"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Rate"
                      value={item.rate}
                      onChange={(e) => updateItem(index, 'rate', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      placeholder="GST %"
                      value={item.gstPercentage}
                      onChange={(e) => updateItem(index, 'gstPercentage', Number(e.target.value))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="w-full px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                      disabled={formData.items.length === 1}
                    >
                      <Trash2 className="h-4 w-4 inline" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="submit"
              disabled={saving}
              className={`flex-1 px-4 py-2 ${themeColors.primary} text-white rounded-md ${themeColors.primaryHover} disabled:opacity-50`}
            >
              {saving ? 'Saving...' : editingInvoice ? 'Update' : 'Create'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
