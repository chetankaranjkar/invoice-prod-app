import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { InvoiceCreationPage } from './pages/InvoiceCreationPage';
import { CustomersPage } from './pages/CustomersPage';
import { Navigation } from './components/Navigation';
import type { UserProfile } from './types';
import { api } from './services/agent';
import { SimpleIdleWarning } from './components/SimpleIdleWarning';

// Main App component
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    checkInitialAuth();
  }, []);

  const checkInitialAuth = () => {
    const token = localStorage.getItem('authToken');
    console.log('🔍 Initial auth check - Token:', token ? 'Present' : 'Missing');
    setIsAuthenticated(!!token);
    setLoading(false);
  };

  const handleLoginSuccess = () => {
    console.log('🎉 Login successful');
    setIsAuthenticated(true);
    loadUserProfile();
  };

  const handleLogout = () => {
    console.log('🚪 Logging out');
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUserProfile(null);
  };

  const loadUserProfile = async () => {
    try {
      const response = await api.user.getProfile();
      setUserProfile(response.data);
      console.log('👤 User profile loaded');
    } catch (error) {
      console.error('❌ Failed to load user profile:', error);
    }
  };

  const handleProfileUpdate = (profile: UserProfile) => {
    setUserProfile(profile);
  };

  // Show loading spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  // Show main app if authenticated
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <Navigation onLogout={handleLogout} onProfileUpdate={handleProfileUpdate} />
        <SimpleIdleWarning />
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/invoices" element={<InvoiceCreationPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/customers/paid" element={<CustomersPage filter="paid" />} />
          <Route path="/customers/unpaid" element={<CustomersPage filter="unpaid" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;