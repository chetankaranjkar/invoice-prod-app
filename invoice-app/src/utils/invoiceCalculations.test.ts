import { describe, it, expect } from 'vitest';
import {
  calculateInvoiceTotals,
  calculateLineAmounts,
  buildInvoiceHierarchy,
  flattenHierarchyForRender,
  productToInvoiceLine,
} from './invoiceCalculations';

describe('invoiceCalculations', () => {
  it('excludes sub-lines from totals when affectTotal is false', () => {
    const items = [
      {
        lineKey: 'p1',
        productName: 'Application Cost',
        quantity: 1,
        rate: 100000,
        gstPercentage: 18,
        affectTotal: true,
        taxable: true,
        hierarchyLevel: 0,
      },
      {
        lineKey: 's1',
        parentLineKey: 'p1',
        productName: 'API',
        quantity: 1,
        rate: 0.1,
        gstPercentage: 18,
        affectTotal: false,
        taxable: false,
        hierarchyLevel: 1,
      },
    ];
    const totals = calculateInvoiceTotals(items);
    expect(totals.totalAmount).toBe(100000);
    expect(totals.gstAmount).toBe(18000);
    expect(totals.grandTotal).toBe(118000);

    const rows = flattenHierarchyForRender(items, { showSubItems: true, hideZeroCostSubs: false });
    expect(rows).toHaveLength(2);
    expect(rows[0].serialNumber).toBe(1);
    expect(rows[1].isSub).toBe(true);
    expect(rows[1].serialNumber).toBeNull();
  });

  it('calculateLineAmounts skips GST when not taxable', () => {
    const line = calculateLineAmounts(1, 100, 18, false, false);
    expect(line.gstAmount).toBe(0);
    expect(line.amount).toBe(100);
  });

  it('buildInvoiceHierarchy nests children under parent', () => {
    const tree = buildInvoiceHierarchy([
      { lineKey: 'p', productName: 'Parent', hierarchyLevel: 0 },
      { lineKey: 'c', parentLineKey: 'p', productName: 'Child', hierarchyLevel: 1 },
    ]);
    expect(tree).toHaveLength(1);
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children![0].productName).toBe('Child');
  });

  it('productToInvoiceLine uses profile 0% GST instead of product catalog GST', () => {
    const line = productToInvoiceLine(
      { id: 1, name: 'Sugar', defaultGstPercentage: 18, defaultRate: 100 },
      undefined,
      undefined,
      0
    );
    expect(line.gstPercentage).toBe(0);
  });

  it('productToInvoiceLine still uses product GST when profile default is not 0', () => {
    const line = productToInvoiceLine(
      { id: 1, name: 'Sugar', defaultGstPercentage: 5, defaultRate: 100 },
      undefined,
      undefined,
      18
    );
    expect(line.gstPercentage).toBe(5);
  });
});
