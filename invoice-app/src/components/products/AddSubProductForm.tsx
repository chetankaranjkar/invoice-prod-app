import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import type { SubProductDraft } from './productHierarchyTypes';
import { createEmptySub } from './productHierarchyTypes';

interface AddSubProductFormProps {
  parentGst: number;
  displayOrder: number;
  onAdd: (sub: SubProductDraft) => void;
  onCancel: () => void;
}

export const AddSubProductForm: React.FC<AddSubProductFormProps> = ({
  parentGst,
  displayOrder,
  onAdd,
  onCancel,
}) => {
  const [draft, setDraft] = useState(() => createEmptySub(displayOrder, parentGst));

  const submit = () => {
    if (!draft.name.trim()) return;
    onAdd({ ...draft, name: draft.name.trim() });
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="ml-6 sm:ml-8 border-l-2 border-dashed border-slate-300 pl-4 py-2"
    >
      <p className="text-xs font-medium text-slate-500 mb-2">New sub product (breakdown line)</p>
      <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 shadow-sm">
        <input
          type="text"
          autoFocus
          value={draft.name}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          placeholder="e.g. Frontend Development"
          className="w-full px-2 py-1.5 text-sm border border-slate-300 rounded-md"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            step={0.01}
            value={draft.defaultRate}
            onChange={(e) => setDraft((d) => ({ ...d, defaultRate: Number(e.target.value) }))}
            className="px-2 py-1.5 text-sm border rounded-md"
            placeholder="Rate ₹"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={draft.inheritGstFromParent ? '' : draft.defaultGstPercentage}
            disabled={draft.inheritGstFromParent}
            onChange={(e) =>
              setDraft((d) => ({ ...d, defaultGstPercentage: Number(e.target.value) }))
            }
            className="px-2 py-1.5 text-sm border rounded-md disabled:bg-slate-100"
            placeholder="GST %"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={draft.inheritGstFromParent}
            onChange={(e) =>
              setDraft((d) => ({
                ...d,
                inheritGstFromParent: e.target.checked,
                defaultGstPercentage: e.target.checked ? parentGst : d.defaultGstPercentage,
              }))
            }
          />
          Use parent GST %
        </label>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onCancel} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded">
            <X className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={submit}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            <Check className="h-3.5 w-3.5" /> Add
          </button>
        </div>
      </div>
    </motion.div>
  );
};
