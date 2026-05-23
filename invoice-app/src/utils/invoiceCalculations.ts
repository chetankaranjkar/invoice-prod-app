import type { InvoiceItem } from '../types';
import { calculateGST } from './helpers';

export type InvoiceLineInput = Partial<InvoiceItem> & {
  lineKey?: string;
  parentLineKey?: string;
};

export interface InvoiceTotals {
  totalAmount: number;
  gstAmount: number;
  cgst: number;
  sgst: number;
  grandTotal: number;
}

export interface HierarchicalInvoiceLine extends InvoiceLineInput {
  children?: HierarchicalInvoiceLine[];
}

const roundMoney = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calculateLineAmounts(
  quantity: number,
  rate: number,
  gstPercentage: number,
  taxable: boolean,
  affectTotal: boolean
) {
  const amount = roundMoney((quantity || 0) * (rate || 0));
  if (!affectTotal || !taxable || !gstPercentage) {
    return { amount, gstAmount: 0, cgst: 0, sgst: 0, total: amount };
  }
  const gst = calculateGST(amount, gstPercentage);
  return { amount, ...gst };
}

export function flattenInvoiceItems(
  items: InvoiceLineInput[],
  options?: { visibleOnly?: boolean; hideZeroCostSubs?: boolean }
): InvoiceLineInput[] {
  const { visibleOnly = false, hideZeroCostSubs = false } = options ?? {};
  const parents = items.filter((i) => !i.parentLineKey && (i.hierarchyLevel ?? 0) === 0);
  const childrenByParent = new Map<string, InvoiceLineInput[]>();

  items
    .filter((i) => i.parentLineKey)
    .forEach((child) => {
      const key = child.parentLineKey!;
      if (!childrenByParent.has(key)) childrenByParent.set(key, []);
      childrenByParent.get(key)!.push(child);
    });

  const flat: InvoiceLineInput[] = [];
  parents.forEach((parent) => {
    if (visibleOnly && parent.showOnInvoice === false) return;
    flat.push(parent);
    const kids = childrenByParent.get(parent.lineKey ?? '') ?? [];
    kids
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .forEach((child) => {
        if (visibleOnly && child.showOnInvoice === false) return;
        if (hideZeroCostSubs && !child.affectTotal) {
          const amt = child.amount ?? (child.quantity ?? 0) * (child.rate ?? 0);
          if (amt === 0) return;
        }
        flat.push(child);
      });
  });

  const orphanChildren = items.filter(
    (i) => i.parentLineKey && !parents.some((p) => p.lineKey === i.parentLineKey)
  );
  return [...flat, ...orphanChildren];
}

export function buildInvoiceHierarchy(items: InvoiceLineInput[]): HierarchicalInvoiceLine[] {
  const parents = items
    .filter((i) => !i.parentLineKey && (i.hierarchyLevel ?? 0) === 0)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const childrenByParent = new Map<string, InvoiceLineInput[]>();
  items
    .filter((i) => i.parentLineKey)
    .forEach((child) => {
      const key = child.parentLineKey!;
      if (!childrenByParent.has(key)) childrenByParent.set(key, []);
      childrenByParent.get(key)!.push(child);
    });

  return parents.map((parent) => ({
    ...parent,
    children: (childrenByParent.get(parent.lineKey ?? '') ?? [])
      .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
      .map((c) => ({ ...c })),
  }));
}

export function calculateInvoiceTotals(items: InvoiceLineInput[]): InvoiceTotals {
  let totalAmount = 0;
  let gstAmount = 0;

  items.forEach((item) => {
    const affectTotal = item.affectTotal !== false;
    const taxable = item.taxable !== false;
    const qty = item.quantity ?? 1;
    const rate = item.rate ?? 0;
    const gstPct = item.gstPercentage ?? 0;
    const line = calculateLineAmounts(qty, rate, gstPct, taxable, affectTotal);

    item.amount = line.amount;
    item.gstAmount = line.gstAmount;
    item.cgst = line.cgst;
    item.sgst = line.sgst;

    if (affectTotal) {
      totalAmount += line.amount;
      gstAmount += line.gstAmount;
    }
  });

  totalAmount = roundMoney(totalAmount);
  gstAmount = roundMoney(gstAmount);
  const cgst = roundMoney(gstAmount / 2);
  const sgst = roundMoney(gstAmount - cgst);

  return {
    totalAmount,
    gstAmount,
    cgst,
    sgst,
    grandTotal: roundMoney(totalAmount + gstAmount),
  };
}

