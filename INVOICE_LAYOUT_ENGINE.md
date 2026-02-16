# Invoice Layout Engine

This document describes the dynamic invoice layout engine and how to configure it without changing code.

## InvoiceLayoutConfig JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "InvoiceLayoutConfig",
  "type": "object",
  "required": ["version", "grid", "sections"],
  "properties": {
    "version": { "type": "string" },
    "grid": {
      "type": "object",
      "required": ["columns"],
      "properties": {
        "columns": { "type": "integer", "minimum": 1, "maximum": 24 },
        "gap": { "type": "string" }
      }
    },
    "sections": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["id", "type", "order", "width", "position", "alignment"],
        "properties": {
          "id": { "type": "string" },
          "type": {
            "type": "string",
            "enum": ["Header", "SellerInfo", "BuyerInfo", "ItemsTable", "Totals", "Footer", "StaticText"]
          },
          "order": { "type": "integer", "minimum": 1 },
          "width": { "type": "number", "minimum": 10, "maximum": 100 },
          "position": { "type": "string", "enum": ["left", "center", "right"] },
          "alignment": { "type": "string", "enum": ["start", "center", "end"] },
          "visible": { "type": "boolean", "default": true },
          "content": { "type": "string" },
          "styles": {
            "type": "object",
            "properties": {
              "padding": { "type": "string" },
              "margin": { "type": "string" },
              "height": { "type": "string" },
              "minHeight": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

## Example Layout JSON (Header on Right)

```json
{
  "version": "1.0",
  "grid": { "columns": 12, "gap": "8px" },
  "sections": [
    { "id": "header", "type": "Header", "order": 1, "width": 100, "position": "right", "alignment": "end" },
    { "id": "seller", "type": "SellerInfo", "order": 2, "width": 48, "position": "left", "alignment": "start" },
    { "id": "buyer", "type": "BuyerInfo", "order": 2, "width": 48, "position": "right", "alignment": "start" },
    { "id": "items", "type": "ItemsTable", "order": 3, "width": 100, "position": "left", "alignment": "start" },
    { "id": "totals", "type": "Totals", "order": 4, "width": 40, "position": "right", "alignment": "end" },
    { "id": "footer", "type": "Footer", "order": 5, "width": 100, "position": "left", "alignment": "start" },
    { "id": "note", "type": "StaticText", "order": 6, "width": 100, "position": "left", "alignment": "start", "content": "Thank you for your business." }
  ]
}
```

## React Component Map Pattern

```tsx
const SECTION_COMPONENTS: Record<InvoiceSectionType, React.FC<SectionRenderProps>> = {
  Header: HeaderSection,
  SellerInfo: SellerInfoSection,
  BuyerInfo: BuyerInfoSection,
  ItemsTable: ItemsTableSection,
  Totals: TotalsSection,
  Footer: FooterSection,
};
```

## Dynamic Renderer (CSS Grid)

```tsx
<div
  style={{
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap,
  }}
>
  {sortedSections.map((section) => {
    const SectionComponent = SECTION_COMPONENTS[section.type];
    return (
      <div key={section.id} style={getGridPlacement(section, columns)}>
        <SectionComponent {...sectionProps} />
      </div>
    );
  })}
</div>
```

## TypeScript Interfaces

```ts
export type InvoiceSectionType = 'Header' | 'SellerInfo' | 'BuyerInfo' | 'ItemsTable' | 'Totals' | 'Footer' | 'StaticText';
export type InvoiceSectionPosition = 'left' | 'center' | 'right';
export type InvoiceSectionAlignment = 'start' | 'center' | 'end';

export interface InvoiceLayoutSectionConfig {
  id: string;
  type: InvoiceSectionType;
  order: number;
  width: number;
  position: InvoiceSectionPosition;
  alignment: InvoiceSectionAlignment;
  visible?: boolean;
  content?: string;
  styles?: { padding?: string; margin?: string };
}

export interface InvoiceLayoutConfig {
  version: string;
  grid: { columns: number; gap?: string };
  sections: InvoiceLayoutSectionConfig[];
}
```

## Sample .NET Core API Endpoint

```csharp
[HttpGet("schema")]
[AllowAnonymous]
public ActionResult GetSchema()
{
    return Ok(new { schema = _schemaProvider.GetSchemaJson() });
}
```

## Change Layout Without Code Changes

1. Open **Invoice Layout Designer**.
2. Drag sections to reorder, change position, width, or alignment.
3. Save the layout and set it as default.
4. In the invoice preview dropdown, select the new layout.

No frontend or backend code changes are required to apply the new layout.
