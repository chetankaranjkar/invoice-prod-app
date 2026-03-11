import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, X } from 'lucide-react';
import { api } from '../services/agent';
import type { Product } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getApiErrorMessage } from '../utils/helpers';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorAlert } from '../components/ErrorAlert';

export const ProductsPage: React.FC = () => {
  const { themeColors } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [userRole, setUserRole] = useState<string>('User');

  useEffect(() => {
    loadData();
    loadUserRole();
  }, []);

  const loadUserRole = async () => {
    try {
      const response = await api.user.getProfile();
      setUserRole(response.data.role || 'User');
    } catch {
      // ignore
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await api.products.getList();
      setProducts(response.data || []);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load products'));
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setShowModal(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Delete product "${product.name}"?`)) return;
    try {
      await api.products.delete(product.id);
      await loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Failed to delete product');
    }
  };

  const handleModalSave = () => {
    loadData();
    setShowModal(false);
    setEditingProduct(null);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  if (userRole === 'MasterUser') {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Restricted</h1>
            <p className="text-gray-600">MasterUser cannot manage products.</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Products</h1>
          <button
            onClick={handleAdd}
            className={`flex items-center gap-2 px-4 py-2 ${themeColors.primary} text-white rounded-md ${themeColors.primaryHover}`}
          >
            <Plus className="h-5 w-5" />
            Add Product
          </button>
        </div>

        {error && (
          <ErrorAlert message={error} onDismiss={() => setError('')} />
        )}

        {products.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-lg font-medium text-gray-900 mb-2">No products yet</p>
            <p className="text-gray-600 mb-4">
              Add products here or they will be added automatically when you create invoices.
            </p>
            <button
              onClick={handleAdd}
              className={`inline-flex items-center gap-2 px-4 py-2 ${themeColors.primary} text-white rounded-md ${themeColors.primaryHover}`}
            >
              <Plus className="h-5 w-5" />
              Add Product
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Product Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Default Rate (₹)
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Default GST %
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {products.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {product.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {product.defaultRate != null ? `₹${Number(product.defaultRate).toFixed(2)}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {product.defaultGstPercentage != null ? `${product.defaultGstPercentage}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-2 text-gray-600 hover:bg-gray-100 rounded-md"
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-md"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {showModal && (
          <ProductModal
            isOpen={showModal}
            onClose={handleModalClose}
            onSave={handleModalSave}
            product={editingProduct}
            themeColors={themeColors}
          />
        )}
      </div>
    </div>
  );
};

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  product: Product | null;
  themeColors: { primary: string; primaryHover: string };
}

const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  product,
  themeColors,
}) => {
  const { profile } = useAuth();
  const profileGst = profile?.defaultGstPercentage ?? 18;
  const [name, setName] = useState(product?.name || '');
  const [defaultRate, setDefaultRate] = useState<string>(
    product?.defaultRate != null ? String(product.defaultRate) : ''
  );
  const [defaultGstPercentage, setDefaultGstPercentage] = useState<string>(
    product?.defaultGstPercentage != null ? String(product.defaultGstPercentage) : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(product?.name || '');
      setDefaultRate(product?.defaultRate != null ? String(product.defaultRate) : '');
      setDefaultGstPercentage(
        product?.defaultGstPercentage != null
          ? String(product.defaultGstPercentage)
          : String(profileGst)
      );
      setError('');
    }
  }, [isOpen, product, profileGst]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Product name is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        name: trimmedName,
        defaultRate: defaultRate ? Number(defaultRate) : undefined,
        defaultGstPercentage: defaultGstPercentage ? Number(defaultGstPercentage) : undefined,
      };

      if (product) {
        await api.products.update(product.id, payload);
      } else {
        await api.products.create(payload);
      }
      onSave();
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string } } })?.response?.data;
      setError(res?.message || 'Failed to save product');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {product ? 'Edit Product' : 'Add Product'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 rounded-md"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-md">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Consulting Service"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Rate (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={defaultRate}
              onChange={(e) => setDefaultRate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default GST %</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={defaultGstPercentage}
              onChange={(e) => setDefaultGstPercentage(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 ${themeColors.primary} text-white rounded-md ${themeColors.primaryHover} disabled:opacity-50`}
            >
              {loading ? 'Saving...' : product ? 'Update' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
