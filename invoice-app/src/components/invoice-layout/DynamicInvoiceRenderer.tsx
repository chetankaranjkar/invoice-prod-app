import React, { useEffect, useMemo, useState, useRef } from 'react';
import type { CompanyInfo, Customer, InvoiceItem, InvoiceLayoutConfig, InvoiceLayoutSectionConfig, Payment } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { HeaderSection } from './sections/HeaderSection';
import { SellerInfoSection } from './sections/SellerInfoSection';
import { BuyerInfoSection } from './sections/BuyerInfoSection';
import { ItemsTableSection } from './sections/ItemsTableSection';
import { TotalsSection } from './sections/TotalsSection';
import { FooterSection } from './sections/FooterSection';
import { StaticTextSection } from './sections/StaticTextSection';

interface DynamicInvoiceRendererProps {
  layout: InvoiceLayoutConfig;
  customer: Customer | null;
  items: InvoiceItem[];
  invoiceDate: string;
  invoiceNumber: string;
  paymentStatus?: string;
  initialPayment?: number;
  waveAmount?: number;
  payments?: Payment[];
  /** When viewing another user's invoice (e.g. admin views user's invoice), pass the invoice creator's company info */
  companyInfo?: CompanyInfo | null;
  /** When true, never fall back to logged-in user's profile - use only companyInfo */
  forceUseCompanyInfo?: boolean;
  enableDrag?: boolean;
  onSectionReorder?: (sourceId: string, targetId: string) => void;
  enableFreePosition?: boolean;
  onSectionPositionChange?: (sectionId: string, position: InvoiceLayoutSectionConfig['position'], order: number) => void;
  onSectionSizeChange?: (sectionId: string, size: { width: number; height: number; containerWidth: number }) => void;
}

interface TotalsSummary {
  totalAmount: number;
  totalGST: number;
  grandTotal: number;
  totalPaid: number;
  totalWave: number;
  balanceAmount: number;
}

interface SectionRenderProps {
  company: CompanyInfo | null;
  customer: Customer | null;
  items: InvoiceItem[];
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentStatus?: string;
  totals: TotalsSummary;
  section?: InvoiceLayoutSectionConfig;
}

const SECTION_COMPONENTS: Record<string, React.FC<SectionRenderProps>> = {
  Header: HeaderSection,
  SellerInfo: SellerInfoSection,
  BuyerInfo: BuyerInfoSection,
  ItemsTable: ItemsTableSection,
  Totals: TotalsSection,
  Footer: FooterSection,
  StaticText: StaticTextSection,
};

const normalizeLogoUrl = (logoUrl?: string | null): string | null => {
  if (!logoUrl || logoUrl.trim() === '') return null;

  let finalUrl = logoUrl.trim();
  if (finalUrl.includes('https://localhost:7001')) {
    finalUrl = finalUrl.replace('https://localhost:7001', 'http://localhost:5001');
  }
  if (finalUrl.includes('https://localhost')) {
    finalUrl = finalUrl.replace('https://localhost', 'http://localhost:5001');
  }

  if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://') && !finalUrl.startsWith('data:') && !finalUrl.startsWith('blob:')) {
    const apiBaseUrl = import.meta.env.VITE_API_URL || '';
    const isDockerMode = apiBaseUrl.startsWith('/');

    if (finalUrl.startsWith('/uploads/')) {
      finalUrl = `http://localhost:5001${finalUrl}`;
    } else if (finalUrl.startsWith('/')) {
      const baseUrl = apiBaseUrl || (import.meta.env.DEV ? 'http://localhost:5001' : '');
      const finalBase = isDockerMode ? 'http://localhost:5001' : baseUrl;
      finalUrl = `${finalBase.replace(/\/$/, '')}${finalUrl}`;
    } else {
      const baseUrl = apiBaseUrl || (import.meta.env.DEV ? 'http://localhost:5001' : '');
      const finalBase = isDockerMode ? 'http://localhost:5001' : baseUrl;
      finalUrl = `${finalBase.replace(/\/?$/, '/')}${finalUrl}`;
    }
  }

  return finalUrl;
};

