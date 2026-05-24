import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Users, LogOut, Settings, UserCog, ChevronDown, User as UserIcon,
  History, Database, AlertTriangle, Menu, X, ChevronLeft, ChevronRight, Repeat, Package,
  Search,
} from 'lucide-react';
import { UserProfileModal } from './UserProfileModal';
import { ThemeSelector } from './ThemeSelector';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/cn';
import type { UserProfile } from '../types';

interface NavigationProps {
  onLogout: () => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  group?: string;
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
  const userEmail = profile?.email || '';
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    };
    if (showUserDropdown) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showUserDropdown]);

  const handleProfileUpdate = (updated: UserProfile) => {
    setProfile(updated);
    setShowProfileModal(false);
    navigate('/dashboard');
  };

  const mainNav: NavItem[] = [
    { name: 'Dashboard',        href: '/dashboard',        icon: LayoutDashboard, group: 'Main' },
    ...(userRole !== 'MasterUser' ? [{ name: 'Create Invoice',     href: '/invoices',          icon: FileText, group: 'Main' }] : []),
    { name: 'Customers',        href: '/customers',        icon: Users, group: 'Main' },
    ...(userRole !== 'MasterUser' ? [{ name: 'Products',           href: '/products',          icon: Package, group: 'Main' }] : []),
    ...(userRole !== 'MasterUser' ? [{ name: 'Recurring Invoices', href: '/recurring-invoices', icon: Repeat, group: 'Main' }] : []),
  ];

  const adminNav: NavItem[] = [
    ...(userRole === 'MasterUser' || userRole === 'Admin' ? [{ name: 'User Management', href: '/users',  icon: UserCog, group: 'Admin' }] : []),
    ...(userRole === 'MasterUser' || userRole === 'Admin' ? [{ name: 'Backup & Restore', href: '/backup', icon: Database, group: 'Admin' }] : []),
    ...(userRole === 'MasterUser' ? [{ name: 'Error Logs', href: '/error-logs', icon: AlertTriangle, group: 'Admin' }] : []),
    ...(userRole !== 'MasterUser' ? [{ name: 'Invoice Layouts', href: '/invoice-layouts', icon: Settings, group: 'Admin' }] : []),
  ];

  const handleNavigation = (href: string) => {
    navigate(href);
    setIsMobileMenuOpen(false);
  };

  const handleLogout = () => {
    onLogout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const initials = (userName || 'U').split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <button
        key={item.name}
        onClick={() => handleNavigation(item.href)}
        className={cn(
          'group w-full flex items-center rounded-lg text-sm font-medium transition-all duration-150 relative',
          isCollapsed ? 'justify-center px-2 py-2.5' : 'px-3 py-2.5',
          active
            ? 'bg-[var(--primary-soft)] text-[var(--primary)] shadow-[inset_2px_0_0_0_var(--primary)]'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        )}
        title={isCollapsed ? item.name : undefined}
      >
        <Icon className={cn('h-[18px] w-[18px] flex-shrink-0', !isCollapsed && 'mr-3')} />
        {!isCollapsed && <span className="truncate">{item.name}</span>}
      </button>
    );
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">IM</div>
            <h1 className="text-base font-semibold text-slate-900 truncate max-w-[180px]">
              {businessName || 'Invoice Master'}
            </h1>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 -mr-2 text-slate-700 hover:bg-slate-100 rounded-lg"
            aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 h-full bg-white border-r border-slate-200 transition-all duration-300 z-40 flex flex-col',
          isCollapsed ? 'w-[72px]' : 'w-[260px]',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand / Header */}
        <div className={cn('relative flex items-center border-b border-slate-200 h-16 shrink-0 overflow-visible', isCollapsed ? 'justify-center px-2' : 'justify-between px-4')}>
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
                IM
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate leading-tight">
                  {businessName || 'Invoice Master'}
                </div>
                <div className="text-[11px] text-slate-500 leading-tight">Billing & Finance</div>
              </div>
            </div>
          ) : (
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
              IM
            </div>
          )}

          <button
            onClick={toggleCollapse}
            className={cn(
              'hidden lg:flex text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors items-center justify-center',
              isCollapsed
                ? 'absolute right-0 top-1/2 z-50 h-5 w-5 -translate-y-1/2 translate-x-1/2 rounded-full bg-white border border-slate-200 shadow-sm p-0'
                : 'p-1.5 rounded-md'
            )}
            title={isCollapsed ? 'Expand' : 'Collapse'}
            aria-label={isCollapsed ? 'Expand menu' : 'Collapse menu'}
          >
            {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-md transition-colors lg:hidden flex items-center justify-center"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search (only when expanded) */}
        {!isCollapsed && (
          <div className="px-3 pt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Quick search…"
                className="w-full h-9 pl-8 pr-2 text-sm bg-slate-100 border border-transparent rounded-lg text-slate-700 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-slate-200 focus:ring-2 focus:ring-indigo-100 transition"
              />
              <kbd className="hidden sm:inline-flex absolute right-2 top-1/2 -translate-y-1/2 items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-200 rounded">⌘K</kbd>
            </div>
          </div>
        )}

        {/* Nav items */}
        <nav className={cn(
          'flex-1 min-h-0 py-3',
          isCollapsed ? 'overflow-hidden px-2' : 'overflow-y-auto overflow-x-hidden px-3'
        )}>
          {!isCollapsed && (
            <p className="px-2 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Main</p>
          )}
          <div className="space-y-0.5">
            {mainNav.map(renderNavItem)}
          </div>

          {adminNav.length > 0 && (
            <>
              {!isCollapsed ? (
                <p className="px-2 pt-5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Admin</p>
              ) : (
                <div className="my-3 mx-2 h-px bg-slate-200" />
              )}
              <div className="space-y-0.5">
                {adminNav.map(renderNavItem)}
              </div>
            </>
          )}
        </nav>

        {/* Bottom: theme + user */}
        <div className={cn('border-t border-slate-200 shrink-0', isCollapsed ? 'p-2 space-y-1.5' : 'p-3 space-y-2')}>
          <div className={cn(isCollapsed && 'flex justify-center')}>
            <ThemeSelector isCollapsed={isCollapsed} />
          </div>

          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className={cn(
                'w-full flex items-center rounded-lg text-sm transition-colors',
                isCollapsed ? 'justify-center p-1.5 hover:bg-slate-100' : 'p-2 hover:bg-slate-100'
              )}
              title={isCollapsed ? userName : ''}
            >
              <div className={cn(
                'rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-xs font-semibold shrink-0 shadow-sm',
                isCollapsed ? 'h-8 w-8' : 'h-9 w-9'
              )}>
                {initials || <UserIcon className="h-4 w-4" />}
              </div>
              {!isCollapsed && (
                <>
                  <div className="ml-2.5 flex-1 min-w-0 text-left">
                    <div className="text-sm font-semibold text-slate-900 truncate leading-tight">{userName}</div>
                    <div className="text-[11px] text-slate-500 truncate leading-tight">{userRole}</div>
                  </div>
                  <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', showUserDropdown && 'rotate-180')} />
                </>
              )}
            </button>

            {showUserDropdown && (
              <div className={cn(
                'absolute bottom-full mb-2 w-60 bg-white rounded-xl shadow-xl border border-slate-200 z-50 overflow-hidden animate-scale-in',
                isCollapsed ? 'left-full ml-2' : 'left-0 right-0'
              )}>
                <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                  <p className="text-sm font-semibold text-slate-900 truncate">{userName}</p>
                  <p className="text-xs text-slate-500 truncate">{userEmail}</p>
                  <span className="ui-badge-info mt-1.5">{userRole}</span>
                </div>
                <div className="py-1">
                  <button
                    onClick={() => { setShowProfileModal(true); setShowUserDropdown(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <Settings className="h-4 w-4 text-slate-500" /> Profile settings
                  </button>
                  {userRole === 'Admin' && (
                    <button
                      onClick={() => { navigate('/audit-logs'); setShowUserDropdown(false); setIsMobileMenuOpen(false); }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <History className="h-4 w-4 text-slate-500" /> Audit logs
                    </button>
                  )}
                </div>
                <div className="py-1 border-t border-slate-100">
                  <button
                    onClick={() => { handleLogout(); setShowUserDropdown(false); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" /> Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <UserProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onProfileUpdate={handleProfileUpdate}
      />
    </>
  );
};
