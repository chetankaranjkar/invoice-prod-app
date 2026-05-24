import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, GitBranch } from 'lucide-react';
import type { SubProductDraft } from './productHierarchyTypes';
import { createEmptySub } from './productHierarchyTypes';
import { reorderSubs } from './productHierarchyUtils';
import { SubProductNode } from './SubProductNode';
import { AddSubProductForm } from './AddSubProductForm';

interface SubProductTreeProps {
  subs: SubProductDraft[];
  parentGst: number;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onChange: (subs: SubProductDraft[]) => void;
  focusSubKey?: string;
}

export const SubProductTree: React.FC<SubProductTreeProps> = ({
  subs,
  parentGst,
  collapsed,
  onToggleCollapse,
  onChange,
  focusSubKey,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const updateSub = (index: number, patch: Partial<SubProductDraft>) => {
    onChange(subs.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const removeSub = (index: number) => {
    onChange(
      subs.filter((_, i) => i !== index).map((s, i) => ({ ...s, displayOrder: i + 1 }))
    );
  };

  const addSub = (sub: SubProductDraft) => {
    onChange([...subs, { ...sub, displayOrder: subs.length + 1 }]);
    setShowAddForm(false);
  };

  const quickAdd = () => {
    const sub = createEmptySub(subs.length + 1, parentGst);
    sub.name = 'New sub product';
    onChange([...subs, sub]);
  };

  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-sm font-semibold text-slate-800"
        >
          <GitBranch className="h-4 w-4 text-indigo-600" />
          Sub products
          <span className="text-xs font-normal text-slate-500">({subs.length})</span>
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200"
          >
            <Plus className="h-3.5 w-3.5" /> Add sub product
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-500 mb-3">
        Breakdown lines appear on the invoice under the main product. They do not change the total unless marked billable.
      </p>

      {!collapsed && (
        <motion.div initial={false} animate={{ height: 'auto', opacity: 1 }}>
          {subs.length === 0 && !showAddForm ? (
            <div className="ml-6 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
              No sub products yet. Add components like Frontend, API, or SQL setup.
              <button
                type="button"
                onClick={quickAdd}
                className="block mx-auto mt-3 text-indigo-600 font-medium hover:underline"
              >
                Add first sub product
              </button>
            </div>
          ) : (
            <ul className="space-y-0">
              <AnimatePresence initial={false}>
                {subs.map((sub, index) => (
                  <SubProductNode
                    key={sub.clientKey}
                    sub={sub}
                    isFirst={index === 0}
                    isLast={index === subs.length - 1}
                    highlighted={focusSubKey === sub.clientKey || focusSubKey === `sub_${sub.id}`}
                    parentGst={parentGst}
                    onUpdate={(patch) => updateSub(index, patch)}
                    onDelete={() => removeSub(index)}
                    onMoveUp={() => index > 0 && onChange(reorderSubs(subs, index, index - 1))}
                    onMoveDown={() =>
                      index < subs.length - 1 && onChange(reorderSubs(subs, index, index + 1))
                    }
                    onDragStart={() => setDragIndex(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIndex !== null && dragIndex !== index) {
                        onChange(reorderSubs(subs, dragIndex, index));
                      }
                      setDragIndex(null);
                    }}
                  />
                ))}
              </AnimatePresence>
            </ul>
          )}

          <AnimatePresence>
            {showAddForm && (
              <AddSubProductForm
                parentGst={parentGst}
                displayOrder={subs.length + 1}
                onAdd={addSub}
                onCancel={() => setShowAddForm(false)}
              />
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </section>
  );
};
