import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Building,
  DollarSign,
  Percent,
  MapPin,
  Phone,
  Mail,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Download,
  FileSpreadsheet,
  FileCode,
  Database,
  ArrowDownToLine,
  Boxes,
  ShoppingBag,
  Layers,
  FileText,
  Sparkles
} from 'lucide-react';
import { api } from '../api/client';

interface SettingsPageProps {
  onRefreshGlobal?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ onRefreshGlobal }) => {
  const [settings, setSettings] = useState<Record<string, string>>({
    company_name: '',
    currency: '₹',
    tax_rate: '18',
    address: '',
    phone: '',
    email: '',
    gstin: ''
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Live export counts & state
  const [exportStats, setExportStats] = useState<{
    productsCount: number;
    salesCount: number;
    categoriesCount: number;
    stockLogsCount: number;
  } | null>(null);
  const [exportingType, setExportingType] = useState<string | null>(null);
  const [exportNotice, setExportNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSyncFirebase = async () => {
    setSyncingCloud(true);
    setSyncMessage(null);
    try {
      const { syncAllToFirebase } = await import('../firebase/syncService');
      const result = await syncAllToFirebase();
      setSyncMessage(
        `Successfully synced ${result.productsCount} products, ${result.categoriesCount} categories, ${result.suppliersCount} suppliers, and ${result.salesCount} sales to Firestore Cloud Database!`
      );
      setTimeout(() => setSyncMessage(null), 6000);
    } catch (err: any) {
      alert(err.message || 'Failed syncing to Firebase Firestore.');
    } finally {
      setSyncingCloud(false);
    }
  };

  const fetchSettingsAndStats = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ settings: Record<string, string> }>('/api/settings');
      setSettings((prev) => ({ ...prev, ...res.settings }));

      // Fetch live data counts for export indicators
      try {
        const exportData = await api.get<any>('/api/settings/export-data');
        if (exportData?.summary) {
          setExportStats({
            productsCount: exportData.summary.totalProducts ?? 0,
            salesCount: exportData.summary.totalSales ?? 0,
            categoriesCount: exportData.summary.totalCategories ?? 0,
            stockLogsCount: exportData.summary.totalStockLogs ?? 0
          });
        }
      } catch (err) {
        console.warn('Could not fetch export counts:', err);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettingsAndStats();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMessage(null);

    try {
      await api.put('/api/settings', settings);
      setSuccessMessage('System configuration updated successfully.');
      onRefreshGlobal?.();
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Failed to update settings.');
    } finally {
      setSaving(false);
    }
  };

  // Helper to trigger browser file download
  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 1. Export Inventory Data as CSV or JSON
  const handleExportInventory = async (format: 'csv' | 'json') => {
    setExportingType(`inventory_${format}`);
    setExportNotice(null);
    try {
      const data = await api.get<any>('/api/settings/export-data');
      const products = data.products || [];
      const dateStr = new Date().toISOString().split('T')[0];

      if (format === 'json') {
        const payload = {
          exportType: 'Inventory Catalog',
          exportedAt: new Date().toISOString(),
          totalProducts: products.length,
          products
        };
        const filename = `inventory_catalog_${dateStr}.json`;
        triggerDownload(JSON.stringify(payload, null, 2), filename, 'application/json');
        setExportNotice({
          type: 'success',
          message: `Exported ${products.length} inventory products to ${filename}`
        });
      } else {
        const headers = [
          'ID',
          'SKU',
          'Barcode',
          'Product Name',
          'Category',
          'Brand',
          'Unit',
          'Purchase Price',
          'Selling Price',
          'Available Quantity',
          'Min Stock Level',
          'Stock Status',
          'Warehouse Location',
          'Description',
          'Created At'
        ];

        const rows = products.map((p: any) => [
          p.id,
          `"${p.sku || ''}"`,
          `"${p.barcode || ''}"`,
          `"${(p.name || '').replace(/"/g, '""')}"`,
          `"${(p.category_name || '').replace(/"/g, '""')}"`,
          `"${(p.brand || '').replace(/"/g, '""')}"`,
          `"${p.unit || 'pcs'}"`,
          p.purchase_price ?? 0,
          p.selling_price ?? 0,
          p.quantity ?? 0,
          p.min_stock ?? 0,
          `"${p.status || ''}"`,
          `"${(p.location || '').replace(/"/g, '""')}"`,
          `"${(p.description || '').replace(/"/g, '""')}"`,
          `"${p.created_at || ''}"`
        ]);

        const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
        const filename = `inventory_catalog_${dateStr}.csv`;
        triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;');
        setExportNotice({
          type: 'success',
          message: `Exported ${products.length} inventory products to ${filename}`
        });
      }
      setTimeout(() => setExportNotice(null), 6000);
    } catch (err: any) {
      setExportNotice({
        type: 'error',
        message: err.message || 'Failed to export inventory data.'
      });
    } finally {
      setExportingType(null);
    }
  };

  // 2. Export Sales Data as CSV or JSON
  const handleExportSales = async (format: 'csv' | 'json') => {
    setExportingType(`sales_${format}`);
    setExportNotice(null);
    try {
      const data = await api.get<any>('/api/settings/export-data');
      const sales = data.sales || [];
      const dateStr = new Date().toISOString().split('T')[0];

      if (format === 'json') {
        const payload = {
          exportType: 'Sales Invoices & Transactions',
          exportedAt: new Date().toISOString(),
          totalSales: sales.length,
          sales
        };
        const filename = `sales_invoices_${dateStr}.json`;
        triggerDownload(JSON.stringify(payload, null, 2), filename, 'application/json');
        setExportNotice({
          type: 'success',
          message: `Exported ${sales.length} sales invoices to ${filename}`
        });
      } else {
        const headers = [
          'Invoice Number',
          'Date',
          'Customer Name',
          'Customer Phone',
          'Payment Method',
          'Subtotal',
          'Tax Rate (%)',
          'Tax Amount',
          'Discount Amount',
          'Total Amount',
          'Payment Status',
          'Invoice Status',
          'Billed By',
          'Notes',
          'Items Detail'
        ];

        const rows = sales.map((s: any) => {
          const itemsSummary = (s.items || [])
            .map((it: any) => `${it.product_name} (${it.quantity}x @ ${it.unit_price})`)
            .join('; ');

          return [
            `"${s.invoice_number || ''}"`,
            `"${s.date || ''}"`,
            `"${(s.customer_name || '').replace(/"/g, '""')}"`,
            `"${s.customer_phone || ''}"`,
            `"${s.payment_method || ''}"`,
            s.subtotal ?? 0,
            s.tax_rate ?? 0,
            s.tax_amount ?? 0,
            s.discount_amount ?? 0,
            s.total_amount ?? 0,
            `"${s.payment_status || ''}"`,
            `"${s.status || ''}"`,
            `"${(s.created_by || '').replace(/"/g, '""')}"`,
            `"${(s.notes || '').replace(/"/g, '""')}"`,
            `"${itemsSummary.replace(/"/g, '""')}"`
          ];
        });

        const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
        const filename = `sales_invoices_${dateStr}.csv`;
        triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;');
        setExportNotice({
          type: 'success',
          message: `Exported ${sales.length} sales invoices to ${filename}`
        });
      }
      setTimeout(() => setExportNotice(null), 6000);
    } catch (err: any) {
      setExportNotice({
        type: 'error',
        message: err.message || 'Failed to export sales data.'
      });
    } finally {
      setExportingType(null);
    }
  };

  // 3. Export Combined Inventory & Sales Data as CSV or JSON
  const handleExportCombined = async (format: 'csv' | 'json') => {
    setExportingType(`combined_${format}`);
    setExportNotice(null);
    try {
      const data = await api.get<any>('/api/settings/export-data');
      const products = data.products || [];
      const sales = data.sales || [];
      const dateStr = new Date().toISOString().split('T')[0];

      if (format === 'json') {
        const payload = {
          exportType: 'Combined Inventory & Sales Archive',
          exportedAt: new Date().toISOString(),
          company: settings.company_name,
          currency: settings.currency,
          summary: {
            totalProducts: products.length,
            totalSales: sales.length,
            totalPurchases: data.purchases?.length || 0
          },
          inventory: products,
          sales: sales
        };
        const filename = `inventory_and_sales_combined_${dateStr}.json`;
        triggerDownload(JSON.stringify(payload, null, 2), filename, 'application/json');
        setExportNotice({
          type: 'success',
          message: `Exported combined inventory (${products.length}) and sales (${sales.length}) to ${filename}`
        });
      } else {
        // Build Itemized Sales & Inventory Detailed Ledger CSV
        const headers = [
          'Record Type',
          'Reference/SKU',
          'Item Name',
          'Category',
          'Current Stock Available',
          'Purchase Cost',
          'Selling Price',
          'Invoice / Doc Ref',
          'Transaction Date',
          'Customer / Supplier',
          'Quantity Transacted',
          'Line Total Amount',
          'Status'
        ];

        const rows: any[] = [];

        // 1. Inventory rows
        products.forEach((p: any) => {
          rows.push([
            '"INVENTORY_CATALOG"',
            `"${p.sku || ''}"`,
            `"${(p.name || '').replace(/"/g, '""')}"`,
            `"${(p.category_name || '').replace(/"/g, '""')}"`,
            p.quantity ?? 0,
            p.purchase_price ?? 0,
            p.selling_price ?? 0,
            '""',
            `"${p.created_at || ''}"`,
            '""',
            p.quantity ?? 0,
            ((p.quantity ?? 0) * (p.selling_price ?? 0)).toFixed(2),
            `"${p.status || ''}"`
          ]);
        });

        // 2. Sales item breakdown rows
        sales.forEach((s: any) => {
          (s.items || []).forEach((item: any) => {
            rows.push([
              '"SALE_TRANSACTION"',
              `"${item.product_sku || ''}"`,
              `"${(item.product_name || '').replace(/"/g, '""')}"`,
              '""',
              '""',
              item.unit_cost ?? 0,
              item.unit_price ?? 0,
              `"${s.invoice_number || ''}"`,
              `"${s.date || ''}"`,
              `"${(s.customer_name || '').replace(/"/g, '""')}"`,
              item.quantity ?? 0,
              item.total_price ?? 0,
              `"${s.payment_status || s.status || ''}"`
            ]);
          });
        });

        const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
        const filename = `inventory_and_sales_combined_${dateStr}.csv`;
        triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;');
        setExportNotice({
          type: 'success',
          message: `Exported unified inventory and sales data (${rows.length} combined records) to ${filename}`
        });
      }
      setTimeout(() => setExportNotice(null), 6000);
    } catch (err: any) {
      setExportNotice({
        type: 'error',
        message: err.message || 'Failed to export combined inventory and sales data.'
      });
    } finally {
      setExportingType(null);
    }
  };

  // 4. Export Complete System Database Backup (JSON)
  const handleExportFullJSON = async () => {
    setExportingType('full_backup_json');
    setExportNotice(null);
    try {
      const data = await api.get<any>('/api/settings/export-data');
      const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `nexus_inventory_complete_backup_${dateStr}.json`;
      triggerDownload(JSON.stringify(data, null, 2), filename, 'application/json');
      setExportNotice({
        type: 'success',
        message: `Generated and downloaded full system database backup to ${filename}`
      });
      setTimeout(() => setExportNotice(null), 6000);
    } catch (err: any) {
      setExportNotice({
        type: 'error',
        message: err.message || 'Failed to generate full system backup.'
      });
    } finally {
      setExportingType(null);
    }
  };

  // 5. Export Stock Movement Audit CSV
  const handleExportStockCSV = async () => {
    setExportingType('stock_csv');
    setExportNotice(null);
    try {
      const data = await api.get<any>('/api/settings/export-data');
      const headers = [
        'Log ID',
        'Timestamp',
        'Product Name',
        'SKU',
        'Movement Type',
        'Quantity Delta',
        'Previous Balance',
        'New Balance',
        'Reference Document',
        'Audit Reason',
        'User'
      ];

      const rows = (data.stockLogs || []).map((sl: any) => [
        sl.id,
        `"${sl.created_at || ''}"`,
        `"${(sl.product_name || '').replace(/"/g, '""')}"`,
        `"${sl.product_sku || ''}"`,
        `"${sl.type || ''}"`,
        sl.quantity_change ?? 0,
        sl.previous_quantity ?? 0,
        sl.new_quantity ?? 0,
        `"${sl.reference_id || ''}"`,
        `"${(sl.reason || '').replace(/"/g, '""')}"`,
        `"${(sl.user_name || '').replace(/"/g, '""')}"`
      ]);

      const csvContent = [headers.join(','), ...rows.map((r: any) => r.join(','))].join('\r\n');
      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `stock_movement_audit_${dateStr}.csv`;
      triggerDownload(csvContent, filename, 'text/csv;charset=utf-8;');
      setExportNotice({
        type: 'success',
        message: `Exported ${(data.stockLogs || []).length} stock audit movements to ${filename}`
      });
      setTimeout(() => setExportNotice(null), 6000);
    } catch (err: any) {
      setExportNotice({
        type: 'error',
        message: err.message || 'Failed to export stock audit CSV.'
      });
    } finally {
      setExportingType(null);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">System Settings & Data Export</h3>
          <p className="text-xs text-slate-400">
            Configure store invoice parameters, cloud sync, and download all inventory and sales data as CSV or JSON
          </p>
        </div>
      </div>

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2.5">
          <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="bg-slate-900/80 p-6 rounded-3xl border border-slate-800 space-y-6 shadow-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Company / Store Name *
            </label>
            <input
              type="text"
              required
              value={settings.company_name}
              onChange={(e) => setSettings({ ...settings, company_name: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Currency Symbol *
            </label>
            <select
              value={settings.currency}
              onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="₹">₹ (Indian Rupee - INR)</option>
              <option value="$">$ (US Dollar - USD)</option>
              <option value="€">€ (Euro - EUR)</option>
              <option value="£">£ (British Pound - GBP)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Default GST / Tax Rate (%) *
            </label>
            <input
              type="number"
              step="any"
              min="0"
              max="100"
              required
              value={settings.tax_rate}
              onChange={(e) => setSettings({ ...settings, tax_rate: e.target.value })}
              className="w-full font-mono px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Support Phone Number
            </label>
            <input
              type="text"
              value={settings.phone}
              onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Billing Email Address
            </label>
            <input
              type="email"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Tax Registration Number / GSTIN
            </label>
            <input
              type="text"
              value={settings.gstin}
              onChange={(e) => setSettings({ ...settings, gstin: e.target.value.toUpperCase() })}
              placeholder="e.g. 27AABCN8932K1ZP"
              className="w-full font-mono uppercase px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Registered Physical Address
            </label>
            <textarea
              rows={2}
              value={settings.address}
              onChange={(e) => setSettings({ ...settings, address: e.target.value })}
              className="w-full px-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-end pt-4 border-t border-slate-800">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? (
              <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            <span>Save Configuration</span>
          </button>
        </div>
      </form>

      {/* DATA EXPORT & DOWNLOAD SECTION */}
      <div className="p-6 rounded-3xl bg-slate-900/80 border border-slate-800 space-y-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center font-bold">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Data Export & Archival Center</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                  CSV &bull; JSON
                </span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5">
                Download all inventory and sales data as offline spreadsheets or structured JSON documents
              </p>
            </div>
          </div>

          {exportStats && (
            <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800 text-[11px] text-slate-400">
              <span>Catalog: <strong className="text-white font-mono">{exportStats.productsCount}</strong> items</span>
              <span className="text-slate-700">&bull;</span>
              <span>Sales: <strong className="text-white font-mono">{exportStats.salesCount}</strong> invoices</span>
            </div>
          )}
        </div>

        {/* Dynamic status feedback notification */}
        {exportNotice && (
          <div
            className={`p-3.5 rounded-2xl border text-xs flex items-center gap-2.5 transition-all ${
              exportNotice.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {exportNotice.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-rose-400 flex-shrink-0" />
            )}
            <span className="font-medium">{exportNotice.message}</span>
          </div>
        )}

        {/* 1. Combined Inventory & Sales Unified Export (Highlight Banner) */}
        <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-slate-900 border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-300">
                <Sparkles className="h-4 w-4" />
              </span>
              <h5 className="text-xs font-bold text-white uppercase tracking-wider">
                All Inventory & Sales Data (Combined Package)
              </h5>
            </div>
            <p className="text-xs text-slate-300 max-w-xl">
              Export complete catalog stock positions combined with all sales transaction ledgers in a single file. Perfect for auditing, accounting, and spreadsheet analysis.
            </p>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <button
              type="button"
              disabled={exportingType !== null}
              onClick={() => handleExportCombined('csv')}
              className="flex-1 md:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {exportingType === 'combined_csv' ? (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <FileSpreadsheet className="h-3.5 w-3.5" />
              )}
              <span>Download Combined CSV</span>
            </button>

            <button
              type="button"
              disabled={exportingType !== null}
              onClick={() => handleExportCombined('json')}
              className="flex-1 md:flex-none px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-600/30 transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {exportingType === 'combined_json' ? (
                <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <FileCode className="h-3.5 w-3.5" />
              )}
              <span>Download Combined JSON</span>
            </button>
          </div>
        </div>

        {/* 2. Individual Module Export Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card A: All Inventory Data */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Boxes className="h-4 w-4" />
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                  {exportStats ? `${exportStats.productsCount} items` : 'Inventory'}
                </span>
              </div>
              <h5 className="text-xs font-bold text-white">All Inventory Data</h5>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Complete catalog with SKUs, barcodes, pricing, stock levels, categories, and warehouse bins.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900">
              <button
                type="button"
                disabled={exportingType !== null}
                onClick={() => handleExportInventory('csv')}
                className="py-2 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {exportingType === 'inventory_csv' ? (
                  <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                )}
                <span>CSV</span>
              </button>
              <button
                type="button"
                disabled={exportingType !== null}
                onClick={() => handleExportInventory('json')}
                className="py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {exportingType === 'inventory_json' ? (
                  <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <FileCode className="h-3.5 w-3.5 text-purple-400" />
                )}
                <span>JSON</span>
              </button>
            </div>
          </div>

          {/* Card B: All Sales Data */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-blue-500/40 transition-all flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <ShoppingBag className="h-4 w-4" />
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                  {exportStats ? `${exportStats.salesCount} invoices` : 'Sales'}
                </span>
              </div>
              <h5 className="text-xs font-bold text-white">All Sales Invoices</h5>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Itemized billing ledgers, customer details, tax breakdowns, discounts, and payment records.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900">
              <button
                type="button"
                disabled={exportingType !== null}
                onClick={() => handleExportSales('csv')}
                className="py-2 px-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {exportingType === 'sales_csv' ? (
                  <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                )}
                <span>CSV</span>
              </button>
              <button
                type="button"
                disabled={exportingType !== null}
                onClick={() => handleExportSales('json')}
                className="py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {exportingType === 'sales_json' ? (
                  <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <FileCode className="h-3.5 w-3.5 text-blue-400" />
                )}
                <span>JSON</span>
              </button>
            </div>
          </div>

          {/* Card C: Full Database & Audit Backup */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 hover:border-purple-500/40 transition-all flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Database className="h-4 w-4" />
                </span>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                  Snapshot
                </span>
              </div>
              <h5 className="text-xs font-bold text-white">Full System Archive</h5>
              <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                Relational snapshot of products, sales, purchases, suppliers, customers, and stock logs.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900">
              <button
                type="button"
                disabled={exportingType !== null}
                onClick={handleExportFullJSON}
                className="py-2 px-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {exportingType === 'full_backup_json' ? (
                  <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <FileCode className="h-3.5 w-3.5" />
                )}
                <span>JSON</span>
              </button>
              <button
                type="button"
                disabled={exportingType !== null}
                onClick={handleExportStockCSV}
                title="Export stock movements audit ledger CSV"
                className="py-2 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-[11px] font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {exportingType === 'stock_csv' ? (
                  <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-3.5 w-3.5 text-amber-400" />
                )}
                <span>Audit CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Firebase Cloud Sync Box */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center font-bold">
              🔥
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Firebase Firestore Cloud Backend</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Connected
                </span>
              </h4>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Project: poised-segment-dv9wh &bull; Database: ai-studio-nexusinventoryma-75e8d797-1fb1-4cd9-95c0-ba0e58d2971d
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={syncingCloud}
            onClick={handleSyncFirebase}
            className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
          >
            {syncingCloud ? (
              <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-950/30 border-t-slate-950 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            <span>{syncingCloud ? 'Syncing to Firestore...' : 'Sync All to Firestore'}</span>
          </button>
        </div>

        {syncMessage && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
            <span>{syncMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
