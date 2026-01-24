import React, { useState, useEffect } from 'react';
import { X, Save, FolderOpen, Trash2, Edit2 } from 'lucide-react';
import { api } from '../services/agent';
import type { InvoiceTemplateDto, CreateInvoiceTemplateDto, InvoiceTemplateItemDto } from '../types';
import { useTheme } from '../contexts/ThemeContext';

interface InvoiceTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadTemplate: (items: InvoiceTemplateItemDto[]) => void;
  currentItems: Array<{ productName?: string; quantity?: number; rate?: number; gstPercentage?: number }>;
}

export const InvoiceTemplateModal: React.FC<InvoiceTemplateModalProps> = ({
  isOpen,
  onClose,
  onLoadTemplate,
  currentItems,
}) => {
  const { themeColors } = useTheme();
  const [templates, setTemplates] = useState<InvoiceTemplateDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplateDto | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.invoiceTemplates.getList();
      setTemplates(response.data);
    } catch (error: any) {
      console.error('Failed to load templates:', error);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setError('Template name is required');
      return;
    }

    if (currentItems.length === 0 || !currentItems.some(item => item.productName)) {
      setError('Please add at least one item with a product name before saving');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const templateData: CreateInvoiceTemplateDto = {
        templateName: templateName.trim(),
        description: templateDescription.trim() || undefined,
        items: currentItems
          .filter(item => item.productName && item.productName.trim())
          .map(item => ({
            productName: item.productName!,
            quantity: item.quantity || 1,
            rate: item.rate || 0,
            gstPercentage: item.gstPercentage || 18,
          })),
      };

      if (editingTemplate) {
        await api.invoiceTemplates.update(editingTemplate.id, templateData);
      } else {
        await api.invoiceTemplates.create(templateData);
      }

      setTemplateName('');
      setTemplateDescription('');
      setShowSaveForm(false);
      setEditingTemplate(null);
      await loadTemplates();
    } catch (error: any) {
      console.error('Failed to save template:', error);
      setError(error.response?.data?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadTemplate = (template: InvoiceTemplateDto) => {
    onLoadTemplate(template.items);
    onClose();
  };

  const handleDeleteTemplate = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      await api.invoiceTemplates.delete(id);
      await loadTemplates();
    } catch (error: any) {
      console.error('Failed to delete template:', error);
      alert('Failed to delete template: ' + (error.response?.data?.message || 'Please try again.'));
    }
  };

  const handleEditTemplate = (template: InvoiceTemplateDto, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTemplate(template);
    setTemplateName(template.templateName);
    setTemplateDescription(template.description || '');
    setShowSaveForm(true);
  };

  const handleCancelSave = () => {
    setShowSaveForm(false);
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateDescription('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            {showSaveForm ? (editingTemplate ? 'Edit Template' : 'Save as Template') : 'Invoice Templates'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {showSaveForm ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Standard Services, Monthly Products"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Add a description for this template..."
                />
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Items to save:</strong> {currentItems.filter(item => item.productName).length} item(s)
                </p>
                <ul className="text-xs text-gray-500 space-y-1">
                  {currentItems
                    .filter(item => item.productName)
                    .map((item, index) => (
                      <li key={index}>
                        • {item.productName} (Qty: {item.quantity || 1}, Rate: ₹{item.rate || 0}, GST: {item.gstPercentage || 18}%)
                      </li>
                    ))}
                </ul>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleSaveTemplate}
                  disabled={saving || !templateName.trim()}
                  className={`flex-1 px-4 py-2 ${themeColors.primary} text-white rounded-md ${themeColors.primaryHover} disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {saving ? 'Saving...' : editingTemplate ? 'Update Template' : 'Save Template'}
                </button>
                <button
                  onClick={handleCancelSave}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-4 flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  {templates.length} template(s) available
                </p>
                <button
                  onClick={() => {
                    setShowSaveForm(true);
                    setEditingTemplate(null);
                    setTemplateName('');
                    setTemplateDescription('');
                    setError('');
                  }}
                  className={`flex items-center gap-2 px-3 py-2 ${themeColors.primary} text-white rounded-md ${themeColors.primaryHover} text-sm`}
                >
                  <Save className="h-4 w-4" />
                  Save Current Items
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <FolderOpen className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p className="text-lg font-medium mb-2">No templates found</p>
                  <p className="text-sm">Save your current invoice items as a template to reuse them later</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleLoadTemplate(template)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">{template.templateName}</h3>
                          {template.description && (
                            <p className="text-sm text-gray-600 mb-2">{template.description}</p>
                          )}
                          <p className="text-xs text-gray-500">
                            {template.items.length} item(s) • Created {new Date(template.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-4" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={(e) => handleEditTemplate(template, e)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-md"
                            title="Edit Template"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteTemplate(template.id, e)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                            title="Delete Template"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
