import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { GripVertical, Pencil, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { SubProductDraft } from './productHierarchyTypes';
import { BillableBadge, SubProductBadge } from './ProductBillableBadges';

interface SubProductNodeProps {
  sub: SubProductDraft;
  isLast: boolean;
  isFirst: boolean;
  highlighted?: boolean;
  parentGst: number;
  onUpdate: (patch: Partial<SubProductDraft>) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: () => void;
}

export const SubProductNode: React.FC<SubProductNodeProps> = ({
  sub,
  isLast,
  highlighted,
  parentGst,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  const [editing, setEditing] = useState(false);
  const rate = sub.defaultRate === '' ? 0 : Number(sub.defaultRate);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 8 }}
      className={`relative flex gap-2 ${highlighted ? 'ring-2 ring-indigo-400 ring-offset-2 rounded-lg' : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver(e);
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <div className="flex flex-col items-center w-5 shrink-0 pt-3 text-slate-300">
        <span className="font-mono text-sm leading-none">├</span>
        {!isLast && <span className="w-px flex-1 bg-slate-200 min-h-[2rem]" />}
      </div>

      <div className="flex-1 min-w-0 mb-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50/80 hover:bg-white transition-colors p-3 shadow-sm">
          <div className="flex flex-wrap items-start gap-2 justify-between">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <button
                type="button"
                draggable
                onDragStart={onDragStart}
                className="mt-0.5 p-1 text-slate-400 cursor-grab active:cursor-grabbing hover:text-slate-600"
                title="Drag to reorder"
              >
                <GripVertical className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                {editing ? (
                  <input
                    type="text"
                    autoFocus
                    value={sub.name}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    onBlur={() => setEditing(false)}
                    className="w-full font-medium text-sm border border-indigo-300 rounded px-2 py-1"
                  />
                ) : (
                  <p className="font-medium text-slate-800 truncate">{sub.name || 'Untitled sub product'}</p>
                )}
                <p className="text-sm text-slate-600 mt-0.5 tabular-nums">
                  ₹{rate.toFixed(2)}
                  {sub.inheritGstFromParent && (
                    <span className="text-xs text-slate-400 ml-1">· GST from parent ({parentGst}%)</span>
                  )}
                </p>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  <SubProductBadge />
                  <BillableBadge billable={sub.affectTotal} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button type="button" onClick={onMoveUp} className="p-1.5 text-slate-400 hover:text-slate-700 rounded" title="Move up">
                <ChevronUp className="h-4 w-4" />
              </button>
              <button type="button" onClick={onMoveDown} className="p-1.5 text-slate-400 hover:text-slate-700 rounded" title="Move down">
                <ChevronDown className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setEditing(true)} className="p-1.5 text-slate-500 hover:text-indigo-600 rounded" title="Rename">
                <Pencil className="h-4 w-4" />
              </button>
              <button type="button" onClick={onDelete} className="p-1.5 text-slate-500 hover:text-red-600 rounded" title="Remove">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {editing && (
            <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <label className="text-xs text-slate-500">Rate (₹)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={sub.defaultRate}
                  onChange={(e) =>
                    onUpdate({ defaultRate: e.target.value === '' ? '' : Number(e.target.value) })
                  }
                  className="w-full mt-0.5 px-2 py-1 border rounded"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">GST %</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  disabled={sub.inheritGstFromParent}
                  value={sub.inheritGstFromParent ? parentGst : sub.defaultGstPercentage}
                  onChange={(e) => onUpdate({ defaultGstPercentage: Number(e.target.value) })}
                  className="w-full mt-0.5 px-2 py-1 border rounded disabled:bg-slate-100"
                />
              </div>
              <label className="flex items-center gap-2 text-xs sm:col-span-2">
                <input
                  type="checkbox"
                  checked={sub.inheritGstFromParent}
                  onChange={(e) =>
                    onUpdate({
                      inheritGstFromParent: e.target.checked,
                      defaultGstPercentage: e.target.checked ? parentGst : sub.defaultGstPercentage,
                    })
                  }
                />
                Inherit GST from main product
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={sub.affectTotal}
                  onChange={(e) => onUpdate({ affectTotal: e.target.checked })}
                />
                Affects invoice total
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={sub.taxable}
                  onChange={(e) => onUpdate({ taxable: e.target.checked })}
                />
                Taxable
              </label>
            </div>
          )}
        </div>
      </div>
    </motion.li>
  );
};
