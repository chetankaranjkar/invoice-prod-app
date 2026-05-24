/** Local draft types for the hierarchy editor (decoupled from API Product). */
export interface ParentProductDraft {
  id?: number;
  name: string;
  defaultRate: number | '';
  defaultGstPercentage: number | '';
  taxable: boolean;
  affectTotal: boolean;
  description: string;
  isActive: boolean;
}

export interface SubProductDraft {
  id?: number;
  clientKey: string;
  name: string;
  defaultRate: number | '';
  defaultGstPercentage: number | '';
  taxable: boolean;
  affectTotal: boolean;
  inheritGstFromParent: boolean;
  description: string;
  isActive: boolean;
  displayOrder: number;
}

export const createEmptyParent = (defaultGst: number): ParentProductDraft => ({
  name: '',
  defaultRate: '',
  defaultGstPercentage: defaultGst,
  taxable: true,
  affectTotal: true,
  description: '',
  isActive: true,
});

export const createEmptySub = (displayOrder: number, parentGst: number): SubProductDraft => ({
  clientKey: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  defaultRate: 0,
  defaultGstPercentage: parentGst,
  taxable: false,
  affectTotal: false,
  inheritGstFromParent: true,
  description: '',
  isActive: true,
  displayOrder,
});