const computeTotals = (items: InvoiceItem[], initialPayment = 0, waveAmount = 0): TotalsSummary => {
  const totals = items.reduce(
    (acc, item) => {
      const quantity = Number(item.quantity) || 0;
      const rate = Number(item.rate) || 0;
      const amount = Number(item.amount) || (quantity * rate);
      const gstPercentage = Number(item.gstPercentage) || 0;
      const gstAmount = Number(item.gstAmount) || (amount * gstPercentage / 100);
      return {
        totalAmount: acc.totalAmount + amount,
        totalGST: acc.totalGST + gstAmount,
        grandTotal: acc.grandTotal + (amount + gstAmount),
      };
    },
    { totalAmount: 0, totalGST: 0, grandTotal: 0 }
  );

  const totalPaid = Number(initialPayment) || 0;
  const totalWave = Number(waveAmount) || 0;
  const balanceAmount = Math.max(0, totals.grandTotal - totalPaid - totalWave);

  return {
    totalAmount: totals.totalAmount,
    totalGST: totals.totalGST,
    grandTotal: totals.grandTotal,
    totalPaid,
    totalWave,
    balanceAmount,
  };
};

const getColumnSpan = (width: number, columns: number) => {
  const span = Math.round((width / 100) * columns);
  return Math.max(1, Math.min(columns, span));
};

const getGridPlacement = (section: InvoiceLayoutSectionConfig, columns: number) => {
  const span = getColumnSpan(section.width, columns);
  let start = 1;
  if (section.position === 'center') {
    start = Math.max(1, Math.floor((columns - span) / 2) + 1);
  } else if (section.position === 'right') {
    start = Math.max(1, columns - span + 1);
  }

  return {
    gridColumn: `${start} / span ${span}`,
    gridRow: section.order,
    justifySelf: section.position === 'left' ? 'start' : section.position === 'right' ? 'end' : 'center',
    textAlign: section.alignment === 'start' ? 'left' : section.alignment === 'end' ? 'right' : 'center',
  } as React.CSSProperties;
};

