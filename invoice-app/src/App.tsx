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
import { Navigation } from './components/Navigation';
import { ThemeProvider } from './contexts/ThemeContext';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import type { UserProfile } from './types';
import { api } from './services/agent';
import { SimpleIdleWarning } from './components/SimpleIdleWarning';

// Main App component
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    checkInitialAuth();
  }, []);

  const checkInitialAuth = () => {
    const token = localStorage.getItem('authToken');
    setIsAuthenticated(!!token);
    setLoading(false);
  };

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    loadUserProfile();
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUserProfile(null);
  };

  const loadUserProfile = async () => {
    try {
      const response = await api.user.getProfile();
      setUserProfile(response.data);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('❌ Failed to load user profile:', error);
      }
    }
  };

  const handleProfileUpdate = (profile: UserProfile) => {
    setUserProfile(profile);
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
          <Router>
            <AppContent onLogout={handleLogout} onProfileUpdate={handleProfileUpdate} />
          </Router>
        )}
      </SidebarProvider>
    </ThemeProvider>
  );
}

function AppContent({ onLogout, onProfileUpdate }: { onLogout: () => void; onProfileUpdate: (profile: UserProfile) => void }) {
  const { isCollapsed } = useSidebar();

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation onLogout={onLogout} onProfileUpdate={onProfileUpdate} />
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
          <Route path="/users" element={<UserManagementPage />} />
          <Route path="/audit-logs" element={<AuditLogPage />} />
          <Route path="/backup" element={<BackupPage />} />
          <Route path="/error-logs" element={<ErrorLogPage />} />
          <Route path="/recurring-invoices" element={<RecurringInvoicesPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;