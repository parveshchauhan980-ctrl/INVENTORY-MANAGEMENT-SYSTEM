import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Bell,
  LogOut,
  Plus,
  AlertTriangle,
  User as UserIcon,
  ShoppingBag,
  ReceiptText,
  Boxes,
  Shield,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NavTab } from './Sidebar';

interface HeaderProps {
  currentTab: NavTab;
  onOpenMobileSidebar: () => void;
  onQuickAction: (action: 'sale' | 'purchase' | 'product') => void;
  lowStockItems: Array<{ id: number; name: string; quantity: number; min_stock: number; sku: string }>;
  onSelectTab: (tab: NavTab) => void;
  onOpenProfile: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onOpenMobileSidebar,
  onQuickAction,
  lowStockItems = [],
  onSelectTab,
  onOpenProfile
}) => {
  const { user, logout, isAdmin } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (userRef.current && !userRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const titles: Record<NavTab, { title: string; subtitle: string }> = {
    dashboard: { title: 'Operational Dashboard', subtitle: 'Real-time overview of inventory, sales, and analytics' },
    products: { title: 'Product Catalog', subtitle: 'Manage SKUs, barcodes, pricing, and stock limits' },
    categories: { title: 'Product Categories', subtitle: 'Organize inventory into taxonomy and track metrics' },
    purchases: { title: 'Purchase Orders', subtitle: 'Supplier orders and automatic stock replenishment' },
    sales: { title: 'Sales & POS Billing', subtitle: 'Invoicing, customer checkout, and automated stock deductions' },
    stock: { title: 'Stock Movement Ledger', subtitle: 'Audit trail of all purchases, sales, and manual adjustments' },
    suppliers: { title: 'Supplier Directory', subtitle: 'Manage procurement partners, contact info, and order logs' },
    customers: { title: 'Customer Records', subtitle: 'Directory of retail & wholesale buyers with purchase history' },
    reports: { title: 'Reports & P&L Analytics', subtitle: 'Financial performance, inventory valuation, and margin calculations' },
    users: { title: 'Staff & Role Permissions', subtitle: 'Manage administrator and staff member access levels' },
    settings: { title: 'System Configuration', subtitle: 'Company profile, GST/Tax rates, and currency parameters' }
  };

  const currentMeta = titles[currentTab] || { title: 'Inventory Management', subtitle: 'System Control' };

  return (
    <header className="sticky top-0 z-30 h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 flex items-center justify-between no-print">
      {/* Left: Mobile Toggle & Page Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div>
          <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
            <span>{currentMeta.title}</span>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
              🔥 Firebase Cloud
            </span>
          </h2>
          <p className="hidden sm:block text-xs text-slate-400 font-normal">{currentMeta.subtitle}</p>
        </div>
      </div>

      {/* Right: Quick actions, notifications, user avatar */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Action Buttons */}
        <div className="hidden md:flex items-center gap-2">
          <button
            type="button"
            onClick={() => onQuickAction('sale')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <ReceiptText className="h-3.5 w-3.5" />
            <span>+ New Sale</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('purchase')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700/80 transition-all cursor-pointer"
          >
            <ShoppingBag className="h-3.5 w-3.5 text-emerald-400" />
            <span>+ Purchase</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('product')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg border border-slate-700/80 transition-all cursor-pointer"
          >
            <Boxes className="h-3.5 w-3.5 text-amber-400" />
            <span>+ Product</span>
          </button>
        </div>

        {/* Notifications Bell */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            aria-label="View notifications"
          >
            <Bell className="h-5 w-5" />
            {lowStockItems.length > 0 && (
              <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-rose-500 animate-pulse border-2 border-slate-900" />
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Inventory Alerts ({lowStockItems.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifications(false);
                    onSelectTab('products');
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  View All Products
                </button>
              </div>

              <div className="mt-3 max-h-64 overflow-y-auto space-y-2">
                {lowStockItems.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    All inventory levels are optimal. No low-stock items detected!
                  </p>
                ) : (
                  lowStockItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <p className="text-xs font-semibold text-white truncate">{item.name}</p>
                        <p className="text-[11px] text-slate-400 font-mono">SKU: {item.sku}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          item.quantity === 0
                            ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}>
                          {item.quantity === 0 ? 'Out of stock' : `${item.quantity} left (min ${item.min_stock})`}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Menu Dropdown */}
        <div className="relative" ref={userRef}>
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-xs uppercase shadow-sm shadow-indigo-600/30">
              {user?.name ? user.name.slice(0, 2) : 'US'}
            </div>
            <div className="hidden xl:block text-left text-xs">
              <p className="font-semibold text-white leading-tight">{user?.name}</p>
              <p className="text-slate-400 capitalize">{user?.role}</p>
            </div>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 z-50">
              <div className="px-3 py-2 border-b border-slate-800 mb-1">
                <p className="text-xs font-bold text-white truncate">{user?.name}</p>
                <p className="text-[11px] text-slate-400 font-mono truncate">{user?.email}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Shield className="h-3 w-3 text-indigo-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                    {user?.role === 'admin' ? 'Administrator' : 'Staff Member'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  onOpenProfile();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <UserIcon className="h-4 w-4 text-slate-400" />
                <span>My Profile & Password</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setShowUserMenu(false);
                    onSelectTab('settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <ExternalLink className="h-4 w-4 text-slate-400" />
                  <span>System Configuration</span>
                </button>
              )}

              <div className="my-1 border-t border-slate-800" />

              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false);
                  logout();
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
              >
                <LogOut className="h-4 w-4 text-rose-400" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
