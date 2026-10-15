import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Plus,
  Search,
  Filter,
  Eye,
  Trash2,
  AlertCircle,
  RefreshCw,
  Building2,
  Calendar,
  CheckCircle,
  FileText
} from 'lucide-react';
import { api, formatCurrency, formatDate } from '../api/client';
import { Purchase, PurchaseItem, Supplier, Product } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

interface PurchasesPageProps {
  currencySymbol?: string;
  onRefreshGlobal?: () => void;
  openCreateOnMount?: boolean;
}

export const PurchasesPage: React.FC<PurchasesPageProps> = ({
  currencySymbol = '₹',
  onRefreshGlobal,
  openCreateOnMount = false
}) => {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedSupplier, setSelectedSupplier] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(openCreateOnMount);
  const [viewingPurchase, setViewingPurchase] = useState<{ purchase: Purchase; items: PurchaseItem[] } | null>(null);

  // New purchase order form
  const [formData, setFormData] = useState({
    supplier_id: '',
    date: new Date().toISOString().split('T')[0],
    payment_status: 'paid',
    payment_method: 'bank_transfer',
    tax_amount: '0',
    discount_amount: '0',
    notes: ''
  });

  const [items, setItems] = useState<Array<{ product_id: number; quantity: number; unit_price: number }>>([
    { product_id: 0, quantity: 10, unit_price: 0 }
  ]);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedSupplier !== 'all') params.append('supplierId', selectedSupplier);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get<{ purchases: Purchase[] }>(`/api/purchases?${params.toString()}`);
      setPurchases(res.purchases);
    } catch (err) {
      console.error('Failed to load purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      const [supRes, prodRes] = await Promise.all([
        api.get<{ suppliers: Supplier[] }>('/api/suppliers'),
        api.get<{ products: Product[] }>('/api/products')
      ]);
      setSuppliers(supRes.suppliers);
      setProducts(prodRes.products);
      if (supRes.suppliers.length > 0 && !formData.supplier_id) {
        setFormData((prev) => ({ ...prev, supplier_id: String(supRes.suppliers[0].id) }));
      }
      if (prodRes.products.length > 0 && items[0].product_id === 0) {
        setItems([
          {
            product_id: prodRes.products[0].id,
            quantity: 10,
            unit_price: prodRes.products[0].purchase_price
          }
        ]);
      }
    } catch (err) {
      console.error('Failed fetching master data:', err);
    }
  };

  useEffect(() => {
    fetchPurchases();
    fetchInitialData();
  }, [selectedSupplier, startDate, endDate]);

  const handleOpenAdd = () => {
    setFormData({
      supplier_id: suppliers.length > 0 ? String(suppliers[0].id) : '',
      date: new Date().toISOString().split('T')[0],
      payment_status: 'paid',
      payment_method: 'bank_transfer',
      tax_amount: '0',
      discount_amount: '0',
      notes: ''
    });
    if (products.length > 0) {
      setItems([
        {
          product_id: products[0].id,
          quantity: 10,
          unit_price: products[0].purchase_price
        }
      ]);
    } else {
      setItems([]);
    }
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleAddItemRow = () => {
    if (products.length === 0) return;
    setItems((prev) => [
      ...prev,
      {
        product_id: products[0].id,
        quantity: 5,
        unit_price: products[0].purchase_price
      }
    ]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: 'product_id' | 'quantity' | 'unit_price', value: any) => {
    setItems((prev) => {
      const next = [...prev];
      if (field === 'product_id') {
        const prod = products.find((p) => p.id === Number(value));
        next[index] = {
          ...next[index],
          product_id: Number(value),
          unit_price: prod ? prod.purchase_price : next[index].unit_price
        };
      } else {
        next[index] = {
          ...next[index],
          [field]: Number(value)
        };
      }
      return next;
    });
  };

  // Calculations
  const subtotal = items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);
  const tax = Number(formData.tax_amount) || 0;
  const discount = Number(formData.discount_amount) || 0;
  const grandTotal = Math.max(0, subtotal + tax - discount);

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.supplier_id) {
      setFormError('Please select a supplier.');
      return;
    }

    if (items.length === 0 || items.some((it) => it.quantity <= 0)) {
      setFormError('Please ensure all items have a valid quantity greater than zero.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/purchases', {
        supplier_id: Number(formData.supplier_id),
        date: formData.date,
        payment_status: formData.payment_status,
        payment_method: formData.payment_method,
        tax_amount: tax,
        discount_amount: discount,
        notes: formData.notes,
        items
      });

      setIsAddModalOpen(false);
      await fetchPurchases();
      onRefreshGlobal?.();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record purchase order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewPurchase = async (id: number) => {
    try {
      const res = await api.get<{ purchase: Purchase; items: PurchaseItem[] }>(`/api/purchases/${id}`);
      setViewingPurchase(res);
    } catch (err: any) {
      alert(err.message || 'Failed to load purchase details.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Supplier filter */}
          <div className="w-full sm:w-60">
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Suppliers</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date range filters */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              title="From date"
            />
            <span className="text-slate-500 text-xs">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
              title="To date"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-emerald-600/30 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>New Purchase Order</span>
        </button>
      </div>

      {/* Purchases Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">PO Number</th>
                <th className="py-3.5 px-3">Supplier Name</th>
                <th className="py-3.5 px-3">Order Date</th>
                <th className="py-3.5 px-3">Items Count</th>
                <th className="py-3.5 px-3">Payment Method</th>
                <th className="py-3.5 px-3 text-right">Total Amount</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-emerald-500 mb-2" />
                    <span>Loading purchase orders...</span>
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No purchase orders found matching your criteria. Click "New Purchase Order" to replenish stock.
                  </td>
                </tr>
              ) : (
                purchases.map((po) => (
                  <tr key={po.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                      {po.purchase_number}
                    </td>
                    <td className="py-3 px-3 font-medium text-white">
                      {po.supplier_name}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {formatDate(po.date)}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {po.total_items} item(s)
                    </td>
                    <td className="py-3 px-3 capitalize text-slate-400 font-mono">
                      {po.payment_method?.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-white text-sm">
                      {formatCurrency(po.total_amount, currencySymbol)}
                    </td>
                    <td className="py-3 px-3">
                      <Badge status={po.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleViewPurchase(po.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Purchase Order Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Record New Purchase Order (Stock Inward)"
        subtitle="Selected items will automatically increment warehouse inventory levels"
        maxWidth="4xl"
      >
        <form onSubmit={handleSavePurchase} className="space-y-5">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Supplier *
              </label>
              <select
                required
                value={formData.supplier_id}
                onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">Select Supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Purchase Date *
              </label>
              <input
                type="date"
                required
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Payment Method
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="bank_transfer">Bank Transfer / NEFT</option>
                <option value="cash">Cash</option>
                <option value="credit">Credit (Accounts Payable)</option>
                <option value="cheque">Cheque</option>
              </select>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Order Items ({items.length})
              </span>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="flex items-center gap-1 px-2.5 py-1 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 rounded-lg text-xs font-semibold border border-emerald-500/30 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Item Line</span>
              </button>
            </div>

            <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
              {items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <div className="flex-1 min-w-[200px]">
                    <select
                      value={it.product_id}
                      onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) &bull; Cur: {p.quantity} {p.unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      required
                      placeholder="Qty"
                      value={it.quantity}
                      onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                      className="w-full px-2.5 py-1.5 font-mono text-center bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                      title="Quantity"
                    />
                  </div>

                  <div className="w-32">
                    <input
                      type="number"
                      step="any"
                      min="0"
                      required
                      placeholder="Unit Price"
                      value={it.unit_price}
                      onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                      className="w-full px-2.5 py-1.5 font-mono text-right bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                      title="Unit Cost"
                    />
                  </div>

                  <div className="w-32 text-right font-mono font-bold text-xs text-white pr-2">
                    {formatCurrency(it.quantity * it.unit_price, currencySymbol)}
                  </div>

                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItemRow(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors"
                      title="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Totals & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Purchase Notes / Reference
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Supplier invoice reference, truck dispatch details, batch numbers..."
                className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal:</span>
                <span className="font-mono">{formatCurrency(subtotal, currencySymbol)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Tax / Freight:</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.tax_amount}
                  onChange={(e) => setFormData({ ...formData, tax_amount: e.target.value })}
                  className="w-28 px-2 py-1 text-right font-mono bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Supplier Discount:</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
                  className="w-28 px-2 py-1 text-right font-mono bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm text-white">
                <span>Total Amount:</span>
                <span className="font-mono text-emerald-400">{formatCurrency(grandTotal, currencySymbol)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-md shadow-emerald-600/30 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              <span>Receive & Add to Stock</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* View Purchase Order Details Modal */}
      {viewingPurchase && (
        <Modal
          isOpen={true}
          onClose={() => setViewingPurchase(null)}
          title={`Purchase Order: ${viewingPurchase.purchase.purchase_number}`}
          subtitle={`Received on ${formatDate(viewingPurchase.purchase.date)}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block">Supplier:</span>
                <span className="font-semibold text-white">{viewingPurchase.purchase.supplier_name}</span>
                {viewingPurchase.purchase.supplier_phone && (
                  <span className="text-slate-400 block mt-0.5">{viewingPurchase.purchase.supplier_phone}</span>
                )}
              </div>
              <div>
                <span className="text-slate-400 block">Payment Method:</span>
                <span className="font-medium text-white capitalize">{viewingPurchase.purchase.payment_method?.replace('_', ' ')}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Status:</span>
                <Badge status={viewingPurchase.purchase.status} size="sm" />
              </div>
            </div>

            <div className="border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Product Name</th>
                    <th className="py-2.5 px-3 font-mono">SKU</th>
                    <th className="py-2.5 px-3 text-center">Quantity</th>
                    <th className="py-2.5 px-3 text-right">Unit Price</th>
                    <th className="py-2.5 px-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {viewingPurchase.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-medium text-white">{it.product_name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-400">{it.sku}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-white">
                        {it.quantity} {it.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                        {formatCurrency(it.unit_price, currencySymbol)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(it.total_price, currencySymbol)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Subtotal:</span>
                <span className="font-mono text-slate-200">{formatCurrency(viewingPurchase.purchase.subtotal, currencySymbol)}</span>
              </div>
              {viewingPurchase.purchase.tax_amount > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Tax / Shipping:</span>
                  <span className="font-mono text-slate-200">+{formatCurrency(viewingPurchase.purchase.tax_amount, currencySymbol)}</span>
                </div>
              )}
              {viewingPurchase.purchase.discount_amount > 0 && (
                <div className="flex justify-between text-slate-400">
                  <span>Discount:</span>
                  <span className="font-mono text-slate-200">-{formatCurrency(viewingPurchase.purchase.discount_amount, currencySymbol)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm text-white">
                <span>Total Amount:</span>
                <span className="font-mono text-emerald-400">{formatCurrency(viewingPurchase.purchase.total_amount, currencySymbol)}</span>
              </div>
            </div>

            {viewingPurchase.purchase.notes && (
              <p className="text-xs text-slate-400 italic">
                Notes: {viewingPurchase.purchase.notes}
              </p>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
