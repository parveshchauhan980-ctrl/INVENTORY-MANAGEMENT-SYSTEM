/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { Sidebar, NavTab } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { ProductsPage } from './pages/ProductsPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { SalesPage } from './pages/SalesPage';
import { StockLedgerPage } from './pages/StockLedgerPage';
import { SuppliersPage } from './pages/SuppliersPage';
import { CustomersPage } from './pages/CustomersPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersPage } from './pages/UsersPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfileModal } from './components/modals/ProfileModal';
import { api } from './api/client';
import { RefreshCw, PackageCheck } from 'lucide-react';

function MainApp() {
  const { user, isLoading, isAdmin } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  // Global inventory alerts state
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('₹');

  // Quick action modal triggers
  const [quickCreateType, setQuickCreateType] = useState<'sale' | 'purchase' | 'product' | null>(null);

  const fetchGlobalStats = async () => {
    if (!user) return;
    try {
      const [dashRes, setRes] = await Promise.all([
        api.get<any>('/api/dashboard/summary'),
        api.get<any>('/api/settings')
      ]);
      if (dashRes && dashRes.lowStockProducts) {
        setLowStockItems(dashRes.lowStockProducts);
      }
      if (setRes && setRes.settings && setRes.settings.currency) {
        setCurrencySymbol(setRes.settings.currency);
      }
    } catch (err) {
      console.warn('Failed fetching background alerts:', err);
    }
  };

  useEffect(() => {
    fetchGlobalStats();
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="h-12 w-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-4">
          <PackageCheck className="h-6 w-6 animate-pulse" />
        </div>
        <p className="text-sm font-medium">Starting Nexus Inventory System...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleQuickAction = (action: 'sale' | 'purchase' | 'product') => {
    if (action === 'sale') {
      setCurrentTab('sales');
      setQuickCreateType('sale');
    } else if (action === 'purchase') {
      setCurrentTab('purchases');
      setQuickCreateType('purchase');
    } else if (action === 'product') {
      setCurrentTab('products');
      setQuickCreateType('product');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setQuickCreateType(null);
        }}
        lowStockCount={lowStockItems.length}
        isOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="lg:pl-64 flex flex-col flex-1 min-w-0">
        {/* Top Header */}
        <Header
          currentTab={currentTab}
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
          onQuickAction={handleQuickAction}
          lowStockItems={lowStockItems}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            setQuickCreateType(null);
          }}
          onOpenProfile={() => setIsProfileModalOpen(true)}
        />

        {/* Page Content Body */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentTab === 'dashboard' && (
            <DashboardPage
              onSelectTab={(tab) => {
                setCurrentTab(tab);
                setQuickCreateType(null);
              }}
              onQuickAction={handleQuickAction}
              currencySymbol={currencySymbol}
            />
          )}

          {currentTab === 'products' && (
            <ProductsPage
              currencySymbol={currencySymbol}
              onRefreshGlobal={fetchGlobalStats}
              openCreateOnMount={quickCreateType === 'product'}
            />
          )}

          {currentTab === 'categories' && <CategoriesPage />}

          {currentTab === 'purchases' && (
            <PurchasesPage
              currencySymbol={currencySymbol}
              onRefreshGlobal={fetchGlobalStats}
              openCreateOnMount={quickCreateType === 'purchase'}
            />
          )}

          {currentTab === 'sales' && (
            <SalesPage
              currencySymbol={currencySymbol}
              onRefreshGlobal={fetchGlobalStats}
              openCreateOnMount={quickCreateType === 'sale'}
            />
          )}

          {currentTab === 'stock' && (
            <StockLedgerPage
              currencySymbol={currencySymbol}
              onRefreshGlobal={fetchGlobalStats}
            />
          )}

          {currentTab === 'suppliers' && (
            <SuppliersPage
              currencySymbol={currencySymbol}
              onRefreshGlobal={fetchGlobalStats}
            />
          )}

          {currentTab === 'customers' && (
            <CustomersPage
              currencySymbol={currencySymbol}
              onRefreshGlobal={fetchGlobalStats}
            />
          )}

          {currentTab === 'reports' && (
            <ReportsPage currencySymbol={currencySymbol} />
          )}

          {currentTab === 'users' && isAdmin && <UsersPage />}

          {currentTab === 'settings' && isAdmin && (
            <SettingsPage onRefreshGlobal={fetchGlobalStats} />
          )}
        </main>
      </div>

      {/* Profile & Security Modal */}
      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
