import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, LogOut, Settings } from 'lucide-react';
import { UserProfileModal } from './UserProfileModal';
import type { UserProfile } from '../types';

interface NavigationProps {
  onLogout: () => void;
  onProfileUpdate: (profile: UserProfile) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ onLogout, onProfileUpdate }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showProfileModal, setShowProfileModal] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Create Invoice', href: '/invoices', icon: FileText },
    { name: 'Customers', href: '/customers', icon: Users },
  ];

  const handleNavigation = (href: string) => {
    console.log('🧭 Navigating to:', href);
    console.log('🔐 Current token:', localStorage.getItem('authToken'));
    navigate(href);
  };

  const handleLogout = () => {
    console.log('🚪 Navigation logout triggered');
    onLogout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                LeapNext Invoice Generator
              </h1>
            </div>

            <div className="flex items-center space-x-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.name}
                    onClick={() => handleNavigation(item.href)}
                    className={`flex items-center px-4 py-2 rounded-md text-sm font-medium transition-colors ${isActive(item.href)
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                      }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.name}
                  </button>
                );
              })}

              {/* Profile Settings Button */}
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md text-sm font-medium transition-colors"
              >
                <Settings className="h-4 w-4 mr-2" />
                Profile
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md text-sm font-medium transition-colors"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfileUpdate={onProfileUpdate}
      />
    </>
  );
};