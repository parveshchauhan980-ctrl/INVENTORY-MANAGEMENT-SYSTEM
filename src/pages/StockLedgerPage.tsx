import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Sliders,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  RefreshCw,
  Boxes,
  RotateCcw,
  CheckCircle2
} from 'lucide-react';
import { api, formatCurrency, formatDate } from '../api/client';
import { StockLog, Product } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

interface StockLedgerPageProps {
  currencySymbol?: string;
  onRefreshGlobal?: () => void;
}

export const StockLedgerPage: React.FC<StockLedgerPageProps> = ({
  currencySymbol = '₹',
  onRefreshGlobal
}) => {
  const [logs, setLogs] = useState<StockLog[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedProduct, setSelectedProduct] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  // Manual Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustData, setAdjustData] = useState({
    product_id: '',
    type: 'adjustment_in',
    quantity: '5',
    reason: 'Physical inventory audit adjustment'
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedProduct !== 'all') params.append('productId', selectedProduct);
      if (selectedType !== 'all') params.append('type', selectedType);

      const res = await api.get<{ logs: StockLog[] }>(`/api/stock/logs?${params.toString()}`);
      setLogs(res.logs);
    } catch (err) {
      console.error('Failed to load stock movement ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await api.get<{ products: Product[] }>('/api/products');
      setProducts(res.products);
      if (res.products.length > 0 && !adjustData.product_id) {
        setAdjustData((prev) => ({ ...prev, product_id: String(res.products[0].id) }));
      }
    } catch (err) {
      console.error('Failed to fetch products for stock ledger:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchProducts();
  }, [selectedProduct, selectedType]);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      await api.post('/api/stock/adjust', {
        product_id: Number(adjustData.product_id),
        type: adjustData.type,
        quantity: Number(adjustData.quantity),
        reason: adjustData.reason
      });

      setIsAdjustModalOpen(false);
      await fetchLogs();
      await fetchProducts();
      onRefreshGlobal?.();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record stock adjustment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Filter & Adjustment Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Product Filter */}
          <div className="w-full sm:w-64">
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="w-full sm:w-48">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Movement Types</option>
              <option value="purchase">Purchases (Inward)</option>
              <option value="sale">Sales (Outward)</option>
              <option value="adjustment_in">Adjustments In (+)</option>
              <option value="adjustment_out">Adjustments Out (-)</option>
              <option value="damage">Damaged Goods (-)</option>
              <option value="return">Customer Returns (+)</option>
            </select>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setFormError(null);
            setIsAdjustModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-amber-600/30 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <Sliders className="h-4 w-4" />
          <span>Manual Stock Adjustment</span>
        </button>
      </div>

      {/* Stock Ledger History Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Date / Time</th>
                <th className="py-3.5 px-3">Product Name</th>
                <th className="py-3.5 px-3">Type</th>
                <th className="py-3.5 px-3 text-center">Change</th>
                <th className="py-3.5 px-3 text-center">Prev &rarr; New</th>
                <th className="py-3.5 px-3">Reason / Details</th>
                <th className="py-3.5 px-3">Reference Doc</th>
                <th className="py-3.5 px-4 text-right">Logged By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-500 mb-2" />
                    <span>Loading inventory audit ledger...</span>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No stock movements recorded matching your criteria.
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const isPositive = log.quantity_change > 0;
                  return (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4 text-slate-400 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{log.product_name}</div>
                        <div className="font-mono text-[11px] text-slate-400">SKU: {log.sku}</div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge status={log.type} size="sm" />
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-mono font-bold text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 ${
                            isPositive
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isPositive ? `+${log.quantity_change}` : log.quantity_change} {log.unit || 'pcs'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-slate-300">
                        <span className="text-slate-500">{log.previous_quantity}</span>
                        <span className="mx-1 text-slate-600">&rarr;</span>
                        <span className="font-bold text-white">{log.new_quantity}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-300 max-w-xs truncate">
                        {log.reason || '—'}
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-indigo-400">
                        {log.reference_id || '—'}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-300 font-medium">
                        {log.user_name || 'System'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Stock Adjustment Modal */}
      <Modal
        isOpen={isAdjustModalOpen}
        onClose={() => setIsAdjustModalOpen(false)}
        title="Record Stock Adjustment"
        subtitle="Modifications are written to the database audit log and affect live available stock"
        maxWidth="md"
      >
        <form onSubmit={handleAdjustSubmit} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Product *
            </label>
            <select
              required
              value={adjustData.product_id}
              onChange={(e) => setAdjustData({ ...adjustData, product_id: e.target.value })}
              className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) &bull; Stock: {p.quantity} {p.unit}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Adjustment Type *
            </label>
            <select
              value={adjustData.type}
              onChange={(e) => setAdjustData({ ...adjustData, type: e.target.value })}
              className="w-full px-3 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
            >
              <option value="adjustment_in">+ Stock Increase (Found extra inventory / Count audit)</option>
              <option value="adjustment_out">- Stock Decrease (Missing / inventory shrinkage)</option>
              <option value="damage">- Damaged Goods (Write-off)</option>
              <option value="return">+ Customer Return (Restocked)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Quantity *
            </label>
            <input
              type="number"
              min="1"
              required
              value={adjustData.quantity}
              onChange={(e) => setAdjustData({ ...adjustData, quantity: e.target.value })}
              placeholder="e.g. 5"
              className="w-full font-mono px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Audit Reason / Justification *
            </label>
            <textarea
              required
              rows={3}
              value={adjustData.reason}
              onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
              placeholder="Required justification for inventory ledger auditing..."
              className="w-full px-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAdjustModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-md shadow-amber-600/30 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              <span>Commit Stock Change</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
