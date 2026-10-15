import React, { useState, useEffect } from 'react';
import {
  ReceiptText,
  Plus,
  Search,
  Printer,
  Eye,
  Trash2,
  AlertCircle,
  RefreshCw,
  User,
  CreditCard,
  QrCode,
  CheckCircle2,
  FileCheck
} from 'lucide-react';
import { api, formatCurrency, formatDate } from '../api/client';
import { Sale, SaleItem, Customer, Product, CompanySettings } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';

interface SalesPageProps {
  currencySymbol?: string;
  onRefreshGlobal?: () => void;
  openCreateOnMount?: boolean;
}

export const SalesPage: React.FC<SalesPageProps> = ({
  currencySymbol = '₹',
  onRefreshGlobal,
  openCreateOnMount = false
}) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(openCreateOnMount);
  const [viewingSale, setViewingSale] = useState<{ sale: Sale; items: SaleItem[]; settings: Record<string, string> } | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    customer_id: '',
    customer_name: 'Walk-in Retail Customer',
    date: new Date().toISOString().split('T')[0],
    payment_method: 'cash',
    tax_rate: '18',
    discount_amount: '0',
    notes: ''
  });

  const [items, setItems] = useState<Array<{ product_id: number; quantity: number; unit_price: number }>>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSales = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (paymentMethod !== 'all') params.append('paymentMethod', paymentMethod);

      const res = await api.get<{ sales: Sale[] }>(`/api/sales?${params.toString()}`);
      setSales(res.sales);
    } catch (err) {
      console.error('Failed to load sales:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      const [custRes, prodRes] = await Promise.all([
        api.get<{ customers: Customer[] }>('/api/customers'),
        api.get<{ products: Product[] }>('/api/products')
      ]);
      setCustomers(custRes.customers);
      setProducts(prodRes.products);
    } catch (err) {
      console.error('Failed to load master data for sales:', err);
    }
  };

  useEffect(() => {
    fetchSales();
    fetchInitialData();
  }, [startDate, endDate, paymentMethod]);

  const handleOpenAdd = () => {
    setFormData({
      customer_id: '',
      customer_name: 'Walk-in Retail Customer',
      date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
      tax_rate: '18',
      discount_amount: '0',
      notes: ''
    });

    // Default with first available product that has stock > 0
    const inStock = products.find((p) => p.quantity > 0);
    if (inStock) {
      setItems([
        {
          product_id: inStock.id,
          quantity: 1,
          unit_price: inStock.selling_price
        }
      ]);
    } else {
      setItems([]);
    }
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleAddItemRow = () => {
    const available = products.find((p) => p.quantity > 0 && !items.some((it) => it.product_id === p.id)) || products[0];
    if (!available) return;

    setItems((prev) => [
      ...prev,
      {
        product_id: available.id,
        quantity: 1,
        unit_price: available.selling_price
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
          unit_price: prod ? prod.selling_price : next[index].unit_price
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

  const handleSelectCustomer = (custId: string) => {
    if (!custId) {
      setFormData((prev) => ({
        ...prev,
        customer_id: '',
        customer_name: 'Walk-in Retail Customer'
      }));
      return;
    }
    const c = customers.find((cust) => cust.id === Number(custId));
    if (c) {
      setFormData((prev) => ({
        ...prev,
        customer_id: String(c.id),
        customer_name: c.name
      }));
    }
  };

  // Live calculations
  const subtotal = items.reduce((acc, it) => acc + (it.quantity * it.unit_price), 0);
  const discount = Number(formData.discount_amount) || 0;
  const taxable = Math.max(0, subtotal - discount);
  const taxRate = Number(formData.tax_rate) || 0;
  const taxAmount = (taxable * taxRate) / 100;
  const grandTotal = taxable + taxAmount;

  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (items.length === 0) {
      setFormError('Please add at least one product to the sales order.');
      return;
    }

    // Client-side stock check for immediate feedback
    for (const item of items) {
      const prod = products.find((p) => p.id === item.product_id);
      if (!prod) {
        setFormError('Invalid product selected.');
        return;
      }
      if (item.quantity <= 0) {
        setFormError(`Quantity for "${prod.name}" must be at least 1.`);
        return;
      }
      if (prod.quantity < item.quantity) {
        setFormError(`Insufficient stock for "${prod.name}". Only ${prod.quantity} ${prod.unit} available.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<any>('/api/sales', {
        customer_id: formData.customer_id ? Number(formData.customer_id) : null,
        customer_name: formData.customer_name,
        date: formData.date,
        payment_method: formData.payment_method,
        tax_rate: taxRate,
        discount_amount: discount,
        notes: formData.notes,
        items
      });

      setIsAddModalOpen(false);
      await fetchSales();
      onRefreshGlobal?.();

      // Automatically open print invoice for completed sale!
      if (res && res.saleId) {
        handleViewSale(res.saleId);
      }
    } catch (err: any) {
      setFormError(err.message || 'Failed to process sale.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewSale = async (id: number) => {
    try {
      const res = await api.get<{ sale: Sale; items: SaleItem[]; settings: Record<string, string> }>(`/api/sales/${id}`);
      setViewingSale(res);
    } catch (err: any) {
      alert(err.message || 'Failed to load invoice.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Control bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Payment method filter */}
          <div className="w-full sm:w-48">
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="all">All Payment Modes</option>
              <option value="cash">Cash</option>
              <option value="card">Card / POS</option>
              <option value="upi">UPI / QR</option>
              <option value="bank_transfer">Bank Transfer</option>
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
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>New Sales Invoice (POS)</span>
        </button>
      </div>

      {/* Sales Invoices Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Invoice #</th>
                <th className="py-3.5 px-3">Customer Name</th>
                <th className="py-3.5 px-3">Date</th>
                <th className="py-3.5 px-3">Payment Mode</th>
                <th className="py-3.5 px-3">Tax / GST</th>
                <th className="py-3.5 px-3 text-right">Grand Total</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-500 mb-2" />
                    <span>Loading sales ledger...</span>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No sales invoices recorded yet. Click "New Sales Invoice" to bill a transaction.
                  </td>
                </tr>
              ) : (
                sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-400">
                      {sale.invoice_number}
                    </td>
                    <td className="py-3 px-3 font-medium text-white">
                      {sale.customer_name}
                    </td>
                    <td className="py-3 px-3 text-slate-400">
                      {formatDate(sale.date)}
                    </td>
                    <td className="py-3 px-3 font-mono capitalize text-slate-300">
                      {sale.payment_method?.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {formatCurrency(sale.tax_amount, currencySymbol)} ({sale.tax_rate}%)
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-extrabold text-white text-sm">
                      {formatCurrency(sale.total_amount, currencySymbol)}
                    </td>
                    <td className="py-3 px-3">
                      <Badge status={sale.payment_status} />
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleViewSale(sale.id)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white border border-indigo-500/30 transition-colors cursor-pointer"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Print Invoice</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* POS / New Sale Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Create Sales Invoice & Deduct Stock"
        subtitle="Stock validation active: transactions are rejected if inventory is insufficient"
        maxWidth="4xl"
      >
        <form onSubmit={handleSaveSale} className="space-y-5">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Select Customer
              </label>
              <select
                value={formData.customer_id}
                onChange={(e) => handleSelectCustomer(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">Walk-in Retail Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.customer_type}) &bull; {c.phone}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Customer Name / Bill To *
              </label>
              <input
                type="text"
                required
                value={formData.customer_name}
                onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                placeholder="Walk-in Customer"
                className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Payment Method
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="cash">Cash Counter</option>
                <option value="upi">UPI / PhonePe / GPay</option>
                <option value="card">Credit / Debit Card</option>
                <option value="bank_transfer">Bank Transfer / NEFT</option>
              </select>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/40">
            <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Cart Items ({items.length})
              </span>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="flex items-center gap-1 px-2.5 py-1 bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30 rounded-lg text-xs font-semibold border border-indigo-500/30 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Product</span>
              </button>
            </div>

            <div className="p-3 space-y-2 max-h-72 overflow-y-auto">
              {items.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  No items in cart. Click "Add Product" above.
                </p>
              ) : (
                items.map((it, idx) => {
                  const prod = products.find((p) => p.id === it.product_id);
                  const isOutOfStock = prod ? prod.quantity <= 0 : false;
                  const isExceeding = prod ? it.quantity > prod.quantity : false;

                  return (
                    <div
                      key={idx}
                      className={`flex flex-col sm:flex-row sm:items-center gap-3 p-2.5 rounded-xl border transition-all ${
                        isExceeding || isOutOfStock
                          ? 'bg-rose-500/10 border-rose-500/40'
                          : 'bg-slate-900/60 border-slate-800'
                      }`}
                    >
                      <div className="flex-1 min-w-[200px]">
                        <select
                          value={it.product_id}
                          onChange={(e) => handleItemChange(idx, 'product_id', e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku}) &bull; Stock: {p.quantity} {p.unit}
                            </option>
                          ))}
                        </select>
                        <div className="text-[10px] mt-0.5 text-slate-400 flex items-center gap-2">
                          <span className={prod && prod.quantity <= 0 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                            Available: {prod?.quantity || 0} {prod?.unit}
                          </span>
                          {isExceeding && (
                            <span className="text-rose-400 font-semibold animate-pulse">
                              Cannot order more than available!
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="w-24">
                        <label className="text-[10px] text-slate-400 block sm:hidden">Qty</label>
                        <input
                          type="number"
                          min="1"
                          max={prod?.quantity || 99999}
                          required
                          value={it.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          className="w-full px-2.5 py-1.5 font-mono text-center bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                          title="Quantity"
                        />
                      </div>

                      <div className="w-32">
                        <label className="text-[10px] text-slate-400 block sm:hidden">Unit Price</label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          required
                          value={it.unit_price}
                          onChange={(e) => handleItemChange(idx, 'unit_price', e.target.value)}
                          className="w-full px-2.5 py-1.5 font-mono text-right bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500"
                          title="Unit Price"
                        />
                      </div>

                      <div className="w-28 text-right font-mono font-bold text-xs text-white pr-2">
                        {formatCurrency(it.quantity * it.unit_price, currencySymbol)}
                      </div>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItemRow(idx)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition-colors self-end sm:self-center"
                          title="Remove item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Pricing calculations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Order Notes / Reference
              </label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Customer delivery instructions, warranty serials, etc."
                className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="bg-slate-950/60 p-4 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Subtotal:</span>
                <span className="font-mono">{formatCurrency(subtotal, currencySymbol)}</span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Discount ({currencySymbol}):</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={formData.discount_amount}
                  onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
                  className="w-28 px-2 py-1 text-right font-mono bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>Tax / GST Rate (%):</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="any"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: e.target.value })}
                  className="w-28 px-2 py-1 text-right font-mono bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>
              <div className="flex justify-between text-slate-400 font-mono text-[11px]">
                <span>Tax Amount:</span>
                <span>+{formatCurrency(taxAmount, currencySymbol)}</span>
              </div>
              <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-sm text-white">
                <span>Grand Total:</span>
                <span className="font-mono text-indigo-400">{formatCurrency(grandTotal, currencySymbol)}</span>
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
              disabled={isSubmitting || items.length === 0}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/30 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              <span>Complete Sale & Print Invoice</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable Tax Invoice Modal */}
      {viewingSale && (
        <Modal
          isOpen={true}
          onClose={() => setViewingSale(null)}
          title={`Tax Invoice: ${viewingSale.sale.invoice_number}`}
          subtitle="Ready for printing or PDF customer receipt"
          maxWidth="4xl"
        >
          <div className="space-y-4">
            {/* Printable container */}
            <div id="printable-invoice" className="bg-white text-slate-900 p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-200">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between border-b pb-6 gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                    {viewingSale.settings?.company_name || 'Nexus Inventory Systems Pvt. Ltd.'}
                  </h1>
                  <p className="text-xs text-slate-600 mt-1 max-w-sm">
                    {viewingSale.settings?.address || 'Plot 42, Tech Park, Phase II, Pune - 411057'}
                  </p>
                  <p className="text-xs text-slate-600">
                    Phone: {viewingSale.settings?.phone || '+91 98765 43210'} | Email: {viewingSale.settings?.email || 'sales@nexusinventory.com'}
                  </p>
                  <p className="text-xs font-semibold text-slate-800 mt-0.5">
                    GSTIN: {viewingSale.settings?.gstin || '27AABCN8932K1ZP'}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <span className="inline-block px-3 py-1 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded">
                    TAX INVOICE
                  </span>
                  <div className="mt-2 text-xs text-slate-700 space-y-0.5 font-mono">
                    <p><span className="font-semibold">Invoice No:</span> {viewingSale.sale.invoice_number}</p>
                    <p><span className="font-semibold">Date:</span> {formatDate(viewingSale.sale.date)}</p>
                    <p><span className="font-semibold">Payment:</span> {viewingSale.sale.payment_method?.toUpperCase()}</p>
                    <p><span className="font-semibold">Status:</span> PAID</p>
                  </div>
                </div>
              </div>

              {/* Bill To */}
              <div className="py-4 border-b text-xs flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <span className="text-[11px] font-bold uppercase text-slate-400 block mb-0.5">Billed To:</span>
                  <p className="text-sm font-bold text-slate-900">{viewingSale.sale.customer_name}</p>
                  {viewingSale.sale.customer_phone && <p className="text-slate-600">Phone: {viewingSale.sale.customer_phone}</p>}
                  {viewingSale.sale.customer_address && <p className="text-slate-600">{viewingSale.sale.customer_address}</p>}
                </div>
                <div className="text-left sm:text-right">
                  <span className="text-[11px] font-bold uppercase text-slate-400 block mb-0.5">Billed By:</span>
                  <p className="font-semibold text-slate-800">{viewingSale.sale.created_by || 'Sales Counter'}</p>
                  <p className="text-slate-500">Verified System Record</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="py-4">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-900 text-slate-700 font-bold uppercase tracking-wider">
                      <th className="py-2">#</th>
                      <th className="py-2">Item Description</th>
                      <th className="py-2">SKU</th>
                      <th className="py-2 text-center">Qty</th>
                      <th className="py-2 text-right">Rate</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {viewingSale.items.map((it, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2.5 font-semibold text-slate-900">{it.product_name}</td>
                        <td className="py-2.5 font-mono text-slate-500">{it.sku}</td>
                        <td className="py-2.5 text-center font-mono font-bold text-slate-800">
                          {it.quantity} {it.unit || 'pcs'}
                        </td>
                        <td className="py-2.5 text-right font-mono text-slate-700">
                          {formatCurrency(it.unit_price, currencySymbol)}
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-slate-900">
                          {formatCurrency(it.total_price, currencySymbol)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary Calculations */}
              <div className="pt-4 border-t flex flex-col sm:flex-row justify-between gap-6 text-xs">
                <div className="max-w-xs space-y-2">
                  <p className="font-semibold text-slate-800">Terms & Conditions:</p>
                  <ul className="list-disc pl-4 text-slate-600 text-[11px] space-y-0.5">
                    <li>Goods once sold will only be returned within 7 days with valid invoice.</li>
                    <li>Subject to local municipal jurisdiction.</li>
                  </ul>
                  {viewingSale.sale.notes && (
                    <p className="text-[11px] text-slate-500 italic mt-2">
                      Notes: {viewingSale.sale.notes}
                    </p>
                  )}
                </div>

                <div className="w-full sm:w-64 space-y-1.5 font-mono text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(viewingSale.sale.subtotal, currencySymbol)}</span>
                  </div>
                  {viewingSale.sale.discount_amount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Discount:</span>
                      <span>-{formatCurrency(viewingSale.sale.discount_amount, currencySymbol)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-slate-600">
                    <span>GST ({viewingSale.sale.tax_rate}%):</span>
                    <span>+{formatCurrency(viewingSale.sale.tax_amount, currencySymbol)}</span>
                  </div>
                  <div className="pt-2 border-t-2 border-slate-900 flex justify-between font-extrabold text-sm text-slate-900">
                    <span>Grand Total:</span>
                    <span>{formatCurrency(viewingSale.sale.total_amount, currencySymbol)}</span>
                  </div>
                </div>
              </div>

              {/* Authorized Signatory */}
              <div className="mt-10 pt-8 border-t flex justify-between items-end text-xs text-slate-600">
                <div>
                  <p>Computer Generated Tax Invoice</p>
                  <p className="text-[10px] text-slate-400">Powered by Nexus Inventory System</p>
                </div>
                <div className="text-center">
                  <div className="h-10 border-b border-dashed border-slate-400 w-44 mb-1" />
                  <p className="font-semibold text-slate-800">Authorized Signatory</p>
                </div>
              </div>
            </div>

            {/* Modal actions (hidden in print) */}
            <div className="flex items-center justify-end gap-3 pt-2 no-print">
              <button
                type="button"
                onClick={() => setViewingSale(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
              >
                <Printer className="h-4 w-4" />
                <span>Print Tax Invoice</span>
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
