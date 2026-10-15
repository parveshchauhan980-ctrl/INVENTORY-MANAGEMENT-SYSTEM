import React, { useState, useEffect } from 'react';
import {
  Truck,
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  Mail,
  Phone,
  MapPin,
  FileText,
  AlertCircle,
  RefreshCw,
  Building
} from 'lucide-react';
import { api, formatCurrency, formatDate } from '../api/client';
import { Supplier, Purchase } from '../types';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { Badge } from '../components/common/Badge';

interface SuppliersPageProps {
  currencySymbol?: string;
  onRefreshGlobal?: () => void;
}

export const SuppliersPage: React.FC<SuppliersPageProps> = ({
  currencySymbol = '₹',
  onRefreshGlobal
}) => {
  const { isAdmin } = useAuth();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [viewingSupplier, setViewingSupplier] = useState<{ supplier: Supplier; purchases: Purchase[] } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    tax_id: '',
    outstanding_balance: '0'
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ suppliers: Supplier[] }>('/api/suppliers');
      setSuppliers(res.suppliers);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      tax_id: '',
      outstanding_balance: '0'
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setFormData({
      name: s.name,
      contact_person: s.contact_person || '',
      email: s.email || '',
      phone: s.phone,
      address: s.address || '',
      tax_id: s.tax_id || '',
      outstanding_balance: String(s.outstanding_balance || 0)
    });
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (editingSupplier) {
        await api.put(`/api/suppliers/${editingSupplier.id}`, {
          ...formData,
          outstanding_balance: Number(formData.outstanding_balance)
        });
        setEditingSupplier(null);
      } else {
        await api.post('/api/suppliers', {
          ...formData,
          outstanding_balance: Number(formData.outstanding_balance)
        });
        setIsAddModalOpen(false);
      }
      await fetchSuppliers();
      onRefreshGlobal?.();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingSupplier) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/suppliers/${deletingSupplier.id}`);
      setDeletingSupplier(null);
      await fetchSuppliers();
      onRefreshGlobal?.();
    } catch (err: any) {
      alert(err.message || 'Failed to delete supplier.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleView = async (id: number) => {
    try {
      const res = await api.get<{ supplier: Supplier; purchases: Purchase[] }>(`/api/suppliers/${id}`);
      setViewingSupplier(res);
    } catch (err: any) {
      alert(err.message || 'Failed to load supplier history.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Supplier Directory</h3>
          <p className="text-xs text-slate-400">
            Maintain authorized vendors, procurement contacts, and historical purchases
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-emerald-600/30 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Suppliers Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Company Name</th>
                <th className="py-3.5 px-3">Contact Person</th>
                <th className="py-3.5 px-3">Phone & Email</th>
                <th className="py-3.5 px-3">Tax ID / GSTIN</th>
                <th className="py-3.5 px-3">Orders</th>
                <th className="py-3.5 px-3 text-right">Total Purchased</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-emerald-500 mb-2" />
                    <span>Loading suppliers...</span>
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No suppliers registered. Add a supplier to begin creating purchase orders.
                  </td>
                </tr>
              ) : (
                suppliers.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-white text-sm">{s.name}</div>
                      {s.address && <div className="text-[11px] text-slate-400 truncate max-w-xs">{s.address}</div>}
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-200">
                      {s.contact_person || '—'}
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-white font-mono">{s.phone}</div>
                      {s.email && <div className="text-[11px] text-slate-400">{s.email}</div>}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {s.tax_id || '—'}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-300">
                      {s.total_orders || 0} order(s)
                    </td>
                    <td className="py-3 px-3 text-right font-mono font-bold text-white">
                      {formatCurrency(s.total_purchased || 0, currencySymbol)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleView(s.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          title="View Order History"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(s)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition-colors"
                          title="Edit Supplier"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => setDeletingSupplier(s)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                            title="Delete Supplier"
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

      {/* Add / Edit Supplier Modal */}
      <Modal
        isOpen={isAddModalOpen || editingSupplier !== null}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingSupplier(null);
        }}
        title={editingSupplier ? 'Edit Supplier Record' : 'Register New Supplier'}
        subtitle="Manage vendor contact info and tax registrations"
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
              Company Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Apex Industrial Solutions Ltd."
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                placeholder="e.g. Rajesh Kumar"
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              />
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
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="orders@vendor.com"
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Tax ID / GSTIN
              </label>
              <input
                type="text"
                value={formData.tax_id}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                placeholder="27AAACA1234A1Z1"
                className="w-full font-mono uppercase px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Office / Warehouse Address
            </label>
            <textarea
              rows={2}
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="Factory address, industrial area, city, pin code..."
              className="w-full px-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingSupplier(null);
              }}
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
              <span>{editingSupplier ? 'Update Supplier' : 'Save Supplier'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* View Supplier History Modal */}
      {viewingSupplier && (
        <Modal
          isOpen={true}
          onClose={() => setViewingSupplier(null)}
          title={`Supplier Profile: ${viewingSupplier.supplier.name}`}
          subtitle={`Total purchased: ${formatCurrency(viewingSupplier.supplier.total_purchased || 0, currencySymbol)}`}
          maxWidth="2xl"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-950/60 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block">Contact:</span>
                <span className="font-semibold text-white">{viewingSupplier.supplier.contact_person || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Phone:</span>
                <span className="font-mono text-white">{viewingSupplier.supplier.phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block">GSTIN:</span>
                <span className="font-mono text-slate-300">{viewingSupplier.supplier.tax_id || '—'}</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
                Past Purchase Orders ({viewingSupplier.purchases.length})
              </h4>
              <div className="border border-slate-800 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/80 text-slate-400 font-semibold">
                      <th className="py-2.5 px-3">PO Number</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {viewingSupplier.purchases.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-400">
                          No purchase orders recorded with this supplier yet.
                        </td>
                      </tr>
                    ) : (
                      viewingSupplier.purchases.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2.5 px-3 font-mono font-medium text-emerald-400">
                            {p.purchase_number}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400">{formatDate(p.date)}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                            {formatCurrency(p.total_amount, currencySymbol)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <Badge status={p.status} size="sm" />
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
                onClick={() => setViewingSupplier(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Supplier Confirmation */}
      {deletingSupplier && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setDeletingSupplier(null)}
          onConfirm={handleDelete}
          title="Delete Supplier?"
          message={`Are you sure you want to delete supplier "${deletingSupplier.name}"? If there are purchase orders linked to this supplier, deletion will be safely rejected to maintain historical audit logs.`}
          confirmLabel="Delete Supplier"
          isDestructive={true}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
};
