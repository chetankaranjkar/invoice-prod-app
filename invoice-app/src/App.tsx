import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InvoiceCreationPage } from './pages/InvoiceCreationPage';
import { EditInvoicePage } from './pages/EditInvoicePage';
import { CustomersPage } from './pages/CustomersPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { BackupPage } from './pages/BackupPage';
import { ErrorLogPage } from './pages/ErrorLogPage';
import { RecurringInvoicesPage } from './pages/RecurringInvoicesPage';
import { ProductsPage } from './pages/ProductsPage';
import { InvoiceLayoutDesignerPage } from './pages/InvoiceLayoutDesignerPage';
import { Navigation } from './components/Navigation';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import { AuthProvider } from './contexts/AuthContext';
import { SimpleIdleWarning } from './components/SimpleIdleWarning';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setIsAuthenticated(!!localStorage.getItem('authToken'));
    setLoading(false);
  }, []);

  const handleLoginSuccess = () => setIsAuthenticated(true);
  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
  };

  return (
    <ThemeProvider>
      <SidebarProvider>
        {loading ? (
          <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="flex flex-col items-center gap-3">
              <div className="h-10 w-10 rounded-full border-[3px] border-slate-200 border-t-indigo-500 animate-spin" />
              <p className="text-sm text-slate-500">Loading…</p>
            </div>
          </div>
        ) : !isAuthenticated ? (
          <LoginPage onLoginSuccess={handleLoginSuccess} />
        ) : (
          <AuthProvider>
            <Router>
              <AppContent onLogout={handleLogout} />
            </Router>
          </AuthProvider>
        )}
      </SidebarProvider>
    </ThemeProvider>
  );
}

function AppContent({ onLogout }: { onLogout: () => void }) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navigation onLogout={onLogout} />
      <main
        className={
          'transition-[margin] duration-300 pt-14 lg:pt-0 min-h-screen ' +
          (isCollapsed ? 'lg:ml-[72px]' : 'lg:ml-[260px]')
        }
      >
        <SimpleIdleWarning />
        <div className="px-3 sm:px-5 lg:px-8 py-4 sm:py-6">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/invoices" element={<InvoiceCreationPage />} />
            <Route path="/invoices/edit/:id" element={<EditInvoicePage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/customers/paid" element={<CustomersPage filter="paid" />} />
            <Route path="/customers/unpaid" element={<CustomersPage filter="unpaid" />} />
            <Route path="/customers/:customerId" element={<CustomersPage />} />
            <Route path="/users" element={<UserManagementPage />} />
            <Route path="/audit-logs" element={<AuditLogPage />} />
            <Route path="/backup" element={<BackupPage />} />
            <Route path="/error-logs" element={<ErrorLogPage />} />
            <Route path="/recurring-invoices" element={<RecurringInvoicesPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/invoice-layouts" element={<InvoiceLayoutDesignerPage />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default App;
