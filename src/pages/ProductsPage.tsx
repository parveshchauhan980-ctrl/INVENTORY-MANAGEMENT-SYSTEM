import React, { useState, useEffect } from 'react';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Sliders,
  AlertCircle,
  Barcode,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  Tag
} from 'lucide-react';
import { api, formatCurrency, formatDate } from '../api/client';
import { Product, Category } from '../types';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

interface ProductsPageProps {
  currencySymbol?: string;
  onRefreshGlobal?: () => void;
  openCreateOnMount?: boolean;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({
  currencySymbol = '₹',
  onRefreshGlobal,
  openCreateOnMount = false
}) => {
  const { isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(openCreateOnMount);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [adjustingProduct, setAdjustingProduct] = useState<Product | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: '',
    brand: '',
    category_id: '',
    unit: 'pcs',
    purchase_price: '',
    selling_price: '',
    quantity: '0',
    min_stock: '5',
    location: '',
    description: ''
  });

  // Adjust stock form state
  const [adjustData, setAdjustData] = useState({
    type: 'adjustment_in',
    quantity: '1',
    reason: 'Manual count audit correction'
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (selectedCategory !== 'all') params.append('categoryId', selectedCategory);
      if (selectedStatus !== 'all') params.append('status', selectedStatus);

      const res = await api.get<{ products: Product[] }>(`/api/products?${params.toString()}`);
      setProducts(res.products);
    } catch (err: any) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get<{ categories: Category[] }>('/api/categories');
      setCategories(res.categories);
    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [search, selectedCategory, selectedStatus]);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      sku: `SKU-${Date.now().toString().slice(-6)}`,
      barcode: `890${Date.now().toString().slice(-9)}`,
      brand: '',
      category_id: categories.length > 0 ? String(categories[0].id) : '',
      unit: 'pcs',
      purchase_price: '',
      selling_price: '',
      quantity: '10',
      min_stock: '5',
      location: 'Main Warehouse A-1',
      description: ''
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setFormData({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || '',
      brand: p.brand || '',
      category_id: String(p.category_id),
      unit: p.unit || 'pcs',
      purchase_price: String(p.purchase_price),
      selling_price: String(p.selling_price),
      quantity: String(p.quantity),
      min_stock: String(p.min_stock),
      location: p.location || '',
      description: p.description || ''
    });
    setFormError(null);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (editingProduct) {
        // Update product
        await api.put(`/api/products/${editingProduct.id}`, {
          name: formData.name,
          sku: formData.sku,
          barcode: formData.barcode,
          brand: formData.brand,
          category_id: Number(formData.category_id),
          unit: formData.unit,
          purchase_price: Number(formData.purchase_price),
          selling_price: Number(formData.selling_price),
          min_stock: Number(formData.min_stock),
          location: formData.location,
          description: formData.description
        });
        setEditingProduct(null);
      } else {
        // Create product
        await api.post('/api/products', {
          name: formData.name,
          sku: formData.sku,
          barcode: formData.barcode,
          brand: formData.brand,
          category_id: Number(formData.category_id),
          unit: formData.unit,
          purchase_price: Number(formData.purchase_price),
          selling_price: Number(formData.selling_price),
          quantity: Number(formData.quantity),
          min_stock: Number(formData.min_stock),
          location: formData.location,
          description: formData.description
        });
        setIsAddModalOpen(false);
      }

