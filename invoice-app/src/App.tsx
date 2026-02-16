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
import { InvoiceLayoutDesignerPage } from './pages/InvoiceLayoutDesignerPage';
import { Navigation } from './components/Navigation';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import { AuthProvider } from './contexts/AuthContext';
import { SimpleIdleWarning } from './components/SimpleIdleWarning';

// Main App component
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
          <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600"></div>
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
    <div className="min-h-screen bg-gray-50">
      <Navigation onLogout={onLogout} />
      <main 
        className="transition-all duration-300 pt-16 lg:pt-0 min-h-screen p-3 sm:p-4 lg:p-6"
        style={{ marginRight: isCollapsed ? '64px' : '256px' }}
      >
        <SimpleIdleWarning />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/invoices" element={<InvoiceCreationPage />} />
          <Route path="/invoices/edit/:id" element={<EditInvoicePage />} />
          {/* MasterUser will be redirected or see access denied message in InvoiceCreationPage */}
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/paid" element={<CustomersPage filter="paid" />} />
          <Route path="/customers/unpaid" element={<CustomersPage filter="unpaid" />} />
          <Route path="/customers/:customerId" element={<CustomersPage />} />
          <Route path="/users" element={<UserManagementPage />} />
          <Route path="/audit-logs" element={<AuditLogPage />} />
          <Route path="/backup" element={<BackupPage />} />
          <Route path="/error-logs" element={<ErrorLogPage />} />
          <Route path="/recurring-invoices" element={<RecurringInvoicesPage />} />
          <Route path="/invoice-layouts" element={<InvoiceLayoutDesignerPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;