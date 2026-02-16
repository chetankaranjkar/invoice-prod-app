# Invoice App - Frontend Architecture Review

## Overview

The frontend is a React 19 + TypeScript + Vite application using Tailwind CSS. It follows a reasonable structure for a medium-sized invoice management app.

---

## Project Structure

```
src/
├── components/       # Reusable UI components
│   ├── invoice-layout/   # Dynamic layout sections
│   └── static-invoice/   # Static invoice templates
├── contexts/         # React contexts (Theme, Sidebar)
├── hooks/            # Custom hooks (useIdleTimeout, useUserProfile)
├── pages/            # Route-level components
├── services/         # API layer (agent.ts)
├── types/            # TypeScript interfaces
└── utils/            # Helpers, validation
```

**Strengths:**
- Clear separation of concerns
- Logical grouping (invoice vs static vs layout)
- Contexts for global state (theme, sidebar)

---

## Architecture Strengths

### 1. **Centralized API Layer** (`services/agent.ts`)
- Axios instance with base URL and timeout
- Request interceptor: adds auth token, handles FormData
- Response interceptor: 401 handling, idle timeout reset
- Clean API object: `api.user`, `api.invoices`, `api.customers`, etc.

### 2. **Theme System** (`contexts/ThemeContext.tsx`)
- Multiple themes (violet, navy, green)
- Consistent color tokens (primary, danger, success, info)
- Applied across modals, buttons, nav

### 3. **TypeScript Usage**
- Strong typing in `types/index.ts` (DTOs, entities)
- Reduces runtime errors

### 4. **Responsive Design**
- Tailwind breakpoints: `sm`, `md`, `lg`
- Mobile sidebar, collapsible nav

### 5. **Role-Based Access**
- Navigation filtered by role (MasterUser, Admin, User)
- Invoice creation restricted for MasterUser

---

## Areas for Improvement

### 1. **Duplicate `getProfile` Calls**
Many components independently call `api.user.getProfile()`:
- App, Navigation, InvoiceForm, TaxInvoice, DynamicInvoiceRenderer
- InvoiceCreationPage (4x), DashboardPage (2x), etc.

**Recommendation:** Use `useUserProfile` hook or an AuthContext that provides profile + refresh. Added `hooks/useUserProfile.ts` as a starting point.

### 2. **Naming Inconsistency**
- Folder: `BankandCost` (typo: "and" vs "And")
- Consider renaming to `BankAndCost` for consistency

### 3. **Large Components**
- `InvoicePreview.tsx` – very long; consider splitting print logic into a hook
- `InvoiceForm.tsx` – could extract item list, payment section into sub-components
- `CustomersPage.tsx` – large; consider extracting table, filters

### 4. **API Response Typing**
- `agent.get<any>()` – responses are untyped
- Add proper return types: `agent.get<UserProfile>('User/profile')`

### 5. **Barrel Exports**
- No `index.ts` in `components/` for cleaner imports
- Current: `import { InvoiceForm } from '../components/InvoiceForm'`
- Could add: `components/index.ts` re-exporting common components

### 6. **Error Handling**
- Many `catch` blocks only `console.error`
- Consider a global error boundary + toast/notification system

---

## UI/UX Notes

- **Theme selector** – allows user preference
- **Sidebar collapse** – saves space
- **Profile modal** – tabbed layout for many fields
- **Invoice preview** – supports both static and dynamic layouts
- **Print styles** – `@media print` in index.css for invoice export

---

## Recommendations Summary

| Priority | Item | Effort |
|----------|------|--------|
| High | Use `useUserProfile` where profile is needed multiple times | Low |
| Medium | Add AuthContext to share profile app-wide | Medium |
| Medium | Add proper API response types | Low |
| Low | Rename BankandCost → BankAndCost | Low |
| Low | Extract sub-components from large files | Medium |
| Low | Add barrel exports for components | Low |

---

## Conclusion

The frontend is **well-structured** for its size. The main technical debt is **duplicate profile fetching** and **some large components**. The architecture is maintainable; applying the `useUserProfile` hook and an AuthContext would improve it further.
