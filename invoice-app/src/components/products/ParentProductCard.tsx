import React from 'react';
import { Layers } from 'lucide-react';
import type { ParentProductDraft } from './productHierarchyTypes';
import { MainProductBadge } from './ProductBillableBadges';

interface ParentProductCardProps {
  parent: ParentProductDraft;
  onChange: (patch: Partial<ParentProductDraft>) => void;
}

export const ParentProductCard: React.FC<ParentProductCardProps> = ({ parent, onChange }) => (
  <section className="rounded-xl border-2 border-indigo-200 bg-gradient-to-br from-indigo-50/90 to-white p-4 sm:p-5 shadow-sm">
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
        <Layers className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-indigo-600 uppercase tracking-wide">Main billable product</p>
        <h3 className="text-base font-semibold text-slate-900">Product details</h3>
      </div>
      <MainProductBadge />
    </div>

    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Product name *</label>
        <input
          type="text"
          value={parent.name}
          onChange={(e) => onChange({ name: e.target.value })}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          placeholder="e.g. Application Cost"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Default rate (₹)</label>
          <input
            type="number"
            min={0}
            step={0.01}
            value={parent.defaultRate}
            onChange={(e) => onChange({ defaultRate: e.target.value === '' ? '' : Number(e.target.value) })}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">GST %</label>
          <input
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={parent.defaultGstPercentage}
            onChange={(e) =>
              onChange({ defaultGstPercentage: e.target.value === '' ? '' : Number(e.target.value) })
            }
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={parent.affectTotal}
            onChange={(e) => onChange({ affectTotal: e.target.checked })}
            className="rounded border-slate-300 text-indigo-600"
          />
          <span>Affects invoice total</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={parent.taxable}
            onChange={(e) => onChange({ taxable: e.target.checked })}
            className="rounded border-slate-300 text-indigo-600"
          />
          <span>Taxable (GST applies)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={parent.isActive}
            onChange={(e) => onChange({ isActive: e.target.checked })}
            className="rounded border-slate-300 text-indigo-600"
          />
          <span>Active</span>
        </label>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
        <textarea
          value={parent.description}
          onChange={(e) => onChange({ description: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-none"
          placeholder="Optional — shown internally"
        />
      </div>
    </div>
  </section>
);
