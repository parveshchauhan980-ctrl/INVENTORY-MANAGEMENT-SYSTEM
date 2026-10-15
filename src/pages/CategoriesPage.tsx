import React, { useState, useEffect } from 'react';
import { Layers, Plus, Edit2, Trash2, Boxes, AlertCircle, RefreshCw } from 'lucide-react';
import { api } from '../api/client';
import { Category } from '../types';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useAuth } from '../context/AuthContext';

export const CategoriesPage: React.FC = () => {
  const { isAdmin } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  // Form
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    color: '#6366f1'
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ categories: Category[] }>('/api/categories');
      setCategories(res.categories);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      code: `CAT-${Date.now().toString().slice(-4)}`,
      description: '',
      color: '#6366f1'
    });
    setFormError(null);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (c: Category) => {
    setEditingCategory(c);
    setFormData({
      name: c.name,
      code: c.code,
      description: c.description || '',
      color: c.color || '#6366f1'
    });
    setFormError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      if (editingCategory) {
        await api.put(`/api/categories/${editingCategory.id}`, formData);
        setEditingCategory(null);
      } else {
        await api.post('/api/categories', formData);
        setIsAddModalOpen(false);
      }
      await fetchCategories();
    } catch (err: any) {
      setFormError(err.message || 'Operation failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/categories/${deletingCategory.id}`);
      setDeletingCategory(null);
      await fetchCategories();
    } catch (err: any) {
      alert(err.message || 'Failed to delete category.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const presetColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6'];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-2xl border border-slate-800">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">Product Categories</h3>
          <p className="text-xs text-slate-400">
            Structure your warehouse inventory into clear departments and classifications
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md shadow-indigo-600/30 transition-all cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Category</span>
        </button>
      </div>

      {/* Grid of Category Cards */}
      {loading ? (
        <div className="py-16 text-center text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-indigo-500 mb-2" />
          <p className="text-sm">Loading categories...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 rounded-3xl border border-slate-800">
          <Layers className="h-10 w-10 text-slate-500 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-white">No categories configured</h4>
          <p className="text-xs text-slate-400 mt-1">Create categories to classify your products.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((c) => (
            <div
              key={c.id}
              className="p-5 rounded-3xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition-all shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="h-4 w-4 rounded-lg shadow-sm"
                      style={{ backgroundColor: c.color }}
                    />
                    <h4 className="text-base font-bold text-white tracking-tight">{c.name}</h4>
                  </div>
                  <span className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                    {c.code}
                  </span>
                </div>

                <p className="text-xs text-slate-400 line-clamp-2 min-h-[32px]">
                  {c.description || 'No descriptive summary added.'}
                </p>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <Boxes className="h-4 w-4 text-indigo-400" />
                  <span className="font-semibold text-white">{c.product_count || 0}</span>
                  <span className="text-slate-400">products</span>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(c)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => setDeletingCategory(c)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Category Modal */}
      <Modal
        isOpen={isAddModalOpen || editingCategory !== null}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingCategory(null);
        }}
        title={editingCategory ? 'Edit Category' : 'Create New Category'}
        subtitle="Manage category nomenclature and visual accent color"
        maxWidth="md"
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
              Category Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Computer Peripherals"
              className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Category Code *
            </label>
            <input
              type="text"
              required
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              placeholder="e.g. CAT-COMP"
              className="w-full font-mono uppercase px-3.5 py-2.5 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Color Tag
            </label>
            <div className="flex items-center gap-2 mb-2">
              {presetColors.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setFormData({ ...formData, color: col })}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${
                    formData.color === col ? 'scale-110 border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of what goes into this category..."
              className="w-full px-3.5 py-2 bg-slate-950/70 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingCategory(null);
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
              <span>{editingCategory ? 'Update Category' : 'Save Category'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Category Confirmation */}
      {deletingCategory && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setDeletingCategory(null)}
          onConfirm={handleDelete}
          title="Delete Category?"
          message={`Are you sure you want to delete category "${deletingCategory.name}"? Note: If this category still has products assigned to it, deletion will be safely rejected to prevent orphaned records.`}
          confirmLabel="Delete Category"
          isDestructive={true}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
};
