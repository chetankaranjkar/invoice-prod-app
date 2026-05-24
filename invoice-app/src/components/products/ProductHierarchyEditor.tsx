import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Save } from 'lucide-react';
import { api } from '../../services/agent';
import { useAuth } from '../../contexts/AuthContext';
import type { Product } from '../../types';
import type { ParentProductDraft, SubProductDraft } from './productHierarchyTypes';
import { resolveParentForEdit } from './productHierarchyUtils';
import { ParentProductCard } from './ParentProductCard';
import { SubProductTree } from './SubProductTree';

interface ProductHierarchyEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Parent product from tree, sub product (opens parent), or null for new */
  product: Product | null;
  productTree: Product[];
  focusSubId?: number;
  themePrimary?: string;
  themePrimaryHover?: string;
}

export const ProductHierarchyEditor: React.FC<ProductHierarchyEditorProps> = ({
  isOpen,
  onClose,
  onSaved,
  product,
  productTree,
  focusSubId,
  themePrimary = 'bg-indigo-600',
  themePrimaryHover = 'hover:bg-indigo-700',
}) => {
  const { profile } = useAuth();
  const defaultGst = profile?.defaultGstPercentage ?? 18;

  const [parent, setParent] = useState<ParentProductDraft>(() =>
    resolveParentForEdit(product, productTree, defaultGst).parent
  );
  const [subs, setSubs] = useState<SubProductDraft[]>(() =>
    resolveParentForEdit(product, productTree, defaultGst).subs
  );
  const [removedSubIds, setRemovedSubIds] = useState<number[]>([]);
  const [subsCollapsed, setSubsCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const focusSubKey = useMemo(() => {
    if (!focusSubId) return undefined;
    const sub = subs.find((s) => s.id === focusSubId);
    return sub?.clientKey ?? `sub_${focusSubId}`;
  }, [focusSubId, subs]);

  const parentGst = useMemo(
    () => (parent.defaultGstPercentage === '' ? defaultGst : Number(parent.defaultGstPercentage)),
    [parent.defaultGstPercentage, defaultGst]
  );

  const title = parent.id
    ? parent.name || 'Edit product package'
    : 'New main product';

  useEffect(() => {
    if (!isOpen) return;
    const resolved = resolveParentForEdit(product, productTree, defaultGst);
    setParent(resolved.parent);
    setSubs(resolved.subs);
    setRemovedSubIds([]);
    setError('');
    setSubsCollapsed(false);
  }, [isOpen, product, productTree, defaultGst]);

  const handleSubsChange = (next: SubProductDraft[]) => {
    const removed = subs.filter((s) => s.id && !next.some((n) => n.id === s.id));
    if (removed.length > 0) {
      setRemovedSubIds((ids) => [...ids, ...removed.map((s) => s.id!)]);
    }
    setSubs(next);
  };

  const saveHierarchy = async () => {
    const trimmedName = parent.name.trim();
    if (!trimmedName) {
      setError('Main product name is required');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const parentPayload = {
        name: trimmedName,
        productType: 'parent',
        defaultRate: parent.defaultRate === '' ? undefined : Number(parent.defaultRate),
        defaultGstPercentage:
          parent.defaultGstPercentage === '' ? undefined : Number(parent.defaultGstPercentage),
        affectTotal: parent.affectTotal,
        taxable: parent.taxable,
        description: parent.description.trim() || undefined,
        isActive: parent.isActive,
        displayOrder: 0,
      };

      let parentId = parent.id;
      if (parentId) {
        await api.products.update(parentId, parentPayload);
      } else {
        const res = await api.products.create(parentPayload);
        parentId = res.data.id;
      }

      for (const subId of removedSubIds) {
        await api.products.delete(subId);
      }

      const reorderItems: { id: number; displayOrder: number }[] = [];
      for (let i = 0; i < subs.length; i++) {
        const sub = subs[i];
        if (!sub.name.trim()) continue;
        const subPayload = {
          name: sub.name.trim(),
          productType: 'sub',
          parentProductId: parentId,
          defaultRate: sub.defaultRate === '' ? 0 : Number(sub.defaultRate),
          defaultGstPercentage: sub.inheritGstFromParent
            ? parentGst
            : sub.defaultGstPercentage === ''
              ? parentGst
              : Number(sub.defaultGstPercentage),
          affectTotal: sub.affectTotal,
          taxable: sub.taxable,
          inheritGstFromParent: sub.inheritGstFromParent,
          description: sub.description.trim() || undefined,
          isActive: sub.isActive,
          displayOrder: i + 1,
        };

        if (sub.id) {
          await api.products.update(sub.id, subPayload);
          reorderItems.push({ id: sub.id, displayOrder: i + 1 });
        } else {
          const res = await api.products.create(subPayload);
          reorderItems.push({ id: res.data.id, displayOrder: i + 1 });
        }
      }

      if (reorderItems.length > 0) {
        await api.products.reorder(reorderItems);
      }

      onSaved();
    } catch (err: unknown) {
      const res = (err as { response?: { data?: { message?: string } } })?.response?.data;
      setError(res?.message || 'Failed to save product hierarchy');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50">
      <motion.div
        role="dialog"
        aria-modal="true"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="bg-slate-50 w-full sm:max-w-2xl max-h-[100dvh] sm:max-h-[92vh] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
      >
        <header className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 bg-white shrink-0">
          <div>
            <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Product hierarchy</p>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">{title}</h2>
            <p className="text-xs text-slate-500 mt-1 max-w-md">
              Manage one main billable product and optional breakdown sub-lines for invoices.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-1">
          {error && (
            <div className="mb-3 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}

          <ParentProductCard parent={parent} onChange={(patch) => setParent((p) => ({ ...p, ...patch }))} />

          <SubProductTree
            subs={subs}
            parentGst={parentGst}
            collapsed={subsCollapsed}
            onToggleCollapse={() => setSubsCollapsed((c) => !c)}
            onChange={handleSubsChange}
            focusSubKey={focusSubKey}
          />
        </div>

        <footer className="shrink-0 flex flex-col-reverse sm:flex-row justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-200 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={saveHierarchy}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white rounded-lg ${themePrimary} ${themePrimaryHover} disabled:opacity-50`}
          >
            <Save className="h-4 w-4" />
            {loading ? 'Saving…' : 'Save product package'}
          </button>
        </footer>
      </motion.div>
    </div>
  );
};
