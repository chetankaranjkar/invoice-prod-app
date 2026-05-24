import React, { useMemo } from 'react';
import type { InvoiceItem } from '../../types';
import {
  flattenHierarchyForRender,
  type FlattenHierarchyOptions,
} from '../../utils/invoiceCalculations';

export type InvoiceTableVariant = 'classic' | 'modern' | 'preview';

export interface InvoiceHierarchyRowsProps {
  items: InvoiceItem[];
  variant?: InvoiceTableVariant;
  emptyMessage?: string;
  renderOptions?: FlattenHierarchyOptions;
}

const variantStyles: Record<
  InvoiceTableVariant,
  {
    parentDesc: string;
    subDesc: string;
    parentAmount: string;
    subAmount: string;
    sr: string;
    tree: string;
    row: string;
    cellBorder: string;
  }
> = {
  classic: {
    parentDesc: 'font-medium text-[#1f2937]',
    subDesc: 'text-[11px] text-[#4b5563] font-normal pl-1',
    parentAmount: 'font-medium tabular-nums',
    subAmount: 'text-[11px] text-[#6b7280] tabular-nums',
    sr: 'border px-1 py-2 text-center align-top text-[#374151]',
    tree: 'text-[#9ca3af] font-mono text-[11px] mr-1',
    row: 'leading-tight',
    cellBorder: 'border',
  },
  modern: {
    parentDesc: 'font-semibold text-[#1f2937]',
    subDesc: 'text-[11px] text-[#4b5563] font-normal pl-1',
    parentAmount: 'font-semibold tabular-nums text-[#1f2937]',
    subAmount: 'text-[11px] text-[#6b7280] tabular-nums',
    sr: 'border border-[#e5e7eb] px-2 py-2 text-center align-top text-[#6b7280] font-semibold',
    tree: 'text-[#9ca3af] font-mono text-[10px] mr-1',
    row: 'leading-tight border-b border-[#e5e7eb]',
    cellBorder: 'border border-[#e5e7eb]',
  },
  preview: {
    parentDesc: 'font-medium text-[#1f2937]',
    subDesc: 'text-[10px] text-[#4b5563] pl-1',
    parentAmount: 'text-xs font-medium tabular-nums',
    subAmount: 'text-[10px] text-[#6b7280] tabular-nums',
    sr: 'border px-1 py-2 text-center w-[5%] align-top',
    tree: 'text-[#9ca3af] font-mono text-[9px] mr-0.5',
    row: '',
    cellBorder: 'border',
  },
};

function formatAmount(
  amount: number,
  isSub: boolean,
  affectTotal: boolean | undefined,
  showSubItemAmounts: boolean
): string {
  if (isSub && showSubItemAmounts === false) return '';
  if (isSub && !affectTotal && amount === 0) return '₹0';
  if (!affectTotal && amount === 0) return '₹0';
  return `₹${amount.toFixed(2)}`;
}

export const InvoiceHierarchyRows: React.FC<InvoiceHierarchyRowsProps> = ({
  items,
  variant = 'modern',
  emptyMessage = 'No items added yet.',
  renderOptions,
}) => {
  const styles = variantStyles[variant];
  const showSubItemAmounts = renderOptions?.showSubItemAmounts !== false;

  const rows = useMemo(
    () =>
      flattenHierarchyForRender(items, {
        visibleOnly: true,
        showSubItems: true,
        hideZeroCostSubs: false,
        ...renderOptions,
      }),
    [items, renderOptions]
  );

  if (rows.length === 0) {
    return (
      <tr>
        <td
          colSpan={3}
          className={`${styles.cellBorder} invoice-description-empty-cell px-2 py-4 text-center text-[#6b7280]`}
        >
          {emptyMessage}
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((row, index) => {
        const { item, isSub, serialNumber, treePrefix } = row;
        const quantity = Number(item.quantity) || 0;
        const rate = Number(item.rate) || 0;
        const amount = Number(item.amount) ?? quantity * rate;
        const gstPercentage = Number(item.gstPercentage) || 0;
        const showDetails =
          !isSub && (quantity !== 1 || gstPercentage !== 0);

        return (
          <tr
            key={row.key}
            className={`${styles.row} ${isSub ? 'bg-slate-50/60' : index % 2 === 1 && !isSub ? 'bg-[#f9fafb]' : 'bg-white'}`}
            style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}
          >
            <td className={`${styles.sr} w-[7%] min-w-[2rem]`}>
              {serialNumber ?? ''}
            </td>
            <td className={`${styles.cellBorder} px-2 py-2 align-top`}>
              <div className="flex items-start gap-0.5">
                {isSub && (
                  <span className={`${styles.tree} shrink-0`} aria-hidden>
                    {treePrefix}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className={isSub ? styles.subDesc : styles.parentDesc}>
                    {item.productName}
                  </div>
                  {showDetails && (
                    <div className="text-[9px] text-[#6b7280] mt-0.5 leading-tight">
                      Qty: {quantity} &middot; Rate: ₹{rate.toFixed(2)}
                      {gstPercentage > 0 && ` · GST: ${gstPercentage}%`}
                    </div>
                  )}
                  {isSub && item.affectTotal === false && (
                    <div className="text-[9px] text-[#9ca3af] mt-0.5">Breakdown (non-billable)</div>
                  )}
                </div>
              </div>
            </td>
            <td
              className={`${styles.cellBorder} px-2 py-2 text-right align-top w-[18%] ${
                isSub ? styles.subAmount : styles.parentAmount
              }`}
            >
              {formatAmount(amount, isSub, item.affectTotal, showSubItemAmounts)}
            </td>
          </tr>
        );
      })}
    </>
  );
};

/** Bordered table shell shared by static / classic layouts */
export const InvoiceItemsTable: React.FC<{
  variant: InvoiceTableVariant;
  headerVariant?: 'classic' | 'modern';
  items: InvoiceItem[];
  footer?: React.ReactNode;
  renderOptions?: FlattenHierarchyOptions;
}> = ({
  variant,
  headerVariant = variant === 'classic' ? 'classic' : 'modern',
  items,
  footer,
  renderOptions,
}) => {
  const isModern = headerVariant === 'modern';

  return (
    <div className="w-full invoice-hierarchy-table-wrap invoice-description-table-wrap rounded-lg overflow-hidden border border-[#d1d5db]">
      <table className="invoice-table invoice-hierarchy-table invoice-description-table w-full h-auto text-left border-collapse text-[10px] sm:text-xs md:text-sm table-fixed">
        <thead>
          <tr className={isModern ? 'bg-[#1f2937] text-white' : 'bg-[#d1d5dc]'}>
            <th
              className={`border border-[#9ca3af] px-2 py-2 w-[8%] text-center font-semibold uppercase tracking-wide ${
                isModern ? 'text-[10px]' : ''
              }`}
            >
              {isModern ? '#' : 'SR. no'}
            </th>
            <th
              className={`border border-[#9ca3af] px-2 py-2 font-semibold uppercase tracking-wide ${
                isModern ? 'text-[10px] text-left' : ''
              }`}
            >
              Description
            </th>
            <th
              className={`border border-[#9ca3af] px-2 py-2 w-[20%] text-right font-semibold uppercase tracking-wide ${
                isModern ? 'text-[10px]' : 'text-center'
              }`}
            >
              Amount (INR)
            </th>
          </tr>
        </thead>
        <tbody style={{ verticalAlign: 'top' }}>
          <InvoiceHierarchyRows
            items={items}
            variant={variant}
            renderOptions={renderOptions}
          />
        </tbody>
        {footer}
      </table>
    </div>
  );
};
