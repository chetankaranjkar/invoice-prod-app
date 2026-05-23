import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, X, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../services/agent';
import type { Product, ProductType } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { getApiErrorMessage } from '../utils/helpers';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorAlert } from '../components/ErrorAlert';

export const ProductsPage: React.FC = () => {
  const { themeColors } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
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
      const response = await api.products.getTree();
      setProducts(response.data || []);
      const exp: Record<number, boolean> = {};
      (response.data || []).forEach((p: Product) => {
        exp[p.id] = true;
      });
      setExpanded(exp);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err as { response?: { data?: unknown; status?: number }; message?: string; code?: string }, 'Failed to load products'));
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
      <div className="max-w-2xl mx-auto">
        <div className="ui-card p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Access Restricted</h1>
          <p className="text-sm text-slate-500">MasterUser cannot manage products.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="page-header">
        <div>
          <h1 className="page-title">Products</h1>
          <p className="page-subtitle">Parent products bill on invoices; sub-products are breakdown lines only.</p>
        </div>
        <button onClick={handleAdd} className="ui-btn-primary">
          <Plus className="h-4 w-4" /> Add Product
        </button>
      </div>

      {error && <ErrorAlert message={error} onRetry={loadData} />}

      {products.length === 0 ? (
        <div className="ui-card p-12 text-center">
          <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
            <Package className="h-6 w-6 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">No products yet</h3>
          <p className="text-sm text-slate-500 mb-5 max-w-sm mx-auto">
            Add products here or they'll be added automatically when you create invoices.
          </p>
          <button onClick={handleAdd} className="ui-btn-primary mx-auto">
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      ) : (
        <div className="ui-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Type</th>
                  <th>Rate (₹)</th>
                  <th>GST %</th>
                  <th>Affects total</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((parent) => (
                  <React.Fragment key={parent.id}>
                    <tr className="bg-white">
                      <td className="font-semibold text-slate-900">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 mr-1 text-slate-500"
                          onClick={() => setExpanded((e) => ({ ...e, [parent.id]: !e[parent.id] }))}
                        >
                          {(parent.children?.length ?? 0) > 0 ? (
                            expanded[parent.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                          ) : (
                            <span className="w-4" />
                          )}
                          {parent.name}
                        </button>
                      </td>
                      <td><span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">Parent</span></td>
                      <td>{parent.defaultRate != null ? `₹${Number(parent.defaultRate).toFixed(2)}` : '—'}</td>
                      <td>{parent.defaultGstPercentage != null ? `${parent.defaultGstPercentage}%` : '—'}</td>
                      <td>{parent.affectTotal !== false ? 'Yes' : 'No'}</td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button onClick={() => handleEdit(parent)} className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50" title="Edit"><Edit className="h-4 w-4" /></button>
                          <button onClick={() => handleDelete(parent)} className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                    {expanded[parent.id] &&
                      (parent.children ?? []).map((child) => (
                        <tr key={child.id} className="bg-slate-50/80">
                          <td className="pl-10 text-slate-700">
                            <span className="text-slate-300 font-mono mr-1">└</span>
                            {child.name}
                          </td>
                          <td><span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">Sub</span></td>
                          <td>{child.defaultRate != null ? `₹${Number(child.defaultRate).toFixed(2)}` : '—'}</td>
                          <td>{child.defaultGstPercentage != null ? `${child.defaultGstPercentage}%` : '—'}</td>
                          <td>{child.affectTotal ? 'Yes' : 'No'}</td>
                          <td>
                            <div className="flex justify-end gap-1">
                              <button onClick={() => handleEdit(child)} className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"><Edit className="h-4 w-4" /></button>
                              <button onClick={() => handleDelete(child)} className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
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
  const [productType, setProductType] = useState<ProductType>(product?.productType ?? 'parent');
  const [parentProductId, setParentProductId] = useState<number | ''>(product?.parentProductId ?? '');
  const [parentOptions, setParentOptions] = useState<Product[]>([]);
  const [defaultRate, setDefaultRate] = useState<string>(
    product?.defaultRate != null ? String(product.defaultRate) : ''
  );
  const [defaultGstPercentage, setDefaultGstPercentage] = useState<string>(
    product?.defaultGstPercentage != null ? String(product.defaultGstPercentage) : ''
  );
  const [affectTotal, setAffectTotal] = useState(product?.affectTotal ?? product?.productType !== 'sub');
  const [taxable, setTaxable] = useState(product?.taxable ?? product?.productType !== 'sub');
  const [inheritGstFromParent, setInheritGstFromParent] = useState(product?.inheritGstFromParent ?? false);
  const [description, setDescription] = useState(product?.description ?? '');
  const [isActive, setIsActive] = useState(product?.isActive !== false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      api.products.getTree().then((res) => setParentOptions(res.data || []));
      setName(product?.name || '');
      setProductType(product?.productType ?? 'parent');
      setParentProductId(product?.parentProductId ?? '');
      setDefaultRate(product?.defaultRate != null ? String(product.defaultRate) : '');
      setDefaultGstPercentage(
        product?.defaultGstPercentage != null
          ? String(product.defaultGstPercentage)
          : String(profileGst)
      );
      setAffectTotal(product?.affectTotal ?? product?.productType !== 'sub');
      setTaxable(product?.taxable ?? product?.productType !== 'sub');
      setInheritGstFromParent(product?.inheritGstFromParent ?? false);
      setDescription(product?.description ?? '');
      setIsActive(product?.isActive !== false);
      setError('');
    }
  }, [isOpen, product, profileGst]);

  useEffect(() => {
    if (productType === 'sub') {
      setAffectTotal(false);
      if (!product) setTaxable(false);
    } else {
      setAffectTotal(true);
      setParentProductId('');
    }
  }, [productType, product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Product name is required');
      return;
    }
    if (productType === 'sub' && !parentProductId) {
      setError('Select a parent product for sub-products');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        name: trimmedName,
        productType,
        parentProductId: productType === 'sub' ? Number(parentProductId) : undefined,
        defaultRate: defaultRate ? Number(defaultRate) : undefined,
        defaultGstPercentage: defaultGstPercentage ? Number(defaultGstPercentage) : undefined,
        affectTotal,
        taxable,
        inheritGstFromParent,
        description: description.trim() || undefined,
        isActive,
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
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
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
              placeholder="e.g. Application Cost"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Product Type *</label>
            <select
              value={productType}
              onChange={(e) => setProductType(e.target.value as ProductType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="parent">Parent Product (billable)</option>
              <option value="sub">Sub Product (breakdown)</option>
            </select>
          </div>

          {productType === 'sub' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Parent Product *</label>
              <select
                value={parentProductId}
                onChange={(e) => setParentProductId(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              >
                <option value="">Select parent…</option>
                {parentOptions
                  .filter((p) => p.id !== product?.id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>
          )}

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
              disabled={productType === 'sub' && inheritGstFromParent}
            />
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={affectTotal} onChange={(e) => setAffectTotal(e.target.checked)} disabled={productType === 'sub'} />
              Affects invoice total
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={taxable} onChange={(e) => setTaxable(e.target.checked)} />
              Taxable (GST)
            </label>
            {productType === 'sub' && (
              <label className="flex items-center gap-2 col-span-2">
                <input type="checkbox" checked={inheritGstFromParent} onChange={(e) => setInheritGstFromParent(e.target.checked)} />
                Inherit GST % from parent
              </label>
            )}
            <label className="flex items-center gap-2 col-span-2">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="Optional notes"
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
