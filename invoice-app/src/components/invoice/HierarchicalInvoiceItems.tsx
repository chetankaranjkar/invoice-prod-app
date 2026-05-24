import React, { useMemo } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Layers,
} from 'lucide-react';
import type { InvoiceItem, Product } from '../../types';
import { ProductAutocomplete } from '../ProductAutocomplete';
import {
  buildInvoiceHierarchy,
  calculateInvoiceTotals,
  createLineKey,
  nextChildDisplayOrder,
  nextParentDisplayOrder,
  productToInvoiceLine,
} from '../../utils/invoiceCalculations';
import type { InvoiceLineInput } from '../../utils/invoiceCalculations';

const parentFieldBorder =
  '!border-blue-600 focus:!border-blue-600 focus:ring-blue-500';
const childFieldBorder =
  '!border-sky-300 focus:!border-sky-400 focus:ring-sky-300';
const parentInputClass = `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 ${parentFieldBorder}`;
const childInputClass = `w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 ${childFieldBorder}`;

interface HierarchicalInvoiceItemsProps {
  items: Partial<InvoiceItem>[];
  setItems: React.Dispatch<React.SetStateAction<Partial<InvoiceItem>[]>>;
  disableQuantity: boolean;
  defaultGstPercentage: number;
  /** When true (profile GST = 0), hide GST column in the line items table */
  hideGst?: boolean;
  onTotalsChange?: () => void;
}

