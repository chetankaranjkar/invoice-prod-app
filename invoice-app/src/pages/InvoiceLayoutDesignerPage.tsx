import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../services/agent';
import type { Customer, InvoiceItem, InvoiceLayoutConfig, InvoiceLayoutConfigDto, InvoiceLayoutSectionConfig } from '../types';
import { DynamicInvoiceRenderer } from '../components/invoice-layout/DynamicInvoiceRenderer';

const SECTION_TYPES: InvoiceLayoutSectionConfig[] = [
  { id: 'header', type: 'Header', order: 1, width: 100, position: 'right', alignment: 'end' },
  { id: 'seller', type: 'SellerInfo', order: 2, width: 48, position: 'left', alignment: 'start' },
  { id: 'buyer', type: 'BuyerInfo', order: 2, width: 48, position: 'right', alignment: 'start' },
  { id: 'items', type: 'ItemsTable', order: 3, width: 100, position: 'left', alignment: 'start' },
  { id: 'totals', type: 'Totals', order: 4, width: 40, position: 'right', alignment: 'end' },
  { id: 'footer', type: 'Footer', order: 5, width: 100, position: 'left', alignment: 'start' },
];

const DEFAULT_LAYOUT: InvoiceLayoutConfig = {
  version: '1.0',
  grid: { columns: 12, gap: '8px' },
  sections: SECTION_TYPES,
};

const SAMPLE_CUSTOMER: Customer = {
  id: 1,
  customerName: 'ABC Corporation',
  gstNumber: '27ABCDE1234F1Z5',
  panNumber: 'ABCDE1234F',
  city: 'Pune',
  state: 'Maharashtra',
  zip: '411017',
  email: 'finance@abccorp.com',
  phone: '9876543210',
  billingAddress: '123 Business Park, Hinjewadi Phase 2',
  totalBalance: 0,
  createdAt: new Date().toISOString(),
};

const SAMPLE_ITEMS: InvoiceItem[] = [
  { id: 1, productName: 'Consulting Services', quantity: 2, rate: 1500, amount: 3000, gstPercentage: 18, gstAmount: 540, cgst: 270, sgst: 270 },
  { id: 2, productName: 'Software License', quantity: 1, rate: 8000, amount: 8000, gstPercentage: 18, gstAmount: 1440, cgst: 720, sgst: 720 },
];

type DesignerTab = 'designer' | 'json' | 'preview';