      await fetchProducts();
      onRefreshGlobal?.();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed. Please review inputs.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingProduct) return;
    setFormError(null);
    setIsSubmitting(true);

    try {
      await api.post('/api/stock/adjust', {
        product_id: adjustingProduct.id,
        type: adjustData.type,
        quantity: Number(adjustData.quantity),
        reason: adjustData.reason
      });

      setAdjustingProduct(null);
      await fetchProducts();
      onRefreshGlobal?.();
    } catch (err: any) {
      setFormError(err.message || 'Failed to adjust stock level.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/products/${deletingProduct.id}`);
      setDeletingProduct(null);
      await fetchProducts();
      onRefreshGlobal?.();
    } catch (err: any) {
      alert(err.message || 'Failed to delete product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control bar: search, category, status, add button */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div className="flex flex-1 flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by product name, SKU, brand, barcode..."
              className="w-full pl-10 pr-4 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Category filter */}
          <div className="w-full sm:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status filter */}
          <div className="w-full sm:w-40">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-xs sm:text-sm text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors"
            >
              <option value="all">All Statuses</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>
        </div>

        {/* Add Product Button */}
        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all cursor-pointer whitespace-nowrap"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* Products Table Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="py-3.5 px-4">Product Info</th>
                <th className="py-3.5 px-3">Category</th>
                <th className="py-3.5 px-3">Purchase Price</th>
                <th className="py-3.5 px-3">Selling Price</th>
                <th className="py-3.5 px-3">Stock Level</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-500 mb-2" />
                    <span>Loading products from database...</span>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No products found matching your search or filters.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const marginPercent = p.selling_price > 0 ? Math.round(((p.selling_price - p.purchase_price) / p.selling_price) * 100) : 0;
                  return (
                    <tr key={p.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-white text-sm">{p.name}</div>
                        <div className="flex items-center gap-2 mt-0.5 font-mono text-[11px] text-slate-400">
                          <span>SKU: {p.sku}</span>
                          {p.barcode && <span>&bull; {p.barcode}</span>}
                          {p.brand && <span className="text-slate-300 font-sans font-medium">&bull; {p.brand}</span>}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                          style={{
                            backgroundColor: `${p.category_color || '#6366f1'}20`,
                            color: p.category_color || '#818cf8',
                            borderColor: `${p.category_color || '#6366f1'}40`
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: p.category_color || '#6366f1' }}
                          />
                          {p.category_name}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-300">
                        {formatCurrency(p.purchase_price, currencySymbol)}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-bold text-white">
                          {formatCurrency(p.selling_price, currencySymbol)}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-medium">
                          {marginPercent > 0 ? `+${marginPercent}% margin` : '—'}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-mono font-extrabold text-sm text-white">
                          {p.quantity} <span className="text-xs font-normal text-slate-400 font-sans">{p.unit}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          Min alert: {p.min_stock}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge status={p.status} />
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setAdjustingProduct(p);
                              setAdjustData({
                                type: 'adjustment_in',
                                quantity: '1',
                                reason: 'Manual audit stock count correction'
                              });
                              setFormError(null);
                            }}
                            title="Quick Stock Adjustment"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Sliders className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(p)}
                            title="Edit Product"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setDeletingProduct(p)}
                              title="Delete Product"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isAddModalOpen || editingProduct !== null}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProduct(null);
        }}
        title={editingProduct ? 'Edit Product Details' : 'Add New Product to Inventory'}
        subtitle={editingProduct ? `Updating SKU: ${editingProduct.sku}` : 'Fill in the specifications, price, and stock levels'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveProduct} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Product Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Logitech MX Master 3S Wireless Mouse"
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                SKU (Stock Keeping Unit) *
              </label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                placeholder="e.g. ELEC-LOGI-001"
                className="w-full font-mono uppercase px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Barcode / EAN
              </label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                placeholder="e.g. 890103092811"
                className="w-full font-mono px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Brand / Manufacturer
              </label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                placeholder="e.g. Logitech, Dell, Bosch"
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Category *
              </label>
              <select
                required
                value={formData.category_id}
                onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="">Select a category</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Purchase Price ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={formData.purchase_price}
                onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                placeholder="0.00"
                className="w-full font-mono px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Selling Price ({currencySymbol}) *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                placeholder="0.00"
                className="w-full font-mono px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            {!editingProduct && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Opening Stock Quantity *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="0"
                  className="w-full font-mono px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Minimum Stock Alert Level *
              </label>
              <input
                type="number"
                min="1"
                required
                value={formData.min_stock}
                onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                placeholder="5"
                className="w-full font-mono px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Unit of Measure
              </label>
              <select
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="pcs">Pieces (pcs)</option>
                <option value="box">Box (box)</option>
                <option value="kg">Kilogram (kg)</option>
                <option value="ltr">Liter (ltr)</option>
                <option value="meter">Meter (meter)</option>
                <option value="set">Set (set)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Warehouse Location / Shelf
              </label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g. Aisle 3 - Rack B"
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Description / Notes
              </label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Additional product specifications, warranty info, etc."
                className="w-full px-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingProduct(null);
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
              <span>{editingProduct ? 'Update Product' : 'Save Product'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Quick Stock Adjustment Modal */}
      {adjustingProduct && (
        <Modal
          isOpen={true}
          onClose={() => setAdjustingProduct(null)}
          title={`Adjust Stock: ${adjustingProduct.name}`}
          subtitle={`Current stock: ${adjustingProduct.quantity} ${adjustingProduct.unit} (SKU: ${adjustingProduct.sku})`}
          maxWidth="md"
        >
          <form onSubmit={handleAdjustStock} className="space-y-4">
            {formError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-400 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Adjustment Type *
              </label>
              <select
                value={adjustData.type}
                onChange={(e) => setAdjustData({ ...adjustData, type: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="adjustment_in">+ Stock Increase (Found inventory / count correction)</option>
                <option value="adjustment_out">- Stock Decrease (Inventory discrepancy)</option>
                <option value="damage">- Damaged Goods (Write-off / broken in transit)</option>
                <option value="return">+ Customer Return (Restocked)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Quantity Units *
              </label>
              <input
                type="number"
                min="1"
                required
                value={adjustData.quantity}
                onChange={(e) => setAdjustData({ ...adjustData, quantity: e.target.value })}
                className="w-full font-mono px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
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
                placeholder="Explain why this inventory adjustment is being executed..."
                className="w-full px-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setAdjustingProduct(null)}
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
                <span>Record Stock Adjustment</span>
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Product Confirmation */}
      {deletingProduct && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setDeletingProduct(null)}
          onConfirm={handleDeleteProduct}
          title="Delete Product from Catalog?"
          message={`Are you sure you want to permanently delete "${deletingProduct.name}" (SKU: ${deletingProduct.sku})? Note: Products with existing sales invoices or purchase records cannot be deleted to preserve financial audit integrity.`}
          confirmLabel="Delete Product"
          isDestructive={true}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
};
