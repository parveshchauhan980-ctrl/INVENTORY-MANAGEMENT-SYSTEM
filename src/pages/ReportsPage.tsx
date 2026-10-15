import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  DollarSign,
  TrendingUp,
  Percent,
  Boxes,
  ShoppingBag,
  ReceiptText,
  RefreshCw,
  FileSpreadsheet
} from 'lucide-react';
import { api, formatCurrency, formatDate } from '../api/client';
import { StatCard } from '../components/common/StatCard';

interface ReportsPageProps {
  currencySymbol?: string;
}

type ReportTab = 'sales' | 'purchases' | 'inventory' | 'profit_loss';

export const ReportsPage: React.FC<ReportsPageProps> = ({ currencySymbol = '₹' }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('profit_loss');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);

  // Data states
  const [salesReport, setSalesReport] = useState<{ rows: any[]; summary: any } | null>(null);
  const [purchasesReport, setPurchasesReport] = useState<{ rows: any[]; summary: any } | null>(null);
  const [inventoryReport, setInventoryReport] = useState<{ rows: any[]; summary: any } | null>(null);
  const [profitLossReport, setProfitLossReport] = useState<{
    revenue: number;
    cogs: number;
    grossProfit: number;
    marginPercentage: number;
    totalUnitsSold: number;
    topProducts: any[];
  } | null>(null);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      if (activeTab === 'sales') {
        const res = await api.get<any>(`/api/reports/sales?${params.toString()}`);
        setSalesReport(res);
      } else if (activeTab === 'purchases') {
        const res = await api.get<any>(`/api/reports/purchases?${params.toString()}`);
        setPurchasesReport(res);
      } else if (activeTab === 'inventory') {
        const res = await api.get<any>('/api/reports/inventory');
        setInventoryReport(res);
      } else if (activeTab === 'profit_loss') {
        const res = await api.get<any>('/api/reports/profit-loss');
        setProfitLossReport(res);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, startDate, endDate]);

  // Export active report to CSV
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = `${activeTab}_report_${new Date().toISOString().split('T')[0]}.csv`;

    if (activeTab === 'sales' && salesReport) {
      headers = ['Invoice Number', 'Customer Name', 'Date', 'Payment Method', 'Subtotal', 'Tax Amount', 'Discount', 'Total Amount', 'Created By'];
      rows = salesReport.rows.map((r) => [
        r.invoice_number,
        `"${r.customer_name}"`,
        r.date,
        r.payment_method,
        r.subtotal,
        r.tax_amount,
        r.discount_amount,
        r.total_amount,
        r.created_by
      ]);
    } else if (activeTab === 'purchases' && purchasesReport) {
      headers = ['PO Number', 'Supplier Name', 'Date', 'Payment Method', 'Subtotal', 'Tax Amount', 'Discount', 'Total Amount', 'Created By'];
      rows = purchasesReport.rows.map((r) => [
        r.purchase_number,
        `"${r.supplier_name}"`,
        r.date,
        r.payment_method,
        r.subtotal,
        r.tax_amount,
        r.discount_amount,
        r.total_amount,
        r.created_by
      ]);
    } else if (activeTab === 'inventory' && inventoryReport) {
      headers = ['SKU', 'Product Name', 'Category', 'Stock Quantity', 'Unit Cost', 'Retail Price', 'Total Cost Valuation', 'Total Retail Valuation', 'Potential Profit'];
      rows = inventoryReport.rows.map((r) => [
        r.sku,
        `"${r.name}"`,
        `"${r.category_name}"`,
        r.quantity,
        r.purchase_price,
        r.selling_price,
        r.total_cost_value,
        r.total_retail_value,
        r.potential_profit
      ]);
    } else if (activeTab === 'profit_loss' && profitLossReport) {
      headers = ['Product SKU', 'Product Name', 'Category', 'Units Sold', 'Total Revenue', 'Cost of Goods (COGS)', 'Net Item Profit'];
      rows = profitLossReport.topProducts.map((p) => [
        p.sku,
        `"${p.name}"`,
        `"${p.category_name}"`,
        p.units_sold,
        p.total_revenue,
        p.cost_of_goods,
        p.item_profit
      ]);
    }

    if (rows.length === 0) return;

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800 no-print">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('profit_loss')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'profit_loss'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Profit & Margin Analysis
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sales')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'sales'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sales Ledger
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('purchases')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'purchases'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Procurement Ledger
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'inventory'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Inventory Valuation
          </button>
        </div>

        {/* Date and Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {(activeTab === 'sales' || activeTab === 'purchases') && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                title="From"
              />
              <span className="text-slate-500 text-xs">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                title="To"
              />
            </div>
          )}

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-indigo-400" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium border border-slate-700 transition-colors cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-emerald-400" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-2" />
          <p className="text-sm">Generating real-time financial report...</p>
        </div>
      ) : activeTab === 'profit_loss' && profitLossReport ? (
        <div className="space-y-6">
          {/* Top KPI Cards for P&L */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Sales Revenue"
              value={formatCurrency(profitLossReport.revenue, currencySymbol)}
              subtitle="All verified invoice billings"
              icon={TrendingUp}
              color="emerald"
            />
            <StatCard
              title="Cost of Goods Sold (COGS)"
              value={formatCurrency(profitLossReport.cogs, currencySymbol)}
              subtitle={`${profitLossReport.totalUnitsSold} unit(s) dispatched`}
              icon={ShoppingBag}
              color="amber"
            />
            <StatCard
              title="Gross Profit"
              value={formatCurrency(profitLossReport.grossProfit, currencySymbol)}
              subtitle="Revenue minus direct purchase cost"
              icon={DollarSign}
              color={profitLossReport.grossProfit >= 0 ? 'emerald' : 'rose'}
            />
            <StatCard
              title="Gross Profit Margin"
              value={`${profitLossReport.marginPercentage.toFixed(1)}%`}
              subtitle="Gross profit / Total revenue"
              icon={Percent}
              color="indigo"
            />
          </div>

          {/* Top Products Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-white">Top Revenue & Profit Generating Products</h4>
                <p className="text-xs text-slate-400">Breakdown of gross margins achieved per product line</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-3">SKU</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-center">Units Sold</th>
                    <th className="py-3 px-3 text-right">Revenue</th>
                    <th className="py-3 px-3 text-right">COGS</th>
                    <th className="py-3 px-4 text-right">Net Profit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {profitLossReport.topProducts.map((p) => {
                    const margin = p.total_revenue > 0 ? Math.round((p.item_profit / p.total_revenue) * 100) : 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-800/40">
                        <td className="py-3 px-4 font-bold text-white">{p.name}</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{p.sku}</td>
                        <td className="py-3 px-3 text-slate-300">{p.category_name}</td>
                        <td className="py-3 px-3 text-center font-mono font-bold text-white">
                          {p.units_sold}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white">
                          {formatCurrency(p.total_revenue, currencySymbol)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-400">
                          {formatCurrency(p.cost_of_goods, currencySymbol)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className="font-mono font-bold text-emerald-400">
                            {formatCurrency(p.item_profit, currencySymbol)}
                          </span>
                          <span className="block text-[10px] text-slate-400 font-mono">
                            {margin}% margin
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'sales' && salesReport ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs">
            <div>
              <p className="text-slate-400">Invoices Billed:</p>
              <p className="text-lg font-bold text-white mt-0.5">{salesReport.summary.totalSales}</p>
            </div>
            <div>
              <p className="text-slate-400">Subtotal Amount:</p>
              <p className="text-lg font-mono font-bold text-white mt-0.5">{formatCurrency(salesReport.summary.totalSubtotal, currencySymbol)}</p>
            </div>
            <div>
              <p className="text-slate-400">Tax / GST Collected:</p>
              <p className="text-lg font-mono font-bold text-emerald-400 mt-0.5">+{formatCurrency(salesReport.summary.totalTax, currencySymbol)}</p>
            </div>
            <div>
              <p className="text-slate-400">Total Billed Revenue:</p>
              <p className="text-lg font-mono font-extrabold text-indigo-400 mt-0.5">{formatCurrency(salesReport.summary.totalRevenue, currencySymbol)}</p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase">
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-3">Customer</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3">Payment</th>
                    <th className="py-3 px-3 text-right">Tax</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {salesReport.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-mono font-bold text-indigo-400">{r.invoice_number}</td>
                      <td className="py-2.5 px-3 font-medium text-white">{r.customer_name}</td>
                      <td className="py-2.5 px-3 text-slate-400">{formatDate(r.date)}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{r.item_count} pcs</td>
                      <td className="py-2.5 px-3 capitalize text-slate-300">{r.payment_method}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">{formatCurrency(r.tax_amount, currencySymbol)}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-white">{formatCurrency(r.total_amount, currencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'purchases' && purchasesReport ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs">
            <div>
              <p className="text-slate-400">Total Purchase Orders:</p>
              <p className="text-lg font-bold text-white mt-0.5">{purchasesReport.summary.totalPurchases}</p>
            </div>
            <div>
              <p className="text-slate-400">Subtotal Amount:</p>
              <p className="text-lg font-mono font-bold text-white mt-0.5">{formatCurrency(purchasesReport.summary.totalSubtotal, currencySymbol)}</p>
            </div>
            <div>
              <p className="text-slate-400">Tax / Freight Paid:</p>
              <p className="text-lg font-mono font-bold text-amber-400 mt-0.5">+{formatCurrency(purchasesReport.summary.totalTax, currencySymbol)}</p>
            </div>
            <div>
              <p className="text-slate-400">Total Procurement Cost:</p>
              <p className="text-lg font-mono font-extrabold text-emerald-400 mt-0.5">{formatCurrency(purchasesReport.summary.totalSpent, currencySymbol)}</p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase">
                    <th className="py-3 px-4">PO #</th>
                    <th className="py-3 px-3">Supplier Name</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Items</th>
                    <th className="py-3 px-3">Payment</th>
                    <th className="py-3 px-3 text-right">Tax</th>
                    <th className="py-3 px-4 text-right">Total Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {purchasesReport.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-mono font-bold text-emerald-400">{r.purchase_number}</td>
                      <td className="py-2.5 px-3 font-medium text-white">{r.supplier_name}</td>
                      <td className="py-2.5 px-3 text-slate-400">{formatDate(r.date)}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{r.item_count} pcs</td>
                      <td className="py-2.5 px-3 capitalize text-slate-300">{r.payment_method}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">{formatCurrency(r.tax_amount, currencySymbol)}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-white">{formatCurrency(r.total_amount, currencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'inventory' && inventoryReport ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-900/60 rounded-2xl border border-slate-800 text-xs">
            <div>
              <p className="text-slate-400">Total Catalog Items:</p>
              <p className="text-lg font-bold text-white mt-0.5">{inventoryReport.summary.totalItems} ({inventoryReport.summary.totalStockUnits} units)</p>
            </div>
            <div>
              <p className="text-slate-400">Stock Valuation (Cost):</p>
              <p className="text-lg font-mono font-bold text-amber-400 mt-0.5">{formatCurrency(inventoryReport.summary.totalCostValuation, currencySymbol)}</p>
            </div>
            <div>
              <p className="text-slate-400">Stock Valuation (Retail):</p>
              <p className="text-lg font-mono font-bold text-indigo-400 mt-0.5">{formatCurrency(inventoryReport.summary.totalRetailValuation, currencySymbol)}</p>
            </div>
            <div>
              <p className="text-slate-400">Potential Profit Margin:</p>
              <p className="text-lg font-mono font-extrabold text-emerald-400 mt-0.5">{formatCurrency(inventoryReport.summary.totalPotentialProfit, currencySymbol)}</p>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase">
                    <th className="py-3 px-4">Product Name</th>
                    <th className="py-3 px-3">SKU</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3 text-center">Stock</th>
                    <th className="py-3 px-3 text-right">Cost Price</th>
                    <th className="py-3 px-3 text-right">Retail Price</th>
                    <th className="py-3 px-3 text-right">Valuation (Cost)</th>
                    <th className="py-3 px-4 text-right">Valuation (Retail)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {inventoryReport.rows.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-4 font-bold text-white">{r.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{r.sku}</td>
                      <td className="py-2.5 px-3 text-slate-300">{r.category_name}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-white">{r.quantity} {r.unit}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-400">{formatCurrency(r.purchase_price, currencySymbol)}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-200">{formatCurrency(r.selling_price, currencySymbol)}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-amber-400">{formatCurrency(r.total_cost_value, currencySymbol)}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-white">{formatCurrency(r.total_retail_value, currencySymbol)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};