export const InvoiceLayoutDesignerPage: React.FC = () => {
  const [layouts, setLayouts] = useState<InvoiceLayoutConfigDto[]>([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState<number | 'new'>('new');
  const [layoutName, setLayoutName] = useState('New Layout');
  const [layoutDescription, setLayoutDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [layoutConfig, setLayoutConfig] = useState<InvoiceLayoutConfig>(DEFAULT_LAYOUT);
  const [schemaJson, setSchemaJson] = useState<string>('');
  const [activeTab, setActiveTab] = useState<DesignerTab>('designer');
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);

  useEffect(() => {
    loadLayouts();
    loadSchema();
  }, []);

  const loadLayouts = async () => {
    try {
      const response = await api.invoiceLayouts.getList();
      const data = (response.data || []) as InvoiceLayoutConfigDto[];
      const normalized = data.map((layout) => {
        if (!layout?.config?.sections && layout.configJson) {
          try {
            const parsed = JSON.parse(layout.configJson);
            return { ...layout, config: parsed };
          } catch {
            return layout;
          }
        }
        return layout;
      });

      setLayouts(normalized);
      const defaultLayout = normalized.find((layout: InvoiceLayoutConfigDto) => layout.isDefault);
      if (defaultLayout) {
        applyLayout(defaultLayout);
      }
    } catch (error) {
      console.error('Failed to load invoice layouts:', error);
    }
  };

  const loadSchema = async () => {
    try {
      const response = await api.invoiceLayouts.getSchema();
      setSchemaJson(response.data?.schema || '');
    } catch (error) {
      console.error('Failed to load layout schema:', error);
    }
  };

  const applyLayout = (layout: InvoiceLayoutConfigDto) => {
    setSelectedLayoutId(layout.id);
    setLayoutName(layout.name);
    setLayoutDescription(layout.description || '');
    setIsDefault(layout.isDefault);
    if (layout?.config?.sections) {
      setLayoutConfig(layout.config);
      return;
    }

    if (layout.configJson) {
      try {
        const parsed = JSON.parse(layout.configJson);
        setLayoutConfig(parsed);
        return;
      } catch {
        // fall through to default
      }
    }

    setLayoutConfig(DEFAULT_LAYOUT);
  };

  const handleCreateNew = () => {
    setSelectedLayoutId('new');
    setLayoutName('New Layout');
    setLayoutDescription('');
    setIsDefault(false);
    setLayoutConfig(DEFAULT_LAYOUT);
  };

  const handleSave = async () => {
    if (!layoutConfig || !layoutConfig.sections || layoutConfig.sections.length === 0) {
      alert('Layout config is required.');
      return;
    }

    const safeConfig = JSON.parse(JSON.stringify(layoutConfig));
    const payload = {
      name: layoutName,
      description: layoutDescription || undefined,
      config: safeConfig,
      configJson: JSON.stringify(safeConfig),
      isDefault,
    };

    try {
      if (selectedLayoutId === 'new') {
        await api.invoiceLayouts.create(payload);
      } else {
        await api.invoiceLayouts.update(selectedLayoutId, payload);
      }
      await loadLayouts();
      alert('Layout saved successfully!');
    } catch (error: any) {
      console.error('Failed to save layout:', error);
      alert(error.response?.data?.message || 'Failed to save layout.');
    }
  };

  const handleDelete = async () => {
    if (selectedLayoutId === 'new') return;
    if (!confirm('Are you sure you want to delete this layout?')) return;

    try {
      await api.invoiceLayouts.delete(selectedLayoutId);
      handleCreateNew();
      await loadLayouts();
    } catch (error) {
      console.error('Failed to delete layout:', error);
    }
  };

  const handleSectionChange = (id: string, updates: Partial<InvoiceLayoutSectionConfig>) => {
    setLayoutConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === id ? { ...section, ...updates } : section
      ),
    }));
  };

  const handleAddStaticText = () => {
    setLayoutConfig((prev) => {
      const nextOrder = prev.sections.length + 1;
      const newSection: InvoiceLayoutSectionConfig = {
        id: `text-${Date.now()}`,
        type: 'StaticText',
        order: nextOrder,
        width: 100,
        position: 'left',
        alignment: 'start',
        content: 'Enter your text here',
      };
      return { ...prev, sections: [...prev.sections, newSection] };
    });
  };

  const sortedSections = useMemo(() => {
    const sections = Array.isArray(layoutConfig?.sections) ? layoutConfig.sections : [];
    return [...sections].sort((a, b) => a.order - b.order);
  }, [layoutConfig]);

  const reorderSections = (sourceId: string, targetId: string) => {
    const sectionList = [...sortedSections];
    const sourceIndex = sectionList.findIndex((section) => section.id === sourceId);
    const targetIndex = sectionList.findIndex((section) => section.id === targetId);
    if (sourceIndex < 0 || targetIndex < 0) return;

    const [moved] = sectionList.splice(sourceIndex, 1);
    sectionList.splice(targetIndex, 0, moved);
    const reordered = sectionList.map((section, index) => ({
      ...section,
      order: index + 1,
    }));

    setLayoutConfig((prev) => ({ ...prev, sections: reordered }));
  };

  const handleFreePositionUpdate = (
    sectionId: string,
    position: InvoiceLayoutSectionConfig['position'],
    order: number
  ) => {
    setLayoutConfig((prev) => {
      const updated = prev.sections.map((section) =>
        section.id === sectionId ? { ...section, position, order } : section
      );
      return { ...prev, sections: updated };
    });
  };

  const handleSectionSizeChange = (sectionId: string, size: { width: number; height: number; containerWidth: number }) => {
    const widthPercent = Math.min(100, Math.max(10, (size.width / size.containerWidth) * 100));
    setLayoutConfig((prev) => ({
      ...prev,
      sections: prev.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              width: Math.round(widthPercent),
              styles: {
                ...section.styles,
                height: `${Math.max(40, size.height)}px`,
              },
            }
          : section
      ),
    }));
  };

  const handleDragStart = (id: string) => setDraggedSectionId(id);
  const handleDragOver = (event: React.DragEvent) => event.preventDefault();
  const handleDrop = (id: string) => {
    if (!draggedSectionId || draggedSectionId === id) return;
    reorderSections(draggedSectionId, id);
    setDraggedSectionId(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoice Layout Designer</h1>
            <p className="text-sm text-gray-600">Design invoice formats with drag-and-drop sections.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={handleCreateNew} className="px-3 py-2 text-sm bg-white border rounded-md hover:bg-gray-100">
              New Layout
            </button>
            <button onClick={handleSave} className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700">
              Save Layout
            </button>
            <button onClick={handleDelete} className="px-3 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700">
              Delete
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2 space-y-3">
            <label htmlFor="layout-name" className="block text-sm font-medium text-gray-700">Layout Name</label>
            <input
              id="layout-name"
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              className="w-full border rounded-md p-2 text-sm"
            />
            <label htmlFor="layout-description" className="block text-sm font-medium text-gray-700">Description</label>
            <input
              id="layout-description"
              value={layoutDescription}
              onChange={(e) => setLayoutDescription(e.target.value)}
              className="w-full border rounded-md p-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
              Set as default layout
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Select Existing Layout</label>
            <select
              value={selectedLayoutId}
              onChange={(e) => {
                const value = e.target.value;
                if (value === 'new') {
                  handleCreateNew();
                } else {
                  const layout = layouts.find((item) => item.id === Number(value));
                  if (layout) applyLayout(layout);
                }
              }}
              aria-label="Select existing invoice layout"
              className="w-full border rounded-md p-2 text-sm mt-2"
            >
              <option value="new">Create New</option>
              {layouts.map((layout) => (
                <option key={layout.id} value={layout.id}>
                  {layout.name} {layout.isDefault ? '(Default)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex gap-3 border-b pb-2 mb-4">
            {(['designer', 'json', 'preview'] as DesignerTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`text-sm font-medium px-3 py-1 rounded-md ${activeTab === tab ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {tab === 'designer' ? 'Designer' : tab.toUpperCase()}
              </button>
            ))}
          </div>

          {activeTab === 'designer' && (
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  onClick={handleAddStaticText}
                  className="px-3 py-2 text-xs bg-gray-200 rounded-md hover:bg-gray-300"
                >
                  Add Text Block
                </button>
              </div>
              {sortedSections.map((section) => (
                <div
                  key={section.id}
                  draggable
                  onDragStart={() => handleDragStart(section.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(section.id)}
                  className="border rounded-md p-3 bg-gray-50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold text-sm">{section.type}</div>
                    <div className="text-xs text-gray-500">Order: {section.order}</div>
                  </div>
                  <div className="grid gap-2 md:grid-cols-4">
                    <div>
                      <label className="text-xs text-gray-500">Width (%)</label>
                      <input
                        type="number"
                        min={10}
                        max={100}
                        value={section.width}
                        onChange={(e) => handleSectionChange(section.id, { width: Number(e.target.value) })}
                        aria-label={`Width for ${section.type}`}
                        className="w-full border rounded-md p-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Position</label>
                      <select
                        value={section.position}
                        onChange={(e) => handleSectionChange(section.id, { position: e.target.value as InvoiceLayoutSectionConfig['position'] })}
                        aria-label={`Position for ${section.type}`}
                        className="w-full border rounded-md p-1 text-xs"
                      >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Alignment</label>
                      <select
                        value={section.alignment}
                        onChange={(e) => handleSectionChange(section.id, { alignment: e.target.value as InvoiceLayoutSectionConfig['alignment'] })}
                        aria-label={`Alignment for ${section.type}`}
                        className="w-full border rounded-md p-1 text-xs"
                      >
                        <option value="start">Start</option>
                        <option value="center">Center</option>
                        <option value="end">End</option>
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="text-xs text-gray-500 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={section.visible !== false}
                          onChange={(e) => handleSectionChange(section.id, { visible: e.target.checked })}
                        />
                        Visible
                      </label>
                    </div>
                  </div>
                  <div className="grid gap-2 mt-3 md:grid-cols-3">
                    <div>
                      <label className="text-xs text-gray-500">Height</label>
                      <input
                        value={section.styles?.height || ''}
                        onChange={(e) =>
                          handleSectionChange(section.id, {
                            styles: { ...section.styles, height: e.target.value || undefined },
                          })
                        }
                        placeholder="e.g. 120px or 12mm"
                        aria-label={`Height for ${section.type}`}
                        className="w-full border rounded-md p-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Padding</label>
                      <input
                        value={section.styles?.padding || ''}
                        onChange={(e) =>
                          handleSectionChange(section.id, {
                            styles: { ...section.styles, padding: e.target.value || undefined },
                          })
                        }
                        placeholder="e.g. 8px"
                        aria-label={`Padding for ${section.type}`}
                        className="w-full border rounded-md p-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Margin</label>
                      <input
                        value={section.styles?.margin || ''}
                        onChange={(e) =>
                          handleSectionChange(section.id, {
                            styles: { ...section.styles, margin: e.target.value || undefined },
                          })
                        }
                        placeholder="e.g. 4px"
                        aria-label={`Margin for ${section.type}`}
                        className="w-full border rounded-md p-1 text-xs"
                      />
                    </div>
                  </div>
                  {section.type === 'StaticText' && (
                    <div className="mt-3">
                      <label className="text-xs text-gray-500">Text Content</label>
                      <textarea
                        value={section.content || ''}
                        onChange={(e) => handleSectionChange(section.id, { content: e.target.value })}
                        rows={3}
                        aria-label="Static text content"
                        className="w-full border rounded-md p-2 text-xs"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'json' && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold mb-2">Layout JSON</h3>
                <pre className="text-xs bg-gray-100 p-3 rounded-md overflow-auto max-h-[360px]">
                  {JSON.stringify(layoutConfig, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-2">Schema (from API)</h3>
                <pre className="text-xs bg-gray-100 p-3 rounded-md overflow-auto max-h-[360px]">
                  {schemaJson || 'Schema not loaded.'}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <DynamicInvoiceRenderer
              layout={layoutConfig}
              customer={SAMPLE_CUSTOMER}
              items={SAMPLE_ITEMS}
              dueDate={new Date().toISOString().split('T')[0]}
              invoiceNumber="INV1001"
              paymentStatus="Unpaid"
              initialPayment={0}
              enableDrag={true}
              onSectionReorder={reorderSections}
              enableFreePosition={true}
              onSectionPositionChange={handleFreePositionUpdate}
              onSectionSizeChange={handleSectionSizeChange}
            />
          )}
        </div>
      </div>
    </div>
  );
};
