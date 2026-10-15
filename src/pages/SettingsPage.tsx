import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Building,
  DollarSign,
  Percent,
  MapPin,
  Phone,
  Mail,
  ShieldAlert,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { api } from '../api/client';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

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
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [syncingCloud, setSyncingCloud] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

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

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get<{ settings: Record<string, string> }>('/api/settings');
      setSettings((prev) => ({ ...prev, ...res.settings }));
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
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

  const handleResetDemo = async () => {
    setResetting(true);
    try {
      await api.post('/api/settings/reset-demo');
      setIsResetConfirmOpen(false);
      setSuccessMessage('Database reset to clean demo state with sample products, transactions, and categories!');
      await fetchSettings();
      onRefreshGlobal?.();
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      alert(err.message || 'Failed to reset demo data.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">System & Invoice Configuration</h3>
          <p className="text-xs text-slate-400">
            Customize company tax invoice headers, default GST rate, currency symbols, and database seeds
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

      {/* Firebase Cloud Sync Box */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
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

      {/* Presentation Demo Data Reset Box */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex items-center gap-2.5 text-amber-400">
          <RotateCcw className="h-5 w-5" />
          <h4 className="text-sm font-bold text-white">College Project Presentation Tools</h4>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Need to demonstrate the system from a clean state for your college examiner or project guide?
          Clicking below resets the SQLite database to factory demonstration data with pre-filled inventory items,
          sample suppliers, customers, purchases, and sales invoices.
        </p>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => setIsResetConfirmOpen(true)}
            className="px-4 py-2 bg-slate-800 hover:bg-amber-600/20 text-slate-200 hover:text-amber-300 border border-slate-700 hover:border-amber-500/40 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset Demo Database to Initial State</span>
          </button>
        </div>
      </div>

      {isResetConfirmOpen && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setIsResetConfirmOpen(false)}
          onConfirm={handleResetDemo}
          title="Reset All Database Records?"
          message="This will overwrite current product changes and repopulate the database with clean demonstration data (products, categories, users, purchases, and sales). Do you want to continue?"
          confirmLabel="Reset Everything"
          isDestructive={true}
          isLoading={resetting}
        />
      )}
    </div>
  );
};