export function createLineKey(): string {
  return `line_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function productToInvoiceLine(
  product: {
    id: number;
    name: string;
    defaultRate?: number;
    defaultGstPercentage?: number;
    affectTotal?: boolean;
    taxable?: boolean;
    inheritGstFromParent?: boolean;
    productType?: string;
    parentProductId?: number | null;
  },
  parentLineKey?: string,
  parentGst?: number
): InvoiceLineInput {
  const isSub = product.productType === 'sub' || !!parentLineKey;
  const gst =
    isSub && product.inheritGstFromParent && parentGst != null
      ? parentGst
      : product.defaultGstPercentage ?? parentGst ?? 18;

  return {
    lineKey: createLineKey(),
    parentLineKey,
    productId: product.id,
    productName: product.name,
    quantity: 1,
    rate: product.defaultRate ?? 0,
    gstPercentage: gst,
    affectTotal: product.affectTotal ?? !isSub,
    taxable: product.taxable ?? !isSub,
    hierarchyLevel: isSub ? 1 : 0,
    showOnInvoice: true,
    amount: 0,
    gstAmount: 0,
    cgst: 0,
    sgst: 0,
  };
}

/** Map persisted invoice lines (with parentInvoiceItemId) to editable form lines. */
export function mapApiItemsToFormItems(
  apiItems: Array<{
    id?: number;
    productId?: number;
    productName: string;
    quantity: number;
    rate: number;
    gstPercentage: number;
    amount?: number;
    gstAmount?: number;
    cgst?: number;
    sgst?: number;
    parentInvoiceItemId?: number | null;
    hierarchyLevel?: number;
    affectTotal?: boolean;
    taxable?: boolean;
    displayOrder?: number;
    showOnInvoice?: boolean;
  }>
): InvoiceLineInput[] {
  const idToLineKey = new Map<number, string>();
  const parents = [...apiItems]
    .filter((i) => !i.parentInvoiceItemId)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
  const children = [...apiItems]
    .filter((i) => i.parentInvoiceItemId)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

  const result: InvoiceLineInput[] = [];

  parents.forEach((item) => {
    const lineKey = createLineKey();
    if (item.id != null) idToLineKey.set(item.id, lineKey);
    result.push({
      ...item,
      lineKey,
      hierarchyLevel: item.hierarchyLevel ?? 0,
      affectTotal: item.affectTotal !== false,
      taxable: item.taxable !== false,
      showOnInvoice: item.showOnInvoice !== false,
    });
  });

  children.forEach((item) => {
    const lineKey = createLineKey();
    const parentLineKey =
      item.parentInvoiceItemId != null
        ? idToLineKey.get(item.parentInvoiceItemId)
        : undefined;
    result.push({
      ...item,
      lineKey,
      parentLineKey,
      hierarchyLevel: item.hierarchyLevel ?? 1,
      affectTotal: item.affectTotal === true,
      taxable: item.taxable !== false,
      showOnInvoice: item.showOnInvoice !== false,
    });
  });

  return result;
}

export function toInvoiceItemDtoPayload(items: InvoiceLineInput[]) {
  return items.map((item, index) => ({
    productId: item.productId,
    productName: item.productName ?? '',
    quantity: item.quantity ?? 1,
    rate: item.rate ?? 0,
    gstPercentage: item.gstPercentage ?? 0,
    lineKey: item.lineKey,
    parentLineKey: item.parentLineKey,
    hierarchyLevel: item.hierarchyLevel ?? 0,
    affectTotal: item.affectTotal !== false,
    taxable: item.taxable !== false,
    displayOrder: item.displayOrder ?? index + 1,
    showOnInvoice: item.showOnInvoice !== false,
  }));
}
