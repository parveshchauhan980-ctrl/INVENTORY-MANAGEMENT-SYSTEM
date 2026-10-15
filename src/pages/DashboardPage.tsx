import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Layers,
  Truck,
  Users,
  TrendingUp,
  AlertTriangle,
  ReceiptText,
  ShoppingBag,
  ArrowUpRight,
  RefreshCw,
  Wallet,
  Sparkles
} from 'lucide-react';
import { api, formatCurrency, formatDate } from '../api/client';
import { DashboardKPIs, Product, Sale, Purchase } from '../types';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { NavTab } from '../components/layout/Sidebar';

interface DashboardProps {
  onSelectTab: (tab: NavTab) => void;
  onQuickAction: (action: 'sale' | 'purchase' | 'product') => void;
  currencySymbol?: string;
}

export const DashboardPage: React.FC<DashboardProps> = ({
  onSelectTab,
  onQuickAction,
  currencySymbol = '₹'
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    kpis: DashboardKPIs;
    lowStockProducts: any[];
    recentSales: any[];
    recentPurchases: any[];
    categoryBreakdown: any[];
    monthlyTrends: any[];
  } | null>(null);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await api.get<any>('/api/dashboard/summary');
      setData(res);
    } catch (err) {
      console.error('Error fetching dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-400">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm">Loading live inventory metrics...</p>
      </div>
    );
  }

  const kpis = data?.kpis || {
    totalProducts: 0,
    totalCategories: 0,
    totalSuppliers: 0,
    totalCustomers: 0,
    totalStockQuantity: 0,
    totalStockCostValue: 0,
    totalStockRetailValue: 0,
    totalSalesRevenue: 0,
    totalSalesOrders: 0,
    totalPurchasesCost: 0,
    totalPurchasesOrders: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  };

  const maxCategoryValue = Math.max(...(data?.categoryBreakdown || []).map((c) => c.total_value || 1), 1);

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 rounded-3xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-semibold">
              Live Real-Time Database
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
            Inventory & Store Performance
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Track product movements, invoice generation, supplier purchases, and financial margins.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={fetchDashboard}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all cursor-pointer border border-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => onQuickAction('sale')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
          >
            <ReceiptText className="h-3.5 w-3.5" />
            <span>Create Sale</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Stock Valuation (Retail)"
          value={formatCurrency(kpis.totalStockRetailValue, currencySymbol)}
          subtitle={`Cost value: ${formatCurrency(kpis.totalStockCostValue, currencySymbol)}`}
          icon={Wallet}
          color="indigo"
        />

        <StatCard
          title="Total Sales Revenue"
          value={formatCurrency(kpis.totalSalesRevenue, currencySymbol)}
          subtitle={`${kpis.totalSalesOrders} billed transaction(s)`}
          icon={TrendingUp}
          color="emerald"
        />

        <StatCard
          title="Total Products in Catalog"
          value={kpis.totalProducts}
          subtitle={`${kpis.totalStockQuantity} units across ${kpis.totalCategories} categories`}
          icon={Boxes}
          color="blue"
        />

        <StatCard
          title="Inventory Attention"
          value={kpis.lowStockCount + kpis.outOfStockCount}
          subtitle={`${kpis.lowStockCount} low stock &bull; ${kpis.outOfStockCount} out of stock`}
          icon={AlertTriangle}
          color={kpis.outOfStockCount > 0 ? 'rose' : kpis.lowStockCount > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {/* Secondary quick counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          onClick={() => onSelectTab('categories')}
          className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 cursor-pointer transition-all flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-slate-400 font-medium">Categories</p>
            <p className="text-lg font-bold text-white mt-0.5">{kpis.totalCategories}</p>
          </div>
          <Layers className="h-5 w-5 text-indigo-400" />
        </div>

        <div
          onClick={() => onSelectTab('suppliers')}
          className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 cursor-pointer transition-all flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-slate-400 font-medium">Suppliers</p>
            <p className="text-lg font-bold text-white mt-0.5">{kpis.totalSuppliers}</p>
          </div>
          <Truck className="h-5 w-5 text-emerald-400" />
        </div>

        <div
          onClick={() => onSelectTab('customers')}
          className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 cursor-pointer transition-all flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-slate-400 font-medium">Customers</p>
            <p className="text-lg font-bold text-white mt-0.5">{kpis.totalCustomers}</p>
          </div>
          <Users className="h-5 w-5 text-blue-400" />
        </div>

        <div
          onClick={() => onSelectTab('purchases')}
          className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:border-indigo-500/40 cursor-pointer transition-all flex items-center justify-between"
        >
          <div>
            <p className="text-xs text-slate-400 font-medium">Total Procurement</p>
            <p className="text-lg font-bold text-white mt-0.5">{formatCurrency(kpis.totalPurchasesCost, currencySymbol)}</p>
          </div>
          <ShoppingBag className="h-5 w-5 text-amber-400" />
        </div>
      </div>

      {/* Low stock alert banner */}
      {(kpis.lowStockCount > 0 || kpis.outOfStockCount > 0) && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 flex-shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">
                Reorder Required: {kpis.lowStockCount + kpis.outOfStockCount} item(s) below threshold
              </h4>
              <p className="text-xs text-slate-300 mt-0.5">
                Certain products are nearing depletion or currently out of stock. Restock to prevent lost sales orders.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onSelectTab('products')}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
            >
              Inspect Stock
            </button>
            <button
              type="button"
              onClick={() => onQuickAction('purchase')}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Order from Supplier
            </button>
          </div>
        </div>
      )}

      {/* Main Grid: Category breakdown & Sales Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Distribution */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-white tracking-tight">Stock by Category</h3>
            <button
              type="button"
              onClick={() => onSelectTab('categories')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <span>Manage</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>

          <div className="space-y-4">
            {(!data?.categoryBreakdown || data.categoryBreakdown.length === 0) ? (
              <p className="text-xs text-slate-400 py-6 text-center">No categories found.</p>
            ) : (
              data.categoryBreakdown.map((cat, idx) => {
                const percent = Math.min(100, Math.round(((cat.total_value || 0) / maxCategoryValue) * 100));
                return (
                  <div key={idx} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200 flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: cat.color || '#6366f1' }}
                        />
                        {cat.name}
                      </span>
                      <span className="font-mono text-slate-300">
                        {formatCurrency(cat.total_value, currencySymbol)} ({cat.total_quantity} pcs)
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${percent}%`,
                          backgroundColor: cat.color || '#6366f1'
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Low Stock Items List */}
        <div className="lg:col-span-2 p-5 rounded-3xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Inventory Watchlist</h3>
              <p className="text-xs text-slate-400">Items requiring immediate reordering or tracking</p>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('stock')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1"
            >
              <span>View Stock Ledger</span>
              <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="pb-3 pl-1">Product</th>
                  <th className="pb-3">SKU</th>
                  <th className="pb-3">Category</th>
                  <th className="pb-3">Stock Left</th>
                  <th className="pb-3">Min Level</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(!data?.lowStockProducts || data.lowStockProducts.length === 0) ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      All products currently have healthy stock reserves.
                    </td>
                  </tr>
                ) : (
                  data.lowStockProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 pl-1 font-semibold text-white truncate max-w-[160px]">
                        {p.name}
                      </td>
                      <td className="py-2.5 font-mono text-slate-400">{p.sku}</td>
                      <td className="py-2.5 text-slate-300">{p.category_name}</td>
                      <td className="py-2.5 font-bold font-mono text-white">
                        {p.quantity} {p.unit}
                      </td>
                      <td className="py-2.5 font-mono text-slate-400">{p.min_stock} {p.unit}</td>
                      <td className="py-2.5 text-right">
                        <Badge status={p.quantity <= 0 ? 'out_of_stock' : 'low_stock'} size="sm" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Operational Split: Recent Sales vs Recent Purchases */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Sales */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <ReceiptText className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Recent Sales Invoices</h3>
                <p className="text-xs text-slate-400">Customer billing activities</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('sales')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              All Sales &rarr;
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="pb-2.5">Invoice #</th>
                  <th className="pb-2.5">Customer</th>
                  <th className="pb-2.5">Date</th>
                  <th className="pb-2.5 text-right">Total</th>
                  <th className="pb-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(!data?.recentSales || data.recentSales.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No sales recorded yet. Click "+ New Sale" to create an invoice.
                    </td>
                  </tr>
                ) : (
                  data.recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 font-mono font-medium text-indigo-400">
                        {sale.invoice_number}
                      </td>
                      <td className="py-2.5 text-slate-200 truncate max-w-[120px] font-medium">
                        {sale.customer_name}
                      </td>
                      <td className="py-2.5 text-slate-400">{formatDate(sale.date)}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-white">
                        {formatCurrency(sale.total_amount, currencySymbol)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Badge status={sale.payment_status} size="sm" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-tight">Recent Purchases</h3>
                <p className="text-xs text-slate-400">Procurement from suppliers</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectTab('purchases')}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium"
            >
              All Purchases &rarr;
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                  <th className="pb-2.5">PO #</th>
                  <th className="pb-2.5">Supplier</th>
                  <th className="pb-2.5">Date</th>
                  <th className="pb-2.5 text-right">Total</th>
                  <th className="pb-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {(!data?.recentPurchases || data.recentPurchases.length === 0) ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      No purchase orders recorded yet.
                    </td>
                  </tr>
                ) : (
                  data.recentPurchases.map((po) => (
                    <tr key={po.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2.5 font-mono font-medium text-emerald-400">
                        {po.purchase_number}
                      </td>
                      <td className="py-2.5 text-slate-200 truncate max-w-[120px] font-medium">
                        {po.supplier_name}
                      </td>
                      <td className="py-2.5 text-slate-400">{formatDate(po.date)}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-white">
                        {formatCurrency(po.total_amount, currencySymbol)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Badge status={po.status} size="sm" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
