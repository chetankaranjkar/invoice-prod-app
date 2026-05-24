import type { Product } from '../../types';
import type { ParentProductDraft, SubProductDraft } from './productHierarchyTypes';
import { createEmptyParent } from './productHierarchyTypes';

export function parentFromApi(product: Product, defaultGst: number): ParentProductDraft {
  return {
    id: product.id,
    name: product.name,
    defaultRate: product.defaultRate ?? '',
    defaultGstPercentage: product.defaultGstPercentage ?? defaultGst,
    taxable: product.taxable !== false,
    affectTotal: product.affectTotal !== false,
    description: product.description ?? '',
    isActive: product.isActive !== false,
  };
}

export function subsFromApi(children: Product[] | undefined, parentGst: number): SubProductDraft[] {
  return (children ?? [])
    .slice()
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0))
    .map((c, index) => ({
      id: c.id,
      clientKey: `sub_${c.id}`,
      name: c.name,
      defaultRate: c.defaultRate ?? 0,
      defaultGstPercentage: c.defaultGstPercentage ?? parentGst,
      taxable: c.taxable === true,
      affectTotal: c.affectTotal === true,
      inheritGstFromParent: c.inheritGstFromParent === true,
      description: c.description ?? '',
      isActive: c.isActive !== false,
      displayOrder: c.displayOrder ?? index + 1,
    }));
}

export function resolveParentForEdit(
  product: Product | null,
  tree: Product[],
  defaultGst: number
): { parent: ParentProductDraft; subs: SubProductDraft[] } {
  if (!product) {
    return { parent: createEmptyParent(defaultGst), subs: [] };
  }

  if (product.productType === 'sub' && product.parentProductId) {
    const parentNode =
      tree.find((p) => p.id === product.parentProductId) ??
      tree.find((p) => p.children?.some((c) => c.id === product.id));
    if (parentNode) {
      return {
        parent: parentFromApi(parentNode, defaultGst),
        subs: subsFromApi(parentNode.children, Number(parentNode.defaultGstPercentage) || defaultGst),
      };
    }
  }

  return {
    parent: parentFromApi(product, defaultGst),
    subs: subsFromApi(product.children, Number(product.defaultGstPercentage) || defaultGst),
  };
}

export function reorderSubs(subs: SubProductDraft[], fromIndex: number, toIndex: number): SubProductDraft[] {
  const next = [...subs];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next.map((s, i) => ({ ...s, displayOrder: i + 1 }));
}
