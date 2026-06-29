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

/** Row model for invoice table / PDF rendering */
export interface RenderInvoiceRow {
  key: string;
  item: InvoiceLineInput;
  isSub: boolean;
  /** SR column: number for parent, empty for sub-lines */
  serialNumber: number | null;
  treePrefix: '' | '├' | '└';
}

export interface FlattenHierarchyOptions {
  visibleOnly?: boolean;
  /** @deprecated Prefer showSubItems — when false, hides all sub-lines */
  hideZeroCostSubs?: boolean;
  showSubItems?: boolean;
  showSubItemAmounts?: boolean;
  hideInternalBreakdown?: boolean;
}

function shouldShowSubLine(
  child: InvoiceLineInput,
  options: FlattenHierarchyOptions
): boolean {
  if (options.hideInternalBreakdown) return false;
  if (options.showSubItems === false) return false;
  if (options.visibleOnly && child.showOnInvoice === false) return false;
  if (options.hideZeroCostSubs && !child.affectTotal) {
    const amt = child.amount ?? (Number(child.quantity) || 0) * (Number(child.rate) || 0);
    if (amt === 0) return false;
  }
  return true;
}

/** Flat list for legacy callers; prefer flattenHierarchyForRender for templates. */
export function flattenInvoiceItems(
  items: InvoiceLineInput[],
  options?: FlattenHierarchyOptions
): InvoiceLineInput[] {
  return flattenHierarchyForRender(items, options).map((r) => r.item);
}

/**
 * Parent-first tree flattening with SR only on parents and tree prefixes on subs.
 */
export function flattenHierarchyForRender(
  items: InvoiceLineInput[],
  options: FlattenHierarchyOptions = {}
): RenderInvoiceRow[] {
  const normalized = ensureHierarchyKeys(items);
  const hierarchy = buildInvoiceHierarchy(normalized);
  const rows: RenderInvoiceRow[] = [];
  let serial = 0;

  hierarchy.forEach((parent) => {
    if (options.visibleOnly && parent.showOnInvoice === false) return;

    serial += 1;
    rows.push({
      key: parent.lineKey ?? `p-${serial}`,
      item: parent,
      isSub: false,
      serialNumber: serial,
      treePrefix: '',
    });

    const kids = (parent.children ?? []).filter((c) => shouldShowSubLine(c, options));
    kids.forEach((child, idx) => {
      const isLast = idx === kids.length - 1;
      rows.push({
        key: child.lineKey ?? `c-${serial}-${idx}`,
        item: child,
        isSub: true,
        serialNumber: null,
        treePrefix: isLast ? '└' : '├',
      });
    });
  });

  return rows;
}

/** Ensure lineKey / parentLineKey exist (API uses parentInvoiceItemId). */
export function ensureHierarchyKeys(items: InvoiceLineInput[]): InvoiceLineInput[] {
  if (!items.length) return [];

  const hasLineKeys = items.some((i) => i.lineKey);
  const hasParentRefs = items.some((i) => i.parentLineKey || i.parentInvoiceItemId != null);

  if (hasLineKeys && items.every((i) => !i.parentInvoiceItemId || i.parentLineKey)) {
    return items.map((i) => ({ ...i }));
  }

  if (hasParentRefs) {
    return mapApiItemsToFormItems(
      items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName ?? '',
        quantity: i.quantity ?? 1,
        rate: i.rate ?? 0,
        gstPercentage: i.gstPercentage ?? 0,
        amount: i.amount,
        gstAmount: i.gstAmount,
        cgst: i.cgst,
        sgst: i.sgst,
        parentInvoiceItemId: i.parentInvoiceItemId,
        hierarchyLevel: i.hierarchyLevel,
        affectTotal: i.affectTotal,
        taxable: i.taxable,
        displayOrder: i.displayOrder,
        showOnInvoice: i.showOnInvoice,
      }))
    );
  }

  return items.map((i, index) => ({
    ...i,
    lineKey: i.lineKey ?? `legacy-${index}`,
    hierarchyLevel: i.hierarchyLevel ?? 0,
  }));
}