export const DynamicInvoiceRenderer: React.FC<DynamicInvoiceRendererProps> = ({
  layout,
  customer,
  items,
  invoiceDate: invoiceDateProp,
  invoiceNumber,
  paymentStatus,
  initialPayment = 0,
  waveAmount = 0,
  companyInfo: companyInfoProp,
  forceUseCompanyInfo = false,
  enableDrag = false,
  onSectionReorder,
  enableFreePosition = false,
  onSectionPositionChange,
  onSectionSizeChange,
}) => {
  const { profile } = useAuth();
  const companyInfo = useMemo((): CompanyInfo | null => {
    if (companyInfoProp) return companyInfoProp;
    if (forceUseCompanyInfo) return null;
    if (!profile) return null;
    const logoUrl = normalizeLogoUrl(profile.logoUrl || (profile as { LogoUrl?: string }).LogoUrl);
    const p = profile as { bankAccountNo?: string };
    return {
      name: profile.name,
      email: profile.email,
      businessName: profile.businessName,
      gstNumber: profile.gstNumber,
      address: profile.address,
      bankName: profile.bankName,
      accountNumber: p.bankAccountNo || profile.accountNumber,
      ifscCode: profile.ifscCode,
      panNumber: profile.panNumber,
      membershipNo: profile.membershipNo,
      gstpNumber: profile.gstpNumber,
      City: profile.city ?? profile.City,
      State: profile.state ?? profile.State,
      Zip: profile.zip ?? profile.Zip,
      phone: profile.phone ?? undefined,
      logoUrl: logoUrl ?? undefined,
      taxPractitionerTitle: profile.taxPractitionerTitle ?? undefined,
      headerLogoBgColor: profile.headerLogoBgColor,
      addressSectionBgColor: profile.addressSectionBgColor,
      headerLogoTextColor: profile.headerLogoTextColor,
      addressSectionTextColor: profile.addressSectionTextColor,
      gpayNumber: profile.gpayNumber,
    };
  }, [profile, companyInfoProp, forceUseCompanyInfo]);
  const [isResizing, setIsResizing] = useState(false);
  const invoiceDate = invoiceDateProp || new Date().toISOString().split('T')[0];
  const containerRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const resizeStateRef = useRef<{
    id: string;
    startX: number;
    startWidth: number;
    direction: 'left' | 'right';
  } | null>(null);

  const totals = useMemo(() => computeTotals(items, initialPayment, waveAmount), [items, initialPayment, waveAmount]);
  const columns = layout?.grid?.columns || 12;
  const gap = layout?.grid?.gap || '8px';

  const sortedSections = useMemo(() => {
    const sections = Array.isArray(layout?.sections) ? layout.sections : [];
    return [...sections].filter(s => s.visible !== false).sort((a, b) => a.order - b.order);
  }, [layout]);

  const sectionProps: SectionRenderProps = {
    company: companyInfo,
    customer,
    items,
    invoiceNumber,
    invoiceDate,
    dueDate: '', // Disabled - using invoice date only
    paymentStatus,
    totals,
  };

  const handleDragStart = (id: string, event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('text/plain', id);
  };

  const handleDrop = (targetId: string, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) return;
    onSectionReorder?.(sourceId, targetId);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleFreeDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!enableFreePosition) return;
    const sourceId = event.dataTransfer.getData('text/plain');
    if (!sourceId || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const relativeY = event.clientY - rect.top;
    const xRatio = Math.max(0, Math.min(1, relativeX / rect.width));

    const position: InvoiceLayoutSectionConfig['position'] =
      xRatio < 0.33 ? 'left' : xRatio > 0.66 ? 'right' : 'center';

    const rowHeight = 120;
    const order = Math.max(1, Math.round(relativeY / rowHeight) + 1);
    onSectionPositionChange?.(sourceId, position, order);
  };

  useEffect(() => {
    if (!enableFreePosition) return;

    const handleMouseMove = (event: MouseEvent) => {
      if (!resizeStateRef.current || !containerRef.current) return;
      const { id, startX, startWidth, direction } = resizeStateRef.current;
      const deltaX = event.clientX - startX;
      const newWidthPx = direction === 'right' ? startWidth + deltaX : startWidth - deltaX;
      const sectionEl = sectionRefs.current[id];
      if (!sectionEl) return;

      const containerWidth = containerRef.current.offsetWidth || newWidthPx;
      onSectionSizeChange?.(id, {
        width: Math.max(80, newWidthPx),
        height: sectionEl.offsetHeight,
        containerWidth,
      });
    };

    const handleMouseUp = () => {
      resizeStateRef.current = null;
      setIsResizing(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [enableFreePosition, onSectionSizeChange]);

  const startResize = (id: string, direction: 'left' | 'right', event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const sectionEl = sectionRefs.current[id];
    if (!sectionEl) return;
    setIsResizing(true);
    resizeStateRef.current = {
      id,
      startX: event.clientX,
      startWidth: sectionEl.offsetWidth,
      direction,
    };
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 md:p-8">
      <div
        ref={containerRef}
        className="w-full"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap,
        }}
        onDragOver={enableFreePosition ? handleDragOver : undefined}
        onDrop={enableFreePosition ? handleFreeDrop : undefined}
      >
        {sortedSections.map((section) => {
          const SectionComponent = SECTION_COMPONENTS[section.type];
          if (!SectionComponent) return null;

          const placement = getGridPlacement(section, columns);
          const baseStyle: React.CSSProperties = {
            ...placement,
            padding: section.styles?.padding,
            margin: section.styles?.margin,
            height: section.styles?.height,
            minHeight: section.styles?.minHeight,
          };
          const wrapperStyle: React.CSSProperties = enableFreePosition
            ? { ...baseStyle, resize: 'vertical', overflow: 'auto', position: 'relative' }
            : baseStyle;

          return (
            <div
              key={section.id}
              ref={(el) => {
                sectionRefs.current[section.id] = el;
              }}
              style={wrapperStyle}
              draggable={enableDrag && !isResizing}
              onDragStart={enableDrag ? (event) => handleDragStart(section.id, event) : undefined}
              onDrop={enableDrag && !enableFreePosition ? (event) => handleDrop(section.id, event) : undefined}
              onDragOver={enableDrag && !enableFreePosition ? handleDragOver : undefined}
              onMouseUp={
                enableFreePosition
                  ? (event) => {
                      const target = event.currentTarget;
                      const containerWidth = containerRef.current?.offsetWidth || target.offsetWidth;
                      onSectionSizeChange?.(section.id, {
                        width: target.offsetWidth,
                        height: target.offsetHeight,
                        containerWidth,
                      });
                    }
                  : undefined
              }
              className={
                enableDrag
                  ? 'cursor-move border border-dashed border-gray-200 rounded-md p-2'
                  : undefined
              }
            >
              {enableFreePosition && (
                <>
                  <div
                    onMouseDown={(event) => startResize(section.id, 'left', event)}
                    className="absolute left-0 top-0 h-full w-2 cursor-ew-resize bg-gray-200/70 hover:bg-gray-300/90"
                  />
                  <div
                    onMouseDown={(event) => startResize(section.id, 'right', event)}
                    className="absolute right-0 top-0 h-full w-2 cursor-ew-resize bg-gray-200/70 hover:bg-gray-300/90"
                  />
                </>
              )}
              <SectionComponent {...sectionProps} section={section} />
            </div>
          );
        })}
      </div>
    </div>
  );
};
