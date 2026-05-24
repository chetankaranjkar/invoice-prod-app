import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../services/agent';
import type { Product } from '../types';
import { useTheme } from '../contexts/ThemeContext';
import { getApiErrorMessage } from '../utils/helpers';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorAlert } from '../components/ErrorAlert';
import { ProductHierarchyEditor } from '../components/products/ProductHierarchyEditor';
import { BillableBadge } from '../components/products/ProductBillableBadges';

export const ProductsPage: React.FC = () => {
  const { themeColors } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [focusSubId, setFocusSubId] = useState<number | undefined>();
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
      setError(
        getApiErrorMessage(
          err as { response?: { data?: unknown; status?: number }; message?: string; code?: string },
          'Failed to load products'
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const openEditor = (product: Product | null, subId?: number) => {
    setEditingProduct(product);
    setFocusSubId(subId);
    setShowEditor(true);
  };

  const handleAdd = () => openEditor(null);

  const handleEdit = (product: Product) => {
    if (product.productType === 'sub') {
      const parent =
        products.find((p) => p.id === product.parentProductId) ??
        products.find((p) => p.children?.some((c) => c.id === product.id));
      openEditor(parent ?? product, product.id);
    } else {
      openEditor(product);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!window.confirm(`Delete "${product.name}"?`)) return;
    try {
      await api.products.delete(product.id);
      await loadData();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      alert(msg || 'Failed to delete product');
    }
  };

  const closeEditor = () => {
    setShowEditor(false);
    setEditingProduct(null);
    setFocusSubId(undefined);
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
          <p className="page-subtitle">
            Manage main billable products and optional breakdown sub-lines for invoices.
          </p>
        </div>
        <button onClick={handleAdd} className="ui-btn-primary">
          <Plus className="h-4 w-4" /> New main product
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
            Create a main product (e.g. Application Cost) and add sub-products for invoice breakdowns.
          </p>
          <button onClick={handleAdd} className="ui-btn-primary mx-auto">
            <Plus className="h-4 w-4" /> New main product
          </button>
        </div>
      ) : (
        <div className="ui-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="ui-table">
              <thead>
                <tr>
                  <th>Product package</th>
                  <th>Rate (₹)</th>
                  <th>GST %</th>
                  <th>Billing</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((parent) => (
                  <React.Fragment key={parent.id}>
                    <tr className="bg-white hover:bg-slate-50/50">
                      <td className="font-semibold text-slate-900">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 mr-1 text-slate-500"
                          onClick={() => setExpanded((e) => ({ ...e, [parent.id]: !e[parent.id] }))}
                        >
                          {(parent.children?.length ?? 0) > 0 ? (
                            expanded[parent.id] ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )
                          ) : (
                            <span className="w-4" />
                          )}
                          {parent.name}
                        </button>
                        <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                          Main
                        </span>
                      </td>
                      <td className="tabular-nums">
                        {parent.defaultRate != null ? `₹${Number(parent.defaultRate).toFixed(2)}` : '—'}
                      </td>
                      <td>{parent.defaultGstPercentage != null ? `${parent.defaultGstPercentage}%` : '—'}</td>
                      <td>
                        <BillableBadge billable={parent.affectTotal !== false} />
                      </td>
                      <td>
                        <div className="flex justify-end gap-1">
                          <button
                            onClick={() => handleEdit(parent)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                            title="Edit package"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(parent)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
                          <td className="tabular-nums text-sm">
                            {child.defaultRate != null ? `₹${Number(child.defaultRate).toFixed(2)}` : '—'}
                          </td>
                          <td className="text-sm">
                            {child.defaultGstPercentage != null ? `${child.defaultGstPercentage}%` : '—'}
                          </td>
                          <td>
                            <BillableBadge billable={child.affectTotal === true} />
                          </td>
                          <td>
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => handleEdit(child)}
                                className="p-1.5 rounded-md text-slate-500 hover:text-indigo-600 hover:bg-indigo-50"
                                title="Edit in package"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(child)}
                                className="p-1.5 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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

      {showEditor && (
        <ProductHierarchyEditor
          isOpen={showEditor}
          onClose={closeEditor}
          onSaved={() => {
            closeEditor();
            loadData();
          }}
          product={editingProduct}
          productTree={products}
          focusSubId={focusSubId}
          themePrimary={themeColors.primary}
          themePrimaryHover={themeColors.primaryHover}
        />
      )}
    </div>
  );
};