/** Form / editor state → preview + PDF items (keeps hierarchy, includes ₹0 sub-lines). */
export function formItemsToPreviewInvoiceItems(items: InvoiceLineInput[]): InvoiceItem[] {
  const working = items
    .filter((i) => (i.productName ?? '').trim().length > 0)
    .map((i) => ({ ...i }));

  calculateInvoiceTotals(working);

  return working.map((item, index) => ({
    id: item.id ?? index,
    productId: item.productId,
    productName: item.productName!.trim(),
    quantity: item.quantity ?? 1,
    rate: item.rate ?? 0,
    amount: item.amount ?? 0,
    gstPercentage: item.gstPercentage ?? 0,
    gstAmount: item.gstAmount ?? 0,
    cgst: item.cgst ?? 0,
    sgst: item.sgst ?? 0,
    lineKey: item.lineKey,
    parentLineKey: item.parentLineKey,
    parentInvoiceItemId: item.parentInvoiceItemId,
    hierarchyLevel: item.hierarchyLevel ?? (item.parentLineKey ? 1 : 0),
    affectTotal: item.affectTotal,
    taxable: item.taxable,
    displayOrder: item.displayOrder,
    showOnInvoice: item.showOnInvoice,
  }));
}

/** API / dashboard invoice lines → render-ready items */
export function normalizeInvoiceItemsForRender(items: InvoiceItem[]): InvoiceItem[] {
  if (!items?.length) return [];
  const prepared = ensureHierarchyKeys(items);
  calculateInvoiceTotals(prepared);
  return formItemsToPreviewInvoiceItems(prepared);
}

export function nextParentDisplayOrder(items: InvoiceLineInput[]): number {
  const orders = items
    .filter((i) => !i.parentLineKey && (i.hierarchyLevel ?? 0) === 0)
    .map((i) => i.displayOrder ?? 0);
  return (orders.length ? Math.max(...orders) : 0) + 1;
}

export function nextChildDisplayOrder(items: InvoiceLineInput[], parentLineKey: string): number {
  const orders = items
    .filter((i) => i.parentLineKey === parentLineKey)
    .map((i) => i.displayOrder ?? 0);
  return (orders.length ? Math.max(...orders) : 0) + 1;
}

export function buildInvoiceHierarchy(items: InvoiceLineInput[]): HierarchicalInvoiceLine[] {
  const indexed = items.map((item, index) => ({ item, index }));
  const parents = indexed
    .filter(({ item }) => !item.parentLineKey && (item.hierarchyLevel ?? 0) === 0)
    .sort((a, b) => {
      const byOrder = (a.item.displayOrder ?? 0) - (b.item.displayOrder ?? 0);
      return byOrder !== 0 ? byOrder : a.index - b.index;
    })
    .map(({ item }) => item);

  const childrenByParent = new Map<string, { item: InvoiceLineInput; index: number }[]>();
  indexed
    .filter(({ item }) => item.parentLineKey)
    .forEach(({ item, index }) => {
      const key = item.parentLineKey!;
      if (!childrenByParent.has(key)) childrenByParent.set(key, []);
      childrenByParent.get(key)!.push({ item, index });
    });

  return parents.map((parent) => ({
    ...parent,
    children: (childrenByParent.get(parent.lineKey ?? '') ?? [])
      .sort((a, b) => {
        const byOrder = (a.item.displayOrder ?? 0) - (b.item.displayOrder ?? 0);
        return byOrder !== 0 ? byOrder : a.index - b.index;
      })
      .map(({ item }) => ({ ...item })),
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
  parentGst?: number,
  profileDefaultGst?: number
): InvoiceLineInput {
  const isSub = product.productType === 'sub' || !!parentLineKey;
  const gst =
    isSub && product.inheritGstFromParent && parentGst != null
      ? parentGst
      : profileDefaultGst === 0
        ? 0
        : product.defaultGstPercentage ?? parentGst ?? profileDefaultGst ?? 18;

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
    parentInvoiceItemId?: number;
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
