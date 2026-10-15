import React, { useState, useEffect } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  Mail,
  Phone,
  MapPin,
  AlertCircle,
  RefreshCw,
  ShoppingBag,
  ReceiptText
} from 'lucide-react';
import { api, formatCurrency, formatDate } from '../api/client';
import { Customer, Sale } from '../types';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';

interface CustomersPageProps {
  currencySymbol?: string;
  onRefreshGlobal?: () => void;
}

export const CustomersPage: React.FC<CustomersPageProps> = ({
  currencySymbol = '₹',
  onRefreshGlobal
}) => {
  const { isAdmin } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);
  const [viewingCustomer, setViewingCustomer] = useState<{ customer: Customer; invoices: Sale[] } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    customer_type: 'retail' as 'retail' | 'wholesale',
    outstanding_balance: '0'
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ customers: Customer[] }>('/api/customers');
      setCustomers(res.customers);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      address: '',
      customer_type: 'retail',
      outstanding_balance: '0'
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      name: c.name,
      email: c.email || '',
      phone: c.phone,
      address: c.address || '',
      customer_type: c.customer_type || 'retail',
      outstanding_balance: String(c.outstanding_balance || 0)
    });
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (editingCustomer) {
        await api.put(`/api/customers/${editingCustomer.id}`, {
          ...formData,
          outstanding_balance: Number(formData.outstanding_balance)
        });
        setEditingCustomer(null);
      } else {
        await api.post('/api/customers', {
          ...formData,
          outstanding_balance: Number(formData.outstanding_balance)
        });
        setIsAddModalOpen(false);
      }
      await fetchCustomers();
      onRefreshGlobal?.();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCustomer) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/customers/${deletingCustomer.id}`);
      setDeletingCustomer(null);
      await fetchCustomers();
      onRefreshGlobal?.();
    } catch (err: any) {
      alert(err.message || 'Failed to delete customer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleView = async (id: number) => {
    try {
      const res = await api.get<{ customer: Customer; invoices: Sale[] }>(`/api/customers/${id}`);
      setViewingCustomer(res);
    } catch (err: any) {
      alert(err.message || 'Failed to load customer profile.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Customer Database</h3>
          <p className="text-xs text-slate-400">
            Manage wholesale clients, retail patrons, contact information, and billing histories
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Customer</span>
        </button>
      </div>

      {/* Customers Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-3">Classification</th>
                <th className="py-3.5 px-3">Phone & Email</th>
                <th className="py-3.5 px-3">Total Invoices</th>
                <th className="py-3.5 px-3 text-right">Lifetime Spend</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-500 mb-2" />
                    <span>Loading customer accounts...</span>
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No customers found. Click "Add Customer" to register your first buyer.
                  </td>
                </tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm">{c.name}</div>
                      {c.address && <div className="text-[11px] text-slate-400 truncate max-w-xs">{c.address}</div>}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                        c.customer_type === 'wholesale'
                          ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                          : 'bg-blue-500/10 text-blue-400 border border-blue-500/30'
                      }`}>
                        {c.customer_type}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-white font-mono">{c.phone}</div>
                      {c.email && <div className="text-[11px] text-slate-400">{c.email}</div>}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {c.total_invoices || 0} invoice(s)
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      {formatCurrency(c.total_spent || 0, currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleView(c.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="View Invoices"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(c)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors"
                          title="Edit Customer"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeletingCustomer(c)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Delete Customer"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      <Modal
        isOpen={isAddModalOpen || editingCustomer !== null}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCustomer(null);
        }}
        title={editingCustomer ? 'Edit Customer Details' : 'Register New Customer'}
        subtitle="Manage client details for simplified POS invoicing"
        maxWidth="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Customer / Business Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Modern Tech Solutions or Pooja Nair"
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Classification *
              </label>
              <select
                value={formData.customer_type}
                onChange={(e) => setFormData({ ...formData, customer_type: e.target.value as any })}
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="retail">Retail Buyer</option>
                <option value="wholesale">Wholesale / Corporate</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Phone Number *
              </label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="customer@domain.com"
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Billing Address
            </label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Street, locality, city, pin code..."
              className="w-full px-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingCustomer(null);
              }}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/30 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting && <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
              <span>{editingCustomer ? 'Update Customer' : 'Save Customer'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* View Customer Invoices Modal */}
      {viewingCustomer && (
        <Modal
          isOpen={true}
          onClose={() => setViewingCustomer(null)}
          title={`Customer Invoices: ${viewingCustomer.customer.name}`}
          subtitle={`Total Billed: ${formatCurrency(viewingCustomer.customer.total_spent || 0, currencySymbol)}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block">Phone:</span>
                <span className="font-mono text-white">{viewingCustomer.customer.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Email:</span>
                <span className="text-slate-300">{viewingCustomer.customer.email || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Type:</span>
                <span className="font-semibold text-indigo-400 capitalize">{viewingCustomer.customer.customer_type}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Purchased Invoices ({viewingCustomer.invoices.length})
              </h4>
              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">Invoice #</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Payment</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {viewingCustomer.invoices.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400">
                          No sales invoices recorded for this customer yet.
                        </td>
                      </tr>
                    ) : (
                      viewingCustomer.invoices.map((inv) => (
                        <tr key={inv.id}>
                          <td className="py-2.5 px-3 font-mono font-medium text-indigo-400">
                            {inv.invoice_number}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{formatDate(inv.date)}</td>
                          <td className="py-2.5 px-3 capitalize text-slate-300">{inv.payment_method}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                            {formatCurrency(inv.total_amount, currencySymbol)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingCustomer(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Customer Confirmation */}
      {deletingCustomer && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setDeletingCustomer(null)}
          onConfirm={handleDelete}
          title="Delete Customer Record?"
          message={`Are you sure you want to delete customer "${deletingCustomer.name}"? If there are past invoices linked to this customer, deletion will be safely rejected to prevent orphaned records.`}
          confirmLabel="Delete Customer"
          isDestructive={true}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
};
