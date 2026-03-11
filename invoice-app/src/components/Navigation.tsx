import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, FileText, Users, LogOut, Settings, UserCog, ChevronDown, User, History, Database, AlertTriangle, Menu, X, ChevronLeft, ChevronRight, Repeat, Package } from 'lucide-react';
import { UserProfileModal } from './UserProfileModal';
import { ThemeSelector } from './ThemeSelector';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';
import type { UserProfile } from '../types';

interface NavigationProps {
  onLogout: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ onLogout }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isCollapsed, toggleCollapse } = useSidebar();
  const { profile, setProfile } = useAuth();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const userRole = profile?.role || 'User';
  const businessName = profile?.businessName || '';
  const userName = profile?.name || profile?.email || 'User';
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };

    if (showUserDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUserDropdown]);

  const handleProfileUpdate = (updated: UserProfile) => {
    setProfile(updated);
    setShowProfileModal(false);
    navigate('/dashboard');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    // MasterUser cannot create invoices - only manage admins
    ...(userRole !== 'MasterUser' ? [{ name: 'Create Invoice', href: '/invoices', icon: FileText }] : []),
    { name: 'Customers', href: '/customers', icon: Users },
    ...(userRole !== 'MasterUser' ? [{ name: 'Products', href: '/products', icon: Package }] : []),
    ...(userRole !== 'MasterUser' ? [{ name: 'Recurring Invoices', href: '/recurring-invoices', icon: Repeat }] : []),
    ...(userRole === 'MasterUser' || userRole === 'Admin' ? [{ name: 'User Management', href: '/users', icon: UserCog }] : []),
    ...(userRole === 'MasterUser' || userRole === 'Admin' ? [{ name: 'Backup & Restore', href: '/backup', icon: Database }] : []),
    ...(userRole === 'MasterUser' ? [{ name: 'Error Logs', href: '/error-logs', icon: AlertTriangle }] : []),
    ...(userRole !== 'MasterUser' ? [{ name: 'Invoice Layouts', href: '/invoice-layouts', icon: Settings }] : []),
  ];

  const handleNavigation = (href: string) => {
    navigate(href);
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm">
        <div className="flex items-center justify-between px-4 h-16">
          <h1 className="text-lg font-semibold text-gray-900 truncate">
            {businessName ? businessName : 'Invoice App'}
          </h1>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-gray-700 hover:bg-gray-100 rounded-md flex items-center justify-center"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed right-0 top-0 h-full bg-white border-l border-gray-200 shadow-lg transition-all duration-300 z-40 ${isCollapsed ? 'w-16' : 'w-64'
          } ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 h-16">
            {!isCollapsed && (
              <h1 className="text-lg font-semibold text-gray-900 truncate flex-1">
                {businessName ? businessName : 'Invoice App'}
              </h1>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleCollapse}
                className="hidden lg:flex p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors items-center justify-center"
                title={isCollapsed ? 'Expand' : 'Collapse'}
                aria-label={isCollapsed ? 'Expand menu' : 'Collapse menu'}
              >
                {isCollapsed ? (
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                )}
              </button>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-md transition-colors lg:hidden flex items-center justify-center"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 overflow-y-auto py-4">
            <div className="space-y-1 px-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      handleNavigation(item.href);
                      setIsMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${active
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-700 hover:bg-gray-100'
                      } ${isCollapsed ? 'justify-center' : ''}`}
                    title={isCollapsed ? item.name : ''}
                  >
                    <Icon
                      className={`h-5 w-5 flex-shrink-0 ${isCollapsed ? '' : 'mr-3'}`}
                      style={{ color: '#1f2937', stroke: 'currentColor', fill: 'none' }}
                    />
                    {!isCollapsed && <span>{item.name}</span>}
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Bottom Section */}
          <div className="border-t border-gray-200 p-4 space-y-2">
            {/* Theme Selector */}
            <div className={isCollapsed ? 'flex justify-center' : ''}>
              <ThemeSelector isCollapsed={isCollapsed} />
            </div>

            {/* User Section */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className={`w-full flex items-center px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors ${isCollapsed ? 'justify-center' : 'justify-between'
                  }`}
                title={isCollapsed ? userName : ''}
              >
                <div className="flex items-center">
                  <User className="h-5 w-5" />
                  {!isCollapsed && (
                    <>
                      <span className="ml-3 truncate max-w-[120px]">{userName}</span>
                      <ChevronDown className={`h-4 w-4 ml-2 transition-transform ${showUserDropdown ? 'rotate-180' : ''}`} />
                    </>
                  )}
                </div>
              </button>

              {/* Dropdown Menu */}
              {showUserDropdown && (
                <div
                  className={`absolute bottom-full right-0 mb-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 ${isCollapsed ? 'right-16' : ''
                    }`}
                >
                  <div className="py-1">
                    {/* User Info */}
                    <div className="px-4 py-2 border-b border-gray-200">
                      <p className="text-sm font-semibold text-gray-900 truncate">{userName}</p>
                      <p className="text-xs text-gray-500 truncate">{userRole}</p>
                    </div>

                    {/* Profile Option */}
                    <button
                      onClick={() => {
                        setShowProfileModal(true);
                        setShowUserDropdown(false);
                      }}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Profile
                    </button>

                    {/* Audit Logs Option (Admin only) */}
                    {userRole === 'Admin' && (
                      <button
                        onClick={() => {
                          navigate('/audit-logs');
                          setShowUserDropdown(false);
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      >
                        <History className="h-4 w-4 mr-2" />
                        Audit Logs
                      </button>
                    )}

                    {/* Logout Option */}
                    <button
                      onClick={() => {
                        handleLogout();
                        setShowUserDropdown(false);
                      }}
                      className="w-full flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Profile Modal */}
      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfileUpdate={handleProfileUpdate}
      />
    </>
  );
};