export const HierarchicalInvoiceItems: React.FC<HierarchicalInvoiceItemsProps> = ({
  items,
  setItems,
  disableQuantity,
  defaultGstPercentage,
  hideGst = false,
  onTotalsChange,
}) => {
  const productColClass = hideGst ? 'min-w-[320px] w-[55%]' : 'min-w-[200px] w-[32%]';
  const hierarchy = useMemo(
    () => buildInvoiceHierarchy(items as InvoiceLineInput[]),
    [items]
  );

  const recalcAll = (next: Partial<InvoiceItem>[]) => {
    calculateInvoiceTotals(next as InvoiceLineInput[]);
    setItems([...next]);
    onTotalsChange?.();
  };

  const updateLine = (lineKey: string, field: keyof InvoiceItem, value: unknown) => {
    const next = items.map((item) =>
      item.lineKey === lineKey ? { ...item, [field]: value } : item
    );
    const idx = next.findIndex((i) => i.lineKey === lineKey);
    if (idx >= 0 && ['quantity', 'rate', 'gstPercentage', 'affectTotal', 'taxable'].includes(field)) {
      const qty = disableQuantity ? 1 : Number(next[idx].quantity) || 1;
      next[idx] = { ...next[idx], quantity: qty };
    }
    recalcAll(next);
  };

  const removeLine = (lineKey: string) => {
    const target = items.find((i) => i.lineKey === lineKey);
    const next = items.filter(
      (i) => i.lineKey !== lineKey && i.parentLineKey !== lineKey
    );
    if (target && !target.parentLineKey && next.length === 0) return;
    if (next.length === 0) {
      recalcAll([{ lineKey: createLineKey(), productName: '', quantity: 1, rate: 0, gstPercentage: defaultGstPercentage, affectTotal: true, hierarchyLevel: 0 }]);
      return;
    }
    recalcAll(next);
  };

  const toggleCollapse = (lineKey: string) => {
    setItems(
      items.map((i) =>
        i.lineKey === lineKey ? { ...i, collapsed: !i.collapsed } : i
      )
    );
  };

  const addParentLine = () => {
    recalcAll([
      ...items,
      {
        lineKey: createLineKey(),
        productName: '',
        quantity: 1,
        rate: 0,
        gstPercentage: defaultGstPercentage,
        affectTotal: true,
        taxable: true,
        hierarchyLevel: 0,
        showOnInvoice: true,
        displayOrder: nextParentDisplayOrder(items as InvoiceLineInput[]),
      },
    ]);
  };

  const addSubLine = (parentLineKey: string, parentGst: number) => {
    recalcAll([
      ...items,
      {
        lineKey: createLineKey(),
        parentLineKey,
        productName: '',
        quantity: 1,
        rate: 0,
        gstPercentage: parentGst,
        affectTotal: false,
        taxable: false,
        hierarchyLevel: 1,
        showOnInvoice: true,
        displayOrder: nextChildDisplayOrder(items as InvoiceLineInput[], parentLineKey),
      },
    ]);
  };

  const handleParentProductSelect = async (lineKey: string, product?: Product) => {
    if (!product) return;
    const parentLine = productToInvoiceLine(product);
    parentLine.lineKey = lineKey;

    let next = items.map((i) => (i.lineKey === lineKey ? { ...i, ...parentLine, lineKey } : i));

    try {
      const { api } = await import('../../services/agent');
      const res = await api.products.getChildren(product.id);
      const children = (res.data || []) as Product[];
      const childLines = children.map((child) =>
        productToInvoiceLine(child, lineKey, parentLine.gstPercentage)
      );
      next = [
        ...next.filter((i) => i.parentLineKey !== lineKey),
        ...childLines,
      ];
    } catch {
      // no children endpoint or empty
    }

    recalcAll(next);
  };

  const renderSubRow = (child: InvoiceLineInput, parentGst: number) => {
    const lineKey = child.lineKey!;
    return (
      <tr key={lineKey} className="bg-sky-50/50 border-b border-sky-100">
        <td className="w-8 pl-8">
          <span className="text-slate-300 font-mono text-xs">└</span>
        </td>
        <td className={`py-2 pr-2 ${productColClass}`}>
          <ProductAutocomplete
            value={child.productName || ''}
            onChange={(name, product) => {
              if (product) {
                const line = productToInvoiceLine(product, child.parentLineKey, parentGst);
                line.lineKey = lineKey;
                const next = items.map((i) => (i.lineKey === lineKey ? { ...i, ...line, lineKey } : i));
                recalcAll(next);
              } else {
                updateLine(lineKey, 'productName', name);
              }
            }}
            parentOnly={false}
            className={childFieldBorder}
            focusRing="focus:ring-sky-300"
            hideGstInSuggestions={hideGst}
            placeholder="Select sub-product…"
          />
        </td>
        {!disableQuantity && (
          <td className="py-2 w-20">
            <input
              type="number"
              min={1}
              value={child.quantity ?? 1}
              onChange={(e) => updateLine(lineKey, 'quantity', Number(e.target.value))}
              className={childInputClass}
            />
          </td>
        )}
        <td className="py-2 w-24">
          <input
            type="number"
            min={0}
            step="0.01"
            value={child.rate ?? 0}
            onChange={(e) => updateLine(lineKey, 'rate', Number(e.target.value))}
            className={childInputClass}
          />
        </td>
        {!hideGst && (
          <td className="py-2 w-20">
            <input
              type="number"
              min={0}
              max={100}
              value={child.gstPercentage ?? 0}
              onChange={(e) => updateLine(lineKey, 'gstPercentage', Number(e.target.value))}
              className={childInputClass}
              disabled={child.taxable === false}
            />
          </td>
        )}
        {!hideGst && (
          <td className="py-2 w-24 text-right text-sm tabular-nums text-slate-600">
            {child.affectTotal ? `₹${(child.amount ?? 0).toFixed(2)}` : '—'}
          </td>
        )}
        <td className="py-2 w-20">
          <div className="flex gap-1 justify-end">
            <button
              type="button"
              title={child.showOnInvoice === false ? 'Show on PDF' : 'Hide on PDF'}
              onClick={() => updateLine(lineKey, 'showOnInvoice', child.showOnInvoice === false)}
              className="p-1 text-slate-400 hover:text-indigo-600"
            >
              {child.showOnInvoice === false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
            <button type="button" onClick={() => removeLine(lineKey)} className="p-1 text-red-500 hover:bg-red-50 rounded">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1">
          <Layers className="h-4 w-4" /> Line items
        </h3>
        <button type="button" onClick={addParentLine} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
          <Plus className="h-3 w-3" /> Add parent product
        </button>
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-xs uppercase text-slate-600">
            <tr>
              <th className="w-8" />
              <th className={`text-left py-2 px-2 ${productColClass}`}>Product</th>
              {!disableQuantity && <th className="w-20 py-2">Qty</th>}
              <th className="w-24 py-2">Rate</th>
              {!hideGst && <th className="w-20 py-2">GST %</th>}
              {!hideGst && <th className="w-24 py-2 text-right">Line</th>}
              <th className="w-20 py-2" />
            </tr>
          </thead>
          <tbody>
            {hierarchy.map((parent) => {
              const lineKey = parent.lineKey || createLineKey();
              const parentGst = parent.gstPercentage ?? defaultGstPercentage;
              const hasChildren = (parent.children?.length ?? 0) > 0;
              return (
                <React.Fragment key={lineKey}>
                  <tr className="border-b border-blue-100 bg-white">
                    <td className="py-2 pl-2">
                      {hasChildren ? (
                        <button type="button" onClick={() => toggleCollapse(lineKey)} className="text-slate-500">
                          {parent.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      ) : null}
                    </td>
                    <td className={`py-2 pr-2 ${productColClass}`}>
                      <ProductAutocomplete
                        value={parent.productName || ''}
                        onChange={(name, product) => {
                          if (product) handleParentProductSelect(lineKey, product);
                          else updateLine(lineKey, 'productName', name);
                        }}
                        parentOnly
                        className={parentFieldBorder}
                        focusRing="focus:ring-blue-500"
                        hideGstInSuggestions={hideGst}
                        placeholder="Select product…"
                      />
                    </td>
                    {!disableQuantity && (
                      <td className="py-2">
                        <input
                          type="number"
                          min={1}
                          value={parent.quantity ?? 1}
                          onChange={(e) => updateLine(lineKey, 'quantity', Number(e.target.value))}
                          className={parentInputClass}
                        />
                      </td>
                    )}
                    <td className="py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={parent.rate ?? 0}
                        onChange={(e) => updateLine(lineKey, 'rate', Number(e.target.value))}
                        className={`${parentInputClass} font-semibold`}
                      />
                    </td>
                    {!hideGst && (
                      <td className="py-2">
                        <input
                          type="number"
                          value={parent.gstPercentage ?? defaultGstPercentage}
                          onChange={(e) => updateLine(lineKey, 'gstPercentage', Number(e.target.value))}
                          className={parentInputClass}
                        />
                      </td>
                    )}
                    {!hideGst && (
                      <td className="py-2 text-right font-semibold tabular-nums">
                        ₹{(parent.amount ?? 0).toFixed(2)}
                      </td>
                    )}
                    <td className="py-2">
                      <div className="flex gap-1 justify-end">
                        <button
                          type="button"
                          title="Add sub-item"
                          onClick={() => addSubLine(lineKey, parentGst)}
                          className="p-1 text-indigo-600 hover:bg-indigo-50 rounded"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => removeLine(lineKey)} className="p-1 text-red-500 hover:bg-red-50 rounded">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {!parent.collapsed &&
                    parent.children?.map((child) => renderSubRow(child, parentGst))}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
